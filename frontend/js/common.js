const NAV_ITEMS = [
    { href: 'painel.html', icon: '📊', label: 'Painel de Metas' },
    { href: 'custos.html', icon: '📐', label: 'Custos Variáveis' },
    { href: 'fluxo.html', icon: '💸', label: 'Fluxo' },
    { href: 'credito.html', icon: '💳', label: 'Crédito' },
    { href: 'caixinha.html', icon: '🐷', label: 'Caixinha Turbo' },
    { href: 'renda-fixa.html', icon: '🏦', label: 'Renda Fixa' },
    { href: 'bolsa.html', icon: '📈', label: 'Bolsa' },
    { href: 'carteira.html', icon: '🧮', label: 'Carteira' },
    { href: 'planejamento.html', icon: '🔭', label: 'Planej. Futuro' },
];

function renderSidebar() {
    const el = document.getElementById('app-sidebar');
    if (!el) return;

    const atual = window.location.pathname.split('/').pop();

    el.innerHTML = `
        <div class="brand"><span class="dot"></span> Finanças 2026</div>
        <nav>
            ${NAV_ITEMS.map(item => `
                <a href="${item.href}" class="${item.href === atual ? 'active' : ''}">
                    <span class="icon">${item.icon}</span> ${item.label}
                </a>
            `).join('')}
        </nav>
        <button id="logout-btn" class="secondary logout-btn">Sair</button>
    `;

    document.getElementById('logout-btn').addEventListener('click', logout);
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
