"""
api.py — API REST completa do Sistema de Gestão Sabesp
Deploy: Railway (via Dockerfile)

Variáveis de ambiente:
  SUPABASE_URL, SUPABASE_KEY (service_role), SUPABASE_BUCKET,
  SECRET_KEY, ALLOWED_ORIGINS, PORT, FLASK_DEBUG
"""
from __future__ import annotations

from dotenv import load_dotenv
load_dotenv()

import os, tempfile, threading, re, mimetypes
from collections import Counter, defaultdict
from datetime import datetime, date
from functools import wraps
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from supabase import create_client, Client

from input_layer import OfficialMessageParser, aplicar_regra_primeira_equipe, carregar_dicionario_servicos, normalizar_texto
from nucleo_master import load_nucleo_registry, reconcile_parsed_with_registry, get_nucleo_profile
from report_system import ReportGenerator, ServiceDictionary, WhatsAppReportParser, save_parsed_outputs
from base_builder import build_management_workbook

# ── Config ────────────────────────────────────────────────────
app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret")

CORS(app, origins=os.environ.get("ALLOWED_ORIGINS", "*").split(","), supports_credentials=True)

supabase: Client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
BUCKET = os.environ.get("SUPABASE_BUCKET", "relatorios")
BASE_DIR = Path(__file__).resolve().parent

# ── Parsers (init once) ───────────────────────────────────────
_dict_csv   = BASE_DIR / "config" / "service_dictionary.csv"
_dict_v2    = BASE_DIR / "config" / "service_dictionary_v2.json"
_nucleo_ref = BASE_DIR / "config" / "nucleo_reference.json"

legacy_dict    = ServiceDictionary(_dict_csv)
legacy_parser  = WhatsAppReportParser(legacy_dict)
report_gen     = ReportGenerator(legacy_dict)
nucleo_registry = load_nucleo_registry(_nucleo_ref)
official_parser = OfficialMessageParser(carregar_dicionario_servicos(_dict_v2)) if _dict_v2.exists() else None

# ── Helpers ───────────────────────────────────────────────────
def _mime(ext):
    return {".xlsx":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".pdf":"application/pdf",".docx":"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".md":"text/markdown",".csv":"text/csv",
            ".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp",".heic":"image/heic"}.get(ext.lower(),"application/octet-stream")

def _upload(local: Path, path: str) -> str | None:
    try:
        with open(local,"rb") as f:
            supabase.storage.from_(BUCKET).upload(path, f, {"content-type":_mime(local.suffix),"upsert":"true"})
        return supabase.storage.from_(BUCKET).get_public_url(path)
    except Exception as e:
        print(f"[upload] {path}: {e}"); return None

def _upload_bytes(content: bytes, path: str, filename: str = "") -> str | None:
    try:
        ext = Path(filename).suffix.lower() if filename else ""
        content_type = _mime(ext)
        if content_type == "application/octet-stream" and filename:
            guess, _ = mimetypes.guess_type(filename)
            content_type = guess or content_type
        supabase.storage.from_(BUCKET).upload(path, content, {"content-type":content_type,"upsert":"true"})
        return supabase.storage.from_(BUCKET).get_public_url(path)
    except Exception as e:
        print(f"[upload-bytes] {path}: {e}")
        return None

def _insert_foto_meta(entrada_id: str, nome_arquivo: str, url_publica: str) -> None:
    payload = {
        "entrada_id": entrada_id,
        "nome_arquivo": nome_arquivo,
        "url": url_publica,
        "created_at": datetime.utcnow().isoformat(),
    }
    try:
        supabase.table("fotos_relatorio").insert(payload).execute()
    except Exception as e:
        # Ambiente sem tabela ainda: nao quebra fluxo de upload.
        print(f"[foto-meta] {e}")

def _log(entrada_id, evento, detalhe="", uid=None):
    try:
        p: dict[str,Any] = {"entrada_id":entrada_id,"evento":evento,"detalhe":detalhe}
        if uid: p["usuario_id"] = uid
        supabase.table("historico_processamento").insert(p).execute()
    except: pass

def _parse_txt(texto, source="entrada.txt"):
    parsed = None
    if official_parser:
        parsed = official_parser.parse_text(texto, source_name=source)
    if parsed is None:
        parsed = legacy_parser.parse_text(texto, source_name=source)
    for k in ["frentes","execucao","ocorrencias","observacoes","servicos_nao_mapeados"]:
        parsed.setdefault(k, [])
    parsed.setdefault("data_referencia","")
    aplicar_regra_primeira_equipe(parsed)
    parsed = reconcile_parsed_with_registry(parsed, nucleo_registry)
    return parsed

def _salvar(parsed, enviado_por="", raw="") -> str:
    res = supabase.table("entradas").insert({
        "data_referencia": parsed.get("data_referencia") or None,
        "nucleo":    parsed.get("nucleo",""),
        "logradouro":parsed.get("logradouro",""),
        "municipio": parsed.get("municipio",""),
        "equipe":    parsed.get("equipe",""),
        "enviado_por": enviado_por, "status":"pendente", "raw_text": raw,
    }).execute()
    eid = res.data[0]["id"]
    nucleo = parsed.get("nucleo",""); equipe = parsed.get("equipe","")

    exec_rows = [{"entrada_id":eid,"servico":r.get("servico",""),"quantidade":r.get("quantidade"),
                  "unidade":r.get("unidade",""),"equipe":r.get("equipe",equipe),"nucleo":r.get("nucleo",nucleo)}
                 for r in parsed.get("execucao",[]) if r.get("servico")]
    if exec_rows: supabase.table("execucao").insert(exec_rows).execute()

    ocorr = [{"entrada_id":eid,"descricao":r.get("descricao",r.get("ocorrencia",str(r))),
              "equipe":r.get("equipe",equipe),"nucleo":r.get("nucleo",nucleo)}
             for r in parsed.get("ocorrencias",[])]
    if ocorr: supabase.table("ocorrencias").insert(ocorr).execute()

    obs = [{"entrada_id":eid,"texto":r.get("texto",r.get("observacao",str(r))),
            "equipe":r.get("equipe",equipe),"nucleo":r.get("nucleo",nucleo)}
           for r in parsed.get("observacoes",[])]
    if obs: supabase.table("observacoes").insert(obs).execute()

    snm = [{"entrada_id":eid,"texto_bruto":s.get("servico_bruto",str(s)),"nucleo":nucleo,
            "data_ref":parsed.get("data_referencia") or None}
           for s in parsed.get("servicos_nao_mapeados",[])]
    if snm: supabase.table("servicos_nao_mapeados").insert(snm).execute()
    return eid

def _processar_async(entrada_id):
    try:
        e  = supabase.table("entradas").select("*").eq("id",entrada_id).single().execute().data
        ex = supabase.table("execucao").select("*").eq("entrada_id",entrada_id).execute().data
        oc = supabase.table("ocorrencias").select("*").eq("entrada_id",entrada_id).execute().data
        ob = supabase.table("observacoes").select("*").eq("entrada_id",entrada_id).execute().data

        parsed: dict[str,Any] = {
            "data_referencia":str(e.get("data_referencia","")),
            "nucleo":e.get("nucleo",""),"logradouro":e.get("logradouro",""),
            "municipio":e.get("municipio",""),"equipe":e.get("equipe",""),
            "frentes":[], "servicos_nao_mapeados":[],
            "execucao":[{"servico":r["servico"],"quantidade":r.get("quantidade"),
                         "unidade":r.get("unidade",""),"equipe":r.get("equipe",e.get("equipe","")),
                         "nucleo":r.get("nucleo",e.get("nucleo","")),"logradouro":e.get("logradouro",""),
                         "municipio":e.get("municipio",""),"data":str(e.get("data_referencia",""))}
                        for r in ex],
            "ocorrencias":[{"descricao":r["descricao"],"equipe":r.get("equipe",e.get("equipe","")),
                            "nucleo":r.get("nucleo",e.get("nucleo","")),"data":str(e.get("data_referencia",""))}
                           for r in oc],
            "observacoes":[{"texto":r["texto"],"equipe":r.get("equipe",e.get("equipe","")),
                            "nucleo":r.get("nucleo",e.get("nucleo","")),"data":str(e.get("data_referencia",""))}
                           for r in ob],
        }

        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)/"saida"; out.mkdir()
            save_parsed_outputs(parsed, out)
            report_gen.generate_nucleus_reports(parsed, out/"relatorios_nucleos")
            build_management_workbook(out, _dict_csv, nucleo_reference_file=_nucleo_ref)

            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            pfx = f"{entrada_id[:8]}_{ts}"
            url_xlsx = _upload(out/"base_gerencial.xlsx", f"{pfx}/base_gerencial.xlsx")

            rels = []
            rd = out/"relatorios_nucleos"
            if rd.exists():
                for pdf in rd.glob("*.pdf"):
                    slug = pdf.stem
                    rels.append({"entrada_id":entrada_id,"nucleo":slug.replace("_"," ").title(),
                                 "url_pdf":_upload(pdf,f"{pfx}/{slug}.pdf"),
                                 "url_docx":_upload(rd/f"{slug}.docx",f"{pfx}/{slug}.docx") if (rd/f"{slug}.docx").exists() else None,
                                 "url_md":_upload(rd/f"{slug}.md",f"{pfx}/{slug}.md") if (rd/f"{slug}.md").exists() else None,
                                 "url_xlsx":url_xlsx})
            if rels: supabase.table("relatorios_gerados").insert(rels).execute()

        supabase.table("entradas").update({"status":"concluido","processado_em":datetime.utcnow().isoformat()}).eq("id",entrada_id).execute()
        _log(entrada_id,"concluido",f"{len(rels)} relatórios")
    except Exception as err:
        supabase.table("entradas").update({"status":"aprovado"}).eq("id",entrada_id).execute()
        _log(entrada_id,"erro",str(err))
        print(f"[async] erro {entrada_id}: {err}")

# ── Auth ──────────────────────────────────────────────────────
def _get_user():
    auth = request.headers.get("Authorization","")
    if not auth.startswith("Bearer "): return None
    try: return supabase.auth.get_user(auth.split(" ",1)[1]).user
    except: return None

def require_auth(fn):
    @wraps(fn)
    def w(*a,**kw):
        u = _get_user()
        if not u: return jsonify({"erro":"Não autorizado"}),401
        request.current_user = u
        return fn(*a,**kw)
    return w

# ════════════════════════════════════════════════════════════════
# ROTAS PÚBLICAS
# ════════════════════════════════════════════════════════════════

@app.get("/health")
def health():
    return jsonify({"ok":True,"ts":datetime.utcnow().isoformat()})

@app.get("/api/nucleos")
def get_nucleos():
    res = supabase.table("nucleos").select("id,nome,municipio,logradouros,equipes,aliases,status").eq("status","ativo").order("nome").execute()
    return jsonify(res.data)

@app.post("/api/entrada")
def post_entrada():
    body = request.get_json(force=True)
    if not body.get("data_referencia") or not body.get("nucleo"):
        return jsonify({"erro":"Campos obrigatórios: data_referencia e nucleo"}),400
    exec_v = [r for r in body.get("execucao",[]) if str(r.get("servico","")).strip()]
    if not exec_v:
        return jsonify({"erro":"Adicione pelo menos um item de execução"}),400

    nucleo=body.get("nucleo",""); equipe=body.get("equipe",""); data=body["data_referencia"]
    parsed = {
        "data_referencia":data,"nucleo":nucleo,"logradouro":body.get("logradouro",""),
        "municipio":body.get("municipio",""),"equipe":equipe,"frentes":[],"servicos_nao_mapeados":[],
        "execucao":[{"servico":r["servico"],"quantidade":r.get("quantidade"),"unidade":r.get("unidade","un"),
                     "equipe":equipe,"nucleo":nucleo,"data":data} for r in exec_v],
        "ocorrencias":[{"descricao":r["descricao"],"equipe":equipe,"nucleo":nucleo}
                       for r in body.get("ocorrencias",[]) if str(r.get("descricao","")).strip()],
        "observacoes":[{"texto":r["texto"],"equipe":equipe,"nucleo":nucleo}
                       for r in body.get("observacoes",[]) if str(r.get("texto","")).strip()],
    }
    raw = "\n".join([f"Data: {data}",f"Nucleo: {nucleo}",f"Equipe: {equipe}","","EXECUCAO:"]
                    + [f"- {r['servico']} {r.get('quantidade','')} {r.get('unidade','')}" for r in exec_v])
    eid = _salvar(parsed, enviado_por=body.get("enviado_por",""), raw=raw)
    protocolo = supabase.table("entradas").select("protocolo").eq("id",eid).single().execute().data["protocolo"]
    _log(eid,"enviado",f"por: {body.get('enviado_por','anônimo')}")
    return jsonify({"ok":True,"id":eid,"protocolo":protocolo,"mensagem":"Relatório enviado!"}),201

# ════════════════════════════════════════════════════════════════
# ROTAS AUTENTICADAS — ENTRADAS
# ════════════════════════════════════════════════════════════════

@app.get("/api/entradas")
def get_entradas():
    status  = request.args.get("status")
    nucleo  = request.args.get("nucleo")
    municipio = request.args.get("municipio")
    equipe  = request.args.get("equipe")
    q       = request.args.get("q","").strip()
    data_de = request.args.get("data_de")
    data_ate= request.args.get("data_ate")
    page    = max(1,int(request.args.get("page",1)))
    per_page= min(100,int(request.args.get("per_page",20)))
    offset  = (page-1)*per_page

    qry = (supabase.table("entradas").select("*",count="exact")
           .order("created_at",desc=True).range(offset,offset+per_page-1))
    if status:   qry = qry.eq("status",status)
    if nucleo:   qry = qry.ilike("nucleo",f"%{nucleo}%")
    if municipio:qry = qry.ilike("municipio",f"%{municipio}%")
    if equipe:   qry = qry.ilike("equipe",f"%{equipe}%")
    if data_de:  qry = qry.gte("data_referencia",data_de)
    if data_ate: qry = qry.lte("data_referencia",data_ate)
    if q:        qry = qry.or_(f"nucleo.ilike.%{q}%,equipe.ilike.%{q}%,municipio.ilike.%{q}%,logradouro.ilike.%{q}%")

    res = qry.execute()
    return jsonify({"data":res.data,"total":res.count,"page":page,"per_page":per_page})

@app.get("/api/entradas/<eid>")
def get_entrada(eid):
    e  = supabase.table("entradas").select("*").eq("id",eid).single().execute().data
    ex = supabase.table("execucao").select("*").eq("entrada_id",eid).execute().data
    oc = supabase.table("ocorrencias").select("*").eq("entrada_id",eid).execute().data
    ob = supabase.table("observacoes").select("*").eq("entrada_id",eid).execute().data
    rl = supabase.table("relatorios_gerados").select("*").eq("entrada_id",eid).execute().data
    hi = supabase.table("historico_processamento").select("*").eq("entrada_id",eid).order("created_at").execute().data
    try:
        fotos = supabase.table("fotos_relatorio").select("*").eq("entrada_id",eid).order("created_at",desc=True).execute().data
    except Exception:
        fotos = []
    return jsonify({**e,"execucao":ex,"ocorrencias":oc,"observacoes":ob,"relatorios":rl,"historico":hi,"fotos":fotos})

@app.get("/api/entradas/<eid>/fotos")
def get_fotos_entrada(eid):
    try:
        data = supabase.table("fotos_relatorio").select("*").eq("entrada_id",eid).order("created_at",desc=True).execute().data
    except Exception:
        data = []
    return jsonify(data)

@app.post("/api/entradas/<eid>/fotos")
def post_fotos_entrada(eid):
    arquivos = request.files.getlist("fotos")
    if not arquivos:
        return jsonify({"erro":"Envie arquivos no campo 'fotos'"}),400

    uploaded = []
    for arq in arquivos[:12]:
        try:
            original = arq.filename or "foto.jpg"
            safe_name = re.sub(r"[^a-zA-Z0-9._-]+","_", original)
            ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
            storage_path = f"{eid}/fotos/{ts}_{safe_name}"
            content = arq.read()
            if not content:
                continue
            url = _upload_bytes(content, storage_path, filename=safe_name)
            if url:
                _insert_foto_meta(eid, safe_name, url)
                uploaded.append({"nome_arquivo":safe_name,"url":url})
        except Exception as e:
            print(f"[foto-upload] {e}")
    if not uploaded:
        return jsonify({"erro":"Nenhuma foto foi enviada"}),422
    return jsonify({"ok":True,"fotos":uploaded}),201

@app.patch("/api/entradas/<eid>/status")
@require_auth
def patch_status(eid):
    body = request.get_json(force=True)
    st = body.get("status")
    if st not in ["pendente","em_revisao","aprovado","rejeitado"]:
        return jsonify({"erro":"Status inválido"}),400
    supabase.table("entradas").update({"status":st,"revisado_por":str(request.current_user.id),
                                        "observacao_gestor":body.get("observacao_gestor","")}).eq("id",eid).execute()
    _log(eid,st,body.get("observacao_gestor",""),str(request.current_user.id))
    return jsonify({"ok":True,"status":st})

@app.post("/api/entradas/<eid>/processar")
@require_auth
def processar(eid):
    e = supabase.table("entradas").select("status").eq("id",eid).single().execute().data
    if e["status"] not in ("pendente","em_revisao","aprovado"):
        return jsonify({"erro":"Entrada precisa estar pendente ou aprovada"}),400
    supabase.table("entradas").update({"status":"processando"}).eq("id",eid).execute()
    _log(eid,"processando","iniciado",str(request.current_user.id))
    threading.Thread(target=_processar_async,args=(eid,),daemon=True).start()
    return jsonify({"ok":True,"mensagem":"Processamento iniciado."})

# ════════════════════════════════════════════════════════════════
# DASHBOARD — dados reais do banco
# ════════════════════════════════════════════════════════════════

@app.get("/api/dashboard")
def get_dashboard():
    data_de  = request.args.get("data_de")
    data_ate = request.args.get("data_ate")
    nucleo   = request.args.get("nucleo","").strip()
    municipio= request.args.get("municipio","").strip()
    equipe   = request.args.get("equipe","").strip()
    top_n    = min(50, max(3, int(request.args.get("top_n",10))))

    q = supabase.table("entradas").select("id,protocolo,nucleo,municipio,equipe,data_referencia,status,created_at")
    if data_de:   q = q.gte("data_referencia",data_de)
    if data_ate:  q = q.lte("data_referencia",data_ate)
    if nucleo:    q = q.ilike("nucleo",f"%{nucleo}%")
    if municipio: q = q.ilike("municipio",f"%{municipio}%")
    if equipe:    q = q.ilike("equipe",f"%{equipe}%")
    entradas = q.execute().data or []

    ids = [e["id"] for e in entradas]
    exec_all = supabase.table("execucao").select("entrada_id,nucleo,equipe,servico,quantidade").in_("entrada_id", ids[:500]).execute().data if ids else []
    ocorr_all = supabase.table("ocorrencias").select("entrada_id,nucleo,equipe,descricao").in_("entrada_id", ids[:500]).execute().data if ids else []

    def _qty(v):
        try:
            return float(v or 0)
        except Exception:
            return 0.0

    # Bases auxiliares
    entrada_by_id = {e["id"]: e for e in entradas}
    exec_by_entrada: dict[str, list] = defaultdict(list)
    ocorr_by_entrada: dict[str, list] = defaultdict(list)
    for r in exec_all:
        exec_by_entrada[r.get("entrada_id")].append(r)
    for r in ocorr_all:
        ocorr_by_entrada[r.get("entrada_id")].append(r)

    # KPIs no estilo gerencial antigo
    total_frentes = len(entradas)
    total_ocorr = len(ocorr_all)
    total_itens = len(exec_all)
    total_qtd = sum(_qty(r.get("quantidade")) for r in exec_all)
    categorias_ativas = len({(r.get("servico") or "").strip().lower() for r in exec_all if (r.get("servico") or "").strip()})
    equipes_ativas = len({(e.get("equipe") or "").strip().lower() for e in entradas if (e.get("equipe") or "").strip()})
    nucleos_ativos = len({(e.get("nucleo") or "").strip().lower() for e in entradas if (e.get("nucleo") or "").strip()})
    frentes_sem_producao = sum(1 for e in entradas if len(exec_by_entrada.get(e["id"], [])) == 0)
    ocorr_por_frente = round(total_ocorr / total_frentes, 2) if total_frentes else 0.0
    risco = "ALTO" if ocorr_por_frente >= 0.6 else ("MEDIO" if ocorr_por_frente >= 0.3 else "BAIXO")

    # Visão por núcleo
    visao_nucleo: dict[str, dict[str, Any]] = {}
    for e in entradas:
        n = (e.get("nucleo") or "").strip() or "(sem nucleo)"
        if n not in visao_nucleo:
            visao_nucleo[n] = {"nucleo": n, "frentes": 0, "itens": 0, "ocorrencias": 0, "qtd_total": 0.0}
        visao_nucleo[n]["frentes"] += 1
    for r in exec_all:
        n = (r.get("nucleo") or "").strip() or "(sem nucleo)"
        if n in visao_nucleo:
            visao_nucleo[n]["itens"] += 1
            visao_nucleo[n]["qtd_total"] += _qty(r.get("quantidade"))
    for r in ocorr_all:
        n = (r.get("nucleo") or "").strip() or "(sem nucleo)"
        if n in visao_nucleo:
            visao_nucleo[n]["ocorrencias"] += 1
    visao_nucleo_rows = []
    for row in visao_nucleo.values():
        den = row["frentes"] if row["frentes"] > 0 else 1
        row["comentario"] = "Atencao operacional" if (row["ocorrencias"] / den) >= 0.5 else "Operacao estavel"
        row["qtd_total"] = round(row["qtd_total"], 2)
        visao_nucleo_rows.append(row)
    visao_nucleo_rows = sorted(visao_nucleo_rows, key=lambda x: (-x["qtd_total"], -x["frentes"], x["nucleo"]))

    # Visão por categoria
    visao_categoria: dict[str, dict[str, Any]] = {}
    for r in exec_all:
        c = (r.get("servico") or "").strip() or "(sem categoria)"
        if c not in visao_categoria:
            visao_categoria[c] = {"categoria": c, "registros": 0, "qtd_total": 0.0, "status": "Ativa"}
        visao_categoria[c]["registros"] += 1
        visao_categoria[c]["qtd_total"] += _qty(r.get("quantidade"))
    visao_categoria_rows = []
    base_part = total_qtd if total_qtd > 0 else float(max(1, total_itens))
    for row in visao_categoria.values():
        peso = row["qtd_total"] if total_qtd > 0 else float(row["registros"])
        row["participacao"] = round(100 * (peso / base_part), 1)
        row["qtd_total"] = round(row["qtd_total"], 2)
        visao_categoria_rows.append(row)
    visao_categoria_rows = sorted(visao_categoria_rows, key=lambda x: (-x["qtd_total"], -x["registros"], x["categoria"]))

    # Visão por equipe
    visao_equipe: dict[str, dict[str, Any]] = {}
    for r in exec_all:
        eq = (r.get("equipe") or "").strip() or "(sem equipe)"
        nu = (r.get("nucleo") or "").strip() or (entrada_by_id.get(r.get("entrada_id"), {}).get("nucleo") or "(sem nucleo)")
        key = f"{eq}||{nu}"
        if key not in visao_equipe:
            visao_equipe[key] = {"equipe": eq, "nucleo": nu, "qtd_total": 0.0, "registros": 0}
        visao_equipe[key]["qtd_total"] += _qty(r.get("quantidade"))
        visao_equipe[key]["registros"] += 1
    visao_equipe_rows = sorted(
        [{**v, "qtd_total": round(v["qtd_total"], 2)} for v in visao_equipe.values()],
        key=lambda x: (-x["qtd_total"], -x["registros"], x["equipe"])
    )

    # Ocorrências por tipo (classificação por palavras-chave)
    def _tipo_ocorr(texto: str) -> str:
        t = (texto or "").lower()
        if any(k in t for k in ["chuva", "tempestade", "clima", "alag", "tempo"]):
            return "clima"
        if "sem produ" in t or "nao produ" in t:
            return "sem_producao"
        if any(k in t for k in ["vistoria", "inspec", "verificacao"]):
            return "vistoria"
        if any(k in t for k in ["restri", "aguard", "material", "equip", "interferencia", "paralis"]):
            return "restricao_operacional"
        return "ocorrencia_operacional"

    ocorr_tipo_counter = Counter(_tipo_ocorr(o.get("descricao", "")) for o in ocorr_all)
    ocorrencias_por_tipo = [
        {"tipo": k, "qtd": v, "leitura": "Monitorar", "status": "Ativo"}
        for k, v in ocorr_tipo_counter.most_common(top_n)
    ]

    # Série temporal
    data_counter: dict[str,int] = defaultdict(int)
    for e in entradas:
        d = str(e.get("data_referencia","") or "")
        if d:
            data_counter[d] += 1
    serie_temporal = [{"data":k,"total":v} for k,v in sorted(data_counter.items())]

    # Rankings e leitura gerencial
    servico_counter = Counter((r.get("servico") or "").strip() for r in exec_all if (r.get("servico") or "").strip())
    maior_categoria = servico_counter.most_common(1)[0][0] if servico_counter else "-"
    maior_nucleo = visao_nucleo_rows[0]["nucleo"] if visao_nucleo_rows else "-"

    leitura_gerencial = [
        {"indicador":"Frentes cadastradas","valor": total_frentes},
        {"indicador":"Itens executados","valor": total_itens},
        {"indicador":"Ocorrencias registradas","valor": total_ocorr},
        {"indicador":"Nucleos com producao","valor": nucleos_ativos},
        {"indicador":"Maior categoria em volume","valor": maior_categoria},
        {"indicador":"Maior nucleo em volume","valor": maior_nucleo},
        {"indicador":"Frentes sem producao","valor": frentes_sem_producao},
        {"indicador":"Risco operacional","valor": risco},
    ]

    # Recentes
    recentes = (
        supabase.table("entradas")
        .select("id,protocolo,nucleo,data_referencia,status,created_at,enviado_por,equipe")
        .order("created_at",desc=True)
        .limit(10)
        .execute()
        .data or []
    )

    return jsonify({
        "meta": {
            "data_base": data_ate or data_de or (max((e.get("data_referencia") for e in entradas if e.get("data_referencia")), default=None)),
            "gerado_em": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "frentes_sem_producao": frentes_sem_producao,
            "risco_operacional": risco,
            "ocorrencias_por_frente": ocorr_por_frente,
        },
        "kpis": {
            "nucleos_ativos": nucleos_ativos,
            "frentes_registradas": total_frentes,
            "ocorrencias": total_ocorr,
            "qtd_total": round(total_qtd, 2),
            "categorias_ativas": categorias_ativas,
            "equipes_ativas": equipes_ativas,
            "itens_executados": total_itens,
        },
        "visao_nucleo": visao_nucleo_rows[:top_n],
        "visao_categoria": visao_categoria_rows[:top_n],
        "visao_equipe": visao_equipe_rows[:top_n],
        "ocorrencias_por_tipo": ocorrencias_por_tipo,
        "leitura_gerencial": leitura_gerencial,
        "ranking_servicos": [{"servico":k,"total":v} for k,v in servico_counter.most_common(top_n)],
        "serie_temporal": serie_temporal,
        "recentes": recentes,
        "filtros_ativos": {"data_de":data_de,"data_ate":data_ate,"nucleo":nucleo,"municipio":municipio,"equipe":equipe,"top_n":top_n},
    })

@app.get("/api/ocorrencias")
def get_ocorrencias_detalhadas():
    q = request.args.get("q","").strip().lower()
    limit = min(200, max(10, int(request.args.get("limit", 80))))

    ocorr = supabase.table("ocorrencias").select("*").order("created_at",desc=True).limit(limit).execute().data or []
    if not ocorr:
        return jsonify([])

    entrada_ids = list({o.get("entrada_id") for o in ocorr if o.get("entrada_id")})
    entradas = supabase.table("entradas").select("id,protocolo,nucleo,municipio,logradouro,equipe,data_referencia,status").in_("id",entrada_ids).execute().data or []
    rels = supabase.table("relatorios_gerados").select("entrada_id,nucleo,url_pdf,url_docx,url_xlsx").in_("entrada_id",entrada_ids).execute().data or []

    entrada_map = {e["id"]: e for e in entradas}
    rel_map: dict[str,list] = defaultdict(list)
    for r in rels:
        rel_map[r["entrada_id"]].append(r)

    out = []
    for o in ocorr:
        ent = entrada_map.get(o.get("entrada_id"), {})
        row = {
            "id": o.get("id"),
            "descricao": o.get("descricao",""),
            "nucleo": ent.get("nucleo",""),
            "municipio": ent.get("municipio",""),
            "logradouro": ent.get("logradouro",""),
            "equipe": ent.get("equipe",""),
            "data_referencia": ent.get("data_referencia",""),
            "protocolo": ent.get("protocolo",""),
            "status_entrada": ent.get("status",""),
            "entrada_id": o.get("entrada_id"),
            "relatorios": rel_map.get(o.get("entrada_id"),[]),
        }
        if q:
            hay = " ".join([str(row.get("descricao","")),str(row.get("nucleo","")),str(row.get("municipio","")),str(row.get("equipe","")),str(row.get("protocolo",""))]).lower()
            if q not in hay:
                continue
        out.append(row)
    return jsonify(out)

@app.get("/api/fotos")
def get_fotos_detalhadas():
    limit = min(200, max(10, int(request.args.get("limit", 80))))
    q = request.args.get("q", "").strip().lower()

    try:
        fotos = supabase.table("fotos_relatorio").select("*").order("created_at", desc=True).limit(limit).execute().data or []
    except Exception:
        return jsonify([])

    if not fotos:
        return jsonify([])

    entrada_ids = list({f.get("entrada_id") for f in fotos if f.get("entrada_id")})
    entradas = supabase.table("entradas").select(
        "id,protocolo,nucleo,municipio,logradouro,equipe,data_referencia,status"
    ).in_("id", entrada_ids).execute().data or []
    e_map = {e["id"]: e for e in entradas}

    out = []
    for f in fotos:
        ent = e_map.get(f.get("entrada_id"), {})
        row = {
            "id": f.get("id"),
            "entrada_id": f.get("entrada_id"),
            "nome_arquivo": f.get("nome_arquivo", ""),
            "url": f.get("url", ""),
            "created_at": f.get("created_at", ""),
            "protocolo": ent.get("protocolo", ""),
            "nucleo": ent.get("nucleo", ""),
            "municipio": ent.get("municipio", ""),
            "logradouro": ent.get("logradouro", ""),
            "equipe": ent.get("equipe", ""),
            "data_referencia": ent.get("data_referencia", ""),
        }
        if q:
            hay = " ".join([
                str(row.get("nome_arquivo", "")),
                str(row.get("protocolo", "")),
                str(row.get("nucleo", "")),
                str(row.get("municipio", "")),
                str(row.get("logradouro", "")),
                str(row.get("equipe", "")),
            ]).lower()
            if q not in hay:
                continue
        out.append(row)
    return jsonify(out)

# ════════════════════════════════════════════════════════════════
# HISTÓRICO — substitui /history do sistema antigo
# ════════════════════════════════════════════════════════════════

@app.get("/api/historico")
def get_historico():
    """
    Filtros: q, status, data_de, data_ate, nucleo, municipio,
             equipe, alertas (com_alerta|sem_alerta),
             processado_de, processado_ate, page, per_page
    """
    q          = request.args.get("q","").strip()
    status     = request.args.get("status","").strip()
    data_de    = request.args.get("data_de")
    data_ate   = request.args.get("data_ate")
    nucleo     = request.args.get("nucleo","").strip()
    municipio  = request.args.get("municipio","").strip()
    equipe     = request.args.get("equipe","").strip()
    alertas    = request.args.get("alertas","").strip()   # com_alerta | sem_alerta
    proc_de    = request.args.get("processado_de")
    proc_ate   = request.args.get("processado_ate")
    page       = max(1,int(request.args.get("page",1)))
    per_page   = min(100,int(request.args.get("per_page",20)))
    offset     = (page-1)*per_page

    qry = (supabase.table("entradas")
           .select("id,protocolo,nucleo,municipio,equipe,logradouro,data_referencia,status,enviado_por,created_at,processado_em,observacao_gestor",
                   count="exact")
           .order("created_at",desc=True).range(offset,offset+per_page-1))

    if status:     qry = qry.eq("status",status)
    if data_de:    qry = qry.gte("data_referencia",data_de)
    if data_ate:   qry = qry.lte("data_referencia",data_ate)
    if nucleo:     qry = qry.ilike("nucleo",f"%{nucleo}%")
    if municipio:  qry = qry.ilike("municipio",f"%{municipio}%")
    if equipe:     qry = qry.ilike("equipe",f"%{equipe}%")
    if proc_de:    qry = qry.gte("created_at",proc_de)
    if proc_ate:   qry = qry.lte("created_at",proc_ate+"T23:59:59")
    if q:
        qry = qry.or_(f"nucleo.ilike.%{q}%,equipe.ilike.%{q}%,municipio.ilike.%{q}%,"
                      f"logradouro.ilike.%{q}%,protocolo.ilike.%{q}%,enviado_por.ilike.%{q}%")

    res = qry.execute()
    rows = res.data or []

    # Enriquecer com contagens
    if rows:
        ids = [r["id"] for r in rows]
        exec_counts  = {r["id"]:0 for r in rows}
        ocorr_counts = {r["id"]:0 for r in rows}
        relat_map: dict[str,list] = {r["id"]:[] for r in rows}

        for r in supabase.table("execucao").select("entrada_id").in_("entrada_id",ids).execute().data:
            exec_counts[r["entrada_id"]] = exec_counts.get(r["entrada_id"],0)+1
        for r in supabase.table("ocorrencias").select("entrada_id").in_("entrada_id",ids).execute().data:
            ocorr_counts[r["entrada_id"]] = ocorr_counts.get(r["entrada_id"],0)+1
        for r in supabase.table("relatorios_gerados").select("entrada_id,nucleo,url_pdf,url_xlsx,url_docx").in_("entrada_id",ids).execute().data:
            relat_map[r["entrada_id"]].append(r)

        for row in rows:
            row["_execucao_count"]  = exec_counts.get(row["id"],0)
            row["_ocorr_count"]     = ocorr_counts.get(row["id"],0)
            row["_relatorios"]      = relat_map.get(row["id"],[])

    # KPIs do recorte (sem paginação)
    all_status = supabase.table("entradas").select("status").execute().data
    kpis = {
        "total":      res.count or 0,
        "sucesso":    sum(1 for r in (res.data or []) if r.get("status")=="concluido"),
        "erro":       0,
        "filtrado":   len(rows),
    }

    return jsonify({"data":rows,"total":res.count,"page":page,"per_page":per_page,"kpis":kpis})

# ════════════════════════════════════════════════════════════════
# PAINEL GERENCIAL — substitui /gerencial
# ════════════════════════════════════════════════════════════════

@app.get("/api/gerencial")
def get_gerencial():
    """
    Filtros: obra_from, obra_to, processed_from, processed_to,
             nucleo, municipio, equipe, status, alertas, top_n
    """
    obra_from    = request.args.get("obra_from")
    obra_to      = request.args.get("obra_to")
    proc_from    = request.args.get("processed_from")
    proc_to      = request.args.get("processed_to")
    nucleo       = request.args.get("nucleo","").strip()
    municipio    = request.args.get("municipio","").strip()
    equipe       = request.args.get("equipe","").strip()
    status_f     = request.args.get("status","").strip()
    top_n        = min(50,max(3,int(request.args.get("top_n",10))))

    qry = supabase.table("entradas").select("id,nucleo,municipio,equipe,data_referencia,status,created_at")
    if obra_from:  qry = qry.gte("data_referencia",obra_from)
    if obra_to:    qry = qry.lte("data_referencia",obra_to)
    if proc_from:  qry = qry.gte("created_at",proc_from)
    if proc_to:    qry = qry.lte("created_at",proc_to+"T23:59:59")
    if nucleo:     qry = qry.ilike("nucleo",f"%{nucleo}%")
    if municipio:  qry = qry.ilike("municipio",f"%{municipio}%")
    if equipe:     qry = qry.ilike("equipe",f"%{equipe}%")
    if status_f:   qry = qry.eq("status",status_f)

    entradas = qry.execute().data or []
    ids = [e["id"] for e in entradas]

    exec_all  = supabase.table("execucao").select("entrada_id,nucleo,equipe,servico,quantidade,unidade").in_("entrada_id",ids[:500]).execute().data if ids else []
    ocorr_all = supabase.table("ocorrencias").select("entrada_id,nucleo,equipe,descricao").in_("entrada_id",ids[:500]).execute().data if ids else []
    snm_all   = supabase.table("servicos_nao_mapeados").select("entrada_id,texto_bruto").in_("entrada_id",ids[:500]).execute().data if ids else []

    total_exec  = len(exec_all)
    total_ocorr = len(ocorr_all)
    total_snm   = len(snm_all)
    pct_mapeado = round(100*(total_exec/(total_exec+total_snm)),1) if (total_exec+total_snm)>0 else 100.0

    nucleo_c  = Counter(e["nucleo"] for e in entradas if e.get("nucleo"))
    equipe_c  = Counter(e["equipe"] for e in entradas if e.get("equipe"))
    mun_c     = Counter(e["municipio"] for e in entradas if e.get("municipio"))
    servico_c = Counter(r["servico"] for r in exec_all if r.get("servico"))
    ocorr_c   = Counter(r["descricao"][:60] for r in ocorr_all if r.get("descricao"))

    # Série por data
    data_c: dict[str,int] = defaultdict(int)
    for e in entradas:
        d = str(e.get("data_referencia","") or "")
        if d: data_c[d] += 1

    # por_nucleo
    nd: dict[str,dict] = {}
    for e in entradas:
        n = e.get("nucleo","") or "(sem núcleo)"
        if n not in nd: nd[n] = {"nucleo":n,"processamentos":0,"execucoes":0,"ocorrencias":0}
        nd[n]["processamentos"] += 1
    for r in exec_all:
        n = r.get("nucleo","") or "(sem núcleo)"
        if n in nd: nd[n]["execucoes"] += 1
    for r in ocorr_all:
        n = r.get("nucleo","") or "(sem núcleo)"
        if n in nd: nd[n]["ocorrencias"] += 1

    return jsonify({
        "kpis_principais": {
            "total_processamentos": len(entradas),
            "total_execucoes":      total_exec,
            "total_ocorrencias":    total_ocorr,
            "nao_mapeados":         total_snm,
            "percentual_mapeado_fmt": str(pct_mapeado),
            "nucleos_ativos":       len(nucleo_c),
            "equipes_ativas":       len(equipe_c),
        },
        "ranking_nucleos":   [{"nucleo":k,"total":v} for k,v in nucleo_c.most_common(top_n)],
        "ranking_equipes":   [{"equipe":k,"total":v} for k,v in equipe_c.most_common(top_n)],
        "ranking_municipios":[{"municipio":k,"total":v} for k,v in mun_c.most_common(top_n)],
        "ranking_servicos":  [{"servico":k,"total":v} for k,v in servico_c.most_common(top_n)],
        "ocorrencias_top":   [{"descricao":k,"total":v} for k,v in ocorr_c.most_common(top_n)],
        "serie_temporal":    [{"data":k,"total":v} for k,v in sorted(data_c.items())],
        "indicadores_por_nucleo": sorted(nd.values(),key=lambda x:-x["processamentos"])[:top_n],
        "filtros": {"obra_from":obra_from,"obra_to":obra_to,"nucleo":nucleo,
                    "municipio":municipio,"equipe":equipe,"top_n":top_n},
    })

# ════════════════════════════════════════════════════════════════
# RELATÓRIO INSTITUCIONAL — substitui /institucional
# ════════════════════════════════════════════════════════════════

@app.get("/api/institucional")
def get_institucional():
    """Gera minuta executiva. Mesmos filtros do gerencial."""
    # Reutiliza a lógica do gerencial
    from flask import current_app
    with app.test_request_context(f"/api/gerencial?{request.query_string.decode()}"):
        request.current_user = getattr(request,"current_user",None)

    # Busca dados do gerencial com os mesmos filtros
    obra_from = request.args.get("obra_from")
    obra_to   = request.args.get("obra_to")
    nucleo_f  = request.args.get("nucleo","").strip()
    municipio_f = request.args.get("municipio","").strip()
    equipe_f  = request.args.get("equipe","").strip()
    top_n     = min(50,max(3,int(request.args.get("top_n",10))))

    qry = supabase.table("entradas").select("id,nucleo,municipio,equipe,data_referencia,status,created_at")
    if obra_from:  qry = qry.gte("data_referencia",obra_from)
    if obra_to:    qry = qry.lte("data_referencia",obra_to)
    if nucleo_f:   qry = qry.ilike("nucleo",f"%{nucleo_f}%")
    if municipio_f:qry = qry.ilike("municipio",f"%{municipio_f}%")
    if equipe_f:   qry = qry.ilike("equipe",f"%{equipe_f}%")
    entradas = qry.execute().data or []
    ids = [e["id"] for e in entradas]

    exec_all  = supabase.table("execucao").select("entrada_id,nucleo,equipe,servico,quantidade,unidade").in_("entrada_id",ids[:500]).execute().data if ids else []
    ocorr_all = supabase.table("ocorrencias").select("entrada_id,nucleo,equipe,descricao").in_("entrada_id",ids[:500]).execute().data if ids else []
    obs_all   = supabase.table("observacoes").select("entrada_id,nucleo,texto").in_("entrada_id",ids[:500]).execute().data if ids else []

    # Análise por núcleo
    nd: dict[str,dict] = {}
    for e in entradas:
        n = e.get("nucleo","") or "(sem núcleo)"
        mun = e.get("municipio","")
        if n not in nd:
            nd[n] = {"nucleo":n,"municipio":mun,"processamentos":0,
                     "servicos":Counter(),"ocorrencias":[],"observacoes":[]}
        nd[n]["processamentos"] += 1
    for r in exec_all:
        n = r.get("nucleo","") or "(sem núcleo)"
        if n in nd: nd[n]["servicos"][r.get("servico","")]+=1
    for r in ocorr_all:
        n = r.get("nucleo","") or "(sem núcleo)"
        if n in nd:
            desc = r.get("descricao","")
            if desc and desc not in nd[n]["ocorrencias"][:20]:
                nd[n]["ocorrencias"].append(desc)
    for r in obs_all:
        n = r.get("nucleo","") or "(sem núcleo)"
        if n in nd:
            txt = r.get("texto","")
            if txt and txt not in nd[n]["observacoes"][:10]:
                nd[n]["observacoes"].append(txt)

    analise = []
    for n,item in sorted(nd.items(), key=lambda x:-x[1]["processamentos"]):
        top_s = item["servicos"].most_common(5)
        analise.append({
            "nucleo":           n,
            "municipio":        item["municipio"],
            "processamentos":   item["processamentos"],
            "principais_servicos": [{"servico":k,"total":v,"descricao_institucional":
                f"{k}: {v} {'registro' if v==1 else 'registros'} no período."} for k,v in top_s],
            "principais_ocorrencias": [{"descricao":d,"descricao_institucional":d}
                                       for d in item["ocorrencias"][:5]],
            "observacoes_relevantes": item["observacoes"][:3],
        })

    # KPIs globais
    nucleo_c  = Counter(e["nucleo"] for e in entradas if e.get("nucleo"))
    equipe_c  = Counter(e["equipe"] for e in entradas if e.get("equipe"))
    servico_c = Counter(r["servico"] for r in exec_all if r.get("servico"))

    top_nucleo = nucleo_c.most_common(1)[0][0] if nucleo_c else "-"
    top_equipe = equipe_c.most_common(1)[0][0] if equipe_c else "-"
    top_servico = servico_c.most_common(1)[0][0] if servico_c else "-"

    periodo_str = ""
    if obra_from and obra_to: periodo_str = f"{obra_from} a {obra_to}"
    elif obra_from: periodo_str = f"a partir de {obra_from}"
    elif obra_to:   periodo_str = f"até {obra_to}"
    else:           periodo_str = "Período completo"

    conclusao = (
        f"O período analisado ({periodo_str}) registrou {len(entradas)} processamentos, "
        f"com maior concentração em {top_nucleo}, predominância da equipe {top_equipe} "
        f"e foco em {top_servico}."
    ) if entradas else "Nenhum dado encontrado para o recorte selecionado."

    return jsonify({
        "relatorio_final": {
            "header": {"titulo":"Relatório Institucional de Obras","periodo":periodo_str},
            "indicadores_principais": {
                "total_processamentos": len(entradas),
                "total_nucleos":        len(nucleo_c),
                "total_equipes":        len(equipe_c),
                "total_execucoes":      len(exec_all),
                "total_ocorrencias":    len(ocorr_all),
            },
            "ranking_servicos":   [{"servico":k,"total":v,"descricao_institucional":
                                    f"{k}: {v} {'ocorrência' if v==1 else 'ocorrências'} no período."}
                                   for k,v in servico_c.most_common(top_n)],
            "analise_por_nucleo": analise,
            "conclusao":          conclusao,
            "top_nucleo":         top_nucleo,
            "top_equipe":         top_equipe,
            "top_servico":        top_servico,
        },
        "filtros": {"obra_from":obra_from,"obra_to":obra_to,"nucleo":nucleo_f,
                    "municipio":municipio_f,"equipe":equipe_f,"top_n":top_n},
    })

# ════════════════════════════════════════════════════════════════
# CADASTRO DE NÚCLEOS — substitui /nucleos (CRUD)
# ════════════════════════════════════════════════════════════════

@app.get("/api/nucleos/todos")
def get_nucleos_todos():
    """Lista todos os núcleos (ativos e inativos) com busca."""
    q      = request.args.get("q","").strip()
    status = request.args.get("status","").strip()
    qry    = supabase.table("nucleos").select("*").order("nome")
    if status: qry = qry.eq("status",status)
    if q:      qry = qry.or_(f"nome.ilike.%{q}%,municipio.ilike.%{q}%,observacoes.ilike.%{q}%")
    return jsonify(qry.execute().data)

@app.post("/api/nucleos")
@require_auth
def criar_nucleo():
    body = request.get_json(force=True)
    if not body.get("nome") or not body.get("municipio"):
        return jsonify({"erro":"Nome e município são obrigatórios"}),400
    payload = {
        "nome":      body["nome"].strip(),
        "municipio": body["municipio"].strip(),
        "status":    body.get("status","ativo"),
        "logradouros": body.get("logradouros",[]),
        "equipes":     body.get("equipes",[]),
        "aliases":     body.get("aliases",[]),
        "observacoes": body.get("observacoes",""),
    }
    try:
        res = supabase.table("nucleos").insert(payload).execute()
        return jsonify({"ok":True,"data":res.data[0]}),201
    except Exception as e:
        return jsonify({"erro":str(e)}),409

@app.put("/api/nucleos/<nid>")
@require_auth
def atualizar_nucleo(nid):
    body = request.get_json(force=True)
    payload = {}
    for f in ["nome","municipio","status","logradouros","equipes","aliases","observacoes"]:
        if f in body: payload[f] = body[f]
    res = supabase.table("nucleos").update(payload).eq("id",nid).execute()
    return jsonify({"ok":True,"data":res.data[0] if res.data else {}})

@app.delete("/api/nucleos/<nid>")
@require_auth
def deletar_nucleo(nid):
    # Soft delete — marca como inativo
    supabase.table("nucleos").update({"status":"inativo"}).eq("id",nid).execute()
    return jsonify({"ok":True})

# ════════════════════════════════════════════════════════════════
# SERVIÇOS NÃO MAPEADOS
# ════════════════════════════════════════════════════════════════

@app.get("/api/servicos-nao-mapeados")
def get_snm():
    res = supabase.table("servicos_nao_mapeados").select("*").eq("resolvido",False).order("created_at",desc=True).execute()
    return jsonify(res.data)

@app.patch("/api/servicos-nao-mapeados/<sid>")
@require_auth
def patch_snm(sid):
    body = request.get_json(force=True)
    supabase.table("servicos_nao_mapeados").update({
        "resolvido":True,"mapeado_para":body.get("mapeado_para","")
    }).eq("id",sid).execute()
    return jsonify({"ok":True})

# ════════════════════════════════════════════════════════════════
# IMPORTAÇÃO DE TXTs HISTÓRICOS
# ════════════════════════════════════════════════════════════════

@app.post("/api/importar/txt")
@require_auth
def importar_txt():
    if "arquivo" not in request.files:
        return jsonify({"erro":"Envie o arquivo no campo 'arquivo'"}),400
    arq = request.files["arquivo"]
    texto = arq.read().decode("utf-8",errors="replace")
    parsed = _parse_txt(texto, source=arq.filename)
    if not parsed.get("execucao") and not parsed.get("ocorrencias"):
        return jsonify({"erro":"Nenhum dado reconhecido"}),422
    eid = _salvar(parsed, enviado_por=f"importação: {arq.filename}", raw=texto)
    proto = supabase.table("entradas").select("protocolo").eq("id",eid).single().execute().data["protocolo"]
    _log(eid,"importado",f"Arquivo: {arq.filename}",str(request.current_user.id))
    return jsonify({"ok":True,"id":eid,"protocolo":proto,
                    "nucleo":parsed.get("nucleo",""),"execucao":len(parsed.get("execucao",[]))}),201

@app.post("/api/importar/batch")
@require_auth
def importar_batch():
    arquivos = request.files.getlist("arquivos")
    resultados, erros = [], []
    for arq in arquivos:
        try:
            texto  = arq.read().decode("utf-8",errors="replace")
            parsed = _parse_txt(texto,source=arq.filename)
            if not parsed.get("execucao") and not parsed.get("ocorrencias"):
                erros.append({"arquivo":arq.filename,"erro":"Nenhum dado"}); continue
            eid   = _salvar(parsed,enviado_por=f"batch:{arq.filename}",raw=texto)
            proto = supabase.table("entradas").select("protocolo").eq("id",eid).single().execute().data["protocolo"]
            resultados.append({"arquivo":arq.filename,"id":eid,"protocolo":proto,"nucleo":parsed.get("nucleo","")})
        except Exception as e:
            erros.append({"arquivo":arq.filename,"erro":str(e)})
    return jsonify({"ok":len(erros)==0,"importados":len(resultados),"erros":len(erros),
                    "resultados":resultados,"detalhes_erros":erros}),201 if resultados else 422

# ════════════════════════════════════════════════════════════════
# ENTRY POINT
# ════════════════════════════════════════════════════════════════

if __name__=="__main__":
    port  = int(os.environ.get("PORT",5000))
    debug = os.environ.get("FLASK_DEBUG","0")=="1"
    print(f"Servidor :{port} debug={debug}")
    app.run(host="0.0.0.0",port=port,debug=debug)
