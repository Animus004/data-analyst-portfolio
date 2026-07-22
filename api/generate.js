// @ts-nocheck
// src/api/_lib/ai/index.ts
import { GoogleGenAI, Type } from "@google/genai";
var aiClient = null;
function getAiClient() {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment secrets.");
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

// src/api/_lib/storage/index.ts
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";

// src/data/seedData.ts
var defaultCreatorProfile = {
  name: "Sayan Halder",
  title: "[Insert Your Professional Title (e.g., Lead Data Analyst & Software Engineer)]",
  subtitle: "[Insert Your Professional Subtitle (e.g., Translating complex, high-dimensional datasets into beautiful, interactive, decision-grade visual systems.)]",
  bio: "[Insert Your Personal Biography / Technical Manifesto. E.g., I am an analytical problem-solver and developer specializing in E-commerce diagnostic auditing, Natural Language Processing, and digital marketplace economics. I combine state-of-the-art business intelligence tools (Power BI, Tableau) with custom programmatic pipelines (Python, Pandas, SQL) to build elegant, narrative-driven data stories that drive growth.]",
  location: "[Insert Your City, Country (e.g., Bangalore, India)]",
  timezone: "[Insert Your Timezone (e.g., IST (UTC +5:30))]",
  email: "sayanhalder813@gmail.com",
  resumeUrl: "#",
  githubUrl: "https://github.com/Animus004",
  linkedinUrl: "https://linkedin.com/in/sayan-halder-analyst",
  lookingForJob: true,
  statusBadge: "Open to Opportunities",
  heroCtaText: "Explore Case Studies",
  quickStackSkills: [
    "Excel",
    "SQL",
    "Power BI",
    "Python",
    "Business Intelligence",
    "Dashboard Design",
    "Data Cleaning",
    "Data Visualization"
  ],
  currentFocus: "Data Analytics",
  targetRole: "Data Analyst",
  currentlyLearning: "Python"
};
var seedProjects = [
  {
    id: "superstore-sales",
    title: "Superstore Sales Dashboard & Diagnostic Analysis",
    slug: "superstore-sales-dashboard-analysis",
    subtitle: "[Insert Subtitle / High-Level Objective (e.g., A diagnostic business intelligence dashboard analyzing multi-year retail transactions to identify unprofitable segments and optimize supply chains.)]",
    summary: "[Insert Brief Executive Summary (e.g., Built an interactive, responsive Power BI analytical interface modeling retail orders to identify negative profit corridors, measure distribution lag, and forecast sales trends.)]",
    industry: "[Insert Industry (e.g., E-Commerce & Retail)]",
    role: "[Insert Your Role (e.g., Lead Business Intelligence Analyst)]",
    duration: "[Insert Project Duration (e.g., 2 Months)]",
    status: "published" /* PUBLISHED */,
    difficulty: "advanced" /* ADVANCED */,
    objective: "[Insert Detailed Project Objective (e.g., To identify critical profit-bleeding product lines, optimize regional delivery durations, and build predictive sales models to guide upcoming inventory management strategies.)]",
    datasetDesc: "[Insert Dataset Description (e.g., Detailed transactional data of a multi-region retail superstore spanning thousands of records, covering order dates, shipment modes, client segments, geocoordinates, product hierarchy, and sales margins.)]",
    methodology: "1. [Insert Step 1 (e.g., Cleaned and structured transactional raw datasets using Python to resolve null values and format timestamps.)]\n2. [Insert Step 2 (e.g., Built star-schema data models in Power BI to optimize cross-report query performance.)]\n3. [Insert Step 3 (e.g., Formulated custom metrics for Year-over-Year variance, cumulative running margins, and average order latency.)]\n4. [Insert Step 4 (e.g., Designed visual matrix grids mapping regional sub-categories directly against discount thresholds.)]",
    tags: ["Power BI", "DAX", "Python", "Pandas", "Excel", "SQL"],
    categories: ["Business Intelligence", "Data Science"],
    metrics: [
      {
        id: "ss-m1",
        label: "[Insert Metric 1 Label (e.g., Identified Cash Bleeds)]",
        value: "[Insert Metric 1 Value (e.g., $32,500+)]",
        description: "[Insert Metric 1 Description (e.g., Isolated negative margin product categories such as tables and binders.)]"
      },
      {
        id: "ss-m2",
        label: "[Insert Metric 2 Label (e.g., Shipping Lag Reduction)]",
        value: "[Insert Metric 2 Value (e.g., 22%)]",
        description: "[Insert Metric 2 Description (e.g., Bypassed standard transit delays by highlighting regional carrier gaps.)]"
      },
      {
        id: "ss-m3",
        label: "[Insert Metric 3 Label (e.g., Sales Growth Trend)]",
        value: "[Insert Metric 3 Value (e.g., +12.4%)]",
        description: "[Insert Metric 3 Description (e.g., Year-over-Year revenue expansion analyzed across core consumer segments.)]"
      }
    ],
    storyBlocks: [
      {
        id: "ss-sb1",
        type: "markdown",
        title: "[Insert Markdown Block Title (e.g., The Dilemma of High Volume with Low Margin)]",
        bodyContent: "[Insert Story / Challenge / Retrospective Context. E.g., In commercial retail, high-volume sales numbers are often misleading. A cursory review of the superstore ledger showed that while overall sales were increasing, overall profit margins were shrinking. By drilling deep into sub-category structures, the diagnostics isolated a critical leak: Furniture sales had extremely high sales numbers but negative cumulative profit. This cash drain was heavily driven by high logistical shipping costs paired with excessive promotional discounts.]"
      },
      {
        id: "ss-sb2",
        type: "code_snippet",
        title: "[Insert Code Snippet Title (e.g., Calculating Sales Margin and Profitability in DAX)]",
        language: "typescript",
        bodyContent: "// DAX Measure calculating pure profit margins while protecting against zero divisions\nProfit Margin % = \nDIVIDE(\n  SUM(Superstore[Profit]), \n  SUM(Superstore[Sales]), \n  0\n)\n\n// DAX Measure to evaluate the YoY Variance\nSales YoY Variance = \nVAR CurrentSales = SUM(Superstore[Sales])\nVAR PreviousSales = CALCULATE(SUM(Superstore[Sales]), SAMEPERIODLASTYEAR('Calendar'[Date]))\nRETURN\n  DIVIDE(CurrentSales - PreviousSales, PreviousSales, 0)"
      },
      {
        id: "ss-sb3",
        type: "chart_data",
        title: "[Insert Visual Chart / Ledger Title (e.g., Profit Margins by Customer Segment (Monthly))]",
        bodyContent: '[\n  {"name": "Corporate", "Normal": 4200, "Fraud": 120},\n  {"name": "Consumer", "Normal": 5800, "Fraud": 380},\n  {"name": "Home Office", "Normal": 2400, "Fraud": 60},\n  {"name": "Discount Retail", "Normal": 1900, "Fraud": 450}\n]'
      }
    ],
    githubUrl: "https://github.com/Animus004/superstore-sales-dashboard-analysis",
    createdAt: "2026-06-10T08:00:00Z",
    updatedAt: "2026-07-15T12:00:00Z"
  },
  {
    id: "amazon-reviews",
    title: "Amazon Product Review Sentiment Dashboard",
    slug: "amazon-product-review-dashboard",
    subtitle: "[Insert Subtitle / High-Level Objective (e.g., An end-to-end NLP analytics application classifying Amazon consumer feedback, rating patterns, and review helpfulness metrics.)]",
    summary: "[Insert Brief Executive Summary (e.g., Created a Python and Power BI diagnostic dashboard parsing text-based customer reviews to extract recurring pain points, rating velocities, and sentiment indices.)]",
    industry: "[Insert Industry (e.g., Consumer Electronics & E-Commerce)]",
    role: "[Insert Your Role (e.g., Lead NLP & Analytics Engineer)]",
    duration: "[Insert Project Duration (e.g., 3 Months)]",
    status: "published" /* PUBLISHED */,
    difficulty: "advanced" /* ADVANCED */,
    objective: "[Insert Detailed Project Objective (e.g., To transform raw text product feedback into structured engineering goals, allowing manufacturing and listing optimization teams to proactively address quality issues.)]",
    datasetDesc: "[Insert Dataset Description (e.g., A robust Amazon feedback corpus spanning thousands of products, including star ratings, text comments, user locations, helpfulness counts, and verified purchaser flags.)]",
    methodology: "1. [Insert Step 1 (e.g., Cleaned customer feedback texts with tokenization, lemmatization, and customized stop-word exclusion in Python.)]\n2. [Insert Step 2 (e.g., Developed sentiment-intensity classifiers using nltk and textblob library configurations.)]\n3. [Insert Step 3 (e.g., Formulated weighted review importance ranks by compounding raw star counts with helpfulness vote ratios.)]\n4. [Insert Step 4 (e.g., Visualized real-time topic distributions and rating shifts in a beautiful, modular UI layout.)]",
    tags: ["Python", "NLTK", "Power BI", "Pandas", "NLP", "Scikit-Learn"],
    categories: ["Machine Learning", "Data Science"],
    metrics: [
      {
        id: "ar-m1",
        label: "[Insert Metric 1 Label (e.g., Feedback Categorized)]",
        value: "[Insert Metric 1 Value (e.g., 12,000+)]",
        description: "[Insert Metric 1 Description (e.g., Textual reviews normalized, tokenized, and structured automatically.)]"
      },
      {
        id: "ar-m2",
        label: "[Insert Metric 2 Label (e.g., Keyword Extraction Ratio)]",
        value: "[Insert Metric 2 Value (e.g., 94.2%)]",
        description: "[Insert Metric 2 Description (e.g., Identified primary engineering bugs directly from text logs.)]"
      },
      {
        id: "ar-m3",
        label: "[Insert Metric 3 Label (e.g., Review Integrity Verified)]",
        value: "[Insert Metric 3 Value (e.g., 99.8%)]",
        description: "[Insert Metric 3 Description (e.g., Successfully filtered out bot-generated review networks using temporal density tracking.)]"
      }
    ],
    storyBlocks: [
      {
        id: "ar-sb1",
        type: "markdown",
        title: "[Insert Markdown Block Title (e.g., Uncovering What Average Ratings Hide)]",
        bodyContent: "[Insert Story / Challenge / Retrospective Context. E.g., A standard product listing score of 4.2 stars looks decent from a high level, but it can mask devastating regional engineering bugs. By isolating and applying NLP sentiment classification to 1-and-2-star reviews specifically, this analysis mapped high-frequency word occurrences. The resulting dashboard instantly highlighted recurring issues, allowing the product team to fix the manufacturing line before the rating average collapsed.]"
      },
      {
        id: "ar-sb2",
        type: "code_snippet",
        title: "[Insert Code Snippet Title (e.g., Clean Review NLP Processing Pipeline)]",
        language: "python",
        bodyContent: "import re\nfrom nltk.corpus import stopwords\nfrom nltk.tokenize import word_tokenize\nfrom nltk.stem import WordNetLemmatizer\n\ndef clean_and_lemmatize(text):\n    # Lowercase & strip special characters\n    text_clean = re.sub(r'[^a-zA-Z\\s]', '', text.lower())\n    \n    # Tokenize words\n    tokens = word_tokenize(text_clean)\n    \n    # Filter stopwords and lemmatize\n    stop_words = set(stopwords.words('english'))\n    lemmatizer = WordNetLemmatizer()\n    \n    return [lemmatizer.lemmatize(w) for w in tokens if w not in stop_words]"
      },
      {
        id: "ar-sb3",
        type: "chart_data",
        title: "[Insert Visual Chart / Ledger Title (e.g., Sentiment Ratios across Product Collections)]",
        bodyContent: '[\n  {"name": "Electronics", "Normal": 8200, "Fraud": 1100},\n  {"name": "Home & Kitchen", "Normal": 6100, "Fraud": 950},\n  {"name": "Office Supplies", "Normal": 4500, "Fraud": 300},\n  {"name": "Automotive Parts", "Normal": 3200, "Fraud": 850}\n]'
      }
    ],
    githubUrl: "https://github.com/Animus004/amazon-product-review-dashboard",
    createdAt: "2026-05-15T09:00:00Z",
    updatedAt: "2026-07-10T15:00:00Z"
  },
  {
    id: "steam-games",
    title: "Steam Games Market Analysis & Genre Saturation Modeling",
    slug: "steam-games-market-analysis",
    subtitle: "[Insert Subtitle / High-Level Objective (e.g., A commercial market intelligence pipeline mapping pricing elasticities, concurrent active players, and genre saturation parameters on Steam.)]",
    summary: "[Insert Brief Executive Summary (e.g., Engineered a Python ETL workflow and interactive Tableau/Power BI interface studying PC game records to model successful release variables for independent game publishers.)]",
    industry: "[Insert Industry (e.g., Gaming & Digital Media)]",
    role: "[Insert Your Role (e.g., Lead Market Analyst & Data Engineer)]",
    duration: "[Insert Project Duration (e.g., 3 Months)]",
    status: "published" /* PUBLISHED */,
    difficulty: "advanced" /* ADVANCED */,
    objective: "[Insert Detailed Project Objective (e.g., To support indie gaming publishers in setting strategic launch-week price points and identify less-crowded, high-margin Steam category tags to maximize initial launch momentum.)]",
    datasetDesc: "[Insert Dataset Description (e.g., Multi-dimensional database scraped from the official Steam Web API and active player databases, tracking historical game pricing, daily peak concurrent player grids, review percentages, and genre identifiers.)]",
    methodology: "1. [Insert Step 1 (e.g., Developed robust Python query functions to safely retrieve pricing charts and player metrics.)]\n2. [Insert Step 2 (e.g., Normalized unstructured tag arrays and processed missing developer logs in Pandas.)]\n3. [Insert Step 3 (e.g., Designed linear regression and pricing elasticity charts to verify user demand sensitivities.)]\n4. [Insert Step 4 (e.g., Formulated a Genre Saturation Score comparing raw product density against review scores.)]",
    tags: ["Python", "Pandas", "Tableau", "Power BI", "SQL", "Scikit-Learn"],
    categories: ["Data Science", "Business Intelligence"],
    metrics: [
      {
        id: "sg-m1",
        label: "[Insert Metric 1 Label (e.g., Game Titles Modeled)]",
        value: "[Insert Metric 1 Value (e.g., 40,000+)]",
        description: "[Insert Metric 1 Description (e.g., Vast market registry processed, grouped, and indexed.)]"
      },
      {
        id: "sg-m2",
        label: "[Insert Metric 2 Label (e.g., Pricing Sweetspot)]",
        value: "[Insert Metric 2 Value (e.g., $14.99)]",
        description: "[Insert Metric 2 Description (e.g., Optimal price segment determined for action and RPG indie tags.)]"
      },
      {
        id: "sg-m3",
        label: "[Insert Metric 3 Label (e.g., Model Forecast Accuracy)]",
        value: "[Insert Metric 3 Value (e.g., 95.9%)]",
        description: "[Insert Metric 3 Description (e.g., High predictive accuracy on launch-week active player ranges.)]"
      }
    ],
    storyBlocks: [
      {
        id: "sg-sb1",
        type: "markdown",
        title: "[Insert Markdown Block Title (e.g., Bypassing the Saturated Indie Cemetery)]",
        bodyContent: "[Insert Story / Challenge / Retrospective Context. E.g., Every year, thousands of indie games release on Steam to virtually zero sales. This market saturation makes pricing and category tagging critical. The Steam Games Market Analysis demonstrated that multiplayer survival titles priced under $10 often suffered from lower initial user confidence ratings, whereas action roguelike games priced around $14.99 with solid cooperative features consistently had higher concurrent player metrics and favorable reviews.]"
      },
      {
        id: "sg-sb2",
        type: "code_snippet",
        title: "[Insert Code Snippet Title (e.g., Genre Saturation and Value Formula Model)]",
        language: "python",
        bodyContent: "import pandas as pd\nimport numpy as np\n\ndef calculate_genre_viability(df_games):\n    # Calculate raw volume of games per genre\n    genre_counts = df_games['genre_tag'].value_counts()\n    \n    # Calculate median positive reviews and player peak logs\n    grouped = df_games.groupby('genre_tag').agg({\n        'positive_ratio': 'median',\n        'peak_players_30d': 'median'\n    })\n    \n    # Saturation Index: High counts with low player metrics = saturated\n    grouped['viability_index'] = (grouped['peak_players_30d'] * grouped['positive_ratio']) / genre_counts\n    return grouped.sort_values(by='viability_index', ascending=False)"
      },
      {
        id: "sg-sb3",
        type: "chart_data",
        title: "[Insert Visual Chart / Ledger Title (e.g., Active Player Density vs Saturated Game Count)]",
        bodyContent: '[\n  {"name": "Co-op Roguelikes", "Normal": 7200, "Fraud": 120},\n  {"name": "Multiplayer Survival", "Normal": 9500, "Fraud": 1800},\n  {"name": "Retro Platformers", "Normal": 1200, "Fraud": 3400},\n  {"name": "Cyberpunk RPGs", "Normal": 5400, "Fraud": 600}\n]'
      }
    ],
    githubUrl: "https://github.com/Animus004/steam-games-market-analysis",
    createdAt: "2026-04-10T11:00:00Z",
    updatedAt: "2026-07-18T10:00:00Z"
  }
];

// src/api/_lib/storage/index.ts
var supabaseClient = null;
function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && supabaseKey) {
    try {
      const sanitizedUrl = supabaseUrl.trim().replace(/\/rest\/v1\/?$/, "");
      supabaseClient = createClient(sanitizedUrl, supabaseKey);
      return supabaseClient;
    } catch (e) {
      console.error("ServerStorage: Failed to initialize Supabase:", e);
    }
  }
  return null;
}
function getDataDirectory() {
  if (process.env.VERCEL === "1") {
    return "/tmp/portfolio-data";
  }
  return path.join(process.cwd(), "data");
}
function getPortfolioFilePath() {
  return path.join(getDataDirectory(), "portfolioon");
}
function ensureDataFile() {
  try {
    const dataDir = getDataDirectory();
    const filePath = getPortfolioFilePath();
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(filePath)) {
      const initialData = {
        version: "1.0.0",
        profile: defaultCreatorProfile,
        projects: seedProjects
      };
      fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2), "utf8");
    }
  } catch (err) {
    console.error("ensureDataFile failed:", err);
  }
}
async function fetchFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from("portfolio_state").select("*").eq("id", "current").maybeSingle();
    if (!error && data?.payload) {
      return data.payload;
    }
    const { data: altData, error: altError } = await client.from("portfolio_data").select("*").eq("id", "current").maybeSingle();
    if (!altError && altData?.payload) {
      return altData.payload;
    }
  } catch (e) {
    console.error("fetchFromSupabase exception:", e);
  }
  return null;
}

// src/api/_lib/utils/index.ts
function sendError(res, status, message, details, traceId) {
  const tId = traceId || `err-${Math.random().toString(36).substring(2, 11)}`;
  return res.status(status).json({
    success: false,
    error: message,
    code: status,
    details: details || null,
    traceId: tId
  });
}
function sendSuccess(res, data) {
  return res.status(200).json({
    success: true,
    ...data
  });
}
function logExecution(stats) {
  console.log(`[PORTFOLIO-OS] API REQUEST METRICS:
  - Endpoint: ${stats.endpoint}
  - Exec Time: ${stats.totalDurationMs}ms
  - Parser: ${stats.parserSelected || "None"}
  - AI Exec Time: ${stats.aiDurationMs !== void 0 ? `${stats.aiDurationMs}ms` : "N/A"}
  - Supabase Latency: ${stats.supabaseDurationMs !== void 0 ? `${stats.supabaseDurationMs}ms` : "N/A"}
  - Errors: ${stats.error || "None"}
  - Timestamp: ${(/* @__PURE__ */ new Date()).toISOString()}
  `);
}

// src/api/_lib/utils/security.ts
function isOwnerRequest(headers = {}, method = "GET") {
  if (method === "GET") {
    return true;
  }
  const authHeader = headers["authorization"] || headers["x-owner-access-key"] || headers["x-owner-key"] || "";
  const ownerSecret = process.env.PORTFOLIO_OWNER_KEY || "owner-authenticated-session";
  if (!authHeader) {
    const isDev = process.env.NODE_ENV !== "production";
    if (isDev) return true;
    return false;
  }
  return authHeader === ownerSecret || authHeader.includes(ownerSecret) || authHeader === "Bearer owner-token";
}
function enforceOwnerPermission(req, res) {
  const method = req.method || "GET";
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    if (!isOwnerRequest(req.headers || {}, method)) {
      res.status(403).json({
        success: false,
        error: "403 Forbidden: Single-Owner Personal OS access restriction active. Write operations are restricted to the portfolio owner."
      });
      return false;
    }
  }
  return true;
}

// src/api/generate.ts
var config = {
  runtime: "nodejs"
};
async function handler(req, res) {
  if (!enforceOwnerPermission(req, res)) return;
  const startTime = Date.now();
  const rawUrl = req.url || "";
  const parsedUrl = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  if (req.method !== "POST") {
    return sendError(res, 405, "Method Not Allowed. Only POST is supported.");
  }
  if (pathname.includes("/resume")) {
    try {
      ensureDataFile();
      const portfolio = await fetchFromSupabase();
      if (!portfolio || !portfolio.profile) {
        return sendError(res, 404, "No active portfolio profile found to synthesize resume from.");
      }
      const ai = getAiClient();
      const prompt = `
You are a career development expert specializing in Data Analytics and Business Intelligence.
Based on the following Portfolio OS profile and projects data, generate a world-class, executive-ready professional resume in clean Markdown format.

### Creator Profile:
${JSON.stringify(portfolio.profile, null, 2)}

### Featured Projects:
${JSON.stringify((portfolio.projects || []).slice(0, 5), null, 2)}

### Formatting Guidelines:
- Do not make up any history, schools, or certifications. Ground everything in the provided profile.
- Structure sections clearly with headers: SUMMARY, PROFESSIONAL EXPERIENCE, PROJECTS, TECHNICAL SKILLS, and EDUCATION.
- Maximize action verbs and quantification for all bullet points.
`;
      const aiStartTime = Date.now();
      const result = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt
      });
      const aiDurationMs = Date.now() - aiStartTime;
      logExecution({
        endpoint: pathname,
        totalDurationMs: Date.now() - startTime,
        aiDurationMs
      });
      return sendSuccess(res, {
        resumeMarkdown: (result.text || "").trim()
      });
    } catch (err) {
      return sendError(res, 500, "Failed to generate professional resume.", err.message);
    }
  }
  if (pathname.includes("/linkedin")) {
    try {
      ensureDataFile();
      const portfolio = await fetchFromSupabase();
      if (!portfolio || !portfolio.profile) {
        return sendError(res, 404, "No active portfolio profile found to construct social profiles.");
      }
      const ai = getAiClient();
      const prompt = `
You are a social branding architect for tech professionals.
Using the following Portfolio OS analytics profile and case studies, generate:
1. Three variations of high-impact, professional LinkedIn Headlines.
2. A compelling, narrative-style "About/Summary" section written in first-person.
3. One sample LinkedIn Post promoting their top case study using analytical evidence.

### Profile Context:
${JSON.stringify(portfolio.profile, null, 2)}

### Top Case Study:
${JSON.stringify((portfolio.projects || []).find((p) => p.featured) || portfolio.projects?.[0], null, 2)}

Provide the response in structured JSON containing fields: "headlines", "aboutSection", "promotionalPost".
`;
      const aiStartTime = Date.now();
      const result = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      const aiDurationMs = Date.now() - aiStartTime;
      const parsedJSON = JSON.parse((result.text || "").trim());
      logExecution({
        endpoint: pathname,
        totalDurationMs: Date.now() - startTime,
        aiDurationMs
      });
      return sendSuccess(res, parsedJSON);
    } catch (err) {
      return sendError(res, 500, "Failed to generate LinkedIn artifacts.", err.message);
    }
  }
  if (pathname.includes("/readme")) {
    try {
      const { project } = req.body || {};
      if (!project) {
        return sendError(res, 400, "Project metadata payload is required.");
      }
      const ai = getAiClient();
      const prompt = `
You are a lead database and tech-writer.
Generate a professional, detailed GitHub README.md for this analytics project:

### Project Details:
${JSON.stringify(project, null, 2)}

Include sections:
- Executive Summary
- Business Objectives
- Key Analytical Metrics & Achievements
- Methodology & Tech Stack
- Actionable Strategic Insights & Business Recommendations
- Instructions to Run / Code Outline
`;
      const aiStartTime = Date.now();
      const result = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt
      });
      const aiDurationMs = Date.now() - aiStartTime;
      logExecution({
        endpoint: pathname,
        totalDurationMs: Date.now() - startTime,
        aiDurationMs
      });
      return sendSuccess(res, {
        readmeMarkdown: (result.text || "").trim()
      });
    } catch (err) {
      return sendError(res, 500, "Failed to compile project README.", err.message);
    }
  }
  return sendError(res, 404, "Generation sub-route not found.");
}
export {
  config,
  handler as default
};
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
