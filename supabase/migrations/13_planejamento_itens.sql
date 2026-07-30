-- =========================================================================
-- 13_planejamento_itens.sql — Planejamento Futuro reformulado
--
-- Substitui o modelo de "cenários alternativos" (planejamento_futuro) por
-- uma lista de itens COMPLEMENTARES (não escolhas excludentes): cada um com
-- caráter (receita/despesa), recorrência (mensal ou evento único) e,
-- opcionalmente, rendimento composto (só faz sentido pra evento único —
-- ex: valor de venda de imóvel que fica rendendo por N meses).
--
-- A tabela antiga NÃO é apagada — só renomeada, para não perder nada que já
-- foi cadastrado nela. A simulação (soma mês a mês) é feita no frontend, a
-- mesma decisão de design da tabela anterior.
-- =========================================================================

alter table planejamento_futuro rename to planejamento_futuro_legado;

comment on table planejamento_futuro_legado is 'Tabela da versão anterior de Planejamento Futuro (cenários A/B, Uso do Saldo Acumulado etc.), substituída por planejamento_itens. Mantida só como backup/histórico — a tela não usa mais esta tabela.';

create type carater_planejamento as enum ('RECEITA', 'DESPESA');
create type recorrencia_planejamento as enum ('MENSAL', 'UNICO');

create table planejamento_itens (
    id                      bigint generated always as identity primary key,
    nome                    text not null,
    carater                 carater_planejamento not null,
    recorrencia             recorrencia_planejamento not null,
    valor                   numeric(14,2) not null check (valor > 0),
    data_inicio             date not null,
    data_fim                date,
    taxa_rendimento_anual   numeric(6,4),
    meses_rendendo          int check (meses_rendendo is null or meses_rendendo > 0),
    observacao              text,
    criado_em               timestamptz not null default now(),

    constraint chk_data_fim_so_recorrente check (recorrencia = 'MENSAL' or data_fim is null),
    constraint chk_fim_apos_inicio check (data_fim is null or data_fim >= data_inicio),
    constraint chk_rendimento_so_evento_unico check (recorrencia = 'UNICO' or (taxa_rendimento_anual is null and meses_rendendo is null)),
    constraint chk_rendimento_par check ((taxa_rendimento_anual is null) = (meses_rendendo is null))
);

comment on table planejamento_itens is 'Itens COMPLEMENTARES (não cenários alternativos) de uma projeção de saldo futuro. Um item MENSAL soma/subtrai todo mês entre data_inicio e data_fim (ou indefinidamente, se data_fim for nula). Um item UNICO soma/subtrai uma vez só, na data_inicio; se tiver taxa_rendimento_anual/meses_rendendo preenchidos, o valor cresce por juros compostos mês a mês (taxa_rendimento_anual como multiplicador anual, ex: 1.09 = 9%/ano) até completar meses_rendendo, e depois disso mantém o valor final. O saldo projetado em cada mês é calculado no frontend, somando saldo_inicial (informado manualmente na tela) a todos os itens vigentes até aquele mês.';

comment on column planejamento_itens.taxa_rendimento_anual is 'Multiplicador anual (ex: 1.09 = rende 9% ao ano), aplicado por juros compostos mensal. Só preenchido em itens de recorrência UNICO.';
comment on column planejamento_itens.meses_rendendo is 'Quantidade de meses que o valor continua rendendo após data_inicio, antes de estabilizar no valor final. Só preenchido em itens de recorrência UNICO.';

alter table planejamento_itens enable row level security;
create policy owner_all on planejamento_itens for all using (is_owner()) with check (is_owner());

grant select, insert, update, delete on planejamento_itens to authenticated;
