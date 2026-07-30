async function carregarCategoriasCadastro() {
    const tbody = document.getElementById('cat-rows');
    tbody.innerHTML = carregandoLinhaHTML(6);

    const { data, error } = await sb.from('categorias').select('*').order('codigo');

    if (error) {
        renderErroLinha(tbody, 6, error.message, carregarCategoriasCadastro);
        return;
    }

    tbody.innerHTML = data.map(c => `
        <tr>
            <td>${c.codigo}</td>
            <td>${c.nome}</td>
            <td>${caraterPill(c.carater)}</td>
            <td><input type="color" id="cat-cor-${c.codigo.replace(/[^a-zA-Z0-9]/g, '')}" value="${c.cor || '#64748b'}"></td>
            <td><span class="pill ${c.status === 'ATIVA' ? 'status-ok' : 'status-pending'}">${c.status}</span></td>
            <td><button type="button" class="secondary" data-cor-categoria="${c.codigo}">Salvar cor</button></td>
        </tr>
    `).join('');

    tbody.querySelectorAll('button[data-cor-categoria]').forEach(btn => {
        btn.addEventListener('click', async () => {
            await comBotaoOcupado(btn, async () => {
                const codigo = btn.getAttribute('data-cor-categoria');
                const inputId = `cat-cor-${codigo.replace(/[^a-zA-Z0-9]/g, '')}`;
                const cor = document.getElementById(inputId).value;
                const { error: errCor } = await sb.from('categorias').update({ cor }).eq('codigo', codigo);
                if (errCor) {
                    alert(`Erro ao salvar cor: ${errCor.message}`);
                    return;
                }
                await carregarCategoriasCadastro();
            });
        });
    });
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
    tbody.innerHTML = carregandoLinhaHTML(8);

    const { data, error } = await sb
        .from('metas')
        .select('*, categorias(nome)')
        .order('categoria_codigo')
        .order('vigencia_inicio', { ascending: false });

    if (error) {
        renderErroLinha(tbody, 8, error.message, carregarVigencias);
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
        <tr id="vig-linha-${m.id}">
            <td>${m.categoria_codigo} — ${m.categorias ? m.categorias.nome : ''}</td>
            <td>${STATUS_LABEL_TIPO[m.tipo_teto] || m.tipo_teto}</td>
            <td>${m.janela_acumulo ? (STATUS_LABEL_JANELA[m.janela_acumulo] || m.janela_acumulo) : '—'}</td>
            <td class="num">${m.valor_teto === null ? 'auto (Reserva)' : formatMoney(m.valor_teto)}</td>
            <td><input type="date" id="inicio-${m.id}" value="${m.vigencia_inicio}"></td>
            <td><input type="date" id="fim-${m.id}" value="${m.vigencia_fim || ''}"></td>
            <td id="status-${m.id}"><span class="pill ${vigente ? 'status-ok' : 'status-pending'}">${vigente ? 'VIGENTE' : 'ENCERRADA'}</span></td>
            <td>
                <div class="inline-update">
                    <button type="button" class="secondary" data-limpar="${m.id}" title="Limpar data fim (deixa em aberto)">Limpar fim</button>
                    <button type="button" data-salvar="${m.id}">Salvar</button>
                </div>
            </td>
        </tr>
    `;
    }).join('');

    tbody.querySelectorAll('input[type="date"]').forEach(input => {
        input.addEventListener('change', () => {
            const id = input.id.split('-').pop();
            const fim = document.getElementById(`fim-${id}`).value;
            const vigente = !fim || fim >= hoje;
            document.getElementById(`status-${id}`).innerHTML =
                `<span class="pill ${vigente ? 'status-ok' : 'status-pending'}">${vigente ? 'VIGENTE' : 'ENCERRADA'}</span>`;
        });
    });

    tbody.querySelectorAll('button[data-limpar]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-limpar');
            document.getElementById(`fim-${id}`).value = '';
            document.getElementById(`status-${id}`).innerHTML = '<span class="pill status-ok">VIGENTE</span>';
        });
    });

    tbody.querySelectorAll('button[data-salvar]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-salvar');
            const inicio = document.getElementById(`inicio-${id}`).value;
            const fim = document.getElementById(`fim-${id}`).value;

            if (!inicio) { alert('Data de início é obrigatória.'); return; }
            if (fim && fim < inicio) { alert('A data fim não pode ser anterior à data início.'); return; }

            await comBotaoOcupado(btn, async () => {
                const { error } = await sb.from('metas').update({
                    vigencia_inicio: inicio,
                    vigencia_fim: fim || null,
                }).eq('id', id);

                if (error) {
                    alert(`Erro ao salvar: ${error.message}`);
                    return;
                }
                await carregarVigencias();
            });
        });
    });
}

function atualizarCamposVigencia() {
    const tipo = document.getElementById('vig-tipo').value;
    const periodicidade = document.getElementById('vig-periodicidade').value;

    document.getElementById('vig-periodicidade-wrap').style.display = tipo === 'VARIAVEL' ? 'flex' : 'none';
    document.getElementById('vig-janela-wrap').style.display = (tipo === 'VARIAVEL' && periodicidade === 'OUTRO_DELIMITADO') ? 'block' : 'none';
}

async function carregarListaCadastro(table, tbodyId, temCor) {
    const tbody = document.getElementById(tbodyId);
    const colspan = temCor ? 4 : 3;
    tbody.innerHTML = carregandoLinhaHTML(colspan);

    const { data, error } = await sb.from(table).select('*').order('nome');

    if (error) {
        renderErroLinha(tbody, colspan, error.message, () => carregarListaCadastro(table, tbodyId, temCor));
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colspan}"><div class="empty-state">Nada cadastrado ainda.</div></td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(r => {
        const idSeguro = r.nome.replace(/[^a-zA-Z0-9]/g, '');
        return `
        <tr>
            <td>${r.nome}</td>
            ${temCor ? `<td><input type="color" id="cor-${table}-${idSeguro}" value="${r.cor || '#64748b'}"></td>` : ''}
            <td><span class="pill ${r.status === 'ATIVA' ? 'status-ok' : 'status-bad'}">${r.status}</span></td>
            <td>
                <div class="inline-update">
                    ${temCor ? `<button type="button" class="secondary" data-cor-nome="${r.nome.replace(/"/g, '&quot;')}">Salvar cor</button>` : ''}
                    <button type="button" class="secondary" data-nome="${r.nome.replace(/"/g, '&quot;')}" data-status="${r.status}">${r.status === 'ATIVA' ? 'Desativar' : 'Reativar'}</button>
                </div>
            </td>
        </tr>
    `;
    }).join('');

    tbody.querySelectorAll('button[data-nome]').forEach(btn => {
        btn.addEventListener('click', async () => {
            await comBotaoOcupado(btn, async () => {
                const novoStatus = btn.getAttribute('data-status') === 'ATIVA' ? 'INATIVA' : 'ATIVA';
                const { error } = await sb.from(table).update({ status: novoStatus }).eq('nome', btn.getAttribute('data-nome'));
                if (error) {
                    alert(`Erro ao atualizar: ${error.message}`);
                    return;
                }
                await carregarListaCadastro(table, tbodyId, temCor);
            });
        });
    });

    if (temCor) {
        tbody.querySelectorAll('button[data-cor-nome]').forEach(btn => {
            btn.addEventListener('click', async () => {
                await comBotaoOcupado(btn, async () => {
                    const nome = btn.getAttribute('data-cor-nome');
                    const idSeguro = nome.replace(/[^a-zA-Z0-9]/g, '');
                    const cor = document.getElementById(`cor-${table}-${idSeguro}`).value;
                    const { error } = await sb.from(table).update({ cor }).eq('nome', nome);
                    if (error) {
                        alert(`Erro ao salvar cor: ${error.message}`);
                        return;
                    }
                    await carregarListaCadastro(table, tbodyId, temCor);
                });
            });
        });
    }
}

function wireCadastroSimples(formId, table, inputId, msgId, tbodyId, corInputId) {
    document.getElementById(formId).addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById(msgId);
        const btn = e.target.querySelector('button[type="submit"]');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        await comBotaoOcupado(btn, async () => {
            const nome = document.getElementById(inputId).value.trim();
            const payload = { nome };
            if (corInputId) payload.cor = document.getElementById(corInputId).value;

            const { error } = await sb.from(table).insert(payload);

            if (error) {
                msg.textContent = `Erro: ${error.message}`;
                msg.className = 'msg error';
                return;
            }

            msg.textContent = 'Cadastrado com sucesso.';
            msg.className = 'msg success';
            document.getElementById(formId).reset();
            await carregarListaCadastro(table, tbodyId, !!corInputId);
        });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    await carregarCategoriasCadastro();
    await carregarCategoriaSelectVigencia();
    await carregarVigencias();
    await carregarListaCadastro('metodos_pagamento', 'met-rows', true);
    await carregarListaCadastro('cartoes', 'cart-rows', false);

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
        const btn = e.target.querySelector('button[type="submit"]');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        await comBotaoOcupado(btn, async () => {
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
    });

    document.getElementById('categoria-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('categoria-msg');
        const btn = e.target.querySelector('button[type="submit"]');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        await comBotaoOcupado(btn, async () => {
            const payload = {
                codigo: document.getElementById('cat-codigo').value.trim(),
                nome: document.getElementById('cat-nome').value.trim(),
                carater: document.getElementById('cat-carater').value,
                cor: document.getElementById('cat-cor').value,
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
    });

    wireCadastroSimples('metodo-form', 'metodos_pagamento', 'met-nome', 'met-msg', 'met-rows', 'met-cor');
    wireCadastroSimples('cartao-form', 'cartoes', 'cart-nome', 'cart-msg', 'cart-rows');
});
