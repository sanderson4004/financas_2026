const LABEL_RECORRENCIA = { MENSAL: 'Mensal', UNICO: 'Evento único' };

let itensAtuais = [];

function atualizarCamposItem() {
    const recorrencia = document.getElementById('it-recorrencia').value;
    document.getElementById('label-data-inicio').textContent = recorrencia === 'MENSAL' ? 'Início (mês)' : 'Data do evento (mês)';
    document.getElementById('wrap-data-fim').style.display = recorrencia === 'MENSAL' ? 'block' : 'none';
    document.getElementById('wrap-rendimento').style.display = recorrencia === 'UNICO' ? 'flex' : 'none';
    atualizarDuracaoPreview();
}

function mesesEntre(mesInicio, mesFim) {
    const [ai, mi] = mesInicio.split('-').map(Number);
    const [af, mf] = mesFim.split('-').map(Number);
    return (af - ai) * 12 + (mf - mi) + 1;
}

function atualizarDuracaoPreview() {
    const preview = document.getElementById('duracao-preview');
    const recorrencia = document.getElementById('it-recorrencia').value;
    const inicio = document.getElementById('it-data-inicio').value;
    const fim = document.getElementById('it-data-fim').value;

    if (recorrencia !== 'MENSAL' || !inicio || !fim) {
        preview.textContent = '';
        return;
    }

    const n = mesesEntre(inicio, fim);
    preview.textContent = n > 0 ? `Esse período dura ${n} mês(es).` : 'Data fim precisa ser depois da data início.';
    preview.className = n > 0 ? 'msg' : 'msg error';
}

function formatarMesLabel(dataObj) {
    const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
    const ano = String(dataObj.getFullYear()).slice(2);
    return `${mes}/${ano}`;
}

function calcularSerieProjecao(itens, saldoInicial, mesInicioSim, mesFimSim) {
    const pontos = [];
    let cursor = new Date(`${mesInicioSim}-01T00:00:00`);
    const fimSim = new Date(`${mesFimSim}-01T00:00:00`);

    while (cursor <= fimSim) {
        let saldo = Number(saldoInicial);

        for (const item of itens) {
            const inicio = new Date(`${item.data_inicio}T00:00:00`);
            if (cursor < inicio) continue;

            const sinal = item.carater === 'RECEITA' ? 1 : -1;

            if (item.recorrencia === 'MENSAL') {
                const fimItem = item.data_fim ? new Date(`${item.data_fim}T00:00:00`) : null;
                const referencia = (fimItem && fimItem < cursor) ? fimItem : cursor;
                const mesesAtivos = (referencia.getFullYear() - inicio.getFullYear()) * 12 + (referencia.getMonth() - inicio.getMonth()) + 1;
                if (mesesAtivos > 0) saldo += sinal * Number(item.valor) * mesesAtivos;
            } else {
                let valorAtual = Number(item.valor);
                if (item.taxa_rendimento_anual && item.meses_rendendo) {
                    const mesesDesdeInicio = (cursor.getFullYear() - inicio.getFullYear()) * 12 + (cursor.getMonth() - inicio.getMonth());
                    const mesesRendendo = Math.min(mesesDesdeInicio, item.meses_rendendo);
                    valorAtual = valorAtual * Math.pow(Number(item.taxa_rendimento_anual), mesesRendendo / 12);
                }
                saldo += sinal * valorAtual;
            }
        }

        pontos.push({ label: formatarMesLabel(cursor), valor: saldo });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    return pontos;
}

function renderGraficoProjecao(containerId, pontos) {
    const el = document.getElementById(containerId);

    if (pontos.length < 2) {
        el.innerHTML = '<div class="empty-state">Ajuste o período da simulação (início/fim) pra ver o gráfico.</div>';
        return;
    }

    const w = 900, h = 260, padding = 44;
    const valores = pontos.map(p => p.valor);
    const min = Math.min(...valores, 0);
    const max = Math.max(...valores);
    const range = (max - min) || 1;
    const passoX = (w - padding * 2) / (pontos.length - 1);
    const mostrarRotulo = (i) => pontos.length <= 18 || i % Math.ceil(pontos.length / 18) === 0;

    const coords = pontos.map((p, i) => ({
        x: padding + i * passoX,
        y: h - padding - ((p.valor - min) / range) * (h - padding * 2),
        ...p,
    }));

    const yZero = h - padding - ((0 - min) / range) * (h - padding * 2);
    const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${h - padding} L ${coords[0].x.toFixed(1)} ${h - padding} Z`;

    el.innerHTML = `
        <div class="table-scroll">
        <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:auto; min-width:640px; max-height:280px;">
            <defs>
                <linearGradient id="grad-projecao" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35"/>
                    <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <line x1="${padding}" y1="${yZero.toFixed(1)}" x2="${w - padding}" y2="${yZero.toFixed(1)}" stroke="var(--border)" stroke-dasharray="4 4"></line>
            <path d="${areaD}" fill="url(#grad-projecao)" stroke="none"></path>
            <path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="2.5"></path>
            ${coords.map(c => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3.5" fill="var(--accent)"><title>${c.label}: ${formatMoney(c.valor)}</title></circle>`).join('')}
            ${coords.map((c, i) => mostrarRotulo(i) ? `<text x="${c.x.toFixed(1)}" y="${h - 12}" font-size="10" fill="var(--text-faint)" text-anchor="middle">${c.label}</text>` : '').join('')}
        </svg>
        </div>
        <p class="msg" style="margin-top:8px">Saldo final projetado (${pontos[pontos.length - 1].label}): <strong style="color:var(--text)">${formatMoney(pontos[pontos.length - 1].valor)}</strong></p>
    `;
}

function recalcular() {
    const saldoInicial = parseFloat(document.getElementById('saldo-inicial').value) || 0;
    const simInicio = document.getElementById('sim-inicio').value;
    const simFim = document.getElementById('sim-fim').value;
    if (!simInicio || !simFim) return;

    const pontos = calcularSerieProjecao(itensAtuais, saldoInicial, simInicio, simFim);
    renderGraficoProjecao('grafico-projecao', pontos);
}

function renderLinhaItem(item) {
    return `
        <tr>
            <td>${item.nome}</td>
            <td>${caraterPill(item.carater)}</td>
            <td>${LABEL_RECORRENCIA[item.recorrencia]}</td>
            <td class="num">${formatMoney(item.valor)}</td>
            <td>${formatDate(item.data_inicio)}</td>
            <td>${item.recorrencia === 'MENSAL' ? (item.data_fim ? formatDate(item.data_fim) : 'sem fim') : '—'}</td>
            <td>${item.taxa_rendimento_anual ? `${item.taxa_rendimento_anual}x/ano por ${item.meses_rendendo}m` : '—'}</td>
            <td><button type="button" class="danger" data-id="${item.id}">Excluir</button></td>
        </tr>
    `;
}

async function carregarItens() {
    const tbody = document.getElementById('rows');
    tbody.innerHTML = '<tr><td colspan="8">Carregando...</td></tr>';

    const { data, error } = await sb.from('planejamento_itens').select('*').order('data_inicio');

    if (error) {
        tbody.innerHTML = `<tr><td colspan="8">Erro ao carregar: ${error.message}</td></tr>`;
        return;
    }

    itensAtuais = data;

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state">Nenhum item cadastrado ainda.</div></td></tr>';
        recalcular();
        return;
    }

    tbody.innerHTML = data.map(renderLinhaItem).join('');

    tbody.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const ok = await confirmarAcao('Tem certeza que deseja excluir este item da projeção?');
            if (!ok) return;

            const { error: errDel } = await sb.from('planejamento_itens').delete().eq('id', btn.getAttribute('data-id'));
            if (errDel) {
                alert(`Erro ao excluir: ${errDel.message}`);
                return;
            }
            await carregarItens();
            recalcular();
        });
    });

    recalcular();
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    const hoje = new Date();
    const daquiA3Anos = new Date(hoje.getFullYear() + 3, hoje.getMonth(), 1);
    document.getElementById('sim-inicio').value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('sim-fim').value = `${daquiA3Anos.getFullYear()}-${String(daquiA3Anos.getMonth() + 1).padStart(2, '0')}`;

    await carregarItens();
    makeSortable('rows');

    document.getElementById('it-recorrencia').addEventListener('change', atualizarCamposItem);
    document.getElementById('it-data-inicio').addEventListener('change', atualizarDuracaoPreview);
    document.getElementById('it-data-fim').addEventListener('change', atualizarDuracaoPreview);
    atualizarCamposItem();

    document.getElementById('parametros-form').addEventListener('submit', (e) => {
        e.preventDefault();
        recalcular();
    });

    document.getElementById('item-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('item-msg');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        const recorrencia = document.getElementById('it-recorrencia').value;
        const taxaRaw = document.getElementById('it-taxa').value;
        const mesesRaw = document.getElementById('it-meses-rendendo').value;

        const payload = {
            nome: document.getElementById('it-nome').value.trim(),
            carater: document.getElementById('it-carater').value,
            recorrencia,
            valor: parseFloat(document.getElementById('it-valor').value),
            data_inicio: `${document.getElementById('it-data-inicio').value}-01`,
            data_fim: (recorrencia === 'MENSAL' && document.getElementById('it-data-fim').value)
                ? `${document.getElementById('it-data-fim').value}-01`
                : null,
            taxa_rendimento_anual: (recorrencia === 'UNICO' && taxaRaw) ? parseFloat(taxaRaw) : null,
            meses_rendendo: (recorrencia === 'UNICO' && mesesRaw) ? parseInt(mesesRaw, 10) : null,
            observacao: document.getElementById('it-observacao').value || null,
        };

        const { error } = await sb.from('planejamento_itens').insert(payload);

        if (error) {
            msg.textContent = `Erro: ${error.message}`;
            msg.className = 'msg error';
            return;
        }

        msg.textContent = 'Item adicionado.';
        msg.className = 'msg success';
        document.getElementById('item-form').reset();
        atualizarCamposItem();
        await carregarItens();
    });
});
