/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExtractedProject, ExtractedMetric, ExtractedStoryBlock } from "./types";

export function parsePythonFiles(files: Array<{ name: string; content: string }>): ExtractedProject {
  const sourceFiles = files.map(f => f.name);

  let title = "Python Analytics Pipeline";
  let subtitle = "Exploratory data analysis, modeling, and pythonic processing";
  let objective = "Build an analytical pipeline in Python to discover data insights.";
  let businessProblem = "";
  let datasetDesc = "Raw file datasets loaded via pandas.";
  let dataCleaning = "";
  let methodology = "1. Loaded and prepared data using pandas.\n2. Carried out exploratory data analysis.\n3. Drafted analytical code cells.";
  let findings = "";
  let recommendations = "";
  let challengesText = "";
  let lessonsLearned = "";
  const metrics: ExtractedMetric[] = [];
  const storyBlocks: ExtractedStoryBlock[] = [];
  const tags: string[] = ["Python"];
  const categories: string[] = ["Data Science", "Data Engineering"];

  // Analyze files
  files.forEach((file, fileIdx) => {
    const isNotebook = file.name.endsWith(".ipynb");
    
    // Default title based on first Python file
    if (fileIdx === 0) {
      const cleanName = file.name.replace(/\.(py|ipynb)$/i, "").replace(/[-_]+/g, " ");
      title = `Python Analytics: ${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;
    }

    if (isNotebook) {
      // Jupyter Notebook
      try {
        const json = JSON.parse(file.content);
        const cells = json.cells || [];
        let markdownConcat = "";
        let codeCellIdx = 0;

        cells.forEach((cell: any, cellIdx: number) => {
          const cellType = cell.cell_type;
          const sourceLines = Array.isArray(cell.source) ? cell.source : [cell.source || ""];
          const sourceText = sourceLines.join("");

          if (cellType === "markdown") {
            markdownConcat += sourceText + "\n\n";
            
            // Look for headers
            const lines = sourceText.split("\n");
            lines.forEach(l => {
              const trimmed = l.trim();
              if (trimmed.startsWith("#")) {
                const headerText = trimmed.replace(/^#+\s*/, "").toLowerCase();
                if (headerText.includes("objective") || headerText.includes("goal")) {
                  objective = trimmed.replace(/^#+\s*/, "");
                } else if (headerText.includes("problem") || headerText.includes("business friction")) {
                  businessProblem = trimmed.replace(/^#+\s*/, "");
                } else if (headerText.includes("methodology") || headerText.includes("workflow")) {
                  methodology = trimmed.replace(/^#+\s*/, "");
                } else if (headerText.includes("finding") || headerText.includes("insight")) {
                  findings = trimmed.replace(/^#+\s*/, "");
                } else if (headerText.includes("recommendation")) {
                  recommendations = trimmed.replace(/^#+\s*/, "");
                }
              }
              
              // Extract KPI comments in markdown cell
              detectKpi(trimmed, cellIdx, file.name);
            });
          } else if (cellType === "code") {
            codeCellIdx++;
            // Check for KPI comments in code cells
            sourceLines.forEach((l: any, lineNum: number) => {
              detectKpi(l, lineNum + 1, file.name, `Cell ${codeCellIdx}`);
            });

            // If it's a small code cell or has interesting code, save as story block
            if (sourceText.trim() && storyBlocks.length < 5) {
              storyBlocks.push({
                id: `py-sb-${fileIdx}-${cellIdx}-${Date.now()}`,
                type: "code_snippet",
                title: `Notebook Cell [${codeCellIdx}]`,
                bodyContent: sourceText,
                language: "python",
                sourceFile: file.name
              });
            }
          }
        });

        // Use markdown cells to populate larger blocks
        if (markdownConcat.trim()) {
          findings = findings || `Extracted findings from Jupyter Notebook: \n${markdownConcat.slice(0, 500)}...`;
        }
      } catch (err) {
        console.error(`Failed to parse Jupyter notebook JSON ${file.name}:`, err);
      }
    } else {
      // Standard .py script
      const lines = file.content.split("\n");
      let scriptContent = "";
      
      lines.forEach((line, lineIdx) => {
        scriptContent += line + "\n";
        const trimmed = line.trim();
        detectKpi(trimmed, lineIdx + 1, file.name);
      });

      storyBlocks.push({
        id: `py-sb-script-${fileIdx}-${Date.now()}`,
        type: "code_snippet",
        title: `Script: ${file.name}`,
        bodyContent: scriptContent,
        language: "python",
        sourceFile: file.name
      });
    }

    // Helper to detect KPIs
    function detectKpi(text: string, locationVal: number | string, source: string, cellLabel?: string) {
      const cleaned = text.trim();
      const commentIndex = cleaned.indexOf("#");
      
      let commentPart = cleaned;
      if (commentIndex !== -1) {
        commentPart = cleaned.substring(commentIndex + 1).trim();
      } else if (!cleaned.startsWith("#") && isNotebook && cleaned.includes("=")) {
        // Look for inline KPI comments like: accuracy = 0.94 # KPI: Model Accuracy
        // handled below
      } else {
        return;
      }

      const lower = commentPart.toLowerCase();
      if (lower.startsWith("kpi:") || lower.startsWith("metric:")) {
        const parts = commentPart.substring(commentPart.indexOf(":") + 1).split("=");
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
            id: `py-metric-${metrics.length}-${Date.now()}`,
            label: mLabel,
            value: mVal,
            description: mDesc || `Extracted from ${source}`,
            iconName: mLabel.toLowerCase().includes("accuracy") ? "Percent" : "Activity",
            sourceFile: source,
            sourceLocation: cellLabel ? `${cellLabel}, Line ${locationVal}` : `Line ${locationVal}`
          });
        }
      }
    }
  });

  // Extract libraries used for tags
  files.forEach(file => {
    const importRegex = /(?:^|\s)(?:import|from)\s+([a-zA-Z0-9_]+)/g;
    let match;
    while ((match = importRegex.exec(file.content)) !== null) {
      const lib = match[1];
      const validLibs = ["pandas", "numpy", "matplotlib", "seaborn", "sklearn", "scipy", "statsmodels", "keras", "tensorflow", "pytorch", "plotly"];
      if (validLibs.includes(lib.toLowerCase()) && !tags.includes(lib)) {
        tags.push(lib.charAt(0).toUpperCase() + lib.slice(1));
      }
    }
  });

  return {
    title,
    subtitle,
    summary: `Python analytics and modeling pipeline compiled from files: ${sourceFiles.join(", ")}.`,
    industry: "Advanced Analytics",
    role: "Data Scientist",
    duration: "2 Weeks",
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
