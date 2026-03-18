/**
 * Historico.tsx — /historico
 * Rastreabilidade operacional com todos os filtros do sistema antigo
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Filter, RefreshCw, ChevronRight, Download, Play,
  CheckCircle2, Clock, AlertTriangle, FileText, Wrench, StickyNote, Image as ImageIcon, MapPin,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/MetricCard";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { SectionHeader } from "@/components/DataDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { openStreetViewPopup } from "@/lib/maps";
import { useSearchParams } from "react-router-dom";

const STATUS_CFG: Record<string,{label:string;badge:string}> = {
  pendente:    {label:"Pendente",    badge:"bg-warning/10 text-warning"},
  em_revisao:  {label:"Em revisão",  badge:"bg-primary/10 text-primary"},
  aprovado:    {label:"Aprovado",    badge:"bg-accent/10 text-accent"},
  processando: {label:"Processando", badge:"bg-primary/10 text-primary animate-pulse"},
  concluido:   {label:"Concluído",   badge:"bg-accent/10 text-accent"},
  rejeitado:   {label:"Rejeitado",   badge:"bg-destructive/10 text-destructive"},
};

interface EntradaRow {
  id:string; protocolo:string; nucleo:string; municipio:string;
  equipe:string; logradouro:string; data_referencia:string; cep?: string;
  status:string; enviado_por:string; created_at:string;
  _execucao_count?:number; _ocorr_count?:number; _relatorios?:any[];
}

interface EntradaDetalhe extends EntradaRow {
  execucao: { servico: string; quantidade?: number; unidade?: string }[];
  ocorrencias: { descricao: string }[];
  observacoes: { texto: string }[];
  historico: { evento: string; detalhe: string; created_at: string }[];
  relatorios: { nucleo?: string; url_pdf?: string; url_xlsx?: string; url_docx?: string; url_md?: string }[];
  fotos: { id: string; url: string; nome_arquivo?: string; created_at?: string }[];
}

function ModalHistoricoDetalhe({
  entradaId, onClose, onUpdate,
}: { entradaId: string; onClose: () => void; onUpdate: () => void }) {
  const [entrada, setEntrada] = useState<EntradaDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [processandoAgora, setProcessandoAgora] = useState(false);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro("");
    apiFetch(`/api/entradas/${entradaId}`)
      .then((res) => {
        if (!ativo) return;
        setEntrada(res);
      })
      .catch((err: any) => {
        if (!ativo) return;
        setErro(err?.message || "Falha ao carregar os dados do processamento.");
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => { ativo = false; };
  }, [entradaId]);

  async function gerarRelatorios() {
    if (!entrada) return;
    setProcessandoAgora(true);
    try {
      await apiFetch(`/api/entradas/${entrada.id}/processar`, { method: "POST" });
      setEntrada((prev) => (prev ? { ...prev, status: "processando" } : prev));
      onUpdate();
    } catch (err: any) {
      setErro(err?.message || "Falha ao iniciar geracao de relatorios.");
    } finally {
      setProcessandoAgora(false);
    }
  }
  const abrirStreetView = async () => {
    if (!entrada) return;
    await openStreetViewPopup({
      logradouro: entrada.logradouro,
      municipio: entrada.municipio,
      cep: entrada.cep,
    });
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-elevated rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <div className="relative z-10 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg font-medium text-foreground">
                {entrada?.nucleo || "Detalhe do processamento"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {(entrada?.protocolo || "")} {entrada?.data_referencia ? `· ${entrada.data_referencia}` : ""}
              </p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">×</button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <span className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin mr-2" />
              Carregando detalhes...
            </div>
          )}
          {!loading && erro && (
            <div className="text-sm text-destructive py-4">{erro}</div>
          )}
          {!loading && entrada && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                {["pendente", "em_revisao", "aprovado"].includes(entrada.status) && (
                  <Button size="sm" onClick={gerarRelatorios} disabled={processandoAgora}>
                    <Play className="w-3.5 h-3.5 mr-1.5" />
                    {processandoAgora ? "Iniciando..." : "Gerar Relatorios"}
                  </Button>
                )}
                {entrada.status === "processando" && (
                  <span className="text-xs text-muted-foreground">Processamento em andamento...</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="bg-secondary rounded-lg px-3 py-2"><span className="text-muted-foreground">Equipe:</span> {entrada.equipe || "-"}</div>
                <div className="bg-secondary rounded-lg px-3 py-2"><span className="text-muted-foreground">Municipio:</span> {entrada.municipio || "-"}</div>
                <div className="bg-secondary rounded-lg px-3 py-2">
                  <span className="text-muted-foreground">Logradouro:</span>{" "}
                  {entrada.logradouro ? (
                    <button type="button" onClick={() => { void abrirStreetView(); }} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <MapPin className="w-3.5 h-3.5" />
                      {entrada.logradouro}
                    </button>
                  ) : "-"}
                </div>
                <div className="bg-secondary rounded-lg px-3 py-2"><span className="text-muted-foreground">Status:</span> {entrada.status || "-"}</div>
              </div>

              {!!entrada.execucao?.length && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Wrench className="w-3 h-3" /> Execucao ({entrada.execucao.length})
                  </p>
                  <div className="space-y-1">
                    {entrada.execucao.map((r, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 text-sm">
                        <span>{r.servico}</span>
                        <span className="font-mono-data text-muted-foreground">{r.quantidade ?? "-"} {r.unidade ?? ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!!entrada.ocorrencias?.length && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-warning" /> Ocorrencias ({entrada.ocorrencias.length})
                  </p>
                  {entrada.ocorrencias.map((r, i) => (
                    <p key={i} className="text-sm py-1.5 border-b border-border/50">{r.descricao}</p>
                  ))}
                </div>
              )}

              {!!entrada.observacoes?.length && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                    <StickyNote className="w-3 h-3 text-accent" /> Observacoes ({entrada.observacoes.length})
                  </p>
                  {entrada.observacoes.map((r, i) => (
                    <p key={i} className="text-sm py-1.5 border-b border-border/50">{r.texto}</p>
                  ))}
                </div>
              )}

              {!!entrada.relatorios?.length && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Relatorios vinculados</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {entrada.relatorios.map((r, i) => (
                      <div key={i} className="bg-secondary rounded-xl p-3 flex items-center justify-between">
                        <span className="text-sm">{r.nucleo || entrada.nucleo}</span>
                        <div className="flex gap-2 text-xs">
                          {r.url_pdf && <a className="text-primary hover:underline" href={r.url_pdf} target="_blank" rel="noreferrer">PDF</a>}
                          {r.url_docx && <a className="text-primary hover:underline" href={r.url_docx} target="_blank" rel="noreferrer">DOCX</a>}
                          {r.url_xlsx && <a className="text-primary hover:underline" href={r.url_xlsx} target="_blank" rel="noreferrer">XLSX</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!!entrada.fotos?.length && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                    <ImageIcon className="w-3 h-3" /> Fotos ({entrada.fotos.length})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {entrada.fotos.map((f) => (
                      <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="rounded-lg overflow-hidden border border-border block">
                        <img src={f.url} alt={f.nome_arquivo || "foto"} className="w-full h-24 object-cover" loading="lazy" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function Historico() {
  const [searchParams] = useSearchParams();
  const [rows, setRows]           = useState<EntradaRow[]>([]);
  const [total, setTotal]         = useState(0);
  const [kpis, setKpis]           = useState({total:0,sucesso:0,erro:0,filtrado:0});
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  const queryStatus = searchParams.getAll("status");
  const queryNucleo = searchParams.getAll("nucleo");
  const queryMunicipio = searchParams.getAll("municipio");
  const queryEquipe = searchParams.getAll("equipe");

  // Filtros aplicados
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState<string[]>(queryStatus.length > 0 ? queryStatus : (searchParams.get("status") ? [searchParams.get("status") as string] : []));
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [nucleo, setNucleo] = useState<string[]>(queryNucleo.length > 0 ? queryNucleo : (searchParams.get("nucleo") ? [searchParams.get("nucleo") as string] : []));
  const [municipio, setMunicipio] = useState<string[]>(queryMunicipio.length > 0 ? queryMunicipio : (searchParams.get("municipio") ? [searchParams.get("municipio") as string] : []));
  const [equipe, setEquipe] = useState<string[]>(queryEquipe.length > 0 ? queryEquipe : (searchParams.get("equipe") ? [searchParams.get("equipe") as string] : []));
  const [procDe, setProcDe] = useState("");
  const [procAte, setProcAte] = useState("");

  // Filtros em edicao (draft)
  const [qDraft, setQDraft] = useState(searchParams.get("q") ?? "");
  const [statusDraft, setStatusDraft] = useState<string[]>(queryStatus.length > 0 ? queryStatus : (searchParams.get("status") ? [searchParams.get("status") as string] : []));
  const [dataDeDraft, setDataDeDraft] = useState("");
  const [dataAteDraft, setDataAteDraft] = useState("");
  const [nucleoDraft, setNucleoDraft] = useState<string[]>(queryNucleo.length > 0 ? queryNucleo : (searchParams.get("nucleo") ? [searchParams.get("nucleo") as string] : []));
  const [municipioDraft, setMunicipioDraft] = useState<string[]>(queryMunicipio.length > 0 ? queryMunicipio : (searchParams.get("municipio") ? [searchParams.get("municipio") as string] : []));
  const [equipeDraft, setEquipeDraft] = useState<string[]>(queryEquipe.length > 0 ? queryEquipe : (searchParams.get("equipe") ? [searchParams.get("equipe") as string] : []));
  const [procDeDraft, setProcDeDraft] = useState("");
  const [procAteDraft, setProcAteDraft] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({page:String(page),per_page:"20"});
      if (q)          p.set("q",q);
      status.forEach((v) => p.append("status", v));
      if (dataDe)     p.set("data_de",dataDe);
      if (dataAte)    p.set("data_ate",dataAte);
      nucleo.forEach((v) => p.append("nucleo", v));
      municipio.forEach((v) => p.append("municipio", v));
      equipe.forEach((v) => p.append("equipe", v));
      if (procDe)     p.set("processado_de",procDe);
      if (procAte)    p.set("processado_ate",procAte);

      const res = await apiFetch(`/api/historico?${p}`);
      setRows(res.data||[]);
      setTotal(res.total||0);
      setKpis(res.kpis||{total:0,sucesso:0,erro:0,filtrado:0});
    } finally { setLoading(false); }
  }, [page,q,status,dataDe,dataAte,nucleo,municipio,equipe,procDe,procAte]);

  useEffect(()=>{ carregar(); },[carregar]);
  useEffect(() => {
    const nextQ = searchParams.get("q") ?? "";
    const nextStatus = searchParams.getAll("status");
    const nextNucleo = searchParams.getAll("nucleo");
    const nextMunicipio = searchParams.getAll("municipio");
    const nextEquipe = searchParams.getAll("equipe");

    setQ(nextQ);
    setQDraft(nextQ);
    setStatus(nextStatus.length > 0 ? nextStatus : (searchParams.get("status") ? [searchParams.get("status") as string] : []));
    setStatusDraft(nextStatus.length > 0 ? nextStatus : (searchParams.get("status") ? [searchParams.get("status") as string] : []));
    setNucleo(nextNucleo.length > 0 ? nextNucleo : (searchParams.get("nucleo") ? [searchParams.get("nucleo") as string] : []));
    setNucleoDraft(nextNucleo.length > 0 ? nextNucleo : (searchParams.get("nucleo") ? [searchParams.get("nucleo") as string] : []));
    setMunicipio(nextMunicipio.length > 0 ? nextMunicipio : (searchParams.get("municipio") ? [searchParams.get("municipio") as string] : []));
    setMunicipioDraft(nextMunicipio.length > 0 ? nextMunicipio : (searchParams.get("municipio") ? [searchParams.get("municipio") as string] : []));
    setEquipe(nextEquipe.length > 0 ? nextEquipe : (searchParams.get("equipe") ? [searchParams.get("equipe") as string] : []));
    setEquipeDraft(nextEquipe.length > 0 ? nextEquipe : (searchParams.get("equipe") ? [searchParams.get("equipe") as string] : []));
    setPage(1);
  }, [searchParams]);

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
  const nucleoOptions = useMemo(
    () => Array.from(new Set([...rows.map((r) => String(r.nucleo || "").trim()), ...nucleoDraft])).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows, nucleoDraft],
  );
  const municipioOptions = useMemo(
    () => Array.from(new Set([...rows.map((r) => String(r.municipio || "").trim()), ...municipioDraft])).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows, municipioDraft],
  );
  const equipeOptions = useMemo(
    () => Array.from(new Set([...rows.map((r) => String(r.equipe || "").trim()), ...equipeDraft])).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows, equipeDraft],
  );

  function aplicarFiltros() {
    setQ(qDraft.trim());
    setStatus(statusDraft);
    setDataDe(dataDeDraft);
    setDataAte(dataAteDraft);
    setNucleo(nucleoDraft);
    setMunicipio(municipioDraft);
    setEquipe(equipeDraft);
    setProcDe(procDeDraft);
    setProcAte(procAteDraft);
    setPage(1);
  }

  function limpar() {
    setQ(""); setStatus([]); setDataDe(""); setDataAte("");
    setNucleo([]); setMunicipio([]); setEquipe([]); setProcDe(""); setProcAte("");
    setQDraft(""); setStatusDraft([]); setDataDeDraft(""); setDataAteDraft("");
    setNucleoDraft([]); setMunicipioDraft([]); setEquipeDraft([]); setProcDeDraft(""); setProcAteDraft("");
    setPage(1);
  }

  const totalPgs = Math.ceil(total/20);

  async function gerarDaLinha(row: EntradaRow) {
    setProcessandoId(row.id);
    try {
      await apiFetch(`/api/entradas/${row.id}/processar`, { method: "POST" });
      await carregar();
    } finally {
      setProcessandoId(null);
    }
  }

  return (
    <AppLayout title="Histórico" subtitle="Rastreabilidade operacional de todos os processamentos">
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total (janela)" value={String(total)}
            icon={<FileText className="w-5 h-5"/>} />
          <MetricCard label="Concluídos" value={String(kpis.sucesso)}
            icon={<CheckCircle2 className="w-5 h-5"/>} changeType="positive"/>
          <MetricCard label="Pendentes" value={String(rows.filter(r=>r.status==="pendente").length)}
            icon={<Clock className="w-5 h-5"/>} changeType="negative"/>
          <MetricCard label="Exibindo" value={String(rows.length)}
            icon={<Filter className="w-5 h-5"/>}/>
        </div>

        {/* Filtros */}
        <div className="glass-surface rounded-2xl overflow-hidden">
          <div className="relative z-10">
            <button onClick={()=>setShowFilters(v=>!v)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-hover transition-colors">
              <span className="text-sm font-medium text-foreground flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary"/> Filtros
                {(
                  [q, dataDe, dataAte, procDe, procAte].filter(Boolean).length +
                  (status.length > 0 ? 1 : 0) +
                  (nucleo.length > 0 ? 1 : 0) +
                  (municipio.length > 0 ? 1 : 0) +
                  (equipe.length > 0 ? 1 : 0)
                ) > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                    {(
                      [q, dataDe, dataAte, procDe, procAte].filter(Boolean).length +
                      (status.length > 0 ? 1 : 0) +
                      (nucleo.length > 0 ? 1 : 0) +
                      (municipio.length > 0 ? 1 : 0) +
                      (equipe.length > 0 ? 1 : 0)
                    )} ativos
                  </span>
                )}
              </span>
              <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform",showFilters&&"rotate-90")}/>
            </button>

            <AnimatePresence>
              {showFilters && (
                <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}}
                  exit={{height:0,opacity:0}} className="overflow-hidden border-t border-border/50">
                  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="sm:col-span-2 lg:col-span-3 space-y-1.5">
                      <label className="text-xs text-muted-foreground">Busca livre</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
                        <Input value={qDraft} onChange={e=>setQDraft(e.target.value)} placeholder="Nucleo, equipe, municipio, logradouro, protocolo..."
                          className="pl-10 bg-secondary border-border text-sm"/>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Status</label>
                      <MultiSelectFilter label="Selecionar status" options={statusOptions} value={statusDraft} onChange={setStatusDraft} emptyLabel="Todos os status" />
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
                      <label className="text-xs text-muted-foreground">Data da obra - de</label>
                      <Input type="date" value={dataDeDraft} onChange={e=>setDataDeDraft(e.target.value)} className="bg-secondary border-border text-sm"/>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Data da obra - ate</label>
                      <Input type="date" value={dataAteDraft} onChange={e=>setDataAteDraft(e.target.value)} className="bg-secondary border-border text-sm"/>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Processado em - de</label>
                      <Input type="date" value={procDeDraft} onChange={e=>setProcDeDraft(e.target.value)} className="bg-secondary border-border text-sm"/>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Processado em - ate</label>
                      <Input type="date" value={procAteDraft} onChange={e=>setProcAteDraft(e.target.value)} className="bg-secondary border-border text-sm"/>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3 flex gap-2 pt-2">
                      <Button size="sm" onClick={aplicarFiltros} className="gap-1.5">
                        <Search className="w-3.5 h-3.5"/> Aplicar filtros
                      </Button>
                      <Button size="sm" variant="outline" onClick={limpar}>Limpar</Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Tabela */}
        <div className="glass-surface rounded-2xl overflow-hidden">
          <div className="relative z-10">
            <div className="px-6 pt-6 pb-4 flex items-center justify-between">
              <SectionHeader title="Processamentos" subtitle={`${total} registros`}/>
              <Button variant="ghost" size="sm" onClick={carregar}>
                <RefreshCw className="w-3.5 h-3.5"/>
              </Button>
            </div>

            <div className="grid grid-cols-[1fr_110px_90px_90px_100px_32px] gap-3 px-6 py-2.5 border-y border-border text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
              <span>Núcleo / Data</span><span>Protocolo</span><span>Equipe</span>
              <span>Execução</span><span>Status</span><span/>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <span className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin mr-2"/>
                Carregando…
              </div>
            ) : rows.length===0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhum registro encontrado com os filtros atuais.
              </div>
            ) : (
              <AnimatePresence>
                {rows.map((row,i)=>{
                  const cfg = STATUS_CFG[row.status] || {label:row.status,badge:"bg-muted text-muted-foreground"};
                  return (
                    <motion.div key={row.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.02}}
                      className="grid grid-cols-[1fr_110px_90px_90px_100px_32px] gap-3 items-center px-6 py-3.5 border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer"
                      onClick={() => setDetalheId(row.id)}>
                      <div>
                        <p className="text-sm font-medium text-foreground">{row.nucleo||"—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.data_referencia} · {row.municipio||row.logradouro||row.enviado_por||""}
                        </p>
                      </div>
                      <span className="font-mono-data text-xs text-muted-foreground truncate">{row.protocolo}</span>
                      <span className="text-sm text-muted-foreground truncate">{row.equipe||"—"}</span>
                      <span className="font-mono-data text-sm text-foreground">{row._execucao_count||0}</span>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium w-fit",cfg.badge)}>
                        {cfg.label}
                      </span>
                      <div className="flex gap-1">
                        {["pendente","em_revisao","aprovado"].includes(row.status) && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); gerarDaLinha(row); }}
                            className="text-primary hover:text-primary/80 disabled:opacity-40"
                            disabled={processandoId === row.id}
                            title="Gerar relatorios"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(row._relatorios||[]).slice(0,1).map((r:any,j:number)=>(
                          r.url_pdf && <a key={j} href={r.url_pdf} target="_blank" rel="noreferrer"
                            onClick={(e)=>e.stopPropagation()}
                            className="text-primary hover:text-primary/80">
                            <Download className="w-3.5 h-3.5"/>
                          </a>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}

            {/* Paginação */}
            {totalPgs>1 && (
              <div className="flex items-center justify-center gap-2 px-6 py-4 border-t border-border">
                <Button size="sm" variant="outline" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>←</Button>
                <span className="text-sm text-muted-foreground">{page} / {totalPgs}</span>
                <Button size="sm" variant="outline" disabled={page>=totalPgs} onClick={()=>setPage(p=>p+1)}>→</Button>
              </div>
            )}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {detalheId && (
          <ModalHistoricoDetalhe
            entradaId={detalheId}
            onClose={() => setDetalheId(null)}
            onUpdate={carregar}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

