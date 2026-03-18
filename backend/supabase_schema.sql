create extension if not exists "pgcrypto";

create table if not exists public.entradas (
  id uuid primary key default gen_random_uuid(),
  protocolo text not null default (
    'PRT-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substring(md5(random()::text), 1, 6)
  ),
  data_referencia date,
  nucleo text not null default '',
  logradouro text not null default '',
  municipio text not null default '',
  equipe text not null default '',
  enviado_por text not null default '',
  status text not null default 'pendente',
  raw_text text not null default '',
  revisado_por text,
  revisado_em timestamptz,
  processado_em timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.execucao (
  id uuid primary key default gen_random_uuid(),
  entrada_id uuid not null references public.entradas(id) on delete cascade,
  servico text not null,
  quantidade numeric,
  unidade text not null default 'un',
  equipe text not null default '',
  nucleo text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.ocorrencias (
  id uuid primary key default gen_random_uuid(),
  entrada_id uuid not null references public.entradas(id) on delete cascade,
  descricao text not null default '',
  equipe text not null default '',
  nucleo text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.observacoes (
  id uuid primary key default gen_random_uuid(),
  entrada_id uuid not null references public.entradas(id) on delete cascade,
  texto text not null default '',
  equipe text not null default '',
  nucleo text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.servicos_nao_mapeados (
  id uuid primary key default gen_random_uuid(),
  entrada_id uuid not null references public.entradas(id) on delete cascade,
  texto_bruto text not null default '',
  nucleo text not null default '',
  data_ref date,
  resolvido boolean not null default false,
  mapeado_para text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.relatorios_gerados (
  id uuid primary key default gen_random_uuid(),
  entrada_id uuid not null references public.entradas(id) on delete cascade,
  nucleo text not null default '',
  url_pdf text,
  url_docx text,
  url_md text,
  url_xlsx text,
  created_at timestamptz not null default now()
);

create table if not exists public.fotos_relatorio (
  id uuid primary key default gen_random_uuid(),
  entrada_id uuid not null references public.entradas(id) on delete cascade,
  nome_arquivo text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.historico_processamento (
  id uuid primary key default gen_random_uuid(),
  entrada_id uuid not null references public.entradas(id) on delete cascade,
  usuario_id uuid,
  evento text not null default '',
  detalhe text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.nucleos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  municipio text not null default '',
  status text not null default 'ativo',
  logradouros jsonb not null default '[]'::jsonb,
  equipes jsonb not null default '[]'::jsonb,
  aliases jsonb not null default '[]'::jsonb,
  observacoes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_entradas_created_at on public.entradas(created_at desc);
create index if not exists idx_entradas_status on public.entradas(status);
create index if not exists idx_entradas_nucleo on public.entradas(nucleo);
create index if not exists idx_execucao_entrada_id on public.execucao(entrada_id);
create index if not exists idx_ocorrencias_entrada_id on public.ocorrencias(entrada_id);
create index if not exists idx_observacoes_entrada_id on public.observacoes(entrada_id);
create index if not exists idx_relatorios_entrada_id on public.relatorios_gerados(entrada_id);
create index if not exists idx_fotos_entrada_id on public.fotos_relatorio(entrada_id);
create index if not exists idx_historico_entrada_id on public.historico_processamento(entrada_id);
create index if not exists idx_snm_resolvido on public.servicos_nao_mapeados(resolvido);

alter table public.entradas enable row level security;
alter table public.execucao enable row level security;
alter table public.ocorrencias enable row level security;
alter table public.observacoes enable row level security;
alter table public.servicos_nao_mapeados enable row level security;
alter table public.relatorios_gerados enable row level security;
alter table public.fotos_relatorio enable row level security;
alter table public.historico_processamento enable row level security;
alter table public.nucleos enable row level security;
