let rfChartInstance = null;
let currentChartPeriod = 'Mensal'; // Diario, Semanal, Mensal, Anual

async function carregarRendaFixa() {
    const tbody = document.getElementById('rows');
    const tbodyResgatados = document.getElementById('rows-resgatados');
    tbody.innerHTML = carregandoLinhaHTML(11);
    tbodyResgatados.innerHTML = carregandoLinhaHTML(6);

    // 1. Fetching data
    const [resDetalhe, resBase, resHist] = await Promise.all([
        sb.from('renda_fixa_detalhe').select('*').order('id'),
        sb.from('investimentos_renda_fixa').select('id, resgatado_em, valor_resgatado'),
        sb.from('renda_fixa_historico').select('*').order('data_registro', { ascending: true })
    ]);

    if (resDetalhe.error || resBase.error) {
        renderErroLinha(tbody, 11, (resDetalhe.error || resBase.error).message, carregarRendaFixa);
        return;
    }

    const baseMap = {};
    resBase.data.forEach(b => baseMap[b.id] = b);

    const ativos = [];
    const resgatados = [];

    resDetalhe.data.forEach(r => {
        const base = baseMap[r.id];
        if (base && base.resgatado_em) {
            r.resgatado_em = base.resgatado_em;
            r.valor_resgatado = base.valor_resgatado;
            resgatados.push(r);
        } else {
            ativos.push(r);
        }
    });

    // Recalcular % carteira apenas para ativos
    const totalBrutoAtivos = ativos.reduce((s, r) => s + Number(r.valor_bruto_atual || 0), 0);
    ativos.forEach(r => {
        r.percentual_carteira = totalBrutoAtivos > 0 ? (Number(r.valor_bruto_atual || 0) / totalBrutoAtivos) : 0;
    });

    // 2. Renderizar Ativos
    tbody.innerHTML = ativos.length > 0 ? ativos.map(r => `
        <tr>
            <td>${r.instituicao}</td>
            <td>${r.tipo_ativo}</td>
            <td class="num">${formatMoney(r.valor_aplicado)}</td>
            <td class="num">${formatMoney(r.valor_bruto_atual)}</td>
            <td class="num">${formatMoney(r.valorizacao_reais)}</td>
            <td class="num secundaria">${r.dias_ate_vencimento}</td>
            <td class="num secundaria">${formatMoney(r.imposto_estimado)}</td>
            <td class="num secundaria">${formatMoney(r.valor_liquido_estimado)}</td>
            <td class="num secundaria">${r.valor_liquido_informado === null ? '—' : formatMoney(r.valor_liquido_informado)}</td>
            <td class="num">${(r.percentual_carteira * 100).toFixed(1)}%</td>
            <td>
                <div class="inline-update" style="gap:4px;">
                    <input type="number" step="0.01" value="${r.valor_bruto_atual}" id="upd-bruto-${r.id}" title="Valor bruto atual" style="width:100px;">
                    <button type="button" class="secondary btn-salvar-rf" data-id="${r.id}" title="Atualizar valor">Salvar</button>
                    <button type="button" class="btn-resgatar-rf" data-id="${r.id}" data-nome="${r.tipo_ativo} ${r.instituicao}" title="Resgatar" style="background:var(--success); color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Resgatar</button>
                </div>
            </td>
        </tr>
    `).join('') : `<tr><td colspan="11" style="text-align:center; padding: 20px;">Nenhum investimento ativo.</td></tr>`;

    // 3. Renderizar Resgatados
    tbodyResgatados.innerHTML = resgatados.length > 0 ? resgatados.map(r => {
        const lucro = Number(r.valor_resgatado) - Number(r.valor_aplicado);
        return `
        <tr>
            <td>${formatDate(r.resgatado_em)}</td>
            <td>${r.instituicao}</td>
            <td>${r.tipo_ativo}</td>
            <td class="num">${formatMoney(r.valor_aplicado)}</td>
            <td class="num" style="color:var(--success)">${formatMoney(r.valor_resgatado)}</td>
            <td class="num" style="color:${lucro >= 0 ? 'var(--success)' : 'var(--error)'}">${formatMoney(lucro)}</td>
        </tr>
        `;
    }).join('') : `<tr><td colspan="6" style="text-align:center; padding: 20px;">Nenhum histórico de resgate.</td></tr>`;

    // 4. Desenhar Gráfico
    desenharGrafico(resHist.data || []);

    // 5. Attach Events (Salvar)
    tbody.querySelectorAll('.btn-salvar-rf').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            await comBotaoOcupado(btn, async () => {
                const novoBruto = parseFloat(document.getElementById(`upd-bruto-${id}`).value);
                if (isNaN(novoBruto)) return;
                
                // Atualiza o valor atual
                const { error } = await sb.from('investimentos_renda_fixa')
                    .update({ valor_bruto_atual: novoBruto, atualizado_em: new Date().toISOString() })
                    .eq('id', id);
                    
                if (error) {
                    alert(`Erro ao atualizar: ${error.message}`);
                    return;
                }

                // Insere histórico
                await sb.from('renda_fixa_historico').insert({
                    investimento_id: id,
                    data_registro: new Date().toISOString().split('T')[0],
                    valor_bruto: novoBruto
                });

                await carregarRendaFixa();
            });
        });
    });

    // 6. Attach Events (Resgatar)
    const modalResgate = document.getElementById('modal-resgate');
    let resgateIdAtivo = null;

    tbody.querySelectorAll('.btn-resgatar-rf').forEach(btn => {
        btn.addEventListener('click', () => {
            resgateIdAtivo = btn.getAttribute('data-id');
            document.getElementById('resgate-nome').textContent = btn.getAttribute('data-nome');
            document.getElementById('resgate-data').value = new Date().toISOString().split('T')[0];
            document.getElementById('resgate-valor').value = document.getElementById(`upd-bruto-${resgateIdAtivo}`).value;
            modalResgate.showModal();
        });
    });

    document.getElementById('btn-cancelar-resgate').addEventListener('click', () => {
        modalResgate.close();
        resgateIdAtivo = null;
    });

    const formResgate = document.getElementById('resgate-form');
    // Remove listener antigo para evitar duplo envio se for recarregado
    const newForm = formResgate.cloneNode(true);
    formResgate.parentNode.replaceChild(newForm, formResgate);

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!resgateIdAtivo) return;
        const btnSub = newForm.querySelector('button[type="submit"]');
        await comBotaoOcupado(btnSub, async () => {
            const dataResgate = document.getElementById('resgate-data').value;
            const valorResgate = parseFloat(document.getElementById('resgate-valor').value);

            // 1. Atualizar investimento
            const { error: errUpdate } = await sb.from('investimentos_renda_fixa').update({
                resgatado_em: dataResgate,
                valor_resgatado: valorResgate
            }).eq('id', resgateIdAtivo);

            if (errUpdate) {
                alert(`Erro: ${errUpdate.message}`);
                return;
            }

            // 2. Garantir categoria de resgate
            let catResgate = '#RESGATE_RF';
            const { data: catCheck } = await sb.from('categorias').select('codigo').eq('codigo', catResgate).limit(1);
            if (!catCheck || catCheck.length === 0) {
                await sb.from('categorias').insert({
                    codigo: catResgate,
                    nome: 'Resgate Renda Fixa',
                    carater: 'RECEITA',
                    cor: '#10b981'
                });
            }

            // 3. Lançar no fluxo
            const nomeInv = document.getElementById('resgate-nome').textContent;
            await sb.from('lancamentos_fluxo').insert({
                data_movimento: dataResgate,
                descricao: `Resgate ${nomeInv}`,
                valor: valorResgate,
                metodo: 'Pix',
                categoria_codigo: catResgate
            });

            document.getElementById('modal-resgate').close();
            toast('Resgate realizado com sucesso!');
            await carregarRendaFixa();
        });
    });
}

function desenharGrafico(historicoFull) {
    const ctx = document.getElementById('rfChart').getContext('2d');
    
    if (rfChartInstance) {
        rfChartInstance.destroy();
    }

    if (!historicoFull || historicoFull.length === 0) {
        // Grafico vazio
        rfChartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: ['Sem dados'], datasets: [{ label: 'Evolução Patrimonial', data: [0] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
        return;
    }

    // Agrupar dados por data_registro (somando o valor_bruto de cada investimento no dia)
    // Para simplificar, consideramos o último registro de cada investimento em cada data como o valor do dia.
    
    // Primeiro, vamos ordenar os registros cronologicamente
    historicoFull.sort((a, b) => new Date(a.data_registro) - new Date(b.data_registro));

    // Precisamos construir uma linha do tempo.
    // O valor do patrimônio em um dia D é a soma do valor_bruto_atual de todos os investimentos naquele dia.
    // Se um investimento não foi atualizado no dia D, usamos o valor do último dia atualizado antes de D.
    
    const datasUnicas = [...new Set(historicoFull.map(h => h.data_registro))].sort();
    const estadoPorInvestimento = {};
    const dadosFinais = []; // { data, valorTotal }

    datasUnicas.forEach(d => {
        // Atualiza o estado
        historicoFull.filter(h => h.data_registro === d).forEach(h => {
            estadoPorInvestimento[h.investimento_id] = h.valor_bruto;
        });

        // Soma total
        const totalDia = Object.values(estadoPorInvestimento).reduce((sum, v) => sum + Number(v), 0);
        dadosFinais.push({ data: d, total: totalDia });
    });

    // Filtrar pelo período
    let dadosAgrupados = dadosFinais; // Diario já é o agrupamento base.
    
    if (currentChartPeriod === 'Semanal') {
        // simplificado: pegar um ponto por semana (ex: o último de cada semana)
        const semanas = {};
        dadosFinais.forEach(d => {
            const dateObj = new Date(d.data + 'T12:00:00');
            const weekStart = new Date(dateObj.setDate(dateObj.getDate() - dateObj.getDay())).toISOString().split('T')[0];
            semanas[weekStart] = d; // sobrescreve para manter o último da semana
        });
        dadosAgrupados = Object.values(semanas);
    } else if (currentChartPeriod === 'Mensal') {
        const meses = {};
        dadosFinais.forEach(d => {
            const monthStart = d.data.substring(0, 7); // yyyy-mm
            meses[monthStart] = d;
        });
        dadosAgrupados = Object.values(meses);
    } else if (currentChartPeriod === 'Anual') {
        const anos = {};
        dadosFinais.forEach(d => {
            const yearStart = d.data.substring(0, 4); // yyyy
            anos[yearStart] = d;
        });
        dadosAgrupados = Object.values(anos);
    }

    const labels = dadosAgrupados.map(d => {
        if (currentChartPeriod === 'Mensal') {
            const parts = d.data.split('-');
            return `${parts[1]}/${parts[0]}`;
        }
        if (currentChartPeriod === 'Anual') return d.data.substring(0, 4);
        
        return d.data.split('-').reverse().join('/');
    });
    
    const values = dadosAgrupados.map(d => d.total);

    rfChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Evolução Patrimonial (R$)',
                data: values,
                borderColor: '#10b981', // green success
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5,
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value;
                        }
                    }
                }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    await carregarRendaFixa();
    
    // Fallback: the rows ID is 'rows', but makeSortable handles it inside common.js
    if (typeof makeSortable === 'function') makeSortable('rows');

    document.getElementById('rf-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('msg');
        const btn = e.target.querySelector('button[type="submit"]');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

        await comBotaoOcupado(btn, async () => {
            const valorBruto = parseFloat(document.getElementById('valor_bruto_atual').value);
            const payload = {
                instituicao: document.getElementById('instituicao').value,
                tipo_ativo: document.getElementById('tipo_ativo').value,
                indexador: document.getElementById('indexador').value || null,
                isento_ir: document.getElementById('isento_ir').value === 'true',
                data_aplicacao: document.getElementById('data_aplicacao').value,
                data_vencimento: document.getElementById('data_vencimento').value,
                valor_aplicado: parseFloat(document.getElementById('valor_aplicado').value),
                valor_bruto_atual: valorBruto,
            };

            const { data, error } = await sb.from('investimentos_renda_fixa').insert(payload).select('id').single();

            if (error) {
                msg.textContent = `Erro: ${error.message}`;
                msg.className = 'msg error';
                return;
            }

            // Inserir histórico inicial
            if (data && data.id) {
                await sb.from('renda_fixa_historico').insert({
                    investimento_id: data.id,
                    data_registro: new Date().toISOString().split('T')[0],
                    valor_bruto: valorBruto
                });
            }

            msg.textContent = 'Aplicação salva.';
            msg.className = 'msg success';
            document.getElementById('rf-form').reset();
            await carregarRendaFixa();
            toast('Aplicação salva.');
        });
    });

    // Chart Filters
    ['diario', 'semanal', 'mensal', 'anual'].forEach(period => {
        document.getElementById(`btn-chart-${period}`).addEventListener('click', (e) => {
            document.querySelectorAll('[id^=btn-chart-]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentChartPeriod = period.charAt(0).toUpperCase() + period.slice(1);
            carregarRendaFixa(); // Reloads chart with new period
        });
    });
});
