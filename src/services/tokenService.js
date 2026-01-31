import { OAuth2Client } from "google-auth-library";
import { config } from "../config.js";
import { getCachedToken, setCachedToken } from "../helpers/cache.js";
import { acquireLock, releaseLock } from "../helpers/lock.js";
import {
  tokenRefreshCounter,
  tokenRefreshErrorCounter,
  tokenCacheHitCounter,
  tokenCacheMissCounter,
  googleRequestDuration,
  tokenExpiresAtTimestamp,
} from "../metrics.js";
import { buscarLojaNoBanco, atualizarTokensNoBanco } from "./linksunBackend.js";

export async function obterAccessTokenValido({ lojaId, sigla, env }) {
  // 1) Cache Redis
  const cached = await getCachedToken(env, sigla, lojaId);
  if (cached) {
    tokenCacheHitCounter.inc({ env, sigla, lojaId });
    if (cached.expiresAt) {
      tokenExpiresAtTimestamp.set(
        { env, sigla, lojaId },
        Math.floor(cached.expiresAt / 1000)
      );
    }
    return cached.accessToken;
  }
  tokenCacheMissCounter.inc({ env, sigla, lojaId });

  // 2) Lock distribuído para evitar refresh concorrente
  const locked = await acquireLock(env, sigla, lojaId);
  if (!locked) {
    await new Promise((r) => setTimeout(r, 500));
    const retry = await getCachedToken(env, sigla, lojaId);
    if (retry) return retry.accessToken;
    throw new Error("LOCK_TIMEOUT");
  }

  try {
    tokenRefreshCounter.inc({ env, sigla, lojaId });

    // 3) Busca refresh token no backend Linksun
    const loja = await buscarLojaNoBanco({ lojaId, sigla, env });
    if (!loja?.refreshTokenGoogle_loja) {
      tokenRefreshErrorCounter.inc({
        env,
        sigla,
        lojaId,
        reason: "no_refresh_token",
      });
      return null;
    }

    // 4) Refresh no Google
    const oauth2Client = new OAuth2Client(config.clientID, config.clientSecret);
    oauth2Client.setCredentials({ refresh_token: loja.refreshTokenGoogle_loja });

    const start = Date.now();
    const { credentials } = await oauth2Client.refreshAccessToken();
    googleRequestDuration.observe(
      { endpoint: "oauth_refresh" },
      (Date.now() - start) / 1000
    );

    const expiresIn = Math.floor((credentials.expiry_date - Date.now()) / 1000);

    // 5) Salva no Redis (com margem)
    await setCachedToken(
      env,
      sigla,
      lojaId,
      {
        accessToken: credentials.access_token,
        expiresAt: credentials.expiry_date,
      },
      expiresIn - 120
    );

    if (credentials.expiry_date) {
      tokenExpiresAtTimestamp.set(
        { env, sigla, lojaId },
        Math.floor(credentials.expiry_date / 1000)
      );
    }

    // 6) Atualiza banco (refresh token pode vir nulo)
    await atualizarTokensNoBanco({
      lojaId,
      sigla,
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token || loja.refreshTokenGoogle_loja,
      env,
    });

    return credentials.access_token;
  } catch (err) {
    tokenRefreshErrorCounter.inc({
      env,
      sigla,
      lojaId,
      reason: err.message,
    });
    throw err;
  } finally {
    await releaseLock(env, sigla, lojaId);
  }
}

