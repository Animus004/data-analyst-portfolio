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

  const sourceMap = new Map<string, { fileName: string; parser: string; confidence: number; nodesExtracted: number }>();

  for (const node of extractedNodes) {
    const { type, data } = node;
    const { sourceFile, parser, confidence, location } = data;

    if (!sourceMap.has(sourceFile)) {
      sourceMap.set(sourceFile, { fileName: sourceFile, parser, confidence, nodesExtracted: 0 });
    }
    const sourceMeta = sourceMap.get(sourceFile)!;

    switch (type) {
      case "excel": {
        data.metrics.forEach(m => {
          graph.metrics.push({ value: m, sourceFile, parser, confidence, location });
          graph.detectedKPIs.push({ value: { name: m.label, actual: m.value }, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        data.kpis.forEach(k => {
          graph.kpis.push({ value: { name: k.name, target: k.target, value: k.actual }, sourceFile, parser, confidence, location });
          graph.detectedKPIs.push({ value: { name: k.name, target: k.target, actual: k.actual }, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        data.charts.forEach(c => {
          graph.charts.push({ value: { title: c.title, type: c.chartType }, sourceFile, parser, confidence, location });
          graph.visualNarratives.push({ value: `Visual Chart: ${c.title} (${c.chartType || 'Standard Visual'})`, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        data.businessTerms.forEach(t => {
          graph.businessTerms.push({ value: t, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        data.dimensions.forEach(d => {
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
        if (data.formulas.length > 0) {
          graph.analyticalTechniques.push({ value: `Spreadsheet Formulas (${data.formulas.length} calculated cells)`, sourceFile, parser, confidence, location });
        }
        if (data.pivots.length > 0) {
          graph.analyticalTechniques.push({ value: `Pivot Table Analysis (${data.pivots.join(", ")})`, sourceFile, parser, confidence, location });
        }
        if (data.dashboardTitles.length > 0) {
          data.dashboardTitles.forEach(t => {
            graph.dashboards.push({ value: { name: t, pages: data.sheetNames }, sourceFile, parser, confidence, location });
            graph.dashboardInsights.push({ value: `Dashboard Layout Sheet: ${t}`, sourceFile, parser, confidence, location });
            sourceMeta.nodesExtracted++;
          });
        }
        break;
      }

      case "sql": {
        if (data.tables.length > 0 || data.joins.length > 0 || data.aggregations.length > 0) {
          graph.sqlLogic.push({
            value: {
              tables: data.tables,
              joins: data.joins,
              aggregations: data.aggregations,
              windowFunctions: data.windowFunctions
            },
            sourceFile,
            parser,
            confidence,
            location
          });
          data.tables.forEach(t => graph.businessEntities.push({ value: `Table Entity: ${t}`, sourceFile, parser, confidence }));
          if (data.joins.length > 0) {
            graph.analyticalTechniques.push({ value: `Relational Join Modeling (${data.joins.length} join criteria)`, sourceFile, parser, confidence });
          }
          if (data.windowFunctions.length > 0) {
            graph.analyticalTechniques.push({ value: `Advanced SQL Window Functions (${data.windowFunctions.length} window definitions)`, sourceFile, parser, confidence });
          }
          sourceMeta.nodesExtracted++;
        }
        data.calculatedMetrics.forEach(cm => {
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
        data.businessQuestions.forEach(q => {
          graph.businessTerms.push({ value: q, sourceFile, parser, confidence, location });
          graph.businessQuestions.push({ value: q, sourceFile, parser, confidence, location });
          sourceMeta.nodesExtracted++;
        });
        break;
      }

      case "powerbi": {
        data.visuals.forEach(v => {
          graph.charts.push({ value: { title: v.title, type: v.type }, sourceFile, parser, confidence, location });
          graph.visualNarratives.push({ value: `Visual Card: ${v.title} (${v.type})`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        data.kpis.forEach(k => {
          graph.kpis.push({ value: { name: k.label, value: k.value }, sourceFile, parser, confidence, location });
          graph.detectedKPIs.push({ value: { name: k.label, actual: k.value }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        if (data.pages.length > 0) {
          graph.dashboards.push({ value: { name: `${sourceFile} Dashboard`, pages: data.pages, visualCount: data.visuals.length }, sourceFile, parser, confidence, location });
          graph.dashboardInsights.push({ value: `Power BI Dashboard Pages: ${data.pages.join(", ")}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        data.daxMeasures.forEach(dax => {
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
        if (data.tools) {
          data.tools.forEach(t => {
            graph.businessTerms.push({ value: `Tool: ${t}`, sourceFile, parser, confidence });
            sourceMeta.nodesExtracted++;
          });
        }
        break;
      }

      case "document": {
        if (data.title) {
          graph.documentation.push({ value: { key: "Document Title", text: data.title }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        data.sections.forEach(s => {
          graph.documentation.push({ value: { key: s.heading, text: s.content }, sourceFile, parser, confidence, location: s.heading });
          if (s.heading.toLowerCase().includes("question") || s.heading.toLowerCase().includes("objective")) {
            graph.businessQuestions.push({ value: s.content.slice(0, 150), sourceFile, parser, confidence, location: s.heading });
          }
          sourceMeta.nodesExtracted++;
        });
        data.extractedTerms.forEach(t => {
          graph.businessTerms.push({ value: t, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        break;
      }

      case "image": {
        if (data.dashboardDetected) {
          graph.dashboards.push({ value: { name: `Image Visual: ${sourceFile}`, visualCount: data.charts.length + data.kpiCards.length }, sourceFile, parser, confidence });
          graph.dashboardInsights.push({ value: `Visual Dashboard Screenshot: ${sourceFile}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        }
        data.kpiCards.forEach(k => {
          graph.kpis.push({ value: { name: k }, sourceFile, parser, confidence });
          graph.detectedKPIs.push({ value: { name: k }, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        data.charts.forEach(c => {
          graph.charts.push({ value: { title: c }, sourceFile, parser, confidence });
          graph.visualNarratives.push({ value: `Visual Image Element: ${c}`, sourceFile, parser, confidence });
          sourceMeta.nodesExtracted++;
        });
        const detected = [...data.kpiCards, ...data.charts, ...data.tables, ...data.filters];
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
 * Detects conflicts across evidence items prior to Gemini synthesis.
 */
export function detectEvidenceConflicts(graph: EvidenceGraph): ConflictRecord[] {
  const conflicts: ConflictRecord[] = [];

  // Group metrics by normalized label to find numeric or description discrepancies
  const metricGroups = new Map<string, Array<{ value: string; sourceFile: string; location?: string }>>();

  graph.metrics.forEach(mNode => {
    const labelNorm = mNode.value.label.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
    if (labelNorm) {
      if (!metricGroups.has(labelNorm)) {
        metricGroups.set(labelNorm, []);
      }
      metricGroups.get(labelNorm)!.push({
        value: `${mNode.value.label}: ${mNode.value.value}`,
        sourceFile: mNode.sourceFile,
        location: mNode.location
      });
    }
  });

  metricGroups.forEach((group, normLabel) => {
    if (group.length > 1) {
      const uniqueVals = new Set(group.map(g => g.value.toLowerCase().trim()));
      if (uniqueVals.size > 1) {
        conflicts.push({
          field: `Metric Discrepancy (${group[0].value.split(":")[0]})`,
          values: group
        });
      }
    }
  });

  return conflicts;
}
