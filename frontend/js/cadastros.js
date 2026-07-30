async function carregarCategoriasCadastro() {
    const tbody = document.getElementById('cat-rows');
    tbody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';

    const { data, error } = await sb.from('categorias').select('*').order('codigo');

    if (error) {
        tbody.innerHTML = `<tr><td colspan="4">Erro ao carregar: ${error.message}</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(c => `
        <tr>
            <td>${c.codigo}</td>
            <td>${c.nome}</td>
            <td>${caraterPill(c.carater)}</td>
            <td><span class="pill ${c.status === 'ATIVA' ? 'status-ok' : 'status-pending'}">${c.status}</span></td>
        </tr>
    `).join('');
}

async function carregarCategoriaSelectVigencia() {
    const sel = document.getElementById('vig-categoria');
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

const STATUS_LABEL_TIPO = { MENSAL: 'Fixa', ANUAL: 'Variável · Anual', OUTRO_DELIMITADO: 'Variável · Prazo' };
const STATUS_LABEL_JANELA = { MES_FOCO: 'Teto no mês', ANO_FOCO: 'Teto no ano', DESDE_VIGENCIA: 'Poupança acumulada' };

async function carregarVigencias() {
    const tbody = document.getElementById('vig-rows');
    tbody.innerHTML = '<tr><td colspan="8">Carregando...</td></tr>';

    const { data, error } = await sb
        .from('metas')
        .select('*, categorias(nome)')
        .order('categoria_codigo')
        .order('vigencia_inicio', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="8">Erro ao carregar: ${error.message}</td></tr>`;
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state">Nenhuma vigência cadastrada ainda.</div></td></tr>';
        return;
    }

    const hoje = new Date().toISOString().slice(0, 10);

    tbody.innerHTML = data.map(m => {
        const vigente = !m.vigencia_fim || m.vigencia_fim >= hoje;
        return `
        <tr>
            <td>${m.categoria_codigo} — ${m.categorias ? m.categorias.nome : ''}</td>
            <td>${STATUS_LABEL_TIPO[m.tipo_teto] || m.tipo_teto}</td>
            <td>${m.janela_acumulo ? (STATUS_LABEL_JANELA[m.janela_acumulo] || m.janela_acumulo) : '—'}</td>
            <td class="num">${m.valor_teto === null ? 'auto (Reserva)' : formatMoney(m.valor_teto)}</td>
            <td>${m.vigencia_inicio}</td>
            <td>${m.vigencia_fim || '—'}</td>
            <td><span class="pill ${vigente ? 'status-ok' : 'status-pending'}">${vigente ? 'VIGENTE' : 'ENCERRADA'}</span></td>
            <td>
                ${m.vigencia_fim ? '—' : `
                    <div class="inline-update">
                        <input type="date" id="fim-${m.id}" value="${hoje}">
                        <button type="button" class="secondary" data-id="${m.id}">Encerrar</button>
                    </div>
                `}
            </td>
        </tr>
    `;
    }).join('');

    tbody.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const novaData = document.getElementById(`fim-${id}`).value;
            if (!novaData) { alert('Escolha uma data de fim.'); return; }
            const { error } = await sb.from('metas').update({ vigencia_fim: novaData }).eq('id', id);
            if (error) {
                alert(`Erro ao encerrar: ${error.message}`);
                return;
            }
            await carregarVigencias();
        });
    });
}

function atualizarCamposVigencia() {
    const tipo = document.getElementById('vig-tipo').value;
    const periodicidade = document.getElementById('vig-periodicidade').value;

    document.getElementById('vig-periodicidade-wrap').style.display = tipo === 'VARIAVEL' ? 'flex' : 'none';
    document.getElementById('vig-janela-wrap').style.display = (tipo === 'VARIAVEL' && periodicidade === 'OUTRO_DELIMITADO') ? 'block' : 'none';
}

async function carregarListaCadastro(table, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';

    const { data, error } = await sb.from(table).select('*').order('nome');

    if (error) {
        tbody.innerHTML = `<tr><td colspan="3">Erro ao carregar: ${error.message}</td></tr>`;
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3"><div class="empty-state">Nada cadastrado ainda.</div></td></tr>';
        return;
    }

    tbody.innerHTML = data.map(r => `
        <tr>
            <td>${r.nome}</td>
            <td><span class="pill ${r.status === 'ATIVA' ? 'status-ok' : 'status-bad'}">${r.status}</span></td>
            <td><button type="button" class="secondary" data-nome="${r.nome.replace(/"/g, '&quot;')}" data-status="${r.status}">${r.status === 'ATIVA' ? 'Desativar' : 'Reativar'}</button></td>
        </tr>
    `).join('');

    tbody.querySelectorAll('button[data-nome]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const novoStatus = btn.getAttribute('data-status') === 'ATIVA' ? 'INATIVA' : 'ATIVA';
            const { error } = await sb.from(table).update({ status: novoStatus }).eq('nome', btn.getAttribute('data-nome'));
            if (error) {
                alert(`Erro ao atualizar: ${error.message}`);
                return;
            }
            await carregarListaCadastro(table, tbodyId);
        });
    });
}

function wireCadastroSimples(formId, table, inputId, msgId, tbodyId) {
    document.getElementById(formId).addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById(msgId);
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        const nome = document.getElementById(inputId).value.trim();
        const { error } = await sb.from(table).insert({ nome });

        if (error) {
            msg.textContent = `Erro: ${error.message}`;
            msg.className = 'msg error';
            return;
        }

        msg.textContent = 'Cadastrado com sucesso.';
        msg.className = 'msg success';
        document.getElementById(formId).reset();
        await carregarListaCadastro(table, tbodyId);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    await carregarCategoriasCadastro();
    await carregarCategoriaSelectVigencia();
    await carregarVigencias();
    await carregarListaCadastro('metodos_pagamento', 'met-rows');
    await carregarListaCadastro('cartoes', 'cart-rows');

    makeSortable('cat-rows');
    makeSortable('vig-rows');
    makeSortable('met-rows');
    makeSortable('cart-rows');

    document.getElementById('vig-tipo').addEventListener('change', atualizarCamposVigencia);
    document.getElementById('vig-periodicidade').addEventListener('change', atualizarCamposVigencia);
    atualizarCamposVigencia();

    document.getElementById('vigencia-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('vigencia-msg');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        const tipo = document.getElementById('vig-tipo').value;
        const periodicidade = document.getElementById('vig-periodicidade').value;
        const janela = document.getElementById('vig-janela').value;
        const valorRaw = document.getElementById('vig-valor').value;

        const payload = {
            categoria_codigo: document.getElementById('vig-categoria').value,
            vigencia_inicio: document.getElementById('vig-inicio').value,
            vigencia_fim: document.getElementById('vig-fim').value || null,
            valor_teto: valorRaw === '' ? null : parseFloat(valorRaw),
            observacao: document.getElementById('vig-observacao').value || null,
            tipo_teto: tipo === 'FIXA' ? 'MENSAL' : periodicidade,
            janela_acumulo: tipo === 'FIXA' ? null : (periodicidade === 'ANUAL' ? 'ANO_FOCO' : janela),
        };

        const { error } = await sb.from('metas').insert(payload);

        if (error) {
            msg.textContent = `Erro: ${error.message}`;
            msg.className = 'msg error';
            return;
        }

        msg.textContent = 'Vigência cadastrada.';
        msg.className = 'msg success';
        document.getElementById('vigencia-form').reset();
        atualizarCamposVigencia();
        await carregarVigencias();
    });

    document.getElementById('categoria-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('categoria-msg');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        const payload = {
            codigo: document.getElementById('cat-codigo').value.trim(),
            nome: document.getElementById('cat-nome').value.trim(),
            carater: document.getElementById('cat-carater').value,
        };

        const { error } = await sb.from('categorias').insert(payload);

        if (error) {
            msg.textContent = `Erro: ${error.message}`;
            msg.className = 'msg error';
            return;
        }

        msg.textContent = 'Categoria cadastrada.';
        msg.className = 'msg success';
        document.getElementById('categoria-form').reset();
        await carregarCategoriasCadastro();
        await carregarCategoriaSelectVigencia();
    });

    wireCadastroSimples('metodo-form', 'metodos_pagamento', 'met-nome', 'met-msg', 'met-rows');
    wireCadastroSimples('cartao-form', 'cartoes', 'cart-nome', 'cart-msg', 'cart-rows');
});
