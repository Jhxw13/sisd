/**
 * Institucional.tsx — /institucional
 * Relatório institucional narrativo com filtros e exportação
 */
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Filter, Download, ChevronDown, TrendingUp, MapPin, Users, Wrench, AlertTriangle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface NucleoAnalise {
  nucleo:string; municipio:string; processamentos:number;
  principais_servicos:{servico:string;total:number;descricao_institucional:string}[];
  principais_ocorrencias:{descricao:string;descricao_institucional:string}[];
  observacoes_relevantes:string[];
}

interface RelatorioFinal {
  header:{titulo:string;periodo:string};
  indicadores_principais:{total_processamentos:number;total_nucleos:number;total_equipes:number;total_execucoes:number;total_ocorrencias:number};
  ranking_servicos:{servico:string;total:number;descricao_institucional:string}[];
  analise_por_nucleo:NucleoAnalise[];
  conclusao:string;
  top_nucleo:string; top_equipe:string; top_servico:string;
}

export default function Institucional() {
  const [report, setReport]     = useState<{relatorio_final:RelatorioFinal}|null>(null);
  const [loading, setLoading]   = useState(false);
  const [obraFrom, setObraFrom] = useState("");
  const [obraTo, setObraTo]     = useState("");
  const [nucleo, setNucleo]     = useState("");
  const [municipio, setMunicipio] = useState("");
  const [equipe, setEquipe]     = useState("");
  const [topN, setTopN]         = useState("10");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const gerar = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({top_n:topN});
      if (obraFrom)  p.set("obra_from",obraFrom);
      if (obraTo)    p.set("obra_to",obraTo);
      if (nucleo)    p.set("nucleo",nucleo);
      if (municipio) p.set("municipio",municipio);
      if (equipe)    p.set("equipe",equipe);
      setReport(await apiFetch(`/api/institucional?${p}`));
    } finally { setLoading(false); }
  }, [obraFrom,obraTo,nucleo,municipio,equipe,topN]);

  function toggleExpand(n:string) {
    setExpanded(s => { const ns=new Set(s); ns.has(n)?ns.delete(n):ns.add(n); return ns; });
  }

  const rf = report?.relatorio_final;

  return (
    <AppLayout title="Relatório Institucional" subtitle="Minuta executiva do período operacional">
      <div className="space-y-6">
        {/* Filtros */}
        <div className="glass-surface rounded-2xl p-6">
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-semibold">Filtros de geração</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Obra — de</label>
                <Input type="date" value={obraFrom} onChange={e=>setObraFrom(e.target.value)} className="bg-secondary border-border text-sm"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Obra — até</label>
                <Input type="date" value={obraTo} onChange={e=>setObraTo(e.target.value)} className="bg-secondary border-border text-sm"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Núcleo</label>
                <Input value={nucleo} onChange={e=>setNucleo(e.target.value)} placeholder="Filtrar" className="bg-secondary border-border text-sm"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Município</label>
                <Input value={municipio} onChange={e=>setMunicipio(e.target.value)} placeholder="Filtrar" className="bg-secondary border-border text-sm"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Equipe</label>
                <Input value={equipe} onChange={e=>setEquipe(e.target.value)} placeholder="Filtrar" className="bg-secondary border-border text-sm"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Top N</label>
                <Input type="number" min="3" max="50" value={topN} onChange={e=>setTopN(e.target.value)} className="bg-secondary border-border text-sm"/>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={gerar} disabled={loading} className="gap-1.5">
                {loading ? <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"/> : <FileText className="w-4 h-4"/>}
                {loading ? "Gerando…" : "Gerar minuta"}
              </Button>
              {rf && (
                <Button variant="outline" className="gap-1.5" onClick={()=>{
                  const content = gerarTextoPlano(rf);
                  const b = new Blob([content],{type:"text/plain;charset=utf-8"});
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(b);
                  a.download = `relatorio_institucional_${new Date().toISOString().split("T")[0]}.txt`;
                  a.click();
                }}>
                  <Download className="w-4 h-4"/> Exportar TXT
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Relatório */}
        {rf && (
          <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="space-y-4">
            {/* Cabeçalho */}
            <div className="glass-surface rounded-2xl p-8">
              <div className="relative z-10">
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Síntese institucional</div>
                <h2 className="text-2xl font-medium text-foreground mb-1">{rf.header.titulo}</h2>
                <p className="text-sm text-muted-foreground">{rf.header.periodo}</p>
              </div>
            </div>

            {/* KPIs institucionais */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                {label:"Processamentos",value:rf.indicadores_principais.total_processamentos,icon:<TrendingUp className="w-5 h-5"/>},
                {label:"Núcleos",value:rf.indicadores_principais.total_nucleos,icon:<MapPin className="w-5 h-5"/>},
                {label:"Equipes",value:rf.indicadores_principais.total_equipes,icon:<Users className="w-5 h-5"/>},
                {label:"Execuções",value:rf.indicadores_principais.total_execucoes,icon:<Wrench className="w-5 h-5"/>},
                {label:"Ocorrências",value:rf.indicadores_principais.total_ocorrencias,icon:<AlertTriangle className="w-5 h-5"/>},
              ].map((k,i)=>(
                <div key={i} className="glass-surface rounded-2xl p-5">
                  <div className="relative z-10">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary w-fit mb-3">{k.icon}</div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{k.label}</p>
                    <p className="text-2xl font-medium font-mono-data text-foreground">{k.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Conclusão */}
            <div className="glass-surface rounded-2xl p-6 border-l-4 border-primary">
              <div className="relative z-10">
                <p className="text-xs uppercase tracking-widest text-primary mb-3 font-semibold">Leitura institucional</p>
                <p className="text-sm text-foreground leading-relaxed">{rf.conclusao}</p>
              </div>
            </div>

            {/* Serviços principais */}
            {rf.ranking_servicos.length>0 && (
              <div className="glass-surface rounded-2xl p-6">
                <div className="relative z-10">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-semibold">Serviços principais do período</p>
                  <div className="space-y-2">
                    {rf.ranking_servicos.slice(0,8).map((s,i)=>(
                      <div key={i} className="flex justify-between items-center py-2 border-b border-border/50">
                        <p className="text-sm text-foreground">{s.descricao_institucional}</p>
                        <span className="font-mono-data text-sm text-primary ml-4 flex-shrink-0">{s.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Análise por núcleo */}
            <div className="glass-surface rounded-2xl overflow-hidden">
              <div className="relative z-10 px-6 pt-6 pb-2">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Análise por núcleo</p>
              </div>
              {rf.analise_por_nucleo.map((n,i)=>(
                <div key={i} className="border-t border-border/50">
                  <button onClick={()=>toggleExpand(n.nucleo)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-hover transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary/10">
                        <MapPin className="w-3.5 h-3.5 text-primary"/>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">{n.nucleo}</p>
                        <p className="text-xs text-muted-foreground">{n.municipio} · {n.processamentos} processamentos</p>
                      </div>
                    </div>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform",expanded.has(n.nucleo)&&"rotate-180")}/>
                  </button>

                  <AnimatePresence>
                    {expanded.has(n.nucleo) && (
                      <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}}
                        exit={{height:0,opacity:0}} className="overflow-hidden">
                        <div className="px-6 pb-6 space-y-4">
                          {n.principais_servicos.length>0 && (
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Wrench className="w-3 h-3"/> Serviços executados
                              </p>
                              {n.principais_servicos.map((s,j)=>(
                                <p key={j} className="text-sm text-foreground py-1.5 border-b border-border/30">
                                  {s.descricao_institucional}
                                </p>
                              ))}
                            </div>
                          )}
                          {n.principais_ocorrencias.length>0 && (
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <AlertTriangle className="w-3 h-3 text-warning"/> Ocorrências
                              </p>
                              {n.principais_ocorrencias.map((o,j)=>(
                                <p key={j} className="text-sm text-foreground py-1.5 border-b border-border/30">{o.descricao_institucional}</p>
                              ))}
                            </div>
                          )}
                          {n.observacoes_relevantes.length>0 && (
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Observações</p>
                              {n.observacoes_relevantes.map((o,j)=>(
                                <p key={j} className="text-sm text-muted-foreground py-1.5 border-b border-border/30 italic">{o}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}

function gerarTextoPlano(rf: RelatorioFinal): string {
  const lines: string[] = [
    rf.header.titulo.toUpperCase(),
    `Período: ${rf.header.periodo}`,
    "=".repeat(60),
    "",
    "INDICADORES PRINCIPAIS",
    "-".repeat(40),
    `Processamentos: ${rf.indicadores_principais.total_processamentos}`,
    `Núcleos: ${rf.indicadores_principais.total_nucleos}`,
    `Equipes: ${rf.indicadores_principais.total_equipes}`,
    `Execuções: ${rf.indicadores_principais.total_execucoes}`,
    `Ocorrências: ${rf.indicadores_principais.total_ocorrencias}`,
    "",
    "LEITURA INSTITUCIONAL",
    "-".repeat(40),
    rf.conclusao,
    "",
    "ANÁLISE POR NÚCLEO",
    "-".repeat(40),
  ];
  rf.analise_por_nucleo.forEach(n => {
    lines.push(`\n${n.nucleo} (${n.municipio}) — ${n.processamentos} processamentos`);
    n.principais_servicos.forEach(s => lines.push(`  • ${s.descricao_institucional}`));
    if (n.principais_ocorrencias.length) {
      lines.push("  Ocorrências:");
      n.principais_ocorrencias.forEach(o => lines.push(`  ⚠ ${o.descricao_institucional}`));
    }
  });
  return lines.join("\n");
}
