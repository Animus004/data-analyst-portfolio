/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedProject } from "../types/index";

// Setup lazy loading for Gemini client to prevent crashes
let aiClient: any = null;

export function getAiClient(): any {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment secrets.");
  }
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
  return aiClient;
}

export interface RefinementInput {
  rawProject: ExtractedProject;
  unstructuredTexts: string[];
}

export interface RefinementOutput {
  project: Partial<ExtractedProject>;
  classifications: Record<string, string>;
  activityLog: string[];
  safetyScore: number;
}

/**
 * AI Refinement Engine - Strictly operates on normalized JSON payloads only.
 */
export async function refineProjectNarrative(input: RefinementInput): Promise<RefinementOutput> {
  const { rawProject, unstructuredTexts } = input;
  
  // Default fallback values if Gemini call fails
  const classifications: Record<string, string> = {
    title: "VERIFIED",
    summary: "VERIFIED",
    objective: "VERIFIED",
    methodology: "VERIFIED",
    businessProblem: "VERIFIED",
    findings: "VERIFIED",
    recommendations: "VERIFIED"
  };
  const activityLog = ["Compiled structured project artifacts via Specialized Parsers."];

  try {
    const ai = getAiClient();
    
    // Build a secure, structured refinement prompt mapping only JSON schema data
    const refinementPrompt = `
You are an elite evidence-driven copywriting refinement agent. Your only job is to polish, refine, and improve the narrative tone and formatting of the structured case study fields already extracted deterministically.

### Structured Project extracted by Parsers:
${JSON.stringify(rawProject, null, 2)}

### Unstructured Source Text:
${unstructuredTexts.join("\n\n")}

### Strict Guidelines:
1. **PRIMARY DIRECTIVE (NEVER HALLUCINATE)**: You are only performing language refinement. You are STRICTLY FORBIDDEN from inventing new KPIs, metrics, dataset names, company names, or dates.
2. **NUMERIC IMMUTABILITY**: Keep the value, label, and explanation for all metrics in the "metrics" array 100% unchanged.
3. **GROUNDED REFINEMENT**: You may refine fields like summary, objective, businessProblem, methodology, findings, recommendations, challengesText, and lessonsLearned. You can expand details ONLY if they are verifiably supported by the "Unstructured Source Text" or the "Structured Project".
4. **EVIDENCE-ONLY MODE IS ACTIVE**: If a field has "Not Found" or is missing and cannot be found in the provided sources, retain "Not Found" or "Requires Review". Do not interpolate.
5. **CLASSIFICATIONS**: For each field, classify as:
   - 'VERIFIED': The original extracted text was retained without changes.
   - 'IMPROVED': The text was polished for grammar, layout, or style.
   - 'GENERATED': The field was populated from unstructured source documents.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: refinementPrompt,
      config: {
        systemInstruction: "You are an elite, zero-hallucination language refinement assistant. You refine extracted text but never change numbers, metrics, dates, or invent any business facts.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            project: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                subtitle: { type: Type.STRING },
                summary: { type: Type.STRING },
                industry: { type: Type.STRING },
                role: { type: Type.STRING },
                duration: { type: Type.STRING },
                objective: { type: Type.STRING },
                datasetDesc: { type: Type.STRING },
                methodology: { type: Type.STRING },
                businessProblem: { type: Type.STRING },
                dataCleaning: { type: Type.STRING },
                findings: { type: Type.STRING },
                recommendations: { type: Type.STRING },
                challengesText: { type: Type.STRING },
                lessonsLearned: { type: Type.STRING }
              }
            },
            classifications: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                objective: { type: Type.STRING },
                methodology: { type: Type.STRING },
                businessProblem: { type: Type.STRING },
                findings: { type: Type.STRING },
                recommendations: { type: Type.STRING }
              }
            },
            activityLog: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            safetyScore: { type: Type.INTEGER }
          },
          required: ["project", "classifications", "activityLog", "safetyScore"]
        }
      }
    });

    const parsedJSON = JSON.parse(response.text.trim());
    return {
      project: parsedJSON.project,
      classifications: parsedJSON.classifications || classifications,
      activityLog: [...activityLog, ...(parsedJSON.activityLog || [])],
      safetyScore: parsedJSON.safetyScore !== undefined ? parsedJSON.safetyScore : 100
    };
  } catch (err: any) {
    console.error("AI narrative refinement failed, falling back to raw data:", err);
    activityLog.push(`AI refinement bypassed: ${err.message || err}`);
    return {
      project: {},
      classifications,
      activityLog,
      safetyScore: 100
    };
  }
}

/**
 * Plain Text/Chat un-structured prompt parsing directly to structured case study schema
 */
export async function parseUnstructuredNotes(text: string): Promise<any> {
  const ai = getAiClient();
  const prompt = `
You are a world-class Portfolio OS Data Analyst and Copywriter.
Your task is to take this unstructured input text—which could be raw notes, resume bullet points, markdown, a case study, or copy-pasted conversations with ChatGPT, Claude, or Gemini—and convert it into a highly professional, polished, and schema-compliant Portfolio OS Case Study.

### The Input Text to Parse:
"${text.replace(/"/g, '\\"')}"

### Instructions:
1. Extract or intelligently synthesize all standard case study fields.
2. If some fields are missing, intelligently construct them so that the resulting case study feels robust and cohesive. Keep it authentic but highly polished.
3. Formulate high-impact Metrics highlights. If the raw text mentions statistics or outcomes, map them to numeric metrics like "Sales Optimization", "Churn Reduction", with appropriate values (e.g., "+24.5%", "-15%"). Choose realistic icons like TrendingUp, TrendingDown, DollarSign, Percent, BarChart2, Database, Users, Activity, Clock.
4. Ensure 'status' is 'published' or 'draft'.
5. Ensure 'difficulty' is one of 'beginner', 'intermediate', 'advanced', 'expert'.
6. If the input mentions code, place it into the storyBlocks as a code_snippet with the correct language (python, sql, etc.). Or generate appropriate markdown and narrative content blocks.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      systemInstruction: "You are an elite parser and copywriter. Analyze user input and map it onto the structured Project schema. Output clean, schema-compliant JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          subtitle: { type: Type.STRING },
          summary: { type: Type.STRING },
          industry: { type: Type.STRING },
          role: { type: Type.STRING },
          duration: { type: Type.STRING },
          status: { type: Type.STRING },
          difficulty: { type: Type.STRING },
          objective: { type: Type.STRING },
          datasetDesc: { type: Type.STRING },
          methodology: { type: Type.STRING },
          businessProblem: { type: Type.STRING },
          dataCleaning: { type: Type.STRING },
          findings: { type: Type.STRING },
          recommendations: { type: Type.STRING },
          challengesText: { type: Type.STRING },
          lessonsLearned: { type: Type.STRING },
          tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          categories: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          metrics: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                value: { type: Type.STRING },
                description: { type: Type.STRING },
                iconName: { type: Type.STRING }
              },
              required: ["label", "value", "description"]
            }
          },
          storyBlocks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                type: { type: Type.STRING },
                bodyContent: { type: Type.STRING },
                language: { type: Type.STRING }
              },
              required: ["type", "bodyContent"]
            }
          },
          githubUrl: { type: Type.STRING },
          liveUrl: { type: Type.STRING },
          date: { type: Type.STRING },
          featured: { type: Type.BOOLEAN }
        },
        required: ["title", "summary", "objective", "methodology", "tags", "categories"]
      }
    }
  });

  return JSON.parse(response.text.trim());
}
