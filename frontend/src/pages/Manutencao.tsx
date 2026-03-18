import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/MetricCard";
import { SectionHeader } from "@/components/DataDisplay";
import { Wrench, Clock, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface EntradaRow { id: string; protocolo: string; nucleo: string; equipe: string; status: string; created_at: string }

export default function Manutencao() {
  const [pendentes, setPendentes] = useState<EntradaRow[]>([]);

  useEffect(() => {
    apiFetch("/api/entradas?status=pendente&page=1&per_page=30").then((r) => setPendentes(r.data || []));
  }, []);

  return (
    <AppLayout title="Manutencao" subtitle="Fila real de pendencias operacionais">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard label="Pendentes" value={String(pendentes.length)} icon={<Clock className="w-5 h-5" />} />
          <MetricCard label="Processo" value={String(pendentes.filter((p) => p.status === "processando").length)} icon={<Wrench className="w-5 h-5" />} />
          <MetricCard label="Atencao" value={String(pendentes.length)} icon={<AlertTriangle className="w-5 h-5" />} />
        </div>

        <div className="glass-surface rounded-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-2"><SectionHeader title="Itens pendentes" subtitle="Fonte: /api/entradas" /></div>
          {pendentes.map((p) => (
            <div key={p.id} className="flex items-center gap-4 px-6 py-3.5 border-b border-border/50">
              <span className="font-mono-data text-xs text-primary w-28">{p.protocolo}</span>
              <span className="text-sm text-foreground w-44 truncate">{p.nucleo || "-"}</span>
              <span className="text-sm text-muted-foreground flex-1 truncate">{p.equipe || "-"}</span>
              <span className="text-xs text-muted-foreground w-28 text-right">{p.status}</span>
            </div>
          ))}
          {pendentes.length === 0 && <div className="px-6 py-10 text-sm text-muted-foreground text-center">Sem pendencias no momento.</div>}
        </div>
      </div>
    </AppLayout>
  );
}
