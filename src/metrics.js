import client from "prom-client";

client.collectDefaultMetrics();

export const tokenRefreshCounter = new client.Counter({
    name: "google_token_refresh_total",
    help: "Total de refresh de tokens Google",
    labelNames: ["env", "sigla", "lojaId"]
});

export const tokenRefreshErrorCounter = new client.Counter({
    name: "google_token_refresh_error_total",
    help: "Erros ao renovar token Google",
    labelNames: ["env", "sigla", "lojaId", "reason"]
});

export const tokenCacheHitCounter = new client.Counter({
    name: "google_token_cache_hit_total",
    help: "Cache hit de token",
    labelNames: ["env", "sigla", "lojaId"]
});

export const tokenCacheMissCounter = new client.Counter({
    name: "google_token_cache_miss_total",
    help: "Cache miss de token",
    labelNames: ["env", "sigla", "lojaId"]
});

// "Conectada agora" = last_seen nos últimos X segundos (query no Prometheus)
export const storeLastSeenTimestamp = new client.Gauge({
    name: "google_store_last_seen_timestamp_seconds",
    help: "Timestamp (epoch seconds) do último request visto para uma loja",
    labelNames: ["env", "sigla", "lojaId"]
});

// "Token válido em cache agora" = expires_at > time()
export const tokenExpiresAtTimestamp = new client.Gauge({
    name: "google_token_expires_at_timestamp_seconds",
    help: "Timestamp (epoch seconds) de expiração do access token (quando presente)",
    labelNames: ["env", "sigla", "lojaId"]
});

export const googleRequestDuration = new client.Histogram({
    name: "google_request_duration_seconds",
    help: "Tempo de resposta do Google APIs",
    labelNames: ["endpoint"],
    buckets: [0.1, 0.3, 0.5, 1, 2, 5]
});

// Métricas HTTP adicionais
export const httpRequestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "Duração das requisições HTTP em segundos",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.1, 0.3, 0.5, 1, 2, 5, 10]
});

export const httpRequestTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total de requisições HTTP",
    labelNames: ["method", "route", "status_code"]
});

export const httpRequestErrors = new client.Counter({
    name: "http_request_errors_total",
    help: "Total de erros HTTP (status >= 400)",
    labelNames: ["method", "route", "status_code"]
});
