/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ParserEvidenceNode,
  EvidenceGraph,
  CanonicalEvidenceNode,
  ConflictRecord
} from "../types/index";

/**
 * Safe Array Assertion & Telemetry helper
 */
function safeForEach<T>(arr: T[] | undefined | null, varName: string, callback: (item: T, idx: number) => void): void {
  if (!arr) return;
  if (!Array.isArray(arr)) {
    console.error(`[DATA SHAPE ASSERTION ERROR] Expected array for '${varName}', got:`, typeof arr, arr);
    return;
  }
  arr.forEach(callback);
}

/**
 * Normalizes and aggregates raw parser evidence nodes into a single canonical EvidenceGraph.
 */
export function mergeToEvidenceGraph(extractedNodes: ParserEvidenceNode[]): EvidenceGraph {
  const graph: EvidenceGraph = {
    projectDomain: undefined,
    industry: undefined,
    businessTerms: [],
    businessEntities: [],
    businessQuestions: [],
    analyticalTechniques: [],
    detectedKPIs: [],
    detectedDimensions: [],
    detectedMeasures: [],
    dashboardInsights: [],
    visualNarratives: [],
    timeDimensions: [],
    stakeholderIndicators: [],
    metrics: [],
    dimensions: [],
    kpis: [],
    charts: [],
    dashboards: [],
    sqlLogic: [],
    documentation: [],
    methodology: [],
    screenshots: [],
    recommendations: [],
    evidenceSources: []
  };

  if (!Array.isArray(extractedNodes)) {
    console.error("[DATA SHAPE ASSERTION ERROR] mergeToEvidenceGraph: extractedNodes is not an array", extractedNodes);
    return graph;
  }

  const sourceMap = new Map<string, { fileName: string; parser: string; confidence: number; nodesExtracted: number }>();

  for (const node of extractedNodes) {
    if (!node || !node.data) continue;
    const { type, data } = node;
    const { sourceFile, parser, confidence, location } = data;

    if (!sourceMap.has(sourceFile)) {
      sourceMap.set(sourceFile, { fileName: sourceFile, parser, confidence, nodesExtracted: 0 });
    }
    const sourceMeta = sourceMap.get(sourceFile)!;

    switch (type) {
      case "excel": {
        safeForEach(data.metrics, "excel.metrics", m => {
          graph.metrics.push({ value: m, sourceFile, parser, confidence, location });
          graph.detectedKPIs.push({ value: { name: m.label, actual: m.value }, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        safeForEach(data.kpis, "excel.kpis", k => {
          graph.kpis.push({ value: { name: k.name, target: k.target, value: k.actual }, sourceFile, parser, confidence, location });
          graph.detectedKPIs.push({ value: { name: k.name, target: k.target, actual: k.actual }, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        safeForEach(data.charts, "excel.charts", c => {
          graph.charts.push({ value: { title: c.title, type: c.chartType }, sourceFile, parser, confidence, location });
          graph.visualNarratives.push({ value: `Visual Chart: ${c.title} (${c.chartType || 'Standard Visual'})`, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        safeForEach(data.businessTerms, "excel.businessTerms", t => {
          graph.businessTerms.push({ value: t, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        safeForEach(data.dimensions, "excel.dimensions", d => {
          graph.dimensions.push({ value: d, sourceFile, parser, confidence, location });
          graph.detectedDimensions.push({ value: d, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;

          // Derive time dimensions and business entities
          const lower = d.toLowerCase();
          if (lower.includes("date") || lower.includes("year") || lower.includes("month") || lower.includes("quarter") || lower.includes("time")) {
            graph.timeDimensions.push({ value: d, sourceFile, parser, confidence, location });
          }
          if (lower.includes("customer") || lower.includes("client") || lower.includes("product") || lower.includes("region") || lower.includes("store")) {
            graph.businessEntities.push({ value: d, sourceFile, parser, confidence, location });
          }
        });
        safeForEach(data.measures, "excel.measures", m => {
          graph.detectedMeasures.push({ value: m, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        safeForEach(data.calculatedColumns, "excel.calculatedColumns", cc => {
          graph.analyticalTechniques.push({
            value: `Calculated Column '${cc.column}' in ${cc.sheet} (Formula: =${cc.formula})`,
            sourceFile, parser, confidence
          });
          sourceMeta.nodesExtracted++;
        });
        safeForEach(data.worksheets, "excel.worksheets", ws => {
          const colList = Array.isArray(ws.columns) ? ws.columns.slice(0, 5).join(", ") : "";
          graph.dashboardInsights.push({
            value: `Worksheet [${ws.name}] (${ws.role}): ${ws.rowCount} rows, ${ws.columnCount} columns (${colList})`,
            sourceFile, parser, confidence
          });
          sourceMeta.nodesExtracted++;
        });
        if (data.workbookMetadata && Object.keys(data.workbookMetadata).length > 0) {
          const metaText = Object.entries(data.workbookMetadata).map(([k, v]) => `${k}: ${v}`).join("; ");
          graph.documentation.push({ value: { key: "Workbook Metadata", text: metaText }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        if (Array.isArray(data.formulas) && data.formulas.length > 0) {
          graph.analyticalTechniques.push({ value: `Spreadsheet Formulas (${data.formulas.length} calculated cells)`, sourceFile, parser, confidence, location });
        }
        if (Array.isArray(data.pivots) && data.pivots.length > 0) {
          graph.analyticalTechniques.push({ value: `Pivot Table Analysis (${data.pivots.join(", ")})`, sourceFile, parser, confidence, location });
        }
        safeForEach(data.dashboardTitles, "excel.dashboardTitles", t => {
          graph.dashboards.push({ value: { name: t, pages: data.sheetNames }, sourceFile, parser, confidence, location });
          graph.dashboardInsights.push({ value: `Dashboard Layout Sheet: ${t}`, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        break;
      }

      case "sql": {
        if (Array.isArray(data.tables)) {
          graph.sqlLogic.push({
            value: {
              tables: data.tables,
              joins: data.joins || [],
              aggregations: data.aggregations || [],
              windowFunctions: data.windowFunctions || []
            },
            sourceFile,
            parser,
            confidence,
            location
          });
          safeForEach(data.tables, "sql.tables", t => graph.businessEntities.push({ value: `Table Entity: ${t}`, sourceFile, parser, confidence }));
          if (Array.isArray(data.joins) && data.joins.length > 0) {
            graph.analyticalTechniques.push({ value: `Relational Join Modeling (${data.joins.length} join criteria)`, sourceFile, parser, confidence });
          }
          if (Array.isArray(data.windowFunctions) && data.windowFunctions.length > 0) {
            graph.analyticalTechniques.push({ value: `Advanced SQL Window Functions (${data.windowFunctions.length} window definitions)`, sourceFile, parser, confidence });
          }
          sourceMeta.nodesExtracted++;
        }
        safeForEach(data.calculatedMetrics, "sql.calculatedMetrics", cm => {
          graph.metrics.push({
            value: { label: cm.name, value: cm.formula, description: "Calculated SQL Metric" },
            sourceFile,
            parser,
            confidence,
            location
          });
          graph.detectedMeasures.push({ value: `${cm.name} (${cm.formula})`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        safeForEach(data.businessQuestions, "sql.businessQuestions", q => {
          graph.businessTerms.push({ value: q, sourceFile, parser, confidence, location });
          graph.businessQuestions.push({ value: q, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        break;
      }

      case "powerbi": {
        safeForEach(data.visuals, "powerbi.visuals", v => {
          graph.charts.push({ value: { title: v.title, type: v.type }, sourceFile, parser, confidence, location });
          graph.visualNarratives.push({ value: `Visual Card: ${v.title} (${v.type})`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        safeForEach(data.kpis, "powerbi.kpis", k => {
          graph.kpis.push({ value: { name: k.label, value: k.value }, sourceFile, parser, confidence, location });
          graph.detectedKPIs.push({ value: { name: k.label, actual: k.value }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        if (Array.isArray(data.pages) && data.pages.length > 0) {
          graph.dashboards.push({ value: { name: `${sourceFile} Dashboard`, pages: data.pages, visualCount: (data.visuals || []).length }, sourceFile, parser, confidence, location });
          graph.dashboardInsights.push({ value: `Power BI Dashboard Pages: ${data.pages.join(", ")}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        safeForEach(data.daxMeasures, "powerbi.daxMeasures", dax => {
          graph.metrics.push({
            value: { label: dax.name, value: dax.expression, description: "DAX Measure" },
            sourceFile,
            parser,
            confidence,
            location
          });
          graph.analyticalTechniques.push({ value: `DAX Calculated Measure: ${dax.name}`, sourceFile, parser, confidence });
          graph.detectedMeasures.push({ value: dax.name, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        break;
      }

      case "readme": {
        if (data.objective) {
          graph.documentation.push({ value: { key: "Objective", text: data.objective }, sourceFile, parser, confidence });
          graph.businessQuestions.push({ value: `Objective Query: ${data.objective}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        if (data.methodology) {
          graph.methodology.push({ value: data.methodology, sourceFile, parser, confidence });
          graph.analyticalTechniques.push({ value: `Methodology Overview: ${data.methodology.slice(0, 100)}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        if (data.findings) {
          graph.documentation.push({ value: { key: "Findings", text: data.findings }, sourceFile, parser, confidence });
          graph.dashboardInsights.push({ value: `Parsed Findings: ${data.findings.slice(0, 150)}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        if (data.recommendations) {
          graph.recommendations.push({ value: data.recommendations, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        safeForEach(data.tools, "readme.tools", t => {
          graph.businessTerms.push({ value: `Tool: ${t}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        break;
      }

      case "document": {
        if (data.title) {
          graph.documentation.push({ value: { key: "Document Title", text: data.title }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        safeForEach(data.sections, "document.sections", s => {
          graph.documentation.push({ value: { key: s.heading, text: s.content }, sourceFile, parser, confidence, location: s.heading });
          if (s.heading.toLowerCase().includes("question") || s.heading.toLowerCase().includes("objective")) {
            graph.businessQuestions.push({ value: s.content.slice(0, 150), sourceFile, parser, confidence, location: s.heading });
          }
          sourceMeta.nodesExtracted++;
        });
        safeForEach(data.extractedTerms, "document.extractedTerms", t => {
          graph.businessTerms.push({ value: t, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        break;
      }

      case "image": {
        const kpiCards = data.kpiCards || [];
        const charts = data.charts || [];
        const tables = data.tables || [];
        const filters = data.filters || [];

        if (data.dashboardDetected) {
          graph.dashboards.push({ value: { name: `Image Visual: ${sourceFile}`, visualCount: charts.length + kpiCards.length }, sourceFile, parser, confidence });
          graph.dashboardInsights.push({ value: `Visual Dashboard Screenshot: ${sourceFile}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        safeForEach(kpiCards, "image.kpiCards", k => {
          graph.kpis.push({ value: { name: k }, sourceFile, parser, confidence });
          graph.detectedKPIs.push({ value: { name: k }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        safeForEach(charts, "image.charts", c => {
          graph.charts.push({ value: { title: c }, sourceFile, parser, confidence });
          graph.visualNarratives.push({ value: `Visual Image Element: ${c}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        const detected = [...kpiCards, ...charts, ...tables, ...filters];
        if (detected.length > 0) {
          graph.screenshots.push({ value: { detectedElements: detected }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        break;
      }
    }
  }

  graph.evidenceSources = Array.from(sourceMap.values());
  return graph;
}

/**
 * Detects conflicts between evidence nodes across multiple parser sources.
 */
export function detectEvidenceConflicts(graph: EvidenceGraph): ConflictRecord[] {
  const conflicts: ConflictRecord[] = [];
  const metricGroups = new Map<string, Array<{ value: string; sourceFile: string; confidence: number }>>();

  safeForEach(graph.metrics, "graph.metrics", mNode => {
    const label = mNode.value.label.trim();
    const normLabel = label.toLowerCase();
    if (!metricGroups.has(normLabel)) {
      metricGroups.set(normLabel, []);
    }
    metricGroups.get(normLabel)!.push({
      value: mNode.value.value,
      sourceFile: mNode.sourceFile,
      confidence: mNode.confidence
    });
  });

  metricGroups.forEach((group, normLabel) => {
    if (group.length > 1) {
      const firstVal = group[0].value;
      const hasConflict = group.some(item => item.value !== firstVal);

      if (hasConflict) {
        conflicts.push({
          id: `conflict-${normLabel}-${Date.now()}`,
          fieldName: `Metric: ${group[0].value}`,
          fieldLabel: `Conflicting values for KPI Metric '${group[0].value}'`,
          conflictType: "Metric Discrepancy",
          competingValues: group.map(g => ({
            sourceFile: g.sourceFile,
            value: g.value,
            confidence: g.confidence
          })),
          resolvedValue: undefined,
          isUserResolved: false,
          impactScore: 85
        } as any);
      }
    }
  });

  return conflicts;
}
