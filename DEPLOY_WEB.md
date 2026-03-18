# Deploy Web Completo (Supabase + Railway + Vercel)

Este guia publica o sistema em producao mantendo o fluxo legado no backend e a interface moderna no frontend.

## 1) Supabase (banco + auth + storage)

1. Crie um projeto no Supabase.
2. Em `SQL Editor`, execute o arquivo [`backend/supabase_schema.sql`](/C:/Users/Vyn/Downloads/projeto-sabesp-completo%20(1)/projeto-final/backend/supabase_schema.sql).
3. Em `Storage`, crie o bucket `relatorios` (publico).
4. Em `Authentication > Users`, crie pelo menos um usuario para login.
5. Copie:
   - `Project URL` (Settings > API)
   - `anon public key`
   - `service_role key` (somente backend)

## 2) Backend no Railway

### Projeto
1. Crie um novo projeto no Railway apontando para este repo.
2. Defina `Root Directory` como `backend`.
3. Build com Dockerfile (ja configurado).

### Variaveis de ambiente (Railway)
- `SUPABASE_URL=https://SEU-PROJETO.supabase.co`
- `SUPABASE_KEY=SEU_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET=relatorios`
- `SECRET_KEY=uma-string-forte-e-aleatoria`
- `ALLOWED_ORIGINS=https://SEU-FRONT.vercel.app,http://localhost:5173`
- `FLASK_DEBUG=0`
- `PORT` (Railway injeta automaticamente; nao precisa fixar)

### Healthcheck
- Ja existe endpoint `/health` e `railway.json` configurado.

## 3) Frontend no Vercel

### Projeto
1. Crie projeto no Vercel apontando para este repo.
2. Defina `Root Directory` como `frontend`.
3. Framework: `Vite`.
4. Build command: `npm run build`
5. Output directory: `dist`

### Variaveis de ambiente (Vercel)
- `VITE_API_URL=https://SEU-BACKEND.up.railway.app`
- `VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co`
- `VITE_SUPABASE_ANON_KEY=SEU_ANON_KEY`

### SPA routing
- [`frontend/vercel.json`](/C:/Users/Vyn/Downloads/projeto-sabesp-completo%20(1)/projeto-final/frontend/vercel.json) ja foi adicionado para fallback de rotas React.

## 4) Ordem recomendada de publicacao

1. Suba e valide o backend no Railway (`/health` precisa responder 200).
2. Configure o `VITE_API_URL` no Vercel com a URL do backend.
3. Publique o frontend no Vercel.
4. Ajuste `ALLOWED_ORIGINS` no Railway com o dominio final do Vercel.

## 5) Checklist de validacao final

1. Login funciona com usuario do Supabase.
2. Criar entrada manual retorna sucesso.
3. Listagem de entradas autenticada funciona.
4. Processamento gera registros em `relatorios_gerados`.
5. Arquivos aparecem no bucket `relatorios`.
6. Frontend em producao navega sem 404 em refresh de rotas.

## 6) Notas importantes

- O frontend estava com conflito de peer dependency (`lovable-tagger` x `vite@8`). O pacote foi removido para estabilizar build em CI/CD.
- O parser `input_layer.py` foi alinhado para preservar o comportamento legado no backend atual.
