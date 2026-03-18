import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/MetricCard";
import { SectionHeader } from "@/components/DataDisplay";
import { Wifi, AlertTriangle, Activity, Clock } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface DashboardData {
  kpis: { total_entradas: number; concluidos: number; pendentes: number; processando: number; total_ocorrencias: number };
  recentes: { id: string; protocolo: string; nucleo: string; equipe: string; status: string; data_referencia: string }[];
}

export default function Monitoramento() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    apiFetch("/api/dashboard").then(setData);
  }, []);

  return (
    <AppLayout title="Monitoramento" subtitle="Acompanhamento operacional em tempo real (dados reais)">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Entradas" value={String(data?.kpis.total_entradas ?? 0)} icon={<Wifi className="w-5 h-5" />} />
          <MetricCard label="Concluidos" value={String(data?.kpis.concluidos ?? 0)} icon={<Activity className="w-5 h-5" />} />
          <MetricCard label="Pendentes" value={String(data?.kpis.pendentes ?? 0)} icon={<Clock className="w-5 h-5" />} />
          <MetricCard label="Ocorrencias" value={String(data?.kpis.total_ocorrencias ?? 0)} icon={<AlertTriangle className="w-5 h-5" />} />
        </div>

        <div className="glass-surface rounded-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-2">
            <SectionHeader title="Ultimos registros" subtitle="Fonte: /api/dashboard" />
          </div>
          {(data?.recentes ?? []).map((r) => (
            <div key={r.id} className="flex items-center gap-4 px-6 py-3.5 border-b border-border/50">
              <span className="font-mono-data text-xs text-primary w-28">{r.protocolo}</span>
              <span className="text-sm text-foreground w-44 truncate">{r.nucleo || "-"}</span>
              <span className="text-sm text-muted-foreground flex-1 truncate">{r.equipe || "-"}</span>
              <span className="text-xs text-muted-foreground w-24">{r.data_referencia || "-"}</span>
              <span className="text-xs text-muted-foreground w-28 text-right">{r.status}</span>
            </div>
          ))}
          {(data?.recentes ?? []).length === 0 && <div className="px-6 py-10 text-sm text-muted-foreground text-center">Sem dados reais.</div>}
        </div>
      </div>
    </AppLayout>
  );
}
