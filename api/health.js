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
      activeModel: "gemini-2.0-flash",
      fallbackModels: ["gemini-2.0-flash-lite", "gemini-1.5-flash", "gemini-1.5-pro"]
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
        error: "GEMINI_API_KEY is not configured in Vercel environment variables.",
        recommendation: "Please set GEMINI_API_KEY in your Vercel Project Settings > Environment Variables."
      };
      return sendSuccess(res, responseData);
    }
    const tStart = Date.now();
    const candidateModels = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];
    let lastAiError = null;
    let successfulModel = "";
    let replyText = "";
    const client = new GoogleGenAI({
      apiKey: sanitizedKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
          "x-goog-api-key": sanitizedKey
        }
      }
    });
    for (const testModel of candidateModels) {
      try {
        const testRes = await client.models.generateContent({
          model: testModel,
          contents: "Reply with the single word: READY"
        });
        replyText = testRes.text?.trim() || "READY";
        successfulModel = testModel;
        break;
      } catch (err) {
        console.warn(`[Health Test] Model ${testModel} error:`, err?.message || err);
        lastAiError = err;
      }
    }
    if (successfulModel) {
      responseData.geminiTest = {
        success: true,
        modelUsed: successfulModel,
        response: replyText,
        latencyMs: Date.now() - tStart
      };
      responseData.gemini.activeModel = successfulModel;
    } else {
      const errStr = lastAiError?.message || String(lastAiError || "");
      const is503 = errStr.includes("503") || errStr.toLowerCase().includes("high demand") || errStr.toLowerCase().includes("unavailable");
      const isAuth = errStr.includes("401") || errStr.includes("403") || errStr.toLowerCase().includes("api_key") || errStr.toLowerCase().includes("unauthenticated");
      responseData.geminiTest = {
        success: false,
        error: errStr,
        details: is503 ? "CAPACITY_HIGH_DEMAND" : isAuth ? "UNAUTHENTICATED" : "API_ERROR",
        recommendation: is503 ? "Google's Gemini 2.0 servers are temporarily experiencing high demand (503). This is a temporary Google infrastructure spike. The AI synthesizer will automatically attempt backup models (2.0 Flash Lite & 1.5 Flash)." : hasQuotes ? "Your GEMINI_API_KEY in Vercel has quotation marks around it. Remove quotes in Vercel Settings > Environment Variables." : "Please check your GEMINI_API_KEY at aistudio.google.com/apikey and update Vercel environment variables."
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
