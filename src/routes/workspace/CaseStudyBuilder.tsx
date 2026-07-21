/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { ProjectRecord, ProjectStatus, TechnicalDifficulty, MetricHighlight, ContentBlock } from "../../types";
import { generateId } from "../../utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { TextArea } from "../../components/ui/TextArea";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { CaseStudyDetail } from "../public/CaseStudyDetail";
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Code, 
  FileText, 
  Layers, 
  PlusCircle, 
  Check,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Image as ImageIcon,
  Eye,
  FileCode,
  Database,
  Layout,
  BookOpen,
  Undo2,
  Copy,
  Clock,
  Cpu
} from "lucide-react";

// Inline beautiful SVG preset diagrams to let creators easily add high-fidelity visual assets in 1 click!
const PRESET_DIAGRAMS = [
  {
    name: "Database Relational Schema",
    desc: "A clean normalized entity-relationship vector diagram mapping tables.",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%230f172a"/><g stroke="%23334155" stroke-width="1"><line x1="100" y1="100" x2="300" y2="100"/><line x1="200" y1="100" x2="200" y2="200"/><line x1="100" y1="200" x2="300" y2="200"/></g><rect x="40" y="60" width="120" height="80" rx="6" fill="%231e293b" stroke="%2338bdf8" stroke-width="1.5"/><text x="50" y="80" fill="%23f8fafc" font-family="monospace" font-size="10" font-weight="bold">users_table</text><line x1="40" y1="90" x2="160" y2="90" stroke="%23334155" stroke-width="1"/><text x="50" y="105" fill="%2394a3b8" font-family="monospace" font-size="8">id : SERIAL [PK]</text><text x="50" y="120" fill="%2394a3b8" font-family="monospace" font-size="8">email : VARCHAR</text><rect x="240" y="60" width="120" height="80" rx="6" fill="%231e293b" stroke="%2334d399" stroke-width="1.5"/><text x="250" y="80" fill="%23f8fafc" font-family="monospace" font-size="10" font-weight="bold">orders_table</text><line x1="240" y1="90" x2="360" y2="90" stroke="%23334155" stroke-width="1"/><text x="250" y="105" fill="%2394a3b8" font-family="monospace" font-size="8">id : SERIAL [PK]</text><text x="250" y="120" fill="%2394a3b8" font-family="monospace" font-size="8">user_id : INT [FK]</text><rect x="140" y="160" width="120" height="80" rx="6" fill="%231e293b" stroke="%23fbbf24" stroke-width="1.5"/><text x="150" y="180" fill="%23f8fafc" font-family="monospace" font-size="10" font-weight="bold">metrics_audit</text><line x1="140" y1="190" x2="260" y2="190" stroke="%23334155" stroke-width="1"/><text x="150" y="205" fill="%2394a3b8" font-family="monospace" font-size="8">id : SERIAL [PK]</text><text x="150" y="220" fill="%2394a3b8" font-family="monospace" font-size="8">latency_ms : INT</text></svg>`
  },
  {
    name: "Machine Learning Pipeline",
    desc: "A technical flow diagram illustrating feature vectors and predictors.",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%230f172a"/><g stroke="%2364748b" stroke-width="1.5" fill="none"><path d="M 60,150 L 110,150 M 170,150 L 230,150 M 290,150 L 340,150"/><polygon points="110,147 110,153 116,150" fill="%2364748b"/><polygon points="230,147 230,153 236,150" fill="%2364748b"/><polygon points="340,147 340,153 346,150" fill="%2364748b"/></g><circle cx="40" cy="150" r="24" fill="%231e293b" stroke="%23f43f5e" stroke-width="2"/><text x="24" y="153" fill="%23f8fafc" font-family="monospace" font-size="8" font-weight="bold">Source</text><rect x="110" y="120" width="60" height="60" rx="8" fill="%231e293b" stroke="%2338bdf8" stroke-width="2"/><text x="116" y="153" fill="%23f8fafc" font-family="monospace" font-size="8" font-weight="bold">Clean / Scal</text><rect x="230" y="120" width="60" height="60" rx="8" fill="%231e293b" stroke="%2334d399" stroke-width="2"/><text x="238" y="153" fill="%23f8fafc" font-family="monospace" font-size="8" font-weight="bold">Train Model</text><circle cx="360" cy="150" r="24" fill="%231e293b" stroke="%23fbbf24" stroke-width="2"/><text x="345" y="153" fill="%23f8fafc" font-family="monospace" font-size="8" font-weight="bold">Predict</text></svg>`
  },
  {
    name: "Dashboard Analytics Grid",
    desc: "A vector report layout modeling mock visual graphs.",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%230f172a"/><rect x="20" y="20" width="100" height="50" rx="6" fill="%231e293b" stroke="%23475569" stroke-width="1"/><text x="30" y="38" fill="%2394a3b8" font-family="sans-serif" font-size="8">KPI CONVERSION</text><text x="30" y="58" fill="%2334d399" font-family="sans-serif" font-size="14" font-weight="bold">+34.8%</text><rect x="150" y="20" width="100" height="50" rx="6" fill="%231e293b" stroke="%23475569" stroke-width="1"/><text x="160" y="38" fill="%2394a3b8" font-family="sans-serif" font-size="8">QUERIES INDEXED</text><text x="160" y="58" fill="%2338bdf8" font-family="sans-serif" font-size="14" font-weight="bold">1.2M / s</text><rect x="280" y="20" width="100" height="50" rx="6" fill="%231e293b" stroke="%23475569" stroke-width="1"/><text x="290" y="38" fill="%2394a3b8" font-family="sans-serif" font-size="8">THREAD LATENCY</text><text x="290" y="58" fill="%23f43f5e" font-family="sans-serif" font-size="14" font-weight="bold">0.14ms</text><rect x="20" y="90" width="360" height="180" rx="8" fill="%231e293b" stroke="%23334155" stroke-width="1.5"/><path d="M 40,240 L 100,180 L 160,210 L 220,130 L 280,160 L 340,110" fill="none" stroke="%2338bdf8" stroke-width="3"/><circle cx="340" cy="110" r="5" fill="%2334d399"/></svg>`
  }
];

const TEMPLATES = [
  {
    id: "excel",
    name: "Excel Report",
    role: "Lead Systems Analyst",
    industry: "Fintech & Wealth",
    tags: "Excel, VBA, Power Query, Financial Models",
    categories: "Business Intelligence, Data Analytics",
    difficulty: TechnicalDifficulty.BEGINNER,
    objective: "To design a zero-latency VBA financial consolidation spreadsheet that extracts automated sales indexes, reducing reporting cycles from days to under 15 minutes.",
    methodology: "1. Structured modular spreadsheet tabs using index-matched functions.\n2. Wrote custom VBA macro routines to cleanse and aggregate CSV logs automatically.\n3. Configured dynamic pivots and sparklines to visualize executive metrics.",
    datasetDesc: "Financial transaction ledger files (.xlsx and .csv) containing 500,000+ daily ledger transaction records with secure encryption variables."
  },
  {
    id: "sql",
    name: "SQL Analytics",
    role: "Relational DB Specialist",
    industry: "E-Commerce",
    tags: "PostgreSQL, DQL Queries, Database Indexes, CTEs",
    categories: "Database Administration, Cohort Analysis",
    difficulty: TechnicalDifficulty.INTERMEDIATE,
    objective: "To identify critical user cohort churn variables by formulating highly optimized SQL aggregation queries over massive multi-million record transactional databases.",
    methodology: "1. Wrote advanced recursive CTE queries to trace user retention cohorts.\n2. Implemented secondary index variables to optimize scan speeds by 12x.\n3. Extracted cohort heatmaps for strategic review.",
    datasetDesc: "E-Commerce user activity table indexes containing historical transactions, registration sessions, and coupon log entries (over 12 million lines total)."
  },
  {
    id: "powerbi",
    name: "Power BI Hub",
    role: "BI Dashboard Consultant",
    industry: "Logistics & Supply Chain",
    tags: "Power BI, DAX Modeling, Power Query, Star Schema",
    categories: "Business Intelligence, Interactive Dashboarding",
    difficulty: TechnicalDifficulty.INTERMEDIATE,
    objective: "To develop an interactive executive delivery cockpit tracking route delay variances, utilizing a fully normalized Star Schema schema design.",
    methodology: "1. Built fully normalized dimensions and transactional fact tables in Power Query.\n2. Coded high-speed DAX measures to calculate moving averages and year-over-year freight delays.\n3. Formulated custom themes matching corporate branding requirements.",
    datasetDesc: "Geospatial delivery manifests, vehicle telematics data, and warehouse storage logs imported from an enterprise Azure SQL database."
  },
  {
    id: "python",
    name: "Python Predictive",
    role: "Data Scientist",
    industry: "SaaS Systems",
    tags: "Python, Pandas, Scikit-Learn, Jupyter Notebooks",
    categories: "Machine Learning, Data Engineering",
    difficulty: TechnicalDifficulty.ADVANCED,
    objective: "To build a robust machine learning algorithm pipeline capable of classifying user churn risks with a validated prediction score exceedance.",
    methodology: "1. Conducted deep exploratory data analysis (EDA) using seaborn libraries.\n2. Formulated pipelines for automated one-hot encoding and min-max scaling features.\n3. Trained multi-layer classification trees and validated metrics using K-fold splitting.",
    datasetDesc: "Anonymized user telemetry streams, session durations, click events, and subscription transaction histories."
  },
  {
    id: "webapp",
    name: "Web Application",
    role: "Full-Stack Engineer",
    industry: "Web Platform",
    tags: "React, TypeScript, Tailwind CSS, Vite",
    categories: "Full Stack Development, UI Engineering",
    difficulty: TechnicalDifficulty.ADVANCED,
    objective: "To engineer a client-only high-performance single-page web application featuring responsive modular components and robust local data caching capabilities.",
    methodology: "1. Configured custom React components styled strictly with Tailwind utility tokens.\n2. Built client-side state managers with local persistence backup hooks.\n3. Designed responsive grid cards and interactive chart nodes.",
    datasetDesc: "Client-side telemetry parameters, local key-value state registries, and structured metadata schemas."
  }
];

interface CaseStudyBuilderProps {
  project: ProjectRecord | null; // If null, we are creating a new project
  onSave: (project: ProjectRecord) => void;
  onCancel: () => void;
}

export const CaseStudyBuilder: React.FC<CaseStudyBuilderProps> = ({
  project,
  onSave,
  onCancel
}) => {
  // Navigation / View state
  const [activeStep, setActiveStep] = useState(0);
  const [previewMode, setPreviewMode] = useState<"editor" | "split" | "preview">("editor");

  // Form dirtiness tracking
  const [isDirty, setIsDirty] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Form states initialized with existing values or defaults
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [summary, setSummary] = useState("");
  const [industry, setIndustry] = useState("");
  const [role, setRole] = useState("");
  const [duration, setDuration] = useState("");
  const [status, setStatus] = useState<ProjectStatus>(ProjectStatus.DRAFT);
  const [difficulty, setDifficulty] = useState<TechnicalDifficulty>(TechnicalDifficulty.INTERMEDIATE);
  
  // Structured Sections
  const [overviewText, setOverviewText] = useState("");
  const [businessProblem, setBusinessProblem] = useState("");
  const [objective, setObjective] = useState("");
  const [datasetDesc, setDatasetDesc] = useState("");
  const [methodology, setMethodology] = useState("");
  const [dataCleaning, setDataCleaning] = useState("");
  const [analysisText, setAnalysisText] = useState("");
  const [findings, setFindings] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [challengesText, setChallengesText] = useState("");
  const [lessonsLearned, setLessonsLearned] = useState("");

  const [tagsInput, setTagsInput] = useState("");
  const [categoriesInput, setCategoriesInput] = useState("");
  const [skillsInput, setSkillsInput] = useState("");

  const [metrics, setMetrics] = useState<MetricHighlight[]>([]);
  const [storyBlocks, setStoryBlocks] = useState<ContentBlock[]>([]);
  const [images, setImages] = useState<string[]>([]);

  const [githubUrl, setGithubUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [featured, setFeatured] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "private" | "unlisted">("public");

  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener: Ctrl+S / Cmd+S to save instantly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveFormState(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    title, subtitle, summary, industry, role, duration, status, difficulty,
    overviewText, businessProblem, objective, datasetDesc, methodology, dataCleaning,
    analysisText, findings, recommendations, challengesText, lessonsLearned,
    tagsInput, categoriesInput, skillsInput, metrics, storyBlocks, images,
    githubUrl, liveUrl, featured, visibility
  ]);

  // Load existing project details or auto-restore drafts
  useEffect(() => {
    if (project) {
      setId(project.id);
      setTitle(project.title);
      setSubtitle(project.subtitle);
      setSummary(project.summary);
      setIndustry(project.industry);
      setRole(project.role);
      setDuration(project.duration);
      setStatus(project.status);
      setDifficulty(project.difficulty);
      
      setOverviewText(project.overviewText || "");
      setBusinessProblem(project.businessProblem || "");
      setObjective(project.objective);
      setDatasetDesc(project.datasetDesc || "");
      setMethodology(project.methodology);
      setDataCleaning(project.dataCleaning || "");
      setAnalysisText(project.analysisText || "");
      setFindings(project.findings || "");
      setRecommendations(project.recommendations || "");
      setChallengesText(project.challengesText || "");
      setLessonsLearned(project.lessonsLearned || "");

      setTagsInput(project.tags.join(", "));
      setCategoriesInput(project.categories.join(", "));
      setSkillsInput(project.skills ? project.skills.join(", ") : "");
      
      setMetrics(project.metrics || []);
      setStoryBlocks(project.storyBlocks || []);
      setImages(project.images || []);
      
      setGithubUrl(project.githubUrl || "");
      setLiveUrl(project.liveUrl || "");
      setFeatured(project.featured || false);
      setVisibility(project.visibility || "public");
      setIsDirty(false);
    } else {
      // Clear for new project
      setId(generateId("project"));
      
      // Look for a local auto-save draft first!
      const draft = localStorage.getItem("portfolio_os_builder_draft");
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          restoreFormFromState(parsed);
          setValidationError("Found an unsaved draft in memory! Automatically restored your work.");
          setTimeout(() => setValidationError(null), 5000);
          setIsDirty(true);
          return;
        } catch (e) {
          console.error("Failed to parse auto-saved draft", e);
        }
      }

      resetToDefaults();
    }
  }, [project]);

  // Handle local Auto-save loop (runs every 5 seconds if dirty)
  useEffect(() => {
    if (!isDirty) return;

    const timer = setInterval(() => {
      saveDraftToLocalStorage();
    }, 5000);

    return () => clearInterval(timer);
  }, [
    title, subtitle, summary, industry, role, duration, status, difficulty,
    overviewText, businessProblem, objective, datasetDesc, methodology, dataCleaning,
    analysisText, findings, recommendations, challengesText, lessonsLearned,
    tagsInput, categoriesInput, skillsInput, metrics, storyBlocks, images,
    githubUrl, liveUrl, featured, visibility, isDirty
  ]);

  const resetToDefaults = () => {
    setTitle("");
    setSubtitle("");
    setSummary("");
    setIndustry("Data Analytics");
    setRole("Data Specialist");
    setDuration("4 Weeks");
    setStatus(ProjectStatus.DRAFT);
    setDifficulty(TechnicalDifficulty.INTERMEDIATE);
    
    setOverviewText("");
    setBusinessProblem("");
    setObjective("");
    setDatasetDesc("");
    setMethodology("");
    setDataCleaning("");
    setAnalysisText("");
    setFindings("");
    setRecommendations("");
    setChallengesText("");
    setLessonsLearned("");

    setTagsInput("");
    setCategoriesInput("");
    setSkillsInput("");
    
    setMetrics([
      { id: generateId("m"), label: "Optimization Index", value: "+45%", description: "Verified efficiency benchmark" }
    ]);
    setStoryBlocks([]);
    setImages([]);
    setGithubUrl("");
    setLiveUrl("");
    setFeatured(false);
    setVisibility("public");
    setIsDirty(false);
  };

  const restoreFormFromState = (state: any) => {
    setTitle(state.title || "");
    setSubtitle(state.subtitle || "");
    setSummary(state.summary || "");
    setIndustry(state.industry || "");
    setRole(state.role || "");
    setDuration(state.duration || "");
    setStatus(state.status || ProjectStatus.DRAFT);
    setDifficulty(state.difficulty || TechnicalDifficulty.INTERMEDIATE);
    
    setOverviewText(state.overviewText || "");
    setBusinessProblem(state.businessProblem || "");
    setObjective(state.objective || "");
    setDatasetDesc(state.datasetDesc || "");
    setMethodology(state.methodology || "");
    setDataCleaning(state.dataCleaning || "");
    setAnalysisText(state.analysisText || "");
    setFindings(state.findings || "");
    setRecommendations(state.recommendations || "");
    setChallengesText(state.challengesText || "");
    setLessonsLearned(state.lessonsLearned || "");

    setTagsInput(state.tagsInput || "");
    setCategoriesInput(state.categoriesInput || "");
    setSkillsInput(state.skillsInput || "");
    setMetrics(state.metrics || []);
    setStoryBlocks(state.storyBlocks || []);
    setImages(state.images || []);
    setGithubUrl(state.githubUrl || "");
    setLiveUrl(state.liveUrl || "");
    setFeatured(state.featured || false);
    setVisibility(state.visibility || "public");
  };

  const getFormStateObj = () => {
    return {
      title, subtitle, summary, industry, role, duration, status, difficulty,
      overviewText, businessProblem, objective, datasetDesc, methodology, dataCleaning,
      analysisText, findings, recommendations, challengesText, lessonsLearned,
      tagsInput, categoriesInput, skillsInput, metrics, storyBlocks, images,
      githubUrl, liveUrl, featured, visibility
    };
  };

  const saveDraftToLocalStorage = () => {
    const state = getFormStateObj();
    localStorage.setItem("portfolio_os_builder_draft", JSON.stringify(state));
    const now = new Date();
    setLastSavedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  };

  const clearDraftFromLocalStorage = () => {
    localStorage.removeItem("portfolio_os_builder_draft");
  };

  // Select project template helper
  const handleApplyTemplate = (tplId: string) => {
    const tpl = TEMPLATES.find(t => t.id === tplId);
    if (!tpl) return;

    setTitle(tpl.name);
    setRole(tpl.role);
    setIndustry(tpl.industry);
    setTagsInput(tpl.tags);
    setCategoriesInput(tpl.categories);
    setDifficulty(tpl.difficulty);
    setObjective(tpl.objective);
    setMethodology(tpl.methodology);
    setDatasetDesc(tpl.datasetDesc);
    
    setSummary(`Designed a high-impact analytical framework for ${tpl.industry}, driving efficiency increases.`);
    setSubtitle(`Walkthrough of system architecture and business logic optimization.`);
    setOverviewText(`An executive-led diagnostic deep dive into ${tpl.industry} workflows, streamlining operations.`);
    setBusinessProblem(`Firms suffered from data pipeline latencies and manual audit overruns, leaking critical performance margins.`);
    
    // Add realistic dummy metrics
    if (tplId === "excel") {
      setMetrics([
        { id: generateId("m"), label: "Cycle Speedup", value: "98.2%", description: "Days of manual calculations reduced to minutes" },
        { id: generateId("m"), label: "Error Frequency", value: "0.0%", description: "Full validation formula checks eliminated math typos" }
      ]);
    } else if (tplId === "sql") {
      setMetrics([
        { id: generateId("m"), label: "Scan Overhead", value: "-91%", description: "Query read latencies optimized via precise indexes" },
        { id: generateId("m"), label: "Cohort Accuracy", value: "100%", description: "Absolute matching against real transaction ledgers" }
      ]);
    } else {
      setMetrics([
        { id: generateId("m"), label: "Actionable KPI", value: "+34.5%", description: "Improved strategic efficiency benchmark" }
      ]);
    }

    setIsDirty(true);
  };

  // Save changes completely
  const saveFormState = (showConfirmation = false) => {
    if (!title.trim() || !summary.trim() || !objective.trim() || !methodology.trim()) {
      setValidationError("A Project Title, Summary, Objective, and Methodology are required to compile the Case Study.");
      setActiveStep(0);
      return;
    }

    const finalRecord: ProjectRecord = {
      id: id || generateId("project"),
      title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      subtitle,
      summary,
      industry,
      role,
      duration,
      status,
      difficulty,
      objective,
      datasetDesc: datasetDesc.trim() || undefined,
      methodology,
      
      // Structured Sections
      overviewText: overviewText.trim() || undefined,
      businessProblem: businessProblem.trim() || undefined,
      dataCleaning: dataCleaning.trim() || undefined,
      analysisText: analysisText.trim() || undefined,
      findings: findings.trim() || undefined,
      recommendations: recommendations.trim() || undefined,
      challengesText: challengesText.trim() || undefined,
      lessonsLearned: lessonsLearned.trim() || undefined,

      tags: tagsInput.split(",").map(t => t.trim()).filter(Boolean),
      categories: categoriesInput.split(",").map(c => c.trim()).filter(Boolean),
      skills: skillsInput.split(",").map(s => s.trim()).filter(Boolean),
      
      metrics,
      storyBlocks,
      images,
      githubUrl: githubUrl.trim() || undefined,
      liveUrl: liveUrl.trim() || undefined,
      featured,
      visibility,
      createdAt: project?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    clearDraftFromLocalStorage();
    onSave(finalRecord);
  };

  const handleCancelClick = () => {
    if (isDirty) {
      setShowExitDialog(true);
    } else {
      onCancel();
    }
  };

  // Form Field change detection wrapper
  const handleFieldChange = (setter: any) => (e: any) => {
    setter(e.target.value);
    setIsDirty(true);
  };

  const handleSelectFieldChange = (setter: any) => (val: any) => {
    setter(val);
    setIsDirty(true);
  };

  // Metrics Logic
  const handleAddMetric = () => {
    const newMetric: MetricHighlight = {
      id: generateId("metric"),
      label: "Statistical Index",
      value: "100%",
      description: "Write details comparing baseline outcomes..."
    };
    setMetrics([...metrics, newMetric]);
    setIsDirty(true);
  };

  const handleUpdateMetric = (index: number, key: keyof MetricHighlight, value: string) => {
    const copy = [...metrics];
    copy[index] = { ...copy[index], [key]: value };
    setMetrics(copy);
    setIsDirty(true);
  };

  const handleDeleteMetric = (idToDelete: string) => {
    setMetrics(metrics.filter(m => m.id !== idToDelete));
    setIsDirty(true);
  };

  // Story Blocks Logic
  const handleAddBlock = (type: ContentBlock["type"]) => {
    let bodyContent = "";
    let language = undefined;
    let bTitle = "";

    if (type === "code_snippet") {
      bodyContent = "def consolidate_audit_logs(df_raw):\n    # Write clean high-speed cleaning scripts\n    return df_raw.dropna(subset=['audit_id'])";
      language = "python";
      bTitle = "Consolidation Filter Macro";
    } else if (type === "quote") {
      bodyContent = "The system achieved zero transactional anomalies across three fiscal quarters.";
      bTitle = "Lead Finance Auditor Statement";
    } else if (type === "chart_data") {
      bodyContent = "[\n  {\"name\": \"Q1 Baseline\", \"Normal\": 14500, \"Fraud\": 120},\n  {\"name\": \"Q2 Optimised\", \"Normal\": 19800, \"Fraud\": 5}\n]";
      bTitle = "Vulnerability Reduction Indexes";
    } else {
      bodyContent = "Explain the specific granular walkthrough variables...";
      bTitle = "Technical Context Detail";
    }

    const newBlock: ContentBlock = {
      id: generateId("block"),
      type,
      title: bTitle,
      bodyContent,
      language
    };
    setStoryBlocks([...storyBlocks, newBlock]);
    setIsDirty(true);
  };

  const handleUpdateBlock = (index: number, key: keyof ContentBlock, value: string) => {
    const copy = [...storyBlocks];
    copy[index] = { ...copy[index], [key]: value };
    setStoryBlocks(copy);
    setIsDirty(true);
  };

  const handleDeleteBlock = (idToDelete: string) => {
    setStoryBlocks(storyBlocks.filter(b => b.id !== idToDelete));
    setIsDirty(true);
  };

  // Media Manager Logic
  const handleUrlImageAdd = (url: string) => {
    if (!url.trim()) return;
    setImages([...images, url.trim()]);
    setIsDirty(true);
  };

  const handleDeviceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setImages([...images, base64]);
        setIsDirty(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddPresetDiagram = (svgDataUrl: string) => {
    setImages([...images, svgDataUrl]);
    setIsDirty(true);
  };

  const handleDeleteImage = (indexToDelete: number) => {
    setImages(images.filter((_, idx) => idx !== indexToDelete));
    setIsDirty(true);
  };

  const handleSetPrimaryImage = (index: number) => {
    // Put selected image as first element in array (acting as Thumbnail)
    if (index === 0) return;
    const copy = [...images];
    const item = copy.splice(index, 1)[0];
    copy.unshift(item);
    setImages(copy);
    setIsDirty(true);
  };

  // Compile draft project object for live real-time previewing
  const getDraftProjectObj = (): ProjectRecord => {
    return {
      id: id || "preview-id",
      title: title || "[Untitled Case Study]",
      slug: title ? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") : "untitled-case-study",
      subtitle: subtitle || "[No Subtitle Configured]",
      summary: summary || "[Short grid summary text has not been written yet]",
      industry: industry || "Technology",
      role: role || "Systems Engineer",
      duration: duration || "Ongoing",
      status,
      difficulty,
      objective: objective || "[Objective & Challenge narrative placeholder]",
      datasetDesc: datasetDesc.trim() || undefined,
      methodology: methodology || "[Technical methodology walkthrough placeholder]",
      
      overviewText: overviewText.trim() || undefined,
      businessProblem: businessProblem.trim() || undefined,
      dataCleaning: dataCleaning.trim() || undefined,
      analysisText: analysisText.trim() || undefined,
      findings: findings.trim() || undefined,
      recommendations: recommendations.trim() || undefined,
      challengesText: challengesText.trim() || undefined,
      lessonsLearned: lessonsLearned.trim() || undefined,

      tags: tagsInput.split(",").map(t => t.trim()).filter(Boolean),
      categories: categoriesInput.split(",").map(c => c.trim()).filter(Boolean),
      skills: skillsInput.split(",").map(s => s.trim()).filter(Boolean),
      
      metrics,
      storyBlocks,
      images,
      githubUrl: githubUrl.trim() || undefined,
      liveUrl: liveUrl.trim() || undefined,
      featured,
      visibility,
      createdAt: project?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  };

  const draftProject = getDraftProjectObj();

  return (
    <div className="space-y-6 animate-fade-in relative">
      
      {/* Unsaved Changes Confirmation Dialog */}
      {showExitDialog && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="max-w-md w-full bg-slate-900 border-slate-800 text-slate-100 shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-white font-display font-semibold">Exit Builder Mode?</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  You have made unsaved modifications to this case study. Leaving now will delete your current session draft cache permanently.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowExitDialog(false)}
                className="text-slate-400 hover:text-white"
              >
                Go Back to Editing
              </Button>
              <Button 
                variant="danger" 
                size="sm" 
                onClick={() => {
                  clearDraftFromLocalStorage();
                  onCancel();
                }}
                className="bg-red-600 hover:bg-red-500"
              >
                Yes, Discard Changes
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Builder Header controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCancelClick}
            className="p-1 h-8 w-8 rounded-full border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
            title="Cancel and Exit"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-lg text-white">
                {project ? `Modify Case Study` : "Create New Case Study"}
              </h1>
              {lastSavedTime && (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Auto-saved {lastSavedTime}
                </span>
              )}
            </div>
            <p className="font-sans text-[11px] text-slate-400">
              Formulate narrative blocks, assign statistics dashboard gauges, and inspect live preview layouts.
            </p>
          </div>
        </div>

        {/* Live Preview toggles and Save */}
        <div className="flex items-center gap-3 self-start md:self-center">
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-slate-400 text-xs font-mono font-medium">
            <button
              onClick={() => setPreviewMode("editor")}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${previewMode === "editor" ? "bg-slate-800 text-white shadow-xs" : "hover:text-slate-200"}`}
            >
              Editor Only
            </button>
            <button
              onClick={() => setPreviewMode("split")}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${previewMode === "split" ? "bg-slate-800 text-white shadow-xs" : "hover:text-slate-200"}`}
            >
              Split View
            </button>
            <button
              onClick={() => setPreviewMode("preview")}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${previewMode === "preview" ? "bg-slate-800 text-white shadow-xs" : "hover:text-slate-200"}`}
            >
              Live Preview
            </button>
          </div>

          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => saveFormState(false)}
            className="gap-1.5 text-xs bg-emerald-500 text-slate-950 hover:bg-emerald-400 border-transparent font-semibold h-[34px] shadow-sm cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Save Study
          </Button>
        </div>
      </div>

      {/* Main workspace area: dynamic columns depending on previewMode */}
      <div className={`grid grid-cols-1 ${previewMode === "split" ? "lg:grid-cols-2" : "w-full"} gap-8`}>
        
        {/* LEFT COLUMN: THE WIZARD EDITOR FORM */}
        {(previewMode === "editor" || previewMode === "split") && (
          <div className="space-y-6">
            
            {/* Project Templates Quick Action Bar (Only visible when creating a new project) */}
            {!project && activeStep === 0 && (
              <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl overflow-hidden border-dashed border-2">
                <CardHeader className="py-3 bg-slate-950/60 border-b border-slate-800">
                  <CardTitle className="text-xs uppercase tracking-widest font-mono text-indigo-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Interactive Case Study Templates
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <p className="text-[11px] text-slate-400">
                    Instantly load professional outlines, structural sections, and KPI placeholders calibrated for specific technical stacks.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {TEMPLATES.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleApplyTemplate(t.id)}
                        className="px-3 py-1.5 text-[10px] font-mono font-semibold rounded-md border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:border-slate-600 hover:bg-slate-900 transition-all cursor-pointer flex items-center gap-1"
                      >
                        {t.id === "excel" ? <Layout className="w-3 h-3 text-emerald-400" /> :
                         t.id === "sql" ? <Database className="w-3 h-3 text-cyan-400" /> :
                         t.id === "powerbi" ? <FileCode className="w-3 h-3 text-amber-400" /> :
                         t.id === "python" ? <Code className="w-3 h-3 text-rose-400" /> :
                         <Layout className="w-3 h-3 text-indigo-400" />}
                        {t.name}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step Navigation Ribbon */}
            <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800 overflow-x-auto text-xs font-mono text-slate-400 hide-scrollbar scroll-smooth">
              {[
                { title: "Identity", icon: Layout },
                { title: "Stats", icon: TrendingUp },
                { title: "Structured Sections", icon: BookOpen },
                { title: "Story Blocks", icon: FileCode },
                { title: "Media Assets", icon: ImageIcon }
              ].map((step, idx) => {
                const Icon = step.icon;
                const isActive = activeStep === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveStep(idx)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                      isActive ? "bg-slate-800 text-white font-bold" : "hover:text-slate-200"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{idx + 1}. {step.title}</span>
                  </button>
                );
              })}
            </div>

            {validationError && (
              <div className="p-4 bg-amber-950/40 text-amber-400 border border-amber-900/40 rounded-xl text-xs font-mono flex items-start gap-3 animate-fade-in">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <p className="font-sans font-light leading-relaxed">{validationError}</p>
              </div>
            )}

            {/* STEP CONTAINER */}
            <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-2xl">
              <CardContent className="pt-6 space-y-6">
                
                {/* STEP 1: IDENTITY & METADATA */}
                {activeStep === 0 && (
                  <div className="space-y-4 animate-fade-in">
                    <h3 className="font-display font-semibold text-sm text-slate-200 border-b border-slate-800 pb-2">
                      Primary Portfolio Parameters
                    </h3>

                    <Input
                      label="Primary Project Title"
                      value={title}
                      onChange={handleFieldChange(setTitle)}
                      placeholder="e.g., SQL Churn Predictor: Retail Revenue Optimization"
                      className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                      required
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Strategic Subtitle"
                        value={subtitle}
                        onChange={handleFieldChange(setSubtitle)}
                        placeholder="e.g., Automated transactional anomaly analysis with CTE trees"
                        className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                      />
                      <Input
                        label="Project Duration / Timeframe"
                        value={duration}
                        onChange={handleFieldChange(setDuration)}
                        placeholder="e.g., 3 Weeks, 2 Months"
                        className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                      />
                    </div>

                    <TextArea
                      label="High-Impact Short Summary (Displays on list cards)"
                      value={summary}
                      onChange={handleFieldChange(setSummary)}
                      placeholder="Write a concise 2-sentence summary illustrating the tools used and primary validated KPIs..."
                      className="bg-slate-950 border-slate-800 text-slate-100 text-xs font-sans"
                      rows={3}
                      required
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Input
                        label="Industry Category"
                        value={industry}
                        onChange={handleFieldChange(setIndustry)}
                        placeholder="e.g., E-Commerce, Logistics"
                        className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                      />
                      <Input
                        label="My Professional Role"
                        value={role}
                        onChange={handleFieldChange(setRole)}
                        placeholder="e.g., Lead Data Engineer"
                        className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                      />
                      <Select
                        label="Technical Complexity"
                        value={difficulty}
                        onChange={(e) => handleSelectFieldChange(setDifficulty)(e.target.value as TechnicalDifficulty)}
                        options={[
                          { label: "Beginner standalone", value: TechnicalDifficulty.BEGINNER },
                          { label: "Intermediate standalone", value: TechnicalDifficulty.INTERMEDIATE },
                          { label: "Advanced fullstack logic", value: TechnicalDifficulty.ADVANCED },
                          { label: "Expert / Core Architect", value: TechnicalDifficulty.EXPERT }
                        ]}
                        className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Select
                        label="Publishing Status"
                        value={status}
                        onChange={(e) => handleSelectFieldChange(setStatus)(e.target.value as ProjectStatus)}
                        options={[
                          { label: "Draft Mode (Hidden from public)", value: ProjectStatus.DRAFT },
                          { label: "Published Mode (Live immediately)", value: ProjectStatus.PUBLISHED },
                          { label: "Archived Mode (Legacy storage)", value: ProjectStatus.ARCHIVED }
                        ]}
                        className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                      />

                      <Select
                        label="Visibility Permissions"
                        value={visibility}
                        onChange={(e) => handleSelectFieldChange(setVisibility)(e.target.value as any)}
                        options={[
                          { label: "Public (Visible to everyone)", value: "public" },
                          { label: "Private (Admin only)", value: "private" },
                          { label: "Unlisted (Requires link)", value: "unlisted" }
                        ]}
                        className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1.5">
                      <input
                        type="checkbox"
                        id="featuredCheckbox"
                        checked={featured}
                        onChange={(e) => { setFeatured(e.target.checked); setIsDirty(true); }}
                        className="h-4 w-4 bg-slate-950 border-slate-800 text-indigo-600 rounded focus:ring-offset-slate-900 cursor-pointer"
                      />
                      <label htmlFor="featuredCheckbox" className="text-xs font-semibold text-slate-300 cursor-pointer">
                        Pin/Feature this project in the main portfolio banner
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800/60 pt-4">
                      <Input
                        label="Tags / Technologies (Comma-separated)"
                        value={tagsInput}
                        onChange={handleFieldChange(setTagsInput)}
                        placeholder="Excel, VBA, SQL, Python"
                        className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                      />
                      <Input
                        label="Domain Categories (Comma-separated)"
                        value={categoriesInput}
                        onChange={handleFieldChange(setCategoriesInput)}
                        placeholder="Data Science, Machine Learning"
                        className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                      />
                    </div>

                    <Input
                      label="Key Recruiting Skills (Comma-separated)"
                      value={skillsInput}
                      onChange={handleFieldChange(setSkillsInput)}
                      placeholder="Data Pipeline Auditing, Cohort Retention Mapping"
                      className="bg-slate-950 border-slate-800 text-slate-100 text-xs"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800/60 pt-4">
                      <Input
                        label="GitHub Repository Link"
                        value={githubUrl}
                        onChange={handleFieldChange(setGithubUrl)}
                        placeholder="https://github.com/Animus004/repo"
                        className="bg-slate-950 border-slate-800 text-slate-100 text-xs font-mono"
                      />
                      <Input
                        label="Live Product Demo URL"
                        value={liveUrl}
                        onChange={handleFieldChange(setLiveUrl)}
                        placeholder="https://app.demo.com"
                        className="bg-slate-950 border-slate-800 text-slate-100 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* STEP 2: STATS & DASHBOARD METRICS */}
                {activeStep === 1 && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <h3 className="font-display font-semibold text-sm text-slate-200">Verified Quantifiable Performance Indicators</h3>
                        <p className="text-[11px] text-slate-400">Attach robust stats (e.g. "+84% Query Speedup", "0.0% Math Errors") to hook reviewers.</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddMetric}
                        className="gap-1 text-[10px] font-mono border-slate-800 text-slate-300 hover:bg-slate-800"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add KPI Metric
                      </Button>
                    </div>

                    {metrics.length > 0 ? (
                      <div className="space-y-4">
                        {metrics.map((metric, index) => (
                          <div 
                            key={metric.id} 
                            className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                          >
                            <div className="sm:col-span-3">
                              <Input
                                label="KPI Value Name"
                                value={metric.label}
                                onChange={(e) => handleUpdateMetric(index, "label", e.target.value)}
                                className="bg-slate-900 border-slate-800 text-slate-100 text-xs"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <Input
                                label="Stat Value"
                                value={metric.value}
                                onChange={(e) => handleUpdateMetric(index, "value", e.target.value)}
                                className="bg-slate-900 border-slate-800 text-slate-100 text-xs"
                              />
                            </div>
                            <div className="sm:col-span-6">
                              <Input
                                label="Analytical Explanation Statement"
                                value={metric.description}
                                onChange={(e) => handleUpdateMetric(index, "description", e.target.value)}
                                className="bg-slate-900 border-slate-800 text-slate-100 text-xs"
                              />
                            </div>
                            <div className="sm:col-span-1 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteMetric(metric.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-950/20 px-2 h-9"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-2">
                        <TrendingUp className="w-5 h-5 mx-auto text-slate-600 animate-pulse" />
                        <p className="text-xs">No project performance indicators assigned yet.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: STRUCTURED NARRATIVE SECTIONS */}
                {activeStep === 2 && (
                  <div className="space-y-5 animate-fade-in max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    <h3 className="font-display font-semibold text-sm text-slate-200 border-b border-slate-800 pb-2">
                      Structured Case Study Sections (Markdown compatible)
                    </h3>

                    {/* Section 1: Executive Overview */}
                    <TextArea
                      label={<span className="font-mono font-semibold text-slate-300">Section 1: Executive Overview</span>}
                      value={overviewText}
                      onChange={handleFieldChange(setOverviewText)}
                      placeholder="Provide a high-level briefing of the project results, ideal for busy recruiters scanning key achievements..."
                      className="text-xs font-sans"
                      rows={4}
                    />

                    {/* Section 2: Business Problem & Objective */}
                    <div className="grid grid-cols-1 gap-4 border-t border-slate-800/60 pt-4">
                      <TextArea
                        label={<span className="font-mono font-semibold text-slate-300">Section 2A: Objective / Objective Statement *</span>}
                        value={objective}
                        onChange={handleFieldChange(setObjective)}
                        placeholder="What was the core strategic target this optimization was designed to execute?"
                        className="text-xs font-sans"
                        rows={4}
                        required
                      />
                      <TextArea
                        label={<span className="font-mono font-semibold text-rose-400">Section 2B: The Business Problem</span>}
                        value={businessProblem}
                        onChange={handleFieldChange(setBusinessProblem)}
                        placeholder="What mechanical obstacles or manual overhead was the business experiencing before your intervention?"
                        className="text-xs font-sans"
                        rows={3}
                      />
                    </div>

                    {/* Section 3: Dataset specifications & Cleaning */}
                    <div className="grid grid-cols-1 gap-4 border-t border-slate-800/60 pt-4">
                      <TextArea
                        label={<span className="font-mono font-semibold text-slate-300">Section 3A: Dataset & Staging Specifications</span>}
                        value={datasetDesc}
                        onChange={handleFieldChange(setDatasetDesc)}
                        placeholder="Format, row counts, and data staging schemas..."
                        className="text-xs font-sans"
                        rows={3}
                      />
                      <TextArea
                        label={<span className="font-mono font-semibold text-slate-300">Section 3B: Data Cleaning & Preprocessing Protocols</span>}
                        value={dataCleaning}
                        onChange={handleFieldChange(setDataCleaning)}
                        placeholder="What scrubbing routines, null removals, or normalization logic did you run to prepare the data pipelines?"
                        className="text-xs font-sans"
                        rows={3}
                      />
                    </div>

                    {/* Section 4: Methodology & Analysis */}
                    <div className="grid grid-cols-1 gap-4 border-t border-slate-800/60 pt-4">
                      <TextArea
                        label={<span className="font-mono font-semibold text-slate-300">Section 4A: Core Technical Methodology *</span>}
                        value={methodology}
                        onChange={handleFieldChange(setMethodology)}
                        placeholder="What sequential steps did your software logic or engineering workflow follow?"
                        className="text-xs font-sans"
                        rows={4}
                        required
                      />
                      <TextArea
                        label={<span className="font-mono font-semibold text-slate-300">Section 4B: Analytical Modeling & Query Scripts</span>}
                        value={analysisText}
                        onChange={handleFieldChange(setAnalysisText)}
                        placeholder="Explain statistical variables, models built, or grouping scripts."
                        className="text-xs font-sans"
                        rows={3}
                      />
                    </div>

                    {/* Section 5: Findings & Recommendations */}
                    <div className="grid grid-cols-1 gap-4 border-t border-slate-800/60 pt-4">
                      <TextArea
                        label={<span className="font-mono font-semibold text-emerald-400">Section 5A: Case Study Findings & Discoveries</span>}
                        value={findings}
                        onChange={handleFieldChange(setFindings)}
                        placeholder="What structural insights, data correlations, or efficiency milestones were achieved?"
                        className="text-xs font-sans"
                        rows={3}
                      />
                      <TextArea
                        label={<span className="font-mono font-semibold text-slate-300">Section 5B: Strategic Business Recommendations</span>}
                        value={recommendations}
                        onChange={handleFieldChange(setRecommendations)}
                        placeholder="What action steps should management execute based on your pipeline's outcomes?"
                        className="text-xs font-sans"
                        rows={3}
                      />
                    </div>

                    {/* Section 6: Challenges & Retrospective */}
                    <div className="grid grid-cols-1 gap-4 border-t border-slate-800/60 pt-4 pb-2">
                      <TextArea
                        label={<span className="font-mono font-semibold text-amber-500">Section 6A: Technical Roadblocks & Challenges Overcome</span>}
                        value={challengesText}
                        onChange={handleFieldChange(setChallengesText)}
                        placeholder="Wrangling mismatched schema objects, sorting concurrency loops..."
                        className="text-xs font-sans"
                        rows={3}
                      />
                      <TextArea
                        label={<span className="font-mono font-semibold text-slate-300">Section 6B: General Retrospective Lessons Learned</span>}
                        value={lessonsLearned}
                        onChange={handleFieldChange(setLessonsLearned)}
                        placeholder="What architectural improvements would you apply next in scaling this database stack?"
                        className="text-xs font-sans"
                        rows={3}
                      />
                    </div>
                  </div>
                )}

                {/* STEP 4: CUSTOM NARRATIVE BLOCK FLOW */}
                {activeStep === 3 && (
                  <div className="space-y-5 animate-fade-in max-h-[60vh] overflow-y-auto pr-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
                      <div>
                        <h3 className="font-display font-semibold text-sm text-slate-200">Custom Dynamic Flow Blocks</h3>
                        <p className="text-[11px] text-slate-400">Append custom snippets, quotes, or JSON-driven visual transaction charts.</p>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddBlock("markdown")}
                          className="text-[10px] font-mono px-2 border-slate-800 text-slate-300 cursor-pointer"
                        >
                          + Text Box
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddBlock("code_snippet")}
                          className="text-[10px] font-mono px-2 border-slate-800 text-slate-300 cursor-pointer"
                        >
                          + Code Snippet
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddBlock("quote")}
                          className="text-[10px] font-mono px-2 border-slate-800 text-slate-300 cursor-pointer"
                        >
                          + Block Quote
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddBlock("chart_data")}
                          className="text-[10px] font-mono px-2 border-slate-800 text-slate-300 cursor-pointer"
                        >
                          + Chart Data
                        </Button>
                      </div>
                    </div>

                    {storyBlocks.length > 0 ? (
                      <div className="space-y-4">
                        {storyBlocks.map((block, index) => (
                          <Card key={block.id} className="bg-slate-950/70 border-slate-800 shadow-sm overflow-hidden">
                            <CardHeader className="py-2.5 px-4 bg-slate-950 border-b border-slate-800 flex flex-row items-center justify-between">
                              <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                                {index + 1}. Block Type: <span className="text-slate-200">{block.type}</span>
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteBlock(block.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-slate-900 px-1.5 h-6 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3">
                              
                              <Input
                                label="Block Header Label (Optional)"
                                value={block.title || ""}
                                onChange={(e) => handleUpdateBlock(index, "title", e.target.value)}
                                className="bg-slate-900 border-slate-800 text-slate-100 text-xs animate-fade-in"
                              />

                              {block.type === "code_snippet" && (
                                <div className="grid grid-cols-2 gap-3">
                                  <Input
                                    label="Code Snippet Language"
                                    value={block.language || ""}
                                    onChange={(e) => handleUpdateBlock(index, "language", e.target.value)}
                                    className="bg-slate-900 border-slate-800 text-slate-100 text-xs"
                                  />
                                  <Input
                                    label="Snippet Caption Label"
                                    value={block.caption || ""}
                                    onChange={(e) => handleUpdateBlock(index, "caption", e.target.value)}
                                    className="bg-slate-900 border-slate-800 text-slate-100 text-xs"
                                  />
                                </div>
                              )}

                              <TextArea
                                label={block.type === "chart_data" ? "JSON Format Transaction Ledger Array" : "Block Narrative / Body Content"}
                                value={block.bodyContent}
                                onChange={(e) => handleUpdateBlock(index, "bodyContent", e.target.value)}
                                className="bg-slate-900 border-slate-800 text-slate-100 text-xs font-mono"
                                rows={4}
                                required
                              />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-2">
                        <FileText className="w-5 h-5 mx-auto text-slate-600" />
                        <p className="text-xs">No dynamic flowchart blocks assigned yet.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 5: MEDIA & ASSET MANAGER */}
                {activeStep === 4 && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h3 className="font-display font-semibold text-sm text-slate-200">Creative Media Asset Manager</h3>
                      <p className="text-[11px] text-slate-400">
                        Upload raw diagram screens, paste asset URLs, or generate 1-click mock pipeline drawings.
                      </p>
                    </div>

                    {/* Image uploads */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-800/60 pb-5">
                      <div className="space-y-2">
                        <label className="text-xs font-mono font-semibold text-slate-300 block">Option A: Read Local File</label>
                        <div 
                          className="border border-dashed border-slate-800 rounded-xl p-5 text-center bg-slate-950/40 hover:bg-slate-950/85 hover:border-slate-700 transition-all cursor-pointer space-y-2"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <UploadFileInput 
                            fileInputRef={fileInputRef} 
                            onUpload={handleDeviceImageUpload} 
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-mono font-semibold text-slate-300 block">Option B: Read From URL Link</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            id="urlInput"
                            placeholder="https://image-source.com/chart.png"
                            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs outline-hidden text-slate-300 focus:border-slate-600"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const target = e.currentTarget;
                                handleUrlImageAdd(target.value);
                                target.value = "";
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const input = document.getElementById("urlInput") as HTMLInputElement;
                              if (input) {
                                handleUrlImageAdd(input.value);
                                input.value = "";
                              }
                            }}
                            className="bg-slate-800 text-slate-200 border-transparent text-xs hover:bg-slate-700 h-9"
                          >
                            Add
                          </Button>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">*Supports secure base64 data strings as well as HTTP URLs.</p>
                      </div>
                    </div>

                    {/* Preset Vector Blueprint Generator */}
                    <div className="space-y-3 border-b border-slate-800/60 pb-5">
                      <span className="text-xs font-mono font-semibold text-indigo-400 block flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                        Option C: 1-Click Analytical Vector Presets
                      </span>
                      <div className="grid grid-cols-3 gap-3">
                        {PRESET_DIAGRAMS.map((p, idx) => (
                          <div 
                            key={idx}
                            onClick={() => handleAddPresetDiagram(p.svg)}
                            className="p-3 bg-slate-950 hover:bg-slate-950/70 border border-slate-800 rounded-xl cursor-pointer hover:border-indigo-500/50 transition-all space-y-1 text-left"
                          >
                            <span className="text-[10px] font-mono font-bold text-white block truncate">{p.name}</span>
                            <span className="text-[9px] text-slate-400 block line-clamp-2 leading-snug">{p.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Grid of loaded images */}
                    <div className="space-y-3">
                      <span className="text-xs font-mono font-semibold text-slate-300 block">Loaded Study Assets ({images.length})</span>
                      {images.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {images.map((img, index) => {
                            const isPrimary = index === 0;
                            return (
                              <div key={index} className="group relative aspect-[4/3] rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-md">
                                <img 
                                  src={img} 
                                  alt={`Loaded asset ${index + 1}`} 
                                  className="object-cover w-full h-full"
                                  referrerPolicy="no-referrer"
                                />
                                
                                {/* Overlay hover actions */}
                                <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-mono text-slate-400">
                                      {isPrimary ? "Primary Thumbnail" : `Asset ${index + 1}`}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteImage(index)}
                                      className="p-1 rounded-sm bg-red-950/60 text-red-400 hover:text-red-300 cursor-pointer"
                                      title="Delete Image"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>

                                  {!isPrimary && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetPrimaryImage(index)}
                                      className="w-full text-center py-1 bg-slate-800 hover:bg-slate-700 text-white font-mono text-[9px] rounded-md cursor-pointer transition-colors"
                                    >
                                      Set as Thumbnail
                                    </button>
                                  )}
                                </div>

                                {isPrimary && (
                                  <span className="absolute bottom-1.5 left-1.5 bg-emerald-500 text-slate-950 font-mono font-bold text-[8px] px-1.5 py-0.5 rounded uppercase">
                                    Thumbnail
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-10 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                          No images loaded. Feel free to upload device logs, diagrams, or use presets.
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {/* Wizard Progression Footer buttons */}
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                    className="border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white text-xs font-mono h-9 cursor-pointer"
                    disabled={activeStep === 0}
                  >
                    &larr; Prev Milestone
                  </Button>

                  <span className="text-[10px] font-mono text-slate-500">
                    Step {activeStep + 1} of 5
                  </span>

                  {activeStep < 4 ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setActiveStep(activeStep + 1)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-transparent text-xs font-mono h-9 cursor-pointer"
                    >
                      Next Step &rarr;
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => saveFormState(false)}
                      className="bg-emerald-500 text-slate-950 border-transparent hover:bg-emerald-400 text-xs font-mono h-9 font-semibold cursor-pointer shadow-sm"
                    >
                      Complete & Save
                    </Button>
                  )}
                </div>

              </CardContent>
            </Card>

          </div>
        )}

        {/* RIGHT COLUMN: THE REAL-TIME PREVIEW CONTAINER */}
        {(previewMode === "split" || previewMode === "preview") && (
          <div className={`${previewMode === "preview" ? "w-full max-w-4xl mx-auto" : ""} space-y-4`}>
            
            {/* Simulated browser window wrapper */}
            <div className="rounded-xl border border-slate-800/70 bg-slate-950 overflow-hidden shadow-2xl flex flex-col h-[75vh]">
              {/* Browser control bar */}
              <div className="bg-slate-900 px-4 py-2 border-b border-slate-800/80 flex items-center justify-between no-print">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/80"></span>
                </div>
                <div className="bg-slate-950 text-[10px] font-mono text-slate-400 px-6 py-1 rounded-md border border-slate-800/40 w-1/2 text-center truncate">
                  portfolio-os://draft-case-studies/{draftProject.slug || "preview"}
                </div>
                <Badge variant="status">LIVE PREVIEW</Badge>
              </div>

              {/* Scrollable preview content pane */}
              <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-10 text-slate-900 custom-scrollbar">
                <CaseStudyDetail 
                  project={draftProject} 
                  onNavigate={() => {}} 
                />
              </div>
            </div>

            <p className="text-center font-mono text-[10px] text-slate-500">
              *The live preview renders your in-progress modifications in real time, validating typographical hierarchy and data visuals.
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

// Extracted small composable helper component for loading files in workspace
const UploadFileInput: React.FC<{
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ fileInputRef, onUpload }) => {
  return (
    <>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={onUpload} 
        className="hidden" 
        accept="image/*" 
      />
      <ImageIcon className="w-6 h-6 mx-auto text-slate-500" />
      <span className="text-xs font-semibold text-slate-200 block">Click to select file</span>
      <span className="text-[10px] text-slate-500 block">Supports PNG, JPG, WebP & GIF</span>
    </>
  );
};
