import express from "express";
import client from "prom-client";

export function createMetricsRouter() {
  const router = express.Router();

  router.get("/metrics", async (_req, res) => {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
  });

  return router;
}

