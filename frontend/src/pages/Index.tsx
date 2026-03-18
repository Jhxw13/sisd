import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/MetricCard";
import { DataRow, SectionHeader, StatusBadge } from "@/components/DataDisplay";
import { apiFetch } from "@/lib/api";
import { AlertTriangle, Boxes, HardHat, Layers, Network, Users, Wrench } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DashboardData {
  meta: {
    data_base?: string;
    gerado_em?: string;
    frentes_sem_producao: number;
    risco_operacional: string;
    ocorrencias_por_frente: number;
  };
  kpis: {
    nucleos_ativos: number;
    frentes_registradas: number;
    ocorrencias: number;
    qtd_total: number;
    categorias_ativas: number;
    equipes_ativas: number;
    itens_executados: number;
  };
  visao_nucleo: {
    nucleo: string;
    frentes: number;
    itens: number;
    ocorrencias: number;
    qtd_total: number;
    comentario: string;
  }[];
  visao_categoria: {
    categoria: string;
    registros: number;
    qtd_total: number;
    participacao: number;
    status: string;
  }[];
  visao_equipe: {
    equipe: string;
    nucleo: string;
    qtd_total: number;
    registros: number;
  }[];
  servicos_volume: {
    servico: string;
    unidade: string;
    qtd_total: number;
    registros: number;
  }[];
  ocorrencias_por_tipo: {
    tipo: string;
    qtd: number;
    leitura: string;
    status: string;
  }[];
  leitura_gerencial: { indicador: string; valor: string | number }[];
  recentes: {
    id: string;
    protocolo: string;
    nucleo: string;
    data_referencia: string;
    status: string;
    equipe: string;
  }[];
}

const statusMap: Record<string, "online" | "warning" | "critical" | "maintenance"> = {
  concluido: "online",
  pendente: "warning",
  processando: "maintenance",
  em_revisao: "maintenance",
  rejeitado: "critical",
};

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(v);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        setData(await apiFetch("/api/dashboard?top_n=20"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const riscoBadge = useMemo(() => {
    const r = (data?.meta?.risco_operacional || "").toUpperCase();
    if (r === "ALTO") return "bg-destructive/15 text-destructive";
    if (r === "MEDIO") return "bg-warning/15 text-warning";
    return "bg-accent/15 text-accent";
  }, [data?.meta?.risco_operacional]);

  const qtdTooltipRows = useMemo(() => {
    const total = Number(data?.kpis?.qtd_total || 0);
    return (data?.servicos_volume || []).slice(0, 8).map((r) => {
      const pct = total > 0 ? (Number(r.qtd_total || 0) / total) * 100 : 0;
      return { ...r, pct };
    });
  }, [data?.servicos_volume, data?.kpis?.qtd_total]);

  return (
    <AppLayout
      title="Painel Gerencial de Evolucao de Obra"
      subtitle="Base executiva interativa inspirada no legado, com visual moderno"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <span className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mr-2" />
          Carregando painel...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="glass-surface rounded-2xl p-5">
            <div className="text-xs text-muted-foreground">
              Data base: <span className="text-foreground">{data?.meta?.data_base || "-"}</span> | Gerado em:{" "}
              <span className="text-foreground">{data?.meta?.gerado_em || "-"}</span> | Frentes sem producao:{" "}
              <span className="text-foreground">{data?.meta?.frentes_sem_producao || 0}</span> | Risco operacional:{" "}
              <span className={`px-2 py-0.5 rounded-full ml-1 ${riscoBadge}`}>{data?.meta?.risco_operacional || "-"}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard label="Nucleos" value={String(data?.kpis?.nucleos_ativos || 0)} subtitle="com atividade no periodo" icon={<Network className="w-5 h-5" />} onClick={() => navigate("/nucleos-cadastro")} />
            <MetricCard label="Frentes" value={String(data?.kpis?.frentes_registradas || 0)} subtitle="frentes registradas" icon={<HardHat className="w-5 h-5" />} onClick={() => navigate("/historico")} />
            <MetricCard label="Ocorrencias" value={String(data?.kpis?.ocorrencias || 0)} subtitle="itens de risco" icon={<AlertTriangle className="w-5 h-5" />} onClick={() => navigate("/ocorrencias")} />
            <MetricCard
              label="Qtd Total"
              value={fmt(data?.kpis?.qtd_total || 0)}
              subtitle="volume consolidado"
              icon={<Boxes className="w-5 h-5" />}
              onClick={() => navigate("/historico")}
              tooltipContent={
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Composicao do Total</p>
                  {qtdTooltipRows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem dados para detalhar.</p>
                  ) : (
                    qtdTooltipRows.map((r, i) => (
                      <div key={`${r.servico}-${r.unidade}-${i}`} className="flex items-center gap-2">
                        <span className="truncate text-foreground flex-1">{r.servico}</span>
                        <span className="text-muted-foreground">{fmt(r.qtd_total)} {r.unidade}</span>
                        <span className="font-mono-data text-primary w-12 text-right">{fmt(r.pct)}%</span>
                      </div>
                    ))
                  )}
                </div>
              }
            />
            <MetricCard label="Categorias" value={String(data?.kpis?.categorias_ativas || 0)} subtitle="categorias ativas" icon={<Layers className="w-5 h-5" />} />
            <MetricCard label="Equipes" value={String(data?.kpis?.equipes_ativas || 0)} subtitle="equipes com producao" icon={<Users className="w-5 h-5" />} onClick={() => navigate("/historico")} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="glass-surface rounded-2xl p-5">
              <SectionHeader title="Visao por Nucleo" subtitle="Frentes, itens, ocorrencias e volume" />
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(data?.visao_nucleo || []).slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
                    <XAxis dataKey="nucleo" hide />
                    <YAxis stroke="hsl(215 15% 40%)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="qtd_total" name="Qtd Total" fill="hsl(205 85% 56%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2">
                {(data?.visao_nucleo || []).slice(0, 8).map((r) => (
                  <DataRow key={r.nucleo} onClick={() => navigate(`/historico?nucleo=${encodeURIComponent(r.nucleo)}`)}>
                    <span className="text-sm text-foreground w-40 truncate">{r.nucleo}</span>
                    <span className="text-xs text-muted-foreground w-16">{r.frentes}</span>
                    <span className="text-xs text-muted-foreground w-14">{r.itens}</span>
                    <span className="text-xs text-muted-foreground w-16">{r.ocorrencias}</span>
                    <span className="font-mono-data text-xs text-primary ml-auto">{fmt(r.qtd_total)}</span>
                  </DataRow>
                ))}
              </div>
            </div>

            <div className="glass-surface rounded-2xl p-5">
              <SectionHeader title="Visao por Categoria" subtitle="Participacao e status operacional" />
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={(data?.visao_categoria || []).slice(0, 8)} dataKey="participacao" nameKey="categoria" innerRadius={52} outerRadius={90} paddingAngle={2} />
                    <Tooltip formatter={(v: any) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2">
                {(data?.visao_categoria || []).slice(0, 8).map((r) => (
                  <DataRow key={r.categoria}>
                    <span className="text-sm text-foreground w-44 truncate">{r.categoria}</span>
                    <span className="text-xs text-muted-foreground w-14">{r.registros}</span>
                    <span className="text-xs text-muted-foreground w-16">{fmt(r.qtd_total)}</span>
                    <span className="text-xs text-primary w-14">{r.participacao}%</span>
                    <span className="text-xs text-accent ml-auto">{r.status}</span>
                  </DataRow>
                ))}
              </div>
            </div>

            <div className="glass-surface rounded-2xl p-5">
              <SectionHeader title="Visao por Equipe" subtitle="Equipes com maior volume executado" />
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(data?.visao_equipe || []).slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" horizontal={false} />
                    <XAxis type="number" stroke="hsl(215 15% 40%)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="equipe" width={90} stroke="hsl(215 15% 40%)" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="qtd_total" fill="hsl(152 63% 43%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2">
                {(data?.visao_equipe || []).slice(0, 8).map((r, idx) => (
                  <DataRow key={`${r.equipe}-${r.nucleo}-${idx}`} onClick={() => navigate(`/historico?equipe=${encodeURIComponent(r.equipe)}`)}>
                    <span className="text-sm text-foreground w-28 truncate">{r.equipe}</span>
                    <span className="text-xs text-muted-foreground w-28 truncate">{r.nucleo}</span>
                    <span className="font-mono-data text-xs text-primary ml-auto">{fmt(r.qtd_total)}</span>
                  </DataRow>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-surface rounded-2xl p-5">
              <SectionHeader title="Ocorrencias por Tipo" subtitle={`Radar operacional | ${data?.meta?.ocorrencias_por_frente || 0} por frente`} />
              {(data?.ocorrencias_por_tipo || []).map((r, i) => (
                <DataRow key={`${r.tipo}-${i}`} onClick={() => navigate(`/ocorrencias?q=${encodeURIComponent(r.tipo)}`)}>
                  <span className="text-sm text-foreground w-52 truncate">{r.tipo}</span>
                  <span className="font-mono-data text-xs text-primary w-14">{r.qtd}</span>
                  <span className="text-xs text-muted-foreground w-24">{r.leitura}</span>
                  <span className="text-xs text-accent ml-auto">{r.status}</span>
                </DataRow>
              ))}
            </div>

            <div className="glass-surface rounded-2xl p-5">
              <SectionHeader title="Leitura Gerencial" subtitle="Sintese executiva automatica" />
              {(data?.leitura_gerencial || []).map((r, i) => (
                <DataRow key={`${r.indicador}-${i}`}>
                  <span className="text-sm text-foreground flex-1">{r.indicador}</span>
                  <span className="font-mono-data text-xs text-primary">{String(r.valor)}</span>
                </DataRow>
              ))}
            </div>
          </div>

          <div className="glass-surface rounded-2xl p-5">
            <SectionHeader title="Total por Servico" subtitle="Volume consolidado por item e unidade" />
            {(data?.servicos_volume || []).slice(0, 20).map((r, i) => (
              <DataRow key={`${r.servico}-${r.unidade}-${i}`} onClick={() => navigate(`/historico?q=${encodeURIComponent(r.servico)}`)}>
                <span className="text-sm text-foreground w-64 truncate">{r.servico}</span>
                <span className="text-xs text-muted-foreground w-20">{r.unidade}</span>
                <span className="text-xs text-muted-foreground w-20">{r.registros} regs</span>
                <span className="font-mono-data text-xs text-primary ml-auto">{fmt(r.qtd_total)}</span>
              </DataRow>
            ))}
          </div>

          <div className="glass-surface rounded-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-2">
              <SectionHeader title="Entradas Recentes" subtitle="Clique para abrir no Historico" />
            </div>
            {(data?.recentes || []).map((r) => (
              <DataRow key={r.id} onClick={() => navigate(`/historico?q=${encodeURIComponent(r.protocolo)}`)}>
                <span className="font-mono-data text-xs text-primary w-28">{r.protocolo}</span>
                <span className="text-sm text-foreground w-48 truncate">{r.nucleo || "-"}</span>
                <span className="text-sm text-muted-foreground flex-1 truncate">{r.equipe || "-"}</span>
                <span className="text-xs text-muted-foreground w-28">{r.data_referencia || "-"}</span>
                <StatusBadge status={statusMap[r.status] ?? "warning"} label={r.status} />
              </DataRow>
            ))}
          </div>

          <div className="text-xs text-muted-foreground px-1">
            Dica: todos os blocos de tabela e cards principais estao clicaveis para detalhamento nas outras telas.
          </div>
        </div>
      )}
    </AppLayout>
  );
}
