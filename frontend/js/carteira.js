function renderDonut(containerId, segmentos) {
    const el = document.getElementById(containerId);
    const total = segmentos.reduce((s, seg) => s + seg.valor, 0);

    if (total <= 0) {
        el.innerHTML = estadoVazioHTML('Sem patrimônio registrado ainda.', '🧮');
        return;
    }

    const r = 70, cx = 90, cy = 90, circunferencia = 2 * Math.PI * r;
    let acumulado = 0;
    const visiveis = segmentos.filter(s => s.valor > 0);

    const arcos = visiveis.map((seg, i) => {
        const fracao = seg.valor / total;
        const dash = fracao * circunferencia;
        const offset = -acumulado * circunferencia;
        acumulado += fracao;
        return `<circle class="donut-arc" data-index="${i}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.cor}" stroke-width="26"
                    stroke-dasharray="${dash.toFixed(1)} ${(circunferencia - dash).toFixed(1)}"
                    stroke-dashoffset="${offset.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"></circle>`;
    }).join('');

    el.innerHTML = `
        <div style="display:flex; align-items:center; gap:28px; flex-wrap:wrap">
            <svg width="180" height="180" viewBox="0 0 180 180">
                ${arcos}
                <text id="donut-centro-rotulo" x="90" y="86" text-anchor="middle" font-size="12" fill="var(--text-faint)">Total</text>
                <text id="donut-centro-valor" x="90" y="107" text-anchor="middle" font-size="14" font-weight="700" fill="var(--text)" font-family="var(--font-mono)">${formatMoney(total)}</text>
            </svg>
            <div style="display:flex; flex-direction:column; gap:2px">
                ${visiveis.map((seg, i) => `
                    <div class="donut-legenda-item" data-index="${i}" style="display:flex; align-items:center; gap:9px; font-size:13.5px;">
                        <span style="width:11px;height:11px;border-radius:3px;background:${seg.cor};display:inline-block;flex-shrink:0;"></span>
                        <span style="color:var(--text-dim)">${seg.label}</span>
                        <strong style="font-family:var(--font-mono)">${formatMoney(seg.valor)}</strong>
                        <span style="color:var(--text-faint)">(${((seg.valor / total) * 100).toFixed(1)}%)</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    const tooltip = criarTooltipGrafico();
    const rotuloEl = document.getElementById('donut-centro-rotulo');
    const valorEl = document.getElementById('donut-centro-valor');

    const destacar = (i) => {
        el.querySelectorAll('.donut-arc').forEach(arco => {
            const ativo = Number(arco.getAttribute('data-index')) === i;
            arco.classList.toggle('destacado', ativo);
            arco.classList.toggle('apagado', !ativo);
        });
        el.querySelectorAll('.donut-legenda-item').forEach(item => {
            item.classList.toggle('ativo', Number(item.getAttribute('data-index')) === i);
        });
        const seg = visiveis[i];
        rotuloEl.textContent = seg.label;
        valorEl.textContent = `${formatMoney(seg.valor)}`;
    };

    const limpar = () => {
        el.querySelectorAll('.donut-arc').forEach(a => a.classList.remove('destacado', 'apagado'));
        el.querySelectorAll('.donut-legenda-item').forEach(i => i.classList.remove('ativo'));
        rotuloEl.textContent = 'Total';
        valorEl.textContent = formatMoney(total);
        tooltip.esconder();
    };

    el.querySelectorAll('.donut-arc, .donut-legenda-item').forEach(elemento => {
        const i = Number(elemento.getAttribute('data-index'));
        const seg = visiveis[i];
        elemento.addEventListener('mouseenter', (e) => {
            destacar(i);
            tooltip.mostrar(`<span class="rotulo">${seg.label}</span><strong>${formatMoney(seg.valor)}</strong> (${((seg.valor / total) * 100).toFixed(1)}%)`, e);
        });
        elemento.addEventListener('mousemove', (e) => tooltip.mover(e));
        elemento.addEventListener('mouseleave', limpar);
    });
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

    const pathD = curvaSuave(coords);
    const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${h - padding} L ${coords[0].x.toFixed(1)} ${h - padding} Z`;

    el.innerHTML = `
        <div class="table-scroll">
        <svg id="svg-evolucao" viewBox="0 0 ${w} ${h}" style="width:100%; height:auto; min-width:320px; max-height:260px;">
            <defs>
                <linearGradient id="grad-evolucao" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35"/>
                    <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <path d="${areaD}" fill="url(#grad-evolucao)" stroke="none"></path>
            <path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="2.5"></path>
            ${coords.map(c => `<line class="linha-guia" data-index="${coords.indexOf(c)}" x1="${c.x.toFixed(1)}" y1="${padding * 0.3}" x2="${c.x.toFixed(1)}" y2="${h - padding}"></line>`).join('')}
            ${coords.map((c, i) => `
                <circle class="ponto-visivel" data-index="${i}" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3.5" fill="var(--accent)"></circle>
                <circle class="ponto-hit" data-index="${i}" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="14"></circle>
            `).join('')}
            ${coords.map(c => `<text x="${c.x.toFixed(1)}" y="${h - 10}" font-size="10" fill="var(--text-faint)" text-anchor="middle">${c.label}</text>`).join('')}
        </svg>
        </div>
    `;

    ligarInteracaoLinha('svg-evolucao', coords, (c) => `<span class="rotulo">${c.label}</span><strong>${formatMoney(c.valor)}</strong>`);
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

    const resumoEl = document.getElementById('resumo');
    resumoEl.innerHTML = `
        <div class="card-composable">
            <div class="top-label">Patrimônio Total</div>
            <div class="huge-value ok" data-contagem="${Number(data.patrimonio_total)}"></div>
            <div class="progress-bar-container"><div class="progress-bar-fill ok" style="width: 100%"></div></div>
        </div>
        <div class="card-composable">
            <div class="top-label">Renda Fixa</div>
            <div class="huge-value neutral" data-contagem="${Number(data.total_renda_fixa)}" style="color: ${CORES_FONTE['Renda Fixa']}"></div>
            <div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${data.pct_renda_fixa * 100}%; background-color: ${CORES_FONTE['Renda Fixa']}"></div></div>
        </div>
        <div class="card-composable">
            <div class="top-label">Bolsa</div>
            <div class="huge-value neutral" data-contagem="${Number(data.total_bolsa)}" style="color: ${CORES_FONTE['Bolsa']}"></div>
            <div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${data.pct_bolsa * 100}%; background-color: ${CORES_FONTE['Bolsa']}"></div></div>
        </div>
        <div class="card-composable">
            <div class="top-label">Caixinha Turbo</div>
            <div class="huge-value neutral" data-contagem="${Number(data.total_caixinha_turbo)}" style="color: ${CORES_FONTE['Caixinha Turbo']}"></div>
            <div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${data.pct_caixinha_turbo * 100}%; background-color: ${CORES_FONTE['Caixinha Turbo']}"></div></div>
        </div>
    `;
    animarContagens(resumoEl);

    document.getElementById('rows').innerHTML = `
        <tr><td><span class="cor-swatch" style="background:${CORES_FONTE['Renda Fixa']}; display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 8px;"></span>Renda Fixa</td><td class="num">${formatMoney(data.total_renda_fixa)}</td><td class="num">${(data.pct_renda_fixa * 100).toFixed(1)}%</td></tr>
        <tr><td><span class="cor-swatch" style="background:${CORES_FONTE['Bolsa']}; display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 8px;"></span>Bolsa</td><td class="num">${formatMoney(data.total_bolsa)}</td><td class="num">${(data.pct_bolsa * 100).toFixed(1)}%</td></tr>
        <tr><td><span class="cor-swatch" style="background:${CORES_FONTE['Caixinha Turbo']}; display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 8px;"></span>Caixinha Turbo</td><td class="num">${formatMoney(data.total_caixinha_turbo)}</td><td class="num">${(data.pct_caixinha_turbo * 100).toFixed(1)}%</td></tr>
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
