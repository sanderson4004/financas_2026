async function requireAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return null;
    }
    return session;
}

async function logout() {
    await supabase.auth.signOut();
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

function wireNavAndLogout() {
    const btn = document.getElementById('logout-btn');
    if (btn) btn.addEventListener('click', logout);
}

document.addEventListener('DOMContentLoaded', wireNavAndLogout);
