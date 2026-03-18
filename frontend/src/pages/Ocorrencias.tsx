import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { SectionHeader } from "@/components/DataDisplay";
import { MetricCard } from "@/components/MetricCard";
import { AlertTriangle, Clock, CheckCircle2, Search, ExternalLink, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface OcorrenciaDetalhada {
  id: string;
  descricao: string;
  nucleo: string;
  municipio: string;
  logradouro: string;
  equipe: string;
  data_referencia: string;
  protocolo: string;
  status_entrada: string;
  entrada_id: string;
  relatorios: { url_pdf?: string; url_docx?: string; url_xlsx?: string }[];
}

interface GerencialData {
  kpis_principais: {
    total_ocorrencias: number;
    total_processamentos: number;
    nao_mapeados: number;
  };
}

export default function Ocorrencias() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<GerencialData | null>(null);
  const [rows, setRows] = useState<OcorrenciaDetalhada[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, o] = await Promise.all([
        apiFetch("/api/gerencial?top_n=10"),
        apiFetch(`/api/ocorrencias?limit=120${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`),
      ]);
      setKpis(g);
      setRows(o || []);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  const totalComRelatorio = useMemo(
    () => rows.filter((r) => (r.relatorios || []).some((x) => x.url_pdf || x.url_docx || x.url_xlsx)).length,
    [rows],
  );

  return (
    <AppLayout title="Ocorrencias" subtitle="Ocorrencias detalhadas com vinculo ao relatorio completo">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Ocorrencias" value={String(kpis?.kpis_principais.total_ocorrencias ?? 0)} icon={<AlertTriangle className="w-5 h-5" />} />
          <MetricCard label="Processamentos" value={String(kpis?.kpis_principais.total_processamentos ?? 0)} icon={<CheckCircle2 className="w-5 h-5" />} />
          <MetricCard label="Nao Mapeados" value={String(kpis?.kpis_principais.nao_mapeados ?? 0)} icon={<Clock className="w-5 h-5" />} />
          <MetricCard label="Com relatorio" value={String(totalComRelatorio)} icon={<FileText className="w-5 h-5" />} />
        </div>

        <div className="glass-surface rounded-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-3 space-y-3">
            <SectionHeader title="Lista de ocorrencias" subtitle="Passe o mouse para ver contexto completo e acessos rapidos" />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load()}
                  placeholder="Buscar por descricao, nucleo, municipio, equipe ou protocolo"
                  className="pl-10"
                />
              </div>
              <Button variant="outline" onClick={load}>Buscar</Button>
            </div>
          </div>
          {loading ? (
            <div className="px-6 py-10 text-sm text-muted-foreground text-center">Carregando ocorrencias reais...</div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-10 text-sm text-muted-foreground text-center">Sem ocorrencias no banco para o filtro atual.</div>
          ) : (
            rows.map((o, i) => {
              const rel = (o.relatorios || []).find((x) => x.url_pdf || x.url_docx || x.url_xlsx);
              const relUrl = rel?.url_pdf || rel?.url_docx || rel?.url_xlsx;
              return (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.01 }}
                  className="group relative flex items-center gap-4 px-6 py-3.5 border-b border-border/50 hover:bg-surface-hover transition-colors"
                >
                  <span className="font-mono-data text-xs text-primary w-14 text-right">{o.protocolo || `#${i + 1}`}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{o.descricao}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {o.nucleo || "Sem nucleo"} · {o.municipio || "Sem municipio"} · {o.equipe || "Sem equipe"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => navigate(`/historico${o.protocolo ? `?q=${encodeURIComponent(o.protocolo)}` : ""}`)}
                    >
                      Painel <ExternalLink className="w-3.5 h-3.5 ml-1" />
                    </Button>
                    {relUrl && (
                      <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        <a href={relUrl} target="_blank" rel="noreferrer">Relatorio</a>
                      </Button>
                    )}
                  </div>

                  <div className="pointer-events-none absolute right-5 top-full z-20 mt-2 hidden w-[320px] rounded-xl border border-border bg-background/95 p-3 text-xs shadow-xl group-hover:block">
                    <p className="font-semibold text-foreground mb-2">Preview da ocorrencia</p>
                    <p className="text-muted-foreground mb-2">{o.descricao}</p>
                    <div className="space-y-1 text-muted-foreground">
                      <p><span className="text-foreground">Nucleo:</span> {o.nucleo || "-"}</p>
                      <p><span className="text-foreground">Local:</span> {o.logradouro || "-"}, {o.municipio || "-"}</p>
                      <p><span className="text-foreground">Equipe:</span> {o.equipe || "-"}</p>
                      <p><span className="text-foreground">Data:</span> {o.data_referencia || "-"}</p>
                      <p><span className="text-foreground">Status:</span> {o.status_entrada || "-"}</p>
                      <p><span className="text-foreground">Protocolo:</span> {o.protocolo || "-"}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
