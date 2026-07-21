/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExtractedProject, ExtractedMetric, ExtractedStoryBlock } from "./types";

export function parsePowerBiFiles(files: Array<{ name: string; content: string }>): ExtractedProject {
  const sourceFiles = files.map(f => f.name);

  let title = "Power BI Dashboard Report";
  let subtitle = "Business Intelligence reporting, modeling, and dashboard layout";
  let objective = "Build interactive business dashboards to report key business analytics.";
  let businessProblem = "";
  let datasetDesc = "Data model loaded with multiple fact and dimension tables.";
  let dataCleaning = "";
  let methodology = "1. Connected data sources to Power BI.\n2. Built star schema relationships.\n3. Calculated measures in DAX.";
  let findings = "";
  let recommendations = "";
  let challengesText = "";
  let lessonsLearned = "";
  const metrics: ExtractedMetric[] = [];
  const storyBlocks: ExtractedStoryBlock[] = [];
  const tags: string[] = ["Power BI", "DAX", "Business Intelligence"];
  const categories: string[] = ["Business Intelligence", "Dashboard Reporting"];

  files.forEach((file, fileIdx) => {
    // Default title based on first Power BI filename
    if (fileIdx === 0) {
      const cleanName = file.name.replace(/\.(pbix|dax|json)$/i, "").replace(/[-_]+/g, " ");
      title = `Power BI Analytics: ${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;
    }

    const lines = file.content.split("\n");
    let currentDax = "";

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();

      // Look for DAX measures: MeasureName = CALCULATE(...) or similar
      const daxMatch = trimmed.match(/^([a-zA-Z0-9_\s]+)\s*=\s*(CALCULATE|SUM|AVERAGE|DIVIDE|COUNT|DISTINCTCOUNT)\b/i);
      if (daxMatch && daxMatch[1]) {
        const measureName = daxMatch[1].trim();
        const fullFormula = trimmed;
        
        // Save as a calculated measure metric
        metrics.push({
          id: `pbi-measure-${metrics.length}-${Date.now()}`,
          label: measureName,
          value: "Formula Defined",
          description: `Calculated DAX Measure: ${fullFormula.substring(0, 100)}...`,
          iconName: "BarChart2",
          sourceFile: file.name,
          sourceLocation: `Line ${lineIdx + 1}`
        });

        currentDax += `/* Measure: ${measureName} */\n${trimmed}\n\n`;
      } else if (trimmed.startsWith("//") || trimmed.startsWith("--")) {
        // Comment extraction
        const comment = trimmed.replace(/^(\/\/|--)\s*/, "");
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
              id: `pbi-metric-${metrics.length}-${Date.now()}`,
              label: mLabel,
              value: mVal,
              description: mDesc || `Extracted from ${file.name}`,
              iconName: mLabel.toLowerCase().includes("cost") ? "DollarSign" : "Activity",
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

    // Save DAX formulas in story block
    if (file.name.endsWith(".dax") || currentDax.trim()) {
      storyBlocks.push({
        id: `pbi-sb-${fileIdx}-${Date.now()}`,
        type: "code_snippet",
        title: `DAX Measures: ${file.name}`,
        bodyContent: file.content || currentDax,
        language: "sql", // sql highlighting matches DAX formulas nicely
        sourceFile: file.name
      });
    }
  });

  return {
    title,
    subtitle,
    summary: `Power BI analytical reporting compiled from layout and DAX source files: ${sourceFiles.join(", ")}.`,
    industry: "Business Intelligence",
    role: "BI Engineer",
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
