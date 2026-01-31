import express from "express";
import passport from "../auth.js";
import { google } from "googleapis";
import { obterAccessTokenValido } from "../services/tokenService.js";
import { atualizarTokensNoBanco } from "../services/linksunBackend.js";
import { setCachedToken } from "../helpers/cache.js";
import { tokenExpiresAtTimestamp } from "../metrics.js";
import { logError, logInfo } from "../utils/logger.js";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const DOC_MIME = "application/vnd.google-apps.document";
const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";

function requireQueryParams(params) {
  return (req, res, next) => {
    for (const p of params) {
      if (!req.query?.[p]) {
        return res.status(400).json({ error: "Parâmetros obrigatórios ausentes" });
      }
    }
    next();
  };
}

export function createAuthRouter() {
  const router = express.Router();

  router.get("/auth/google", (req, res, next) => {
    const state = req.query.state;
    req.session.oauthState = state;
    passport.authenticate("google", {
      scope: [
        "profile",
        "email",
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/documents",
      ],
      accessType: "offline",
      prompt: "consent",
      state,
    })(req, res, next);
  });

  router.get(
    "/auth/google/callback",
    (req, res, next) => {
      passport.authenticate("google", { failureRedirect: "/" }, async (err, user) => {
        if (err) return next(err);

        logInfo("STATE RAW:", req.query.state);
        const decodedState = Buffer.from(decodeURIComponent(req.query.state), "base64").toString(
          "utf-8"
        );
        const state = JSON.parse(decodedState);
        logInfo("STATE PARSED:", state);

        const { lojaId, sigla, env, origin } = state;
        delete req.session.oauthState;

        try {
          await atualizarTokensNoBanco({
            lojaId,
            sigla,
            accessToken: user.accessToken,
            refreshToken: user.refreshToken,
            env,
          });

          const expiresIn = 3600;
          await setCachedToken(
            env,
            sigla,
            lojaId,
            { accessToken: user.accessToken, expiresAt: Date.now() + expiresIn * 1000 },
            expiresIn - 120
          );
          tokenExpiresAtTimestamp.set(
            { env, sigla, lojaId },
            Math.floor((Date.now() + expiresIn * 1000) / 1000)
          );

          return res.send(`
            <script>
              window.opener.postMessage({ type: 'google-auth-success' }, "${origin}");
              window.close();
            </script>
          `);
        } catch (error) {
          logError("Erro ao processar callback", error);
          return res.status(500).send("Erro ao salvar autenticação.");
        }
      })(req, res, next);
    }
  );

  router.get(
    "/internal/google/token",
    requireQueryParams(["lojaId", "sigla", "env"]),
    async (req, res) => {
      const { lojaId, sigla, env } = req.query;
      const token = await obterAccessTokenValido({ lojaId, sigla, env });

      if (!token) return res.status(401).json({ error: "Não autenticado" });
      return res.json({ accessToken: token });
    }
  );

  router.get(
    "/auth/drive/list",
    requireQueryParams(["lojaId", "sigla", "env"]),
    async (req, res) => {
      const { folderId = "root", lojaId, sigla, env } = req.query;

      try {
        const accessToken = await obterAccessTokenValido({ lojaId, sigla, env });
        if (!accessToken) return res.status(401).json({ error: "Não autenticado no Google" });

        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });
        const drive = google.drive({ version: "v3", auth });

        const isSharedWithMe = folderId === "sharedWithMe";
        const q = isSharedWithMe
          ? "sharedWithMe = true and trashed = false"
          : `'${folderId}' in parents and trashed = false`;

        const result = await drive.files.list({
          q,
          fields:
            "files(id, name, mimeType, iconLink, modifiedTime, owners(displayName), shortcutDetails)",
          orderBy: "name",
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
        });

        const files = (result.data.files || []).map((f) => {
          const isShortcut = f.mimeType === SHORTCUT_MIME;
          return {
            ...f,
            isShortcut,
            effectiveId: isShortcut ? f.shortcutDetails?.targetId : f.id,
            effectiveMimeType: isShortcut ? f.shortcutDetails?.targetMimeType : f.mimeType,
          };
        });

        const folders = files.filter((f) => f.effectiveMimeType === FOLDER_MIME);
        const docs = files.filter((f) => f.effectiveMimeType === DOC_MIME);

        return res.json({ files: [...folders, ...docs] });
      } catch (err) {
        logError("❌ Erro ao listar Drive", err);
        return res.status(500).json({ error: "Erro ao acessar Google Drive" });
      }
    }
  );

  router.get(
    "/auth/status",
    requireQueryParams(["lojaId", "sigla", "env"]),
    async (req, res) => {
      const { lojaId, sigla, env } = req.query;

      try {
        const tokenValido = await obterAccessTokenValido({ lojaId, sigla, env });
        if (!tokenValido) return res.json({ connected: false });

        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokenValido}` },
        });
        if (!userInfoRes.ok) return res.json({ connected: false });

        const userInfo = await userInfoRes.json();
        return res.json({
          connected: true,
          profile: {
            name: userInfo.name,
            email: userInfo.email,
            picture: userInfo.picture,
            id: userInfo.id,
          },
        });
      } catch (err) {
        logError("Erro em /auth/status", err);
        return res.json({ connected: false });
      }
    }
  );

  return router;
}

