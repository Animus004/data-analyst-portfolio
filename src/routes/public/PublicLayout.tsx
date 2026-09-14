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
  Copy,
  X,
  ExternalLink,
  MessageSquare,
  Send
} from "lucide-react";

interface PublicLayoutProps {
  children: React.ReactNode;
  profile: CreatorProfile;
  currentTab: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

interface DiscussionModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: CreatorProfile;
}

const DiscussionModal: React.FC<DiscussionModalProps> = ({ isOpen, onClose, profile }) => {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  if (!isOpen) return null;

  const emailSubject = `Opportunity Discussion - ${profile.name} Data Portfolio`;
  const emailBody = `Hi ${profile.name},\n\nI reviewed your data analyst portfolio and would like to connect regarding an opportunity.\n\nBest regards,`;
  const mailtoUrl = `mailto:${profile.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(profile.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(`To: ${profile.email}\nSubject: ${emailSubject}\n\n${emailBody}`);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      {/* Backdrop click */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden z-10 space-y-5 p-6 sm:p-7 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-mono font-semibold uppercase tracking-wider">
              <MessageSquare className="w-3 h-3" />
              Direct Communication
            </div>
            <h3 className="font-display font-bold text-xl text-slate-900 tracking-tight">
              Initiate Discussion
            </h3>
            <p className="text-xs text-slate-500 font-sans leading-relaxed">
              Connect with {profile.name} for data analytics roles, contract engagements, or technical walkthroughs.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Email Direct Box */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider">
              Primary Email Channel
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Fast Response
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 p-2.5 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="font-mono text-xs sm:text-sm font-semibold text-slate-900 truncate">
                {profile.email}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyEmail}
              className="text-xs gap-1.5 shrink-0 h-8 font-mono cursor-pointer"
            >
              {copiedEmail ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
                  <span className="text-emerald-600 font-semibold">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <a
              href={mailtoUrl}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all duration-200"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Launch Mail Client</span>
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyTemplate}
              className="text-xs gap-1.5 h-[34px] font-mono shrink-0 cursor-pointer"
              title="Copy message draft"
            >
              {copiedTemplate ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-600 text-[11px]">Draft Copied</span>
                </>
              ) : (
                <span className="text-[11px]">Copy Draft</span>
              )}
            </Button>
          </div>
        </div>

        {/* Alternative Channels Grid */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider block">
            Direct Networks & Credentials
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {profile.linkedinUrl && (
              <a
                href={profile.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40 text-xs font-medium text-slate-700 hover:text-indigo-900 transition-all duration-200 group"
              >
                <div className="flex items-center gap-2">
                  <Linkedin className="w-4 h-4 text-indigo-600" />
                  <span>LinkedIn Profile</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
              </a>
            )}

            {profile.githubUrl && (
              <a
                href={profile.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 hover:text-slate-950 transition-all duration-200 group"
              >
                <div className="flex items-center gap-2">
                  <Github className="w-4 h-4 text-slate-900" />
                  <span>GitHub Repositories</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900" />
              </a>
            )}

            {profile.resumeUrl && (
              <a
                href={profile.resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/40 text-xs font-medium text-slate-700 hover:text-emerald-900 transition-all duration-200 group sm:col-span-2"
              >
                <div className="flex items-center gap-2">
                  <FileDown className="w-4 h-4 text-emerald-600" />
                  <span>Download Complete Resume / CV</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
              </a>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>{profile.location}</span>
          <span>Response expected &lt; 24 hrs</span>
        </div>
      </div>
    </div>
  );
};

export const PublicLayout: React.FC<PublicLayoutProps> = ({
  children,
  profile,
  currentTab,
  onNavigate
}) => {
  const [copied, setCopied] = useState(false);
  const [showDiscussionModal, setShowDiscussionModal] = useState(false);

  const copyEmailToClipboard = () => {
    navigator.clipboard.writeText(profile.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col text-slate-800 selection:bg-slate-900 selection:text-white font-sans">
      {/* Sticky Premium Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm transition-all duration-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Brand/Logo */}
          <div 
            onClick={() => onNavigate("home")} 
            className="flex items-center gap-2.5 cursor-pointer group shrink-0"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white transition-all duration-200 group-hover:scale-[1.02] group-hover:shadow-md">
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
              className={`text-xs font-medium px-2.5 sm:px-3 h-[34px] rounded-lg transition-all duration-200 ${
                currentTab === "home" ? "bg-slate-100 text-slate-950 font-semibold shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Projects
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={copyEmailToClipboard}
              className="inline-flex items-center h-[34px] px-2.5 sm:px-3 text-xs cursor-pointer"
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
              className="gap-1.5 text-xs h-[34px] px-3 sm:px-4 cursor-pointer"
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
      <footer className="bg-white border-t border-slate-200 mt-16 no-print">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-200">
            {/* Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-slate-900 flex items-center justify-center text-white font-mono text-xs font-semibold shadow-sm">
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
                  <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:shadow-sm hover:scale-[1.02] transition-all duration-200">
                    <Github className="w-3.5 h-3.5" /> GitHub
                  </a>
                )}
                {profile.linkedinUrl && (
                  <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:shadow-sm hover:scale-[1.02] transition-all duration-200">
                    <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                  </a>
                )}
                <button 
                  type="button"
                  onClick={() => setShowDiscussionModal(true)} 
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:shadow-sm hover:scale-[1.02] transition-all duration-200 cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 text-indigo-600" /> Email Direct
                </button>
              </div>
            </div>

            {/* Availability Widget */}
            <div className="bg-slate-50/80 border border-slate-200 p-5 rounded-2xl space-y-2 shadow-sm transition-all duration-200 hover:shadow-md">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-display font-semibold text-xs text-slate-900">Immediate Availability</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Currently open to remote and on-site full-time employment roles or technical freelance architecture projects.
              </p>
              <div className="pt-1">
                <button 
                  type="button"
                  onClick={() => setShowDiscussionModal(true)} 
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Initiate Discussion &rarr;
                </button>
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-400 text-xs">
            <span>&copy; {new Date().getFullYear()} {profile.name}. All Rights Reserved.</span>
            <span className="font-mono text-[10px]">Built via Google AI Studio Build</span>
          </div>
        </div>
      </footer>

      {/* Interactive Contact & Discussion Modal */}
      <DiscussionModal
        isOpen={showDiscussionModal}
        onClose={() => setShowDiscussionModal(false)}
        profile={profile}
      />
    </div>
  );
};
