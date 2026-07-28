async function carregarCategorias() {
    const sel = document.getElementById('categoria');
    const { data, error } = await supabase
        .from('categorias')
        .select('codigo, nome')
        .eq('status', 'ATIVA')
        .order('codigo');

    if (error) {
        sel.innerHTML = `<option>Erro ao carregar categorias</option>`;
        return;
    }

    sel.innerHTML = data.map(c => `<option value="${c.codigo}">${c.codigo} — ${c.nome}</option>`).join('');
}

async function carregarLancamentos() {
    const tbody = document.getElementById('rows');
    tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';

    const { data, error } = await supabase
        .from('lancamentos_fluxo')
        .select('*, categorias(nome)')
        .order('id', { ascending: false })
        .limit(30);

    if (error) {
        tbody.innerHTML = `<tr><td colspan="6">Erro ao carregar: ${error.message}</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(r => `
        <tr>
            <td>${r.data_movimento || r.data_pagamento || '—'}</td>
            <td>${r.carater}</td>
            <td>${r.categorias ? r.categorias.nome : r.categoria_codigo}</td>
            <td>${r.metodo}</td>
            <td>${r.descricao || ''}</td>
            <td class="num">${formatMoney(r.valor)}</td>
        </tr>
    `).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    await carregarCategorias();
    await carregarLancamentos();

    document.getElementById('fluxo-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('msg');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        const payload = {
            carater: document.getElementById('carater').value,
            valor: parseFloat(document.getElementById('valor').value),
            data_movimento: document.getElementById('data_movimento').value || null,
            data_pagamento: document.getElementById('data_pagamento').value || null,
            metodo: document.getElementById('metodo').value,
            categoria_codigo: document.getElementById('categoria').value,
            descricao: document.getElementById('descricao').value || null,
        };

        const { error } = await supabase.from('lancamentos_fluxo').insert(payload);

        if (error) {
            msg.textContent = `Erro: ${error.message}`;
            msg.className = 'msg error';
            return;
        }

        msg.textContent = 'Lançamento salvo.';
        msg.className = 'msg success';
        document.getElementById('fluxo-form').reset();
        await carregarLancamentos();
    });
});
