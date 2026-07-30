-- =========================================================================
-- 06_valor_parcela_individual.sql — Valor por parcela individual
--
-- Hoje compras_credito.valor_parcela é ÚNICO pra todas as parcelas da
-- compra — não dá pra reajustar só as parcelas 9 a 12 de uma assinatura
-- de 12x, por exemplo. Segue o MESMO padrão que já existe pra categoria
-- (01b_ajustes_schema.sql moveu categoria_codigo pra dentro de
-- parcelas_credito por causa de um caso real de recategorização parcela
-- a parcela) — agora o valor também vive na parcela, podendo divergir do
-- valor original da compra.
--
-- Rode depois de 01, 01b, 02, 03, 04 e 05.
-- =========================================================================

alter table parcelas_credito add column valor_parcela numeric(12,2);

update parcelas_credito p
set valor_parcela = c.valor_parcela
from compras_credito c
where c.id = p.compra_id;

alter table parcelas_credito alter column valor_parcela set not null;

comment on column parcelas_credito.valor_parcela is 'Valor desta parcela específica. Nasce igual ao valor_parcela da compra, mas pode divergir depois de uma edição (ex: reajuste de assinatura que muda o valor a partir de uma parcela em diante).';
comment on column compras_credito.valor_parcela is 'Valor informado na criação da compra — usado só para gerar as parcelas iniciais. O valor que efetivamente conta pro painel é parcelas_credito.valor_parcela de cada parcela (podem divergir após edição).';

-- -------------------------------------------------------------------------
-- credito_resolvido: passa a usar o valor da PARCELA, não da compra.
-- -------------------------------------------------------------------------
create or replace view credito_resolvido with (security_invoker = true) as
select
    p.id as parcela_id,
    p.compra_id,
    p.numero_parcela,
    p.data_vencimento,
    p.pago,
    c.descricao,
    c.cartao,
    p.categoria_codigo,
    ce.codigo_efetivo,
    ce.nome_efetivo,
    ce.carater_efetivo,
    p.valor_parcela,
    date_trunc('month', p.data_vencimento)::date as mes_referencia,
    (ce.carater_efetivo <> 'EXCLUÍDO') as entra_no_painel,
    (case when ce.carater_efetivo <> 'EXCLUÍDO' then p.valor_parcela else 0 end) as valor_painel
from parcelas_credito p
join compras_credito c on c.id = p.compra_id
join categorias_efetiva ce on ce.codigo = p.categoria_codigo;

comment on view credito_resolvido is 'Parcelas de crédito com categoria efetiva resolvida. Mês de referência = mês do vencimento da parcela. Valor = valor_parcela da PRÓPRIA parcela (pode ter sido editado individualmente).';
