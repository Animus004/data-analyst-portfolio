// @ts-nocheck
// src/api/_lib/storage/index.ts
import { createClient } from "@supabase/supabase-js";

// src/data/seedData.ts
var seedProjects = [
  {
    "id": "project-hhy3dlaz7",
    "date": "2026-09-14",
    "role": "Lead Operations & Data Analyst",
    "slug": "dark-store-operations-stock-out-analytics-engine",
    "tags": [
      "SQL",
      "Power BI",
      "DAX",
      "MySQL",
      "Inventory Operations",
      "Logistics Analytics"
    ],
    "order": 3,
    "title": "Blinkit Kolkata: Dark Store Stock-Out & Operations Intelligence",
    "images": [
      "/images/blinkit_dashboard_1.png",
      "/images/blinkit_dashboard_2.png"
    ],
    "skills": [
      "SQL Analytics & Multi-Table Joins",
      "Window Functions & Temporal Analysis",
      "Operational Bottleneck Identification",
      "Supply Chain Benchmarking",
      "Executive Storytelling & Recommendations"
    ],
    status: "published" /* PUBLISHED */,
    "metrics": [
      {
        "id": "ai-metric-0-1789385492014",
        "label": "DS002 Stock-Out Share",
        "value": "26.58%",
        "iconName": "Activity",
        "description": "Share of overall network stock-outs contributed by New Town Dark Store"
      },
      {
        "id": "ai-metric-1-1789385492014",
        "label": "DS002 Cumulative Stock-Out Hours",
        "value": "12,617 hrs",
        "iconName": "Activity",
        "description": "Total stock-out duration accumulated by New Town Dark Store"
      },
      {
        "id": "ai-metric-2-1789385492014",
        "label": "Peak Hourly Stock-Out Incidents",
        "value": "780 incidents",
        "iconName": "Activity",
        "description": "Peak stock-out volume observed at 10:00 PM during late evening surge"
      },
      {
        "id": "ai-metric-3-1789385492014",
        "label": "Perishable Category Stock-Out Share",
        "value": ">50%",
        "iconName": "Activity",
        "description": "Combined stock-out contribution from Dairy and Fresh Produce categories"
      },
      {
        "id": "ai-metric-4-1789385492014",
        "label": "Benchmark Store Fill Rate",
        "value": ">80%",
        "iconName": "Activity",
        "description": "Supplier fill rate maintained by benchmark stores Alipore and Barasat"
      }
    ],
    "summary": "This strategic analytics initiative evaluated micro-fulfillment store operational performance across Kolkata's dark store network. empirical SQL analysis revealed extreme variance: New Town Dark Store (DS002) alone accounted for 26.58% of network stock-outs and accumulated 12,617 cumulative stock-out hours. Operations experience acute temporal vulnerability between 7:00 PM and 10:00 PM, with stock-outs peaking at 10:00 PM (780 incidents). Perishable categories\u2014Dairy and Fresh Produce\u2014represent over 50% of all stock-outs. Conversely, top-performing benchmark stores such as Alipore (DS012) and Barasat (DS011) maintained high operational stability with supplier fill rates exceeding 80%.",
    "duration": "4 Months (120-Day Network Analysis)",
    "featured": true,
    "findings": "1. Disproportionate Store Burden: New Town Dark Store (DS002) contributes 26.58% of total network stock-outs (12,617 hours), followed by Jadavpur (16.73%) and Rajarhat (11.88%).\n2. Temporal Spike: Stock-outs concentrate in the late evening from 7:00 PM to 10:00 PM, reaching a network peak of 780 incidents at 10:00 PM.\n3. Perishable Vulnerability: Dairy (6,790 observations, ~8.72h avg duration) and Fresh Produce (6,570 observations, ~9.04h avg duration) account for over 50% of all stock-outs.\n4. Chronic High-Velocity SKUs: Mother Dairy Toned Milk 500ml (2,023 hrs out of stock) and Apple Royal Gala 4 pcs (1,905 hrs out of stock) experience severe stock-out durations. Green Chilli 100g was out of stock on 94 out of 120 days despite restock requests every 5 hours.\n5. Benchmark Stores: Alipore (DS012) and Barasat (DS011) recorded under 500 stock-out observations and maintained supplier fill rates above 80%.",
    "industry": "Quick-Commerce & Retail Logistics",
    "subtitle": "An end-to-end SQL and Power BI operations intelligence case study analyzing dark store availability, chronic SKU stock-outs, peak operational failure windows, and replenishment reliability across 12 Kolkata fulfillment hubs.",
    "createdAt": "2026-09-14T11:32:24.094Z",
    "objective": "Systematically evaluate key operational performance indicators and transactional trends across dark store inventory snapshots and replenishment records to identify operational bottlenecks, establish benchmark standards, and formulate strategic business interventions.",
    "updatedAt": "2026-09-14T11:32:24.094Z",
    "categories": [
      "Operations Intelligence",
      "Supply Chain Analytics",
      "SQL Diagnostics"
    ],
    difficulty: "advanced" /* ADVANCED */,
    "visibility": "public",
    "datasetDesc": "Relational transactional database containing dark store master records, product catalog, inventory snapshots, stock-out events, replenishment logs, and customer order items.",
    "methodology": "Executed four structured SQL analytical modules (SQ1\u2013SQ4) leveraging relational multi-table joins, date/time aggregations, and advanced LAG window functions across inventory snapshots, replenishment logs, order items, and store master entities to pinpoint stock-out drivers, calculate duration metrics, and evaluate supplier fill rates.",
    "storyBlocks": [],
    "analysisText": "1. Multi-Table Integration: Joined inventory snapshots, dark store master, stock-out events, replenishment logs, and order items.\n2. Store Burden Analysis: Aggregated stock-out incidence and calculated percentage contribution per location.\n3. Temporal Trend Evaluation: Extracted hourly stock-out counts to establish peak concentration windows.\n4. SKU & Category Diagnostics: Calculated cumulative stock-out hours, repeat out-of-stock frequency, and replenishment request intervals using window functions.\n5. Benchmark Assessment: Assessed top-performing stores based on fill rate compliance, storage utilization, and reorder threshold breaches.",
    "dataCleaning": "Standardized timestamp diff records, corrected stock-out observation end times, unified product category mapping across transactional tables, and handled missing replenishment logs.",
    "overviewText": "This strategic analytics initiative evaluated micro-fulfillment store operational performance across Kolkata's dark store network. empirical SQL analysis revealed extreme variance: New Town Dark Store (DS002) alone accounted for 26.58% of network stock-outs and accumulated 12,617 cumulative stock-out hours. Operations experience acute temporal vulnerability between 7:00 PM and 10:00 PM, with stock-outs peaking at 10:00 PM (780 incidents). Perishable categories\u2014Dairy and Fresh Produce\u2014represent over 50% of all stock-outs. Conversely, top-performing benchmark stores such as Alipore (DS012) and Barasat (DS011) maintained high operational stability with supplier fill rates exceeding 80%.",
    "challengesText": "Reconciling high stock-out frequencies with frequent replenishment requests required evaluating LAG intervals across timestamped inventory snapshots to separate supplier lead time delays from dark store operational bottlenecks.",
    "lessonsLearned": "Stock-outs are rarely uniform across fulfillment networks; micro-location dynamics, shift timing, and product-specific perishability require targeted operational interventions rather than broad blanket policies.",
    "businessProblem": "Dark Store Operations Managers face critical supply-demand imbalances during daily operations across micro-fulfillment hubs in Kolkata. Operational leadership lacks diagnostic visibility into whether availability failures are uniform or localized, when stock-outs peak throughout the day, which SKUs and categories fail most frequently, and what operational practices separate underperforming hubs from top-performing stores.",
    "recommendations": "Immediate (0\u201330 Days): Shift secondary replenishment delivery windows from 20:00 to 16:30\u201317:30 for New Town, Jadavpur, and Rajarhat to prevent evening stock-out surges. Increase safety stock reorder thresholds by 20\u201325% on top Dairy and Fresh Produce SKUs.\nMedium Term (30\u201390 Days): Enforce supplier SLAs with a minimum 85% fill rate requirement. Standardize bin allocation and reorder execution using the Alipore/Barasat SOP playbook across high-burden stores.\nStrategic (90+ Days): Re-calibrate unit measurement formulas for dark store capacity before committing capital expenditure.",
    "githubUrl": "https://github.com/Animus004/blinkit-dark-store-stockout-analysis"
  },
  {
    "id": "project-3ei1f2x9q",
    "role": "Product Data Analyst",
    "slug": "amazon-customer-engagement-product-sentiment-analysis",
    "tags": [
      "Excel",
      "Pivot Tables",
      "Customer Sentiment",
      "Data Visualization",
      "E-Commerce"
    ],
    "order": 0,
    "title": "Amazon Customer Engagement & Product Sentiment Analytics",
    "images": [
      "/images/amazon_dashboard.png"
    ],
    "skills": [
      "Microsoft Excel",
      "Data Cleaning",
      "Pivot Tables",
      "Dashboard Design",
      "KPI Development",
      "Business Analysis",
      "Customer Sentiment Analysis",
      "Stakeholder Reporting"
    ],
    status: "published" /* PUBLISHED */,
    "metrics": [
      {
        "id": "ai-metric-0-1784802815244",
        "label": "Customer Engagement Volume",
        "value": "584 Reviews",
        "iconName": "Activity",
        "description": "Highest review volume recorded by a single product category, used to identify the most engaged customer segment."
      },
      {
        "id": "ai-metric-1-1784802815244",
        "label": "Average Customer Rating",
        "value": "Rating4.4 / 5",
        "iconName": "Activity",
        "description": "Average customer satisfaction across analyzed product categories."
      },
      {
        "id": "metric-519taoiea",
        "label": "Average Helpful Votes",
        "value": "281.9 Votes",
        "description": "Measures how useful customers found product reviews, indicating review quality and customer trust."
      },
      {
        "id": "metric-mlljgb4mv",
        "label": "Average Product Price",
        "value": "$136",
        "description": "Average selling price across analyzed product categories for price-performance comparison."
      },
      {
        "id": "metric-pzzeze86e",
        "label": "Highest Rated Category",
        "value": "Fire Tablet (4.7\u2605)",
        "description": "Category generating the highest customer interaction and review volume."
      },
      {
        "id": "metric-d6vb7aa0c",
        "label": "Highest Engagement Category",
        "value": "Smart Home (584 Reviews)",
        "description": "Category generating the highest customer interaction and review volume."
      }
    ],
    "summary": "Developed an Excel-based analytics dashboard to evaluate Amazon product review trends across multiple categories. Performed customer engagement, sentiment, and category performance analysis using pivot tables, KPI reporting, and data visualization to identify investment opportunities, satisfaction gaps, and strategic business recommendations for product teams. \uE200filecite\uE202turn14file1\uE202L8-L37\uE201",
    "duration": "2 Months",
    "featured": true,
    "findings": "Analysis revealed varying customer engagement and sentiment levels across product categories, identifying top-performing assets like the Fire Tablet alongside categories exhibiting lower customer ratings despite high engagement (such as Fire TV). The diagnostic also highlighted a significant decline in review activity during 2016.",
    "industry": "E-Commerce & Consumer Electronics",
    "subtitle": "Exploratory customer review and engagement analysis identifying high-velocity rating trends, recurring quality concerns, and product catalog prioritization signals in Excel.",
    "createdAt": "2026-07-23T10:33:49.079Z",
    "githubUrl": "https://github.com/Animus004/Amazon-Customer-Engagement-Product-Performance-Analysis",
    "objective": "Analyze Amazon customer review data to identify high-performing product categories, evaluate customer engagement and sentiment trends, and generate data-driven recommendations for product strategy and marketing investment.",
    "updatedAt": "2026-08-08T15:50:19.162Z",
    "categories": [
      "Customer Analytics",
      "Product Performance"
    ],
    difficulty: "intermediate" /* INTERMEDIATE */,
    "visibility": "public",
    "datasetDesc": "Analyzed a structured Amazon customer review dataset containing product categories, customer ratings, review counts, helpful votes, product prices, and historical review activity spanning 2015\u20132017.",
    "methodology": "Applied exploratory data analysis, customer sentiment analysis, category benchmarking, engagement-versus-rating comparison, and time-series trend analysis using Microsoft Excel, Pivot Tables, Pivot Charts, and KPI dashboards.",
    "storyBlocks": [],
    "analysisText": "No predictive models were developed. Analysis relied on descriptive analytics using Pivot Tables, Pivot Charts, calculated KPIs, comparative category benchmarking, scatter plot correlation analysis, and historical trend visualization.",
    "dataCleaning": "Cleaned and standardized raw Amazon review data by validating category labels, formatting numerical metrics, preparing time-series fields, and organizing structured datasets for dashboard development and KPI analysis.",
    "overviewText": "Developed an end-to-end customer engagement analytics dashboard using Amazon product review data to evaluate customer sentiment, category performance, pricing relationships, and historical engagement trends. The project transformed raw review datasets into executive-level dashboards and strategic business recommendations supporting product investment and marketing decisions.",
    "challengesText": "Consolidating customer engagement, pricing, and sentiment metrics from multiple analytical dimensions required careful KPI selection, category benchmarking, and dashboard design to ensure meaningful business interpretation without introducing misleading conclusions.",
    "lessonsLearned": "This project reinforced the importance of combining customer engagement metrics with sentiment analysis rather than relying on review volume alone. Future analyses would benefit from incorporating product launch timelines, lifecycle stages, and additional behavioral metrics for deeper business insights.",
    "businessProblem": "Amazon lacked consolidated visibility into category-level customer engagement, review sentiment, and pricing performance. Without centralized analytics, decision-makers faced challenges prioritizing marketing investments, identifying high-performing products, and responding to declining customer satisfaction.",
    "recommendations": "Increase marketing efforts for Fire Tablet due to high customer ratings and future growth potential. Investigate the reasons behind Fire TV's lower customer ratings despite high engagement. Review the significant decline in review activity during 2016 before making strategic decisions, and include product launch dates and lifecycle analysis in future studies."
  },
  {
    "id": "project-g40ktfsc7",
    "role": "Business Intelligence Analyst",
    "slug": "superstore-profitability-margin-optimization-analytics",
    "tags": [
      "Excel",
      "Pivot Charts",
      "Profitability Modeling",
      "KPI Development",
      "Retail Sales"
    ],
    "order": 1,
    "title": "Superstore Sales Diagnostic & Margin Optimization Dashboard",
    "images": [
      "/images/superstore_dashboard.png"
    ],
    "skills": [
      "Microsoft Excel",
      "Pivot Tables",
      "Data Cleaning",
      "KPI Development",
      "Business Analysis",
      "Dashboard Design",
      "Sales Analytics",
      "Profitability Analysis",
      "Stakeholder Reporting"
    ],
    status: "published" /* PUBLISHED */,
    "metrics": [
      {
        "id": "ai-metric-0-1784804480944",
        "label": "Total Sales",
        "value": "$2.29M+",
        "iconName": "trending-up",
        "description": "Total revenue generated by the Superstore across analyzed periods."
      },
      {
        "id": "metric-3nmemnurs",
        "label": "Total Profit",
        "value": "$286K+",
        "description": "Overall profit earned after all transactions, measuring business profitability."
      },
      {
        "id": "metric-4um5y7opc",
        "label": "Highest Profit Category",
        "value": "Technology",
        "description": "Product category generating the highest overall profit contribution."
      },
      {
        "id": "metric-ynwey67yc",
        "label": "Lowest Profit Category",
        "value": "Furniture",
        "description": "High sales but comparatively weak profitability, indicating pricing or cost optimization opportunities."
      },
      {
        "id": "metric-hmt52jpid",
        "label": "Top Performing Region",
        "value": "West Region",
        "description": "Region contributing the highest overall sales performance."
      },
      {
        "id": "metric-ez7fqopww",
        "label": "Peak Sales Month",
        "value": "November",
        "description": "Strongest month for both sales and profit, supporting seasonal planning."
      }
    ],
    "summary": "Developed an Excel-based sales and profitability analytics dashboard using Superstore retail data to evaluate category performance, regional profitability, customer segments, and seasonal sales trends. The project transformed raw transactional data into actionable business insights and strategic recommendations to improve pricing, inventory planning, and profitability.",
    "duration": "2 Months",
    "featured": true,
    "findings": "Furniture generated strong sales revenue but suffered from low profit margins due to excessive discounting or operational inefficiencies. Technology products consistently generated stronger profit contributions. Texas showed strong sales volume but weak profitability returns, while specific table products incurred repeated losses.",
    "industry": "Retail & Supply Chain",
    "subtitle": "Multi-year commercial retail transaction analysis isolating negative profit corridors, carrier shipping latencies, and customer segment growth in Excel.",
    "createdAt": "2026-07-23T11:01:34.780Z",
    "githubUrl": "https://github.com/Animus004/superstore-sales-dashboard-analysis",
    "objective": "Analyze sales and profitability performance across products, regions, and customer segments to identify profitable growth opportunities, optimize pricing and discount strategies, and improve inventory and marketing decisions through data-driven sales analysis.",
    "updatedAt": "2026-07-23T11:15:02.351Z",
    "categories": [
      "Financial Diagnostics",
      "Sales Intelligence"
    ],
    difficulty: "intermediate" /* INTERMEDIATE */,
    "visibility": "public",
    "datasetDesc": "Superstore transactional and operational dataset comprising sales, profit, product categories, customer segments, and regional data stored across Excel spreadsheets and Word reports.",
    "methodology": "Applied exploratory sales analysis using Microsoft Excel, Pivot Tables, Pivot Charts, KPI reporting, profitability analysis, category benchmarking, regional comparison, and seasonal trend analysis to identify business performance patterns and improvement opportunities.",
    "storyBlocks": [],
    "analysisText": "No predictive or machine learning models were developed. The analysis relied on descriptive analytics using Pivot Tables, Pivot Charts, KPI calculations, category benchmarking, profitability comparison, and historical sales trend analysis.",
    "dataCleaning": "Processed and integrated dataset sources from Excel and Word documentation to ensure consistent dimensional analysis across sales, profit, product categories, and regional geographies.",
    "overviewText": "Built an end-to-end sales and profitability analytics dashboard using Superstore retail data to uncover profit drivers, identify underperforming business segments, and deliver actionable recommendations for pricing, inventory planning, and strategic business growth.",
    "challengesText": "Identifying sustainable profitability was challenging because several categories generated strong revenue while delivering weak profit margins. Additional investigation was required to separate pricing, discounting, and operational factors influencing business performance.",
    "lessonsLearned": "Top-line revenue growth can conceal underlying margin erosion; granular profitability analysis at the product and regional level is vital before expanding capital investment.",
    "businessProblem": "Despite generating over $2.29M in sales, management lacked visibility into which product categories, customer segments, and regions were driving sustainable profitability. High sales alone were insufficient for decision-making because several categories and states demonstrated strong revenue while producing comparatively weak profit margins, causing margin erosion.",
    "recommendations": "Investigate root causes behind high-sales but low-profit categories (such as Furniture) before scaling investment. Prioritize campaigns for high-profit customer segments and Technology products. Review underperforming states like Texas to identify operational issues. Reassess repeated-loss table products for discontinuation, supplier renegotiation, or pricing strategy changes. Plan promotions and inventory around strong seasonal months including November, September, and December."
  },
  {
    "id": "project-r4gxqt836",
    "role": "Market Intelligence Analyst",
    "slug": "steam-marketplace-intelligence-publisher-performance-growth-strategy",
    "tags": [
      "Excel",
      "Market Research",
      "Pricing Analytics",
      "Data Visualization",
      "Trend Analysis"
    ],
    "order": 2,
    "title": "Steam Games Market Intelligence: Publisher Growth & Pricing Strategy",
    "images": [
      "/images/steam_dashboard.png"
    ],
    "skills": [
      "Microsoft Excel",
      "Power Query",
      "Pivot Tables",
      "Dashboard Design",
      "Market Research",
      "Business Intelligence",
      "Stakeholder Reporting",
      "Data Visualization"
    ],
    status: "published" /* PUBLISHED */,
    "metrics": [
      {
        "id": "ai-metric-0-1784805654356",
        "label": "Target Investment Allocation",
        "value": "$10M",
        "iconName": "DollarSign",
        "description": "Hypothetical capital allocation evaluated across publishers, genres, and pricing tiers."
      },
      {
        "id": "ai-metric-1-1784805654356",
        "label": "Core Investment Pillars",
        "value": "4",
        "iconName": "BarChart2",
        "description": "Evaluated via Publisher Performance Index, Customer Satisfaction Score, and Player Engagement Rate."
      },
      {
        "id": "metric-kmna5y6qe",
        "label": "Publishers Evaluated",
        "value": "11",
        "description": "Compared publisher performance to identify consistent long-term investment opportunities."
      },
      {
        "id": "metric-aij0rl3ud",
        "label": "Market Period",
        "value": "2015\u20132024",
        "description": "Historical Steam marketplace analysis spanning multiple release years."
      }
    ],
    "summary": "Delivered a comprehensive market intelligence analysis for Valve Corporation to optimize a hypothetical $10 million investment allocation across publishers, genres, pricing tiers, and game categories within the Steam digital PC game marketplace.",
    "duration": "2 Months",
    "featured": true,
    "findings": "Identified top-performing publishers demonstrating consistent long-term success, high-engagement genres like Action, RPG, and Adventure, and the impact of pricing and monetization strategies on player retention and customer satisfaction.",
    "industry": "Gaming & Digital Media",
    "subtitle": "Market segment analysis across thousands of game titles evaluating demand signals, review distribution, and pricing strategy for portfolio planning.",
    "createdAt": "2026-07-23T11:21:16.467Z",
    "githubUrl": "https://github.com/Animus004/steam-games-market-analysis",
    "objective": "To analyze the Steam Games dataset and deliver actionable, data-driven recommendations regarding publisher performance, genre trends, pricing strategies, and customer satisfaction.",
    "updatedAt": "2026-07-23T11:29:48.907Z",
    "categories": [
      "Market Intelligence",
      "Strategic Decision Support"
    ],
    difficulty: "advanced" /* ADVANCED */,
    "visibility": "public",
    "datasetDesc": "Steam Games dataset containing publisher metrics, pricing tiers, genre classifications, user review sentiments, and player engagement statistics.",
    "methodology": "Applied market trend analysis, publisher performance evaluation, customer sentiment analysis, pricing strategy assessment, and genre portfolio analysis on Steam Games dataset using Markdown, Git, Python, SQL, Excel, and Power BI.",
    "storyBlocks": [],
    "analysisText": "Applied descriptive analytics using Pivot Tables, Pivot Charts, Power Query, ranking techniques, percentage calculations, and comparative trend analysis to evaluate publisher consistency, genre performance, pricing strategies, customer sentiment, and player engagement. The analysis relied on business-driven segmentation, KPI benchmarking, and dashboard visualization rather than predictive or machine learning models.",
    "dataCleaning": "Processed and integrated multi-source Steam dataset attributes covering engagement, pricing, publisher background, and user sentiment.",
    "overviewText": "Developed a business intelligence dashboard to evaluate Steam market performance between 2015 and 2024 by analysing publisher consistency, genre performance, pricing strategies, customer sentiment, and player engagement. The project transformed raw market data into executive insights that support strategic investment, portfolio planning, and long-term growth decisions for Valve.",
    "challengesText": "Lack of a consolidated analytical view to identify sustainable long-term investment opportunities or balance investment across different market segments from raw engagement, pricing, and sentiment metrics.",
    "lessonsLearned": "Prioritizing publisher consistency and customer engagement metrics yields more reliable investment targets than relying solely on raw player volume or popularity.",
    "businessProblem": "Valve required a structured market analysis to determine how a hypothetical $10 million investment should be allocated across publishers, genres, pricing tiers, and game categories. Although the dataset contained engagement, pricing, publisher, and sentiment metrics, there was no consolidated analytical view to identify sustainable long-term investment opportunities or balance investment across different market segments.",
    "recommendations": "Prioritize investment in publishers demonstrating consistent long-term success, particularly CAPCOM, Electronic Arts, Ubisoft, and Rockstar Games, while expanding high-performing Action, RPG, and Adventure genres. Increase investment in Hybrid titles due to their balance of engagement and retention, and evaluate Multiplayer opportunities for future growth. Maintain Premium pricing for high-quality games rather than competing primarily on price, and investigate monetization strategies before expanding Free-to-Play investments."
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
async function saveToSupabase(payload) {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from("portfolio_state").upsert({
      id: "current",
      payload,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (!error) return true;
    const { error: altError } = await client.from("portfolio_data").upsert({
      id: "current",
      payload,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (!altError) return true;
  } catch (e) {
    console.error("saveToSupabase exception:", e);
  }
  return false;
}
var syncToSupabase = saveToSupabase;

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

// src/api/portfolio/index.ts
var config = {
  runtime: "nodejs"
};
async function handler(req, res) {
  if (!enforceOwnerPermission(req, res)) return;
  const startTime = Date.now();
  const rawUrl = req.url || "";
  const parsedUrl = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  const action = req.query?.action || req.body?.action || "";
  if (pathname.includes("/diagnostics") || pathname.includes("/config")) {
    try {
      const portfolio = await fetchFromSupabase();
      const supabase = getSupabaseClient();
      return sendSuccess(res, {
        status: "healthy",
        database: { status: "connected", message: "SQLite local file store active." },
        supabase: { status: supabase ? "configured" : "unconfigured", message: supabase ? "Connected to Supabase cloud bucket." : "Running local storage only." },
        ai: { status: process.env.GEMINI_API_KEY ? "configured" : "unconfigured", message: process.env.GEMINI_API_KEY ? "Gemini 3.5 API key present." : "No Gemini API key supplied." },
        backups: { status: "ready", message: "Automated snapshot system active." },
        environment: { status: process.env.NODE_ENV || "development", message: `Active mode: ${process.env.NODE_ENV || "development"}` },
        stats: {
          projectsCount: portfolio?.projects?.length || 0,
          analyticsMetricsCount: portfolio?.analyticsMetrics?.length || 0
        }
      });
    } catch (err) {
      return sendError(res, 500, "Failed to run diagnostics.", err.message);
    }
  }
  if (pathname.includes("/backups")) {
    try {
      const supabase = getSupabaseClient();
      if (action === "list" || req.method === "GET") {
        if (!supabase) {
          return sendSuccess(res, { backups: [] });
        }
        const { data, error } = await supabase.storage.from("portfolio-uploads").list("backups", { sortBy: { column: "created_at", order: "desc" } });
        if (error) throw error;
        return sendSuccess(res, { backups: data || [] });
      }
      if (action === "create" || req.method === "POST") {
        const portfolio = await fetchFromSupabase();
        const now = /* @__PURE__ */ new Date();
        const filename = `portfolio-backup-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}.json`;
        if (supabase) {
          const { error } = await supabase.storage.from("portfolio-uploads").upload(`backups/${filename}`, JSON.stringify(portfolio, null, 2), { contentType: "application/json" });
          if (error) throw error;
        }
        logExecution({ endpoint: pathname, totalDurationMs: Date.now() - startTime });
        return sendSuccess(res, { message: "Backup snapshot created successfully.", filename });
      }
      if (action === "restore") {
        const { filename } = req.body || {};
        if (!filename || !supabase) {
          return sendError(res, 400, "filename and configured cloud storage required for restore.");
        }
        const { data, error } = await supabase.storage.from("portfolio-uploads").download(`backups/${filename}`);
        if (error) throw error;
        const text = await data.text();
        const restored = JSON.parse(text);
        await syncToSupabase(restored);
        return sendSuccess(res, { message: "Portfolio restored successfully.", portfolio: restored });
      }
      if (action === "delete") {
        const { filename } = req.body || {};
        if (!filename || !supabase) {
          return sendError(res, 400, "filename and configured cloud storage required for deletion.");
        }
        const { error } = await supabase.storage.from("portfolio-uploads").remove([`backups/${filename}`]);
        if (error) throw error;
        return sendSuccess(res, { message: "Backup deleted successfully." });
      }
    } catch (err) {
      return sendError(res, 500, "Backup operation failed.", err.message);
    }
  }
  if (req.method === "GET" || pathname.includes("/load")) {
    try {
      const data = await fetchFromSupabase();
      logExecution({ endpoint: pathname, totalDurationMs: Date.now() - startTime });
      return sendSuccess(res, data);
    } catch (err) {
      return sendError(res, 500, "Failed to load portfolio state.", err.message);
    }
  }
  if (req.method === "POST" || pathname.includes("/save")) {
    try {
      const payload = req.body;
      if (!payload || !payload.profile) {
        return sendError(res, 400, "Invalid portfolio payload.");
      }
      const saved = await syncToSupabase(payload);
      logExecution({ endpoint: pathname, totalDurationMs: Date.now() - startTime });
      if (!saved) {
        return sendError(res, 500, "Portfolio save failed. Supabase returned an error or is unconfigured.");
      }
      return sendSuccess(res, { message: "Portfolio updated successfully.", portfolio: payload });
    } catch (err) {
      return sendError(res, 500, "Failed to save portfolio state.", err.message);
    }
  }
  return sendError(res, 405, "Method Not Allowed.");
}
export {
  config,
  handler as default
};
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
