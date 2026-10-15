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

function getRouteFromLocation(): { page: string; params?: Record<string, string> } {
  if (typeof window === "undefined") return { page: "home" };
  const pathname = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();

  if (pathname.includes("/workspace") || hash.includes("workspace")) {
    return { page: "workspace" };
  }
  if (pathname.startsWith("/project/")) {
    const id = window.location.pathname.replace(/^\/project\//, "").replace(/\/$/, "");
    if (id) return { page: "project", params: { id } };
  }
  if (hash.startsWith("#project/")) {
    const id = hash.replace(/^#project\//, "").replace(/\/$/, "");
    if (id) return { page: "project", params: { id } };
  }
  return { page: "home" };
}

export default function App() {
  // 1. Core State Managers
  const [profile, setProfile] = useState<CreatorProfile>(defaultCreatorProfile);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);

  // 2. Client Parameter-Driven Router state
  const [currentRoute, setCurrentRoute] = useState<{ page: string; params?: Record<string, string> }>(getRouteFromLocation);

  // 3. Workspace Inner State management
  const [workspaceTab, setWorkspaceTab] = useState<"dashboard" | "builder">("dashboard");
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);

  // 4. Supabase Direct Sync Status Manager
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    status: "synced",
    lastSyncTime: localStorage.getItem("portfolio_os_last_sync_time") || null,
    errorMsg: null
  });

  // Listen to browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(getRouteFromLocation());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Load state on mount using the decoupled storage service
  useEffect(() => {
    // 1. Initial local fallback (immediate rendering without loading screen)
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
          status: isOffline ? "offline" : "synced",
          lastSyncTime: localStorage.getItem("portfolio_os_last_sync_time") || now,
          errorMsg: null
        });
      }
    };
    syncWithServer();
  }, []);

  // Helper to trigger direct Cloud Sync
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
      updated = [...projects, record];
    }
    const normalized = updated
      .map((p, idx) => ({ ...p, order: p.order ?? idx }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    handleSaveProjects(normalized);
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
    if (typeof window !== "undefined") {
      let url = "/";
      if (page === "workspace") {
        url = "/workspace";
      } else if (page === "project" && params?.id) {
        url = `/project/${params.id}`;
      }
      window.history.pushState({}, "", url);
    }
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
        const currentProject = projects.find(p => p.id === projectId || p.slug === projectId);
        if (!currentProject) {
          return (
            <PublicLayout profile={profile} currentTab="home" onNavigate={handleNavigate}>
              <div className="py-12 text-center text-slate-500 font-sans">
                <p>Case study record not found or has been archived.</p>
                <button 
                  onClick={() => handleNavigate("home")} 
                  className="mt-3 text-sm text-indigo-600 underline font-semibold cursor-pointer"
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
    <motion.div
      key="app-content"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.25 } }}
      className="min-h-screen"
    >
      {renderRoute()}
    </motion.div>
  );
}

