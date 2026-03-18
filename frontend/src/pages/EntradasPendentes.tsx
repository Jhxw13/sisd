/**
 * EntradasPendentes.tsx
 * Painel privado: /entradas  (requer login)
 * Gestor ve, revisa e aprova/rejeita entradas + dispara geracao de relatorios.
 *
 * Adicionar ao App.tsx:
 *   import EntradasPendentes from "./pages/EntradasPendentes";
 *   <Route path="/entradas" element={<PrivateRoute><EntradasPendentes /></PrivateRoute>} />
 *
 * Adicionar ao AppSidebar.tsx:
 *   { title: "Entradas", url: "/entradas", icon: ClipboardList },
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList, CheckCircle2, XCircle, Play, Eye,
  RefreshCw, Filter, ChevronRight, AlertTriangle,
  Wrench, StickyNote, Clock, Download, MapPin,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/MetricCard";
import { SectionHeader, StatusBadge, DataRow } from "@/components/DataDisplay";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { openStreetViewPopup } from "@/lib/maps";


// â”€â”€â”€ Tipos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type StatusEntrada = "pendente" | "em_revisao" | "aprovado" | "processando" | "concluido" | "rejeitado";

interface Entrada {
  id: string; protocolo: string; nucleo: string;
  data_referencia: string; equipe: string; logradouro: string; municipio: string; cep?: string;
  status: StatusEntrada; enviado_por: string;
  created_at: string; processado_em?: string;
}

interface EntradaDetalhe extends Entrada {
  execucao: { servico: string; quantidade: number; unidade: string }[];
  ocorrencias: { descricao: string }[];
  observacoes: { texto: string }[];
  relatorios: { nucleo: string; url_pdf?: string; url_xlsx?: string; url_docx?: string }[];
  historico: { evento: string; detalhe: string; created_at: string }[];
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const STATUS_CONFIG: Record<StatusEntrada, { label: string; color: string; badge: string }> = {
  pendente:    { label: "Pendente",    color: "text-warning",     badge: "bg-warning/10 text-warning" },
  em_revisao:  { label: "Em revisao",  color: "text-info",        badge: "bg-primary/10 text-primary" },
  aprovado:    { label: "Aprovado",    color: "text-accent",      badge: "bg-accent/10 text-accent" },
  processando: { label: "Processando", color: "text-primary",     badge: "bg-primary/10 text-primary animate-pulse" },
  concluido:   { label: "Concluido",   color: "text-accent",      badge: "bg-accent/10 text-accent" },
  rejeitado:   { label: "Rejeitado",   color: "text-destructive", badge: "bg-destructive/10 text-destructive" },
};

async function api(path: string, opts: RequestInit = {}) {
  return apiFetch(path, opts);
}

// â”€â”€â”€ Modal de detalhe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ModalDetalhe({
  entradaId, onClose, onUpdate,
}: { entradaId: string; onClose: () => void; onUpdate: () => void }) {
  const [entrada, setEntrada] = useState<EntradaDetalhe | null>(null);
  const [acao, setAcao] = useState<"" | "rejeitando">("");
  const [obsGestor, setObsGestor] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDetalhe, setLoadingDetalhe] = useState(true);
  const [erroDetalhe, setErroDetalhe] = useState("");

  const carregarDetalhe = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoadingDetalhe(true);
    try {
      const res = await api(`/api/entradas/${entradaId}`);
      setEntrada(res);
      setErroDetalhe("");
      return res;
    } catch (err: any) {
      if (!silencioso) {
        setErroDetalhe(err?.message || "Nao foi possivel carregar os detalhes desta entrada.");
      }
      return null;
    } finally {
      if (!silencioso) setLoadingDetalhe(false);
    }
  }, [entradaId]);

  useEffect(() => {
    carregarDetalhe(false);
  }, [carregarDetalhe]);

  useEffect(() => {
    if (entrada?.status !== "processando") return;
    const timer = setInterval(() => {
      carregarDetalhe(true);
      onUpdate();
    }, 4000);
    return () => clearInterval(timer);
  }, [entrada?.status, carregarDetalhe, onUpdate]);

  async function patchStatus(status: StatusEntrada) {
    setLoading(true);
    try {
      await api(`/api/entradas/${entradaId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, observacao_gestor: obsGestor }),
      });
      onUpdate();
      setEntrada(prev => prev ? { ...prev, status } : null);
    } finally { setLoading(false); }
  }

  async function processar() {
    setLoading(true);
    try {
      await api(`/api/entradas/${entradaId}/processar`, { method: "POST" });
      onUpdate();
      setEntrada(prev => prev ? { ...prev, status: "processando" } : null);
      setTimeout(() => { carregarDetalhe(true); }, 1200);
    } catch (err: any) {
      setErroDetalhe(err?.message || "Falha ao iniciar o processamento.");
    } finally { setLoading(false); }
  }

  if (loadingDetalhe) return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
  if (!entrada) return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-elevated rounded-2xl p-6 max-w-md w-full text-center">
        <p className="text-sm text-destructive mb-4">{erroDetalhe || "Falha ao carregar entrada."}</p>
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  );

  const cfg = STATUS_CONFIG[entrada.status];
  const openStreetView = async () => {
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
        className="glass-elevated rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="relative z-10 p-6">
          {/* Header modal */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", cfg.badge)}>{cfg.label}</span>
                <span className="text-xs font-mono-data text-muted-foreground">{entrada.protocolo}</span>
              </div>
              <h2 className="text-lg font-medium text-foreground">{entrada.nucleo}</h2>
              <p className="text-sm text-muted-foreground">{entrada.data_referencia} · {entrada.equipe}</p>
              {entrada.logradouro && (
                <button
                  type="button"
                  onClick={() => { void openStreetView(); }}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  title="Abrir no Street View"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {entrada.logradouro}
                </button>
              )}
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">✕</button>
          </div>

          {/* Execucao */}
          {entrada.execucao.length > 0 && (
            <div className="mb-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                <Wrench className="w-3 h-3" /> Execucao ({entrada.execucao.length})
              </p>
              <div className="space-y-1">
                {entrada.execucao.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 text-sm">
                    <span className="text-foreground">{r.servico}</span>
                    <span className="font-mono-data text-muted-foreground">{r.quantidade} {r.unidade}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ocorrencias */}
          {entrada.ocorrencias.length > 0 && (
            <div className="mb-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-warning" /> Ocorrencias
              </p>
              {entrada.ocorrencias.map((r, i) => (
                <p key={i} className="text-sm text-foreground py-1.5 border-b border-border/50">{r.descricao}</p>
              ))}
            </div>
          )}

          {/* Observacoes */}
          {entrada.observacoes.length > 0 && (
            <div className="mb-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                <StickyNote className="w-3 h-3 text-accent" /> Observacoes
              </p>
              {entrada.observacoes.map((r, i) => (
                <p key={i} className="text-sm text-foreground py-1.5 border-b border-border/50">{r.texto}</p>
              ))}
            </div>
          )}

          {/* Relatorios gerados */}
          {entrada.relatorios.length > 0 && (
            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                <Download className="w-3 h-3 text-accent" /> Arquivos gerados
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {entrada.relatorios.map((r, i) => (
                  <div key={i} className="bg-secondary rounded-xl p-3 flex items-center justify-between">
                    <span className="text-sm text-foreground">{r.nucleo}</span>
                    <div className="flex gap-2">
                      {r.url_pdf  && <a href={r.url_pdf}  target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">PDF</a>}
                      {r.url_docx && <a href={r.url_docx} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">DOCX</a>}
                      {r.url_xlsx && <a href={r.url_xlsx} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">XLSX</a>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acoes */}
          {entrada.status === "rejeitando" ? null : null}
          {acao === "rejeitando" && (
            <div className="mb-4">
              <textarea
                value={obsGestor} onChange={e => setObsGestor(e.target.value)}
                placeholder="Motivo da rejeicao..." rows={3}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex gap-2 mt-2">
                <Button variant="destructive" size="sm" onClick={() => patchStatus("rejeitado")} disabled={loading}>
                  Confirmar rejeicao
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAcao("")}>Cancelar</Button>
              </div>
            </div>
          )}

          {acao !== "rejeitando" && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              {(entrada.status === "pendente" || entrada.status === "em_revisao") && (
                <>
                  <Button size="sm" onClick={() => processar()} disabled={loading}
                    className="gap-1.5">
                    <Play className="w-3.5 h-3.5" /> Gerar Relatorios
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => patchStatus("aprovado")} disabled={loading}
                    className="gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAcao("rejeitando")} disabled={loading}
                    className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                    <XCircle className="w-3.5 h-3.5" /> Rejeitar
                  </Button>
                </>
              )}
              {entrada.status === "aprovado" && (
                <Button size="sm" onClick={() => processar()} disabled={loading} className="gap-1.5">
                  <Play className="w-3.5 h-3.5" /> Gerar Relatorios
                </Button>
              )}
              {entrada.status === "processando" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  Gerando arquivos... atualizando automaticamente
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// Pagina principal
export default function EntradasPendentes() {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [total, setTotal] = useState(0);
  const [filtroStatus, setFiltroStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (filtroStatus) params.set("status", filtroStatus);
      const data = await api(`/api/entradas?${params}`);
      setEntradas(data.data);
      setTotal(data.total);
    } finally { setLoading(false); }
  }, [page, filtroStatus]);

  useEffect(() => { carregar(); }, [carregar]);

  // Auto-refresh enquanto ha itens processando
  useEffect(() => {
    const temProcessando = entradas.some(e => e.status === "processando");
    if (!temProcessando) return;
    const t = setInterval(carregar, 5000);
    return () => clearInterval(t);
  }, [entradas, carregar]);

  const pendentes    = entradas.filter(e => e.status === "pendente").length;
  const processando  = entradas.filter(e => e.status === "processando").length;
  const concluidos   = entradas.filter(e => e.status === "concluido").length;

  const FILTROS: { label: string; value: string }[] = [
    { label: "Todos", value: "" },
    { label: "Pendentes", value: "pendente" },
    { label: "Em revisao", value: "em_revisao" },
    { label: "Aprovados", value: "aprovado" },
    { label: "Processando", value: "processando" },
    { label: "Concluidos", value: "concluido" },
    { label: "Rejeitados", value: "rejeitado" },
  ];

  return (
    <AppLayout title="Entradas" subtitle="Relatorios recebidos dos operadores de campo">
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard label="Pendentes" value={String(pendentes)}
            icon={<Clock className="w-5 h-5" />}
            changeType={pendentes > 0 ? "negative" : "neutral"} />
          <MetricCard label="Processando" value={String(processando)}
            icon={<Play className="w-5 h-5" />}
            changeType="neutral" />
          <MetricCard label="Concluidos hoje" value={String(concluidos)}
            icon={<CheckCircle2 className="w-5 h-5" />}
            changeType="positive" />
        </div>

        {/* Tabela */}
        <div className="glass-surface rounded-2xl overflow-hidden">
          <div className="relative z-10">
            <div className="px-6 pt-6 pb-4 flex items-center justify-between gap-4 flex-wrap">
              <SectionHeader title="Entradas recebidas" subtitle={`${total} no total`} />
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={carregar} className="gap-1.5 text-muted-foreground">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Filtros por status */}
            <div className="flex gap-1.5 px-6 pb-4 flex-wrap">
              {FILTROS.map(f => (
                <button key={f.value} onClick={() => { setFiltroStatus(f.value); setPage(1); }}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                    filtroStatus === f.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground",
                  )}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Header tabela */}
            <div className="grid grid-cols-[1fr_120px_100px_100px_32px] gap-4 px-6 py-2.5 border-y border-border text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              <span>Nucleo / Data</span>
              <span>Protocolo</span>
              <span>Equipe</span>
              <span>Status</span>
              <span />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <span className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin mr-2" />
                Carregando...
              </div>
            ) : entradas.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhuma entrada encontrada.
              </div>
            ) : (
              <AnimatePresence>
                {entradas.map((e, i) => {
                  const cfg = STATUS_CONFIG[e.status];
                  return (
                    <motion.div key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="grid grid-cols-[1fr_120px_100px_100px_32px] gap-4 items-center px-6 py-3.5 border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer"
                      onClick={() => setDetalheId(e.id)}>
                      <div>
                        <p className="text-sm font-medium text-foreground">{e.nucleo}</p>
                        <p className="text-xs text-muted-foreground">{e.data_referencia} · {e.enviado_por || "Anonimo"}</p>
                      </div>
                      <span className="font-mono-data text-xs text-muted-foreground">{e.protocolo}</span>
                      <span className="text-sm text-muted-foreground truncate">{e.equipe}</span>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium w-fit", cfg.badge)}>
                        {cfg.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* Modal detalhe */}
      <AnimatePresence>
        {detalheId && (
          <ModalDetalhe
            entradaId={detalheId}
            onClose={() => setDetalheId(null)}
            onUpdate={() => { carregar(); }}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}


