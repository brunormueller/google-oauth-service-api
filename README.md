# Google Auth Service

Serviço Node.js (Express) para gerenciar autenticação/renovação de tokens do Google por **loja** (`lojaId`) e expor **métricas Prometheus** para observabilidade (Prometheus + Grafana).

## Requisitos

- Node.js 18+ (recomendado 20+)
- Docker + Docker Compose (opcional, recomendado para stack com Redis/Prometheus/Grafana)

## Subindo com Docker (recomendado)

No diretório `google-auth-service/`:

```bash
docker-compose up -d --build
```

Serviços:

- **API**: `http://localhost:4000`
- **Prometheus**: `http://localhost:9090`
- **Grafana**: `http://localhost:3000` (admin/admin)

## Rodando local (Node)

```bash
npm install
npm run dev
```

## Variáveis de ambiente

O serviço lê `.env` (via `dotenv`). Principais variáveis:

- **Google OAuth**
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_CALLBACK_URL` (ex.: `https://seu-dominio.com/auth/google/callback` ou `http://localhost:4000/auth/google/callback`)

- **Sessão**
  - `SESSION_SECRET`
  - `FRONTEND_URL` (usado para CORS/origin permitido)
  - `FRONTEND_URL_HOM` (opcional)
  - `FRONTEND_URL_PROD` (opcional)

- **Backend Linksun (PHP)**
  - `LINKSUN_BACKEND_URL` (prod)
  - `LINKSUN_BACKEND_URL_HOM` (hom)
  - `LINKSUN_BACKEND_URL_DEV` (dev)

- **Redis**
  - `REDIS_HOST` (default: `redis` no docker-compose)
  - `REDIS_PORT` (default: `6379`)
  - `REDIS_PASSWORD` (opcional)

## Endpoints principais

- **GET `/metrics`**
  - Exposição Prometheus.

- **GET `/docs`**
  - Swagger UI.

- **GET `/internal/google/token?lojaId=...&sigla=...&env=...`**
  - Retorna `{ accessToken }` garantindo token válido via cache/refresh.
  - `env`: `prod` | `hom` | `dev`

- **GET `/auth/status?lojaId=...&sigla=...&env=...`**
  - Valida/renova token e tenta buscar perfil no Google.
  - Retorna `{ connected: boolean, profile?: {...} }`

- **GET `/auth/drive/list?folderId=...&lojaId=...&sigla=...&env=...`**
  - Lista pastas/docs do Google Drive para a loja.
  - `folderId` padrão: `root`
  - `folderId=sharedWithMe` lista itens “Compartilhados comigo”.

- **GET `/auth/google?state=...`**
  - Inicia fluxo OAuth.
  - `state` deve ser base64 de um JSON (ex.: `{ lojaId, sigla, env, origin }`).

- **GET `/auth/google/callback`**
  - Callback OAuth.
  - Atualiza tokens no backend Linksun e popula cache Redis.

## Observabilidade (Prometheus)

### Métricas por loja

- `google_token_refresh_total{env,sigla,lojaId}`
- `google_token_refresh_error_total{env,sigla,lojaId,reason}`
- `google_token_cache_hit_total{env,sigla,lojaId}`
- `google_token_cache_miss_total{env,sigla,lojaId}`

### “Conectadas agora” (últimos 30s)

O serviço publica o último request visto por loja:

- `google_store_last_seen_timestamp_seconds{env,sigla,lojaId}`

Exemplos:

```promql
count(time() - google_store_last_seen_timestamp_seconds < 30)
```

```promql
(time() - google_store_last_seen_timestamp_seconds) < 30
```

### “Token válido em cache agora”

O serviço expõe a expiração do token cacheado:

- `google_token_expires_at_timestamp_seconds{env,sigla,lojaId}`

Exemplos:

```promql
count(google_token_expires_at_timestamp_seconds > time())
```

```promql
google_token_expires_at_timestamp_seconds > time()
```

### Métricas HTTP

- `http_requests_total{method,route,status_code}`
- `http_request_duration_seconds_bucket{method,route,status_code,...}`
- `http_request_errors_total{method,route,status_code}`

### Métricas Google APIs

- `google_request_duration_seconds_bucket{endpoint,...}` (ex.: `endpoint="oauth_refresh"`)

## Grafana

Dashboard pronto para import:

- `grafana-dashboard-google-auth-service.json`

Importe em: **Dashboards → New → Import**.

## Estrutura do projeto (atual)

- `src/server.js`: API + integrações (Express, OAuth, Linksun, Redis, métricas)
- `src/helpers/cache.js`: cache Redis por loja
- `src/helpers/lock.js`: lock distribuído por loja
- `src/metrics.js`: métricas Prometheus

## Troubleshooting rápido

- **Prometheus não coleta**: verifique `http://localhost:9090/targets` (target deve estar `UP`)
- **Sem métricas**: acesse `http://localhost:4000/metrics` e faça algumas chamadas nos endpoints
- **Erro de conexão Linksun**: ajuste `LINKSUN_BACKEND_URL_*` (prod/hom/dev)

