import express from "express";
import session from "express-session";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger.js";
import passport from "./auth.js";
import { config } from "./config.js";
import { logInfo } from "./utils/logger.js";
import { storeLastSeenMiddleware } from "./middleware/storeLastSeen.js";
import { metricsHttpMiddleware } from "./middleware/metricsHttp.js";
import { createMetricsRouter } from "./routes/metricsRoutes.js";
import { createAuthRouter } from "./routes/authRoutes.js";

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3001",
  process.env.FRONTEND_URL_HOM,
  process.env.FRONTEND_URL_PROD
].filter(Boolean).map(u => new URL(u).origin);

app.use(cors({ origin: allowedOrigins, credentials: true }));
logInfo("🌍 Allowed origins:", allowedOrigins);
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

app.use(storeLastSeenMiddleware);
app.use(metricsHttpMiddleware);

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
app.get("/docs.json", (req, res) => res.json(swaggerSpec));

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});

app.use(createMetricsRouter());
app.use(createAuthRouter());

app.listen(4000, () => logInfo("✅ Google Auth Service rodando na porta 4000"));
