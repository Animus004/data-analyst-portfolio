/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { TechnicalDifficulty } from "../../types";

interface BadgeProps {
  children: string;
  variant?: "default" | "difficulty" | "industry" | "status" | "success";
  difficulty?: TechnicalDifficulty;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  difficulty,
  className = ""
}) => {
  const baseStyles = "inline-flex items-center font-mono font-medium rounded-md tracking-tight uppercase";
  
  let styles = "bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 border border-slate-200/60";

  if (variant === "difficulty" && difficulty) {
    const difficultyColors = {
      [TechnicalDifficulty.BEGINNER]: "bg-emerald-50 text-emerald-700 border-emerald-200/50 text-[9px] px-1.5 py-0.5 border",
      [TechnicalDifficulty.INTERMEDIATE]: "bg-blue-50 text-blue-700 border-blue-200/50 text-[9px] px-1.5 py-0.5 border",
      [TechnicalDifficulty.ADVANCED]: "bg-amber-50 text-amber-700 border-amber-200/50 text-[9px] px-1.5 py-0.5 border",
      [TechnicalDifficulty.EXPERT]: "bg-purple-50 text-purple-700 border-purple-200/50 text-[9px] px-1.5 py-0.5 border"
    };
    styles = difficultyColors[difficulty] || styles;
  } else if (variant === "industry") {
    styles = "bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] px-2 py-0.5";
  } else if (variant === "status") {
    const statusLower = children.toLowerCase();
    if (statusLower === "published") {
      styles = "bg-green-50 text-green-700 border border-green-100 text-[10px] px-2 py-0.5";
    } else if (statusLower === "draft") {
      styles = "bg-amber-50 text-amber-700 border border-amber-100 text-[10px] px-2 py-0.5";
    } else {
      styles = "bg-slate-100 text-slate-600 border border-slate-200 text-[10px] px-2 py-0.5";
    }
  } else if (variant === "success") {
    styles = "bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] px-2 py-0.5";
  }

  return (
    <span className={`${baseStyles} ${styles} ${className}`}>
      {children}
    </span>
  );
};
