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
}

export function MetricCard({ label, value, change, changeType = "neutral", icon, subtitle, onClick }: MetricCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      onClick={onClick}
      className={cn("glass-surface rounded-2xl p-6 group", onClick ? "cursor-pointer" : "cursor-default")}
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
    </motion.div>
  );
}
