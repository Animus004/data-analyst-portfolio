/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  onClick,
  hoverable = false
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  };

  const hasCustomBg = className.includes("bg-");
  const hasCustomBorder = className.includes("border-") || className.includes("border ");
  const hasCustomText = className.includes("text-");

  const defaultBg = hasCustomBg ? "" : "bg-white dark:bg-slate-950/60";
  const defaultBorder = hasCustomBorder ? "" : "border border-slate-200/80 dark:border-slate-800/80";
  const defaultText = hasCustomText ? "" : "text-slate-900 dark:text-slate-100";

  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`rounded-xl overflow-hidden transition-all duration-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950 dark:focus-visible:ring-slate-100 focus-visible:ring-offset-2 ${defaultBg} ${defaultBorder} ${defaultText} ${
        hoverable ? "hover:shadow-md hover:border-slate-300/80 dark:hover:border-slate-700 hover:-translate-y-[2px]" : ""
      } ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ""
}) => {
  const hasCustomBorder = className.includes("border-") || className.includes("border ");
  const defaultBorder = hasCustomBorder ? "" : "border-b border-slate-100 dark:border-slate-850";
  return <div className={`px-6 py-4 ${defaultBorder} ${className}`}>{children}</div>;
};

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ""
}) => {
  const hasCustomText = className.includes("text-");
  const defaultText = hasCustomText ? "" : "text-slate-900 dark:text-slate-100";
  return (
    <h3 className={`font-display font-semibold text-lg tracking-tight ${defaultText} ${className}`}>
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ""
}) => {
  const hasCustomText = className.includes("text-");
  const defaultText = hasCustomText ? "" : "text-slate-500 dark:text-slate-400";
  return (
    <p className={`font-sans text-xs mt-1 leading-relaxed ${defaultText} ${className}`}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ""
}) => {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
};

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ""
}) => {
  const hasCustomBg = className.includes("bg-");
  const hasCustomBorder = className.includes("border-") || className.includes("border ");
  
  const defaultBg = hasCustomBg ? "" : "bg-slate-50/50 dark:bg-slate-950/40";
  const defaultBorder = hasCustomBorder ? "" : "border-t border-slate-100 dark:border-slate-850";
  return <div className={`px-6 py-4 ${defaultBg} ${defaultBorder} ${className}`}>{children}</div>;
};
