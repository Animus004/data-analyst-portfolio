/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center font-sans font-medium transition-all duration-250 rounded-lg active:scale-[0.97] cursor-pointer disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-950/20 focus-visible:ring-offset-2";
  
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 hover:shadow-md hover:shadow-slate-900/5 active:bg-slate-950 shadow-sm border border-slate-900",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200/80 active:bg-slate-200 border border-slate-200/40",
    outline: "bg-white/80 backdrop-blur-xs text-slate-700 hover:text-slate-950 hover:bg-slate-50 active:bg-slate-100 border border-slate-200/80 shadow-xs",
    ghost: "bg-transparent text-slate-600 hover:text-slate-950 hover:bg-slate-100/70 active:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm border border-red-600"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2.5"
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
