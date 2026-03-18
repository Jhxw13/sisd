import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/MetricCard";
import { SectionHeader } from "@/components/DataDisplay";
import { Droplets, MapPin, Users, Activity } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface DashboardData {
  kpis: { total_execucoes: number; nucleos_ativos: number; total_entradas: number; total_ocorrencias: number };
  ranking_municipios: { municipio: string; total: number }[];
  por_nucleo: { nucleo: string; entradas: number; execucoes: number; ocorrencias: number }[];
}

export default function RedeHidrica() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    apiFetch("/api/dashboard").then(setData);
  }, []);

  return (
    <AppLayout title="Rede Hidrica" subtitle="Distribuicao por municipio e nucleo (dados reais)">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Execucoes" value={String(data?.kpis.total_execucoes ?? 0)} icon={<Droplets className="w-5 h-5" />} />
          <MetricCard label="Nucleos" value={String(data?.kpis.nucleos_ativos ?? 0)} icon={<MapPin className="w-5 h-5" />} />
          <MetricCard label="Entradas" value={String(data?.kpis.total_entradas ?? 0)} icon={<Users className="w-5 h-5" />} />
          <MetricCard label="Ocorrencias" value={String(data?.kpis.total_ocorrencias ?? 0)} icon={<Activity className="w-5 h-5" />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-surface rounded-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-2"><SectionHeader title="Top municipios" /></div>
            {(data?.ranking_municipios ?? []).slice(0, 10).map((m) => (
              <div key={m.municipio} className="flex items-center justify-between px-6 py-3 border-b border-border/50">
                <span className="text-sm text-foreground">{m.municipio || "-"}</span>
                <span className="font-mono-data text-sm text-primary">{m.total}</span>
              </div>
            ))}
          </div>

          <div className="glass-surface rounded-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-2"><SectionHeader title="Indicadores por nucleo" /></div>
            {(data?.por_nucleo ?? []).slice(0, 10).map((n) => (
              <div key={n.nucleo} className="px-6 py-3 border-b border-border/50">
                <p className="text-sm text-foreground">{n.nucleo}</p>
                <p className="text-xs text-muted-foreground">{n.entradas} entradas | {n.execucoes} execucoes | {n.ocorrencias} ocorrencias</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
