import { httpRequestDuration, httpRequestErrors, httpRequestTotal } from "../metrics.js";

export function metricsHttpMiddleware(req, res, next) {
  const start = Date.now();
  const route = req.route?.path || req.path || "unknown";

  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;
    const statusCode = res.statusCode;
    const method = req.method;

    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    httpRequestTotal.inc({ method, route, status_code: statusCode });

    if (statusCode >= 400) {
      httpRequestErrors.inc({ method, route, status_code: statusCode });
    }
  });

  next();
}

