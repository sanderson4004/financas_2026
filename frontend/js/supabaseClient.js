// Chave "publishable"/"anon" — segura para ficar aqui, no código do navegador.
// O que protege os dados é a política de RLS no banco (só sanderson4004@gmail.com
// lê/escreve), não o sigilo desta chave. NUNCA coloque a chave "service_role" aqui.
const SUPABASE_URL = 'https://aowwrfunohwthxjgbycg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qzXZ_6zWFkLqUaG-_nZyHQ_2QLSYZ-j';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
