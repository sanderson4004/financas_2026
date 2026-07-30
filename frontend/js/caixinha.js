async function carregarResumo() {
    const el = document.getElementById('resumo');
    const { data, error } = await sb.from('caixinha_turbo_resumo').select('*').single();
    if (error) {
        renderErro(el, error.message, carregarResumo);
        return;
    }

    const resumoEl = document.getElementById('resumo');
    resumoEl.innerHTML = `
        <div class="stat" style="--tint: var(--accent)"><div class="label">Saldo atual</div><div class="value" data-contagem="${Number(data.saldo_atual)}"></div></div>
        <div class="stat" style="--tint: var(--c6)"><div class="label">Total aportado</div><div class="value" data-contagem="${Number(data.total_aportado)}"></div></div>
        <div class="stat" style="--tint: var(--ok)"><div class="label">Rendimento automático</div><div class="value" data-contagem="${Number(data.rendimento_automatico_acumulado)}"></div></div>
        <div class="stat" style="--tint: var(--pending)"><div class="label">Total resgatado</div><div class="value" data-contagem="${Number(data.total_resgatado)}"></div></div>
        <div class="stat" style="--tint: var(--c6)"><div class="label">Total bruto (app)</div><div class="value" data-contagem="${Number(data.total_bruto_app)}"></div></div>
        <div class="stat" style="--tint: var(--accent-2)"><div class="label">Total líquido (app)</div><div class="value" data-contagem="${Number(data.total_liquido_app)}"></div></div>
        <div class="stat" style="--tint: var(--bad)"><div class="label">Imposto real (bruto − líquido)</div><div class="value" data-contagem="${Number(data.imposto_real)}"></div></div>
        <div class="stat" style="--tint: var(--pending)"><div class="label">Desconto estimado (vs. ledger)</div><div class="value" data-contagem="${Number(data.desconto_estimado)}"></div></div>
    `;
    animarContagens(resumoEl);

    document.getElementById('saldo_inicial').value = data.saldo_inicial ?? 0;
    document.getElementById('total_bruto_app').value = data.total_bruto_app ?? '';
    document.getElementById('total_liquido_app').value = data.total_liquido_app ?? '';
}

async function carregarExtrato() {
    const tbody = document.getElementById('rows');
    tbody.innerHTML = carregandoLinhaHTML(5);

    const { data, error } = await sb
        .from('caixinha_turbo_extrato')
        .select('*')
        .order('data', { ascending: false })
        .order('id', { ascending: false })
        .limit(30);

    if (error) {
        renderErroLinha(tbody, 5, error.message, carregarExtrato);
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">${estadoVazioHTML('Nenhuma movimentação ainda. Lance a primeira abaixo.', '🐷')}</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(r => `
        <tr>
            <td>${formatDate(r.data)}</td>
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
        const btn = e.target.querySelector('button[type="submit"]');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        await comBotaoOcupado(btn, async () => {
            const payload = {
                id: 1,
                saldo_inicial: parseFloat(document.getElementById('saldo_inicial').value),
                total_bruto_app: document.getElementById('total_bruto_app').value
                    ? parseFloat(document.getElementById('total_bruto_app').value)
                    : null,
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
            toast('Configuração salva.');
        });
    });

    document.getElementById('mov-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('mov-msg');
        const btn = e.target.querySelector('button[type="submit"]');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        await comBotaoOcupado(btn, async () => {
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
            toast('Movimentação lançada.');
        });
    });
});
