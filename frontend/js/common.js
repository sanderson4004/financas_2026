const NAV_ITEMS = [
    { href: 'painel.html', label: 'Painel de Metas', color: '#5285f5', svg: '<rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/>' },
    { href: 'custos.html', label: 'Custos Variáveis', color: '#eeab3d', svg: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>' },
    { href: 'fluxo.html', label: 'Fluxo', color: '#30cb8c', svg: '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>' },
    { href: 'credito.html', label: 'Crédito', color: '#f8586f', svg: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>' },
    { href: 'caixinha.html', label: 'Caixinha Turbo', color: '#22c5dd', svg: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>' },
    { href: 'renda-fixa.html', label: 'Renda Fixa', color: '#c99a2e', svg: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M14 9h1M14 13h1"/>' },
    { href: 'bolsa.html', label: 'Bolsa', color: '#f2934f', svg: '<path d="M3 3v18h18"/><path d="M7 15l4-6 3 3 5-7"/>' },
    { href: 'carteira.html', label: 'Carteira', color: '#8b93a5', svg: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>' },
    { href: 'planejamento.html', label: 'Planej. Futuro', color: '#14b8a6', svg: '<path d="M4 22V4a1 1 0 0 1 1-1h11l-2 4 2 4H5"/>' },
    {
        label: 'Cadastros', color: '#94a3b8', group: true,
        svg: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
        children: [
            { href: 'cadastros.html#categorias', label: 'Categorias' },
            { href: 'cadastros.html#vigencias', label: 'Vigências de meta' },
            { href: 'cadastros.html#metodos', label: 'Métodos de pagamento' },
            { href: 'cadastros.html#cartoes', label: 'Cartões' },
        ],
    },
];

const SVG_ABERTO = '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
function iconeSvg(pathsInternos) { return `${SVG_ABERTO}${pathsInternos}</svg>`; }

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
                        <button type="button" class="nav-group-toggle ${abertoPorPadrao ? 'active' : ''}" data-group="${i}" aria-expanded="${abertoPorPadrao}" aria-controls="nav-sub-${i}">
                            <span class="icon" style="--tint: ${item.color}">${iconeSvg(item.svg)}</span> ${item.label}
                            <span class="chevron">›</span>
                        </button>
                        <div class="nav-sub" id="nav-sub-${i}" style="${abertoPorPadrao ? '' : 'display:none'}">
                            ${item.children.map(sub => `<a href="${sub.href}">${sub.label}</a>`).join('')}
                        </div>
                    `;
                }
                return `
                    <a href="${item.href}" class="${item.href === atual ? 'active' : ''}">
                        <span class="icon" style="--tint: ${item.color}">${iconeSvg(item.svg)}</span> ${item.label}
                    </a>
                `;
            }).join('')}
        </nav>
        <div class="sidebar-footer">
            <div class="theme-switch" id="theme-switch" role="button" tabindex="0" aria-label="Alternar tema claro/escuro">
                <span class="icone-tema escuro">${iconeSvg('<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>')}<span>Escuro</span></span>
                <span class="icone-tema claro">${iconeSvg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>')}<span>Claro</span></span>
                <span class="thumb"></span>
            </div>
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
            btn.setAttribute('aria-expanded', String(abrindo));
        });
    });

    ligarThemeSwitch();
}

// -----------------------------------------------------------------------
// Tema claro/escuro — persistido em localStorage, aplicado antes da
// primeira pintura (script inline no <head> de cada página evita o
// "flash" do tema errado). Sem preferência salva, segue o SO.
// -----------------------------------------------------------------------
function temaAtual() {
    return document.documentElement.getAttribute('data-theme')
        || (matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro');
}

function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    localStorage.setItem('tema', tema);
    const switchEl = document.getElementById('theme-switch');
    if (switchEl) switchEl.setAttribute('data-tema', tema);
}

function ligarThemeSwitch() {
    const switchEl = document.getElementById('theme-switch');
    if (!switchEl) return;
    switchEl.setAttribute('data-tema', temaAtual());
    const alternar = () => aplicarTema(temaAtual() === 'claro' ? 'escuro' : 'claro');
    switchEl.addEventListener('click', alternar);
    switchEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); }
    });
}

// -----------------------------------------------------------------------
// Contagem animada — números "sobem" do zero até o valor final ao
// carregar a tela. Chame depois de colocar o valor final no elemento.
// -----------------------------------------------------------------------
// Anima todos os elementos com [data-contagem="valorFinal"] dentro de um
// container — conveniência pra não chamar animarContagem() um por um.
function animarContagens(container) {
    (container || document).querySelectorAll('[data-contagem]').forEach(el => {
        animarContagem(el, parseFloat(el.getAttribute('data-contagem')));
    });
}

function animarContagem(el, valorFinal, opcoes) {
    const formatador = (opcoes && opcoes.formatar) || formatMoney;
    const duracao = (opcoes && opcoes.duracaoMs) || 900;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !Number.isFinite(valorFinal)) {
        el.textContent = formatador(valorFinal);
        return;
    }
    const inicio = performance.now();
    function passo(agora) {
        const t = Math.min(1, (agora - inicio) / duracao);
        const facilitado = 1 - Math.pow(1 - t, 3);
        el.textContent = formatador(valorFinal * facilitado);
        if (t < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
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

// -----------------------------------------------------------------------
// Estados de carregamento e erro reutilizáveis (tabelas e blocos avulsos).
// Erro sempre vem com um botão "Tentar de novo" ligado à mesma função que
// carregou os dados da primeira vez — sem isso, um erro de rede deixava a
// tela travada até o usuário dar F5.
// -----------------------------------------------------------------------
function carregandoHTML(texto) {
    return `<span class="state-inline"><span class="spinner" aria-hidden="true"></span>${texto || 'Carregando...'}</span>`;
}

function carregandoLinhaHTML(colspan, texto) {
    return `<tr><td colspan="${colspan}">${carregandoHTML(texto)}</td></tr>`;
}

function erroHTML(mensagem) {
    return `
        <div class="state-erro">
            <span>Erro ao carregar: ${mensagem}</span>
            <button type="button" class="secondary btn-tentar-de-novo">Tentar de novo</button>
        </div>
    `;
}

function renderErro(elemento, mensagem, retry) {
    elemento.innerHTML = erroHTML(mensagem);
    elemento.querySelector('.btn-tentar-de-novo').addEventListener('click', retry, { once: true });
}

function renderErroLinha(tbody, colspan, mensagem, retry) {
    tbody.innerHTML = `<tr><td colspan="${colspan}">${erroHTML(mensagem)}</td></tr>`;
    tbody.querySelector('.btn-tentar-de-novo').addEventListener('click', retry, { once: true });
}

// Desabilita um botão enquanto a ação assíncrona roda — evita duplo
// clique/lançamento duplicado (ex: clicar 2x rápido em "Lançar"). Reabilita
// mesmo se a ação lançar erro.
async function comBotaoOcupado(botao, acao) {
    if (!botao) return acao();
    botao.disabled = true;
    try {
        return await acao();
    } finally {
        botao.disabled = false;
    }
}

// Toast flutuante pra ações importantes (lançar, salvar, excluir) — fica
// visível por alguns segundos mesmo se o usuário já rolou a página.
function toast(mensagem, tipo) {
    let stack = document.getElementById('toast-stack');
    if (!stack) {
        stack = document.createElement('div');
        stack.id = 'toast-stack';
        stack.setAttribute('role', 'status');
        stack.setAttribute('aria-live', 'polite');
        document.body.appendChild(stack);
    }

    const el = document.createElement('div');
    el.className = `toast ${tipo === 'erro' ? 'erro' : ''}`;
    el.innerHTML = `<span class="icone">${tipo === 'erro' ? '⚠️' : '✅'}</span><span>${mensagem}</span>`;
    stack.appendChild(el);

    setTimeout(() => {
        el.classList.add('saindo');
        el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 3200);
}

// Estado vazio com ícone — mais fácil de "escanear" que um texto cinza
// solto, e a mensagem pode sugerir a próxima ação (ex: "lance seu primeiro
// movimento acima").
function estadoVazioHTML(mensagem, icone) {
    return `<div class="empty-state"><div class="empty-icon">${icone || '🗂️'}</div><p>${mensagem}</p></div>`;
}

// -----------------------------------------------------------------------
// Aviso de contraste: cor escolhida pra categoria/método fica pouco visível
// se for muito escura, quase se confundindo com o fundo do sistema (que já
// é escuro por padrão). Não bloqueia o cadastro, só avisa.
// -----------------------------------------------------------------------
function luminanciaRelativa(hex) {
    const h = (hex || '').replace('#', '');
    if (h.length !== 6) return 1;
    const [r, g, b] = [0, 2, 4].map(i => {
        let c = parseInt(h.substr(i, 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function vigiarContrasteCor(inputId, avisoId) {
    const input = document.getElementById(inputId);
    const aviso = document.getElementById(avisoId);
    if (!input || !aviso) return;

    // Agora que o sistema tem dois temas, a mesma cor cadastrada vale pros
    // dois: escura demais some no fundo escuro, clara demais some no fundo
    // claro — então o meio-termo é o que funciona em ambos.
    const checar = () => {
        const luz = luminanciaRelativa(input.value);
        let mensagem = '';
        if (luz < 0.035) mensagem = 'Essa cor é bem escura e pode ficar pouco visível no tema escuro — considere um tom mais vivo.';
        else if (luz > 0.78) mensagem = 'Essa cor é bem clara e pode ficar pouco visível no tema claro — considere um tom mais vivo.';
        aviso.textContent = mensagem;
        aviso.className = mensagem ? 'msg error' : 'msg';
    };

    input.addEventListener('input', checar);
    checar();
}

// -----------------------------------------------------------------------
// Tooltip flutuante reutilizável pra gráficos SVG — aparece na hora
// (o <title> nativo do navegador demora ~1s e não pode ser estilizado).
// -----------------------------------------------------------------------
function criarTooltipGrafico() {
    let el = document.getElementById('grafico-tooltip');
    if (!el) {
        el = document.createElement('div');
        el.id = 'grafico-tooltip';
        el.className = 'grafico-tooltip';
        document.body.appendChild(el);
    }
    return {
        mostrar(html, evento) {
            el.innerHTML = html;
            el.style.left = `${evento.clientX}px`;
            el.style.top = `${evento.clientY}px`;
            el.classList.add('visivel');
        },
        mover(evento) {
            el.style.left = `${evento.clientX}px`;
            el.style.top = `${evento.clientY}px`;
        },
        esconder() {
            el.classList.remove('visivel');
        },
    };
}

// Curva suave (Catmull-Rom convertida em Bézier cúbica) passando por todos
// os pontos — bem mais elegante que segmentos de reta ligando ponto a
// ponto, sem perder nenhum valor real no caminho.
function curvaSuave(coords) {
    if (coords.length < 3) {
        return coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    }
    let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
        const p0 = coords[i - 1] || coords[i];
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const p3 = coords[i + 2] || p2;
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
}

// Interatividade compartilhada entre os gráficos de linha (evolução da
// Carteira, projeção do Planejamento): tooltip + destaque do ponto mais
// próximo + linha-guia vertical.
function ligarInteracaoLinha(svgId, coords, formatarTooltip) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    const tooltip = criarTooltipGrafico();

    const destacar = (i) => {
        svg.querySelectorAll('.ponto-visivel').forEach(p => p.classList.toggle('ativo', Number(p.getAttribute('data-index')) === i));
        svg.querySelectorAll('.linha-guia').forEach(l => l.classList.toggle('ativa', Number(l.getAttribute('data-index')) === i));
    };
    const limpar = () => {
        svg.querySelectorAll('.ponto-visivel').forEach(p => p.classList.remove('ativo'));
        svg.querySelectorAll('.linha-guia').forEach(l => l.classList.remove('ativa'));
        tooltip.esconder();
    };

    svg.querySelectorAll('.ponto-hit').forEach(hit => {
        const i = Number(hit.getAttribute('data-index'));
        hit.addEventListener('mouseenter', (e) => {
            destacar(i);
            tooltip.mostrar(formatarTooltip(coords[i]), e);
        });
        hit.addEventListener('mousemove', (e) => tooltip.mover(e));
        hit.addEventListener('mouseleave', limpar);
    });
}

// Rolagem horizontal de tabela por teclado (setas ← →), igual planilha:
// a barra de rolagem só existe embaixo da tabela inteira, o que é inútil
// numa tabela com muitas linhas. Passando o mouse sobre a tabela (sem
// precisar clicar/focar em nada), as setas rolam ela pros lados de
// qualquer altura em que o usuário esteja.
function ligarScrollTecladoTabelas() {
    let tabelaAtiva = null;

    document.querySelectorAll('.table-scroll').forEach(el => {
        el.addEventListener('mouseenter', () => { tabelaAtiva = el; });
        el.addEventListener('mouseleave', () => { if (tabelaAtiva === el) tabelaAtiva = null; });
    });

    document.addEventListener('keydown', (e) => {
        if (!tabelaAtiva) return;
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

        const focoAtual = document.activeElement;
        const editandoCampo = focoAtual && ['INPUT', 'SELECT', 'TEXTAREA'].includes(focoAtual.tagName);
        if (editandoCampo) return;

        e.preventDefault();
        tabelaAtiva.scrollBy({ left: e.key === 'ArrowRight' ? 160 : -160, behavior: 'smooth' });
    });
}

document.addEventListener('DOMContentLoaded', ligarScrollTecladoTabelas);

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
    let cls = 'neutral';
    if (status.startsWith('✓')) cls = 'ok';
    if (status.startsWith('✗')) cls = 'bad';
    if (status.startsWith('⚠') || status.startsWith('…') || status.toLowerCase().includes('pendente') || status.toLowerCase().includes('aguardando')) cls = 'pending';
    return `<span class="pill ${cls}">${status}</span>`;
}

function caraterPill(carater) {
    if (!carater) return '';
    let cls = 'neutral';
    if (carater === 'RECEITA') cls = 'ok';
    if (carater === 'DESPESA') cls = 'bad';
    if (carater === 'RESERVA') cls = 'pending';
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

// -----------------------------------------------------------------------
// Inicializacao do TomSelect para todos os selects (com MutationObserver)
// -----------------------------------------------------------------------
function initSelects() {
    if (typeof TomSelect !== 'undefined') {
        document.querySelectorAll('select').forEach(el => {
            if (el.getAttribute('data-no-search') === 'true') return;
            
            if (el.tomselect) {
                el.tomselect.sync();
            } else {
                new TomSelect(el, {
                    create: false,
                    sortField: null,
                    placeholder: 'Digite para buscar...'
                });
            }
        });
    }
}

function setupTomSelectObserver() {
    initSelects();
    const observer = new MutationObserver((mutations) => {
        let shouldSync = false;
        mutations.forEach(m => {
            if (m.target.nodeName === 'SELECT' || m.target.nodeName === 'OPTION') {
                shouldSync = true;
            } else if (m.addedNodes.length > 0) {
                m.addedNodes.forEach(node => {
                    if (node.nodeName === 'SELECT' || (node.querySelector && node.querySelector('select'))) {
                        shouldSync = true;
                    }
                });
            }
        });
        if (shouldSync) {
            setTimeout(initSelects, 10);
        }
    });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupTomSelectObserver);
} else {
    setupTomSelectObserver();
}
