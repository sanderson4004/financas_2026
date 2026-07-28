function primeiroDiaDoMes(valorInputMonth) {
    // valorInputMonth vem como "2026-08" do <input type="month">
    return `${valorInputMonth}-01`;
}

function mesAtualComoInput() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    return `${ano}-${mes}`;
}

async function carregarPainel(mesInput) {
    const tbody = document.getElementById('rows');
    tbody.innerHTML = '<tr><td colspan="8">Carregando...</td></tr>';

    const mesFoco = primeiroDiaDoMes(mesInput);
    const { data, error } = await sb.rpc('painel_metas_fixas', { mes_foco: mesFoco });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="8">Erro ao carregar: ${error.message}</td></tr>`;
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
            <td>${r.categoria_nome}</td>
            <td>${r.carater}</td>
            <td class="num">${formatMoney(r.meta)}</td>
            <td class="num">${formatMoney(r.realizado)}</td>
            <td class="num">${r.diferenca === null ? '—' : formatMoney(r.diferenca)}</td>
            <td class="${statusClass(r.status)}">${r.status}</td>
            <td>${r.fonte || ''}</td>
        `;
        tbody.appendChild(tr);
    }

    const pctBatidas = (bateram + estouraram) > 0 ? bateram / (bateram + estouraram) : null;

    document.getElementById('summary').innerHTML = `
        <div class="stat"><div class="label">Total receitas</div><div class="value">${formatMoney(totalReceitas)}</div></div>
        <div class="stat"><div class="label">Total despesas</div><div class="value">${formatMoney(totalDespesas)}</div></div>
        <div class="stat"><div class="label">Reserva guardada</div><div class="value">${formatMoney(totalReserva)}</div></div>
        <div class="stat"><div class="label">% de metas batidas</div><div class="value">${pctBatidas === null ? '—' : (pctBatidas * 100).toFixed(0) + '%'}</div></div>
    `;
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    const mesInput = document.getElementById('mes');
    mesInput.value = mesAtualComoInput();
    mesInput.addEventListener('change', () => carregarPainel(mesInput.value));

    carregarPainel(mesInput.value);
});
