async function carregarCategorias() {
    const sel = document.getElementById('categoria');
    const { data, error } = await sb
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

async function carregarMetodos() {
    const sel = document.getElementById('metodo');
    const { data, error } = await sb
        .from('metodos_pagamento')
        .select('nome')
        .eq('status', 'ATIVA')
        .order('nome');

    if (error) {
        sel.innerHTML = `<option>Erro ao carregar métodos</option>`;
        return;
    }

    sel.innerHTML = data.map(m => `<option value="${m.nome}">${m.nome}</option>`).join('');
}

async function carregarLancamentos() {
    const tbody = document.getElementById('rows');
    tbody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';

    const { data, error } = await sb
        .from('lancamentos_fluxo')
        .select('*, categorias(nome)')
        .order('id', { ascending: false })
        .limit(30);

    if (error) {
        tbody.innerHTML = `<tr><td colspan="7">Erro ao carregar: ${error.message}</td></tr>`;
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">Nenhum lançamento ainda.</div></td></tr>';
        return;
    }

    tbody.innerHTML = data.map(r => `
        <tr>
            <td>${r.data_movimento || r.data_pagamento || '—'}</td>
            <td>${caraterPill(r.carater)}</td>
            <td>${r.categorias ? r.categorias.nome : r.categoria_codigo}</td>
            <td>${r.metodo}</td>
            <td>${r.descricao || ''}</td>
            <td class="num">${formatMoney(r.valor)}</td>
            <td><button type="button" class="danger" data-id="${r.id}">Excluir</button></td>
        </tr>
    `).join('');

    tbody.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const ok = await confirmarAcao('Tem certeza que deseja excluir este lançamento?');
            if (!ok) return;

            const { error: errDel } = await sb.from('lancamentos_fluxo').delete().eq('id', btn.getAttribute('data-id'));
            if (errDel) {
                alert(`Erro ao excluir: ${errDel.message}`);
                return;
            }
            await carregarLancamentos();
        });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    await carregarCategorias();
    await carregarMetodos();
    await carregarLancamentos();
    makeSortable('rows');

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

        const { error } = await sb.from('lancamentos_fluxo').insert(payload);

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
