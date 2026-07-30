const NAV_ITEMS = [
    { href: 'painel.html', icon: '📊', label: 'Painel de Metas', color: '#4f8ff7' },
    { href: 'custos.html', icon: '📐', label: 'Custos Variáveis', color: '#f5a524' },
    { href: 'fluxo.html', icon: '💸', label: 'Fluxo', color: '#22c55e' },
    { href: 'credito.html', icon: '💳', label: 'Crédito', color: '#fb4d67' },
    { href: 'caixinha.html', icon: '🐷', label: 'Caixinha Turbo', color: '#06b6d4' },
    { href: 'renda-fixa.html', icon: '🏦', label: 'Renda Fixa', color: '#ca8a04' },
    { href: 'bolsa.html', icon: '📈', label: 'Bolsa', color: '#fb923c' },
    { href: 'carteira.html', icon: '🧮', label: 'Carteira', color: '#64748b' },
    { href: 'planejamento.html', icon: '🔭', label: 'Planej. Futuro', color: '#14b8a6' },
    {
        label: 'Cadastros', icon: '🗂️', color: '#94a3b8', group: true,
        children: [
            { href: 'cadastros.html#categorias', label: 'Categorias' },
            { href: 'cadastros.html#vigencias', label: 'Vigências de meta' },
            { href: 'cadastros.html#metodos', label: 'Métodos de pagamento' },
            { href: 'cadastros.html#cartoes', label: 'Cartões' },
        ],
    },
];

function renderSidebar() {
    const el = document.getElementById('app-sidebar');
    if (!el) return;

    const atual = window.location.pathname.split('/').pop();

    el.innerHTML = `
        <div class="brand"><span class="dot"></span> Finanças 2026</div>
        <div class="nav-label">Menu</div>
        <nav>
            ${NAV_ITEMS.map((item, i) => {
                if (item.group) {
                    const abertoPorPadrao = atual === 'cadastros.html';
                    return `
                        <button type="button" class="nav-group-toggle ${abertoPorPadrao ? 'active' : ''}" data-group="${i}">
                            <span class="icon" style="--tint: ${item.color}">${item.icon}</span> ${item.label}
                            <span class="chevron">›</span>
                        </button>
                        <div class="nav-sub" id="nav-sub-${i}" style="${abertoPorPadrao ? '' : 'display:none'}">
                            ${item.children.map(sub => `<a href="${sub.href}">${sub.label}</a>`).join('')}
                        </div>
                    `;
                }
                return `
                    <a href="${item.href}" class="${item.href === atual ? 'active' : ''}">
                        <span class="icon" style="--tint: ${item.color}">${item.icon}</span> ${item.label}
                    </a>
                `;
            }).join('')}
        </nav>
        <div class="sidebar-footer">
            <div class="user-chip"><span class="avatar">SA</span> Conta pessoal</div>
            <button id="logout-btn" class="secondary logout-btn">Sair</button>
        </div>
    `;

    document.getElementById('logout-btn').addEventListener('click', logout);

    el.querySelectorAll('.nav-group-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const sub = document.getElementById(`nav-sub-${btn.getAttribute('data-group')}`);
            const abrindo = sub.style.display === 'none';
            sub.style.display = abrindo ? 'flex' : 'none';
            btn.classList.toggle('active', abrindo);
        });
    });
}

// Modal de confirmação reutilizável (substitui o confirm() nativo do navegador).
// Uso: if (await confirmarAcao('Tem certeza que...?')) { ...excluir... }
function confirmarAcao(mensagem, textoConfirmar) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box">
                <p>${mensagem}</p>
                <div class="modal-actions">
                    <button type="button" class="secondary" data-choice="nao">Não</button>
                    <button type="button" class="danger" data-choice="sim">${textoConfirmar || 'Sim, excluir'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const cleanup = (resultado) => {
            overlay.remove();
            resolve(resultado);
        };

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) cleanup(false);
        });
        overlay.querySelector('[data-choice="nao"]').addEventListener('click', () => cleanup(false));
        overlay.querySelector('[data-choice="sim"]').addEventListener('click', () => cleanup(true));
    });
}

async function requireAuth() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return null;
    }
    renderSidebar();
    return session;
}

async function logout() {
    await sb.auth.signOut();
    window.location.href = 'index.html';
}

function formatDate(iso) {
    if (!iso) return '—';
    const [ano, mes, dia] = String(iso).slice(0, 10).split('-');
    if (!ano || !mes || !dia) return iso;
    return `${dia}/${mes}/${ano}`;
}

function formatMoney(v) {
    if (v === null || v === undefined || v === '') return '—';
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function statusClass(status) {
    if (!status) return '';
    if (status.startsWith('✓')) return 'status-ok';
    if (status.startsWith('✗')) return 'status-bad';
    return 'status-pending';
}

function statusPill(status) {
    if (!status) return '';
    return `<span class="pill ${statusClass(status)}">${status}</span>`;
}

const CARATER_CLASSES = {
    'RECEITA': 'carater-receita',
    'DESPESA': 'carater-despesa',
    'RESERVA': 'carater-reserva',
    'TRANSFERÊNCIA': 'carater-transferencia',
    'EXCLUÍDO': 'carater-excluido',
};

function caraterPill(carater) {
    if (!carater) return '';
    const cls = CARATER_CLASSES[carater] || 'carater-transferencia';
    return `<span class="pill ${cls}">${carater}</span>`;
}

// Pill contornado com a cor cadastrada pelo usuário (categoria/método),
// texto sempre branco. Sem cor cadastrada, cai no visual neutro padrão.
function pillCor(texto, cor) {
    if (!texto) return '';
    if (!cor) return `<span class="pill pill-cor-neutro">${texto}</span>`;
    return `<span class="pill pill-cor" style="--cor: ${cor}">${texto}</span>`;
}

async function buscarMapaCoresCategorias() {
    const { data, error } = await sb.from('categorias').select('codigo, cor');
    if (error) return {};
    return Object.fromEntries(data.map(c => [c.codigo, c.cor]));
}

async function buscarMapaCoresMetodos() {
    const { data, error } = await sb.from('metodos_pagamento').select('nome, cor');
    if (error) return {};
    return Object.fromEntries(data.map(m => [m.nome, m.cor]));
}

const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function popularSeletorMesAno(selMesId, selAnoId, anoInicial, anoFinal) {
    const selMes = document.getElementById(selMesId);
    const selAno = document.getElementById(selAnoId);

    selMes.innerHTML = NOMES_MES.map((nome, i) => `<option value="${i + 1}">${nome}</option>`).join('');

    let anos = [];
    for (let a = anoInicial; a <= anoFinal; a++) anos.push(a);
    selAno.innerHTML = anos.map(a => `<option value="${a}">${a}</option>`).join('');
}

function definirSeletorMesAno(selMesId, selAnoId, mes, ano) {
    document.getElementById(selMesId).value = String(mes);
    document.getElementById(selAnoId).value = String(ano);
}

function lerSeletorMesAnoComoData(selMesId, selAnoId) {
    const mes = document.getElementById(selMesId).value.padStart(2, '0');
    const ano = document.getElementById(selAnoId).value;
    return `${ano}-${mes}-01`;
}

// Liga o seletor de mês/ano ao mês corrente e cria o botão "Mês atual" (se
// existir na página) para voltar rápido depois de navegar para outro mês.
function ativarMesVigente(selMesId, selAnoId, botaoId, recarregar) {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    definirSeletorMesAno(selMesId, selAnoId, mesAtual, anoAtual);

    const botao = document.getElementById(botaoId);
    if (botao) {
        botao.addEventListener('click', () => {
            definirSeletorMesAno(selMesId, selAnoId, mesAtual, anoAtual);
            recarregar();
        });
    }
}

// -----------------------------------------------------------------------
// Tabelas ordenáveis: clique no <th> ordena pelo conteúdo daquela coluna.
// Funciona em cima de qualquer tabela com <thead> + <tbody id="tbodyId">;
// detecta números/dinheiro automaticamente, senão ordena como texto.
// -----------------------------------------------------------------------
function parseValorOrdenavel(texto) {
    const t = (texto || '').trim();
    if (t === '' || t === '—') return null;

    const soNumero = t.replace(/[^\d,.-]/g, '');
    if (soNumero !== '' && /\d/.test(soNumero)) {
        const normalizado = soNumero.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
        const num = Number(normalizado);
        if (!Number.isNaN(num)) return num;
    }
    return t.toLowerCase();
}

function makeSortable(tbodyId) {
    const tbody = document.getElementById(tbodyId);
    const table = tbody && tbody.closest('table');
    const thead = table && table.tHead;
    if (!thead) return;

    thead.querySelectorAll('th').forEach((th, colIndex) => {
        th.classList.add('sortable');
        th.addEventListener('click', () => {
            const dir = th.getAttribute('data-sort-dir') === 'asc' ? 'desc' : 'asc';
            thead.querySelectorAll('th').forEach(h => h.removeAttribute('data-sort-dir'));
            th.setAttribute('data-sort-dir', dir);

            const linhas = Array.from(tbody.querySelectorAll('tr'));
            if (linhas.length === 0 || !linhas[0].children[colIndex]) return;

            linhas.sort((a, b) => {
                const va = parseValorOrdenavel(a.children[colIndex].textContent);
                const vb = parseValorOrdenavel(b.children[colIndex].textContent);
                if (va === null && vb === null) return 0;
                if (va === null) return 1;
                if (vb === null) return -1;
                const cmp = typeof va === 'number' && typeof vb === 'number'
                    ? va - vb
                    : String(va).localeCompare(String(vb), 'pt-BR');
                return dir === 'asc' ? cmp : -cmp;
            });

            linhas.forEach(tr => tbody.appendChild(tr));
        });
    });
}
