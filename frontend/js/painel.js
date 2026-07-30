async function carregarPainel(mesFoco) {
    const tbody = document.getElementById('rows');
    tbody.innerHTML = carregandoLinhaHTML(8);

    const [{ data, error }, coresCategorias] = await Promise.all([
        sb.rpc('painel_metas_fixas', { mes_foco: mesFoco }),
        buscarMapaCoresCategorias(),
    ]);

    if (error) {
        renderErroLinha(tbody, 8, error.message, () => carregarPainel(mesFoco));
        document.getElementById('summary').innerHTML = '';
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8">${estadoVazioHTML('Nenhuma meta mensal vigente neste mês.', '🎯')}</td></tr>`;
        document.getElementById('summary').innerHTML = '';
        return;
    }

    tbody.innerHTML = '';
    let totalReceitas = 0, totalDespesas = 0, totalReserva = 0, bateram = 0, estouraram = 0;

    for (const r of data) {
        if (r.carater === 'RECEITA') totalReceitas += Number(r.realizado || 0);
        if (r.carater === 'DESPESA') totalDespesas += Number(r.realizado || 0);
        if (r.carater === 'RESERVA') totalReserva += Number(r.realizado || 0);
        if (r.status && r.status.startsWith('✓')) bateram++;
        if (r.status && r.status.startsWith('✗')) estouraram++;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.categoria_codigo}</td>
            <td>${pillCor(r.categoria_nome, coresCategorias[r.categoria_codigo])}</td>
            <td>${caraterPill(r.carater)}</td>
            <td class="num">${formatMoney(r.meta)}</td>
            <td class="num">${formatMoney(r.realizado)}</td>
            <td class="num">${r.diferenca === null ? '—' : formatMoney(r.diferenca)}</td>
            <td>${statusPill(r.status)}</td>
            <td>${r.fonte || ''}</td>
        `;
        tbody.appendChild(tr);
    }

    const pctBatidas = (bateram + estouraram) > 0 ? bateram / (bateram + estouraram) : null;
    const tintPct = pctBatidas === null ? 'var(--c6)' : pctBatidas >= 0.7 ? 'var(--ok)' : pctBatidas < 0.4 ? 'var(--bad)' : 'var(--pending)';

    const summaryEl = document.getElementById('summary');
    summaryEl.innerHTML = `
        <div class="stat" style="--tint: var(--ok)"><div class="label">Total receitas</div><div class="value" data-contagem="${totalReceitas}"></div></div>
        <div class="stat" style="--tint: var(--bad)"><div class="label">Total despesas</div><div class="value" data-contagem="${totalDespesas}"></div></div>
        <div class="stat" style="--tint: var(--pending)"><div class="label">Reserva guardada</div><div class="value" data-contagem="${totalReserva}"></div></div>
        <div class="stat" style="--tint: ${tintPct}"><div class="label">% de metas batidas</div><div class="value">${pctBatidas === null ? '—' : (pctBatidas * 100).toFixed(0) + '%'}</div></div>
    `;
    animarContagens(summaryEl);
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    const hoje = new Date();
    popularSeletorMesAno('mes-sel', 'ano-sel', hoje.getFullYear() - 2, hoje.getFullYear() + 2);

    const recarregar = () => carregarPainel(lerSeletorMesAnoComoData('mes-sel', 'ano-sel'));
    ativarMesVigente('mes-sel', 'ano-sel', 'btn-mes-atual', recarregar);
    document.getElementById('mes-sel').addEventListener('change', recarregar);
    document.getElementById('ano-sel').addEventListener('change', recarregar);
    makeSortable('rows');

    recarregar();
});
