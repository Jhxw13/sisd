import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ReactNode;
  subtitle?: string;
  onClick?: () => void;
  tooltipContent?: React.ReactNode;
}

export function MetricCard({ label, value, change, changeType = "neutral", icon, subtitle, onClick, tooltipContent }: MetricCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      onClick={onClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      className={cn("glass-surface overflow-visible rounded-2xl p-6 group relative", onClick ? "cursor-pointer" : "cursor-default")}
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          {change && (
            <span className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-semibold font-mono-data",
              changeType === "positive" && "bg-accent/10 text-accent",
              changeType === "negative" && "bg-destructive/10 text-destructive",
              changeType === "neutral" && "bg-muted text-muted-foreground"
            )}>
              {change}
            </span>
          )}
        </div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">{label}</p>
        <h3 className="text-2xl font-medium tracking-tighter text-foreground font-mono-data">{value}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {tooltipContent && showTooltip && (
        <div
          className="absolute left-3 right-3 bottom-full mb-2 z-30 rounded-xl border border-primary/40 bg-slate-950 p-3 text-xs shadow-2xl isolate"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {tooltipContent}
        </div>
      )}
    </motion.div>
  );
}
