/**
 * FormularioRelatorio.tsx
 * Rota pública: /relatorio  (sem login)
 * Operário de campo preenche e envia direto para o banco.
 *
 * Adicionar ao App.tsx:
 *   import FormularioRelatorio from "./pages/FormularioRelatorio";
 *   <Route path="/relatorio" element={<FormularioRelatorio />} />
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Droplets, Plus, Trash2, Send, CheckCircle2,
  ChevronDown, AlertTriangle, StickyNote, Wrench,
  User, Calendar, MapPin, Users, ImagePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

// ─── Tipos ───────────────────────────────────────────────────
interface LinhaExecucao { servico: string; quantidade: string; unidade: string }
interface LinhaOcorrencia { descricao: string }
interface LinhaObservacao { texto: string }

interface Nucleo {
  id: string;
  nome: string;
  municipio: string;
  logradouros: string[];
  equipes: string[];
}

// ─── Componente auxiliar: seção expansível ───────────────────
function Secao({
  icon, title, count, cor, children,
}: {
  icon: React.ReactNode; title: string; count: number;
  cor: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="glass-surface rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl", cor)}>{icon}</div>
          <span className="font-medium text-foreground">{title}</span>
          {count > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-mono-data">
              {count}
            </span>
          )}
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-2 border-t border-border/50 space-y-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────
export default function FormularioRelatorio() {
  // Dados do núcleo
  const [nucleos, setNucleos] = useState<Nucleo[]>([]);
  const [nucleoSel, setNucleoSel] = useState<Nucleo | null>(null);

  // Cabeçalho
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [nucleo, setNucleo] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [cep, setCep] = useState("");
  const [equipe, setEquipe] = useState("");
  const [enviadoPor, setEnviadoPor] = useState("");

  // Linhas dinâmicas
  const [execucao, setExecucao] = useState<LinhaExecucao[]>([{ servico: "", quantidade: "", unidade: "un" }]);
  const [ocorrencias, setOcorrencias] = useState<LinhaOcorrencia[]>([]);
  const [observacoes, setObservacoes] = useState<LinhaObservacao[]>([]);
  const [fotos, setFotos] = useState<File[]>([]);

  // UI
  const [enviando, setEnviando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [protocolo, setProtocolo] = useState("");
  const [erro, setErro] = useState("");

  // Carregar núcleos
  useEffect(() => {
    fetch(`${API_URL}/api/nucleos`)
      .then(r => r.json())
      .then(setNucleos)
      .catch(() => {});
  }, []);

  // Ao selecionar núcleo, preenche logradouro e municipio padrão
  function onNucleoChange(nome: string) {
    setNucleo(nome);
    const n = nucleos.find(x => x.nome === nome);
    setNucleoSel(n ?? null);
    if (n) {
      setMunicipio(n.municipio ?? "");
      setLogradouro(n.logradouros?.[0] ?? "");
      setEquipe(n.equipes?.[0] ?? "");
    }
  }

  // ─ Execução helpers ─
  function addExec() { setExecucao(v => [...v, { servico: "", quantidade: "", unidade: "un" }]); }
  function rmExec(i: number) { setExecucao(v => v.filter((_, idx) => idx !== i)); }
  function setExecRow(i: number, field: keyof LinhaExecucao, val: string) {
    setExecucao(v => v.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  }

  // ─ Ocorrências helpers ─
  function addOcorr() { setOcorrencias(v => [...v, { descricao: "" }]); }
  function rmOcorr(i: number) { setOcorrencias(v => v.filter((_, idx) => idx !== i)); }
  function setOcorrRow(i: number, val: string) {
    setOcorrencias(v => v.map((r, idx) => idx === i ? { descricao: val } : r));
  }

  // ─ Observações helpers ─
  function addObs() { setObservacoes(v => [...v, { texto: "" }]); }
  function rmObs(i: number) { setObservacoes(v => v.filter((_, idx) => idx !== i)); }
  function setObsRow(i: number, val: string) {
    setObservacoes(v => v.map((r, idx) => idx === i ? { texto: val } : r));
  }

  // ─ Submit ─
  function normalizarCep(v: string) {
    return String(v || "").replace(/\D/g, "").slice(0, 8);
  }

  async function buscarCep() {
    const cepDigits = normalizarCep(cep);
    if (cepDigits.length !== 8) {
      setErro("CEP invalido. Use 8 digitos.");
      return;
    }
    setErro("");
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
      const json = await res.json();
      if (!res.ok || json?.erro) throw new Error("CEP nao encontrado.");
      const rua = [json.logradouro, json.bairro].filter(Boolean).join(" - ");
      if (rua) setLogradouro(rua);
      if (json.localidade) setMunicipio(json.localidade);
      setCep(cepDigits);
    } catch (e: any) {
      setErro(e?.message || "Falha ao consultar CEP.");
    } finally {
      setBuscandoCep(false);
    }
  }
  async function handleSubmit() {
    setErro("");
    if (!data || !nucleo) { setErro("Preencha a data e o núcleo."); return; }
    if (cep && normalizarCep(cep).length !== 8) { setErro("CEP invalido. Use 8 digitos."); return; }
    const execValidas = execucao.filter(r => r.servico.trim());
    if (execValidas.length === 0) { setErro("Adicione pelo menos um item de execução."); return; }

    setEnviando(true);
    try {
      const body = {
        data_referencia: data,
        nucleo,
        logradouro,
        municipio,
        cep: normalizarCep(cep),
        equipe,
        enviado_por: enviadoPor,
        execucao: execValidas.map(r => ({
          servico: r.servico,
          quantidade: r.quantidade ? parseFloat(r.quantidade) : null,
          unidade: r.unidade,
        })),
        ocorrencias: ocorrencias.filter(r => r.descricao.trim()),
        observacoes: observacoes.filter(r => r.texto.trim()),
      };

      const res = await fetch(`${API_URL}/api/entrada`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro ?? "Erro ao enviar");
      const entradaId = json.id as string;
      if (entradaId && fotos.length) {
        const fd = new FormData();
        fotos.forEach((foto) => fd.append("fotos", foto));
        const up = await fetch(`${API_URL}/api/entradas/${entradaId}/fotos`, {
          method: "POST",
          body: fd,
        });
        if (!up.ok) {
          const upJson = await up.json().catch(() => ({}));
          throw new Error(upJson.erro ?? "Relatório enviado, mas as fotos não foram salvas.");
        }
      }
      setProtocolo(json.protocolo);
    } catch (e: any) {
      setErro(e.message ?? "Erro de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  // ─── Tela de sucesso ──────────────────────────────────────
  if (protocolo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-surface rounded-3xl p-10 max-w-md w-full text-center"
        >
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-xl font-medium text-foreground mb-2">Relatório enviado!</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Seu relatório foi recebido e está aguardando revisão do gestor.
            </p>
            <div className="bg-secondary rounded-xl px-5 py-4 mb-8">
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-widest">Protocolo</p>
              <p className="font-mono-data text-lg text-primary">{protocolo}</p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setProtocolo("");
                setExecucao([{ servico: "", quantidade: "", unidade: "un" }]);
                setOcorrencias([]);
                setObservacoes([]);
                setFotos([]);
                setCep("");
                setNucleo(""); setLogradouro(""); setMunicipio(""); setEquipe("");
              }}
            >
              Enviar outro relatório
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const unidades = ["un", "m", "m2", "kg", "l"];

  // ─── Formulário ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-sidebar sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Droplets className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">Sabesp</span>
            <span className="text-xs text-muted-foreground ml-2">Relatório de Campo</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-medium text-foreground">Novo Relatório Diário</h1>
          <p className="text-sm text-muted-foreground mt-1">Preencha os dados da execução do dia.</p>
        </motion.div>

        {/* ─ Cabeçalho ─ */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="glass-surface rounded-2xl p-6 space-y-4">
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-semibold">Identificação</p>

            {/* Enviado por + Data */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <User className="w-3 h-3" /> Seu nome
                </label>
                <Input
                  placeholder="Ex: João Silva"
                  value={enviadoPor}
                  onChange={e => setEnviadoPor(e.target.value)}
                  className="bg-secondary border-border text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Data *
                </label>
                <Input
                  type="date"
                  value={data}
                  onChange={e => setData(e.target.value)}
                  className="bg-secondary border-border text-sm"
                />
              </div>
            </div>

            {/* Núcleo */}
            <div className="space-y-1.5 mb-3">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> Núcleo *
              </label>
              <select
                value={nucleo}
                onChange={e => onNucleoChange(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Selecionar núcleo…</option>
                {nucleos.map(n => (
                  <option key={n.id} value={n.nome}>{n.nome}</option>
                ))}
              </select>
            </div>

            {/* Logradouro + Município + Equipe */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">CEP</label>
                <div className="flex gap-2">
                  <Input
                    value={cep}
                    onChange={e => setCep(normalizarCep(e.target.value))}
                    placeholder="00000000"
                    className="bg-secondary border-border text-sm"
                  />
                  <Button type="button" variant="outline" onClick={buscarCep} disabled={buscandoCep} className="shrink-0">
                    {buscandoCep ? "..." : "Buscar"}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Logradouro</label>
                {nucleoSel?.logradouros?.length ? (
                  <select
                    value={logradouro}
                    onChange={e => setLogradouro(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {nucleoSel.logradouros.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                ) : (
                  <Input value={logradouro} onChange={e => setLogradouro(e.target.value)}
                    placeholder="Rua / Viela" className="bg-secondary border-border text-sm" />
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Município</label>
                <Input value={municipio} onChange={e => setMunicipio(e.target.value)}
                  placeholder="Cidade" className="bg-secondary border-border text-sm" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3 h-3" /> Equipe
                </label>
                {nucleoSel?.equipes?.length ? (
                  <select
                    value={equipe}
                    onChange={e => setEquipe(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {nucleoSel.equipes.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                  </select>
                ) : (
                  <Input value={equipe} onChange={e => setEquipe(e.target.value)}
                    placeholder="Equipe 01" className="bg-secondary border-border text-sm" />
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─ Execução ─ */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Secao icon={<Wrench className="w-4 h-4 text-primary" />} title="Execução Diária"
            count={execucao.filter(r => r.servico).length} cor="bg-primary/10">
            <AnimatePresence>
              {execucao.map((row, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }} className="grid grid-cols-[1fr_80px_80px_32px] gap-2 items-center">
                  <Input placeholder="Serviço executado" value={row.servico}
                    onChange={e => setExecRow(i, "servico", e.target.value)}
                    className="bg-secondary border-border text-sm" />
                  <Input placeholder="Qtd" type="number" value={row.quantidade}
                    onChange={e => setExecRow(i, "quantidade", e.target.value)}
                    className="bg-secondary border-border text-sm" />
                  <select value={row.unidade} onChange={e => setExecRow(i, "unidade", e.target.value)}
                    className="bg-secondary border border-border rounded-md px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                    {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button type="button" onClick={() => rmExec(i)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            <button type="button" onClick={addExec}
              className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors mt-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar serviço
            </button>
          </Secao>
        </motion.div>

        {/* ─ Ocorrências ─ */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Secao icon={<AlertTriangle className="w-4 h-4 text-warning" />} title="Ocorrências"
            count={ocorrencias.filter(r => r.descricao).length} cor="bg-warning/10">
            <AnimatePresence>
              {ocorrencias.map((row, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }} className="flex gap-2 items-start">
                  <Textarea placeholder="Descreva a ocorrência…" value={row.descricao}
                    onChange={e => setOcorrRow(i, e.target.value)} rows={2}
                    className="bg-secondary border-border text-sm resize-none flex-1" />
                  <button type="button" onClick={() => rmOcorr(i)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors mt-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            <button type="button" onClick={addOcorr}
              className="flex items-center gap-2 text-xs text-warning hover:text-warning/80 transition-colors mt-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar ocorrência
            </button>
          </Secao>
        </motion.div>

        {/* ─ Observações ─ */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Secao icon={<StickyNote className="w-4 h-4 text-accent" />} title="Observações"
            count={observacoes.filter(r => r.texto).length} cor="bg-accent/10">
            <AnimatePresence>
              {observacoes.map((row, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }} className="flex gap-2 items-start">
                  <Textarea placeholder="Observação…" value={row.texto}
                    onChange={e => setObsRow(i, e.target.value)} rows={2}
                    className="bg-secondary border-border text-sm resize-none flex-1" />
                  <button type="button" onClick={() => rmObs(i)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors mt-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            <button type="button" onClick={addObs}
              className="flex items-center gap-2 text-xs text-accent hover:text-accent/80 transition-colors mt-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar observação
            </button>
          </Secao>
        </motion.div>

        {/* ─ Fotos ─ */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
          <Secao icon={<ImagePlus className="w-4 h-4 text-primary" />} title="Fotos do Relatório"
            count={fotos.length} cor="bg-primary/10">
            <div className="space-y-2">
              <Input
                type="file"
                multiple
                accept="image/*"
                onChange={e => setFotos(Array.from(e.target.files || []).slice(0, 12))}
                className="bg-secondary border-border text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Até 12 fotos. As imagens serão enviadas para a base fotográfica do painel.
              </p>
              {fotos.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {fotos.map((foto, i) => (
                    <div key={`${foto.name}-${i}`} className="text-xs text-muted-foreground truncate bg-secondary rounded-md px-2 py-1.5">
                      {foto.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Secao>
        </motion.div>

        {/* ─ Erro + Submit ─ */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="pb-8">
          <AnimatePresence>
            {erro && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 mb-4">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{erro}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <Button onClick={handleSubmit} disabled={enviando}
            className="w-full h-12 text-sm font-medium gap-2 rounded-xl">
            {enviando ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Enviando…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Enviar Relatório
              </span>
            )}
          </Button>
        </motion.div>
      </main>
    </div>
  );
}

