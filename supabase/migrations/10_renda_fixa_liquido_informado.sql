-- =========================================================================
-- 10_renda_fixa_liquido_informado.sql — Valor líquido informado pelo banco
--
-- valor_liquido_estimado já existe (calculado via fn_ir_regressivo, uma
-- estimativa). Agora também é possível informar o valor líquido real que o
-- banco mostra — mesma ideia do bruto/líquido informado da Caixinha Turbo.
--
-- A view passa a listar as colunas explicitamente (em vez de rf.*) porque
-- CREATE OR REPLACE VIEW não aceita inserir uma coluna no meio da lista —
-- só no final.
-- =========================================================================

alter table investimentos_renda_fixa add column valor_liquido_informado numeric(12,2);

comment on column investimentos_renda_fixa.valor_liquido_informado is 'Valor líquido informado pelo banco/app (valor real, não estimado). Comparável com valor_liquido_estimado (calculado por fn_ir_regressivo) para ver o quão precisa é a estimativa.';

create or replace view renda_fixa_detalhe with (security_invoker = true) as
select
    rf.id,
    rf.instituicao,
    rf.tipo_ativo,
    rf.indexador,
    rf.isento_ir,
    rf.data_aplicacao,
    rf.data_vencimento,
    rf.valor_aplicado,
    rf.valor_bruto_atual,
    rf.criado_em,
    rf.atualizado_em,
    (rf.valor_bruto_atual - rf.valor_aplicado) as valorizacao_reais,
    (case when rf.valor_aplicado = 0 then 0 else (rf.valor_bruto_atual - rf.valor_aplicado) / rf.valor_aplicado end) as valorizacao_percentual,
    (rf.data_vencimento - current_date) as dias_ate_vencimento,
    fn_ir_regressivo((current_date - rf.data_aplicacao)::int, rf.isento_ir) as aliquota_ir_estimada,
    (greatest(rf.valor_bruto_atual - rf.valor_aplicado, 0) * fn_ir_regressivo((current_date - rf.data_aplicacao)::int, rf.isento_ir)) as imposto_estimado,
    (rf.valor_bruto_atual - (greatest(rf.valor_bruto_atual - rf.valor_aplicado, 0) * fn_ir_regressivo((current_date - rf.data_aplicacao)::int, rf.isento_ir))) as valor_liquido_estimado,
    (rf.valor_bruto_atual / nullif(sum(rf.valor_bruto_atual) over (), 0)) as percentual_carteira,
    rf.valor_liquido_informado
from investimentos_renda_fixa rf;

comment on view renda_fixa_detalhe is 'Equivalente às colunas calculadas da aba "Renda Fixa" (J em diante), usando fn_ir_regressivo(). valor_liquido_informado (quando preenchido) é o valor real do banco, mais confiável que valor_liquido_estimado.';
