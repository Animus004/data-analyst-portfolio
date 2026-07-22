/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { ProjectRecord, CreatorProfile, ProjectStatus, SyncStatus } from "./types";
import { defaultCreatorProfile, seedProjects } from "./data/seedData";
import { PublicLayout } from "./routes/public/PublicLayout";
import { PublicHome } from "./routes/public/PublicHome";
import { CaseStudyDetail } from "./routes/public/CaseStudyDetail";
import { WorkspaceLayout } from "./routes/workspace/WorkspaceLayout";
import { CommandCenter } from "./routes/workspace/CommandCenter";
import { CaseStudyBuilder } from "./routes/workspace/CaseStudyBuilder";
import { storageService } from "./services/storageService";
import { motion, AnimatePresence } from "motion/react";
import { Terminal, Cpu, HardDrive } from "lucide-react";

export default function App() {
  // 1. Core State Managers
  const [profile, setProfile] = useState<CreatorProfile>(defaultCreatorProfile);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isBooting, setIsBooting] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);
  const [bootLogs, setBootLogs] = useState<string[]>([]);

  // 2. Client Parameter-Driven Router state
  // page values: "home" | "project" | "workspace"
  const [currentRoute, setCurrentRoute] = useState<{ page: string; params?: Record<string, string> }>({
    page: "home"
  });

  // 3. Workspace Inner State management
  const [workspaceTab, setWorkspaceTab] = useState<"dashboard" | "builder">("dashboard");
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);

  // 4. Supabase Direct Sync Status Manager
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    status: "synced",
    lastSyncTime: localStorage.getItem("portfolio_os_last_sync_time") || null,
    errorMsg: null
  });

  // Load state on mount using the decoupled storage service
  useEffect(() => {
    // 1. Initial local fallback (for immediate rendering / backward compatibility)
    storageService.migrateIfNeeded();
    const cachedProfile = storageService.loadProfile();
    const cachedProjects = storageService.loadProjects();
    setProfile(cachedProfile);
    setProjects(cachedProjects);

    // 2. Fetch primary source of truth from server asynchronously
    const syncWithServer = async () => {
      setSyncStatus(prev => ({ ...prev, status: "pending", errorMsg: null }));
      const serverData = await storageService.fetchFromServer();
      if (serverData) {
        setProfile(serverData.profile);
        setProjects(serverData.projects);
        const now = new Date().toLocaleTimeString();
        localStorage.setItem("portfolio_os_last_sync_time", now);
        setSyncStatus({
          status: "synced",
          lastSyncTime: now,
          errorMsg: null
        });
      } else {
        const now = new Date().toLocaleTimeString();
        const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
        setSyncStatus({
          status: isOffline ? "offline" : "failed",
          lastSyncTime: localStorage.getItem("portfolio_os_last_sync_time") || null,
          errorMsg: isOffline 
            ? "Offline Mode: Using local storage cache." 
            : "Cloud Connection Pending: Working with local cache."
        });
      }
    };
    syncWithServer();

    // Cinematic boot sequence timer
    const logs = [
      "INITIALIZING PORTFOLIO OS HYPERVISOR v3.4...",
      "MOUNTING CRYPTO-SECURE STORAGE SERVICES...",
      "FETCHING PUBLISHED SYSTEM CASE STUDIES...",
      "CHECKING RECRUITER METRIC AUDITING MATRIX...",
      "OS KERNEL BOOT SEQUENCE COMPLETED SUCCESSFULLY."
    ];

    let currentProg = 0;
    const interval = setInterval(() => {
      currentProg += Math.floor(Math.random() * 12) + 5;
      if (currentProg >= 100) {
        currentProg = 100;
        clearInterval(interval);
        setTimeout(() => {
          setIsBooting(false);
        }, 200);
      }
      setBootProgress(currentProg);

      // Dynamically add logs based on progress threshold
      const logIdx = Math.min(Math.floor((currentProg / 100) * logs.length), logs.length - 1);
      setBootLogs((prev) => {
        const nextLog = logs[logIdx];
        if (!prev.includes(nextLog)) {
          return [...prev, nextLog];
        }
        return prev;
      });
    }, 60);

    return () => clearInterval(interval);
  }, []);

  // Helper to trigger direct Supabase Cloud Sync
  const triggerCloudSync = async (pProfile: CreatorProfile, pProjects: ProjectRecord[]): Promise<{ success: boolean; error?: string }> => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncStatus(prev => ({
        status: "offline",
        lastSyncTime: prev.lastSyncTime,
        errorMsg: "Offline Mode: Changes saved locally but cloud sync is pending internet connection."
      }));
      return { success: true };
    }

    setSyncStatus(prev => ({ ...prev, status: "pending", errorMsg: null }));
    
    try {
      const result = await storageService.saveToServer(pProfile, pProjects);
      if (result.success) {
        const now = new Date().toLocaleTimeString();
        localStorage.setItem("portfolio_os_last_sync_time", now);
        setSyncStatus({
          status: "synced",
          lastSyncTime: now,
          errorMsg: null
        });
        return { success: true };
      } else {
        setSyncStatus(prev => ({
          status: "failed",
          lastSyncTime: prev.lastSyncTime,
          errorMsg: result.error || "Database synchronization failed."
        }));
        return { success: false, error: result.error || "Database synchronization failed." };
      }
    } catch (e: any) {
      const errStr = e.message || "An unexpected error occurred during cloud sync.";
      setSyncStatus(prev => ({
        status: "failed",
        lastSyncTime: prev.lastSyncTime,
        errorMsg: errStr
      }));
      return { success: false, error: errStr };
    }
  };

  // Update states helper and sync via storage service
  const handleSaveProfile = (updatedProfile: CreatorProfile) => {
    setProfile(updatedProfile);
    storageService.saveProfile(updatedProfile);
    triggerCloudSync(updatedProfile, projects);
  };

  const handleSaveProjects = (updatedProjects: ProjectRecord[]) => {
    setProjects(updatedProjects);
    storageService.saveProjects(updatedProjects);
    triggerCloudSync(profile, updatedProjects);
  };

  // Create or Update a project
  const handleSaveProjectRecord = (record: ProjectRecord) => {
    const exists = projects.some(p => p.id === record.id);
    let updated: ProjectRecord[];
    if (exists) {
      updated = projects.map(p => p.id === record.id ? record : p);
    } else {
      updated = [record, ...projects];
    }
    handleSaveProjects(updated);
    setWorkspaceTab("dashboard");
    setEditingProject(null);
  };

  const handleDeleteProjectRecord = (id: string) => {
    const updated = projects.filter(p => p.id !== id);
    handleSaveProjects(updated);
  };

  // Restore dynamic backup configurations
  const handleImportBackup = (jsonString: string): boolean => {
    const imported = storageService.importBackup(jsonString);
    if (imported) {
      setProfile(imported.profile);
      setProjects(imported.projects);
      triggerCloudSync(imported.profile, imported.projects);
      return true;
    }
    return false;
  };

  // Primary import handler for verified files
  const handleImportData = (importedProfile: CreatorProfile, importedProjects: ProjectRecord[]) => {
    setProfile(importedProfile);
    setProjects(importedProjects);
    storageService.saveProfile(importedProfile);
    storageService.saveProjects(importedProjects);
    triggerCloudSync(importedProfile, importedProjects);
  };

  const handleNavigate = (page: string, params?: Record<string, string>) => {
    setCurrentRoute({ page, params });
    // Scroll smoothly back to top when switching views
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Workspace trigger helpers
  const handleAddNewProjectClick = () => {
    setEditingProject(null);
    setWorkspaceTab("builder");
    handleNavigate("workspace");
  };

  const handleEditProjectClick = (id: string) => {
    const projectToEdit = projects.find(p => p.id === id);
    if (projectToEdit) {
      setEditingProject(projectToEdit);
      setWorkspaceTab("builder");
      handleNavigate("workspace");
    }
  };

  const handleCancelBuilder = () => {
    setEditingProject(null);
    setWorkspaceTab("dashboard");
  };

  // Dynamic Route Rendering Engine
  const renderRoute = () => {
    switch (currentRoute.page) {
      case "home":
        return (
          <PublicLayout 
            profile={profile} 
            currentTab="home" 
            onNavigate={handleNavigate}
          >
            <PublicHome 
              projects={projects} 
              profile={profile} 
              onNavigate={handleNavigate} 
            />
          </PublicLayout>
        );

      case "project":
        const projectId = currentRoute.params?.id;
        const currentProject = projects.find(p => p.id === projectId);
        if (!currentProject) {
          return (
            <PublicLayout profile={profile} currentTab="home" onNavigate={handleNavigate}>
              <div className="py-12 text-center text-slate-500 font-sans">
                <p>Case study record not found or has been archived.</p>
                <button 
                  onClick={() => handleNavigate("home")} 
                  className="mt-3 text-sm text-indigo-600 underline font-semibold"
                >
                  Return to Home
                </button>
              </div>
            </PublicLayout>
          );
        }
        return (
          <PublicLayout profile={profile} currentTab="home" onNavigate={handleNavigate}>
            <CaseStudyDetail 
              project={currentProject} 
              onNavigate={handleNavigate} 
            />
          </PublicLayout>
        );

      case "workspace":
        return (
          <WorkspaceLayout 
            profile={profile} 
            projects={projects} 
            currentTab={workspaceTab}
            onNavigate={handleNavigate}
            onAddNewProject={handleAddNewProjectClick}
            syncStatus={syncStatus}
            onManualSyncRetry={() => triggerCloudSync(profile, projects)}
          >
            {workspaceTab === "dashboard" ? (
              <CommandCenter 
                projects={projects}
                profile={profile}
                onEditProject={handleEditProjectClick}
                onDeleteProject={handleDeleteProjectRecord}
                onAddNewProject={handleAddNewProjectClick}
                onSaveProfile={handleSaveProfile}
                onImportBackup={handleImportBackup}
                onSaveProjects={handleSaveProjects}
                onImportData={handleImportData}
                syncStatus={syncStatus}
                onManualSyncRetry={() => triggerCloudSync(profile, projects)}
              />
            ) : (
              <CaseStudyBuilder 
                project={editingProject}
                onSave={handleSaveProjectRecord}
                onCancel={handleCancelBuilder}
              />
            )}
          </WorkspaceLayout>
        );

      default:
        return (
          <div className="min-h-screen flex items-center justify-center font-sans text-slate-500 text-sm">
            404 Route Not Registered.
          </div>
        );
    }
  };

  return (
    <AnimatePresence mode="wait">
      {isBooting ? (
        <motion.div
          key="bootloader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4, ease: "easeInOut" } }}
          className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 font-sans select-none"
        >
          <div className="max-w-md w-full space-y-8">
            {/* Header section with brand */}
            <div className="text-center space-y-2">
              <div className="inline-flex p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-cyan-400 animate-pulse shadow-[0_0_20px_rgba(34,211,238,0.05)]">
                <Terminal className="w-8 h-8" />
              </div>
              <h1 className="font-display font-bold text-3xl tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 mt-2">
                PORTFOLIO OS
              </h1>
              <p className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">
                Core System Bootloader // Active Session
              </p>
            </div>

            {/* Circular Progress or Bar Progress */}
            <div className="space-y-3">
              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/50">
                <motion.div 
                  className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" 
                  style={{ width: `${bootProgress}%` }}
                />
              </div>
              <div className="flex justify-between font-mono text-[11px] text-slate-400">
                <span>SYSTEM DIAGNOSIS</span>
                <span className="font-bold text-cyan-400">{bootProgress}%</span>
              </div>
            </div>

            {/* Terminal Log Output */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 h-48 overflow-y-auto space-y-2.5 font-mono text-[10px] text-slate-400 shadow-inner">
              {bootLogs.map((log, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-cyan-500 shrink-0 select-none">&gt;</span>
                  <span className={index === bootLogs.length - 1 ? "text-slate-200 animate-pulse" : ""}>{log}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-cyan-400/80 pt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                <span>SYSTEM SECURE. READY_</span>
              </div>
            </div>

            {/* Metadata Footer */}
            <div className="flex justify-around text-slate-600 font-mono text-[9px] uppercase tracking-wider pt-2 border-t border-slate-900">
              <div className="flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" />
                <span>MEM_ACTIVE</span>
              </div>
              <div className="flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5" />
                <span>DISK_OK</span>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="app-content"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }}
          className="min-h-screen"
        >
          {renderRoute()}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
