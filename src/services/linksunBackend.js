import { config } from "../config.js";
import { logError, logInfo } from "../utils/logger.js";

function getBackendUrl(env) {
  if (env === "prod") return config.linksunBackendUrl;
  if (env === "hom") return config.linksunBackendUrlHom;
  return config.linksunBackendUrlDev;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function isConnRefused(err) {
  return err?.code === "ECONNREFUSED" || err?.cause?.code === "ECONNREFUSED";
}

export async function buscarLojaNoBanco({ lojaId, sigla, env }) {
  const backendUrl = getBackendUrl(env);
  const url = `${backendUrl}?action=obterLoja&class=Lojas&id_loja=${lojaId}&sigla=${sigla}`;

  try {
    const data = await fetchJson(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    return data.body;
  } catch (err) {
    if (isConnRefused(err)) {
      logError(`❌ Erro de conexão ao backend PHP (${backendUrl}).`);
      throw new Error(
        `Não foi possível conectar ao backend PHP em ${backendUrl}. Verifique se o serviço está rodando.`
      );
    }
    throw err;
  }
}

export async function atualizarTokensNoBanco({
  lojaId,
  sigla,
  accessToken,
  refreshToken,
  env,
}) {
  const backendUrl = getBackendUrl(env);
  const url = `${backendUrl}?action=gravarTokenGoogleAuth&class=Lojas&sigla=${sigla}`;

  logInfo("💾 Atualizando tokens no banco", { lojaId, sigla, env });

  try {
    return await fetchJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lojaId,
        accessTokenGoogle_loja: accessToken,
        refreshTokenGoogle_loja: refreshToken,
      }),
    });
  } catch (err) {
    if (isConnRefused(err)) {
      logError(`❌ Erro de conexão ao backend PHP (${backendUrl}).`);
      throw new Error(
        `Não foi possível conectar ao backend PHP em ${backendUrl}. Verifique se o serviço está rodando.`
      );
    }
    throw err;
  }
}

export async function removerTokensNoBanco({ lojaId, sigla, env }) {
  const backendUrl = getBackendUrl(env);
  const url = `${backendUrl}?action=deletarTokenGoogleAuth&class=Lojas&sigla=${sigla}`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lojaId }),
    });
    logInfo("🗑️ Tokens removidos do banco", { lojaId, sigla, env });
  } catch (err) {
    if (isConnRefused(err)) {
      logError(`❌ Erro de conexão ao backend PHP (${backendUrl}).`);
      throw new Error(
        `Não foi possível conectar ao backend PHP em ${backendUrl}. Verifique se o serviço está rodando.`
      );
    }
    throw err;
  }
}

