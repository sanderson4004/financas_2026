document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    const { data, error } = await sb.from('carteira_consolidada').select('*').single();

    if (error) {
        document.getElementById('resumo').innerHTML = `<div class="msg error">Erro: ${error.message}</div>`;
        return;
    }

    document.getElementById('resumo').innerHTML = `
        <div class="stat"><div class="label">Patrimônio total</div><div class="value">${formatMoney(data.patrimonio_total)}</div></div>
        <div class="stat"><div class="label">Renda Fixa</div><div class="value">${formatMoney(data.total_renda_fixa)}</div></div>
        <div class="stat"><div class="label">Bolsa</div><div class="value">${formatMoney(data.total_bolsa)}</div></div>
        <div class="stat"><div class="label">Caixinha Turbo</div><div class="value">${formatMoney(data.total_caixinha_turbo)}</div></div>
    `;

    document.getElementById('rows').innerHTML = `
        <tr><td>Renda Fixa</td><td class="num">${formatMoney(data.total_renda_fixa)}</td><td class="num">${(data.pct_renda_fixa * 100).toFixed(1)}%</td></tr>
        <tr><td>Bolsa</td><td class="num">${formatMoney(data.total_bolsa)}</td><td class="num">${(data.pct_bolsa * 100).toFixed(1)}%</td></tr>
        <tr><td>Caixinha Turbo</td><td class="num">${formatMoney(data.total_caixinha_turbo)}</td><td class="num">${(data.pct_caixinha_turbo * 100).toFixed(1)}%</td></tr>
    `;
});
