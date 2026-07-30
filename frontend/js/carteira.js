function renderDonut(containerId, segmentos) {
    const el = document.getElementById(containerId);
    const total = segmentos.reduce((s, seg) => s + seg.valor, 0);

    if (total <= 0) {
        el.innerHTML = estadoVazioHTML('Sem patrimônio registrado ainda.', '🧮');
        return;
    }

    const r = 70, cx = 90, cy = 90, circunferencia = 2 * Math.PI * r;
    let acumulado = 0;

    const arcos = segmentos.filter(s => s.valor > 0).map(seg => {
        const fracao = seg.valor / total;
        const dash = fracao * circunferencia;
        const offset = -acumulado * circunferencia;
        acumulado += fracao;
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.cor}" stroke-width="26"
                    stroke-dasharray="${dash.toFixed(1)} ${(circunferencia - dash).toFixed(1)}"
                    stroke-dashoffset="${offset.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})">
                    <title>${seg.label}: ${formatMoney(seg.valor)} (${(fracao * 100).toFixed(1)}%)</title>
                </circle>`;
    }).join('');

    el.innerHTML = `
        <div style="display:flex; align-items:center; gap:28px; flex-wrap:wrap">
            <svg width="180" height="180" viewBox="0 0 180 180">
                ${arcos}
                <text x="90" y="86" text-anchor="middle" font-size="12" fill="var(--text-faint)">Total</text>
                <text x="90" y="106" text-anchor="middle" font-size="15" font-weight="700" fill="var(--text)">${formatMoney(total)}</text>
            </svg>
            <div style="display:flex; flex-direction:column; gap:10px">
                ${segmentos.map(seg => `
                    <div style="display:flex; align-items:center; gap:9px; font-size:13.5px;">
                        <span style="width:11px;height:11px;border-radius:3px;background:${seg.cor};display:inline-block;flex-shrink:0;"></span>
                        <span style="color:var(--text-dim)">${seg.label}</span>
                        <strong>${formatMoney(seg.valor)}</strong>
                        <span style="color:var(--text-faint)">(${total > 0 ? ((seg.valor / total) * 100).toFixed(1) : '0.0'}%)</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderGraficoEvolucao(containerId, pontos) {
    const el = document.getElementById(containerId);

    if (pontos.length === 0) {
        el.innerHTML = estadoVazioHTML('Ainda não há histórico suficiente — volte aqui em outro dia pra começar a ver a evolução.', '📈');
        return;
    }

    if (pontos.length === 1) {
        el.innerHTML = estadoVazioHTML(`Só há 1 retrato até agora (${pontos[0].label}: ${formatMoney(pontos[0].valor)}). Volte em outro dia pra ver a evolução.`, '📈');
        return;
    }

    const w = 720, h = 240, padding = 40;
    const valores = pontos.map(p => p.valor);
    const min = Math.min(...valores, 0);
    const max = Math.max(...valores);
    const range = (max - min) || 1;
    const passoX = (w - padding * 2) / (pontos.length - 1);

    const coords = pontos.map((p, i) => ({
        x: padding + i * passoX,
        y: h - padding - ((p.valor - min) / range) * (h - padding * 2),
        ...p,
    }));

    const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${h - padding} L ${coords[0].x.toFixed(1)} ${h - padding} Z`;

    el.innerHTML = `
        <div class="table-scroll">
        <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:auto; min-width:320px; max-height:260px;">
            <defs>
                <linearGradient id="grad-evolucao" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35"/>
                    <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <path d="${areaD}" fill="url(#grad-evolucao)" stroke="none"></path>
            <path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="2.5"></path>
            ${coords.map(c => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4" fill="var(--accent)"><title>${c.label}: ${formatMoney(c.valor)}</title></circle>`).join('')}
            ${coords.map(c => `<text x="${c.x.toFixed(1)}" y="${h - 10}" font-size="10" fill="var(--text-faint)" text-anchor="middle">${c.label}</text>`).join('')}
        </svg>
        </div>
    `;
}

function inicioDaSemana(dataISO) {
    const d = new Date(`${dataISO}T00:00:00`);
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().slice(0, 10);
}

function rotuloSemana(dataISO) {
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}`;
}

function agruparHistorico(rows, periodo) {
    const grupos = {};

    for (const r of rows) {
        let chave;
        if (periodo === 'semanal') chave = inicioDaSemana(r.data);
        else if (periodo === 'anual') chave = r.data.slice(0, 4);
        else chave = r.data.slice(0, 7);

        if (!grupos[chave] || grupos[chave].data < r.data) grupos[chave] = r;
    }

    return Object.keys(grupos).sort().map(chave => {
        const r = grupos[chave];
        let label;
        if (periodo === 'semanal') label = rotuloSemana(chave);
        else if (periodo === 'anual') label = chave;
        else {
            const [ano, mes] = chave.split('-');
            label = `${mes}/${ano.slice(2)}`;
        }
        return { label, valor: Number(r.patrimonio_total) };
    });
}

let historicoAtual = [];

function atualizarGraficoEvolucao(periodo) {
    document.querySelectorAll('.periodo-btn').forEach(b => b.classList.toggle('ativo', b.getAttribute('data-periodo') === periodo));
    renderGraficoEvolucao('grafico-evolucao', agruparHistorico(historicoAtual, periodo));
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    const { data, error } = await sb.from('carteira_consolidada').select('*').single();

    if (error) {
        renderErro(document.getElementById('resumo'), error.message, () => window.location.reload());
        return;
    }

    // Mesma cor pro KPI, pro ponto na tabela de detalhe e pro segmento do
    // donut — as três formas de olhar pra mesma fonte de patrimônio devem
    // "falar a mesma língua" visual. Cores repetem as dos ícones do menu
    // lateral (Renda Fixa, Bolsa, Caixinha Turbo).
    const CORES_FONTE = { 'Renda Fixa': '#ca8a04', 'Bolsa': '#fb923c', 'Caixinha Turbo': '#06b6d4' };

    document.getElementById('resumo').innerHTML = `
        <div class="stat" style="--tint: var(--accent)"><div class="label">Patrimônio total</div><div class="value">${formatMoney(data.patrimonio_total)}</div></div>
        <div class="stat" style="--tint: ${CORES_FONTE['Renda Fixa']}"><div class="label">Renda Fixa</div><div class="value">${formatMoney(data.total_renda_fixa)}</div></div>
        <div class="stat" style="--tint: ${CORES_FONTE['Bolsa']}"><div class="label">Bolsa</div><div class="value">${formatMoney(data.total_bolsa)}</div></div>
        <div class="stat" style="--tint: ${CORES_FONTE['Caixinha Turbo']}"><div class="label">Caixinha Turbo</div><div class="value">${formatMoney(data.total_caixinha_turbo)}</div></div>
    `;

    document.getElementById('rows').innerHTML = `
        <tr><td><span class="cor-swatch" style="background:${CORES_FONTE['Renda Fixa']}"></span>Renda Fixa</td><td class="num">${formatMoney(data.total_renda_fixa)}</td><td class="num">${(data.pct_renda_fixa * 100).toFixed(1)}%</td></tr>
        <tr><td><span class="cor-swatch" style="background:${CORES_FONTE['Bolsa']}"></span>Bolsa</td><td class="num">${formatMoney(data.total_bolsa)}</td><td class="num">${(data.pct_bolsa * 100).toFixed(1)}%</td></tr>
        <tr><td><span class="cor-swatch" style="background:${CORES_FONTE['Caixinha Turbo']}"></span>Caixinha Turbo</td><td class="num">${formatMoney(data.total_caixinha_turbo)}</td><td class="num">${(data.pct_caixinha_turbo * 100).toFixed(1)}%</td></tr>
    `;

    renderDonut('donut-distribuicao', [
        { label: 'Renda Fixa', valor: Number(data.total_renda_fixa), cor: CORES_FONTE['Renda Fixa'] },
        { label: 'Bolsa', valor: Number(data.total_bolsa), cor: CORES_FONTE['Bolsa'] },
        { label: 'Caixinha Turbo', valor: Number(data.total_caixinha_turbo), cor: CORES_FONTE['Caixinha Turbo'] },
    ]);

    const hoje = new Date().toISOString().slice(0, 10);
    await sb.from('patrimonio_historico').upsert({
        data: hoje,
        total_renda_fixa: data.total_renda_fixa,
        total_bolsa: data.total_bolsa,
        total_caixinha_turbo: data.total_caixinha_turbo,
        patrimonio_total: data.patrimonio_total,
    });

    const { data: historico, error: errHist } = await sb
        .from('patrimonio_historico')
        .select('*')
        .order('data');

    if (!errHist) {
        historicoAtual = historico || [];
    }

    document.querySelectorAll('.periodo-btn').forEach(btn => {
        btn.addEventListener('click', () => atualizarGraficoEvolucao(btn.getAttribute('data-periodo')));
    });

    atualizarGraficoEvolucao('mensal');
});
