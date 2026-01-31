import express from "express";
import session from "express-session";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger.js";
import passport from "./auth.js";
import { config } from "./config.js";
import { logInfo } from "./utils/logger.js";
import { storeLastSeenMiddleware } from "./middleware/storeLastSeen.js";
import { metricsHttpMiddleware } from "./middleware/metricsHttp.js";
import { createMetricsRouter } from "./routes/metricsRoutes.js";
import { createAuthRouter } from "./routes/authRoutes.js";

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3001",
  process.env.FRONTEND_URL_HOM,
  process.env.FRONTEND_URL_PROD
].filter(Boolean).map(u => new URL(u).origin);

app.use(cors({ origin: allowedOrigins, credentials: true }));
logInfo("🌍 Allowed origins:", allowedOrigins);
app.use(
  session({
    name: "google-auth-session",
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,          // 🔴 OBRIGATÓRIO em HTTPS
      sameSite: "none",      // 🔴 OBRIGATÓRIO para popup cross-site
      maxAge: 10 * 60 * 1000 // 10 minutos
    }
  })
);

app.use(express.json());
app.use(passport.initialize());
app.use(passport.session());

app.use(storeLastSeenMiddleware);
app.use(metricsHttpMiddleware);

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
app.get("/docs.json", (req, res) => res.json(swaggerSpec));

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});

app.use(createMetricsRouter());
app.use(createAuthRouter());
// =======
// app.get("/auth/google", (req, res, next) => {
//   const state = req.query.state; // O Base64 que enviamos
//   req.session.oauthState = state;
//   passport.authenticate("google", {
//     scope: ["profile", "email", "https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/documents"],
//     accessType: "offline",
//     prompt: "consent",
//     state: state // O Google vai devolver isso no callback
//   })(req, res, next);
// });

// async function removerTokensNoBanco(lojaId, sigla, env) {
//   const backendUrl = getBackendUrl(env);
//   const url = `${backendUrl}?action=deletarTokenGoogleAuth&class=Lojas&sigla=${sigla}`;

//   await fetch(url, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ lojaId }),
//   });
//   log(`🗑️ Tokens removidos do banco para loja ${lojaId}`);
// }
// async function obterAccessTokenValido(lojaId, sigla, env) {
//   // 1. Tenta Cache
//   const cached = getCachedToken(lojaId, sigla, env);
//   if (cached) return cached.accessToken;

//   // 2. Busca no banco para ver se existe um token
//   const loja = await buscarLojaNoBanco(lojaId, sigla, env);
//   if (!loja?.accessTokenGoogle_loja) return null;

//   // 3. Testa o token atual contra a API do Google
//   try {
//     const testRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
//       headers: { Authorization: `Bearer ${loja.accessTokenGoogle_loja}` },
//     });

//     if (testRes.ok) {
//       // Token do banco ainda é válido, salva no cache e retorna
//       setCachedToken(lojaId, {
//         accessToken: loja.accessTokenGoogle_loja,
//         expiresAt: Date.now() + 3500 * 1000 // Assume ~1h
//       }, sigla, env);
//       return loja.accessTokenGoogle_loja;
//     }

//     // 4. Se chegou aqui (401), o token do banco expirou. Fazemos Refresh.
//     log(`🔄 Token do banco para loja ${lojaId} expirado. Tentando refresh...`);

//     // Reaproveita sua lógica de refresh já existente chamando a função interna
//     // ou simulando uma requisição para a sua própria rota
//     const oauth2Client = new OAuth2Client(config.clientID, config.clientSecret);
//     oauth2Client.setCredentials({ refresh_token: loja.refreshTokenGoogle_loja });

//     const { credentials } = await oauth2Client.refreshAccessToken();
//     const newAt = credentials.access_token;
//     const newRt = credentials.refresh_token || loja.refreshTokenGoogle_loja;
//     const expiresAt = credentials.expiry_date || (Date.now() + 3600 * 1000);

//     // Atualiza banco e cache
//     await atualizarTokensNoBanco(lojaId, sigla, newAt, newRt, env);
//     setCachedToken(lojaId, { accessToken: newAt, expiresAt }, sigla, env);

//     return newAt;
//   } catch (err) {
//     logError(`❌ Falha crítica ao validar/renovar token para loja ${lojaId}`, err);
//     return null;
//   }
// }

// app.get("/internal/google/token", async (req, res) => {
//   const { lojaId, sigla, env } = req.query;

//   if (!lojaId || !sigla || !env) {
//     return res.status(400).json({ error: "Parâmetros obrigatórios" });
//   }

//   const token = await obterAccessTokenValido(lojaId, sigla, env);

//   if (!token) {
//     return res.status(401).json({ error: "Não autenticado" });
//   }

//   return res.json({ accessToken: token });
// });

// function isGoogleAuthError(err) {
//   const status = err?.response?.status ?? err?.code;
//   return status === 401 || status === 403;
// }

// app.get("/auth/drive/list", async (req, res) => {
//   const {
//     folderId = "root",
//     lojaId,
//     sigla,
//     env
//   } = req.query;
//   log("Drive list:", lojaId, sigla, env);
//   if (!lojaId || !sigla || !env) {
//     return res.status(400).json({ error: "Parâmetros obrigatórios ausentes" });
//   }

//   const runList = async () => {
//     const accessToken = await obterAccessTokenValido(lojaId, sigla, env);
//     if (!accessToken) {
//       return { ok: false, status: 401, error: "Não autenticado no Google" };
//     }
//     const auth = new google.auth.OAuth2();
//     auth.setCredentials({ access_token: accessToken });
//     const drive = google.drive({ version: "v3", auth });
//     const isSharedWithMe = folderId === "sharedWithMe";
//     const q = isSharedWithMe
//       ? "sharedWithMe = true and trashed = false"
//       : `'${folderId}' in parents and trashed = false`;
//     const result = await drive.files.list({
//       q,
//       fields:
//         "files(id, name, mimeType, iconLink, modifiedTime, owners(displayName), shortcutDetails)",
//       orderBy: "name",
//       includeItemsFromAllDrives: true,
//       supportsAllDrives: true,
//     });
//     const files = (result.data.files || []).map((f) => {
//       const isShortcut = f.mimeType === SHORTCUT_MIME;
//       return {
//         ...f,
//         isShortcut,
//         effectiveId: isShortcut ? f.shortcutDetails?.targetId : f.id,
//         effectiveMimeType: isShortcut
//           ? f.shortcutDetails?.targetMimeType
//           : f.mimeType,
//       };
//     });
//     const folders = files.filter((f) => f.effectiveMimeType === FOLDER_MIME);
//     const docs = files.filter((f) => f.effectiveMimeType === DOC_MIME);
//     return { ok: true, files: [...folders, ...docs] };
//   };

//   try {
//     const out = await runList();
//     if (!out.ok) {
//       return res.status(out.status).json({ error: out.error });
//     }
//     return res.json({ files: out.files });
//   } catch (err) {
//     const isAuthError = isGoogleAuthError(err);
//     const canRetry = !req._driveListRetried;
//     if (isAuthError && canRetry) {
//       req._driveListRetried = true;
//       const key = getTokenCacheKey(lojaId, sigla, env);
//       tokenCache.delete(key);
//       log(`🔄 Drive rejeitou token para loja ${lojaId} (401/403), invalidando cache e retentando...`);
//       try {
//         const retry = await runList();
//         if (retry.ok) return res.json({ files: retry.files });
//         return res.status(retry.status || 401).json({ error: retry.error || "Não autenticado" });
//       } catch (retryErr) {
//         logError("❌ Erro ao listar Drive (retry)", retryErr);
//         return res.status(500).json({ error: "Erro ao acessar Google Drive" });
//       }
//     }
//     logError("❌ Erro ao listar Drive", err);
//     return res.status(500).json({ error: "Erro ao acessar Google Drive" });
//   }
// });

// app.get("/auth/status", async (req, res) => {
//   const { lojaId, sigla, env } = req.query;
//   log("Dados vindo ->", lojaId, sigla, env);
//   if (!lojaId || !sigla || !env) {
//     return res.status(400).json({ connected: false, error: "Parâmetros insuficientes" });
//   }

//   try {
//     let tokenValido = await obterAccessTokenValido(lojaId, sigla, env);

//     if (!tokenValido) {
//       return res.json({ connected: false });
//     }

//     // Com o token validado/renovado, pegamos os dados do perfil
//     let userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
//       headers: { Authorization: `Bearer ${tokenValido}` },
//     });

//     // Se Google retornou 401, token em cache pode estar inválido (revogado/expirado) – invalida e tenta de novo
//     if (!userInfoRes.ok && userInfoRes.status === 401) {
//       const key = getTokenCacheKey(lojaId, sigla, env);
//       tokenCache.delete(key);
//       log(`🔄 Token em cache rejeitado pelo Google (401) para loja ${lojaId}, invalidando cache e tentando refresh...`);
//       tokenValido = await obterAccessTokenValido(lojaId, sigla, env);
//       if (tokenValido) {
//         userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
//           headers: { Authorization: `Bearer ${tokenValido}` },
//         });
//       }
//     }

//     if (!userInfoRes?.ok) return res.json({ connected: false });

//     const userInfo = await userInfoRes.json();
//     log("Dados do usuario ->", userInfo.email);

//     return res.json({
//       connected: true,
//       profile: {
//         name: userInfo.name,
//         email: userInfo.email,
//         picture: userInfo.picture,
//         id: userInfo.id
//       },
//     });
//   } catch (err) {
//     logError("Erro em /auth/status", err);
//     return res.json({ connected: false });
//   }
// });

// app.get("/auth/google/callback", (req, res, next) => {
//   passport.authenticate("google", { failureRedirect: "/" }, async (err, user) => {
//     if (err) return next(err);
//     // if (req.query.state !== req.session.oauthState) {
//     //   return res.status(403).send("Invalid OAuth state");
//     // }
//     log("STATE RAW:", req.query.state);

//     // 1. Decodifica o state para saber qual loja é
//     const decodedState = Buffer
//       .from(decodeURIComponent(req.query.state), "base64")
//       .toString("utf-8");

//     const state = JSON.parse(decodedState);
//     log("STATE RAW AFETR:", state);

//     const { lojaId, sigla, env, origin } = state;
//     delete req.session.oauthState;
//     try {
//       // 2. Grava no banco PHP usando os dados do state
//       await atualizarTokensNoBanco(
//         lojaId,
//         sigla,
//         user.accessToken,
//         user.refreshToken,
//         env
//       );

//       // 3. Atualiza o cache em memória do Node imediatamente
//       setCachedToken(lojaId, {
//         accessToken: user.accessToken,
//         expiresAt: Date.now() + 3600 * 1000
//       }, sigla, env);

//       // 4. Responde ao frontend
//       res.send(`
//         <script>
//           window.opener.postMessage({ type: 'google-auth-success' }, "${origin}");
//           window.close();
//         </script>
//       `);
//     } catch (error) {
//       logError("Erro ao processar callback", error);
//       res.status(500).send("Erro ao salvar autenticação.");
//     }
//   })(req, res, next);
// });


// app.post("/auth/refresh-token", async (req, res) => {
//   const { lojaId, sigla, env } = req.body;
//   if (!lojaId) return res.status(400).json({ error: "lojaId é obrigatório" });

//   log(`🔄 Refresh token solicitado para loja ${lojaId} (env: ${env})`);

//   // 1. Verifica se já temos um token válido no cache
//   const cached = getCachedToken(lojaId, sigla, env);
//   if (cached) {
//     return res.json({
//       accessToken: cached.accessToken,
//       expiresIn: cached.expiresIn,
//       expiresAt: cached.expiresAt,
//       fromCache: true
//     });
//   }
//   // 2. Obtém lock para evitar refresh simultâneo
//   const lock = getRefreshLock(lojaId, sigla, env);

//   // Se já existe um refresh em andamento, aguarda e retorna o resultado
//   if (!lock.isNew) {
//     try {
//       const result = await lock.promise;
//       if (result?.error) {
//         return res.status(result.status || 401).json(result);
//       }
//       return res.json(result);
//     } catch (err) {
//       return res.status(500).json({ error: "Falha ao aguardar refresh", code: "LOCK_ERROR" });
//     }
//   }

//   // 3. Este é o primeiro a solicitar - faz o refresh
//   try {
//     // Busca os tokens atuais da loja no backend PHP
//     const loja = await buscarLojaNoBanco(lojaId, sigla, env);
//     log("📦 Loja encontrada:", loja?.id_loja);
//     const currentRefreshToken = loja?.refreshTokenGoogle_loja;

//     if (!currentRefreshToken) {
//       logWarn("⚠️ Nenhum refresh token encontrado para a loja");
//       const errorResult = {
//         error: "Nenhum token encontrado para esta loja.",
//         code: "NO_REFRESH_TOKEN",
//         status: 401
//       };
//       lock.release(errorResult);
//       return res.status(401).json(errorResult);
//     }

//     const oauth2Client = new OAuth2Client(config.clientID, config.clientSecret);
//     oauth2Client.setCredentials({ refresh_token: currentRefreshToken });

//     // Pede renovação ao Google
//     log("🔐 Solicitando novo token ao Google...");
//     const { credentials } = await oauth2Client.refreshAccessToken();

//     const newAccessToken = credentials.access_token;
//     // Se o Google não mandar um novo refresh, mantemos o que já estava no banco
//     const newRefreshToken = credentials.refresh_token || currentRefreshToken;
//     // Google retorna expires_in em segundos (geralmente 3599 = ~1 hora)
//     const expiresIn = credentials.expiry_date
//       ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
//       : 3600;
//     const expiresAt = Date.now() + (expiresIn * 1000);

//     log("🔑 Novos tokens obtidos. Expira em:", expiresIn, "segundos");

//     // Atualiza os tokens no backend PHP
//     await atualizarTokensNoBanco(lojaId, sigla, newAccessToken, newRefreshToken, env);

//     const result = {
//       accessToken: newAccessToken,
//       expiresIn,
//       expiresAt
//     };

//     // Salva no cache para evitar refresh desnecessário
//     setCachedToken(lojaId, result, sigla, env);

//     // Libera o lock com o resultado para outras requisições aguardando
//     lock.release(result);

//     return res.json(result);

//   } catch (err) {
//     // Tratamento específico para erros do Google OAuth
//     const googleError = err?.response?.data?.error || err?.message;
//     const googleErrorDesc = err?.response?.data?.error_description;

//     logError("❌ Erro ao renovar token:", {
//       message: err?.message,
//       googleError,
//       googleErrorDesc,
//       code: err?.code
//     });

//     let errorResult;

//     // Token revogado ou inválido - usuário precisa fazer login novamente
//     if (googleError === "invalid_grant" || googleErrorDesc?.includes("revoked")) {
//       // Limpa o cache se existir (chave correta: env:sigla:lojaId)
//       tokenCache.delete(getTokenCacheKey(lojaId, sigla, env));
//       errorResult = {
//         error: "Token revogado ou expirado. Necessário novo login.",
//         code: "TOKEN_REVOKED",
//         status: 401
//       };
//     } else if (googleError === "invalid_client") {
//       errorResult = {
//         error: "Erro de configuração OAuth.",
//         code: "INVALID_CLIENT",
//         status: 500
//       };
//     } else {
//       errorResult = {
//         error: "Falha na renovação",
//         code: "REFRESH_FAILED",
//         status: err?.code || err?.response?.status || 500
//       };
//     }

//     // Libera o lock com erro
//     lock.release(errorResult);

//     return res.status(errorResult.status).json(errorResult);
//   }
// });

// app.post("/auth/logout", async (req, res) => {
//   const { lojaId, sigla, env } = req.body;

//   // Chave do cache é env:sigla:lojaId, não apenas lojaId
//   if (lojaId != null && sigla && env) {
//     tokenCache.delete(getTokenCacheKey(lojaId, sigla, env));
//   }
//   await removerTokensNoBanco(lojaId, sigla, env);

//   res.json({ ok: true });
// });
// >>>>>>> master

app.listen(4000, () => logInfo("✅ Google Auth Service rodando na porta 4000"));
