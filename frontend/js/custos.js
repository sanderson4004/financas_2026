async function carregarCustos(mesFoco) {
    const tbody = document.getElementById('rows');
    tbody.innerHTML = '<tr><td colspan="9">Carregando...</td></tr>';

    const { data, error } = await sb.rpc('custos_variaveis', { mes_foco: mesFoco });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="9">Erro ao carregar: ${error.message}</td></tr>`;
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state">Nenhuma categoria ANUAL/OUTRO_DELIMITADO vigente neste mês.</div></td></tr>';
        return;
    }

    tbody.innerHTML = data.map(r => `
        <tr>
            <td>${r.categoria_codigo}</td>
            <td>${r.categoria_nome}</td>
            <td>${r.tipo_teto}</td>
            <td class="num">${formatMoney(r.teto)}</td>
            <td class="num">${formatMoney(r.realizado)}</td>
            <td class="num">${formatMoney(r.saldo)}</td>
            <td class="num">${r.percentual_usado === null ? '—' : (r.percentual_usado * 100).toFixed(1) + '%'}</td>
            <td>${r.referencia}</td>
            <td>${statusPill(r.status)}</td>
        </tr>
    `).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    const hoje = new Date();
    popularSeletorMesAno('mes-sel', 'ano-sel', hoje.getFullYear() - 2, hoje.getFullYear() + 2);
    definirSeletorMesAno('mes-sel', 'ano-sel', hoje.getMonth() + 1, hoje.getFullYear());

    const recarregar = () => carregarCustos(lerSeletorMesAnoComoData('mes-sel', 'ano-sel'));
    document.getElementById('mes-sel').addEventListener('change', recarregar);
    document.getElementById('ano-sel').addEventListener('change', recarregar);

    recarregar();
});
