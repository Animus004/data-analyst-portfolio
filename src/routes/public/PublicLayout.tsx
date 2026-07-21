/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { CreatorProfile } from "../../types";
import { CustomClock } from "../../components/shared/CustomClock";
import { Button } from "../../components/ui/Button";
import { 
  Github, 
  Linkedin, 
  Mail, 
  Terminal, 
  Briefcase, 
  FileDown, 
  Check, 
  Copy 
} from "lucide-react";

interface PublicLayoutProps {
  children: React.ReactNode;
  profile: CreatorProfile;
  currentTab: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({
  children,
  profile,
  currentTab,
  onNavigate
}) => {
  const [copied, setCopied] = useState(false);

  const copyEmailToClipboard = () => {
    navigator.clipboard.writeText(profile.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col text-slate-800 selection:bg-slate-900 selection:text-white font-sans">
      {/* Sticky Premium Header */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200/50 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Brand/Logo */}
          <div 
            onClick={() => onNavigate("home")} 
            className="flex items-center gap-2.5 cursor-pointer group shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white transition-all duration-300 group-hover:scale-105 group-hover:shadow-xs">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <span className="font-display font-semibold text-sm tracking-tight text-slate-900 block leading-tight">
                {profile.name}
              </span>
              <span className="font-mono text-[9px] uppercase text-slate-400 block leading-none">
                Portfolio OS
              </span>
            </div>
          </div>

          {/* Location Clock & Status */}
          <div className="hidden lg:block shrink-0">
            <CustomClock />
          </div>

          {/* Quick Nav & Call to Actions */}
          <div className="flex items-center gap-1.5 xs:gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onNavigate("home")}
              className={`text-xs font-medium px-2.5 sm:px-3 h-[34px] ${
                currentTab === "home" ? "bg-slate-100 text-slate-950 font-semibold" : "text-slate-600"
              }`}
            >
              Projects
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={copyEmailToClipboard}
              className="inline-flex items-center h-[34px] px-2.5 sm:px-3 text-xs"
              title="Copy email address"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500 animate-bounce" />
                  <span className="hidden xs:inline ml-1 font-medium text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden xs:inline ml-1">Copy Contact</span>
                </>
              )}
            </Button>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => onNavigate("workspace")}
              className="gap-1.5 text-xs h-[34px] px-3 sm:px-4"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Workspace</span>
              <span className="xs:hidden">OS</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>

      {/* Modern, Structured Footer */}
      <footer className="bg-white border-t border-slate-100 mt-16 no-print">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-100">
            {/* Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center text-white font-mono text-xs font-semibold">
                  P
                </div>
                <span className="font-display font-bold text-slate-900 tracking-tight">PORTFOLIO OS</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                A modular portfolio platform built to present real projects, deep methodology, and raw quantitative outcome statistics.
              </p>
            </div>

            {/* Socials & Networking */}
            <div>
              <h4 className="font-display font-semibold text-xs text-slate-900 uppercase tracking-wider mb-3">Networking Connections</h4>
              <div className="flex flex-wrap gap-2">
                {profile.githubUrl && (
                  <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-100 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                    <Github className="w-3.5 h-3.5" /> GitHub
                  </a>
                )}
                {profile.linkedinUrl && (
                  <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-100 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                    <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                  </a>
                )}
                <a href={`mailto:${profile.email}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-100 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                  <Mail className="w-3.5 h-3.5" /> Email Direct
                </a>
              </div>
            </div>

            {/* Availability Widget */}
            <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-display font-semibold text-xs text-slate-900">Immediate Availability</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Currently open to remote and on-site full-time employment roles or technical freelance architecture projects.
              </p>
              <div className="pt-1">
                <a href={`mailto:${profile.email}`} className="text-xs font-semibold text-slate-950 hover:underline">
                  Initiate Discussion &rarr;
                </a>
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-400 text-xs">
            <span>&copy; {new Date().getFullYear()} {profile.name}. All Rights Reserved.</span>
            <span className="font-mono text-[10px]">Built via Google AI Studio Build</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
