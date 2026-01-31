import { storeLastSeenTimestamp } from "../metrics.js";

export function storeLastSeenMiddleware(req, _res, next) {
  const lojaId = req.query?.lojaId;
  const sigla = req.query?.sigla;
  const env = req.query?.env;

  if (lojaId && sigla && env) {
    storeLastSeenTimestamp.set({ env, sigla, lojaId }, Math.floor(Date.now() / 1000));
  }

  next();
}

