import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/MetricCard";
import { DataRow, SectionHeader, StatusBadge } from "@/components/DataDisplay";
import { apiFetch } from "@/lib/api";
import { AlertTriangle, Boxes, HardHat, Layers, Network, RotateCcw, SlidersHorizontal, Users, Wrench } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
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

function PieCategoryTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload || {};
  const categoria = row?.categoria || row?.name || "Categoria";
  const part = Number(row?.participacao || payload[0]?.value || 0);
  return (
    <div
      style={{
        background: "#020617",
        border: "1px solid rgba(56,189,248,0.45)",
        borderRadius: 10,
        color: "#e2e8f0",
        padding: "8px 10px",
        fontSize: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ fontWeight: 600, color: "#f8fafc" }}>{categoria}</div>
      <div style={{ color: "#93c5fd" }}>{fmt(part)}%</div>
    </div>
  );
}

const CATEGORY_COLORS = [
  "#38bdf8", // sky
  "#22d3ee", // cyan
  "#34d399", // emerald
  "#a3e635", // lime
  "#facc15", // yellow
  "#fb923c", // orange
  "#f472b6", // pink
  "#c084fc", // purple
  "#60a5fa", // blue
  "#2dd4bf", // teal
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroDataDe, setFiltroDataDe] = useState("");
  const [filtroDataAte, setFiltroDataAte] = useState("");
  const [filtroNucleo, setFiltroNucleo] = useState("");
  const [filtroEquipe, setFiltroEquipe] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroTipoOcorr, setFiltroTipoOcorr] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const p = new URLSearchParams({ top_n: "30" });
        if (filtroDataDe) p.set("data_de", filtroDataDe);
        if (filtroDataAte) p.set("data_ate", filtroDataAte);
        if (filtroNucleo) p.set("nucleo", filtroNucleo);
        if (filtroEquipe) p.set("equipe", filtroEquipe);
        setData(await apiFetch(`/api/dashboard?${p.toString()}`));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [filtroDataDe, filtroDataAte, filtroNucleo, filtroEquipe]);

  const riscoBadge = useMemo(() => {
    const r = (data?.meta?.risco_operacional || "").toUpperCase();
    if (r === "ALTO") return "bg-destructive/15 text-destructive";
    if (r === "MEDIO") return "bg-warning/15 text-warning";
    return "bg-accent/15 text-accent";
  }, [data?.meta?.risco_operacional]);

  const visaoNucleoRows = useMemo(() => (data?.visao_nucleo || []).slice(0, 8), [data?.visao_nucleo]);
  const visaoEquipeRows = useMemo(() => (data?.visao_equipe || []).slice(0, 8), [data?.visao_equipe]);
  const visaoCategoriaRows = useMemo(() => {
    const rows = data?.visao_categoria || [];
    if (!filtroCategoria) return rows.slice(0, 8);
    return rows.filter((r) => r.categoria === filtroCategoria).slice(0, 8);
  }, [data?.visao_categoria, filtroCategoria]);
  const servicosRows = useMemo(() => {
    const rows = data?.servicos_volume || [];
    if (!filtroCategoria) return rows;
    return rows.filter((r) => r.servico === filtroCategoria);
  }, [data?.servicos_volume, filtroCategoria]);
  const ocorrRows = useMemo(() => {
    const rows = data?.ocorrencias_por_tipo || [];
    if (!filtroTipoOcorr) return rows;
    return rows.filter((r) => r.tipo === filtroTipoOcorr);
  }, [data?.ocorrencias_por_tipo, filtroTipoOcorr]);

  const qtdTooltipRows = useMemo(() => {
    const total = servicosRows.reduce((acc, r) => acc + Number(r.qtd_total || 0), 0);
    return servicosRows.slice(0, 8).map((r) => {
      const pct = total > 0 ? (Number(r.qtd_total || 0) / total) * 100 : 0;
      return { ...r, pct };
    });
  }, [servicosRows]);

  const filtrosAtivos = [filtroDataDe, filtroDataAte, filtroNucleo, filtroEquipe, filtroCategoria, filtroTipoOcorr].filter(Boolean).length;

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
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filtros BI
                {filtrosAtivos > 0 && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{filtrosAtivos} ativos</span>}
              </div>
              <button
                type="button"
                onClick={() => {
                  setFiltroDataDe("");
                  setFiltroDataAte("");
                  setFiltroNucleo("");
                  setFiltroEquipe("");
                  setFiltroCategoria("");
                  setFiltroTipoOcorr("");
                }}
                className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Limpar
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
              <input type="date" value={filtroDataDe} onChange={(e) => setFiltroDataDe(e.target.value)} className="bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground" />
              <input type="date" value={filtroDataAte} onChange={(e) => setFiltroDataAte(e.target.value)} className="bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground" />
              <input value={filtroNucleo} onChange={(e) => setFiltroNucleo(e.target.value)} placeholder="Filtrar núcleo" className="bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground" />
              <input value={filtroEquipe} onChange={(e) => setFiltroEquipe(e.target.value)} placeholder="Filtrar equipe" className="bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground" />
            </div>
          </div>

          <div className="glass-surface rounded-2xl p-5">
            <div className="text-xs text-muted-foreground">
              Data base: <span className="text-foreground">{data?.meta?.data_base || "-"}</span> | Gerado em:{" "}
              <span className="text-foreground">{data?.meta?.gerado_em || "-"}</span> | Frentes sem producao:{" "}
              <span className="text-foreground">{data?.meta?.frentes_sem_producao || 0}</span> | Risco operacional:{" "}
              <span className={`px-2 py-0.5 rounded-full ml-1 ${riscoBadge}`}>{data?.meta?.risco_operacional || "-"}</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Interacao BI: clique em barras/fatias para aplicar filtros cruzados no painel.
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
                  <BarChart
                    data={visaoNucleoRows}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
                    <XAxis dataKey="nucleo" hide />
                    <YAxis stroke="hsl(215 15% 40%)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar
                      dataKey="qtd_total"
                      name="Qtd Total"
                      fill="hsl(205 85% 56%)"
                      radius={[4, 4, 0, 0]}
                      onClick={(p: any) => {
                        const nucleo = p?.nucleo;
                        if (!nucleo) return;
                        setFiltroNucleo((prev) => (prev === nucleo ? "" : nucleo));
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2">
                {visaoNucleoRows.map((r) => (
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
                    <Pie
                      data={visaoCategoriaRows}
                      dataKey="participacao"
                      nameKey="categoria"
                      innerRadius={52}
                      outerRadius={90}
                      paddingAngle={2}
                      onClick={(entry: any) => {
                        const categoria = entry?.categoria;
                        if (!categoria) return;
                        setFiltroCategoria((prev) => (prev === categoria ? "" : categoria));
                      }}
                    >
                      {visaoCategoriaRows.map((_, i) => (
                        <Cell key={`cat-cell-${i}`} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieCategoryTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2">
                {visaoCategoriaRows.map((r) => (
                  <DataRow key={r.categoria} onClick={() => setFiltroCategoria((prev) => (prev === r.categoria ? "" : r.categoria))}>
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
                  <BarChart
                    data={visaoEquipeRows}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" horizontal={false} />
                    <XAxis type="number" stroke="hsl(215 15% 40%)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="equipe" width={90} stroke="hsl(215 15% 40%)" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar
                      dataKey="qtd_total"
                      fill="hsl(152 63% 43%)"
                      radius={[0, 4, 4, 0]}
                      onClick={(p: any) => {
                        const equipe = p?.equipe;
                        if (!equipe) return;
                        setFiltroEquipe((prev) => (prev === equipe ? "" : equipe));
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2">
                {visaoEquipeRows.map((r, idx) => (
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
              {ocorrRows.map((r, i) => (
                <DataRow key={`${r.tipo}-${i}`} onClick={() => setFiltroTipoOcorr((prev) => (prev === r.tipo ? "" : r.tipo))}>
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
            {servicosRows.slice(0, 20).map((r, i) => (
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
