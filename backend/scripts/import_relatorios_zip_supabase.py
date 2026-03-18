from __future__ import annotations

import argparse
import json
import os
import re
import unicodedata
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client


def normalize_key(text: str) -> str:
    raw = unicodedata.normalize("NFKD", str(text or ""))
    raw = "".join(ch for ch in raw if not unicodedata.combining(ch))
    raw = raw.lower()
    raw = re.sub(r"[^a-z0-9]+", "_", raw).strip("_")
    return raw


def require_supabase() -> tuple[Client, str]:
    load_dotenv(".env")
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_KEY", "").strip()
    bucket = os.getenv("SUPABASE_BUCKET", "relatorios").strip()
    if not url or not key:
        raise RuntimeError("SUPABASE_URL/SUPABASE_KEY não encontrados no .env")
    return create_client(url, key), bucket


def upload_bytes(sb: Client, bucket: str, storage_path: str, content: bytes, ext: str) -> str | None:
    ext = ext.lower()
    mime = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".md": "text/markdown",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }.get(ext, "application/octet-stream")
    try:
        sb.storage.from_(bucket).upload(storage_path, content, {"content-type": mime, "upsert": "true"})
        return sb.storage.from_(bucket).get_public_url(storage_path)
    except Exception as e:
        print(f"[upload] {storage_path}: {e}")
        return None


def latest_entradas_by_nucleo(sb: Client) -> dict[str, dict[str, Any]]:
    rows = sb.table("entradas").select("id,nucleo,data_referencia,created_at").order("created_at", desc=True).limit(1000).execute().data or []
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        key = normalize_key(row.get("nucleo", ""))
        if key and key not in out:
            out[key] = row
    return out


def ensure_entrada(sb: Client, by_nucleo: dict[str, dict[str, Any]], nucleo: str) -> str:
    key = normalize_key(nucleo)
    if key in by_nucleo:
        return by_nucleo[key]["id"]
    payload = {
        "data_referencia": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "nucleo": nucleo,
        "logradouro": "",
        "municipio": "",
        "equipe": "",
        "enviado_por": "import_relatorios_zip",
        "status": "concluido",
        "raw_text": "Entrada técnica criada para vincular relatórios históricos importados.",
    }
    res = sb.table("entradas").insert(payload).execute()
    created = res.data[0]
    by_nucleo[key] = created
    return created["id"]


def collect_zip(zip_path: Path) -> dict[str, dict[str, bytes]]:
    grouped: dict[str, dict[str, bytes]] = defaultdict(dict)
    with zipfile.ZipFile(zip_path, "r") as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            name = Path(info.filename).name
            ext = Path(name).suffix.lower()
            if ext not in {".pdf", ".docx", ".md"}:
                continue
            stem = Path(name).stem
            group_key = normalize_key(stem)
            grouped[group_key][ext] = zf.read(info.filename)
    return grouped


def insert_relatorio(sb: Client, entrada_id: str, nucleo: str, urls: dict[str, str | None]) -> None:
    payload = {
        "entrada_id": entrada_id,
        "nucleo": nucleo,
        "url_pdf": urls.get(".pdf"),
        "url_docx": urls.get(".docx"),
        "url_md": urls.get(".md"),
        "url_xlsx": None,
    }
    sb.table("relatorios_gerados").insert(payload).execute()


def main() -> None:
    parser = argparse.ArgumentParser(description="Importa relatorios_nucleos.zip para Storage e relatorios_gerados.")
    parser.add_argument("--zip", required=True, help="Caminho do arquivo relatorios_nucleos.zip")
    parser.add_argument("--prefix", default="historico_relatorios", help="Prefixo no bucket")
    parser.add_argument("--dry-run", action="store_true", help="Somente leitura e preview, sem gravar")
    args = parser.parse_args()

    zip_path = Path(args.zip)
    if not zip_path.exists():
        raise SystemExit(f"Arquivo não encontrado: {zip_path}")

    sb, bucket = require_supabase()
    by_nucleo = latest_entradas_by_nucleo(sb)
    grouped = collect_zip(zip_path)
    if not grouped:
        raise SystemExit("Nenhum arquivo .pdf/.docx/.md encontrado no zip.")

    preview = []
    imported = 0
    for slug, files in grouped.items():
        nucleo = slug.replace("_", " ").title()
        entrada_id = by_nucleo.get(slug, {}).get("id")
        if not entrada_id and not args.dry_run:
            entrada_id = ensure_entrada(sb, by_nucleo, nucleo)
        elif not entrada_id:
            entrada_id = "(would-create)"

        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        urls: dict[str, str | None] = {}
        for ext, content in files.items():
            filename = f"{slug}{ext}"
            storage_path = f"{args.prefix}/{slug}/{ts}_{filename}"
            if args.dry_run:
                urls[ext] = f"dry://{storage_path}"
            else:
                urls[ext] = upload_bytes(sb, bucket, storage_path, content, ext)

        preview.append({"nucleo": nucleo, "entrada_id": entrada_id, "arquivos": sorted(list(files.keys()))})
        if not args.dry_run:
            insert_relatorio(sb, entrada_id, nucleo, urls)
            imported += 1

    print(json.dumps({
        "zip": str(zip_path),
        "bucket": bucket,
        "nucleos_encontrados": len(grouped),
        "importados": imported,
        "preview": preview,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
