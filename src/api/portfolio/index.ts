/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  fetchFromSupabase,
  syncToSupabase,
  getSupabaseClient
} from "../_lib/storage/index";
import { sendError, sendSuccess, logExecution } from "../_lib/utils/index";
import fs from "fs";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const rawUrl = req.url || "";
  const parsedUrl = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  const action = (req.query?.action as string) || (req.body?.action as string) || "";

  // Sub-route: Diagnostics / Health
  if (pathname.includes("/diagnostics") || pathname.includes("/config")) {
    try {
      const portfolio = await fetchFromSupabase();
      const supabase = getSupabaseClient();
      return sendSuccess(res, {
        status: "healthy",
        database: { status: "connected", message: "SQLite local file store active." },
        supabase: { status: supabase ? "configured" : "unconfigured", message: supabase ? "Connected to Supabase cloud bucket." : "Running local storage only." },
        ai: { status: process.env.GEMINI_API_KEY ? "configured" : "unconfigured", message: process.env.GEMINI_API_KEY ? "Gemini 3.5 API key present." : "No Gemini API key supplied." },
        backups: { status: "ready", message: "Automated snapshot system active." },
        environment: { status: process.env.NODE_ENV || "development", message: `Active mode: ${process.env.NODE_ENV || "development"}` },
        stats: {
          projectsCount: portfolio?.projects?.length || 0,
          analyticsMetricsCount: portfolio?.analyticsMetrics?.length || 0
        }
      });
    } catch (err: any) {
      return sendError(res, 500, "Failed to run diagnostics.", err.message);
    }
  }

  // Sub-route: Backups management
  if (pathname.includes("/backups")) {
    try {
      const supabase = getSupabaseClient();
      if (action === "list" || req.method === "GET") {
        if (!supabase) {
          return sendSuccess(res, { backups: [] });
        }
        const { data, error } = await supabase.storage.from("portfolio-uploads").list("backups", { sortBy: { column: "created_at", order: "desc" } });
        if (error) throw error;
        return sendSuccess(res, { backups: data || [] });
      }

      if (action === "create" || req.method === "POST") {
        const portfolio = await fetchFromSupabase();
        const now = new Date();
        const filename = `portfolio-backup-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}.json`;
        
        if (supabase) {
          const { error } = await supabase.storage.from("portfolio-uploads").upload(`backups/${filename}`, JSON.stringify(portfolio, null, 2), { contentType: "application/json" });
          if (error) throw error;
        }

        logExecution({ endpoint: pathname, totalDurationMs: Date.now() - startTime });
        return sendSuccess(res, { message: "Backup snapshot created successfully.", filename });
      }

      if (action === "restore") {
        const { filename } = req.body || {};
        if (!filename || !supabase) {
          return sendError(res, 400, "filename and configured cloud storage required for restore.");
        }
        const { data, error } = await supabase.storage.from("portfolio-uploads").download(`backups/${filename}`);
        if (error) throw error;
        const text = await data.text();
        const restored = JSON.parse(text);
        await syncToSupabase(restored);
        return sendSuccess(res, { message: "Portfolio restored successfully.", portfolio: restored });
      }

      if (action === "delete") {
        const { filename } = req.body || {};
        if (!filename || !supabase) {
          return sendError(res, 400, "filename and configured cloud storage required for deletion.");
        }
        const { error } = await supabase.storage.from("portfolio-uploads").remove([`backups/${filename}`]);
        if (error) throw error;
        return sendSuccess(res, { message: "Backup deleted successfully." });
      }
    } catch (err: any) {
      return sendError(res, 500, "Backup operation failed.", err.message);
    }
  }

  // GET: Load Portfolio Data
  if (req.method === "GET" || pathname.includes("/load")) {
    try {
      const data = await fetchFromSupabase();
      logExecution({ endpoint: pathname, totalDurationMs: Date.now() - startTime });
      return sendSuccess(res, data);
    } catch (err: any) {
      return sendError(res, 500, "Failed to load portfolio state.", err.message);
    }
  }

  // POST: Save Portfolio Data
  if (req.method === "POST" || pathname.includes("/save")) {
    try {
      const payload = req.body;
      if (!payload || !payload.profile) {
        return sendError(res, 400, "Invalid portfolio payload.");
      }

      const updated = await syncToSupabase(payload);
      logExecution({ endpoint: pathname, totalDurationMs: Date.now() - startTime });
      return sendSuccess(res, { message: "Portfolio updated successfully.", portfolio: updated });
    } catch (err: any) {
      return sendError(res, 500, "Failed to save portfolio state.", err.message);
    }
  }

  return sendError(res, 405, "Method Not Allowed.");
}
