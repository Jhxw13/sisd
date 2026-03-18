/**
 * NucleosCadastro.tsx — /nucleos-cadastro
 * CRUD completo de núcleos (substitui /nucleos do sistema antigo)
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, Search, MapPin, CheckCircle2, XCircle, Save, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/DataDisplay";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface Nucleo {
  id:string; nome:string; municipio:string; status:string;
  logradouros:string[]; equipes:string[]; aliases:string[]; observacoes:string;
}

const EMPTY: Omit<Nucleo,"id"> = {
  nome:"", municipio:"", status:"ativo",
  logradouros:[], equipes:[], aliases:[], observacoes:"",
};

function arrToText(a: string[]) { return (a||[]).join("\n"); }
function textToArr(t: string) { return t.split(/[\n;/]+/).map(s=>s.trim()).filter(Boolean); }

export default function NucleosCadastro() {
  const [nucleos, setNucleos]   = useState<Nucleo[]>([]);
  const [loading, setLoading]   = useState(true);
  const [q, setQ]               = useState("");
  const [statusF, setStatusF]   = useState("ativo");
  const [editing, setEditing]   = useState<Nucleo|null>(null);
  const [isNew, setIsNew]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<{type:"ok"|"err";text:string}|null>(null);

  // form state
  const [form, setForm] = useState(EMPTY);
  const [logText, setLogText] = useState("");
  const [eqText, setEqText]   = useState("");
  const [aliText, setAliText] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q)       p.set("q",q);
      if (statusF) p.set("status",statusF);
      const res = await apiFetch(`/api/nucleos/todos?${p}`);
      setNucleos(res);
    } finally { setLoading(false); }
  }, [q, statusF]);

  useEffect(()=>{ carregar(); },[carregar]);

  function abrirNovo() {
    setForm(EMPTY); setLogText(""); setEqText(""); setAliText("");
    setEditing(null); setIsNew(true);
  }

  function abrirEditar(n: Nucleo) {
    setForm({nome:n.nome,municipio:n.municipio,status:n.status,
             logradouros:n.logradouros,equipes:n.equipes,aliases:n.aliases,observacoes:n.observacoes});
    setLogText(arrToText(n.logradouros));
    setEqText(arrToText(n.equipes));
    setAliText(arrToText(n.aliases));
    setEditing(n); setIsNew(false);
  }

  function fechar() { setEditing(null); setIsNew(false); setMsg(null); }

  async function salvar() {
    if (!form.nome || !form.municipio) {
      setMsg({type:"err",text:"Nome e município são obrigatórios."}); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        logradouros: textToArr(logText),
        equipes:     textToArr(eqText),
        aliases:     textToArr(aliText),
      };
      if (isNew) {
        await apiFetch("/api/nucleos", {method:"POST",body:JSON.stringify(payload)});
      } else if (editing) {
        await apiFetch(`/api/nucleos/${editing.id}`, {method:"PUT",body:JSON.stringify(payload)});
      }
      setMsg({type:"ok",text:"Salvo com sucesso!"});
      await carregar();
      setTimeout(fechar, 1200);
    } catch(e:any) {
      setMsg({type:"err",text:e.message||"Erro ao salvar."});
    } finally { setSaving(false); }
  }

  async function inativar(n: Nucleo) {
    if (!confirm(`Inativar o núcleo "${n.nome}"?`)) return;
    await apiFetch(`/api/nucleos/${n.id}`,{method:"DELETE"});
    carregar();
  }

  const showForm = isNew || !!editing;

  return (
    <AppLayout title="Cadastro de Núcleos" subtitle="Fonte oficial de referência para reconciliação">
      <div className="space-y-6">
        {/* Busca + ações */}
        <div className="glass-surface rounded-2xl p-6">
          <div className="relative z-10 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
              <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar núcleo, município, alias…"
                className="pl-10 bg-secondary border-border text-sm"/>
            </div>
            <select value={statusF} onChange={e=>setStatusF(e.target.value)}
              className="bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Todos</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
            <Button size="sm" onClick={carregar} variant="outline">Buscar</Button>
            <Button size="sm" onClick={abrirNovo} className="gap-1.5 ml-auto">
              <Plus className="w-4 h-4"/> Novo núcleo
            </Button>
          </div>
        </div>

        {/* Formulário */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
              className="glass-surface rounded-2xl p-6 border border-primary/20">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <p className="text-sm font-medium text-foreground">
                    {isNew ? "Novo núcleo" : `Editando: ${editing?.nome}`}
                  </p>
                  <button onClick={fechar} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4"/>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Nome oficial *</label>
                    <Input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))}
                      placeholder="Ex: Mississipi" className="bg-secondary border-border text-sm"/>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Município oficial *</label>
                    <Input value={form.municipio} onChange={e=>setForm(f=>({...f,municipio:e.target.value}))}
                      placeholder="Ex: Barueri" className="bg-secondary border-border text-sm"/>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Status</label>
                    <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}
                      className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Observações</label>
                    <Input value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))}
                      placeholder="Nota opcional" className="bg-secondary border-border text-sm"/>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Logradouros padrão (1 por linha)</label>
                    <textarea value={logText} onChange={e=>setLogText(e.target.value)} rows={3}
                      placeholder={"Viela Seis\nViela Mississipi"}
                      className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"/>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Equipes padrão (1 por linha)</label>
                    <textarea value={eqText} onChange={e=>setEqText(e.target.value)} rows={3}
                      placeholder={"Carlos\nWeslyn"}
                      className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"/>
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs text-muted-foreground">Aliases / variações aceitas (1 por linha)</label>
                    <textarea value={aliText} onChange={e=>setAliText(e.target.value)} rows={2}
                      placeholder={"Mississippi\nMissisipi\nViela Mississipi"}
                      className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"/>
                  </div>
                </div>

                {msg && (
                  <div className={cn("flex items-center gap-2 text-sm mb-4 p-3 rounded-xl",
                    msg.type==="ok" ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive")}>
                    {msg.type==="ok" ? <CheckCircle2 className="w-4 h-4"/> : <XCircle className="w-4 h-4"/>}
                    {msg.text}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={salvar} disabled={saving} className="gap-1.5">
                    {saving ? <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"/> : <Save className="w-4 h-4"/>}
                    {saving ? "Salvando…" : "Salvar"}
                  </Button>
                  <Button variant="outline" onClick={fechar}>Cancelar</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lista */}
        <div className="glass-surface rounded-2xl overflow-hidden">
          <div className="relative z-10">
            <div className="px-6 pt-6 pb-4">
              <SectionHeader title="Núcleos cadastrados" subtitle={`${nucleos.length} resultado(s)`}/>
            </div>
            <div className="grid grid-cols-[1fr_110px_80px_80px_64px] gap-4 px-6 py-2.5 border-y border-border text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
              <span>Núcleo</span><span>Município</span><span>Aliases</span><span>Status</span><span/>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <span className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin mr-2"/> Carregando…
              </div>
            ) : nucleos.length===0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Nenhum núcleo encontrado.</div>
            ) : (
              nucleos.map((n,i)=>(
                <motion.div key={n.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.03}}
                  className="grid grid-cols-[1fr_110px_80px_80px_64px] gap-4 items-center px-6 py-3.5 border-b border-border/50 hover:bg-surface-hover transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">{n.nome}</p>
                    {n.logradouros?.length>0 && (
                      <p className="text-xs text-muted-foreground truncate">{n.logradouros.slice(0,2).join(", ")}</p>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">{n.municipio}</span>
                  <span className="text-sm font-mono-data text-muted-foreground">{n.aliases?.length||0}</span>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium w-fit",
                    n.status==="ativo" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground")}>
                    {n.status==="ativo"?"Ativo":"Inativo"}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={()=>abrirEditar(n)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                      <Edit2 className="w-3.5 h-3.5"/>
                    </button>
                    <button onClick={()=>inativar(n)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
