-- =========================================================================
-- 07_custos_variaveis_detalhe.sql — Detalhe (drill-down) de Custos Variáveis
--
-- custos_variaveis() só devolve o total (REALIZADO) por categoria. Esta
-- function replica exatamente a mesma janela de acúmulo (MES_FOCO/ANO_FOCO/
-- DESDE_VIGENCIA) só que devolvendo cada lançamento individual (Fluxo ou
-- Crédito) que compõe aquele total, para a tela poder "destrinchar" o
-- REALIZADO ao clicar numa categoria.
--
-- Não cria nem altera tabela nenhuma — só leitura, em cima do que já existe.
-- Rode depois de 01 a 06.
-- =========================================================================

create or replace function custos_variaveis_detalhe(p_categoria_codigo text, mes_foco date)
returns table (
    fonte text,
    data date,
    valor numeric,
    descricao text,
    metodo_ou_cartao text
)
language sql
stable
as $$
    with parametros as (
        select date_trunc('month', mes_foco)::date as v_mes
    ),
    meta as (
        select m.janela_acumulo, date_trunc('month', m.vigencia_inicio)::date as inicio_vigencia
        from metas m
        cross join parametros p
        where m.categoria_codigo = p_categoria_codigo
          and m.tipo_teto in ('ANUAL', 'OUTRO_DELIMITADO')
          and date_trunc('month', m.vigencia_inicio) <= p.v_mes
          and (m.vigencia_fim is null or date_trunc('month', m.vigencia_fim) >= p.v_mes)
        limit 1
    ),
    movimentos as (
        select
            'Fluxo'::text as fonte,
            coalesce(f.data_pagamento, f.data_movimento) as data,
            abs(f.valor) as valor,
            f.descricao,
            f.metodo as metodo_ou_cartao,
            f.mes_referencia_data as mes_ref
        from fluxo_resolvido f
        where f.codigo_efetivo = p_categoria_codigo
          and f.carater <> 'TRANSFERÊNCIA'
        union all
        select
            'Crédito'::text,
            c.data_vencimento,
            c.valor_parcela,
            c.descricao,
            c.cartao,
            c.mes_referencia
        from credito_resolvido c
        where c.codigo_efetivo = p_categoria_codigo
    )
    select mv.fonte, mv.data, mv.valor, mv.descricao, mv.metodo_ou_cartao
    from movimentos mv
    cross join parametros p
    cross join meta mt
    where
        (mt.janela_acumulo = 'ANO_FOCO' and date_trunc('year', mv.mes_ref) = date_trunc('year', p.v_mes))
        or (mt.janela_acumulo = 'DESDE_VIGENCIA' and mv.mes_ref >= mt.inicio_vigencia and mv.mes_ref <= p.v_mes)
        or (mt.janela_acumulo = 'MES_FOCO' and date_trunc('month', mv.mes_ref) = p.v_mes)
        or (mt.janela_acumulo is null and date_trunc('month', mv.mes_ref) = p.v_mes)
    order by mv.data desc;
$$;

comment on function custos_variaveis_detalhe is 'Mesma janela de acúmulo de custos_variaveis(), mas linha a linha (Fluxo + Crédito), para drill-down na tela de Custos Variáveis.';

grant execute on function custos_variaveis_detalhe(text, date) to authenticated;
