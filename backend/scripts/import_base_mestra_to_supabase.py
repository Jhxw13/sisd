from __future__ import annotations

import argparse
import csv
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client


def parse_date(value: str) -> str | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def pick(*values: Any) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


def chunked(rows: list[dict[str, Any]], size: int = 200):
    for i in range(0, len(rows), size):
        yield rows[i : i + size]


def frente_keys(row: dict[str, Any]) -> list[str]:
    frente_id = pick(row.get("id_frente"))
    data_ref = pick(row.get("data_referencia"), row.get("data"))
    nucleo = pick(row.get("nucleo"), row.get("nucleo_oficial"))
    equipe = pick(row.get("equipe"))
    return [
        "|".join([frente_id, data_ref, nucleo, equipe]),
        "|".join([frente_id, data_ref, nucleo]),
        "|".join([frente_id, data_ref]),
        frente_id,
    ]


def require_supabase() -> Client:
    load_dotenv(".env")
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError("SUPABASE_URL/SUPABASE_KEY não encontrados no .env")
    return create_client(url, key)


def truncate_tables(sb: Client) -> None:
    # Ordem importante por conta de FKs.
    sb.table("historico_processamento").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    sb.table("relatorios_gerados").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    sb.table("servicos_nao_mapeados").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    sb.table("observacoes").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    sb.table("ocorrencias").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    sb.table("execucao").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    sb.table("entradas").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    sb.table("nucleos").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()


def seed_nucleos(sb: Client, frentes: list[dict[str, str]]) -> int:
    by_nome: dict[str, dict[str, Any]] = {}
    for row in frentes:
        nome = pick(row.get("nucleo"), row.get("nucleo_oficial"))
        if not nome:
            continue
        key = nome.casefold()
        if key in by_nome:
            continue
        municipio = pick(row.get("municipio"), row.get("municipio_oficial"), row.get("municipio_detectado_texto"))
        by_nome[key] = {
            "nome": nome,
            "municipio": municipio,
            "status": "ativo",
            "logradouros": [],
            "equipes": [],
            "aliases": [],
        }
    rows = list(by_nome.values())
    for batch in chunked(rows):
        sb.table("nucleos").insert(batch).execute()
    return len(rows)


def import_data(sb: Client, base_dir: Path, dry_run: bool = False) -> dict[str, int]:
    frentes = read_csv_rows(base_dir / "base_mestra_frentes.csv")
    execucao = read_csv_rows(base_dir / "base_mestra_execucao.csv")
    ocorrencias = read_csv_rows(base_dir / "base_mestra_ocorrencias.csv")

    if dry_run:
        return {
            "frentes_csv": len(frentes),
            "execucao_csv": len(execucao),
            "ocorrencias_csv": len(ocorrencias),
            "entradas_inserted": 0,
            "execucao_inserted": 0,
            "ocorrencias_inserted": 0,
            "observacoes_inserted": 0,
        }

    seed_nucleos(sb, frentes)

    entrada_by_key: dict[str, str] = {}
    observacoes_rows: list[dict[str, Any]] = []

    for idx, row in enumerate(frentes, start=1):
        frente_id = pick(row.get("id_frente"), f"F{idx:04d}")
        data_ref = parse_date(pick(row.get("data_referencia"), row.get("data")))
        payload = {
            "data_referencia": data_ref,
            "nucleo": pick(row.get("nucleo"), row.get("nucleo_oficial")),
            "logradouro": pick(row.get("logradouro")),
            "municipio": pick(row.get("municipio"), row.get("municipio_oficial"), row.get("municipio_detectado_texto")),
            "equipe": pick(row.get("equipe")),
            "enviado_por": "import_base_mestra",
            "status": "concluido",
            "raw_text": f"Importado da BASE_MESTRA | frente={frente_id} | arquivo={pick(row.get('arquivo_origem'))}",
        }
        res = sb.table("entradas").insert(payload).execute()
        entrada_id = res.data[0]["id"]
        for key in frente_keys(row):
            if key and key not in entrada_by_key:
                entrada_by_key[key] = entrada_id

        obs = pick(row.get("observacao_frente"))
        if obs:
            observacoes_rows.append(
                {
                    "entrada_id": entrada_id,
                    "texto": obs,
                    "equipe": payload["equipe"],
                    "nucleo": payload["nucleo"],
                }
            )

    exec_rows: list[dict[str, Any]] = []
    for row in execucao:
        entrada_id = next((entrada_by_key.get(k) for k in frente_keys(row) if entrada_by_key.get(k)), None)
        if not entrada_id:
            continue
        quantidade = pick(row.get("quantidade"))
        exec_rows.append(
            {
                "entrada_id": entrada_id,
                "servico": pick(row.get("servico_oficial"), row.get("item_normalizado"), row.get("item_original")),
                "quantidade": float(quantidade.replace(",", ".")) if quantidade else None,
                "unidade": pick(row.get("unidade"), "un"),
                "equipe": pick(row.get("equipe")),
                "nucleo": pick(row.get("nucleo"), row.get("nucleo_oficial")),
            }
        )

    ocorr_rows: list[dict[str, Any]] = []
    for row in ocorrencias:
        entrada_id = next((entrada_by_key.get(k) for k in frente_keys(row) if entrada_by_key.get(k)), None)
        if not entrada_id:
            continue
        ocorr_rows.append(
            {
                "entrada_id": entrada_id,
                "descricao": pick(row.get("descricao"), row.get("tipo_ocorrencia")),
                "equipe": pick(row.get("equipe")),
                "nucleo": pick(row.get("nucleo"), row.get("nucleo_oficial")),
            }
        )

    for batch in chunked(exec_rows):
        sb.table("execucao").insert(batch).execute()
    for batch in chunked(ocorr_rows):
        sb.table("ocorrencias").insert(batch).execute()
    for batch in chunked(observacoes_rows):
        sb.table("observacoes").insert(batch).execute()

    return {
        "frentes_csv": len(frentes),
        "execucao_csv": len(execucao),
        "ocorrencias_csv": len(ocorrencias),
        "entradas_inserted": len(frentes),
        "execucao_inserted": len(exec_rows),
        "ocorrencias_inserted": len(ocorr_rows),
        "observacoes_inserted": len(observacoes_rows),
    }


def main():
    parser = argparse.ArgumentParser(description="Importa BASE_MESTRA para tabelas web no Supabase.")
    parser.add_argument("--base-dir", required=True, help="Pasta com base_mestra_frentes.csv/execucao/ocorrencias")
    parser.add_argument("--dry-run", action="store_true", help="Somente valida leitura e contagem, sem gravar")
    parser.add_argument("--truncate", action="store_true", help="Limpa as tabelas web antes de importar")
    args = parser.parse_args()

    base_dir = Path(args.base_dir)
    if not base_dir.exists():
        raise SystemExit(f"Pasta não encontrada: {base_dir}")

    sb = require_supabase()
    if args.truncate and not args.dry_run:
        truncate_tables(sb)

    result = import_data(sb, base_dir=base_dir, dry_run=args.dry_run)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
