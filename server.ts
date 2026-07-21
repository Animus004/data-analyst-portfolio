/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

// Import Vercel Serverless Function Handlers directly as Controllers
import portfolioCoreHandler from "./src/api/portfolio/index";
import portfolioAiHandler from "./src/api/portfolio/ai";
import importHandler from "./src/api/import";
import generateHandler from "./src/api/generate";
import healthHandler from "./src/api/health";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middlewares matching production limits
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Route Registrations delegating directly to Serverless Handlers
  app.all("/api/health", (req, res) => {
    return healthHandler(req as any, res as any);
  });

  app.all("/api/portfolio/ai-package-parse", (req, res) => {
    return portfolioAiHandler(req as any, res as any);
  });

  app.all("/api/portfolio/ai-parse", (req, res) => {
    return portfolioAiHandler(req as any, res as any);
  });

  app.all("/api/copilot/refine", (req, res) => {
    return portfolioAiHandler(req as any, res as any);
  });

  app.get("/api/portfolio", (req, res) => {
    return portfolioCoreHandler(req as any, res as any);
  });

  app.post("/api/portfolio", (req, res) => {
    return portfolioCoreHandler(req as any, res as any);
  });

  app.all("/api/portfolio/load", (req, res) => {
    return portfolioCoreHandler(req as any, res as any);
  });

  app.all("/api/portfolio/save", (req, res) => {
    return portfolioCoreHandler(req as any, res as any);
  });

  app.all("/api/portfolio/backups", (req, res) => {
    req.query = { ...req.query, action: "list" };
    return portfolioCoreHandler(req as any, res as any);
  });

  app.all("/api/portfolio/backups/create", (req, res) => {
    req.body = { ...req.body, action: "create" };
    return portfolioCoreHandler(req as any, res as any);
  });

  app.all("/api/portfolio/backups/restore", (req, res) => {
    req.body = { ...req.body, action: "restore" };
    return portfolioCoreHandler(req as any, res as any);
  });

  app.all("/api/portfolio/backups/delete", (req, res) => {
    req.body = { ...req.body, action: "delete" };
    return portfolioCoreHandler(req as any, res as any);
  });

  app.all("/api/portfolio/publish", (req, res) => {
    return portfolioCoreHandler(req as any, res as any);
  });

  app.all("/api/portfolio/diagnostics", (req, res) => {
    return portfolioCoreHandler(req as any, res as any);
  });

  app.all("/api/portfolio/config", (req, res) => {
    return portfolioCoreHandler(req as any, res as any);
  });

  // Importer dispatching
  app.all("/api/sql/import", (req, res) => {
    return importHandler(req as any, res as any);
  });

  app.all("/api/python/import", (req, res) => {
    return importHandler(req as any, res as any);
  });

  app.all("/api/powerbi/import", (req, res) => {
    return importHandler(req as any, res as any);
  });

  app.all("/api/github/import", (req, res) => {
    return importHandler(req as any, res as any);
  });

  // Generation dispatching
  app.all("/api/resume/generate", (req, res) => {
    return generateHandler(req as any, res as any);
  });

  app.all("/api/linkedin/generate", (req, res) => {
    return generateHandler(req as any, res as any);
  });

  app.all("/api/readme/generate", (req, res) => {
    return generateHandler(req as any, res as any);
  });

  // Vite development server / static assets configuration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[PORTFOLIO-OS] Development gateway active on http://localhost:${PORT}`);
  });
}

startServer();
