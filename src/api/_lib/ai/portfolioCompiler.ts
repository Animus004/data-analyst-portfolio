/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import {
  EvidenceGraph,
  StructuredPortfolioProject,
  ConflictRecord,
  ExtractedProject
} from "../types/index";

let aiClient: any = null;

function getAiClient(): any {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
  return aiClient;
}

/**
 * Builds a fallback StructuredPortfolioProject deterministically from the EvidenceGraph
 * if Gemini API is unconfigured or synthesis is unavailable.
 */
export function buildFallbackStructuredProject(
  graph: EvidenceGraph,
  rawBaseProject: ExtractedProject
): { structured: StructuredPortfolioProject; raw: ExtractedProject } {
  const primarySource = graph.evidenceSources[0]?.fileName || rawBaseProject.sourceFiles[0] || "Data Package";
  const defaultEvidence = [{ sourceFile: primarySource, parser: "DeterministicFallback" }];

  const structured: StructuredPortfolioProject = {
    title: {
      value: rawBaseProject.title || "Data Analytics Case Study",
      confidence: 85,
      evidence: defaultEvidence
    },
    subtitle: {
      value: rawBaseProject.subtitle || "Evidence-driven analytics and insights report",
      confidence: 80,
      evidence: defaultEvidence
    },
    executiveSummary: {
      value: rawBaseProject.summary || "Synthesized analysis derived from parsed source data and analytics artifacts.",
      confidence: 85,
      evidence: defaultEvidence
    },
    businessProblem: {
      value: rawBaseProject.businessProblem || "Analyze dataset metrics to optimize operational performance and isolate growth levers.",
      confidence: 80,
      evidence: defaultEvidence
    },
    stakeholders: {
      value: ["Executive Leadership", "Analytics Leads", "Operations Teams"],
      confidence: 85,
      evidence: defaultEvidence
    },
    methodology: {
      value: rawBaseProject.methodology || "Data ingested, cleaned, and structured via specialized parser pipeline.",
      confidence: 90,
      evidence: defaultEvidence
    },
    industry: {
      value: rawBaseProject.industry || "Analytics & Business Intelligence",
      confidence: 85,
      evidence: defaultEvidence
    },
    role: {
      value: rawBaseProject.role || "Data Analyst",
      confidence: 85,
      evidence: defaultEvidence
    },
    duration: {
      value: rawBaseProject.duration || "Ongoing",
      confidence: 80,
      evidence: defaultEvidence
    },
    findings: {
      value: rawBaseProject.findings || "Analyzed metrics across all provided data sources.",
      confidence: 85,
      evidence: defaultEvidence
    },
    recommendations: {
      value: rawBaseProject.recommendations || "Integrate analytical KPIs into centralized decision dashboards.",
      confidence: 85,
      evidence: defaultEvidence
    },
    resumeBullets: {
      value: [
        `Engineered analytical data pipelines for ${primarySource}, improving data accessibility and KPI visibility.`,
        "Analyzed key business metrics and SQL query logic to drive evidence-backed decision making.",
        "Built interactive reporting artifacts and structured performance models."
      ],
      confidence: 85,
      evidence: defaultEvidence
    },
    linkedInSummary: {
      value: `📊 New Data Case Study: ${rawBaseProject.title || "Analytical Insights Project"}\n\nProcessed dataset insights across ${graph.evidenceSources.length} source files to build a structured analytics portfolio case study. Check out the metrics and methodology!`,
      confidence: 85,
      evidence: defaultEvidence
    },
    starStory: {
      value: {
        situation: `Addressed business intelligence requirements across source assets (${primarySource}).`,
        task: "Synthesize disparate raw data files into clear actionable business metrics.",
        action: "Extracted metrics, SQL queries, and spreadsheet data using automated parser routines.",
        result: "Delivered a structured analytics case study with full metric evidence lineage."
      },
      confidence: 85,
      evidence: defaultEvidence
    },
    metrics: rawBaseProject.metrics.map((m, idx) => ({
      id: m.id || `fallback-m-${idx}`,
      label: m.label,
      value: m.value,
      description: m.description,
      iconName: m.iconName || "Activity",
      confidence: 90,
      sourceFile: m.sourceFile || primarySource,
      sourceLocation: m.sourceLocation
    })),
    tags: rawBaseProject.tags || ["Analytics"],
    categories: rawBaseProject.categories || ["Data Analysis"]
  };

  return { structured, raw: rawBaseProject };
}

/**
 * Dedicated Gemini Compiler Service
 * Synthesizes the EvidenceGraph into a strongly typed StructuredPortfolioProject.
 * NEVER receives raw uploaded files — only receives normalized EvidenceGraph nodes.
 */
export async function compilePortfolioWithGemini(
  graph: EvidenceGraph,
  conflicts: ConflictRecord[],
  rawBaseProject: ExtractedProject
): Promise<{ structured: StructuredPortfolioProject; raw: ExtractedProject }> {
  const ai = getAiClient();
  if (!ai) {
    console.warn("[portfolioCompiler] Gemini client unconfigured. Returning evidence-graph fallback.");
    return buildFallbackStructuredProject(graph, rawBaseProject);
  }

  const prompt = `
You are the world's leading AI Portfolio Compiler for Data Analysts and Analytics Engineers.
Your job is to act as an evidence-driven reasoning engine that synthesizes a normalized Evidence Graph into a world-class, structured portfolio project.

### CRITICAL RULES:
1. **NEVER USE FILENAMES AS PROJECT TITLES**: Never title a project "script.py", "data.xlsx", or "query.sql". Create a professional, domain-focused project title (e.g., "E-Commerce Revenue & Customer Churn Analytics").
2. **EVIDENCE GROUNDING ONLY**: Use ONLY facts, metrics, schema names, formulas, and documentation present in the Evidence Graph. Do not fabricate unverified numbers.
3. **CONFIDENCE SCORING**: Assign realistic confidence scores (0-100) based on source strength and evidence agreement.
4. **CONFLICT AWARENESS**: If unresolved conflicts are listed, reflect reviewing review markers in the text.

### NORMALIZED EVIDENCE GRAPH:
${JSON.stringify(graph, null, 2)}

### IDENTIFIED EVIDENCE CONFLICTS:
${JSON.stringify(conflicts, null, 2)}

Synthesize this Evidence Graph into schema-compliant JSON matching the specified response format.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction:
          "You are an AI Portfolio Compiler reasoning engine. Transform input Evidence Graphs into structured JSON portfolio case studies with confidence scores and evidence attributions. Never output markdown filler.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            subtitle: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            executiveSummary: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            businessProblem: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            stakeholders: {
              type: Type.OBJECT,
              properties: {
                value: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            methodology: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            industry: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            role: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            duration: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            findings: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            recommendations: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            resumeBullets: {
              type: Type.OBJECT,
              properties: {
                value: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            linkedInSummary: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            starStory: {
              type: Type.OBJECT,
              properties: {
                value: {
                  type: Type.OBJECT,
                  properties: {
                    situation: { type: Type.STRING },
                    task: { type: Type.STRING },
                    action: { type: Type.STRING },
                    result: { type: Type.STRING }
                  },
                  required: ["situation", "task", "action", "result"]
                },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            metrics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  value: { type: Type.STRING },
                  description: { type: Type.STRING },
                  iconName: { type: Type.STRING },
                  confidence: { type: Type.INTEGER },
                  sourceFile: { type: Type.STRING }
                },
                required: ["label", "value", "description", "confidence"]
              }
            },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            categories: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: [
            "title",
            "executiveSummary",
            "businessProblem",
            "methodology",
            "findings",
            "recommendations",
            "resumeBullets",
            "linkedInSummary",
            "starStory"
          ]
        }
      }
    });

    const parsed = JSON.parse(response.text.trim());
    const primarySource = graph.evidenceSources[0]?.fileName || "Source Asset";
    const defaultEvidence = [{ sourceFile: primarySource }];

    const structured: StructuredPortfolioProject = {
      title: { value: parsed.title?.value || rawBaseProject.title, confidence: parsed.title?.confidence || 90, evidence: defaultEvidence },
      subtitle: { value: parsed.subtitle?.value || rawBaseProject.subtitle, confidence: parsed.subtitle?.confidence || 85, evidence: defaultEvidence },
      executiveSummary: { value: parsed.executiveSummary?.value || rawBaseProject.summary, confidence: parsed.executiveSummary?.confidence || 90, evidence: defaultEvidence },
      businessProblem: { value: parsed.businessProblem?.value || rawBaseProject.businessProblem, confidence: parsed.businessProblem?.confidence || 90, evidence: defaultEvidence },
      stakeholders: { value: parsed.stakeholders?.value || ["Analytics Team"], confidence: parsed.stakeholders?.confidence || 85, evidence: defaultEvidence },
      methodology: { value: parsed.methodology?.value || rawBaseProject.methodology, confidence: parsed.methodology?.confidence || 90, evidence: defaultEvidence },
      industry: { value: parsed.industry?.value || rawBaseProject.industry, confidence: parsed.industry?.confidence || 85, evidence: defaultEvidence },
      role: { value: parsed.role?.value || rawBaseProject.role, confidence: parsed.role?.confidence || 85, evidence: defaultEvidence },
      duration: { value: parsed.duration?.value || rawBaseProject.duration, confidence: parsed.duration?.confidence || 80, evidence: defaultEvidence },
      findings: { value: parsed.findings?.value || rawBaseProject.findings, confidence: parsed.findings?.confidence || 90, evidence: defaultEvidence },
      recommendations: { value: parsed.recommendations?.value || rawBaseProject.recommendations, confidence: parsed.recommendations?.confidence || 90, evidence: defaultEvidence },
      resumeBullets: {
        value: parsed.resumeBullets?.value || [
          `Engineered data analytics and reporting routines for ${primarySource}.`,
          "Extracted and validated key performance metrics across business databases."
        ],
        confidence: parsed.resumeBullets?.confidence || 90,
        evidence: defaultEvidence
      },
      linkedInSummary: { value: parsed.linkedInSummary?.value || `Case Study: ${parsed.title?.value}`, confidence: parsed.linkedInSummary?.confidence || 90, evidence: defaultEvidence },
      starStory: {
        value: parsed.starStory?.value || {
          situation: `Analyzed data assets from ${primarySource}.`,
          task: "Synthesize insights and KPIs.",
          action: "Ran structured evidence extraction and compiler pipeline.",
          result: "Delivered verified case study metrics."
        },
        confidence: parsed.starStory?.confidence || 90,
        evidence: defaultEvidence
      },
      metrics: (parsed.metrics || []).map((m: any, idx: number) => ({
        id: `ai-metric-${idx}-${Date.now()}`,
        label: m.label,
        value: m.value,
        description: m.description,
        iconName: m.iconName || "Activity",
        confidence: m.confidence || 90,
        sourceFile: m.sourceFile || primarySource
      })),
      tags: parsed.tags || rawBaseProject.tags,
      categories: parsed.categories || rawBaseProject.categories
    };

    // Update raw base project with Gemini's synthesized narrative for backwards compatibility
    const rawUpdated: ExtractedProject = {
      ...rawBaseProject,
      title: structured.title.value,
      subtitle: structured.subtitle.value,
      summary: structured.executiveSummary.value,
      businessProblem: structured.businessProblem.value,
      methodology: structured.methodology.value,
      findings: structured.findings.value,
      recommendations: structured.recommendations.value,
      industry: structured.industry.value,
      role: structured.role.value,
      duration: structured.duration.value,
      tags: structured.tags,
      categories: structured.categories,
      metrics: structured.metrics.length > 0 ? structured.metrics.map(m => ({
        id: m.id,
        label: m.label,
        value: m.value,
        description: m.description,
        iconName: m.iconName,
        sourceFile: m.sourceFile
      })) : rawBaseProject.metrics
    };

    return { structured, raw: rawUpdated };
  } catch (err: any) {
    console.error("[portfolioCompiler] Gemini synthesis error, using fallback:", err.message);
    return buildFallbackStructuredProject(graph, rawBaseProject);
  }
}
