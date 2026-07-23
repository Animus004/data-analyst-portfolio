/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ProjectRecord, CreatorProfile, ProjectStatus, SyncStatus } from "../../types";
import { Button } from "../../components/ui/Button";
import { 
  Briefcase, 
  Terminal, 
  Layout, 
  Settings, 
  PlusCircle, 
  Database, 
  ArrowLeft,
  FileCode,
  ShieldCheck
} from "lucide-react";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  profile: CreatorProfile;
  projects: ProjectRecord[];
  currentTab: "dashboard" | "builder";
  onNavigate: (page: string, params?: Record<string, string>) => void;
  onAddNewProject: () => void;
  syncStatus?: SyncStatus;
  onManualSyncRetry?: () => void;
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  children,
  profile,
  projects,
  currentTab,
  onNavigate,
  onAddNewProject,
  syncStatus,
  onManualSyncRetry
}) => {
  
  // Calculate quick database statistics
  const totalCount = projects.length;
  const publishedCount = projects.filter(p => p.status === ProjectStatus.PUBLISHED).length;
  const draftCount = projects.filter(p => p.status === ProjectStatus.DRAFT).length;

  return (
    <div className="dark min-h-screen bg-slate-900 text-slate-100 flex font-sans selection:bg-slate-700 selection:text-white">
      {/* Sidebar navigation */}
      <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col justify-between p-5 shrink-0 hidden md:flex">
        <div className="space-y-8">
          
          {/* Header Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white text-slate-950 flex items-center justify-center font-bold">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <span className="font-display font-bold text-sm tracking-tight text-white block">
                Portfolio OS
              </span>
              <span className="font-mono text-[9px] uppercase text-slate-500 block">
                Private Workspace
              </span>
            </div>
          </div>

          {/* Nav groups */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-mono font-bold text-slate-600 uppercase tracking-widest block mb-2">
              Console Engine
            </span>
            
            <Button
              variant={currentTab === "dashboard" ? "primary" : "ghost"}
              className={`w-full justify-start text-xs font-mono h-9 ${
                currentTab === "dashboard" ? "bg-slate-800 text-white hover:bg-slate-800" : "text-slate-400 hover:text-white"
              }`}
              onClick={() => onNavigate("workspace")}
            >
              <Layout className="w-4 h-4 text-slate-400" />
              Command Center
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start text-xs font-mono h-9 text-slate-400 hover:text-white"
              onClick={onAddNewProject}
            >
              <PlusCircle className="w-4 h-4 text-slate-400" />
              Create Case Study
            </Button>
          </div>

          {/* Quick Metrics */}
          <div className="space-y-3 pt-4 border-t border-slate-800/80">
            <span className="text-[9px] font-mono font-bold text-slate-600 uppercase tracking-widest block">
              Resource Telemetry
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-center shadow-sm hover:border-slate-700 hover:shadow-md transition-all duration-200">
                <span className="text-xs text-slate-500 font-mono block">Published</span>
                <span className="text-lg font-bold text-emerald-400">{publishedCount}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-center shadow-sm hover:border-slate-700 hover:shadow-md transition-all duration-200">
                <span className="text-xs text-slate-500 font-mono block">Drafts</span>
                <span className="text-lg font-bold text-amber-400">{draftCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace Footer links */}
        <div className="space-y-3">
          {syncStatus && (
            <div className="p-3 bg-slate-900/50 border border-slate-800/60 rounded-xl space-y-1.5 shadow-sm hover:border-slate-700 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                  <span>CLOUD SYNC</span>
                </div>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                  syncStatus.status === "synced" ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" :
                  syncStatus.status === "pending" ? "bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.4)]" :
                  syncStatus.status === "offline" ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]" : 
                  "bg-rose-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]"
                }`} />
              </div>
              <p className="text-[9px] text-slate-400 leading-normal font-sans">
                {syncStatus.status === "synced" && `Database fully synchronized to Supabase Cloud.`}
                {syncStatus.status === "pending" && `Uploading payloads to Supabase...`}
                {syncStatus.status === "offline" && `Offline mode: saved locally. Pending network.`}
                {syncStatus.status === "failed" && (syncStatus.errorMsg || `Sync failed. Database is offline or unconfigured.`)}
              </p>
              {syncStatus.lastSyncTime && (
                <div className="text-[8px] font-mono text-slate-500">
                  Last Sync: {syncStatus.lastSyncTime}
                </div>
              )}
              {syncStatus.status === "failed" && onManualSyncRetry && (
                <button
                  onClick={onManualSyncRetry}
                  className="w-full mt-1 py-1 px-2 rounded bg-rose-950/40 border border-rose-900/60 hover:bg-rose-900/80 hover:border-rose-700 text-rose-300 hover:text-white text-[9px] font-mono font-bold transition-all text-center cursor-pointer"
                >
                  RETRY CLOUD SYNC
                </button>
              )}
            </div>
          )}

          <div className="p-3 bg-slate-900/50 border border-slate-800/60 rounded-xl space-y-1 shadow-sm hover:border-slate-700 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>SECURITY ACTIVE</span>
            </div>
            <p className="text-[9px] text-slate-500 leading-relaxed">
              Client local state is verified. Local storage sync is operational.
            </p>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onNavigate("home")}
            className="w-full gap-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white border-slate-800 font-mono"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Exit to Public
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950/40">
        {/* Top bar for mobile and general actions */}
        <header className="h-16 border-b border-slate-800 bg-slate-950 px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <h2 className="font-display font-bold text-sm text-white tracking-tight flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-slate-400" />
              {currentTab === "dashboard" ? "SaaS Dashboard Engine" : "Guided Case Study Builder"}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onNavigate("home")}
              className="md:hidden text-xs text-slate-300 border-slate-800"
            >
              Exit
            </Button>
            <span className="text-xs text-slate-500 font-mono hidden sm:inline">
              Host: portfolio.os
            </span>
          </div>
        </header>

        {/* Content body */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 pb-24 md:pb-8 space-y-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Sticky Mobile Footer Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 px-6 flex items-center justify-around md:hidden">
        <button 
          onClick={() => onNavigate("workspace")}
          className={`flex flex-col items-center gap-1.5 text-[10px] font-mono tracking-tight transition-colors cursor-pointer ${
            currentTab === "dashboard" ? "text-white" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Layout className="w-4.5 h-4.5" />
          <span>Dashboard</span>
        </button>
        <button 
          onClick={onAddNewProject}
          className={`flex flex-col items-center gap-1.5 text-[10px] font-mono tracking-tight transition-colors cursor-pointer ${
            currentTab === "builder" ? "text-white" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <PlusCircle className="w-4.5 h-4.5" />
          <span>New Case</span>
        </button>
        <button 
          onClick={() => onNavigate("home")}
          className="flex flex-col items-center gap-1.5 text-[10px] font-mono tracking-tight text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
          <span>Exit OS</span>
        </button>
      </nav>
    </div>
  );
};
