/* Gestão Computum — cliente Supabase
 * Esta chave é uma Publishable key e pode ser usada no navegador.
 * Nunca coloque aqui uma service_role key ou qualquer segredo.
 */

const SUPABASE_URL = 'https://gldaegbculoucdjluyek.supabase.co';

const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_zlfMjJXpIVvLAwaG2ZkGjQ_A-ha4qRZ';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// Teste de conexão — apenas leitura.
async function testarConexaoSupabase() {
  const { data, error } = await supabaseClient
    .from('areas_servico')
    .select('id, nome, ativo, ordem')
    .order('ordem');

  if (error) {
    console.error('Erro na conexão com Supabase:', error);
    return { ok: false, error };
  }

  console.info('Supabase conectado. Áreas carregadas:', data);
  return { ok: true, data };
}
