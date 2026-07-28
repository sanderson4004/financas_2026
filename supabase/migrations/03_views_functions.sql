-- =========================================================================
-- 03_views_functions.sql — Regras de negócio (views, functions)
--
-- Aqui moram as fórmulas da planilha recriadas como lógica de banco.
-- Nada aqui grava dado novo — só lê e calcula em cima do que já existe.
-- Rode depois de 01_schema.sql, 01b_ajustes_schema.sql e 02_dados.sql.
--
-- Todas as views usam security_invoker = true: elas rodam com a permissão
-- de quem está consultando (respeitando o RLS de 04_politicas_acesso.sql),
-- não com a permissão de quem criou a view.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 0. Ajuste em METAS: a aba Custos Variáveis usa 3 janelas de acúmulo
-- diferentes que não dá pra inferir só do tipo_teto (ex: "Custos Não
-- Identificados" é OUTRO_DELIMITADO mas acumula só no mês em foco, já
-- "Viagem EUA" também é OUTRO_DELIMITADO mas acumula desde o início da
-- vigência). Sem essa coluna eu estaria adivinhando a regra errado pra um
-- dos dois casos.
-- -------------------------------------------------------------------------
alter table metas add column janela_acumulo text
    check (janela_acumulo is null or janela_acumulo in ('MES_FOCO', 'ANO_FOCO', 'DESDE_VIGENCIA'));

update metas set janela_acumulo = 'ANO_FOCO' where tipo_teto = 'ANUAL';
update metas set janela_acumulo = 'DESDE_VIGENCIA' where tipo_teto = 'OUTRO_DELIMITADO';
update metas set janela_acumulo = 'MES_FOCO' where categoria_codigo = '#O' and tipo_teto = 'OUTRO_DELIMITADO';

comment on column metas.janela_acumulo is 'Só usado por custos_variaveis(): MES_FOCO = soma só o mês em foco; ANO_FOCO = soma o ano civil do mês em foco; DESDE_VIGENCIA = soma acumulada desde vigencia_inicio até o mês em foco (tratado como meta de poupança: bater ou ultrapassar é bom).';

-- -------------------------------------------------------------------------
-- 1. CATEGORIAS EFETIVA — resolve a cadeia de mesclagem (qualquer profundidade)
-- -------------------------------------------------------------------------
create view categorias_efetiva with (security_invoker = true) as
with recursive resolve as (
    select codigo as codigo_origem, codigo as codigo_atual, 0 as profundidade
    from categorias
    union all
    select r.codigo_origem, c.merged_into_codigo, r.profundidade + 1
    from resolve r
    join categorias c on c.codigo = r.codigo_atual
    where c.status = 'MESCLADA' and r.profundidade < 20
)
select distinct on (r.codigo_origem)
    r.codigo_origem as codigo,
    ef.codigo as codigo_efetivo,
    ef.nome as nome_efetivo,
    ef.carater as carater_efetivo
from resolve r
join categorias ef on ef.codigo = r.codigo_atual
where ef.status = 'ATIVA'
order by r.codigo_origem, r.profundidade desc;

comment on view categorias_efetiva is 'Para cada categoria (mesclada ou não), a categoria ativa final que deve receber os lançamentos.';

-- -------------------------------------------------------------------------
-- 2. FLUXO RESOLVIDO — replica: TRANSFERÊNCIA, método "CC*", ou categoria
--    efetiva EXCLUÍDA nunca contam como gasto/receita real.
-- -------------------------------------------------------------------------
create view fluxo_resolvido with (security_invoker = true) as
select
    f.id,
    f.carater,
    f.valor,
    f.data_movimento,
    f.data_pagamento,
    f.metodo,
    f.categoria_codigo,
    ce.codigo_efetivo,
    ce.nome_efetivo,
    ce.carater_efetivo,
    f.descricao,
    date_trunc('month', coalesce(f.data_pagamento, f.data_movimento))::date as mes_referencia_data,
    (f.carater <> 'TRANSFERÊNCIA' and left(f.metodo, 2) <> 'CC' and ce.carater_efetivo <> 'EXCLUÍDO') as entra_no_painel,
    (case
        when f.carater = 'TRANSFERÊNCIA' or left(f.metodo, 2) = 'CC' or ce.carater_efetivo = 'EXCLUÍDO' then 0
        else abs(f.valor)
     end) as valor_painel
from lancamentos_fluxo f
join categorias_efetiva ce on ce.codigo = f.categoria_codigo;

comment on view fluxo_resolvido is 'Fluxo com categoria efetiva resolvida e a regra de entra-no-painel/valor-considerado já calculada.';

-- -------------------------------------------------------------------------
-- 3. CRÉDITO RESOLVIDO — mesma ideia, sem o caso de TRANSFERÊNCIA (não existe
--    esse caráter em Crédito) nem de método errado (aqui É o cartão).
-- -------------------------------------------------------------------------
create view credito_resolvido with (security_invoker = true) as
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
    c.valor_parcela,
    date_trunc('month', p.data_vencimento)::date as mes_referencia,
    (ce.carater_efetivo <> 'EXCLUÍDO') as entra_no_painel,
    (case when ce.carater_efetivo <> 'EXCLUÍDO' then c.valor_parcela else 0 end) as valor_painel
from parcelas_credito p
join compras_credito c on c.id = p.compra_id
join categorias_efetiva ce on ce.codigo = p.categoria_codigo;

comment on view credito_resolvido is 'Parcelas de crédito com categoria efetiva resolvida. Mês de referência = mês do vencimento da parcela.';

-- -------------------------------------------------------------------------
-- 4. FN_IR_REGRESSIVO — tabela regressiva de IR (renda fixa brasileira)
-- -------------------------------------------------------------------------
create or replace function fn_ir_regressivo(dias_aplicacao int, isento boolean)
returns numeric
language sql
immutable
as $$
    select case
        when isento then 0
        when dias_aplicacao <= 180 then 0.225
        when dias_aplicacao <= 360 then 0.20
        when dias_aplicacao <= 720 then 0.175
        else 0.15
    end;
$$;

comment on function fn_ir_regressivo is 'IR regressivo de renda fixa: 22,5% até 180 dias, 20% até 360, 17,5% até 720, 15% acima, 0% se isento.';

-- -------------------------------------------------------------------------
-- 5. PAINEL DE METAS FIXAS — parametrizado por mês em foco
-- -------------------------------------------------------------------------
create or replace function painel_metas_fixas(mes_foco date)
returns table (
    categoria_codigo text,
    categoria_nome text,
    carater carater_categoria,
    meta numeric,
    realizado numeric,
    diferenca numeric,
    status text,
    fonte text
)
language sql
stable
as $$
    with parametros as (
        select date_trunc('month', mes_foco)::date as v_mes
    ),
    metas_vigentes as (
        select m.*, cat.carater as cat_carater, cat.nome as cat_nome
        from metas m
        join categorias cat on cat.codigo = m.categoria_codigo
        cross join parametros p
        where cat.status = 'ATIVA'
          and m.tipo_teto = 'MENSAL'
          and date_trunc('month', m.vigencia_inicio) <= p.v_mes
          and (m.vigencia_fim is null or date_trunc('month', m.vigencia_fim) >= p.v_mes)
    ),
    reserva_calc as (
        select
            coalesce(sum(valor_teto) filter (where cat_carater = 'RECEITA'), 0)
            - coalesce(sum(valor_teto) filter (where cat_carater = 'DESPESA'), 0) as meta_reserva
        from metas_vigentes
    ),
    metas_com_valor as (
        select mv.*, (case when mv.cat_carater = 'RESERVA' then rc.meta_reserva else mv.valor_teto end) as meta_valor
        from metas_vigentes mv
        cross join reserva_calc rc
    ),
    realizado as (
        select codigo_efetivo, sum(valor_painel) as total
        from (
            select codigo_efetivo, mes_referencia_data as mes_ref, valor_painel
            from fluxo_resolvido where entra_no_painel
            union all
            select codigo_efetivo, mes_referencia as mes_ref, valor_painel
            from credito_resolvido where entra_no_painel
        ) x
        cross join parametros p
        where date_trunc('month', x.mes_ref) = p.v_mes
        group by codigo_efetivo
    )
    select
        m.categoria_codigo,
        m.cat_nome,
        m.cat_carater,
        m.meta_valor,
        coalesce(r.total, 0),
        (case when m.cat_carater = 'DESPESA' then m.meta_valor - coalesce(r.total, 0) else coalesce(r.total, 0) - m.meta_valor end),
        (case
            when m.meta_valor is null then '… EM ACOMPANHAMENTO'
            when m.cat_carater = 'DESPESA' then
                (case when coalesce(r.total, 0) <= m.meta_valor then '✓ BATEU' else '✗ ESTOUROU' end)
            else
                (case
                    when coalesce(r.total, 0) = 0 then '… AGUARDANDO'
                    when coalesce(r.total, 0) >= m.meta_valor then '✓ BATEU'
                    else '✗ NÃO BATEU'
                 end)
         end),
        m.fonte_dados
    from metas_com_valor m
    left join realizado r on r.codigo_efetivo = m.categoria_codigo
    order by m.categoria_codigo;
$$;

comment on function painel_metas_fixas is 'Equivalente à aba "Painel de Metas Fixas". A meta de categorias RESERVA é calculada dinamicamente (receitas vigentes − despesas mensais vigentes), nunca lida de uma coluna. Diferente da planilha (que exige listar cada código manualmente), aqui QUALQUER categoria ativa com meta MENSAL aparece automaticamente — categoria nova não precisa de ajuste na fórmula.';

-- -------------------------------------------------------------------------
-- 6. CUSTOS VARIÁVEIS — parametrizado por mês em foco (independente do painel acima)
-- -------------------------------------------------------------------------
create or replace function custos_variaveis(mes_foco date)
returns table (
    categoria_codigo text,
    categoria_nome text,
    tipo_teto tipo_teto_meta,
    teto numeric,
    realizado numeric,
    saldo numeric,
    percentual_usado numeric,
    referencia text,
    status text
)
language sql
stable
as $$
    with parametros as (
        select date_trunc('month', mes_foco)::date as v_mes
    ),
    metas_vigentes as (
        select m.*, cat.nome as cat_nome
        from metas m
        join categorias cat on cat.codigo = m.categoria_codigo
        cross join parametros p
        where cat.status = 'ATIVA'
          and m.tipo_teto in ('ANUAL', 'OUTRO_DELIMITADO')
          and date_trunc('month', m.vigencia_inicio) <= p.v_mes
          and (m.vigencia_fim is null or date_trunc('month', m.vigencia_fim) >= p.v_mes)
    ),
    -- Diferente do Painel de Metas Fixas, a aba Custos Variáveis NÃO exclui
    -- lançamentos de Fluxo com método "CC*" (cartão lançado na aba errada) —
    -- ela soma tudo que bate com a categoria, sem aplicar entra_no_painel.
    movimentos as (
        select codigo_efetivo, mes_referencia_data as mes_ref, abs(valor) as valor_bruto
        from fluxo_resolvido
        where carater <> 'TRANSFERÊNCIA'
        union all
        select codigo_efetivo, mes_referencia as mes_ref, valor_parcela as valor_bruto
        from credito_resolvido
    ),
    realizado as (
        select
            mv.categoria_codigo,
            (case mv.janela_acumulo
                when 'ANO_FOCO' then (
                    select coalesce(sum(x.valor_bruto), 0) from movimentos x cross join parametros p
                    where x.codigo_efetivo = mv.categoria_codigo
                      and date_trunc('year', x.mes_ref) = date_trunc('year', p.v_mes)
                )
                when 'DESDE_VIGENCIA' then (
                    select coalesce(sum(x.valor_bruto), 0) from movimentos x cross join parametros p
                    where x.codigo_efetivo = mv.categoria_codigo
                      and x.mes_ref >= date_trunc('month', mv.vigencia_inicio)
                      and x.mes_ref <= p.v_mes
                )
                else (
                    select coalesce(sum(x.valor_bruto), 0) from movimentos x cross join parametros p
                    where x.codigo_efetivo = mv.categoria_codigo
                      and date_trunc('month', x.mes_ref) = p.v_mes
                )
            end) as total
        from metas_vigentes mv
    )
    select
        mv.categoria_codigo,
        mv.cat_nome,
        mv.tipo_teto,
        mv.valor_teto,
        r.total,
        (case when mv.janela_acumulo = 'DESDE_VIGENCIA' then greatest(mv.valor_teto - r.total, 0) else mv.valor_teto - r.total end),
        (case when mv.valor_teto is null or mv.valor_teto = 0 then null else r.total / mv.valor_teto end),
        (case
            when mv.janela_acumulo = 'ANO_FOCO' then 'Ano: ' || extract(year from mes_foco)
            when mv.janela_acumulo = 'DESDE_VIGENCIA' then 'Prazo: ' || to_char(mv.vigencia_fim, 'DD/MM/YYYY')
            else 'Mês: ' || to_char(mes_foco, 'MM/YYYY')
         end),
        (case
            when mv.janela_acumulo = 'DESDE_VIGENCIA' then
                (case
                    when r.total >= mv.valor_teto then '✓ META ATINGIDA'
                    when mv.vigencia_fim is not null and date_trunc('month', mv.vigencia_fim) <= date_trunc('month', mes_foco) then '✗ PRAZO ENCERRADO'
                    else '… EM ANDAMENTO'
                 end)
            else
                (case when r.total <= mv.valor_teto then '✓ DENTRO DO ORÇAMENTO' else '✗ ESTOUROU' end)
         end)
    from metas_vigentes mv
    join realizado r on r.categoria_codigo = mv.categoria_codigo
    order by mv.categoria_codigo;
$$;

comment on function custos_variaveis is 'Equivalente à aba "Custos Variáveis". janela_acumulo decide a semântica: MES_FOCO/ANO_FOCO tratam o valor como teto de gasto (ultrapassar é ruim); DESDE_VIGENCIA trata como meta de poupança (atingir/ultrapassar é bom). Diferente do painel_metas_fixas(), aqui NÃO se exclui lançamento de Fluxo com método "CC*" — replica fielmente a fórmula original, que soma tudo que bate com a categoria.';

-- -------------------------------------------------------------------------
-- 7. CAIXINHA TURBO — saldo acumulado via window function
-- -------------------------------------------------------------------------
create view caixinha_turbo_extrato with (security_invoker = true) as
select
    m.id,
    m.data,
    m.tipo_movimento,
    m.origem_motivo,
    m.valor,
    (case when m.tipo_movimento = 'Aplicação' then m.valor else -m.valor end) as efeito_saldo,
    cfg.saldo_inicial + sum(case when m.tipo_movimento = 'Aplicação' then m.valor else -m.valor end)
        over (order by m.data, m.id) as saldo_acumulado
from caixinha_turbo_movimentos m
cross join caixinha_turbo_config cfg;

comment on view caixinha_turbo_extrato is 'Ledger com saldo corrido (SUM() OVER), equivalente à coluna "Saldo Acumulado (auto)" da planilha.';

create view caixinha_turbo_resumo with (security_invoker = true) as
select
    cfg.saldo_inicial,
    coalesce(
        (select e.saldo_acumulado from caixinha_turbo_extrato e order by e.data desc, e.id desc limit 1),
        cfg.saldo_inicial
    ) as saldo_atual,
    coalesce((select sum(valor) from caixinha_turbo_movimentos where tipo_movimento = 'Aplicação' and origem_motivo = 'Aporte Meu'), 0) as total_aportado,
    coalesce((select sum(valor) from caixinha_turbo_movimentos where tipo_movimento = 'Aplicação' and origem_motivo = 'Rendimento Automático'), 0) as rendimento_automatico_acumulado,
    coalesce((select sum(valor) from caixinha_turbo_movimentos where tipo_movimento = 'Resgate'), 0) as total_resgatado,
    cfg.total_liquido_app,
    (case
        when cfg.total_liquido_app is null then null
        else coalesce((select e.saldo_acumulado from caixinha_turbo_extrato e order by e.data desc, e.id desc limit 1), cfg.saldo_inicial) - cfg.total_liquido_app
     end) as desconto_estimado
from caixinha_turbo_config cfg;

comment on view caixinha_turbo_resumo is 'Equivalente ao bloco "① RESUMO" da aba Caixinha Turbo. Sem IR estimado por fórmula — total_liquido_app continua sendo informado manualmente, por decisão do usuário.';

-- -------------------------------------------------------------------------
-- 8. RENDA FIXA — detalhe calculado
-- -------------------------------------------------------------------------
create view renda_fixa_detalhe with (security_invoker = true) as
select
    rf.*,
    (rf.valor_bruto_atual - rf.valor_aplicado) as valorizacao_reais,
    (case when rf.valor_aplicado = 0 then 0 else (rf.valor_bruto_atual - rf.valor_aplicado) / rf.valor_aplicado end) as valorizacao_percentual,
    (rf.data_vencimento - current_date) as dias_ate_vencimento,
    fn_ir_regressivo((current_date - rf.data_aplicacao)::int, rf.isento_ir) as aliquota_ir_estimada,
    (greatest(rf.valor_bruto_atual - rf.valor_aplicado, 0) * fn_ir_regressivo((current_date - rf.data_aplicacao)::int, rf.isento_ir)) as imposto_estimado,
    (rf.valor_bruto_atual - (greatest(rf.valor_bruto_atual - rf.valor_aplicado, 0) * fn_ir_regressivo((current_date - rf.data_aplicacao)::int, rf.isento_ir))) as valor_liquido_estimado,
    (rf.valor_bruto_atual / nullif(sum(rf.valor_bruto_atual) over (), 0)) as percentual_carteira
from investimentos_renda_fixa rf;

comment on view renda_fixa_detalhe is 'Equivalente às colunas calculadas da aba "Renda Fixa" (J em diante), usando fn_ir_regressivo().';

-- -------------------------------------------------------------------------
-- 9. BOLSA DE VALORES — detalhe calculado
-- -------------------------------------------------------------------------
create view bolsa_detalhe with (security_invoker = true) as
select
    b.*,
    (b.quantidade * b.preco_medio) as valor_aplicado,
    (b.quantidade * b.cotacao_atual) as valor_mercado_atual,
    (b.quantidade * b.cotacao_atual - b.quantidade * b.preco_medio) as valorizacao_reais,
    (case when b.quantidade * b.preco_medio = 0 then 0
          else (b.quantidade * b.cotacao_atual - b.quantidade * b.preco_medio) / (b.quantidade * b.preco_medio) end) as valorizacao_percentual,
    (b.quantidade * b.cotacao_atual - b.quantidade * b.preco_medio + b.proventos_recebidos) as rentabilidade_total_reais,
    (case when b.quantidade * b.preco_medio = 0 then 0
          else (b.quantidade * b.cotacao_atual - b.quantidade * b.preco_medio + b.proventos_recebidos) / (b.quantidade * b.preco_medio) end) as rentabilidade_total_percentual,
    ((b.quantidade * b.cotacao_atual) / nullif(sum(b.quantidade * b.cotacao_atual) over (), 0)) as percentual_carteira
from investimentos_bolsa b;

comment on view bolsa_detalhe is 'Equivalente às colunas calculadas da aba "Bolsa de Valores" (I em diante).';

-- -------------------------------------------------------------------------
-- 10. CARTEIRA CONSOLIDADA
-- -------------------------------------------------------------------------
create view carteira_consolidada with (security_invoker = true) as
with totais as (
    select
        coalesce((select sum(valor_bruto_atual) from investimentos_renda_fixa), 0) as total_renda_fixa,
        coalesce((select sum(quantidade * cotacao_atual) from investimentos_bolsa), 0) as total_bolsa,
        coalesce((select saldo_atual from caixinha_turbo_resumo), 0) as total_caixinha_turbo
)
select
    total_renda_fixa,
    total_bolsa,
    total_caixinha_turbo,
    (total_renda_fixa + total_bolsa + total_caixinha_turbo) as patrimonio_total,
    (case when (total_renda_fixa + total_bolsa + total_caixinha_turbo) = 0 then 0
          else total_renda_fixa / (total_renda_fixa + total_bolsa + total_caixinha_turbo) end) as pct_renda_fixa,
    (case when (total_renda_fixa + total_bolsa + total_caixinha_turbo) = 0 then 0
          else total_bolsa / (total_renda_fixa + total_bolsa + total_caixinha_turbo) end) as pct_bolsa,
    (case when (total_renda_fixa + total_bolsa + total_caixinha_turbo) = 0 then 0
          else total_caixinha_turbo / (total_renda_fixa + total_bolsa + total_caixinha_turbo) end) as pct_caixinha_turbo
from totais;

comment on view carteira_consolidada is 'Equivalente à aba "Carteira Consolidada" — soma patrimônio das 3 fontes de investimento e a distribuição percentual.';
