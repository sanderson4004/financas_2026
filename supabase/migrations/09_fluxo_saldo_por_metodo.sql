-- =========================================================================
-- 09_fluxo_saldo_por_metodo.sql — Saldo corrente por método (Pix/Dinheiro)
--
-- Soma de tudo que já foi lançado em Fluxo, agrupado por método — dá o
-- saldo real em caixa (Nubank via Pix, dinheiro físico na carteira etc.).
-- Exclui métodos "CC*" pela mesma regra que já existe em fluxo_resolvido:
-- lançamento de cartão de crédito feito (por engano) na aba Fluxo não é
-- saldo em caixa de verdade, é fatura futura.
--
-- Como valor já é negativo para DESPESA e positivo para RECEITA/
-- TRANSFERÊNCIA (regra da tela de Fluxo), a soma bruta já é o saldo.
-- =========================================================================

create view fluxo_saldo_por_metodo with (security_invoker = true) as
select
    metodo,
    sum(valor) as saldo
from lancamentos_fluxo
where left(metodo, 2) <> 'CC'
group by metodo;

comment on view fluxo_saldo_por_metodo is 'Saldo corrente por método de pagamento (soma de todos os lançamentos de Fluxo já feitos), excluindo métodos de cartão de crédito. Usado no topo da tela de Fluxo para mostrar quanto realmente existe em cada "lugar" (ex: Pix = Nubank, Dinheiro = carteira física).';

grant select on fluxo_saldo_por_metodo to authenticated;
