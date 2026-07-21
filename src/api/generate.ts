/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAiClient } from "./_lib/ai/index";
import { fetchFromSupabase, ensureDataFile } from "./_lib/storage/index";
import { sendError, sendSuccess, logExecution } from "./_lib/utils/index";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const rawUrl = req.url || "";
  const parsedUrl = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  if (req.method !== "POST") {
    return sendError(res, 405, "Method Not Allowed. Only POST is supported.");
  }

  // Dispatcher: Resume generation
  if (pathname.includes("/resume")) {
    try {
      ensureDataFile();
      const portfolio = await fetchFromSupabase();
      if (!portfolio || !portfolio.profile) {
        return sendError(res, 404, "No active portfolio profile found to synthesize resume from.");
      }

      const ai = getAiClient();
      const prompt = `
You are a career development expert specializing in Data Analytics and Business Intelligence.
Based on the following Portfolio OS profile and projects data, generate a world-class, executive-ready professional resume in clean Markdown format.

### Creator Profile:
${JSON.stringify(portfolio.profile, null, 2)}

### Featured Projects:
${JSON.stringify((portfolio.projects || []).slice(0, 5), null, 2)}

### Formatting Guidelines:
- Do not make up any history, schools, or certifications. Ground everything in the provided profile.
- Structure sections clearly with headers: SUMMARY, PROFESSIONAL EXPERIENCE, PROJECTS, TECHNICAL SKILLS, and EDUCATION.
- Maximize action verbs and quantification for all bullet points.
`;

      const aiStartTime = Date.now();
      const result = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt
      });
      const aiDurationMs = Date.now() - aiStartTime;

      logExecution({
        endpoint: pathname,
        totalDurationMs: Date.now() - startTime,
        aiDurationMs
      });

      return sendSuccess(res, {
        resumeMarkdown: (result.text || "").trim()
      });
    } catch (err: any) {
      return sendError(res, 500, "Failed to generate professional resume.", err.message);
    }
  }

  // Dispatcher: LinkedIn generation
  if (pathname.includes("/linkedin")) {
    try {
      ensureDataFile();
      const portfolio = await fetchFromSupabase();
      if (!portfolio || !portfolio.profile) {
        return sendError(res, 404, "No active portfolio profile found to construct social profiles.");
      }

      const ai = getAiClient();
      const prompt = `
You are a social branding architect for tech professionals.
Using the following Portfolio OS analytics profile and case studies, generate:
1. Three variations of high-impact, professional LinkedIn Headlines.
2. A compelling, narrative-style "About/Summary" section written in first-person.
3. One sample LinkedIn Post promoting their top case study using analytical evidence.

### Profile Context:
${JSON.stringify(portfolio.profile, null, 2)}

### Top Case Study:
${JSON.stringify((portfolio.projects || []).find((p: any) => p.featured) || portfolio.projects?.[0], null, 2)}

Provide the response in structured JSON containing fields: "headlines", "aboutSection", "promotionalPost".
`;

      const aiStartTime = Date.now();
      const result = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      const aiDurationMs = Date.now() - aiStartTime;

      const parsedJSON = JSON.parse((result.text || "").trim());

      logExecution({
        endpoint: pathname,
        totalDurationMs: Date.now() - startTime,
        aiDurationMs
      });

      return sendSuccess(res, parsedJSON);
    } catch (err: any) {
      return sendError(res, 500, "Failed to generate LinkedIn artifacts.", err.message);
    }
  }

  // Dispatcher: Readme generation
  if (pathname.includes("/readme")) {
    try {
      const { project } = req.body || {};
      if (!project) {
        return sendError(res, 400, "Project metadata payload is required.");
      }

      const ai = getAiClient();
      const prompt = `
You are a lead database and tech-writer.
Generate a professional, detailed GitHub README.md for this analytics project:

### Project Details:
${JSON.stringify(project, null, 2)}

Include sections:
- Executive Summary
- Business Objectives
- Key Analytical Metrics & Achievements
- Methodology & Tech Stack
- Actionable Strategic Insights & Business Recommendations
- Instructions to Run / Code Outline
`;

      const aiStartTime = Date.now();
      const result = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt
      });
      const aiDurationMs = Date.now() - aiStartTime;

      logExecution({
        endpoint: pathname,
        totalDurationMs: Date.now() - startTime,
        aiDurationMs
      });

      return sendSuccess(res, {
        readmeMarkdown: (result.text || "").trim()
      });
    } catch (err: any) {
      return sendError(res, 500, "Failed to compile project README.", err.message);
    }
  }

  return sendError(res, 404, "Generation sub-route not found.");
}
