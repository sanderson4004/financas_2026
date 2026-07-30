-- =========================================================================
-- 08_caixinha_total_bruto.sql — Total bruto informado pelo app (Caixinha Turbo)
--
-- Hoje só existe total_liquido_app (informado manualmente). Adiciona
-- total_bruto_app na mesma linha singleton, e passa a calcular o imposto
-- real (bruto informado − líquido informado) além do desconto_estimado já
-- existente (que compara contra o saldo calculado pelo ledger, não contra
-- um valor bruto informado).
-- =========================================================================

alter table caixinha_turbo_config add column total_bruto_app numeric(12,2);

comment on column caixinha_turbo_config.total_bruto_app is 'Total bruto informado pelo app do banco (antes de IR/IOF), na mesma data que total_liquido_app. Junto com total_liquido_app dá o imposto realmente cobrado — mais preciso que desconto_estimado, que compara contra o saldo calculado pelo ledger.';

create or replace view caixinha_turbo_resumo with (security_invoker = true) as
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
     end) as desconto_estimado,
    cfg.total_bruto_app,
    (case
        when cfg.total_bruto_app is null or cfg.total_liquido_app is null then null
        else cfg.total_bruto_app - cfg.total_liquido_app
     end) as imposto_real
from caixinha_turbo_config cfg;

comment on view caixinha_turbo_resumo is 'Equivalente ao bloco "① RESUMO" da aba Caixinha Turbo. imposto_real (bruto − líquido, os dois informados pelo app) é mais confiável que desconto_estimado (que compara contra o saldo calculado pelo ledger, sujeito a defasagem de rendimento não lançado ainda).';
