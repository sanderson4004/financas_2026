async function carregarRendaFixa() {
    const tbody = document.getElementById('rows');
    tbody.innerHTML = carregandoLinhaHTML(11);

    const { data, error } = await sb.from('renda_fixa_detalhe').select('*').order('id');

    if (error) {
        renderErroLinha(tbody, 11, error.message, carregarRendaFixa);
        return;
    }

    tbody.innerHTML = data.map(r => `
        <tr>
            <td>${r.instituicao}</td>
            <td>${r.tipo_ativo}</td>
            <td class="num">${formatMoney(r.valor_aplicado)}</td>
            <td class="num">${formatMoney(r.valor_bruto_atual)}</td>
            <td class="num">${formatMoney(r.valorizacao_reais)}</td>
            <td class="num">${r.dias_ate_vencimento}</td>
            <td class="num">${formatMoney(r.imposto_estimado)}</td>
            <td class="num">${formatMoney(r.valor_liquido_estimado)}</td>
            <td class="num">${r.valor_liquido_informado === null ? '—' : formatMoney(r.valor_liquido_informado)}</td>
            <td class="num">${(r.percentual_carteira * 100).toFixed(1)}%</td>
            <td>
                <div class="inline-update">
                    <input type="number" step="0.01" value="${r.valor_bruto_atual}" id="upd-bruto-${r.id}" title="Valor bruto atual">
                    <input type="number" step="0.01" value="${r.valor_liquido_informado ?? ''}" id="upd-liquido-${r.id}" title="Valor líquido informado pelo banco" placeholder="líquido informado">
                    <button type="button" class="secondary" data-id="${r.id}">Salvar</button>
                </div>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            await comBotaoOcupado(btn, async () => {
                const novoBruto = parseFloat(document.getElementById(`upd-bruto-${id}`).value);
                const liquidoRaw = document.getElementById(`upd-liquido-${id}`).value;
                const { error } = await sb.from('investimentos_renda_fixa')
                    .update({
                        valor_bruto_atual: novoBruto,
                        valor_liquido_informado: liquidoRaw === '' ? null : parseFloat(liquidoRaw),
                        atualizado_em: new Date().toISOString(),
                    })
                    .eq('id', id);
                if (error) {
                    alert(`Erro ao atualizar: ${error.message}`);
                    return;
                }
                await carregarRendaFixa();
            });
        });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    await carregarRendaFixa();
    makeSortable('rows');

    document.getElementById('rf-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('msg');
        const btn = e.target.querySelector('button[type="submit"]');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        await comBotaoOcupado(btn, async () => {
            const payload = {
                instituicao: document.getElementById('instituicao').value,
                tipo_ativo: document.getElementById('tipo_ativo').value,
                indexador: document.getElementById('indexador').value || null,
                isento_ir: document.getElementById('isento_ir').value === 'true',
                data_aplicacao: document.getElementById('data_aplicacao').value,
                data_vencimento: document.getElementById('data_vencimento').value,
                valor_aplicado: parseFloat(document.getElementById('valor_aplicado').value),
                valor_bruto_atual: parseFloat(document.getElementById('valor_bruto_atual').value),
            };

            const { error } = await sb.from('investimentos_renda_fixa').insert(payload);

            if (error) {
                msg.textContent = `Erro: ${error.message}`;
                msg.className = 'msg error';
                return;
            }

            msg.textContent = 'Aplicação salva.';
            msg.className = 'msg success';
            document.getElementById('rf-form').reset();
            await carregarRendaFixa();
        });
    });
});
