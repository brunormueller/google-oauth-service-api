# Guia de Configuração do Grafana e Monitoramento

## 📊 Como Acessar o Grafana

1. **Inicie os serviços:**
   ```bash
   docker-compose up -d
   ```

2. **Acesse o Grafana:**
   - URL: http://localhost:3000
   - Usuário: `admin`
   - Senha: `admin` (será solicitado alteração no primeiro login)

3. **Verifique o Prometheus:**
   - URL: http://localhost:9090
   - Verifique se está coletando métricas em: http://localhost:9090/targets

## 🔧 Configuração Automática

O datasource do Prometheus já está configurado automaticamente através do arquivo:
- `grafana/provisioning/datasources/prometheus.yml`

## 📈 Métricas Disponíveis

### Métricas de Token Google
- `google_token_refresh_total` - Total de refresh de tokens
- `google_token_refresh_error_total` - Erros ao renovar tokens
- `google_token_cache_hit_total` - Cache hits
- `google_token_cache_miss_total` - Cache misses

### Métricas HTTP
- `http_request_duration_seconds` - Duração das requisições HTTP
- `http_requests_total` - Total de requisições HTTP
- `http_request_errors_total` - Total de erros HTTP (status >= 400)

### Métricas do Google APIs
- `google_request_duration_seconds` - Tempo de resposta das APIs do Google

### Métricas Padrão do Node.js
- `process_cpu_user_seconds_total`
- `process_cpu_system_seconds_total`
- `process_resident_memory_bytes`
- `nodejs_heap_size_total_bytes`
- `nodejs_heap_size_used_bytes`
- E outras métricas padrão do prom-client

## 🎨 Criando Dashboards no Grafana

1. Acesse o Grafana (http://localhost:3000)
2. Clique em **"+"** → **"Create"** → **"Dashboard"**
3. Adicione um painel e use queries PromQL como:

### Exemplo de Queries Úteis

**Taxa de requisições por segundo:**
```promql
rate(http_requests_total[5m])
```

**Percentil 95 de duração de requisições:**
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Taxa de erros HTTP:**
```promql
rate(http_request_errors_total[5m])
```

**Taxa de refresh de tokens:**
```promql
rate(google_token_refresh_total[5m])
```

**Taxa de cache hit:**
```promql
rate(google_token_cache_hit_total[5m]) / (rate(google_token_cache_hit_total[5m]) + rate(google_token_cache_miss_total[5m]))
```

**Uso de memória:**
```promql
process_resident_memory_bytes
```

## 🔍 Verificando se Está Funcionando

1. **Verifique se o Prometheus está coletando métricas:**
   - Acesse: http://localhost:9090/targets
   - O target `google-auth-service` deve estar com status "UP"

2. **Verifique as métricas diretamente:**
   - Acesse: http://localhost:4000/metrics
   - Você deve ver todas as métricas em formato Prometheus

3. **No Grafana, teste uma query:**
   - Vá em **Explore** (ícone de bússola)
   - Selecione o datasource "Prometheus"
   - Digite: `up` e execute
   - Deve retornar `1` se tudo estiver funcionando

## 🐛 Troubleshooting

### Problema: Prometheus não consegue coletar métricas

**Solução:**
- Verifique se todos os containers estão na mesma rede: `docker network ls`
- Verifique os logs: `docker logs prometheus`
- Certifique-se de que o serviço está rodando: `docker ps`

### Problema: Grafana não mostra o datasource

**Solução:**
- Verifique os logs: `docker logs grafana`
- Certifique-se de que o arquivo `grafana/provisioning/datasources/prometheus.yml` existe
- Reinicie o Grafana: `docker restart grafana`

### Problema: Métricas não aparecem

**Solução:**
- Verifique se o endpoint `/metrics` está acessível: `curl http://localhost:4000/metrics`
- Verifique se há requisições sendo feitas ao serviço
- Aguarde alguns minutos para o Prometheus coletar dados suficientes

## 📝 Próximos Passos

1. Crie dashboards personalizados para suas necessidades
2. Configure alertas no Grafana para monitorar erros e performance
3. Considere adicionar mais métricas específicas do seu negócio
4. Configure retenção de dados no Prometheus se necessário
