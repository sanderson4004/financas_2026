let mesFocoAtual = null;

let coresCategoriasAtual = {};
let coresMetodosAtual = {};

function renderLinhaCusto(r) {
    return `
        <tr class="custo-linha" id="custo-${r.categoria_codigo}" data-categoria="${r.categoria_codigo}">
            <td>${r.categoria_codigo}</td>
            <td>${pillCor(r.categoria_nome, coresCategoriasAtual[r.categoria_codigo])}</td>
            <td>${r.tipo_teto}</td>
            <td class="num">${formatMoney(r.teto)}</td>
            <td class="num"><button type="button" class="link-realizado" data-categoria="${r.categoria_codigo}">${formatMoney(r.realizado)}<span class="seta">▸</span></button></td>
            <td class="num">${formatMoney(r.saldo)}</td>
            <td class="num">${r.percentual_usado === null ? '—' : (r.percentual_usado * 100).toFixed(1) + '%'}</td>
            <td>${r.referencia}</td>
            <td>${statusPill(r.status)}</td>
        </tr>
    `;
}

async function carregarCustos(mesFoco) {
    mesFocoAtual = mesFoco;
    const tbody = document.getElementById('rows');
    tbody.innerHTML = carregandoLinhaHTML(9);
    categoriaAberta = null;
    document.getElementById('custo-detalhe-container').innerHTML = '';

    const [{ data, error }, coresCategorias] = await Promise.all([
        sb.rpc('custos_variaveis', { mes_foco: mesFoco }),
        buscarMapaCoresCategorias(),
    ]);
    coresCategoriasAtual = coresCategorias;

    if (error) {
        renderErroLinha(tbody, 9, error.message, () => carregarCustos(mesFoco));
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9">${estadoVazioHTML('Nenhuma categoria ANUAL/OUTRO_DELIMITADO vigente neste mês.', '📐')}</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(renderLinhaCusto).join('');
}

// O painel de detalhe abre FORA da <table> de categorias (num container
// próprio, logo abaixo dela) — ver comentário equivalente em credito.js.
let categoriaAberta = null;

async function carregarDetalheCusto(categoriaCodigo) {
    const alvo = document.getElementById('custo-detalhe-container');
    alvo.innerHTML = carregandoHTML('Carregando lançamentos...');

    if (Object.keys(coresMetodosAtual).length === 0) {
        coresMetodosAtual = await buscarMapaCoresMetodos();
    }

    const { data, error } = await sb.rpc('custos_variaveis_detalhe', {
        p_categoria_codigo: categoriaCodigo,
        mes_foco: mesFocoAtual,
    });

    if (error) {
        renderErro(alvo, error.message, () => carregarDetalheCusto(categoriaCodigo));
        return;
    }

    if (data.length === 0) {
        alvo.innerHTML = estadoVazioHTML('Nenhum lançamento encontrado nesta janela.', '🔎');
        return;
    }

    alvo.innerHTML = `
        <div class="table-scroll">
            <table>
                <thead>
                    <tr><th>Data</th><th>Origem</th><th>Descrição</th><th>Método/Cartão</th><th class="num">Valor</th></tr>
                </thead>
                <tbody>
                    ${data.map(l => `
                        <tr>
                            <td>${formatDate(l.data)}</td>
                            <td>${l.fonte}</td>
                            <td>${l.descricao || ''}</td>
                            <td>${l.metodo_ou_cartao ? pillCor(l.metodo_ou_cartao, coresMetodosAtual[l.metodo_ou_cartao]) : ''}</td>
                            <td class="num">${formatMoney(l.valor)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    const hoje = new Date();
    popularSeletorMesAno('mes-sel', 'ano-sel', hoje.getFullYear() - 2, hoje.getFullYear() + 2);

    const recarregar = () => carregarCustos(lerSeletorMesAnoComoData('mes-sel', 'ano-sel'));
    ativarMesVigente('mes-sel', 'ano-sel', 'btn-mes-atual', recarregar);
    document.getElementById('mes-sel').addEventListener('change', recarregar);
    document.getElementById('ano-sel').addEventListener('change', recarregar);
    makeSortable('rows');

    document.getElementById('rows').addEventListener('click', async (e) => {
        const btn = e.target.closest('button.link-realizado');
        if (!btn) return;

        const categoria = btn.getAttribute('data-categoria');
        const container = document.getElementById('custo-detalhe-container');

        document.querySelectorAll('button.link-realizado.aberto').forEach(b => b.classList.remove('aberto'));

        if (categoriaAberta === categoria) {
            categoriaAberta = null;
            container.innerHTML = '';
            return;
        }

        categoriaAberta = categoria;
        btn.classList.add('aberto');
        await carregarDetalheCusto(categoria);
    });

    recarregar();
});
