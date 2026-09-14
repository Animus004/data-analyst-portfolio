// @ts-nocheck
// src/api/health.ts
import { GoogleGenAI } from "@google/genai";

// src/api/_lib/utils/index.ts
function sendSuccess(res, data) {
  return res.status(200).json({
    success: true,
    ...data
  });
}

// src/api/health.ts
function sanitizeApiKey(raw) {
  if (!raw) return "";
  return raw.trim().replace(/^["']|["']$/g, "").replace(/^Bearer\s+/i, "").trim();
}
async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  const rawGeminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  const sanitizedKey = sanitizeApiKey(rawGeminiKey);
  const hasQuotes = rawGeminiKey.startsWith('"') || rawGeminiKey.startsWith("'") || rawGeminiKey.endsWith('"') || rawGeminiKey.endsWith("'");
  const hasBearer = /^Bearer\s+/i.test(rawGeminiKey);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "";
  const responseData = {
    status: "healthy",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    gemini: {
      configured: Boolean(sanitizedKey),
      keyPrefix: sanitizedKey ? `${sanitizedKey.slice(0, 6)}...` : null,
      hasQuotesWarning: hasQuotes,
      hasBearerWarning: hasBearer,
      activeModel: "gemini-3.6-flash",
      fallbackModels: ["gemini-2.5-flash", "gemini-2.0-flash"]
    },
    supabase: {
      configured: Boolean(supabaseUrl && supabaseKey),
      bucket: process.env.SUPABASE_STORAGE_BUCKET || "portfolio-uploads"
    },
    features: {
      evidenceGraphCaching: "active",
      payloadDietBase64Stripping: "active",
      vercelMaxDuration: "60s",
      compilerVersion: "v4.2 (PUE-Cached + Fast-Path Evidence Cache + Recruiter Audit)"
    }
  };
  if (req.query?.testAi === "true") {
    if (!sanitizedKey) {
      responseData.geminiTest = {
        success: false,
        error: "GEMINI_API_KEY is not configured in Vercel environment variables."
      };
      return sendSuccess(res, responseData);
    }
    const tStart = Date.now();
    try {
      const client = new GoogleGenAI({
        apiKey: sanitizedKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
            "x-goog-api-key": sanitizedKey
          }
        }
      });
      const testRes = await client.models.generateContent({
        model: "gemini-3.6-flash",
        contents: "Reply with the single word: READY"
      });
      responseData.geminiTest = {
        success: true,
        response: testRes.text?.trim() || "READY",
        latencyMs: Date.now() - tStart
      };
    } catch (aiErr) {
      responseData.geminiTest = {
        success: false,
        error: aiErr.message || String(aiErr),
        details: aiErr.status || "UNAUTHENTICATED",
        recommendation: hasQuotes ? "Your GEMINI_API_KEY in Vercel has quotation marks around it. Remove quotes in Vercel Settings > Environment Variables." : "Please check your GEMINI_API_KEY at aistudio.google.com/apikey and update Vercel environment variables."
      };
    }
  }
  return sendSuccess(res, responseData);
}
export {
  handler as default
};
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
