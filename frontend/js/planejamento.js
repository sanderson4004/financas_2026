function taxaMensal(rendimentoAnual) {
    return Math.pow(rendimentoAnual, 1 / 12) - 1;
}

function calcularResultado(valor, meses, rendimentoAnual, tipoCalculo) {
    if (!valor || !meses || !rendimentoAnual || !tipoCalculo) return null;

    if (tipoCalculo === 'Valor Único') {
        return valor * Math.pow(rendimentoAnual, meses / 12);
    }

    if (tipoCalculo === 'Aporte Mensal Recorrente') {
        const r = taxaMensal(rendimentoAnual);
        if (r === 0) return valor * meses;
        return valor * ((Math.pow(1 + r, meses) - 1) / r);
    }

    return null;
}

function atualizarPreview() {
    const valor = parseFloat(document.getElementById('valor').value);
    const meses = parseInt(document.getElementById('meses').value, 10);
    const rendimento = parseFloat(document.getElementById('rendimento_anual').value);
    const tipoCalculo = document.getElementById('tipo_calculo').value;

    const resultado = calcularResultado(valor, meses, rendimento, tipoCalculo);
    document.getElementById('resultado-preview').textContent = resultado === null ? '—' : formatMoney(resultado);
}

async function carregarGrupos() {
    const div = document.getElementById('grupos');
    div.innerHTML = 'Carregando...';

    const { data, error } = await sb.from('planejamento_futuro').select('*').order('cenario').order('id');

    if (error) {
        div.innerHTML = `<div class="msg error">Erro: ${error.message}</div>`;
        return;
    }

    const grupos = {};
    for (const r of data) {
        if (!grupos[r.cenario]) grupos[r.cenario] = [];
        grupos[r.cenario].push(r);
    }

    const datalist = document.getElementById('cenarios-existentes');
    datalist.innerHTML = Object.keys(grupos).map(c => `<option value="${c}">`).join('');

    div.innerHTML = Object.entries(grupos).map(([cenario, itens]) => `
        <h3 style="font-size:14px; margin:18px 0 10px; color:var(--text)">${cenario}</h3>
        <div class="table-scroll">
            <table>
                <thead>
                    <tr>
                        <th>Caráter</th>
                        <th>Item</th>
                        <th class="num">Valor</th>
                        <th class="num">Meses</th>
                        <th class="num">Rend. a.a.</th>
                        <th>Tipo cálculo</th>
                        <th class="num">Resultado</th>
                        <th>Observação</th>
                    </tr>
                </thead>
                <tbody>
                    ${itens.map(i => `
                        <tr>
                            <td>${i.carater}</td>
                            <td>${i.item}</td>
                            <td class="num">${formatMoney(i.valor)}</td>
                            <td class="num">${i.meses ?? '—'}</td>
                            <td class="num">${i.rendimento_anual ?? '—'}</td>
                            <td>${i.tipo_calculo ?? '—'}</td>
                            <td class="num">${i.resultado_planilha !== null && i.resultado_planilha !== undefined ? formatMoney(i.resultado_planilha) : (calcularResultado(i.valor, i.meses, i.rendimento_anual, i.tipo_calculo) !== null ? formatMoney(calcularResultado(i.valor, i.meses, i.rendimento_anual, i.tipo_calculo)) : '—')}</td>
                            <td>${i.descricao ?? ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    await carregarGrupos();

    ['valor', 'meses', 'rendimento_anual', 'tipo_calculo'].forEach(id => {
        document.getElementById(id).addEventListener('input', atualizarPreview);
    });

    document.getElementById('pf-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('msg');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        const payload = {
            cenario: document.getElementById('cenario').value,
            carater: document.getElementById('carater').value,
            item: document.getElementById('item').value,
            valor: parseFloat(document.getElementById('valor').value),
            meses: document.getElementById('meses').value ? parseInt(document.getElementById('meses').value, 10) : null,
            rendimento_anual: document.getElementById('rendimento_anual').value ? parseFloat(document.getElementById('rendimento_anual').value) : null,
            tipo_calculo: document.getElementById('tipo_calculo').value || null,
            descricao: document.getElementById('descricao').value || null,
        };

        const { error } = await sb.from('planejamento_futuro').insert(payload);

        if (error) {
            msg.textContent = `Erro: ${error.message}`;
            msg.className = 'msg error';
            return;
        }

        msg.textContent = 'Item salvo.';
        msg.className = 'msg success';
        document.getElementById('pf-form').reset();
        document.getElementById('resultado-preview').textContent = '—';
        await carregarGrupos();
    });
});
