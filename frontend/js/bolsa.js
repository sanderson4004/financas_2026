async function carregarBolsa() {
    const tbody = document.getElementById('rows');
    tbody.innerHTML = carregandoLinhaHTML(9);

    const { data, error } = await sb.from('bolsa_detalhe').select('*').order('id');

    if (error) {
        renderErroLinha(tbody, 9, error.message, carregarBolsa);
        return;
    }

    tbody.innerHTML = data.map(r => `
        <tr>
            <td>${r.ticker}</td>
            <td>${r.nome_ativo}</td>
            <td class="secundaria">${r.tipo}</td>
            <td class="num">${r.quantidade}</td>
            <td class="num">${formatMoney(r.valor_mercado_atual)}</td>
            <td class="num secundaria">${(r.valorizacao_percentual * 100).toFixed(2)}%</td>
            <td class="num secundaria">${(r.rentabilidade_total_percentual * 100).toFixed(2)}%</td>
            <td class="num">${(r.percentual_carteira * 100).toFixed(1)}%</td>
            <td>
                <div class="inline-update">
                    <input type="number" step="0.0001" value="${r.cotacao_atual}" id="cot-${r.id}" title="Cotação atual">
                    <input type="number" step="0.01" value="${r.proventos_recebidos}" id="prov-${r.id}" title="Proventos">
                    <button type="button" class="secondary" data-id="${r.id}">Salvar</button>
                </div>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            await comBotaoOcupado(btn, async () => {
                const cotacao = parseFloat(document.getElementById(`cot-${id}`).value);
                const proventos = parseFloat(document.getElementById(`prov-${id}`).value);
                const { error } = await sb.from('investimentos_bolsa')
                    .update({ cotacao_atual: cotacao, proventos_recebidos: proventos, atualizado_em: new Date().toISOString() })
                    .eq('id', id);
                if (error) {
                    alert(`Erro ao atualizar: ${error.message}`);
                    return;
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
