import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { SectionHeader } from "@/components/DataDisplay";
import { MetricCard } from "@/components/MetricCard";
import { Users, AlertTriangle, Database } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface DashboardData {
  kpis: { total_entradas: number; total_execucoes: number; total_ocorrencias: number };
  ranking_nucleos: { nucleo: string; total: number }[];
}

export default function Clientes() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    apiFetch("/api/dashboard").then(setData);
  }, []);

  return (
    <AppLayout title="Clientes" subtitle="Sem base de clientes no banco atual; exibindo dados operacionais reais">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard label="Entradas" value={String(data?.kpis.total_entradas ?? 0)} icon={<Users className="w-5 h-5" />} />
          <MetricCard label="Execucoes" value={String(data?.kpis.total_execucoes ?? 0)} icon={<Database className="w-5 h-5" />} />
          <MetricCard label="Ocorrencias" value={String(data?.kpis.total_ocorrencias ?? 0)} icon={<AlertTriangle className="w-5 h-5" />} />
        </div>

        <div className="glass-surface rounded-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-2"><SectionHeader title="Top nucleos ativos" subtitle="Dados reais de operacao" /></div>
          {(data?.ranking_nucleos ?? []).slice(0, 12).map((n) => (
            <div key={n.nucleo} className="flex items-center justify-between px-6 py-3 border-b border-border/50">
              <span className="text-sm text-foreground">{n.nucleo || "-"}</span>
              <span className="font-mono-data text-sm text-primary">{n.total}</span>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
