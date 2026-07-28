async function carregarCategorias() {
    const sel = document.getElementById('categoria');
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

function somarMeses(dataISO, n) {
    const [ano, mes, dia] = dataISO.split('-').map(Number);
    const d = new Date(Date.UTC(ano, mes - 1 + n, dia));
    return d.toISOString().slice(0, 10);
}

async function carregarCompras() {
    const tbody = document.getElementById('rows');
    tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';

    const { data: compras, error } = await sb
        .from('compras_credito')
        .select('*, categorias(nome)')
        .order('id', { ascending: false })
        .limit(20);

    if (error) {
        tbody.innerHTML = `<tr><td colspan="6">Erro ao carregar: ${error.message}</td></tr>`;
        return;
    }

    if (compras.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">Nenhuma compra ainda.</td></tr>';
        return;
    }

    const ids = compras.map(c => c.id);
    const { data: parcelas } = await sb
        .from('parcelas_credito')
        .select('compra_id, pago')
        .in('compra_id', ids);

    const contagem = {};
    for (const p of (parcelas || [])) {
        if (!contagem[p.compra_id]) contagem[p.compra_id] = { total: 0, pagas: 0 };
        contagem[p.compra_id].total++;
        if (p.pago) contagem[p.compra_id].pagas++;
    }

    tbody.innerHTML = compras.map(c => {
        const cnt = contagem[c.id] || { total: c.total_parcelas, pagas: 0 };
        const valorTotal = c.total_parcelas * c.valor_parcela;
        return `
            <tr>
                <td>${c.descricao}</td>
                <td>${c.cartao}</td>
                <td>${c.categorias ? c.categorias.nome : c.categoria_codigo}</td>
                <td class="num">${c.total_parcelas}x ${formatMoney(c.valor_parcela)}</td>
                <td class="num">${formatMoney(valorTotal)}</td>
                <td class="num">${cnt.pagas}/${cnt.total}</td>
            </tr>
        `;
    }).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    await carregarCategorias();
    await carregarCompras();

    document.getElementById('credito-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('msg');
        msg.textContent = 'Salvando...';
        msg.className = 'msg';

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
                pago: false,
                categoria_codigo: compraPayload.categoria_codigo,
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
    });
});
