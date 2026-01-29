import express from "express";
import session from "express-session";
import cors from "cors";
import passport from "./auth.js";
import { config } from "./config.js";
import { OAuth2Client } from "google-auth-library";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger.js";
import { google } from "googleapis";

const app = express();

const FOLDER_MIME = "application/vnd.google-apps.folder";
const DOC_MIME = "application/vnd.google-apps.document";
const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";
// =============================================
// Sistema de Logs com Timestamp
// =============================================

function getTimestamp() {
  return new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function log(...args) {
  console.log(`[${getTimestamp()}]`, ...args);
}

function logWarn(...args) {
  console.warn(`[${getTimestamp()}]`, ...args);
}

function logError(...args) {
  console.error(`[${getTimestamp()}]`, ...args);
}

// =============================================
// Sistema de Lock e Cache para Refresh Token
// =============================================

// Cache de tokens válidos por loja (evita refresh desnecessário)
const tokenCache = new Map();

// Locks ativos para evitar refresh simultâneo
const refreshLocks = new Map();

/**
 * Obtém ou aguarda um lock para refresh de uma loja específica
 * Se já existe um refresh em andamento, aguarda ele terminar
 */
function getRefreshLock(lojaId, sigla, env) {
  const key = getTokenCacheKey(lojaId, sigla, env);

  if (refreshLocks.has(key)) {
    log(`⏳ Refresh já em andamento para loja ${lojaId}, aguardando...`);
    return { isNew: false, promise: refreshLocks.get(key) };
  }

  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  refreshLocks.set(key, promise);

  return {
    isNew: true,
    promise,
    release: (result) => {
      refreshLocks.delete(key);
      resolve(result);
    }
  };
}

/**
 * Verifica se existe um access token válido no cache
 */
function getCachedToken(lojaId, sigla, env) {
  const key = getTokenCacheKey(lojaId, sigla, env);

  const cached = tokenCache.get(key);

  if (!cached) return null;

  // Token válido se faltam mais de 2 minutos para expirar
  const isValid = cached.expiresAt > Date.now() + 2 * 60 * 1000;

  if (isValid) {
    log(`📦 Usando token do cache para loja ${lojaId}`);
    return cached;
  }

  tokenCache.delete(key);
  return null;
}
function getTokenCacheKey(lojaId, sigla, env) {
  return `${env}:${sigla}:${lojaId}`;
}

/**
 * Salva token no cache
 */
function setCachedToken(lojaId, data, sigla, env) {
  const key = getTokenCacheKey(lojaId, sigla, env);

  tokenCache.set(key, {
    accessToken: data.accessToken,
    expiresAt: data.expiresAt,
    expiresIn: data.expiresIn
  });
}

// =============================================
// Funções de integração com o Backend PHP
// =============================================

function getBackendUrl(env) {
  if (env === "prod") {
    return config.linksunBackendUrl;
  } else if (env === "hom") {
    return config.linksunBackendUrlHom;
  }
  return config.linksunBackendUrlDev;
}


async function buscarLojaNoBanco(lojaId, sigla, env) {
  const backendUrl = getBackendUrl(env);
  const url = `${backendUrl}?action=obterLoja&class=Lojas&id_loja=${lojaId}&sigla=${sigla}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });


  if (!response.ok) {
    throw new Error(`Erro ao buscar loja: ${response.status}`);
  }

  const data = await response.json();

  return data.body;
}

async function atualizarTokensNoBanco(lojaId, sigla, accessToken, refreshToken, env) {
  const backendUrl = getBackendUrl(env);
  const url = `${backendUrl}?action=gravarTokenGoogleAuth&class=Lojas&sigla=${sigla}`;

  log("💾 Atualizando tokens no banco:", url,
    "| Com os dados: {loja: ", lojaId,
    " | accessToken: ", accessToken,
    " | refreshToken:", refreshToken, "}");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lojaId,
      accessTokenGoogle_loja: accessToken,
      refreshTokenGoogle_loja: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Erro ao atualizar tokens: ${response.status}`);
  }

  const data = await response.json();
  log("✅ Tokens atualizados com sucesso");
  return data;
}

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_HOM,
  process.env.FRONTEND_URL_PROD
].filter(Boolean).map(u => new URL(u).origin);

app.use(cors({ origin: allowedOrigins, credentials: true }));
log("🌍 Allowed origins:", allowedOrigins);
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

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
app.get("/docs.json", (req, res) => res.json(swaggerSpec));

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});

app.get("/auth/google", (req, res, next) => {
  const state = req.query.state; // O Base64 que enviamos
  req.session.oauthState = state;
  passport.authenticate("google", {
    scope: ["profile", "email", "https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/documents"],
    accessType: "offline",
    prompt: "consent",
    state: state // O Google vai devolver isso no callback
  })(req, res, next);
});

async function removerTokensNoBanco(lojaId, sigla, env) {
  const backendUrl = getBackendUrl(env);
  const url = `${backendUrl}?action=deletarTokenGoogleAuth&class=Lojas&sigla=${sigla}`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lojaId }),
  });
  log(`🗑️ Tokens removidos do banco para loja ${lojaId}`);
}
async function obterAccessTokenValido(lojaId, sigla, env) {
  // 1. Tenta Cache
  const cached = getCachedToken(lojaId, sigla, env);
  if (cached) return cached.accessToken;

  // 2. Busca no banco para ver se existe um token
  const loja = await buscarLojaNoBanco(lojaId, sigla, env);
  if (!loja?.accessTokenGoogle_loja) return null;

  // 3. Testa o token atual contra a API do Google
  try {
    const testRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${loja.accessTokenGoogle_loja}` },
    });

    if (testRes.ok) {
      // Token do banco ainda é válido, salva no cache e retorna
      setCachedToken(lojaId, {
        accessToken: loja.accessTokenGoogle_loja,
        expiresAt: Date.now() + 3500 * 1000 // Assume ~1h
      }, sigla, env);
      return loja.accessTokenGoogle_loja;
    }

    // 4. Se chegou aqui (401), o token do banco expirou. Fazemos Refresh.
    log(`🔄 Token do banco para loja ${lojaId} expirado. Tentando refresh...`);

    // Reaproveita sua lógica de refresh já existente chamando a função interna
    // ou simulando uma requisição para a sua própria rota
    const oauth2Client = new OAuth2Client(config.clientID, config.clientSecret);
    oauth2Client.setCredentials({ refresh_token: loja.refreshTokenGoogle_loja });

    const { credentials } = await oauth2Client.refreshAccessToken();
    const newAt = credentials.access_token;
    const newRt = credentials.refresh_token || loja.refreshTokenGoogle_loja;
    const expiresAt = credentials.expiry_date || (Date.now() + 3600 * 1000);

    // Atualiza banco e cache
    await atualizarTokensNoBanco(lojaId, sigla, newAt, newRt, env);
    setCachedToken(lojaId, { accessToken: newAt, expiresAt }, sigla, env);

    return newAt;
  } catch (err) {
    logError(`❌ Falha crítica ao validar/renovar token para loja ${lojaId}`, err);
    return null;
  }
}

app.get("/internal/google/token", async (req, res) => {
  const { lojaId, sigla, env } = req.query;

  if (!lojaId || !sigla || !env) {
    return res.status(400).json({ error: "Parâmetros obrigatórios" });
  }

  const token = await obterAccessTokenValido(lojaId, sigla, env);

  if (!token) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  return res.json({ accessToken: token });
});

app.get("/auth/drive/list", async (req, res) => {
  const {
    folderId = "root",
    lojaId,
    sigla,
    env
  } = req.query;
  console.log("Vim aqui", lojaId, sigla, env)
  if (!lojaId || !sigla || !env) {
    return res.status(400).json({ error: "Parâmetros obrigatórios ausentes" });
  }

  try {
    // 1️⃣ Token válido (cache + refresh automático)
    const accessToken = await obterAccessTokenValido(lojaId, sigla, env);
    console.log('Accesss', accessToken)
    if (!accessToken) {
      return res.status(401).json({ error: "Não autenticado no Google" });
    }

    // 2️⃣ Cliente Google
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    console.log('Passou 1')

    const drive = google.drive({ version: "v3", auth });

    console.log('Passou 2')
    // 3️⃣ Query
    const isSharedWithMe = folderId === "sharedWithMe";

    const q = isSharedWithMe
      ? "sharedWithMe = true and trashed = false"
      : `'${folderId}' in parents and trashed = false`;
    console.log('Passou 3')

    // 4️⃣ Chamada Drive
    const result = await drive.files.list({
      q,
      fields:
        "files(id, name, mimeType, iconLink, modifiedTime, owners(displayName), shortcutDetails)",
      orderBy: "name",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });
    console.log('Passou 4', result)

    // 5️⃣ Normalização (atalhos)
    const files = (result.data.files || []).map((f) => {
      const isShortcut = f.mimeType === SHORTCUT_MIME;

      return {
        ...f,
        isShortcut,
        effectiveId: isShortcut ? f.shortcutDetails?.targetId : f.id,
        effectiveMimeType: isShortcut
          ? f.shortcutDetails?.targetMimeType
          : f.mimeType,
      };
    });
    console.log('files', files)

    const folders = files.filter(
      (f) => f.effectiveMimeType === FOLDER_MIME
    );
    console.log('folders', folders)

    const docs = files.filter(
      (f) => f.effectiveMimeType === DOC_MIME
    );
    console.log('docs', docs)

    return res.json({
      files: [...folders, ...docs],
    });

  } catch (err) {
    logError("❌ Erro ao listar Drive", err);
    return res.status(500).json({ error: "Erro ao acessar Google Drive" });
  }
});

app.get("/auth/status", async (req, res) => {
  const { lojaId, sigla, env } = req.query;
  console.log('Dados vindo ->', lojaId, sigla, env)
  if (!lojaId || !sigla || !env) {
    return res.status(400).json({ connected: false, error: "Parâmetros insuficientes" });
  }

  try {
    const tokenValido = await obterAccessTokenValido(lojaId, sigla, env);

    if (!tokenValido) {
      return res.json({ connected: false });
    }

    // Com o token validado/renovado, pegamos os dados do perfil
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenValido}` },
    });
    if (!userInfoRes.ok) return res.json({ connected: false });

    const userInfo = await userInfoRes.json();
    console.log('Dados do usuario->', userInfo)

    return res.json({
      connected: true,
      profile: {
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture,
        id: userInfo.id
      },
    });
  } catch (err) {
    logError("Erro em /auth/status", err);
    return res.json({ connected: false });
  }
});

app.get("/auth/google/callback", (req, res, next) => {
  passport.authenticate("google", { failureRedirect: "/" }, async (err, user) => {
    if (err) return next(err);
    // if (req.query.state !== req.session.oauthState) {
    //   return res.status(403).send("Invalid OAuth state");
    // }
    log("STATE RAW:", req.query.state);

    // 1. Decodifica o state para saber qual loja é
    const decodedState = Buffer
      .from(decodeURIComponent(req.query.state), "base64")
      .toString("utf-8");

    const state = JSON.parse(decodedState);
    log("STATE RAW AFETR:", state);

    const { lojaId, sigla, env, origin } = state;
    delete req.session.oauthState;
    try {
      // 2. Grava no banco PHP usando os dados do state
      await atualizarTokensNoBanco(
        lojaId,
        sigla,
        user.accessToken,
        user.refreshToken,
        env
      );

      // 3. Atualiza o cache em memória do Node imediatamente
      setCachedToken(lojaId, {
        accessToken: user.accessToken,
        expiresAt: Date.now() + 3600 * 1000
      }, sigla, env);

      // 4. Responde ao frontend
      res.send(`
        <script>
          window.opener.postMessage({ type: 'google-auth-success' }, "${origin}");
          window.close();
        </script>
      `);
    } catch (error) {
      logError("Erro ao processar callback", error);
      res.status(500).send("Erro ao salvar autenticação.");
    }
  })(req, res, next);
});


app.post("/auth/refresh-token", async (req, res) => {
  const { lojaId, sigla, env } = req.body;
  if (!lojaId) return res.status(400).json({ error: "lojaId é obrigatório" });

  log(`🔄 Refresh token solicitado para loja ${lojaId} (env: ${env})`);

  // 1. Verifica se já temos um token válido no cache
  const cached = getCachedToken(lojaId, sigla, env);
  if (cached) {
    return res.json({
      accessToken: cached.accessToken,
      expiresIn: cached.expiresIn,
      expiresAt: cached.expiresAt,
      fromCache: true
    });
  }
  // 2. Obtém lock para evitar refresh simultâneo
  const lock = getRefreshLock(lojaId, sigla, env);

  // Se já existe um refresh em andamento, aguarda e retorna o resultado
  if (!lock.isNew) {
    try {
      const result = await lock.promise;
      if (result?.error) {
        return res.status(result.status || 401).json(result);
      }
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: "Falha ao aguardar refresh", code: "LOCK_ERROR" });
    }
  }

  // 3. Este é o primeiro a solicitar - faz o refresh
  try {
    // Busca os tokens atuais da loja no backend PHP
    const loja = await buscarLojaNoBanco(lojaId, sigla, env);
    log("📦 Loja encontrada:", loja?.id_loja);
    const currentRefreshToken = loja?.refreshTokenGoogle_loja;

    if (!currentRefreshToken) {
      logWarn("⚠️ Nenhum refresh token encontrado para a loja");
      const errorResult = {
        error: "Nenhum token encontrado para esta loja.",
        code: "NO_REFRESH_TOKEN",
        status: 401
      };
      lock.release(errorResult);
      return res.status(401).json(errorResult);
    }

    const oauth2Client = new OAuth2Client(config.clientID, config.clientSecret);
    oauth2Client.setCredentials({ refresh_token: currentRefreshToken });

    // Pede renovação ao Google
    log("🔐 Solicitando novo token ao Google...");
    const { credentials } = await oauth2Client.refreshAccessToken();

    const newAccessToken = credentials.access_token;
    // Se o Google não mandar um novo refresh, mantemos o que já estava no banco
    const newRefreshToken = credentials.refresh_token || currentRefreshToken;
    // Google retorna expires_in em segundos (geralmente 3599 = ~1 hora)
    const expiresIn = credentials.expiry_date
      ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
      : 3600;
    const expiresAt = Date.now() + (expiresIn * 1000);

    log("🔑 Novos tokens obtidos. Expira em:", expiresIn, "segundos");

    // Atualiza os tokens no backend PHP
    await atualizarTokensNoBanco(lojaId, sigla, newAccessToken, newRefreshToken, env);

    const result = {
      accessToken: newAccessToken,
      expiresIn,
      expiresAt
    };

    // Salva no cache para evitar refresh desnecessário
    setCachedToken(lojaId, result, sigla, env);

    // Libera o lock com o resultado para outras requisições aguardando
    lock.release(result);

    return res.json(result);

  } catch (err) {
    // Tratamento específico para erros do Google OAuth
    const googleError = err?.response?.data?.error || err?.message;
    const googleErrorDesc = err?.response?.data?.error_description;

    logError("❌ Erro ao renovar token:", {
      message: err?.message,
      googleError,
      googleErrorDesc,
      code: err?.code
    });

    let errorResult;

    // Token revogado ou inválido - usuário precisa fazer login novamente
    if (googleError === "invalid_grant" || googleErrorDesc?.includes("revoked")) {
      // Limpa o cache se existir
      tokenCache.delete(String(lojaId));
      errorResult = {
        error: "Token revogado ou expirado. Necessário novo login.",
        code: "TOKEN_REVOKED",
        status: 401
      };
    } else if (googleError === "invalid_client") {
      errorResult = {
        error: "Erro de configuração OAuth.",
        code: "INVALID_CLIENT",
        status: 500
      };
    } else {
      errorResult = {
        error: "Falha na renovação",
        code: "REFRESH_FAILED",
        status: err?.code || err?.response?.status || 500
      };
    }

    // Libera o lock com erro
    lock.release(errorResult);

    return res.status(errorResult.status).json(errorResult);
  }
});

app.post("/auth/logout", async (req, res) => {
  const { lojaId, sigla, env } = req.body;

  tokenCache.delete(String(lojaId));
  await removerTokensNoBanco(lojaId, sigla, env);

  res.json({ ok: true });
});

app.listen(4000, () => log("✅ Google Auth Service rodando na porta 4000"));
