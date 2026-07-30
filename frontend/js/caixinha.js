async function carregarResumo() {
    const { data, error } = await sb.from('caixinha_turbo_resumo').select('*').single();
    if (error) {
        document.getElementById('resumo').innerHTML = `<div class="msg error">Erro: ${error.message}</div>`;
        return;
    }

    document.getElementById('resumo').innerHTML = `
        <div class="stat"><div class="label">Saldo atual</div><div class="value">${formatMoney(data.saldo_atual)}</div></div>
        <div class="stat"><div class="label">Total aportado</div><div class="value">${formatMoney(data.total_aportado)}</div></div>
        <div class="stat"><div class="label">Rendimento automático</div><div class="value">${formatMoney(data.rendimento_automatico_acumulado)}</div></div>
        <div class="stat"><div class="label">Total resgatado</div><div class="value">${formatMoney(data.total_resgatado)}</div></div>
        <div class="stat"><div class="label">Total líquido (app)</div><div class="value">${formatMoney(data.total_liquido_app)}</div></div>
        <div class="stat"><div class="label">Desconto estimado</div><div class="value">${formatMoney(data.desconto_estimado)}</div></div>
    `;

    document.getElementById('saldo_inicial').value = data.saldo_inicial ?? 0;
    document.getElementById('total_liquido_app').value = data.total_liquido_app ?? '';
}

async function carregarExtrato() {
    const tbody = document.getElementById('rows');
    tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';

    const { data, error } = await sb
        .from('caixinha_turbo_extrato')
        .select('*')
        .order('data', { ascending: false })
        .order('id', { ascending: false })
        .limit(30);

    if (error) {
        tbody.innerHTML = `<tr><td colspan="5">Erro ao carregar: ${error.message}</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(r => `
        <tr>
            <td>${r.data}</td>
            <td>${r.tipo_movimento}</td>
            <td>${r.origem_motivo}</td>
            <td class="num">${formatMoney(r.efeito_saldo)}</td>
            <td class="num">${formatMoney(r.saldo_acumulado)}</td>
        </tr>
    `).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    await carregarResumo();
    await carregarExtrato();
    makeSortable('rows');

    document.getElementById('config-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('config-msg');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        const payload = {
            id: 1,
            saldo_inicial: parseFloat(document.getElementById('saldo_inicial').value),
            total_liquido_app: document.getElementById('total_liquido_app').value
                ? parseFloat(document.getElementById('total_liquido_app').value)
                : null,
        };

        const { error } = await sb.from('caixinha_turbo_config').upsert(payload);

        if (error) {
            msg.textContent = `Erro: ${error.message}`;
            msg.className = 'msg error';
            return;
        }

        msg.textContent = 'Configuração salva.';
        msg.className = 'msg success';
        await carregarResumo();
    });

    document.getElementById('mov-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('mov-msg');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        const payload = {
            tipo_movimento: document.getElementById('tipo_movimento').value,
            valor: parseFloat(document.getElementById('valor').value),
            data: document.getElementById('data').value,
            origem_motivo: document.getElementById('origem_motivo').value,
        };

        const { error } = await sb.from('caixinha_turbo_movimentos').insert(payload);

        if (error) {
            msg.textContent = `Erro: ${error.message}`;
            msg.className = 'msg error';
            return;
        }

        msg.textContent = 'Movimentação lançada.';
        msg.className = 'msg success';
        document.getElementById('mov-form').reset();
        await carregarResumo();
        await carregarExtrato();
    });
});
