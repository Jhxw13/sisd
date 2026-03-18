/**
 * Gerencial.tsx — /gerencial
 * Painel gerencial com KPIs reais, rankings e filtros completos
 */
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Filter, TrendingUp, Users, MapPin, Wrench, AlertTriangle, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/MetricCard";
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

  // Filtros
  const [obraFrom, setObraFrom]     = useState("");
  const [obraTo, setObraTo]         = useState("");
  const [procFrom, setProcFrom]     = useState("");
  const [procTo, setProcTo]         = useState("");
  const [nucleo, setNucleo]         = useState("");
  const [municipio, setMunicipio]   = useState("");
  const [equipe, setEquipe]         = useState("");
  const [statusF, setStatusF]       = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({top_n:topN});
      if (obraFrom)  p.set("obra_from",obraFrom);
      if (obraTo)    p.set("obra_to",obraTo);
      if (procFrom)  p.set("processed_from",procFrom);
      if (procTo)    p.set("processed_to",procTo);
      if (nucleo)    p.set("nucleo",nucleo);
      if (municipio) p.set("municipio",municipio);
      if (equipe)    p.set("equipe",equipe);
      if (statusF)   p.set("status",statusF);
      setData(await apiFetch(`/api/gerencial?${p}`));
    } finally { setLoading(false); }
  }, [obraFrom,obraTo,procFrom,procTo,nucleo,municipio,equipe,statusF,topN]);

  useEffect(()=>{ carregar(); },[carregar]);

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
                <label className="text-xs text-muted-foreground">Obra — de</label>
                <Input type="date" value={obraFrom} onChange={e=>setObraFrom(e.target.value)} className="bg-secondary border-border text-sm"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Obra — até</label>
                <Input type="date" value={obraTo} onChange={e=>setObraTo(e.target.value)} className="bg-secondary border-border text-sm"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Processado — de</label>
                <Input type="date" value={procFrom} onChange={e=>setProcFrom(e.target.value)} className="bg-secondary border-border text-sm"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Processado — até</label>
                <Input type="date" value={procTo} onChange={e=>setProcTo(e.target.value)} className="bg-secondary border-border text-sm"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Top N</label>
                <Input type="number" min="3" max="50" value={topN} onChange={e=>setTopN(e.target.value)} className="bg-secondary border-border text-sm"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Núcleo</label>
                <Input value={nucleo} onChange={e=>setNucleo(e.target.value)} placeholder="Ex: Mississipi" className="bg-secondary border-border text-sm"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Município</label>
                <Input value={municipio} onChange={e=>setMunicipio(e.target.value)} placeholder="Ex: Barueri" className="bg-secondary border-border text-sm"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Equipe</label>
                <Input value={equipe} onChange={e=>setEquipe(e.target.value)} placeholder="Ex: Carlos" className="bg-secondary border-border text-sm"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Status</label>
                <select value={statusF} onChange={e=>setStatusF(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">Todos</option>
                  <option value="concluido">Concluído</option>
                  <option value="pendente">Pendente</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button size="sm" onClick={carregar} className="gap-1.5 flex-1">
                  <Filter className="w-3.5 h-3.5"/> Aplicar
                </Button>
                <Button size="sm" variant="outline" onClick={()=>{
                  setObraFrom("");setObraTo("");setProcFrom("");setProcTo("");
                  setNucleo("");setMunicipio("");setEquipe("");setStatusF("");
                }}>✕</Button>
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
              <MetricCard label="Período" value={data?.filtros?.obra_from ? `${data.filtros.obra_from}` : "Completo"}
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
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data!.ranking_nucleos} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" horizontal={false}/>
                        <XAxis type="number" stroke="hsl(215 15% 40%)" fontSize={10} tickLine={false} axisLine={false}/>
                        <YAxis type="category" dataKey="nucleo" stroke="hsl(215 15% 40%)" fontSize={10} tickLine={false} axisLine={false} width={90}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Bar dataKey="total" name="Total" fill="hsl(215 90% 60%)" radius={[0,4,4,0]}/>
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
