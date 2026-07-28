-- =========================================================================
-- 04_politicas_acesso.sql — RLS: só sanderson4004@gmail.com acessa
--
-- Rode por último, depois de 01, 01b, 02 e 03.
--
-- IMPORTANTE — passo manual fora do SQL, antes ou depois de rodar isto:
-- No painel do Supabase, vá em Authentication > Users > Add user e crie
-- seu usuário (sanderson4004@gmail.com + uma senha) manualmente. Depois,
-- em Authentication > Settings, DESATIVE "Allow new users to sign up"
-- (ou equivalente) — assim ninguém mais consegue criar conta neste
-- projeto, mesmo sabendo a URL pública dele.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Helper: uma função só, fácil de auditar/trocar depois se um dia você
-- precisar mudar o e-mail. Todas as políticas abaixo chamam ela.
-- -------------------------------------------------------------------------
create or replace function is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(auth.jwt() ->> 'email', '') = 'sanderson4004@gmail.com';
$$;

comment on function is_owner is 'true só quando quem está consultando está autenticado como sanderson4004@gmail.com. Toda política de RLS deste projeto usa esta função.';

-- -------------------------------------------------------------------------
-- Garante RLS ligado em todas as tabelas (idempotente — não falha se já
-- estiver ligado, caso você tenha escolhido "Run and enable RLS" no 01).
-- -------------------------------------------------------------------------
alter table categorias enable row level security;
alter table metas enable row level security;
alter table lancamentos_fluxo enable row level security;
alter table compras_credito enable row level security;
alter table parcelas_credito enable row level security;
alter table caixinha_turbo_config enable row level security;
alter table caixinha_turbo_movimentos enable row level security;
alter table investimentos_renda_fixa enable row level security;
alter table investimentos_bolsa enable row level security;
alter table planejamento_futuro enable row level security;

-- -------------------------------------------------------------------------
-- Uma política por tabela: dono pode tudo (SELECT/INSERT/UPDATE/DELETE),
-- ninguém mais (nem "anon", nem outro usuário autenticado) enxerga nada.
-- -------------------------------------------------------------------------
create policy owner_all on categorias for all using (is_owner()) with check (is_owner());
create policy owner_all on metas for all using (is_owner()) with check (is_owner());
create policy owner_all on lancamentos_fluxo for all using (is_owner()) with check (is_owner());
create policy owner_all on compras_credito for all using (is_owner()) with check (is_owner());
create policy owner_all on parcelas_credito for all using (is_owner()) with check (is_owner());
create policy owner_all on caixinha_turbo_config for all using (is_owner()) with check (is_owner());
create policy owner_all on caixinha_turbo_movimentos for all using (is_owner()) with check (is_owner());
create policy owner_all on investimentos_renda_fixa for all using (is_owner()) with check (is_owner());
create policy owner_all on investimentos_bolsa for all using (is_owner()) with check (is_owner());
create policy owner_all on planejamento_futuro for all using (is_owner()) with check (is_owner());

-- -------------------------------------------------------------------------
-- Permissões de schema: "authenticated" pode operar nas tabelas/views/
-- functions (o RLS acima decide linha a linha se ele É o dono ou não);
-- "anon" (não logado) não recebe NADA — sem select, sem exec, nada.
-- -------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update, delete on
    categorias, metas, lancamentos_fluxo, compras_credito, parcelas_credito,
    caixinha_turbo_config, caixinha_turbo_movimentos,
    investimentos_renda_fixa, investimentos_bolsa, planejamento_futuro
to authenticated;

grant select on
    categorias_efetiva, fluxo_resolvido, credito_resolvido,
    caixinha_turbo_extrato, caixinha_turbo_resumo,
    renda_fixa_detalhe, bolsa_detalhe, carteira_consolidada
to authenticated;

grant usage, select on all sequences in schema public to authenticated;

grant execute on function fn_ir_regressivo(int, boolean) to authenticated;
grant execute on function painel_metas_fixas(date) to authenticated;
grant execute on function custos_variaveis(date) to authenticated;

-- is_owner() precisa ser executável pelo role "authenticated": mesmo sendo
-- SECURITY DEFINER (o corpo roda com privilégio do dono da function), o
-- Postgres ainda exige EXECUTE pra o role CHAMAR a function — inclusive
-- quando a chamada vem de dentro de uma política de RLS. Sem isso, toda
-- policy que usa is_owner() quebra com "permission denied for function".
grant execute on function is_owner() to authenticated;
revoke all on function is_owner() from public, anon;
