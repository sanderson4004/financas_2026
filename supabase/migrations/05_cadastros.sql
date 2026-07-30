-- =========================================================================
-- 05_cadastros.sql — Cadastros dinâmicos: métodos de pagamento e cartões
--
-- Hoje "Método" (Fluxo) e "Cartão" (Crédito) são texto livre nas colunas
-- lancamentos_fluxo.metodo e compras_credito.cartao (sem tabela, sem
-- constraint) — a única coisa que limitava as opções eram os <option>
-- fixos no HTML. Isso impedia cadastrar um cartão/método novo sem editar
-- código. Este arquivo cria duas tabelas de cadastro (mesmo espírito da
-- tabela categorias) só para alimentar os <select> dinamicamente. As
-- colunas metodo/cartao continuam texto livre — nenhuma constraint nova
-- nelas, nenhum dado histórico é tocado.
--
-- Rode depois de 01, 01b, 02, 03 e 04 (usa is_owner(), criada em 04).
-- =========================================================================

create type status_cadastro as enum ('ATIVA', 'INATIVA');

-- -------------------------------------------------------------------------
-- Métodos de pagamento (aba "Fluxo")
-- -------------------------------------------------------------------------
create table metodos_pagamento (
    nome        text primary key,
    status      status_cadastro not null default 'ATIVA',
    criado_em   timestamptz not null default now()
);

comment on table metodos_pagamento is 'Cadastro dos métodos que alimentam o <select> de Método em Fluxo. Desativar (não apagar) preserva o texto já gravado em lancamentos_fluxo.metodo.';

insert into metodos_pagamento (nome) values
    ('Pix'),
    ('Dinheiro'),
    ('CC – Nubank'),
    ('CC - Itaú'),
    ('CC - VISA MP');

-- -------------------------------------------------------------------------
-- Cartões (aba "Crédito")
-- -------------------------------------------------------------------------
create table cartoes (
    nome        text primary key,
    status      status_cadastro not null default 'ATIVA',
    criado_em   timestamptz not null default now()
);

comment on table cartoes is 'Cadastro dos cartões/linhas que alimentam o <select> de Cartão em Crédito. Desativar (não apagar) preserva o texto já gravado em compras_credito.cartao.';

insert into cartoes (nome) values
    ('CC – Nubank'),
    ('CC - Itaú'),
    ('CC - VISA MP'),
    ('Linha de Crédito - MP Empréstimo'),
    ('Pix');

-- -------------------------------------------------------------------------
-- RLS: mesmo padrão de 04_politicas_acesso.sql (só o dono acessa)
-- -------------------------------------------------------------------------
alter table metodos_pagamento enable row level security;
alter table cartoes enable row level security;

create policy owner_all on metodos_pagamento for all using (is_owner()) with check (is_owner());
create policy owner_all on cartoes for all using (is_owner()) with check (is_owner());

grant select, insert, update, delete on metodos_pagamento, cartoes to authenticated;
