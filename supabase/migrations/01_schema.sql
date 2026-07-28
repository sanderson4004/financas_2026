-- =========================================================================
-- 01_schema.sql — Estrutura de tabelas (Finanças 2026)
--
-- Migração das 11 abas da planilha financeira pessoal para Postgres/Supabase.
-- Este arquivo cria SÓ as tabelas e tipos. Dados, views/functions e
-- políticas de acesso (RLS) ficam nos próximos arquivos, nesta ordem:
--   01_schema.sql            <- este arquivo
--   02_dados.sql              (gerado por script de importação)
--   03_views_functions.sql
--   04_politicas_acesso.sql
--
-- RLS é ligado em TODAS as tabelas aqui mesmo, sem nenhuma política ainda.
-- Isso significa que, assim que esta migration rodar, ninguém (nem você,
-- nem chave anon, nem chave authenticated) consegue ler ou escrever nada
-- até o arquivo 04 criar as políticas explícitas. É proposital: o banco
-- nasce fechado por padrão.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Tipos enumerados (vocabulário fixo da planilha)
-- -------------------------------------------------------------------------
create type carater_categoria as enum ('RECEITA', 'DESPESA', 'RESERVA', 'EXCLUÍDO');
create type status_categoria as enum ('ATIVA', 'MESCLADA');
create type tipo_teto_meta as enum ('MENSAL', 'ANUAL', 'OUTRO_DELIMITADO');
create type carater_lancamento as enum ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA');
create type tipo_movimento_caixinha as enum ('Aplicação', 'Resgate');

-- -------------------------------------------------------------------------
-- 1. CATEGORIAS — cadastro central (aba "Categorias")
-- -------------------------------------------------------------------------
create table categorias (
    codigo              text primary key,
    nome                text not null unique,
    carater             carater_categoria not null,
    status              status_categoria not null default 'ATIVA',
    merged_into_codigo  text references categorias(codigo),
    criado_em           timestamptz not null default now(),

    constraint chk_mesclada_tem_destino
        check (
            (status = 'ATIVA' and merged_into_codigo is null)
            or (status = 'MESCLADA' and merged_into_codigo is not null)
        ),
    constraint chk_nao_mescla_em_si_mesma
        check (merged_into_codigo is distinct from codigo)
);

comment on table categorias is 'Fonte única de verdade das categorias. Categorias MESCLADA apontam para a categoria efetiva via merged_into_codigo (pode encadear).';

-- -------------------------------------------------------------------------
-- 2. METAS — vigências de meta por categoria (aba "Planejamento Vigente")
-- -------------------------------------------------------------------------
create table metas (
    id                  bigint generated always as identity primary key,
    categoria_codigo    text not null references categorias(codigo),
    vigencia_inicio     date not null,
    vigencia_fim        date,
    valor_teto          numeric(12,2),
    tipo_teto           tipo_teto_meta not null default 'MENSAL',
    fonte_dados         text,
    observacao          text,
    criado_em           timestamptz not null default now(),

    constraint chk_vigencia_valida
        check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);

create index idx_metas_categoria_vigencia on metas (categoria_codigo, vigencia_inicio, vigencia_fim);

comment on table metas is 'Uma linha por período de vigência de meta. Categoria pode ter várias linhas ao longo do tempo (histórico de mudança de meta).';
comment on column metas.valor_teto is 'Nulo para a meta de Reserva (#C), cujo valor é calculado dinamicamente por view — ver 03_views_functions.sql.';

-- -------------------------------------------------------------------------
-- 3. LANÇAMENTOS FLUXO (aba "Fluxo": Pix, dinheiro, débito, transferências)
-- -------------------------------------------------------------------------
create table lancamentos_fluxo (
    id                  bigint generated always as identity primary key,
    carater             carater_lancamento not null,
    valor               numeric(12,2) not null,
    data_movimento      date not null,
    data_pagamento      date,
    metodo              text not null,
    categoria_codigo    text not null references categorias(codigo),
    descricao           text,
    criado_em           timestamptz not null default now()
);

create index idx_fluxo_categoria on lancamentos_fluxo (categoria_codigo);
create index idx_fluxo_data_movimento on lancamentos_fluxo (data_movimento);
create index idx_fluxo_data_pagamento on lancamentos_fluxo (data_pagamento);

comment on table lancamentos_fluxo is 'Todo lançamento fora do cartão de crédito. Mês de referência, se entra no painel e valor considerado são calculados em view (fluxo_resolvido), não gravados aqui.';
comment on column lancamentos_fluxo.metodo is 'Se começar com "CC" foi lançado por engano (deveria estar em Crédito) — a view fluxo_resolvido exclui essas linhas do painel de metas.';

-- -------------------------------------------------------------------------
-- 4. CRÉDITO — compras + parcelas (aba "Crédito")
-- -------------------------------------------------------------------------
create table compras_credito (
    id                  bigint generated always as identity primary key,
    descricao           text not null,
    cartao              text not null,
    categoria_codigo    text not null references categorias(codigo),
    data_compra         date,
    historico_sem_data  boolean not null default false,
    total_parcelas      int not null check (total_parcelas > 0),
    valor_parcela       numeric(12,2) not null,
    criado_em           timestamptz not null default now(),

    constraint chk_data_compra_obrigatoria_para_novas
        check (historico_sem_data = true or data_compra is not null)
);

create table parcelas_credito (
    id                  bigint generated always as identity primary key,
    compra_id           bigint not null references compras_credito(id) on delete cascade,
    numero_parcela      int not null check (numero_parcela > 0),
    data_vencimento     date not null,
    pago                boolean not null default false,
    criado_em           timestamptz not null default now(),

    constraint uq_parcela_por_compra unique (compra_id, numero_parcela)
);

create index idx_parcelas_compra on parcelas_credito (compra_id);
create index idx_parcelas_vencimento on parcelas_credito (data_vencimento);
create index idx_compras_categoria on compras_credito (categoria_codigo);

comment on table compras_credito is 'A compra original no cartão. valor_total = total_parcelas * valor_parcela (calculado em view).';
comment on column compras_credito.historico_sem_data is 'Marca compras migradas da planilha antiga, cuja DATA COMPRA era só um traço "-". Novas compras são obrigadas a ter data_compra preenchida (ver constraint chk_data_compra_obrigatoria_para_novas).';
comment on table parcelas_credito is 'Uma linha por parcela. Mês de referência = mês de data_vencimento. Regra de entra-no-painel replicada em view (credito_resolvido).';

-- -------------------------------------------------------------------------
-- 5. CAIXINHA TURBO — extrato do RDB (aba "Caixinha Turbo")
-- -------------------------------------------------------------------------
create table caixinha_turbo_config (
    id                  int primary key default 1,
    saldo_inicial       numeric(12,2) not null default 0,
    total_liquido_app   numeric(12,2),
    atualizado_em       timestamptz not null default now(),

    constraint chk_singleton check (id = 1)
);

create table caixinha_turbo_movimentos (
    id                  bigint generated always as identity primary key,
    data                date not null,
    tipo_movimento      tipo_movimento_caixinha not null,
    origem_motivo       text not null,
    valor               numeric(12,2) not null check (valor > 0),
    criado_em           timestamptz not null default now()
);

create index idx_caixinha_data on caixinha_turbo_movimentos (data, id);

comment on table caixinha_turbo_movimentos is 'Ledger completo. Saldo acumulado é calculado em view com window function (SUM() OVER), nunca gravado.';
comment on table caixinha_turbo_config is 'Tabela singleton (1 linha) para saldo inicial (ajuste manual) e total líquido informado pelo app — igual à planilha, sem IR estimado por fórmula.';

-- -------------------------------------------------------------------------
-- 6. RENDA FIXA (aba "Renda Fixa")
-- -------------------------------------------------------------------------
create table investimentos_renda_fixa (
    id                  bigint generated always as identity primary key,
    instituicao         text not null,
    tipo_ativo          text not null,
    indexador           text,
    isento_ir           boolean not null default false,
    data_aplicacao      date not null,
    data_vencimento     date not null,
    valor_aplicado      numeric(12,2) not null,
    valor_bruto_atual   numeric(12,2) not null,
    criado_em           timestamptz not null default now(),
    atualizado_em       timestamptz not null default now()
);

comment on table investimentos_renda_fixa is 'Uma linha por aplicação. Valorização, dias até vencimento, alíquota de IR estimada, imposto estimado, valor líquido e % da carteira: tudo em view usando fn_ir_regressivo().';

-- -------------------------------------------------------------------------
-- 7. BOLSA DE VALORES (aba "Bolsa de Valores")
-- -------------------------------------------------------------------------
create table investimentos_bolsa (
    id                  bigint generated always as identity primary key,
    ticker              text not null unique,
    nome_ativo          text not null,
    tipo                text not null,
    quantidade          numeric(14,6) not null,
    preco_medio         numeric(12,4) not null,
    cotacao_atual       numeric(12,4) not null,
    proventos_recebidos numeric(12,2) not null default 0,
    criado_em           timestamptz not null default now(),
    atualizado_em       timestamptz not null default now()
);

comment on table investimentos_bolsa is 'Uma linha por ticker. Valor aplicado, valor de mercado, valorização e rentabilidade: tudo em view.';

-- -------------------------------------------------------------------------
-- 8. PLANEJAMENTO FUTURO — cenários/simulações (aba "Planejamento Futuro")
-- -------------------------------------------------------------------------
create table planejamento_futuro (
    id                  bigint generated always as identity primary key,
    cenario             text not null,
    descricao           text,
    valor               numeric(12,2) not null,
    meses               int not null check (meses > 0),
    rendimento_anual    numeric(6,4) not null,
    tipo_calculo        text not null check (tipo_calculo in ('Aporte Mensal Recorrente', 'Valor Único')),
    criado_em           timestamptz not null default now()
);

comment on table planejamento_futuro is 'Rascunho/simulação — não é dado histórico real. O cálculo de juros compostos é feito no front-end (JS), não em SQL, por decisão do usuário.';