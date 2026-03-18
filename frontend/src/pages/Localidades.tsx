import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/MetricCard";
import { SectionHeader } from "@/components/DataDisplay";
import { MapPin, Building, Droplets } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface DashboardData {
  kpis: { nucleos_ativos: number; total_entradas: number; total_execucoes: number };
  ranking_municipios: { municipio: string; total: number }[];
}

export default function Localidades() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    apiFetch("/api/dashboard").then(setData);
  }, []);

  return (
    <AppLayout title="Localidades" subtitle="Cobertura por municipio com dados reais">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard label="Nucleos" value={String(data?.kpis.nucleos_ativos ?? 0)} icon={<MapPin className="w-5 h-5" />} />
          <MetricCard label="Entradas" value={String(data?.kpis.total_entradas ?? 0)} icon={<Building className="w-5 h-5" />} />
          <MetricCard label="Execucoes" value={String(data?.kpis.total_execucoes ?? 0)} icon={<Droplets className="w-5 h-5" />} />
        </div>

        <div className="glass-surface rounded-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-2"><SectionHeader title="Municipios com mais registros" /></div>
          {(data?.ranking_municipios ?? []).slice(0, 20).map((m) => (
            <div key={m.municipio} className="flex items-center justify-between px-6 py-3 border-b border-border/50">
              <span className="text-sm text-foreground">{m.municipio || "-"}</span>
              <span className="font-mono-data text-sm text-primary">{m.total}</span>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
