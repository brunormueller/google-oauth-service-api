import { redis } from "../redis.js";

export function refreshLockKey(env, sigla, lojaId) {
    return `lock:refresh:${env}:${sigla}:${lojaId}`;
}

export async function acquireLock(env, sigla, lojaId, ttl = 30) {
    const result = await redis.set(
        refreshLockKey(env, sigla, lojaId),
        "1",
        "NX",
        "EX",
        ttl
    );

    return result === "OK";
}

export async function releaseLock(env, sigla, lojaId) {
    await redis.del(refreshLockKey(env, sigla, lojaId));
}
