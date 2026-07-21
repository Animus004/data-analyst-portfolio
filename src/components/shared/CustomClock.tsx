/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export const CustomClock: React.FC = () => {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format timezone offset nicely
  const formatTime = () => {
    return time.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  };

  const hour = time.getHours();
  const isWorkingHours = hour >= 9 && hour < 18;

  return (
    <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-lg text-slate-600 font-mono text-xs">
      <Clock className="w-3.5 h-3.5 text-slate-400 animate-pulse" />
      <span>Local Time: {formatTime()}</span>
      <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
      <span className={`inline-flex items-center gap-1 font-medium text-[10px] uppercase tracking-wider ${
        isWorkingHours ? "text-emerald-600" : "text-amber-600"
      }`}>
        {isWorkingHours ? "Active Now" : "Outside Office Hours"}
      </span>
    </div>
  );
};
