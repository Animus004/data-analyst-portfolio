/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExtractedProject, ExtractedMetric, ExtractedStoryBlock } from "./types";

export function parseRFiles(files: Array<{ name: string; content: string }>): ExtractedProject {
  const sourceFiles = files.map(f => f.name);

  let title = "R Statistical Analytics";
  let subtitle = "Exploratory data analysis, statistical modeling, and RMarkdown reporting";
  let objective = "Build analytical R scripts or markdown report to perform statistical modeling.";
  let businessProblem = "";
  let datasetDesc = "Raw file datasets loaded into R DataFrames.";
  let dataCleaning = "";
  let methodology = "1. Loaded and formatted data frames.\n2. Performed exploratory analysis with ggplot2.\n3. Fit statistical regression models.";
  let findings = "";
  let recommendations = "";
  let challengesText = "";
  let lessonsLearned = "";
  const metrics: ExtractedMetric[] = [];
  const storyBlocks: ExtractedStoryBlock[] = [];
  const tags: string[] = ["R", "ggplot2"];
  const categories: string[] = ["Statistical Analysis", "Data Science"];

  files.forEach((file, fileIdx) => {
    // Default title based on first R filename
    if (fileIdx === 0) {
      const cleanName = file.name.replace(/\.(r|rmd)$/i, "").replace(/[-_]+/g, " ");
      title = `R Analytics: ${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;
    }

    const lines = file.content.split("\n");
    let inRCodeChunk = false;
    let currentChunkCode = "";
    let markdownText = "";

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();

      // Check RMarkdown code chunk start/end e.g. ```{r}
      if (trimmed.startsWith("```{r")) {
        inRCodeChunk = true;
        currentChunkCode = "";
        return;
      }
      if (trimmed.startsWith("```") && inRCodeChunk) {
        inRCodeChunk = false;
        if (currentChunkCode.trim()) {
          storyBlocks.push({
            id: `r-sb-chunk-${fileIdx}-${lineIdx}-${Date.now()}`,
            type: "code_snippet",
            title: `R Markdown Chunk`,
            bodyContent: currentChunkCode,
            language: "r",
            sourceFile: file.name
          });
        }
        return;
      }

      if (inRCodeChunk) {
        currentChunkCode += line + "\n";
        // Look for KPI comments in code chunk
        detectRCommentKpi(trimmed, lineIdx + 1, file.name, "R Markdown Chunk");
      } else {
        // Markdown prose
        markdownText += line + "\n";

        // Check for Markdown header fields
        if (trimmed.startsWith("#")) {
          const headerText = trimmed.replace(/^#+\s*/, "").toLowerCase();
          if (headerText.includes("objective") || headerText.includes("goal")) {
            objective = trimmed.replace(/^#+\s*/, "");
          } else if (headerText.includes("findings") || headerText.includes("insight")) {
            findings = trimmed.replace(/^#+\s*/, "");
          }
        }

        // Look for KPI comments in comments
        if (trimmed.startsWith("#")) {
          detectRCommentKpi(trimmed, lineIdx + 1, file.name);
        }
      }
    });

    // Handle normal script .R files
    if (!file.name.endsWith(".Rmd") && file.content.trim()) {
      storyBlocks.push({
        id: `r-sb-script-${fileIdx}-${Date.now()}`,
        type: "code_snippet",
        title: `R Script: ${file.name}`,
        bodyContent: file.content,
        language: "r",
        sourceFile: file.name
      });
    }

    // Helper to detect KPIs
    function detectRCommentKpi(text: string, lineNum: number, source: string, chunkLabel?: string) {
      const cleaned = text.trim();
      if (!cleaned.startsWith("#")) return;

      const comment = cleaned.substring(1).trim();
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
            id: `r-metric-${metrics.length}-${Date.now()}`,
            label: mLabel,
            value: mVal,
            description: mDesc || `Extracted from ${source}`,
            iconName: "Activity",
            sourceFile: source,
            sourceLocation: chunkLabel ? `${chunkLabel}, Line ${lineNum}` : `Line ${lineNum}`
          });
        }
      }
    }
  });

  return {
    title,
    subtitle,
    summary: `R statistical processing compiled from R/RMarkdown source files: ${sourceFiles.join(", ")}.`,
    industry: "Statistical Modeling",
    role: "Statistical Analyst",
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
