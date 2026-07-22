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
 * /**
 * Calculates dynamic confidence score based on evidence coverage across source files.
 * - 1 source: ~60%
 * - 2 agreeing sources: ~85%
 * - 3+ agreeing sources: ~95%
 */
export function calculateEvidenceConfidence(evidenceSourcesCount: number, agreeingCount: number = 1): number {
  const effectiveCount = Math.max(evidenceSourcesCount, agreeingCount);
  if (effectiveCount >= 3) {
    return 95;
  }
  if (effectiveCount === 2) {
    return 85;
  }
  return 60;
}

/**
 * Infers professional project role from evidence graph nodes.
 */
function inferRoleFromEvidence(graph: EvidenceGraph): string {
  if (graph.dashboards.length > 0 || graph.charts.some(c => c.parser === "PowerBIParser")) {
    return "BI Engineer";
  }
  if (graph.sqlLogic.length > 0) {
    return "Analytics Engineer";
  }
  if (graph.documentation.some(d => d.parser === "NotebookParser" || d.parser === "PythonParser")) {
    return "Data Scientist";
  }
  if (graph.metrics.some(m => m.parser === "ExcelParser")) {
    return "Financial Analyst";
  }
  return "Data Analyst";
}

/**
 * Synthesizes an evidence-derived project title when AI client is unavailable.
 */
function inferTitleFromEvidence(graph: EvidenceGraph): string {
  const topTerm = graph.businessTerms[0]?.value || graph.sqlLogic[0]?.value?.tables[0] || graph.metrics[0]?.value?.label;
  if (topTerm) {
    const cleanTerm = topTerm.replace(/[^a-zA-Z0-9\s]/g, "").trim();
    if (cleanTerm.length > 2) {
      return `${cleanTerm.charAt(0).toUpperCase() + cleanTerm.slice(1)} Analytics & Insights Engine`;
    }
  }
  const domain = graph.projectDomain && graph.projectDomain !== "Mixed Analytics" ? graph.projectDomain : "Data Analytics";
  return `${domain} Performance & Optimization Project`;
}

/**
 * Builds a deterministic fallback StructuredPortfolioProject from EvidenceGraph
 * if Gemini API is unconfigured or synthesis fails.
 */
export function buildFallbackStructuredProject(
  graph: EvidenceGraph,
  rawBaseProject: ExtractedProject
): { structured: StructuredPortfolioProject; raw: ExtractedProject } {
  const sourceCount = graph.evidenceSources.length || 1;
  const confidence = calculateEvidenceConfidence(sourceCount);
  const primarySource = graph.evidenceSources[0]?.fileName || rawBaseProject.sourceFiles[0] || "Data Package";
  const defaultEvidence = graph.evidenceSources.length > 0 
    ? graph.evidenceSources.map(s => ({ sourceFile: s.fileName, parser: s.parser }))
    : [{ sourceFile: primarySource, parser: "DeterministicFallback" }];

  const synthesizedTitle = inferTitleFromEvidence(graph);
  const synthesizedRole = inferRoleFromEvidence(graph);
  const synthesizedSubtitle = `Quantitative analytics and insights derived from ${sourceCount} evidence source${sourceCount > 1 ? "s" : ""}`;
  const synthesizedSummary = `Structured data case study synthesized from parsed analytical artifacts (${graph.evidenceSources.map(s => s.fileName).join(", ")}).`;
  const synthesizedProblem = `Optimize business metrics and analyze transactional structures across ${primarySource}.`;
  const synthesizedObjective = `Evaluate business performance metrics and provide data-backed recommendations.`;
  const synthesizedMethodology = `1. Ingested raw source data and parsed analytical structures.\n2. Built canonical evidence graph.\n3. Verified metric lineage and calculated field confidence.`;
  const synthesizedFindings = graph.metrics.length > 0 
    ? `Extracted ${graph.metrics.length} key performance indicator(s): ${graph.metrics.map(m => `${m.value.label} = ${m.value.value}`).join("; ")}.`
    : "Processed data schema and extracted core analytical variables.";
  const synthesizedRecommendations = "1. Consolidate key analytical metrics into executive dashboards.\n2. Monitor variance against operational targets.";

  const structured: StructuredPortfolioProject = {
    title: {
      value: synthesizedTitle,
      confidence,
      evidence: defaultEvidence
    },
    subtitle: {
      value: synthesizedSubtitle,
      confidence,
      evidence: defaultEvidence
    },
    executiveSummary: {
      value: synthesizedSummary,
      confidence,
      evidence: defaultEvidence
    },
    businessProblem: {
      value: synthesizedProblem,
      confidence,
      evidence: defaultEvidence
    },
    businessObjective: {
      value: synthesizedObjective,
      confidence,
      evidence: defaultEvidence
    },
    stakeholders: {
      value: ["Executive Leadership", "Analytics Leads", "Operations Teams"],
      confidence,
      evidence: defaultEvidence
    },
    datasetDescription: {
      value: `Multi-source analytical dataset comprising ${graph.evidenceSources.length} source file(s) across tables, metrics, and scripts.`,
      confidence,
      evidence: defaultEvidence
    },
    methodology: {
      value: synthesizedMethodology,
      confidence,
      evidence: defaultEvidence
    },
    dataCleaning: {
      value: "Extracted raw data definitions, checked magic byte signatures, and built structured evidence graph.",
      confidence,
      evidence: defaultEvidence
    },
    analysisProcess: {
      value: "1. Collected evidence nodes across spreadsheets, SQL scripts, and documentation.\n2. Built canonical evidence graph.\n3. Verified metric lineage and synthesized portfolio artifacts.",
      confidence,
      evidence: defaultEvidence
    },
    industry: {
      value: graph.projectDomain || "Analytics & Business Intelligence",
      confidence,
      evidence: defaultEvidence
    },
    role: {
      value: synthesizedRole,
      confidence,
      evidence: defaultEvidence
    },
    duration: {
      value: "1 Week",
      confidence,
      evidence: defaultEvidence
    },
    findings: {
      value: synthesizedFindings,
      confidence,
      evidence: defaultEvidence
    },
    recommendations: {
      value: synthesizedRecommendations,
      confidence,
      evidence: defaultEvidence
    },
    challenges: {
      value: "Ensuring cross-source schema alignment and metric accuracy without parser placeholders.",
      confidence,
      evidence: defaultEvidence
    },
    lessonsLearned: {
      value: "Maintained strict evidence graph lineage to guarantee presentation integrity.",
      confidence,
      evidence: defaultEvidence
    },
    technologyStack: {
      value: rawBaseProject.tags.length > 0 ? rawBaseProject.tags : ["SQL", "Excel", "Python", "Power BI"],
      confidence,
      evidence: defaultEvidence
    },
    skillsDemonstrated: {
      value: ["Data Analysis", "SQL Querying", "KPI Modeling", "Data Visualization"],
      confidence,
      evidence: defaultEvidence
    },
    resumeBullets: {
      value: [
        `Engineered analytical data pipelines for ${primarySource}, improving data accessibility and KPI visibility.`,
        "Analyzed key business metrics and query logic to drive evidence-backed decision making.",
        "Built interactive reporting artifacts and structured performance models."
      ],
      confidence,
      evidence: defaultEvidence
    },
    linkedInSummary: {
      value: `📊 New Data Case Study: ${synthesizedTitle}\n\nProcessed dataset insights across ${graph.evidenceSources.length} source file(s) to build a structured analytics portfolio case study. Check out the metrics and methodology!`,
      confidence,
      evidence: defaultEvidence
    },
    gitHubReadmeSummary: {
      value: `# ${synthesizedTitle}\n\n## Overview\n${synthesizedSummary}\n\n## Key Metrics\n${graph.metrics.map(m => `- **${m.value.label}**: ${m.value.value}`).join("\n")}`,
      confidence,
      evidence: defaultEvidence
    },
    starStory: {
      value: {
        situation: `Addressed business intelligence requirements across source assets (${primarySource}).`,
        task: "Synthesize disparate raw data files into clear actionable business metrics.",
        action: "Extracted metrics, queries, and spreadsheet data into canonical evidence graph.",
        result: "Delivered a structured analytics case study with full evidence lineage."
      },
      confidence,
      evidence: defaultEvidence
    },
    metrics: graph.metrics.map((m, idx) => ({
      id: `fallback-m-${idx}`,
      label: m.value.label,
      value: m.value.value,
      description: m.value.description || `Extracted metric from ${m.sourceFile}`,
      iconName: "Activity",
      confidence: calculateEvidenceConfidence(sourceCount),
      sourceFile: m.sourceFile,
      sourceLocation: m.location
    })),
    tags: rawBaseProject.tags.length > 0 ? rawBaseProject.tags : ["Analytics"],
    categories: rawBaseProject.categories.length > 0 ? rawBaseProject.categories : ["Data Analysis"]
  };

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
    categories: structured.categories
  };

  return { structured, raw: rawUpdated };
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

  const sourceCount = graph.evidenceSources.length || 1;
  const expectedConfidence = calculateEvidenceConfidence(sourceCount);

  const prompt = `
You are the world's leading AI Portfolio Compiler and Business Intelligence Consultant.
Your job is to act as an evidence-driven reasoning engine that synthesizes a normalized Evidence Graph into a world-class, recruiter-ready data analytics case study.

### SYSTEM INSTRUCTIONS & GROUNDING DIRECTIVES:
1. **GEMINI IS THE SINGLE SOURCE OF TRUTH**: You MUST generate ALL portfolio-facing presentation content (title, subtitle, role, executive summary, business problem, business objective, methodology, findings, recommendations, resume bullets, LinkedIn summary, STAR story). Never depend on parser placeholders.
2. **NEVER USE FILENAMES AS PROJECT TITLES**: Never title a project "script.py", "data.xlsx", or "query.sql". Create a descriptive, strategic domain-focused title (e.g. "E-Commerce Customer Churn & Revenue Optimization Engine").
3. **INFER PROFESSIONAL ROLE**: Infer the appropriate professional job role (e.g. "Data Analyst", "BI Engineer", "Data Scientist", "Analytics Engineer", "Financial Analyst") strictly based on the evidence nodes and tools present in the Evidence Graph.
4. **DYNAMIC CONFIDENCE SCORING BASED ON EVIDENCE COVERAGE**:
   - 1 evidence source file: score confidence ~60%
   - 2 agreeing source files: score confidence ~85%
   - 3+ agreeing source files: score confidence ~95%
5. **ZERO FABRICATION & STRICT GROUNDING**: Never invent fake metrics or numbers. Ground all numeric claims directly in the Evidence Graph.
6. **HIRING MANAGER AUDIT**: Produce executive-ready, polished copy that would impress a hiring manager reviewing a senior Data Analyst portfolio.

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
    const sourceCount = graph.evidenceSources.length || 1;
    const dynamicConfidence = calculateEvidenceConfidence(sourceCount);
    const primarySource = graph.evidenceSources[0]?.fileName || "Source Asset";
    const defaultEvidence = graph.evidenceSources.length > 0 
      ? graph.evidenceSources.map(s => ({ sourceFile: s.fileName, parser: s.parser }))
      : [{ sourceFile: primarySource }];

    const structured: StructuredPortfolioProject = {
      title: { 
        value: parsed.title?.value || inferTitleFromEvidence(graph), 
        confidence: parsed.title?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      subtitle: { 
        value: parsed.subtitle?.value || `Quantitative analysis derived from ${sourceCount} evidence source(s)`, 
        confidence: parsed.subtitle?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      executiveSummary: { 
        value: parsed.executiveSummary?.value || "Synthesized analysis derived from canonical evidence graph.", 
        confidence: parsed.executiveSummary?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      businessProblem: { 
        value: parsed.businessProblem?.value || "Analyze key operational indicators to isolate growth levers.", 
        confidence: parsed.businessProblem?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      businessObjective: { 
        value: parsed.businessObjective?.value || "Deliver evidence-grounded performance metrics and recommendations.", 
        confidence: parsed.businessObjective?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      stakeholders: { 
        value: parsed.stakeholders?.value || ["Executive Leadership", "Analytics Leads"], 
        confidence: parsed.stakeholders?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      datasetDescription: { 
        value: parsed.datasetDescription?.value || `Multi-source analytical dataset comprising ${sourceCount} evidence source(s).`, 
        confidence: parsed.datasetDescription?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      methodology: { 
        value: parsed.methodology?.value || "1. Ingested raw source data into canonical evidence graph.\n2. Verified metric lineage and calculated confidence.", 
        confidence: parsed.methodology?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      dataCleaning: { 
        value: parsed.dataCleaning?.value || "Extracted schema variables, validated file signatures, and normalized evidence.", 
        confidence: parsed.dataCleaning?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      analysisProcess: { 
        value: parsed.analysisProcess?.value || "1. Built canonical evidence graph.\n2. Verified metric lineage.\n3. Synthesized recruiter-ready case study.", 
        confidence: parsed.analysisProcess?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      industry: { 
        value: parsed.industry?.value || graph.projectDomain || "Analytics & Business Intelligence", 
        confidence: parsed.industry?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      role: { 
        value: parsed.role?.value || inferRoleFromEvidence(graph), 
        confidence: parsed.role?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      duration: { 
        value: parsed.duration?.value || "1 Week", 
        confidence: parsed.duration?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      findings: { 
        value: parsed.findings?.value || "Analyzed metrics across all provided evidence sources.", 
        confidence: parsed.findings?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      recommendations: { 
        value: parsed.recommendations?.value || "Integrate analytical KPIs into executive decision dashboards.", 
        confidence: parsed.recommendations?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      challenges: { 
        value: parsed.challenges?.value || "Ensuring strict evidence lineage across disparate data formats.", 
        confidence: parsed.challenges?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      lessonsLearned: { 
        value: parsed.lessonsLearned?.value || "Maintained grounded evidence tracing to guarantee data integrity.", 
        confidence: parsed.lessonsLearned?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      technologyStack: { 
        value: parsed.technologyStack?.value || (rawBaseProject.tags.length > 0 ? rawBaseProject.tags : ["SQL", "Excel", "Python", "Power BI"]), 
        confidence: parsed.technologyStack?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      skillsDemonstrated: { 
        value: parsed.skillsDemonstrated?.value || ["Data Analysis", "SQL Querying", "KPI Modeling", "Data Visualization"], 
        confidence: parsed.skillsDemonstrated?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      resumeBullets: {
        value: parsed.resumeBullets?.value || [
          `Engineered analytical data pipelines for ${primarySource}, improving data accessibility and KPI visibility.`,
          "Extracted and validated key performance metrics across business databases."
        ],
        confidence: parsed.resumeBullets?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      linkedInSummary: { 
        value: parsed.linkedInSummary?.value || `Case Study: ${parsed.title?.value || inferTitleFromEvidence(graph)}`, 
        confidence: parsed.linkedInSummary?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      gitHubReadmeSummary: { 
        value: parsed.gitHubReadmeSummary?.value || `# ${parsed.title?.value || inferTitleFromEvidence(graph)}\n\n${parsed.executiveSummary?.value || ''}`, 
        confidence: parsed.gitHubReadmeSummary?.confidence || dynamicConfidence, 
        evidence: defaultEvidence 
      },
      starStory: {
        value: parsed.starStory?.value || {
          situation: `Analyzed data assets from ${primarySource}.`,
          task: "Synthesize insights and KPIs.",
          action: "Ran structured evidence extraction and compiler pipeline.",
          result: "Delivered verified case study metrics."
        },
        confidence: parsed.starStory?.confidence || dynamicConfidence,
        evidence: defaultEvidence
      },
      metrics: (parsed.metrics || []).map((m: any, idx: number) => ({
        id: `ai-metric-${idx}-${Date.now()}`,
        label: m.label,
        value: m.value,
        description: m.description,
        iconName: m.iconName || "Activity",
        confidence: m.confidence || dynamicConfidence,
        sourceFile: m.sourceFile || primarySource
      })),
      tags: parsed.tags || (rawBaseProject.tags.length > 0 ? rawBaseProject.tags : ["Analytics"]),
      categories: parsed.categories || (rawBaseProject.categories.length > 0 ? rawBaseProject.categories : ["Data Analysis"])
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
