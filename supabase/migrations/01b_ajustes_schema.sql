-- =========================================================================
-- 01b_ajustes_schema.sql — Ajustes no schema antes de importar os dados
--
-- Rode isto logo depois de 01_schema.sql e antes de 02_dados.sql.
-- Nenhuma tabela tem dados ainda neste ponto, então são alterações seguras.
-- =========================================================================

-- -------------------------------------------------------------------------
-- metas: nem toda categoria tem um "tipo de teto" numérico de verdade.
-- Categorias EXCLUÍDAS (não são meta real) e a Reserva (#C, calculada
-- dinamicamente por view) precisam poder gravar tipo_teto/valor_teto nulos.
-- -------------------------------------------------------------------------
alter table metas alter column tipo_teto drop not null;
alter table metas alter column tipo_teto drop default;

-- -------------------------------------------------------------------------
-- lancamentos_fluxo: existe 1 lançamento histórico real ("Abatimento
-- fatura") em que DATA MOVIMENTO nunca foi preenchida (só tem "N/A" na
-- planilha) e só a DATA PGTO existe. Isso é coerente com a própria regra de
-- mês de referência (que já prioriza data_pagamento) — então data_movimento
-- precisa poder ser nula nesse caso raro, em vez de eu inventar uma data.
-- -------------------------------------------------------------------------
alter table lancamentos_fluxo alter column data_movimento drop not null;
alter table lancamentos_fluxo add constraint chk_fluxo_tem_alguma_data
    check (data_movimento is not null or data_pagamento is not null);

-- -------------------------------------------------------------------------
-- compras_credito / parcelas_credito: a categoria pode mudar PARCELA A
-- PARCELA dentro da mesma compra (ex: você recategoriza as parcelas futuras
-- de uma compra sem mexer nas que já foram pagas com a categoria antiga —
-- caso real encontrado nos dados: "Presente Livro Maxton Hall..." tem as
-- parcelas 1-2 em "Relacionamento" e as parcelas 3-5 em "Cosméticos e
-- Farmácia"). Categoria não pode viver na compra, tem que viver na parcela.
-- -------------------------------------------------------------------------
alter table parcelas_credito add column categoria_codigo text not null references categorias(codigo);
create index idx_parcelas_categoria on parcelas_credito (categoria_codigo);

alter table compras_credito alter column categoria_codigo drop not null;
comment on column compras_credito.categoria_codigo is 'Categoria da compra no momento em que foi criada — só informativa/histórica. A categoria que REALMENTE conta pro painel de metas é a de cada parcela (parcelas_credito.categoria_codigo), que pode divergir se você recategorizar parcelas futuras.';

-- -------------------------------------------------------------------------
-- planejamento_futuro: a aba real tem 5 blocos de simulação (Cenário A,
-- Cenário B, Participação em Imóvel, Uso do Saldo Acumulado, Distribuição
-- da Rotina Mensal), cada um uma lista de itens com caráter (RECEITA/
-- DESPESA/RESERVA/TOTAL/SALDO) — não é uma tabela plana de "1 cenário = 1
-- valor". Ajustando a tabela para caber isso.
-- -------------------------------------------------------------------------
alter table planejamento_futuro add column carater text;
alter table planejamento_futuro add column item text;
alter table planejamento_futuro add column resultado_planilha numeric(14,2);

alter table planejamento_futuro alter column meses drop not null;
alter table planejamento_futuro drop constraint if exists planejamento_futuro_meses_check;
alter table planejamento_futuro add constraint planejamento_futuro_meses_check check (meses is null or meses > 0);

alter table planejamento_futuro alter column rendimento_anual drop not null;

alter table planejamento_futuro drop constraint if exists planejamento_futuro_tipo_calculo_check;
alter table planejamento_futuro alter column tipo_calculo drop not null;
alter table planejamento_futuro add constraint planejamento_futuro_tipo_calculo_check
    check (tipo_calculo is null or tipo_calculo in ('Aporte Mensal Recorrente', 'Valor Único'));

alter table planejamento_futuro alter column item set not null;

comment on column planejamento_futuro.cenario is 'Nome do bloco/grupo de simulação (ex: "CENÁRIO A — ...", "USO DO SALDO ACUMULADO").';
comment on column planejamento_futuro.carater is 'RECEITA, DESPESA, RESERVA, TOTAL ou SALDO — o papel dessa linha dentro do bloco.';
comment on column planejamento_futuro.item is 'Rótulo da linha (ex: "Dízimo", "Reserva de emergência").';
comment on column planejamento_futuro.resultado_planilha is 'Resultado calculado que existia na planilha original (fórmula de juros compostos), guardado como referência histórica. O app recalcula no front-end, não depende deste valor.';
