import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function extrairToken(req: Request) {
  const header = req.headers.get('Authorization') || '';
  return header.replace(/^Bearer\s+/i, '').trim();
}

async function obterUsuarioAuthPorToken(token: string) {
  // Os tokens atuais do Supabase deste projeto usam assinatura assimétrica
  // ES256. A validação é feita localmente contra o JWKS do projeto através
  // de getClaims(), evitando uma chamada manual ao endpoint /auth/v1/user.
  const { data, error } = await adminClient.auth.getClaims(token);

  if (error || !data?.claims?.sub) {
    console.error('Falha ao validar access token:', {
      status: error?.status || 401,
      message: error?.message || 'Token inválido.'
    });
    throw new HttpError('Sessão inválida. Faça login novamente.', 401);
  }

  return {
    id: String(data.claims.sub),
    email: data.claims.email ? String(data.claims.email) : null,
    claims: data.claims
  };
}

async function exigirAdministrador(req: Request) {
  const token = extrairToken(req);
  if (!token) throw new HttpError('Sessão não informada.', 401);

  const authUser = await obterUsuarioAuthPorToken(token);

  console.log('Verificando administrador:', {
    auth_id: authUser.id,
    auth_email: authUser.email || null
  });

  // Consulta direta ao PostgREST. Isso evita depender do estado interno
  // do cliente supabase-js dentro do runtime da Edge Function e nos permite
  // distinguir claramente falhas de banco de ausência de cadastro.
  const endpoint = `${supabaseUrl}/rest/v1/usuarios?id=eq.${encodeURIComponent(authUser.id)}&select=id,nome,email,perfil,ativo`;
  const respostaPerfil = await fetch(endpoint, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: 'application/json'
    }
  });

  const textoPerfil = await respostaPerfil.text();
  let registrosPerfil: any[] = [];
  try {
    registrosPerfil = textoPerfil ? JSON.parse(textoPerfil) : [];
  } catch (_) {
    registrosPerfil = [];
  }

  if (!respostaPerfil.ok) {
    console.error('Erro ao consultar public.usuarios via REST:', {
      auth_id: authUser.id,
      http_status: respostaPerfil.status,
      response: textoPerfil.slice(0, 1000)
    });
    throw new HttpError('Não foi possível validar o perfil administrativo.', 500);
  }

  const perfil = Array.isArray(registrosPerfil) ? registrosPerfil[0] : null;

  if (!perfil) {
    console.error('Usuário autenticado sem cadastro em public.usuarios:', {
      auth_id: authUser.id,
      auth_email: authUser.email || null
    });
    throw new HttpError('Usuário autenticado sem cadastro interno.', 403);
  }

  const perfilNormalizado = String(perfil.perfil || '').trim().toLowerCase();
  const ativo = perfil.ativo === true;

  console.log('Perfil encontrado:', {
    usuario_id: perfil.id,
    nome: perfil.nome || null,
    email: perfil.email || null,
    perfil: perfil.perfil || null,
    perfil_normalizado: perfilNormalizado,
    ativo
  });

  if (!ativo) {
    throw new HttpError('O usuário administrador está inativo.', 403);
  }

  if (perfilNormalizado !== 'administrador') {
    throw new HttpError('Acesso restrito ao administrador.', 403);
  }

  return { authUser, perfil };
}

async function aplicarPerfil(
  userId: string,
  nome: string,
  email: string,
  admin: boolean,
  calculista: boolean,
  ativo: boolean,
  calculistaId: string | null = null
) {
  const perfil = admin ? 'administrador' : calculista ? 'calculista' : 'administrativo';

  const { error: usuarioError } = await adminClient
    .from('usuarios')
    .upsert(
      { id: userId, nome, email, perfil, ativo, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );

  if (usuarioError) throw usuarioError;

  const { data: vinculado, error: vinculoError } = await adminClient
    .from('calculistas')
    .select('id, nome, ativo')
    .eq('usuario_id', userId)
    .maybeSingle();

  if (vinculoError) throw vinculoError;

  if (calculista) {
    let alvo: any = null;

    if (calculistaId) {
      const { data, error } = await adminClient
        .from('calculistas')
        .select('id, nome, usuario_id, ativo')
        .eq('id', calculistaId)
        .single();

      if (error) throw error;
      if (data.usuario_id && data.usuario_id !== userId) {
        throw new HttpError('O cadastro de calculista escolhido já está vinculado a outro usuário.', 400);
      }
      alvo = data;
    }

    if (!alvo && vinculado) alvo = vinculado;

    if (!alvo) {
      const { data: porNome, error } = await adminClient
        .from('calculistas')
        .select('id, nome, usuario_id, ativo')
        .ilike('nome', nome)
        .maybeSingle();

      if (error) throw error;
      if (porNome?.usuario_id && porNome.usuario_id !== userId) {
        throw new HttpError('Já existe um calculista com esse nome vinculado a outro usuário.', 400);
      }
      alvo = porNome;
    }

    if (alvo) {
      const { error } = await adminClient
        .from('calculistas')
        .update({ usuario_id: userId, nome, ativo: true, updated_at: new Date().toISOString() })
        .eq('id', alvo.id);

      if (error) throw error;

      if (vinculado && vinculado.id !== alvo.id) {
        const { error: unlinkError } = await adminClient
          .from('calculistas')
          .update({ usuario_id: null, updated_at: new Date().toISOString() })
          .eq('id', vinculado.id);

        if (unlinkError) throw unlinkError;
      }
    } else {
      const { error } = await adminClient
        .from('calculistas')
        .insert({ nome, usuario_id: userId, ativo: true });

      if (error) throw error;
    }
  } else if (vinculado) {
    const { error } = await adminClient
      .from('calculistas')
      .update({ usuario_id: null, updated_at: new Date().toISOString() })
      .eq('id', vinculado.id);

    if (error) throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const adminContext = await exigirAdministrador(req);

    if (req.method !== 'POST') {
      throw new HttpError('Método não permitido.', 405);
    }

    const body = await req.json();
    const action = body?.action;

    if (action === 'create') {
      const nome = String(body.nome || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const admin = body.admin === true;
      const calculista = body.calculista === true;
      const calculistaId = String(body.calculista_id || '').trim() || null;
      const ativo = body.ativo !== false;

      if (!nome || !email || password.length < 8) {
        throw new HttpError('Informe nome, e-mail e uma senha inicial com pelo menos 8 caracteres.', 400);
      }

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: nome, display_name: nome }
      });

      if (createError) throw new HttpError(createError.message, 400);

      try {
        await aplicarPerfil(created.user.id, nome, email, admin, calculista, ativo, calculistaId);
      } catch (profileError) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        throw profileError;
      }

      if (!ativo) {
        await adminClient.auth.admin.updateUserById(created.user.id, { ban_duration: '876000h' });
      }

      return json({ ok: true, user_id: created.user.id });
    }

    if (action === 'update') {
      const userId = String(body.user_id || '').trim();
      const nome = String(body.nome || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const admin = body.admin === true;
      const calculista = body.calculista === true;
      const calculistaId = String(body.calculista_id || '').trim() || null;
      const ativo = body.ativo !== false;

      if (!userId || !nome || !email) {
        throw new HttpError('Nome, e-mail e usuário são obrigatórios.', 400);
      }

      const { data: alvoAtual, error: alvoError } = await adminClient
        .from('usuarios')
        .select('id, perfil, ativo')
        .eq('id', userId)
        .single();

      if (alvoError) throw alvoError;

      if (alvoAtual?.perfil === 'administrador' && (!admin || !ativo)) {
        const { count, error: countError } = await adminClient
          .from('usuarios')
          .select('id', { count: 'exact', head: true })
          .eq('perfil', 'administrador')
          .eq('ativo', true);

        if (countError) throw countError;
        if ((count || 0) <= 1) {
          throw new HttpError('O sistema precisa manter pelo menos um administrador ativo.', 400);
        }
      }

      const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true,
        user_metadata: { name: nome, display_name: nome },
        ban_duration: ativo ? 'none' : '876000h'
      });

      if (authError) throw new HttpError(authError.message, 400);

      await aplicarPerfil(userId, nome, email, admin, calculista, ativo, calculistaId);
      return json({ ok: true });
    }

    if (action === 'delete') {
      const userId = String(body.user_id || '').trim();
      if (!userId) throw new HttpError('Usuário não informado.', 400);

      const { data: alvo, error: alvoError } = await adminClient
        .from('usuarios')
        .select('id, nome, email, perfil, ativo')
        .eq('id', userId)
        .single();

      if (alvoError) {
        if (alvoError.code === 'PGRST116') throw new HttpError('Usuário não encontrado.', 404);
        throw alvoError;
      }

      const authUser = adminContext.authUser;
      if (authUser.id === userId) {
        throw new HttpError('Não é permitido excluir o próprio usuário administrador.', 400);
      }

      if (alvo.perfil === 'administrador' && alvo.ativo === true) {
        const { count, error: countError } = await adminClient
          .from('usuarios')
          .select('id', { count: 'exact', head: true })
          .eq('perfil', 'administrador')
          .eq('ativo', true);

        if (countError) throw countError;
        if ((count || 0) <= 1) {
          throw new HttpError('O sistema precisa manter pelo menos um administrador ativo.', 400);
        }
      }

      const consultas = await Promise.all([
        adminClient.from('solicitacoes').select('id', { count: 'exact', head: true }).or(`calculista_id.eq.${userId},revisor_id.eq.${userId},created_by.eq.${userId}`),
        adminClient.from('retrabalhos').select('id', { count: 'exact', head: true }).eq('responsavel_id', userId),
        adminClient.from('arquivos').select('id', { count: 'exact', head: true }).eq('uploaded_by', userId),
        adminClient.from('pagamentos').select('id', { count: 'exact', head: true }).eq('created_by', userId),
        adminClient.from('historico_solicitacao').select('id', { count: 'exact', head: true }).eq('usuario_id', userId),
        adminClient.from('calculistas').select('id', { count: 'exact', head: true }).eq('usuario_id', userId)
      ]);

      const labels = [
        'solicitações',
        'retrabalhos',
        'arquivos',
        'pagamentos',
        'histórico',
        'cadastro de calculista'
      ];

      for (let i = 0; i < consultas.length; i++) {
        const result = consultas[i];
        if (result.error) {
          console.error(`Erro ao verificar vínculo para exclusão (${labels[i]}):`, result.error);
          throw new HttpError('Não foi possível verificar os vínculos do usuário antes da exclusão.', 500);
        }
      }

      const totalVinculos = consultas.reduce((sum, item) => sum + (item.count || 0), 0);
      if (totalVinculos > 0) {
        const detalhes = consultas
          .map((item, index) => item.count ? `${labels[index]}: ${item.count}` : null)
          .filter(Boolean)
          .join(', ');
        throw new HttpError(
          `Este usuário possui registros vinculados (${detalhes}). Desative o usuário para preservar o histórico; a exclusão definitiva não é permitida.`,
          409
        );
      }

      const { error: calcDeleteError } = await adminClient
        .from('calculistas')
        .delete()
        .eq('usuario_id', userId);
      if (calcDeleteError) throw calcDeleteError;

      const { error: usuarioDeleteError } = await adminClient
        .from('usuarios')
        .delete()
        .eq('id', userId);
      if (usuarioDeleteError) throw usuarioDeleteError;

      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (authDeleteError) {
        console.error('Usuário removido do cadastro interno, mas falhou a exclusão no Auth:', authDeleteError);
        throw new HttpError('O cadastro interno foi removido, mas não foi possível excluir a conta de autenticação. Verifique o Supabase Auth.', 500);
      }

      return json({ ok: true, deleted: true, user_id: userId });
    }

    if (action === 'ensure-profile') {
      const userId = String(body.user_id || '').trim();
      if (!userId) throw new HttpError('Usuário não informado.', 400);

      const { data: authUser, error: authError } = await adminClient.auth.admin.getUserById(userId);
      if (authError || !authUser.user) throw new HttpError('Usuário não encontrado no Auth.', 404);

      const nome = String(
        authUser.user.user_metadata?.name ||
        authUser.user.user_metadata?.display_name ||
        authUser.user.email ||
        ''
      ).trim();
      const email = String(authUser.user.email || '').trim().toLowerCase();

      await aplicarPerfil(userId, nome, email, false, false, true);
      return json({ ok: true });
    }

    throw new HttpError('Ação não reconhecida.', 400);
  } catch (error: any) {
    console.error(error);
    const status = Number.isInteger(error?.status) ? error.status : 500;
    return json({ error: error?.message || 'Erro interno.' }, status);
  }
});
