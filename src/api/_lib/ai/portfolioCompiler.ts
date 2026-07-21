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
 * Builds a deterministic fallback StructuredPortfolioProject from EvidenceGraph
 * if Gemini API is unconfigured or synthesis fails.
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
    businessObjective: {
      value: rawBaseProject.objective || "Deliver grounded business intelligence and clear quantitative performance indicators.",
      confidence: 85,
      evidence: defaultEvidence
    },
    stakeholders: {
      value: ["Executive Leadership", "Analytics Leads", "Operations Teams"],
      confidence: 85,
      evidence: defaultEvidence
    },
    datasetDescription: {
      value: rawBaseProject.datasetDesc || "Multi-source dataset containing business metrics, analytical scripts, and structured data tables.",
      confidence: 85,
      evidence: defaultEvidence
    },
    methodology: {
      value: rawBaseProject.methodology || "Data ingested, cleaned, and structured via specialized parser pipeline.",
      confidence: 90,
      evidence: defaultEvidence
    },
    dataCleaning: {
      value: rawBaseProject.dataCleaning || "Extracted, validated binary signatures, and normalized analytical schema.",
      confidence: 85,
      evidence: defaultEvidence
    },
    analysisProcess: {
      value: "1. Collected evidence nodes across spreadsheets, SQL scripts, and documentation.\n2. Built canonical evidence graph.\n3. Verified metric lineage and synthesized portfolio artifacts.",
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
    challenges: {
      value: rawBaseProject.challengesText || "Handling disparate data formats and ensuring strict factual alignment.",
      confidence: 80,
      evidence: defaultEvidence
    },
    lessonsLearned: {
      value: rawBaseProject.lessonsLearned || "Maintained strict evidence tracing to guarantee data integrity.",
      confidence: 85,
      evidence: defaultEvidence
    },
    technologyStack: {
      value: rawBaseProject.tags || ["SQL", "Excel", "Python", "Power BI"],
      confidence: 90,
      evidence: defaultEvidence
    },
    skillsDemonstrated: {
      value: rawBaseProject.categories || ["Data Analysis", "SQL Querying", "KPI Modeling", "Data Visualization"],
      confidence: 90,
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
    gitHubReadmeSummary: {
      value: `# ${rawBaseProject.title}\n\n## Overview\n${rawBaseProject.summary}\n\n## Key Metrics\n${rawBaseProject.metrics.map(m => `- **${m.label}**: ${m.value}`).join("\n")}`,
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
 * AI Portfolio Compiler Service (Gemini Reasoning Engine)
 * Synthesizes EvidenceGraph into a recruiter-ready StructuredPortfolioProject.
 * Operates ONLY on EvidenceGraph nodes and parser summaries—NEVER raw binary files.
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
You are the world's leading AI Portfolio Compiler and Business Intelligence Consultant.
Your job is to act as an evidence-driven reasoning engine that synthesizes a normalized Evidence Graph into a world-class, recruiter-ready data analytics case study.

### SYSTEM INSTRUCTIONS & GROUNDING DIRECTIVES:
1. **NEVER USE FILENAMES AS PROJECT TITLES**: Never title a project "script.py", "data.xlsx", or "query.sql". Create a descriptive, domain-focused project title (e.g., "Retail Revenue & Customer Churn Analytics Engine").
2. **ZERO FABRICATION & STRICT GROUNDING**: Never invent numbers, KPIs, or fake business outcomes. If a specific section lacks supporting evidence in the Evidence Graph, explicitly write "Insufficient evidence."
3. **RECURRING REASONING ENGINE**: Connect all parser outputs (SQL logic, spreadsheet formulas, DAX measures, documentation, screenshots) into one coherent strategic business story.
4. **RECRUITER-READY COPYWRITING**: Rewrite every section in executive-level Data Analyst / Consultant English. Improve grammar, phrasing, and formatting throughout.
5. **HIRING MANAGER AUDIT**: Evaluate your generated output against the standard: "Would this project impress a hiring manager reviewing a Data Analyst portfolio?" Ensure clear structure, high-impact phrasing, professional formatting, and zero grammatical errors.

### CANONICAL EVIDENCE GRAPH:
${JSON.stringify(graph, null, 2)}

### IDENTIFIED CONFLICTS:
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
            businessObjective: {
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
            datasetDescription: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
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
            dataCleaning: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            analysisProcess: {
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
            challenges: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            lessonsLearned: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                confidence: { type: Type.INTEGER }
              },
              required: ["value", "confidence"]
            },
            technologyStack: {
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
            skillsDemonstrated: {
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
            gitHubReadmeSummary: {
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
            "businessObjective",
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
      businessObjective: { value: parsed.businessObjective?.value || rawBaseProject.objective, confidence: parsed.businessObjective?.confidence || 90, evidence: defaultEvidence },
      stakeholders: { value: parsed.stakeholders?.value || ["Executive Leadership", "Analytics Leads"], confidence: parsed.stakeholders?.confidence || 85, evidence: defaultEvidence },
      datasetDescription: { value: parsed.datasetDescription?.value || rawBaseProject.datasetDesc, confidence: parsed.datasetDescription?.confidence || 85, evidence: defaultEvidence },
      methodology: { value: parsed.methodology?.value || rawBaseProject.methodology, confidence: parsed.methodology?.confidence || 90, evidence: defaultEvidence },
      dataCleaning: { value: parsed.dataCleaning?.value || rawBaseProject.dataCleaning, confidence: parsed.dataCleaning?.confidence || 85, evidence: defaultEvidence },
      analysisProcess: { value: parsed.analysisProcess?.value || rawBaseProject.methodology, confidence: parsed.analysisProcess?.confidence || 85, evidence: defaultEvidence },
      industry: { value: parsed.industry?.value || rawBaseProject.industry, confidence: parsed.industry?.confidence || 85, evidence: defaultEvidence },
      role: { value: parsed.role?.value || rawBaseProject.role, confidence: parsed.role?.confidence || 85, evidence: defaultEvidence },
      duration: { value: parsed.duration?.value || rawBaseProject.duration, confidence: parsed.duration?.confidence || 80, evidence: defaultEvidence },
      findings: { value: parsed.findings?.value || rawBaseProject.findings, confidence: parsed.findings?.confidence || 90, evidence: defaultEvidence },
      recommendations: { value: parsed.recommendations?.value || rawBaseProject.recommendations, confidence: parsed.recommendations?.confidence || 90, evidence: defaultEvidence },
      challenges: { value: parsed.challenges?.value || rawBaseProject.challengesText, confidence: parsed.challenges?.confidence || 80, evidence: defaultEvidence },
      lessonsLearned: { value: parsed.lessonsLearned?.value || rawBaseProject.lessonsLearned, confidence: parsed.lessonsLearned?.confidence || 85, evidence: defaultEvidence },
      technologyStack: { value: parsed.technologyStack?.value || rawBaseProject.tags, confidence: parsed.technologyStack?.confidence || 90, evidence: defaultEvidence },
      skillsDemonstrated: { value: parsed.skillsDemonstrated?.value || rawBaseProject.categories, confidence: parsed.skillsDemonstrated?.confidence || 90, evidence: defaultEvidence },
      resumeBullets: {
        value: parsed.resumeBullets?.value || [
          `Engineered data analytics and reporting routines for ${primarySource}.`,
          "Extracted and validated key performance metrics across business databases."
        ],
        confidence: parsed.resumeBullets?.confidence || 90,
        evidence: defaultEvidence
      },
      linkedInSummary: { value: parsed.linkedInSummary?.value || `Case Study: ${parsed.title?.value}`, confidence: parsed.linkedInSummary?.confidence || 90, evidence: defaultEvidence },
      gitHubReadmeSummary: { value: parsed.gitHubReadmeSummary?.value || `# ${parsed.title?.value}\n\n${parsed.executiveSummary?.value}`, confidence: parsed.gitHubReadmeSummary?.confidence || 90, evidence: defaultEvidence },
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
      objective: structured.businessObjective.value,
      businessProblem: structured.businessProblem.value,
      datasetDesc: structured.datasetDescription.value,
      methodology: structured.methodology.value,
      dataCleaning: structured.dataCleaning.value,
      findings: structured.findings.value,
      recommendations: structured.recommendations.value,
      challengesText: structured.challenges.value,
      lessonsLearned: structured.lessonsLearned.value,
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
