alter table public.entradas
  add column if not exists cep text;

create index if not exists idx_entradas_cep on public.entradas(cep);

