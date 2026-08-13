async function carregarBolsa() {
    const tbody = document.getElementById('rows');
    tbody.innerHTML = carregandoLinhaHTML(9);

    const { data, error } = await sb.from('bolsa_detalhe').select('*').order('id');

    if (error) {
        renderErroLinha(tbody, 9, error.message, carregarBolsa);
        return;
    }

    tbody.innerHTML = data.map(r => {
        const valPct = (r.valorizacao_percentual * 100).toFixed(2);
        const rentPct = (r.rentabilidade_total_percentual * 100).toFixed(2);
        const valClass = valPct >= 0 ? 'ok' : 'bad';
        const rentClass = rentPct >= 0 ? 'ok' : 'bad';
        
        return `
        <tr>
            <td style="font-weight: 600;">${r.ticker}</td>
            <td style="color: var(--text-dim);">${r.nome_ativo}</td>
            <td class="secundaria"><span class="pill neutral">${r.tipo}</span></td>
            <td class="num" style="font-weight: 500;">${r.quantidade}</td>
            <td class="num" style="font-weight: 600;">${formatMoney(r.valor_mercado_atual)}</td>
            <td class="num secundaria"><span class="pill ${valClass}">${valPct}%</span></td>
            <td class="num secundaria"><span class="pill ${rentClass}">${rentPct}%</span></td>
            <td class="num">${(r.percentual_carteira * 100).toFixed(1)}%</td>
            <td>
                <div style="display:flex; gap:16px; align-items:center;">
                    <div style="display:flex; align-items:center; gap:8px">
                        <input type="number" step="0.0001" value="${r.cotacao_atual}" id="cot-${r.id}" title="Cotação atual" style="width:90px; padding: 6px 8px; font-size: 12px; height: auto;">
                        <button type="button" class="secondary" data-cot-id="${r.id}" style="padding:6px 12px; font-size: 11px;">Atualizar Cotação</button>
                    </div>
                    <div style="width: 1px; height: 24px; background: var(--border-soft);"></div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="font-size:12px; font-weight:600; color:var(--text-dim);" title="Total recebido acumulado">${formatMoney(r.proventos_recebidos)}</div>
                        <button type="button" class="secondary" data-prov-id="${r.id}" data-ticker="${r.ticker}" data-prov-atual="${r.proventos_recebidos}" style="padding:6px 12px; font-size: 11px;">Lançar Provento</button>
                    </div>
                </div>
            </td>
        </tr>
    `}).join('');

    tbody.querySelectorAll('button[data-cot-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-cot-id');
            await comBotaoOcupado(btn, async () => {
                const cotacao = parseFloat(document.getElementById(`cot-${id}`).value);
                const { error } = await sb.from('investimentos_bolsa')
                    .update({ cotacao_atual: cotacao, atualizado_em: new Date().toISOString() })
                    .eq('id', id);
                if (error) {
                    alert(`Erro ao atualizar: ${error.message}`);
                    return;
                }
                await carregarBolsa();
            });
        });
    });

    tbody.querySelectorAll('button[data-prov-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-prov-id');
            const ticker = btn.getAttribute('data-ticker');
            const provAtual = parseFloat(btn.getAttribute('data-prov-atual') || '0');
            
            const recebidoStr = prompt(`Lançar novo provento recebido para ${ticker}:\n(Valor em R$)`);
            if (!recebidoStr) return;
            
            const novoValor = parseFloat(recebidoStr.replace(',', '.'));
            if (isNaN(novoValor) || novoValor <= 0) {
                alert('Valor inválido!');
                return;
            }

            await comBotaoOcupado(btn, async () => {
                // 1. Atualiza o ativo com o novo total
                const novoTotal = provAtual + novoValor;
                const { error: errBolsa } = await sb.from('investimentos_bolsa')
                    .update({ proventos_recebidos: novoTotal, atualizado_em: new Date().toISOString() })
                    .eq('id', id);
                
                if (errBolsa) {
                    alert(`Erro ao atualizar ativo: ${errBolsa.message}`);
                    return;
                }

                // 2. Garante categoria de Proventos
                let { data: categorias } = await sb.from('categorias').select('codigo').ilike('nome', '%provento%').limit(1);
                let catProvento = (categorias && categorias.length > 0) ? categorias[0].codigo : null;
                if (!catProvento) {
                    catProvento = '#PROVENTOS';
                    await sb.from('categorias').insert({ codigo: catProvento, nome: 'Proventos', carater: 'RECEITA', cor: '#30cb8c' });
                }

                // 3. Lança no fluxo (Saldo Nubank)
                const payloadFluxo = {
                    carater: 'RECEITA',
                    valor: novoValor,
                    data_movimento: new Date().toISOString().split('T')[0],
                    data_pagamento: new Date().toISOString().split('T')[0],
                    metodo: 'Pix', // Pix reflete Saldo Nubank no modelo atual
                    categoria_codigo: catProvento,
                    descricao: `Provento ${ticker}`
                };
                const { error: errFluxo } = await sb.from('lancamentos_fluxo').insert(payloadFluxo);
                
                if (errFluxo) {
                    alert(`Ativo atualizado, mas erro ao lançar no fluxo: ${errFluxo.message}`);
                } else {
                    toast(`Provento de ${formatMoney(novoValor)} lançado no fluxo.`);
                }
                
                await carregarBolsa();
            });
        });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    await carregarBolsa();
    makeSortable('rows');

    document.getElementById('bolsa-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('msg');
        const btn = e.target.querySelector('button[type="submit"]');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        await comBotaoOcupado(btn, async () => {
            const payload = {
                ticker: document.getElementById('ticker').value.trim().toUpperCase(),
                nome_ativo: document.getElementById('nome_ativo').value,
                tipo: document.getElementById('tipo').value,
                quantidade: parseFloat(document.getElementById('quantidade').value),
                preco_medio: parseFloat(document.getElementById('preco_medio').value),
                cotacao_atual: parseFloat(document.getElementById('cotacao_atual').value),
                proventos_recebidos: parseFloat(document.getElementById('proventos_recebidos').value || '0'),
            };

            const { error } = await sb.from('investimentos_bolsa').insert(payload);

            if (error) {
                msg.textContent = `Erro: ${error.message}`;
                msg.className = 'msg error';
                return;
            }

            msg.textContent = 'Ativo salvo.';
            msg.className = 'msg success';
            document.getElementById('bolsa-form').reset();
            await carregarBolsa();
            toast('Ativo salvo.');
        });
    });
});
