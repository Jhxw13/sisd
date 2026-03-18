/**
 * Gerencial.tsx — /gerencial
 * Painel gerencial com KPIs reais, rankings e filtros completos
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Filter, TrendingUp, Users, MapPin, Wrench, AlertTriangle, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/MetricCard";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { SectionHeader } from "@/components/DataDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useNavigate } from "react-router-dom";

interface GerencialData {
  kpis_principais: {
    total_processamentos:number; total_execucoes:number; total_ocorrencias:number;
    nao_mapeados:number; percentual_mapeado_fmt:string; nucleos_ativos:number; equipes_ativas:number;
  };
  ranking_nucleos:   {nucleo:string;total:number}[];
  ranking_equipes:   {equipe:string;total:number}[];
  ranking_municipios:{municipio:string;total:number}[];
  ranking_servicos:  {servico:string;total:number}[];
  ocorrencias_top:   {descricao:string;total:number}[];
  serie_temporal:    {data:string;total:number}[];
  indicadores_por_nucleo:{nucleo:string;processamentos:number;execucoes:number;ocorrencias:number}[];
}

export default function Gerencial() {
  const navigate = useNavigate();
  const [data, setData]       = useState<GerencialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [topN, setTopN]       = useState("10");
  const [topNDraft, setTopNDraft] = useState("10");

  // Filtros aplicados
  const [procFrom, setProcFrom]     = useState("");
  const [procTo, setProcTo]         = useState("");
  const [nucleo, setNucleo]         = useState<string[]>([]);
  const [municipio, setMunicipio]   = useState<string[]>([]);
  const [equipe, setEquipe]         = useState<string[]>([]);
  const [statusF, setStatusF]       = useState<string[]>([]);

  // Filtros em edicao (draft)
  const [procFromDraft, setProcFromDraft] = useState("");
  const [procToDraft, setProcToDraft] = useState("");
  const [nucleoDraft, setNucleoDraft] = useState<string[]>([]);
  const [municipioDraft, setMunicipioDraft] = useState<string[]>([]);
  const [equipeDraft, setEquipeDraft] = useState<string[]>([]);
  const [statusFDraft, setStatusFDraft] = useState<string[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({top_n:topN});
      if (procFrom)  p.set("processed_from",procFrom);
      if (procTo)    p.set("processed_to",procTo);
      nucleo.forEach((v) => p.append("nucleo", v));
      municipio.forEach((v) => p.append("municipio", v));
      equipe.forEach((v) => p.append("equipe", v));
      statusF.forEach((v) => p.append("status", v));
      setData(await apiFetch(`/api/gerencial?${p}`));
    } finally { setLoading(false); }
  }, [procFrom,procTo,nucleo,municipio,equipe,statusF,topN]);

  useEffect(()=>{ carregar(); },[carregar]);

  const statusOptions = useMemo(
    () => [
      { label: "Concluido", value: "concluido" },
      { label: "Pendente", value: "pendente" },
      { label: "Em revisao", value: "em_revisao" },
      { label: "Aprovado", value: "aprovado" },
      { label: "Processando", value: "processando" },
      { label: "Rejeitado", value: "rejeitado" },
    ],
    [],
  );
  const nucleoOptions = useMemo(() => Array.from(new Set([...(data?.ranking_nucleos || []).map((r) => r.nucleo), ...nucleoDraft])).filter(Boolean), [data?.ranking_nucleos, nucleoDraft]);
  const municipioOptions = useMemo(() => Array.from(new Set([...(data?.ranking_municipios || []).map((r) => r.municipio), ...municipioDraft])).filter(Boolean), [data?.ranking_municipios, municipioDraft]);
  const equipeOptions = useMemo(() => Array.from(new Set([...(data?.ranking_equipes || []).map((r) => r.equipe), ...equipeDraft])).filter(Boolean), [data?.ranking_equipes, equipeDraft]);
  const rankingNucleosData = useMemo(
    () =>
      [...(data?.ranking_nucleos || [])]
        .filter((r) => String(r.nucleo || "").trim())
        .sort((a, b) => (b.total - a.total) || String(a.nucleo).localeCompare(String(b.nucleo), "pt-BR")),
    [data?.ranking_nucleos],
  );
  const rankingNucleosChartHeight = useMemo(
    () => Math.max(220, rankingNucleosData.length * 34),
    [rankingNucleosData.length],
  );

  function aplicarFiltros() {
    setProcFrom(procFromDraft);
    setProcTo(procToDraft);
    setNucleo(nucleoDraft);
    setMunicipio(municipioDraft);
    setEquipe(equipeDraft);
    setStatusF(statusFDraft);
    setTopN(topNDraft || "10");
  }

  function limparFiltros() {
    setProcFrom("");setProcTo("");
    setNucleo([]);setMunicipio([]);setEquipe([]);setStatusF([]);
    setProcFromDraft("");setProcToDraft("");
    setNucleoDraft([]);setMunicipioDraft([]);setEquipeDraft([]);setStatusFDraft([]);
    setTopN("10");setTopNDraft("10");
  }

  const kpis = data?.kpis_principais;

  const CustomTooltip = ({active,payload,label}:any) => {
    if (!active||!payload) return null;
    return (
      <div className="glass-surface rounded-xl p-3 border border-border text-xs">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map((p:any,i:number)=>(
          <p key={i} className="font-mono-data text-foreground">{p.name}: <span className="text-primary">{p.value}</span></p>
        ))}
      </div>
    );
  };

  return (
    <AppLayout title="Painel Gerencial" subtitle="Leitura executiva do período operacional">
      <div className="space-y-6">
        {/* Filtros */}
        <div className="glass-surface rounded-2xl p-6">
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-semibold flex items-center gap-2">
              <Filter className="w-3.5 h-3.5"/> Filtros gerenciais
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Processado - de</label>
                <Input type="date" value={procFromDraft} onChange={e=>setProcFromDraft(e.target.value)} className="bg-secondary border-border text-sm"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Processado - ate</label>
                <Input type="date" value={procToDraft} onChange={e=>setProcToDraft(e.target.value)} className="bg-secondary border-border text-sm"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Top N</label>
                <Input type="number" min="3" max="50" value={topNDraft} onChange={e=>setTopNDraft(e.target.value)} className="bg-secondary border-border text-sm"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Nucleo</label>
                <MultiSelectFilter label="Selecionar nucleos" options={nucleoOptions} value={nucleoDraft} onChange={setNucleoDraft} emptyLabel="Todos os nucleos" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Municipio</label>
                <MultiSelectFilter label="Selecionar municipios" options={municipioOptions} value={municipioDraft} onChange={setMunicipioDraft} emptyLabel="Todos os municipios" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Equipe</label>
                <MultiSelectFilter label="Selecionar equipes" options={equipeOptions} value={equipeDraft} onChange={setEquipeDraft} emptyLabel="Todas as equipes" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Status</label>
                <MultiSelectFilter label="Selecionar status" options={statusOptions} value={statusFDraft} onChange={setStatusFDraft} emptyLabel="Todos os status" />
              </div>
              <div className="flex items-end gap-2">
                <Button size="sm" onClick={aplicarFiltros} className="gap-1.5 flex-1">
                  <Filter className="w-3.5 h-3.5"/> Aplicar
                </Button>
                <Button size="sm" variant="outline" onClick={limparFiltros}>Limpar</Button>
              </div>
            </div>
          </div>
        </div>
        {/* KPIs */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <span className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mr-2"/>
            Calculando indicadores…
          </div>
        ) : kpis && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Processamentos" value={String(kpis.total_processamentos)}
                icon={<TrendingUp className="w-5 h-5"/>}
                onClick={() => navigate("/historico")}/>
              <MetricCard label="% Mapeado" value={`${kpis.percentual_mapeado_fmt}%`}
                icon={<Wrench className="w-5 h-5"/>} changeType="positive"/>
              <MetricCard label="Execuções" value={String(kpis.total_execucoes)}
                icon={<Wrench className="w-5 h-5"/>}
                onClick={() => navigate("/historico")}/>
              <MetricCard label="Ocorrências" value={String(kpis.total_ocorrencias)}
                icon={<AlertTriangle className="w-5 h-5"/>}
                onClick={() => navigate("/ocorrencias")}
                changeType={kpis.total_ocorrencias>0?"negative":"neutral"}/>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Núcleos ativos" value={String(kpis.nucleos_ativos)} icon={<MapPin className="w-5 h-5"/>}
                onClick={() => navigate("/nucleos-cadastro")}/>
              <MetricCard label="Equipes ativas" value={String(kpis.equipes_ativas)} icon={<Users className="w-5 h-5"/>}
                onClick={() => {
                  const eq = data?.ranking_equipes?.[0]?.equipe;
                  navigate(`/historico${eq ? `?equipe=${encodeURIComponent(eq)}` : ""}`);
                }}/>
              <MetricCard label="Não mapeados" value={String(kpis.nao_mapeados)}
                icon={<AlertTriangle className="w-5 h-5"/>}
                onClick={() => navigate("/monitoramento")}
                changeType={kpis.nao_mapeados>0?"negative":"positive"}/>
              <MetricCard label="Periodo processado" value={procFrom || procTo ? `${procFrom || "..."} a ${procTo || "..."}` : "Completo"}
                icon={<TrendingUp className="w-5 h-5"/>}/>
            </div>

            {/* Série temporal */}
            {(data?.serie_temporal||[]).length>0 && (
              <div className="glass-surface rounded-2xl p-6">
                <div className="relative z-10">
                  <SectionHeader title="Processamentos por data" subtitle="Evolução temporal dos registros"/>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data!.serie_temporal}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)"/>
                        <XAxis dataKey="data" stroke="hsl(215 15% 40%)" fontSize={10} tickLine={false} axisLine={false}/>
                        <YAxis stroke="hsl(215 15% 40%)" fontSize={10} tickLine={false} axisLine={false}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Line type="monotone" dataKey="total" name="Processamentos"
                          stroke="hsl(215 90% 60%)" strokeWidth={2} dot={false}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Rankings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Núcleos */}
              <div className="glass-surface rounded-2xl p-6">
                <div className="relative z-10">
                  <SectionHeader title="Top Núcleos" subtitle="Por volume de processamentos"/>
                  <div style={{ height: rankingNucleosChartHeight }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={rankingNucleosData}
                        layout="vertical"
                        margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" horizontal={false}/>
                        <XAxis type="number" stroke="hsl(215 15% 40%)" fontSize={10} tickLine={false} axisLine={false}/>
                        <YAxis
                          type="category"
                          dataKey="nucleo"
                          stroke="hsl(215 15% 40%)"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          width={140}
                          interval={0}
                        />
                        <Tooltip content={<CustomTooltip/>}/>
                        <Bar dataKey="total" name="Total" fill="hsl(215 90% 60%)" radius={[0,4,4,0]} barSize={18}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Serviços */}
              <div className="glass-surface rounded-2xl p-6">
                <div className="relative z-10">
                  <SectionHeader title="Top Serviços" subtitle="Mais executados no período"/>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data!.ranking_servicos.slice(0,8)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" horizontal={false}/>
                        <XAxis type="number" stroke="hsl(215 15% 40%)" fontSize={10} tickLine={false} axisLine={false}/>
                        <YAxis type="category" dataKey="servico" stroke="hsl(215 15% 40%)" fontSize={9} tickLine={false} axisLine={false} width={120}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Bar dataKey="total" name="Total" fill="hsl(155 60% 55%)" radius={[0,4,4,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Equipes */}
              <div className="glass-surface rounded-2xl p-6">
                <div className="relative z-10">
                  <SectionHeader title="Top Equipes" subtitle="Por volume de registros"/>
                  <div className="space-y-2 mt-2">
                    {data!.ranking_equipes.slice(0,8).map((r,i)=>(
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border/50">
                        <span className="text-sm text-foreground">{r.equipe||"—"}</span>
                        <span className="font-mono-data text-sm text-primary">{r.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Por núcleo detalhado */}
              <div className="glass-surface rounded-2xl p-6">
                <div className="relative z-10">
                  <SectionHeader title="Indicadores por núcleo" subtitle="Execuções e ocorrências"/>
                  <div className="space-y-2 mt-2">
                    {data!.indicadores_por_nucleo.slice(0,8).map((r,i)=>(
                      <div key={i} className="py-2 border-b border-border/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground">{r.nucleo}</span>
                          <span className="font-mono-data text-xs text-muted-foreground">{r.processamentos} proc.</span>
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span className="text-accent">{r.execucoes} execuções</span>
                          <span className="text-warning">{r.ocorrencias} ocorrências</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}



