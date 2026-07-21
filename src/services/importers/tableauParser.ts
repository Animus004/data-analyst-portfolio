/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExtractedProject, ExtractedMetric, ExtractedStoryBlock } from "./types";

export function parseTableauFiles(files: Array<{ name: string; content: string }>): ExtractedProject {
  const sourceFiles = files.map(f => f.name);

  let title = "Tableau Dashboard Analytics";
  let subtitle = "Visual reporting, worksheet configuration, and dashboard actions";
  let objective = "Build analytical Tableau visualizations to explore datasets.";
  let businessProblem = "";
  let datasetDesc = "Visual Tableau data connections.";
  let dataCleaning = "";
  let methodology = "1. Configured workbook data connections.\n2. Built interactive worksheets.\n3. Compiled sheets onto a unified Tableau dashboard.";
  let findings = "";
  let recommendations = "";
  let challengesText = "";
  let lessonsLearned = "";
  const metrics: ExtractedMetric[] = [];
  const storyBlocks: ExtractedStoryBlock[] = [];
  const tags: string[] = ["Tableau", "Data Visualization"];
  const categories: string[] = ["Business Intelligence", "Data Visualization"];

  files.forEach((file, fileIdx) => {
    // Default title based on first Tableau filename
    if (fileIdx === 0) {
      const cleanName = file.name.replace(/\.(twb|twbx|xml)$/i, "").replace(/[-_]+/g, " ");
      title = `Tableau Analytics: ${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;
    }

    const content = file.content;
    const worksheets: string[] = [];
    const dashboards: string[] = [];

    // Extract Worksheet Names
    const wsRegex = /<worksheet\s+name=['"]([^'"]+)['"]/g;
    let wsMatch;
    while ((wsMatch = wsRegex.exec(content)) !== null) {
      if (!worksheets.includes(wsMatch[1])) {
        worksheets.push(wsMatch[1]);
      }
    }

    // Extract Dashboard Names
    const dbRegex = /<dashboard\s+name=['"]([^'"]+)['"]/g;
    let dbMatch;
    while ((dbMatch = dbRegex.exec(content)) !== null) {
      if (!dashboards.includes(dbMatch[1])) {
        dashboards.push(dbMatch[1]);
      }
    }

    // Extract Calculated Fields (XML blocks)
    // E.g. <column caption="Sales Margin" name="[Calculation_123]" role="measure" ...>
    //        <calculation class="tableau" formula="SUM([Profit]) / SUM([Sales])" />
    //      </column>
    const colRegex = /<column\s+caption=['"]([^'"]+)['"][^>]*>[\s\S]*?<calculation\s+class=['"]tableau['"]\s+formula=['"]([^'"]+)['"]/g;
    let colMatch;
    while ((colMatch = colRegex.exec(content)) !== null) {
      const fieldName = colMatch[1];
      const formula = colMatch[2];
      
      metrics.push({
        id: `tab-calc-${metrics.length}-${Date.now()}`,
        label: fieldName,
        value: "Calculated Field",
        description: `Formula: ${formula}`,
        iconName: "TrendingUp",
        sourceFile: file.name,
        sourceLocation: `Calculated measure definitions`
      });
    }

    // Extract Tableau comments or header descriptions if present
    const lines = content.split("\n");
    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("<!--") && trimmed.endsWith("-->")) {
        const comment = trimmed.substring(4, trimmed.length - 3).trim();
        const lower = comment.toLowerCase();
        
        if (lower.startsWith("kpi:") || lower.startsWith("metric:")) {
          const parts = comment.substring(comment.indexOf(":") + 1).split("=");
          if (parts.length >= 2) {
            const mLabel = parts[0].trim();
            const rest = parts[1].trim();
            let mVal = rest;
            let mDesc = "";

            const descIndex = rest.indexOf("(");
            if (descIndex !== -1) {
              mVal = rest.substring(0, descIndex).trim();
              mDesc = rest.substring(descIndex + 1, rest.length - 1).trim();
            }

            metrics.push({
              id: `tab-metric-${metrics.length}-${Date.now()}`,
              label: mLabel,
              value: mVal,
              description: mDesc || `Extracted from ${file.name}`,
              iconName: "Activity",
              sourceFile: file.name,
              sourceLocation: `Line ${lineIdx + 1}`
            });
          }
        } else if (lower.startsWith("title:")) {
          title = comment.substring(6).trim();
        } else if (lower.startsWith("objective:")) {
          objective = comment.substring(10).trim();
        }
      }
    });

    // Populate dataset descriptions based on extracted sheets
    if (worksheets.length > 0) {
      datasetDesc = `Tableau Workbook contains worksheets: ${worksheets.join(", ")}.`;
    }
    if (dashboards.length > 0) {
      findings = `Workbook publishes dashboards: ${dashboards.join(", ")}.`;
    }

    // Add visual hierarchy as a story block
    storyBlocks.push({
      id: `tableau-sb-${fileIdx}-${Date.now()}`,
      type: "markdown",
      title: `Workbook Structure: ${file.name}`,
      bodyContent: `### Extracted Tableau Worksheets\n${worksheets.map(w => `- **${w}**`).join("\n") || "No worksheets found."}\n\n### Extracted Dashboards\n${dashboards.map(d => `- **${d}**`).join("\n") || "No dashboards found."}`,
      sourceFile: file.name
    });
  });

  return {
    title,
    subtitle,
    summary: `Tableau dashboard visual analytics compiled from file: ${sourceFiles.join(", ")}.`,
    industry: "Data Visualization",
    role: "BI Specialist",
    duration: "1 Week",
    date: new Date().toISOString().split("T")[0],
    tags,
    categories,
    objective,
    businessProblem,
    methodology,
    datasetDesc,
    dataCleaning,
    findings,
    recommendations,
    challengesText,
    lessonsLearned,
    metrics,
    storyBlocks,
    sourceFiles
  };
}
