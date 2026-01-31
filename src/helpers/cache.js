import { redis } from "../redis.js";


export function tokenKey(env, sigla, lojaId) {
    return `token:${env}:${sigla}:${lojaId}`;
}

export async function getCachedToken(env, sigla, lojaId) {
    const raw = await redis.get(tokenKey(env, sigla, lojaId));
    if (!raw) return null;
    return JSON.parse(raw);
}

export async function setCachedToken(env, sigla, lojaId, data, ttlSeconds) {
    await redis.set(
        tokenKey(env, sigla, lojaId),
        JSON.stringify(data),
        "EX",
        ttlSeconds
    );
}

export async function clearCachedToken(env, sigla, lojaId) {
    await redis.del(tokenKey(env, sigla, lojaId));
}
