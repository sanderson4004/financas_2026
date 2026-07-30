let coresMetodosCache = {};

const LABEL_SALDO_METODO = {
    'Pix': 'Saldo Nubank',
    'Dinheiro': 'Saldo Dinheiro Carteira',
};

async function carregarSaldos() {
    const el = document.getElementById('saldo-metodos');
    const { data, error } = await sb.from('fluxo_saldo_por_metodo').select('*');

    if (error) {
        renderErro(el, error.message, carregarSaldos);
        return;
    }

    if (!data || data.length === 0) {
        el.innerHTML = estadoVazioHTML('Nenhum lançamento ainda. Lance o primeiro no formulário abaixo.', '💸');
        return;
    }

    el.innerHTML = data.map(s => `
        <div class="stat" style="--tint: ${Number(s.saldo) < 0 ? 'var(--bad)' : 'var(--ok)'}">
            <div class="label">${LABEL_SALDO_METODO[s.metodo] || s.metodo}</div>
            <div class="value">${formatMoney(s.saldo)}</div>
        </div>
    `).join('');
}

async function carregarCategorias() {
    const opcoes = await buscarCategoriasAtivas();
    document.getElementById('categoria').innerHTML = opcoes;
    document.getElementById('f-categoria').innerHTML = '<option value="">Todas</option>' + opcoes;
}

async function buscarCategoriasAtivas() {
    const { data, error } = await sb
        .from('categorias')
        .select('codigo, nome')
        .eq('status', 'ATIVA')
        .order('codigo');

    if (error) return `<option>Erro ao carregar categorias</option>`;
    return data.map(c => `<option value="${c.codigo}">${c.codigo} — ${c.nome}</option>`).join('');
}

async function carregarMetodos() {
    const { data, error } = await sb
        .from('metodos_pagamento')
        .select('nome')
        .eq('status', 'ATIVA')
        .order('nome');

    if (error) {
        document.getElementById('metodo').innerHTML = `<option>Erro ao carregar métodos</option>`;
        return;
    }

    const opcoes = data.map(m => `<option value="${m.nome}">${m.nome}</option>`).join('');
    document.getElementById('metodo').innerHTML = opcoes;
    document.getElementById('f-metodo').innerHTML = '<option value="">Todos</option>' + opcoes;
}

function lerFiltros() {
    return {
        busca: document.getElementById('f-busca').value.trim(),
        carater: document.getElementById('f-carater').value,
        categoria: document.getElementById('f-categoria').value,
        metodo: document.getElementById('f-metodo').value,
        dataDe: document.getElementById('f-data-de').value,
        dataAte: document.getElementById('f-data-ate').value,
    };
}

async function carregarLancamentos() {
    const tbody = document.getElementById('rows');
    const info = document.getElementById('rows-info');
    tbody.innerHTML = carregandoLinhaHTML(7);

    if (Object.keys(coresMetodosCache).length === 0) {
        coresMetodosCache = await buscarMapaCoresMetodos();
    }

    const f = lerFiltros();
    let query = sb.from('lancamentos_fluxo').select('*, categorias(nome, cor)').order('id', { ascending: false });

    if (f.busca) query = query.ilike('descricao', `%${f.busca}%`);
    if (f.carater) query = query.eq('carater', f.carater);
    if (f.categoria) query = query.eq('categoria_codigo', f.categoria);
    if (f.metodo) query = query.eq('metodo', f.metodo);
    if (f.dataDe) query = query.gte('data_movimento', f.dataDe);
    if (f.dataAte) query = query.lte('data_movimento', f.dataAte);

    const { data, error } = await query;

    if (error) {
        renderErroLinha(tbody, 7, error.message, carregarLancamentos);
        info.textContent = '';
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7">${estadoVazioHTML('Nenhum lançamento encontrado com esses filtros.', '🔎')}</td></tr>`;
        info.textContent = '';
        return;
    }

    info.textContent = `${data.length} lançamento(s) encontrado(s).`;

    tbody.innerHTML = data.map(r => `
        <tr>
            <td>${formatDate(r.data_movimento || r.data_pagamento)}</td>
            <td>${caraterPill(r.carater)}</td>
            <td>${r.categorias ? pillCor(r.categorias.nome, r.categorias.cor) : r.categoria_codigo}</td>
            <td>${pillCor(r.metodo, coresMetodosCache[r.metodo])}</td>
            <td>${r.descricao || ''}</td>
            <td class="num">${formatMoney(r.valor)}</td>
            <td><button type="button" class="danger" data-id="${r.id}">Excluir</button></td>
        </tr>
    `).join('');

    tbody.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const ok = await confirmarAcao('Tem certeza que deseja excluir este lançamento?');
            if (!ok) return;

            await comBotaoOcupado(btn, async () => {
                const { error: errDel } = await sb.from('lancamentos_fluxo').delete().eq('id', btn.getAttribute('data-id'));
                if (errDel) {
                    alert(`Erro ao excluir: ${errDel.message}`);
                    return;
                }
                await carregarLancamentos();
                await carregarSaldos();
                toast('Lançamento excluído.');
            });
        });
    });
}

function ajustarSinalValor(carater, valor) {
    if (isNaN(valor)) return valor;
    return carater === 'DESPESA' ? -Math.abs(valor) : Math.abs(valor);
}

function atualizarDicaValor() {
    const carater = document.getElementById('carater').value;
    const dica = document.getElementById('valor-dica');
    dica.textContent = carater === 'DESPESA'
        ? 'Despesas são sempre salvas como valor negativo — digite só o número, o sinal é automático.'
        : 'Salvo como valor positivo — digite só o número, o sinal é automático.';
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    await carregarCategorias();
    await carregarMetodos();
    await carregarSaldos();
    await carregarLancamentos();
    makeSortable('rows');

    atualizarDicaValor();
    document.getElementById('carater').addEventListener('change', atualizarDicaValor);

    document.getElementById('filtro-form').addEventListener('submit', (e) => {
        e.preventDefault();
        carregarLancamentos();
    });

    document.getElementById('f-limpar').addEventListener('click', () => {
        document.getElementById('filtro-form').reset();
        carregarLancamentos();
    });

    document.getElementById('fluxo-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('msg');
        const btn = e.target.querySelector('button[type="submit"]');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        await comBotaoOcupado(btn, async () => {
            const carater = document.getElementById('carater').value;

            const payload = {
                carater,
                valor: ajustarSinalValor(carater, parseFloat(document.getElementById('valor').value)),
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
            await carregarSaldos();
            toast('Lançamento salvo.');
        });
    });
});
