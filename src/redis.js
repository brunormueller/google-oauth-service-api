import Redis from "ioredis";

// Configuração do Redis com valores padrão para Docker
const redisConfig = {
    host: process.env.REDIS_HOST || "redis",
    port: Number(process.env.REDIS_PORT) || 6379,
    keyPrefix: "google-auth:",
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false
};

// Adiciona senha apenas se estiver configurada
if (process.env.REDIS_PASSWORD) {
    redisConfig.password = process.env.REDIS_PASSWORD;
}

export const redis = new Redis(redisConfig);

redis.on("connect", () => {
    console.log("🧠 Redis conectado:", {
        host: redisConfig.host,
        port: redisConfig.port
    });
});

redis.on("ready", () => {
    console.log("✅ Redis pronto para uso");
});

redis.on("error", (err) => {
    console.error("❌ Redis erro:", err.message);
});

redis.on("close", () => {
    console.warn("⚠️ Conexão Redis fechada");
});

redis.on("reconnecting", (delay) => {
    console.log(`🔄 Reconectando ao Redis em ${delay}ms...`);
});

redis.on("end", () => {
    console.warn("⚠️ Conexão Redis encerrada");
});
