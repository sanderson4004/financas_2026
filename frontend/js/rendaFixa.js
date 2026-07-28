async function carregarRendaFixa() {
    const tbody = document.getElementById('rows');
    tbody.innerHTML = '<tr><td colspan="10">Carregando...</td></tr>';

    const { data, error } = await sb.from('renda_fixa_detalhe').select('*').order('id');

    if (error) {
        tbody.innerHTML = `<tr><td colspan="10">Erro ao carregar: ${error.message}</td></tr>`;
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
            <td class="num">${(r.percentual_carteira * 100).toFixed(1)}%</td>
            <td>
                <div class="inline-update">
                    <input type="number" step="0.01" value="${r.valor_bruto_atual}" id="upd-${r.id}">
                    <button type="button" class="secondary" data-id="${r.id}">Salvar</button>
                </div>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const novoValor = parseFloat(document.getElementById(`upd-${id}`).value);
            const { error } = await sb.from('investimentos_renda_fixa')
                .update({ valor_bruto_atual: novoValor, atualizado_em: new Date().toISOString() })
                .eq('id', id);
            if (error) {
                alert(`Erro ao atualizar: ${error.message}`);
                return;
            }
            await carregarRendaFixa();
        });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    await carregarRendaFixa();

    document.getElementById('rf-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('msg');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

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
