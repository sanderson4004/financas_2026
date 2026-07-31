async function carregarCategorias() {
    const { data, error } = await sb
        .from('categorias')
        .select('codigo, nome')
        .eq('status', 'ATIVA')
        .order('codigo');

    if (error) {
        document.getElementById('categoria').innerHTML = `<option>Erro ao carregar categorias</option>`;
        return;
    }

    const opcoes = data.map(c => `<option value="${c.codigo}">${c.codigo} — ${c.nome}</option>`).join('');
    document.getElementById('categoria').innerHTML = opcoes;
    document.getElementById('f-categoria').innerHTML = '<option value="">Todas</option>' + opcoes;
}

async function carregarCartoes() {
    const { data, error } = await sb
        .from('cartoes')
        .select('nome')
        .eq('status', 'ATIVA')
        .order('nome');

    if (error) {
        document.getElementById('cartao').innerHTML = `<option>Erro ao carregar cartões</option>`;
        return;
    }

    const opcoes = data.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
    document.getElementById('cartao').innerHTML = opcoes;
    document.getElementById('f-cartao').innerHTML = '<option value="">Todos</option>' + opcoes;
    document.getElementById('fatura-cartao').innerHTML = opcoes;
}

function lerFiltrosCredito() {
    return {
        busca: document.getElementById('f-busca').value.trim(),
        cartao: document.getElementById('f-cartao').value,
        categoria: document.getElementById('f-categoria').value,
        dataDe: document.getElementById('f-data-de').value,
        dataAte: document.getElementById('f-data-ate').value,
        vencDe: document.getElementById('f-venc-de').value,
        vencAte: document.getElementById('f-venc-ate').value,
    };
}

function somarMeses(dataISO, n) {
    const [ano, mes, dia] = dataISO.split('-').map(Number);
    const d = new Date(Date.UTC(ano, mes - 1 + n, dia));
    return d.toISOString().slice(0, 10);
}

function formatarValorParcelas(parcelas, valorFallback) {
    if (!parcelas || parcelas.length === 0) return formatMoney(valorFallback);
    const valores = new Set(parcelas.map(p => Number(p.valor_parcela)));
    return valores.size <= 1 ? formatMoney(parcelas[0].valor_parcela) : 'valores variam';
}

function renderLinhaCompra(c, parcelas) {
    const pagas = parcelas.filter(p => p.pago).length;
    const valorTotal = parcelas.reduce((s, p) => s + Number(p.valor_parcela), 0);
    return `
        <tr id="compra-${c.id}">
            <td>${c.descricao}</td>
            <td>${c.cartao}</td>
            <td>${c.categorias ? pillCor(c.categorias.nome, c.categorias.cor) : (c.categoria_codigo || '—')}</td>
            <td class="num">${c.total_parcelas}x ${formatarValorParcelas(parcelas, c.valor_parcela)}</td>
            <td class="num">${formatMoney(valorTotal)}</td>
            <td class="num">${pagas}/${parcelas.length || c.total_parcelas}</td>
            <td>
                <div class="inline-update">
                    <button type="button" class="secondary" data-toggle-parcelas="${c.id}">Parcelas</button>
                    <button type="button" class="danger" data-excluir-compra="${c.id}">Excluir</button>
                </div>
            </td>
        </tr>
    `;
}

// O painel de parcelas abre num modal sobreposto (não mais dentro da
// <table> de compras nem no final da página) — só um fica aberto por vez.
let compraAberta = null;

function renderLinhaDetalhe(c, parcelas) {
    return `
        <div class="parcelas-panel" id="detalhe-${c.id}">
            <div>
                <span>Reajustar valor de um intervalo de parcelas</span>
                <button type="button" class="ajuda-toggle" data-ajuda="ajuda-valor-${c.id}" aria-expanded="false" aria-label="Ajuda">?</button>
            </div>
            <p class="msg hint ajuda-texto" id="ajuda-valor-${c.id}">Reajuste de assinatura ou correção de valor? Informe o intervalo de parcelas e o novo valor — dá pra aplicar num trecho (ex: 9 até 12) ou em todas de uma vez (1 até ${c.total_parcelas}). Pra mudar uma parcela só, use o mesmo número no início e no fim.</p>
            <form class="form-compacto parcelas-range-form" data-compra-id="${c.id}">
                <div class="campo-curto">
                    <label>Da parcela nº</label>
                    <input type="number" min="1" max="${c.total_parcelas}" value="1" class="range-de" required>
                </div>
                <div class="campo-curto">
                    <label>até a nº</label>
                    <input type="number" min="1" max="${c.total_parcelas}" value="${c.total_parcelas}" class="range-ate" required>
                </div>
                <div class="campo-valor">
                    <label>Novo valor (R$)</label>
                    <input type="number" step="0.01" class="range-valor" required>
                </div>
                <div>
                    <button type="submit" class="secondary">Aplicar</button>
                </div>
            </form>

            <div style="margin-top:18px">
                <span>Corrigir vencimento de um intervalo de parcelas</span>
                <button type="button" class="ajuda-toggle" data-ajuda="ajuda-data-${c.id}" aria-expanded="false" aria-label="Ajuda">?</button>
            </div>
            <p class="msg hint ajuda-texto" id="ajuda-data-${c.id}">Vencimento errado ou parcela reagendada? Informe o intervalo e a nova data da PRIMEIRA parcela do intervalo — as seguintes são recalculadas mantendo 1 mês de distância entre elas. Pra mudar uma parcela só, use o mesmo número no início e no fim.</p>
            <form class="form-compacto parcelas-data-form" data-compra-id="${c.id}">
                <div class="campo-curto">
                    <label>Da parcela nº</label>
                    <input type="number" min="1" max="${c.total_parcelas}" value="1" class="range-data-de" required>
                </div>
                <div class="campo-curto">
                    <label>até a nº</label>
                    <input type="number" min="1" max="${c.total_parcelas}" value="${c.total_parcelas}" class="range-data-ate" required>
                </div>
                <div class="campo-data">
                    <label>Novo vencimento (1ª do intervalo)</label>
                    <input type="date" class="range-data-valor" required>
                </div>
                <div>
                    <button type="submit" class="secondary">Aplicar</button>
                </div>
            </form>

            <div class="msg" id="parcelas-msg-${c.id}" aria-live="polite" style="margin-top:8px"></div>
            <div class="table-scroll" style="margin-top:12px">
                <table>
                    <thead>
                        <tr><th>Nº</th><th>Vencimento</th><th class="num">Valor</th><th>Situação</th></tr>
                    </thead>
                    <tbody>
                        ${parcelas.map(p => `
                            <tr>
                                <td>${p.numero_parcela}</td>
                                <td>${formatDate(p.data_vencimento)}</td>
                                <td class="num">${formatMoney(p.valor_parcela)}</td>
                                <td>${p.pago ? '<span class="pill status-ok">PAGA</span>' : '<span class="pill status-pending">EM ABERTO</span>'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function fecharModalParcelas() {
    const overlay = document.getElementById('parcelas-modal-overlay');
    if (overlay) overlay.remove();
    compraAberta = null;
}

async function abrirParcelas(compraId) {
    const { data: c } = await sb.from('compras_credito').select('*, categorias(nome, cor)').eq('id', compraId).single();
    const { data: parcelas } = await sb
        .from('parcelas_credito')
        .select('id, compra_id, numero_parcela, data_vencimento, valor_parcela, pago')
        .eq('compra_id', compraId)
        .order('numero_parcela');

    fecharModalParcelas();
    compraAberta = compraId;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'parcelas-modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box modal-box-lg">
            <div class="modal-header">
                <h3>Parcelas — ${c.descricao}</h3>
                <button type="button" class="modal-fechar" aria-label="Fechar">×</button>
            </div>
            ${renderLinhaDetalhe(c, parcelas || [])}
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) fecharModalParcelas();
    });
    overlay.querySelector('.modal-fechar').addEventListener('click', fecharModalParcelas);
}

async function carregarCompras() {
    const tbody = document.getElementById('rows');
    const info = document.getElementById('rows-info');
    tbody.innerHTML = carregandoLinhaHTML(7);

    const f = lerFiltrosCredito();
    let idsFiltroVencimento = null;

    if (f.vencDe || f.vencAte) {
        let queryParcelas = sb.from('parcelas_credito').select('compra_id');
        if (f.vencDe) queryParcelas = queryParcelas.gte('data_vencimento', f.vencDe);
        if (f.vencAte) queryParcelas = queryParcelas.lte('data_vencimento', f.vencAte);

        const { data: parcelasNoIntervalo, error: errVenc } = await queryParcelas;
        if (errVenc) {
            renderErroLinha(tbody, 7, errVenc.message, carregarCompras);
            info.textContent = '';
            return;
        }

        const idsComVencimento = [...new Set((parcelasNoIntervalo || []).map(p => p.compra_id))];
        if (idsComVencimento.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7">${estadoVazioHTML('Nenhuma parcela vence nesse período.', '📅')}</td></tr>`;
            info.textContent = '';
            return;
        }
        idsFiltroVencimento = idsComVencimento;
    }

    let query = sb.from('compras_credito').select('*, categorias(nome, cor)').order('id', { ascending: false });

    if (f.busca) query = query.ilike('descricao', `%${f.busca}%`);
    if (f.cartao) query = query.eq('cartao', f.cartao);
    if (f.categoria) query = query.eq('categoria_codigo', f.categoria);
    if (f.dataDe) query = query.gte('data_compra', f.dataDe);
    if (f.dataAte) query = query.lte('data_compra', f.dataAte);
    if (idsFiltroVencimento) query = query.in('id', idsFiltroVencimento);

    const { data: compras, error } = await query;

    if (error) {
        renderErroLinha(tbody, 7, error.message, carregarCompras);
        info.textContent = '';
        return;
    }

    if (compras.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7">${estadoVazioHTML('Nenhuma compra encontrada. Lance a primeira acima.', '💳')}</td></tr>`;
        info.textContent = '';
        return;
    }

    info.textContent = `${compras.length} compra(s) encontrada(s).`;

    const ids = compras.map(c => c.id);
    const { data: parcelas } = await sb
        .from('parcelas_credito')
        .select('id, compra_id, numero_parcela, data_vencimento, valor_parcela, pago')
        .in('compra_id', ids)
        .order('numero_parcela');

    const porCompra = {};
    for (const p of (parcelas || [])) {
        if (!porCompra[p.compra_id]) porCompra[p.compra_id] = [];
        porCompra[p.compra_id].push(p);
    }

    tbody.innerHTML = compras.map(c => renderLinhaCompra(c, porCompra[c.id] || [])).join('');

    if (compraAberta && !ids.includes(compraAberta)) {
        fecharModalParcelas();
    }
}

async function atualizarLinhaCompra(compraId, manterAberta, mensagemSucesso) {
    const { data: c } = await sb.from('compras_credito').select('*, categorias(nome, cor)').eq('id', compraId).single();
    const { data: parcelas } = await sb
        .from('parcelas_credito')
        .select('id, compra_id, numero_parcela, data_vencimento, valor_parcela, pago')
        .eq('compra_id', compraId)
        .order('numero_parcela');

    document.getElementById(`compra-${compraId}`).outerHTML = renderLinhaCompra(c, parcelas || []);

    if (manterAberta) {
        document.getElementById(`detalhe-${compraId}`).outerHTML = renderLinhaDetalhe(c, parcelas || []);
    }

    if (manterAberta && mensagemSucesso) {
        const msg = document.getElementById(`parcelas-msg-${compraId}`);
        msg.textContent = mensagemSucesso;
        msg.className = 'msg success';
    }
}

async function carregarFaturasFechadas() {
    const tbody = document.getElementById('fatura-rows');
    const { data, error } = await sb
        .from('fechamentos_fatura')
        .select('id, cartao, data_fechamento, valor_total, lancamento_fluxo_id')
        .order('data_fechamento', { ascending: false });

    if (error) {
        renderErroLinha(tbody, 4, error.message, carregarFaturasFechadas);
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4">${estadoVazioHTML('Nenhuma fatura fechada ainda.', '🧾')}</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(f => `
        <tr>
            <td>${f.cartao}</td>
            <td>${formatDate(f.data_fechamento)}</td>
            <td class="num">${formatMoney(f.valor_total)}</td>
            <td><button type="button" class="danger" data-estornar-fatura="${f.lancamento_fluxo_id}">Estornar</button></td>
        </tr>
    `).join('');
}

async function consultarFaturaAberta() {
    const cartao = document.getElementById('fatura-cartao').value;
    const dataFechamento = document.getElementById('fatura-data').value;
    const preview = document.getElementById('fatura-preview');
    const wrapConfirmar = document.getElementById('fatura-confirmar-wrap');
    wrapConfirmar.style.display = 'none';

    if (!cartao || !dataFechamento) {
        preview.textContent = 'Escolha o cartão e a data de fechamento.';
        preview.className = 'msg error';
        return;
    }

    preview.textContent = 'Consultando...';
    preview.className = 'msg';

    const { data, error } = await sb
        .from('credito_resolvido')
        .select('parcela_id, valor_parcela')
        .eq('cartao', cartao)
        .eq('pago', false)
        .lte('data_vencimento', dataFechamento);

    if (error) {
        preview.textContent = `Erro: ${error.message}`;
        preview.className = 'msg error';
        return;
    }

    if (!data || data.length === 0) {
        preview.textContent = 'Nenhuma parcela em aberto para esse cartão até essa data.';
        preview.className = 'msg';
        return;
    }

    const total = data.reduce((s, p) => s + Number(p.valor_parcela), 0);
    preview.innerHTML = `${data.length} parcela(s) em aberto, totalizando <strong style="color:var(--text)">${formatMoney(total)}</strong> — esse valor será debitado do Saldo Nubank.`;
    preview.className = 'msg';
    wrapConfirmar.style.display = 'block';
    wrapConfirmar.dataset.cartao = cartao;
    wrapConfirmar.dataset.data = dataFechamento;
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    await carregarCategorias();
    await carregarCartoes();
    await carregarCompras();
    await carregarFaturasFechadas();
    makeSortable('rows');

    document.addEventListener('click', (e) => {
        const ajudaBtn = e.target.closest('button.ajuda-toggle');
        if (!ajudaBtn) return;
        const texto = document.getElementById(ajudaBtn.getAttribute('data-ajuda'));
        const aberta = texto.classList.toggle('aberta');
        ajudaBtn.setAttribute('aria-expanded', aberta ? 'true' : 'false');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('parcelas-modal-overlay')) {
            fecharModalParcelas();
        }
    });

    document.getElementById('fatura-consultar').addEventListener('click', consultarFaturaAberta);

    document.getElementById('fatura-confirmar').addEventListener('click', async (e) => {
        const btn = e.target;
        const wrapConfirmar = document.getElementById('fatura-confirmar-wrap');
        const msg = document.getElementById('fatura-msg');
        const cartao = wrapConfirmar.dataset.cartao;
        const dataFechamento = wrapConfirmar.dataset.data;

        const ok = await confirmarAcao(`Fechar a fatura de "${cartao}" com vencimento até ${formatDate(dataFechamento)}? Isso vai debitar o valor do Saldo Nubank em Fluxo.`, 'Sim, fechar fatura');
        if (!ok) return;

        msg.textContent = 'Fechando fatura...';
        msg.className = 'msg';

        await comBotaoOcupado(btn, async () => {
            const { data, error } = await sb.rpc('fechar_fatura_cartao', {
                p_cartao: cartao,
                p_data_fechamento: dataFechamento,
            });

            if (error) {
                msg.textContent = `Erro: ${error.message}`;
                msg.className = 'msg error';
                return;
            }

            msg.textContent = `Fatura fechada: ${formatMoney(data.valor_total)} debitados do Saldo Nubank.`;
            msg.className = 'msg success';
            wrapConfirmar.style.display = 'none';
            document.getElementById('fatura-preview').textContent = '';
            await carregarCompras();
            await carregarFaturasFechadas();
            toast('Fatura fechada e abatida do Saldo Nubank.');
        });
    });

    document.getElementById('fatura-rows').addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-estornar-fatura]');
        if (!btn) return;

        const lancamentoId = btn.getAttribute('data-estornar-fatura');
        const ok = await confirmarAcao('Estornar este fechamento de fatura? As parcelas cobertas voltam a "em aberto" e o débito no Fluxo é desfeito.', 'Sim, estornar');
        if (!ok) return;

        await comBotaoOcupado(btn, async () => {
            const { error } = await sb.from('lancamentos_fluxo').delete().eq('id', lancamentoId);
            if (error) {
                alert(`Erro ao estornar: ${error.message}`);
                return;
            }
            await carregarCompras();
            await carregarFaturasFechadas();
            toast('Fechamento estornado.');
        });
    });

    document.getElementById('filtro-form').addEventListener('submit', (e) => {
        e.preventDefault();
        carregarCompras();
    });

    document.getElementById('f-limpar').addEventListener('click', () => {
        document.getElementById('filtro-form').reset();
        carregarCompras();
    });

    const tbody = document.getElementById('rows');

    tbody.addEventListener('click', async (e) => {
        const toggleBtn = e.target.closest('button[data-toggle-parcelas]');
        if (toggleBtn) {
            await abrirParcelas(parseInt(toggleBtn.getAttribute('data-toggle-parcelas'), 10));
            return;
        }

        const delBtn = e.target.closest('button[data-excluir-compra]');
        if (delBtn) {
            const id = delBtn.getAttribute('data-excluir-compra');
            const ok = await confirmarAcao('Tem certeza que deseja excluir esta compra e todas as suas parcelas? Essa ação não pode ser desfeita.');
            if (!ok) return;

            await comBotaoOcupado(delBtn, async () => {
                const { error } = await sb.from('compras_credito').delete().eq('id', id);
                if (error) {
                    alert(`Erro ao excluir: ${error.message}`);
                    return;
                }
                await carregarCompras();
                toast('Compra excluída.');
            });
        }
    });

    document.addEventListener('submit', async (e) => {
        const form = e.target.closest('form.parcelas-range-form');
        if (!form) return;
        e.preventDefault();

        const compraId = form.getAttribute('data-compra-id');
        const de = parseInt(form.querySelector('.range-de').value, 10);
        const ate = parseInt(form.querySelector('.range-ate').value, 10);
        const novoValor = parseFloat(form.querySelector('.range-valor').value);
        const msg = document.getElementById(`parcelas-msg-${compraId}`);
        const btn = form.querySelector('button[type="submit"]');

        if (!de || !ate || de > ate || isNaN(novoValor)) {
            msg.textContent = 'Preencha um intervalo válido (nº inicial ≤ nº final) e o novo valor.';
            msg.className = 'msg error';
            return;
        }

        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        await comBotaoOcupado(btn, async () => {
            const { error } = await sb
                .from('parcelas_credito')
                .update({ valor_parcela: novoValor })
                .eq('compra_id', compraId)
                .gte('numero_parcela', de)
                .lte('numero_parcela', ate);

            if (error) {
                msg.textContent = `Erro: ${error.message}`;
                msg.className = 'msg error';
                return;
            }

            await atualizarLinhaCompra(compraId, true, `Parcelas ${de} a ${ate} atualizadas para ${formatMoney(novoValor)}.`);
            toast('Parcelas atualizadas.');
        });
    });

    document.addEventListener('submit', async (e) => {
        const form = e.target.closest('form.parcelas-data-form');
        if (!form) return;
        e.preventDefault();

        const compraId = form.getAttribute('data-compra-id');
        const de = parseInt(form.querySelector('.range-data-de').value, 10);
        const ate = parseInt(form.querySelector('.range-data-ate').value, 10);
        const novaData = form.querySelector('.range-data-valor').value;
        const msg = document.getElementById(`parcelas-msg-${compraId}`);
        const btn = form.querySelector('button[type="submit"]');

        if (!de || !ate || de > ate || !novaData) {
            msg.textContent = 'Preencha um intervalo válido (nº inicial ≤ nº final) e a nova data.';
            msg.className = 'msg error';
            return;
        }

        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        await comBotaoOcupado(btn, async () => {
            const atualizacoes = [];
            for (let n = de; n <= ate; n++) {
                atualizacoes.push(
                    sb.from('parcelas_credito')
                        .update({ data_vencimento: somarMeses(novaData, n - de) })
                        .eq('compra_id', compraId)
                        .eq('numero_parcela', n)
                );
            }
            const resultados = await Promise.all(atualizacoes);
            const erro = resultados.find(r => r.error);

            if (erro) {
                msg.textContent = `Erro: ${erro.error.message}`;
                msg.className = 'msg error';
                return;
            }

            await atualizarLinhaCompra(compraId, true, `Vencimento das parcelas ${de} a ${ate} atualizado.`);
            toast('Vencimento das parcelas atualizado.');
        });
    });

    document.getElementById('credito-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('msg');
        const btn = e.target.querySelector('button[type="submit"]');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';
        await comBotaoOcupado(btn, () => salvarNovaCompra(msg));
    });

    async function salvarNovaCompra(msg) {
        const totalParcelas = parseInt(document.getElementById('total_parcelas').value, 10);
        const valorParcela = parseFloat(document.getElementById('valor_parcela').value);
        const dataPrimeiroVencimento = document.getElementById('data_primeiro_vencimento').value;

        const compraPayload = {
            descricao: document.getElementById('descricao').value,
            cartao: document.getElementById('cartao').value,
            categoria_codigo: document.getElementById('categoria').value,
            data_compra: document.getElementById('data_compra').value,
            historico_sem_data: false,
            total_parcelas: totalParcelas,
            valor_parcela: valorParcela,
        };

        const { data: compra, error: errCompra } = await sb
            .from('compras_credito')
            .insert(compraPayload)
            .select()
            .single();

        if (errCompra) {
            msg.textContent = `Erro ao salvar a compra: ${errCompra.message}`;
            msg.className = 'msg error';
            return;
        }

        const parcelas = [];
        for (let n = 1; n <= totalParcelas; n++) {
            parcelas.push({
                compra_id: compra.id,
                numero_parcela: n,
                data_vencimento: somarMeses(dataPrimeiroVencimento, n - 1),
                categoria_codigo: compraPayload.categoria_codigo,
                valor_parcela: valorParcela,
            });
        }

        const { error: errParcelas } = await sb.from('parcelas_credito').insert(parcelas);

        if (errParcelas) {
            msg.textContent = `Compra salva, mas houve erro ao gerar as parcelas: ${errParcelas.message}`;
            msg.className = 'msg error';
            await carregarCompras();
            return;
        }

        msg.textContent = `Compra salva com ${totalParcelas} parcela(s).`;
        msg.className = 'msg success';
        document.getElementById('credito-form').reset();
        document.getElementById('total_parcelas').value = 1;
        await carregarCompras();
        toast(`Compra salva com ${totalParcelas} parcela(s).`);
    }
});
