/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { ProjectRecord, CreatorProfile, TechnicalDifficulty, ProjectStatus } from "../../types";
import { Badge } from "../../components/ui/Badge";
import { Card, CardContent } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { motion } from "motion/react";
import { normalizeKpiLabel, cleanKpiValue } from "../../utils";
import { Search, SlidersHorizontal, ArrowUpRight, Code, Database, Compass, Eye } from "lucide-react";

interface PublicHomeProps {
  projects: ProjectRecord[];
  profile: CreatorProfile;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

function safeStr(val: any): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && typeof val.value === "string") return val.value;
  return "";
}

function safeArr(val: any): string[] {
  if (Array.isArray(val)) return val.map(safeStr).filter(Boolean);
  if (val && typeof val === "object" && Array.isArray(val.value)) return val.value.map(safeStr).filter(Boolean);
  return [];
}

export const PublicHome: React.FC<PublicHomeProps> = ({
  projects,
  profile,
  onNavigate
}) => {
  const [search, setSearch] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [selectedIndustry, setSelectedIndustry] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Filter only published projects for recruiters
  const publishedProjects = useMemo(() => {
    return (projects || []).filter(p => p && p.status === ProjectStatus.PUBLISHED);
  }, [projects]);

  // Aggregate all unique tags, industries from published projects
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    publishedProjects.forEach(p => safeArr(p.tags).forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [publishedProjects]);

  const availableIndustries = useMemo(() => {
    const industries = new Set<string>();
    publishedProjects.forEach(p => {
      const ind = safeStr(p.industry);
      if (ind) industries.add(ind);
    });
    return Array.from(industries);
  }, [publishedProjects]);

  const quickStackSkills = useMemo(() => {
    if (profile.quickStackSkills && profile.quickStackSkills.length > 0) {
      return profile.quickStackSkills;
    }
    return [
      "Excel",
      "SQL",
      "Power BI",
      "Python",
      "Business Intelligence",
      "Dashboard Design",
      "Data Cleaning",
      "Data Visualization"
    ];
  }, [profile.quickStackSkills]);

  // Perform multi-dimensional client-side filtering safely
  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return publishedProjects.filter((p) => {
      const pTitle = safeStr(p.title);
      const pSummary = safeStr(p.summary);
      const pIndustry = safeStr(p.industry);
      const pTags = safeArr(p.tags);
      const pDiff = safeStr(p.difficulty);

      const matchesSearch = !q ||
        pTitle.toLowerCase().includes(q) ||
        pSummary.toLowerCase().includes(q) ||
        pIndustry.toLowerCase().includes(q) ||
        pTags.some(t => t.toLowerCase().includes(q));
        
      const matchesDifficulty = 
        selectedDifficulty === "all" || pDiff === selectedDifficulty;
        
      const matchesTag = 
        selectedTag === "all" || pTags.includes(selectedTag);
        
      const matchesIndustry = 
        selectedIndustry === "all" || pIndustry === selectedIndustry;

      return matchesSearch && matchesDifficulty && matchesTag && matchesIndustry;
    });
  }, [publishedProjects, search, selectedDifficulty, selectedTag, selectedIndustry]);

  // Framer Motion presets for staggered container animation
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  };

  return (
    <div className="space-y-12">
      {/* Visual Identity Hero Section */}
      <section className="py-10 md:py-16 border-b border-slate-200/50 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 items-start">
          <div className="md:col-span-2 space-y-6">
            <h1 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl text-slate-900 tracking-tight leading-[1.08]">
              Howdy, I'm <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-950 via-slate-800 to-slate-500">{profile.name}</span>.
            </h1>
            
            <p className="font-display font-medium text-xl sm:text-2xl text-slate-600 leading-relaxed max-w-3xl lg:max-w-4xl">
              {profile.title}
            </p>
            
            <p className="font-sans text-base text-slate-500 leading-relaxed max-w-3xl lg:max-w-4xl font-light">
              {profile.bio}
            </p>

            <div className="space-y-4 pt-4">
              <div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const element = document.getElementById("projects-section");
                    element?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="gap-2 font-mono text-xs text-slate-600 border-slate-200 hover:border-slate-350"
                >
                  <Database className="w-3.5 h-3.5 text-slate-400" />
                  {profile.heroCtaText || "Explore Case Studies"} ({publishedProjects.length})
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                  {profile.location}
                </span>
                <span className="text-slate-200 dark:text-slate-800 hidden sm:inline">&bull;</span>
                <span className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-500 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {profile.lookingForJob ? (profile.statusBadge || "Open to Opportunities") : "Offline"}
                </span>
                <span className="text-slate-200 dark:text-slate-800 hidden sm:inline">&bull;</span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                  {publishedProjects.length} Published Projects
                </span>
              </div>
            </div>
          </div>

          <div className="md:col-span-1">
            <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs p-5 space-y-4 rounded-xl">
              <div className="flex items-center justify-between pb-1">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">SYSTEM METADATA</span>
                  <h4 className="font-display font-bold text-xs text-slate-900 dark:text-slate-100">Portfolio Snapshot</h4>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-mono font-medium rounded-full border border-emerald-200/20 dark:border-emerald-800/20">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  Live
                </div>
              </div>
              
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500 uppercase block tracking-wider mb-0.5">Current Focus</span>
                    <p className="text-xs font-sans font-semibold text-slate-800 dark:text-slate-200">{profile.currentFocus || "Data Analytics"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500 uppercase block tracking-wider mb-0.5">Target Role</span>
                    <p className="text-xs font-sans font-semibold text-slate-800 dark:text-slate-200">{profile.targetRole || "Data Analyst"}</p>
                  </div>
                </div>
                
                <div>
                  <span className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500 uppercase block tracking-wider mb-1">Core Skills</span>
                  <div className="flex flex-wrap gap-1">
                    {quickStackSkills.slice(0, 4).map((skill) => (
                      <span key={skill} className="px-1.5 py-0.5 bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800 rounded text-[9px] font-mono text-slate-600 dark:text-slate-400">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500 uppercase block tracking-wider mb-0.5">Currently Learning</span>
                    <p className="text-xs font-sans font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      {profile.currentlyLearning || "Python"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500 uppercase block tracking-wider mb-0.5">Location</span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate block" title={profile.location}>
                      {profile.location.split(',')[0]}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500 uppercase block tracking-wider mb-0.5">Case Studies</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{publishedProjects.length} Published</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500 uppercase block tracking-wider mb-0.5">Availability</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-sans font-bold text-emerald-600 dark:text-emerald-500">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      {profile.lookingForJob ? "Active" : "Offline"}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Grid Filter Panel */}
      <section id="projects-section" className="space-y-6 pt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-2xl text-slate-900 tracking-tight">Structured Case Studies</h2>
            <p className="font-sans text-xs text-slate-400 leading-relaxed mt-1">
              Deep dives demonstrating system-architecture designs, core code snippets, and quantifiable business outcomes.
            </p>
          </div>

          {/* Search Controls */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full sm:w-72 group">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stacks, tags, industries..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-hidden focus:ring-4 focus:ring-slate-950/5 focus:border-slate-950 hover:border-slate-350 transition-all font-sans shadow-xs"
              />
            </div>
            
            <Button
              variant={showFilters ? "primary" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-1.5 text-xs h-[36px] shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
            </Button>
          </div>
        </div>

        {/* Quick Tech Tag Filters for High-Speed Recruiter Experience */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mr-2 block">Quick Stack:</span>
            {["all", ...quickStackSkills].map((tag) => {
              const isSelected = selectedTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3 py-1 text-[11px] font-mono rounded-full border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-slate-950 border-slate-950 text-white font-semibold shadow-xs"
                      : "bg-white border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-350"
                  }`}
                >
                  {tag === "all" ? "Show All" : tag}
                </button>
              );
            })}
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 self-start sm:self-center">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-pulse"></span>
            Showing <strong className="text-slate-700 font-semibold">{filteredProjects.length}</strong> of <strong className="text-slate-700 font-semibold">{publishedProjects.length}</strong> Case Studies
          </div>
        </div>

        {/* Expandable Advanced Filters */}
        {showFilters && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-white border border-slate-200/80 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-5 shadow-xs"
          >
            {/* Tech Stack filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">Technology Stack</label>
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg text-xs outline-hidden text-slate-700 cursor-pointer focus:ring-4 focus:ring-slate-950/5 focus:border-slate-950 transition-all font-sans"
              >
                <option value="all">All Stacks</option>
                {availableTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>

            {/* Industry Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">Business Industry</label>
              <select
                value={selectedIndustry}
                onChange={(e) => setSelectedIndustry(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg text-xs outline-hidden text-slate-700 cursor-pointer focus:ring-4 focus:ring-slate-950/5 focus:border-slate-950 transition-all font-sans"
              >
                <option value="all">All Industries</option>
                {availableIndustries.map(ind => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>

            {/* Technical Difficulty Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">Technical Complexity</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg text-xs outline-hidden text-slate-700 cursor-pointer focus:ring-4 focus:ring-slate-950/5 focus:border-slate-950 transition-all font-sans"
              >
                <option value="all">All Levels</option>
                <option value={TechnicalDifficulty.BEGINNER}>Beginner</option>
                <option value={TechnicalDifficulty.INTERMEDIATE}>Intermediate</option>
                <option value={TechnicalDifficulty.ADVANCED}>Advanced</option>
                <option value={TechnicalDifficulty.EXPERT}>Expert / Systems Architect</option>
              </select>
            </div>
          </motion.div>
        )}

        {/* Dynamic Project Grid */}
        {filteredProjects.length > 0 ? (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {filteredProjects.map((project) => (
              <motion.div key={project.id} variants={itemVariants}>
                <Card 
                  hoverable 
                  className="group flex flex-col h-full border-slate-200/60 bg-white shadow-xs"
                  onClick={() => onNavigate("project", { id: project.id })}
                >
                  <CardContent className="p-6 flex flex-col justify-between h-full space-y-6">
                    {/* Header: Industry & Difficulty */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="industry">{safeStr(project.industry)}</Badge>
                        <Badge variant="difficulty" difficulty={safeStr(project.difficulty)}>
                          {safeStr(project.difficulty)}
                        </Badge>
                      </div>

                      {/* Project Title */}
                      <h3 className="font-display font-bold text-xl text-slate-900 group-hover:text-slate-950 transition-colors tracking-tight line-clamp-1">
                        {safeStr(project.title)}
                      </h3>
                      <p className="font-mono text-[11px] text-slate-400 leading-none">
                        {safeStr(project.role)} &bull; {safeStr(project.duration)}
                      </p>
                    </div>

                    {/* Summary text */}
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 font-sans font-light">
                      {safeStr(project.summary)}
                    </p>

                    {/* High-Impact Mini Dashboard Metrics */}
                    <div className="grid grid-cols-3 gap-3 bg-slate-50/70 p-3.5 rounded-lg border border-slate-100">
                      {(project.metrics || []).slice(0, 3).map((metric, mIdx) => {
                        const normLabel = normalizeKpiLabel(safeStr(metric.label));
                        const cleanVal = cleanKpiValue(safeStr(metric.value), normLabel);
                        return (
                          <div key={metric.id || mIdx} className="text-center space-y-0.5 border-r last:border-r-0 border-slate-200/50">
                            <span className="block text-sm font-bold text-slate-900 tracking-tight leading-none">
                              {cleanVal}
                            </span>
                            <span className="block text-[9px] font-mono font-medium text-slate-400 uppercase tracking-tight line-clamp-1 leading-none mt-1">
                              {normLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom Tech Tags & Navigation Action */}
                    <div className="flex items-center justify-between pt-3.5 border-t border-slate-100">
                      <div className="flex flex-wrap gap-1.5 max-w-[70%]">
                        {safeArr(project.tags).slice(0, 3).map((tag) => (
                          <span 
                            key={tag} 
                            className="inline-flex items-center text-[9px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200/30"
                          >
                            {tag}
                          </span>
                        ))}
                        {safeArr(project.tags).length > 3 && (
                          <span className="text-[9px] font-mono text-slate-400 self-center">
                            +{safeArr(project.tags).length - 3}
                          </span>
                        )}
                      </div>
                      
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 group-hover:text-slate-950 transition-colors shrink-0">
                        Read Case Study
                        <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:rotate-45 transition-all duration-300" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="py-20 text-center border border-dashed border-slate-200 rounded-2xl bg-white/50 backdrop-blur-xs shadow-xs max-w-lg mx-auto p-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="font-display font-bold text-slate-900 text-lg">No Matching Case Studies</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed font-light">
                We couldn't find any projects matching those filters. Try adjusting your tags, industries, or keywords to view the complete engineering portfolio.
              </p>
            </div>
            <div className="pt-2">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => {
                  setSearch("");
                  setSelectedDifficulty("all");
                  setSelectedTag("all");
                  setSelectedIndustry("all");
                }}
                className="font-mono text-xs"
              >
                Reset Filter Settings
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
