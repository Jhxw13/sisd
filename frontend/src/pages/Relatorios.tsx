import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { SectionHeader } from "@/components/DataDisplay";
import { FileBarChart, Download, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

interface HistoricoRow {
  id: string;
  protocolo: string;
  nucleo: string;
  data_referencia: string;
  _relatorios?: {
    nucleo?: string;
    url_pdf?: string;
    url_xlsx?: string;
    url_docx?: string;
  }[];
}

interface RelatorioItem {
  key: string;
  titulo: string;
  nucleo: string;
  protocolo: string;
  data: string;
  url: string;
  tipo: string;
}

interface FotoItem {
  id: string;
  url: string;
  nome_arquivo: string;
  protocolo: string;
  nucleo: string;
  municipio: string;
  data_referencia: string;
}

export default function Relatorios() {
  const [rows, setRows] = useState<HistoricoRow[]>([]);
  const [fotos, setFotos] = useState<FotoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, fotosRes] = await Promise.all([
        apiFetch("/api/historico?page=1&per_page=100"),
        apiFetch("/api/fotos?limit=60"),
      ]);
      setRows(res.data || []);
      setFotos(fotosRes || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const relatorios = useMemo<RelatorioItem[]>(() => {
    const out: RelatorioItem[] = [];
    rows.forEach((r) => {
      (r._relatorios || []).forEach((rel, idx) => {
        const url = rel.url_pdf || rel.url_xlsx || rel.url_docx;
        if (!url) return;
        let tipo = "Arquivo";
        if (rel.url_pdf) tipo = "PDF";
        else if (rel.url_xlsx) tipo = "XLSX";
        else if (rel.url_docx) tipo = "DOCX";

        out.push({
          key: `${r.id}-${idx}`,
          titulo: `Relatorio ${rel.nucleo || r.nucleo || "-"}`,
          nucleo: rel.nucleo || r.nucleo || "-",
          protocolo: r.protocolo,
          data: r.data_referencia || "-",
          url,
          tipo,
        });
      });
    });
    return out;
  }, [rows]);

  return (
    <AppLayout title="Relatorios" subtitle="Arquivos reais gerados no processamento">
      <div className="space-y-6">
        <div className="glass-surface rounded-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-2">
            <SectionHeader title="Relatorios disponiveis" subtitle="Dados reais vindos do backend" />
          </div>

          {loading ? (
            <div className="px-6 py-10 text-sm text-muted-foreground text-center">Carregando...</div>
          ) : relatorios.length === 0 ? (
            <div className="px-6 py-10 text-sm text-muted-foreground text-center">Nenhum relatorio encontrado.</div>
          ) : (
            relatorios.map((r) => (
              <div key={r.key} className="flex items-center gap-4 px-6 py-3.5 border-b border-border/50">
                <FileBarChart className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground flex-1 truncate">{r.titulo}</span>
                <span className="text-xs text-muted-foreground w-28 truncate">{r.nucleo}</span>
                <span className="font-mono-data text-xs text-muted-foreground w-28 truncate">{r.protocolo}</span>
                <span className="font-mono-data text-xs text-muted-foreground w-24">{r.data}</span>
                <span className="text-xs text-muted-foreground w-16">{r.tipo}</span>
                <div className="w-24 text-right">
                  <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs">
                    <a href={r.url} target="_blank" rel="noreferrer">
                      <Download className="w-3.5 h-3.5" /> Abrir
                    </a>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="glass-surface rounded-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-2">
            <SectionHeader title="Base fotografica diaria" subtitle="Fotos enviadas nos relatorios de campo" />
          </div>
          {loading ? (
            <div className="px-6 py-10 text-sm text-muted-foreground text-center">Carregando fotos...</div>
          ) : fotos.length === 0 ? (
            <div className="px-6 py-10 text-sm text-muted-foreground text-center">Nenhuma foto enviada ainda.</div>
          ) : (
            <div className="p-6 pt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {fotos.map((f) => (
                <a
                  key={f.id}
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block rounded-xl border border-border overflow-hidden hover:border-primary/40 transition-colors"
                >
                  <div className="aspect-[4/3] bg-secondary">
                    <img src={f.url} alt={f.nome_arquivo} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="p-2.5 space-y-1">
                    <p className="text-xs text-foreground truncate flex items-center gap-1">
                      <Camera className="w-3 h-3 text-primary" /> {f.nucleo || "Sem nucleo"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{f.protocolo || "-"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{f.municipio || "-"} · {f.data_referencia || "-"}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
