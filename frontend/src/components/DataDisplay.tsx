import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "online" | "warning" | "critical" | "maintenance";
  label?: string;
}

const statusConfig = {
  online: { color: "bg-accent", text: "text-accent", label: "Operacional" },
  warning: { color: "bg-warning", text: "text-warning", label: "Atenção" },
  critical: { color: "bg-destructive", text: "text-destructive", label: "Crítico" },
  maintenance: { color: "bg-muted-foreground", text: "text-muted-foreground", label: "Manutenção" },
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <div className="flex items-center gap-2">
      <span className={cn("w-2 h-2 rounded-full", config.color, status === "online" && "animate-pulse-glow")} />
      <span className={cn("text-xs font-medium", config.text)}>
        {label || config.label}
      </span>
    </div>
  );
}

interface DataTableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function DataRow({ children, className, onClick }: DataTableRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 px-4 py-3.5 border-b border-border/50 hover:bg-surface-hover transition-colors",
        onClick ? "cursor-pointer" : "",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h2 className="text-lg font-medium tracking-tight text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
