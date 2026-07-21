/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { generateId } from "../../utils";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: React.ReactNode;
  options: SelectOption[];
  error?: string;
  helperText?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  error,
  helperText,
  className = "",
  id,
  ...props
}) => {
  const inputId = id || generateId("select");

  // Parse custom classes to avoid conflicts with defaults
  const hasCustomBg = className.includes("bg-");
  const hasCustomBorder = className.includes("border-") || className.includes("border ");
  const hasCustomText = className.includes("text-") && !className.includes("text-xs") && !className.includes("text-sm");
  const hasCustomFontSize = className.includes("text-xs") || className.includes("text-sm") || className.includes("text-lg");

  const baseClasses = "px-3.5 py-2.5 font-sans rounded-lg shadow-xs transition-all duration-200 outline-hidden focus:ring-4 cursor-pointer w-full";
  
  const defaultBg = hasCustomBg ? "" : "bg-white dark:bg-slate-950";
  const defaultBorder = hasCustomBorder ? "" : error 
    ? "border-red-500 focus:border-red-500 focus:ring-red-500/10 dark:focus:ring-red-500/5" 
    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-slate-950 dark:focus:border-slate-700 focus:ring-slate-950/5 dark:focus:ring-slate-100/5";
  
  const defaultText = hasCustomText ? "" : "text-slate-900 dark:text-slate-100";
  const defaultFontSize = hasCustomFontSize ? "" : "text-sm";
  const defaultDisabled = "disabled:bg-slate-50 dark:disabled:bg-slate-900/40 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:border-slate-100 dark:disabled:border-slate-850 cursor-not-allowed";

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="font-sans font-medium text-xs text-slate-700 dark:text-slate-300 transition-colors duration-200">
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={`${baseClasses} ${defaultBg} ${defaultBorder} ${defaultText} ${defaultFontSize} ${defaultDisabled} ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option 
            key={option.value} 
            value={option.value}
            className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100"
          >
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className="font-sans text-xs text-red-500 dark:text-red-400 font-medium">{error}</span>
      ) : helperText ? (
        <span className="font-sans text-[11px] text-slate-400 dark:text-slate-500">{helperText}</span>
      ) : null}
    </div>
  );
};
