-- =========================================================================
-- 12_patrimonio_historico.sql — Histórico de patrimônio (Carteira Consolidada)
--
-- Um "retrato" (snapshot) por dia dos totais de Renda Fixa, Bolsa, Caixinha
-- Turbo e patrimônio total. O frontend grava (upsert) o retrato do dia
-- corrente toda vez que a tela Carteira Consolidada é aberta — não precisa
-- de cron/trigger no banco. Ao longo do tempo isso forma o histórico que
-- alimenta o gráfico de evolução (semanal/mensal/anual).
-- =========================================================================

create table patrimonio_historico (
    data                    date primary key,
    total_renda_fixa        numeric(14,2) not null,
    total_bolsa             numeric(14,2) not null,
    total_caixinha_turbo    numeric(14,2) not null,
    patrimonio_total        numeric(14,2) not null,
    criado_em               timestamptz not null default now()
);

comment on table patrimonio_historico is 'Um retrato por dia dos totais consolidados de patrimônio. Gravado (upsert por data) pelo frontend a cada vez que a tela Carteira Consolidada carrega — não é um valor histórico "de verdade" registrado no dia, é o snapshot do que existia no banco no dia em que a tela foi aberta.';

alter table patrimonio_historico enable row level security;
create policy owner_all on patrimonio_historico for all using (is_owner()) with check (is_owner());

grant select, insert, update, delete on patrimonio_historico to authenticated;
