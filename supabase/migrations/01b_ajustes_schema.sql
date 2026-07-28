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
