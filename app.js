/* Gestão Computum — V54 — identidade por ID, calculistas elegíveis e permissões consolidadas.
   primeira versão de frontend.
   O armazenamento local abaixo é apenas modo protótipo.
   Em produção, substituir a camada store por Supabase e o upload por Google Drive.
*/

const CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  googleDriveFolderId: '',
  googleDriveGestaoUrl: 'https://drive.google.com/drive/folders/1XgQwf79r9D7-6xwvqs_0RaKrmJGYzUh-?usp=drive_link',
  googleFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSes_cqGBuoBI8rjiW2q5kkC0M9hrs5rrqpPijeEHQHmZ8dTXA/viewform?usp=pp_url',
  productionReady: false
};
/* =========================================================
   AUTENTICAÇÃO — SUPABASE
   ========================================================= */

let currentUser = null;
let currentProfile = null;

async function carregarSessao() {
  const {
    data: { session },
    error
  } = await supabaseClient.auth.getSession();

  if (error) {
    console.error('Erro ao recuperar sessão:', error);
    mostrarLogin();
    return false;
  }

  if (!session?.user) {
    mostrarLogin();
    return false;
  }

  currentUser = session.user;

  const { data: profile, error: profileError } = await supabaseClient
    .from('usuarios')
    .select('id, nome, email, perfil, ativo')
    .eq('id', currentUser.id)
    .single();

  if (profileError) {
    console.error('Erro ao carregar perfil:', profileError);
    mostrarLogin('Não foi possível carregar o perfil do usuário.');
    return false;
  }

  if (!profile.ativo) {
    await supabaseClient.auth.signOut();
    mostrarLogin('Este usuário está inativo.');
    return false;
  }

  currentProfile = profile;
  atualizarUsuarioInterface();

  return true;
}

function isAdministrador() {
  return currentProfile?.perfil === 'administrador';
}

function isUsuario() {
  return currentProfile?.perfil === 'administrativo';
}

function podeAtribuirSolicitacao() {
  return isAdministrador() || isUsuario();
}

function rotuloPerfilUsuario(usuario = currentProfile) {
  if (!usuario) return 'Usuário';

  // O perfil administrativo é uma função própria. Um cadastro antigo de
  // calculista ou um vínculo residual não pode transformar um Usuário em
  // Calculista. As funções acumuláveis são Administrador + Calculista.
  if (usuario.perfil === 'administrativo') return 'Usuário';

  const calcVinculado = db.calculistas?.some(c => c.usuario_id === usuario.id);
  const admin = usuario.perfil === 'administrador';
  const calc = usuario.perfil === 'calculista' || calcVinculado;
  if (admin && calc) return 'Administrador · Calculista';
  if (admin) return 'Administrador';
  if (calc) return 'Calculista';
  return 'Usuário';
}

function normalizarChaveStatus(status) {
  return String(status || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function estaEmRevisao(status) {
  return normalizarChaveStatus(status) === 'EM_REVISAO';
}

function calculistasDisponiveis() {
  const usuarios = Array.isArray(db.usuarios) ? db.usuarios : [];
  const usuariosPorId = new Map(usuarios.map(u => [u.id, u]));

  return db.calculistas.filter(c => {
    if (c.ativo === false || !c.usuario_id) return false;
    const usuario = usuariosPorId.get(c.usuario_id);
    if (!usuario || usuario.ativo === false) return false;

    // Um cadastro de calculista só participa da operação quando está
    // explicitamente vinculado a um usuário que exerce a função Calculista.
    // Administrador + Calculista é representado por perfil administrador
    // com vínculo explícito ao cadastro de calculista.
    return usuario.perfil === 'calculista' || usuario.perfil === 'administrador';
  });
}

function calculistaAtual() {
  if (!currentUser?.id) return null;

  // A função Calculista só pode ser reconhecida por uma permissão explícita:
  // perfil=calculista ou vínculo calculistas.usuario_id=usuário autenticado.
  // Nunca conceder a função apenas por coincidência de nome.
  return db.calculistas.find(item =>
    item.ativo !== false &&
    item.usuario_id === currentUser.id
  ) || null;
}

// Um usuário pode exercer mais de uma função. O perfil calculista e o vínculo
// explícito com um cadastro de calculista são as únicas formas de reconhecer
// a função. Um cadastro antigo sem usuario_id não concede acesso nem aparece nas listas operacionais.
function isCalculista() {
  // Usuário (perfil administrativo) não pode herdar a função Calculista
  // por vínculo residual ou cadastro antigo.
  if (isUsuario()) return false;
  return currentProfile?.perfil === 'calculista' || !!calculistaAtual();
}

function funcoesUsuario() {
  const funcoes = [];
  if (isAdministrador()) funcoes.push('Administrador');
  if (isCalculista()) funcoes.push('Calculista');
  return funcoes;
}

function minhasSolicitacoes() {
  const calculista = calculistaAtual();
  if (!calculista) return [];
  return db.requests.filter(r => r.calculistaId === calculista.id);
}

function ultimaDevolucaoRevisao(r) {
  const eventos = Array.isArray(r?.historico) ? r.historico : [];
  return eventos
    .slice()
    .reverse()
    .find(e => {
      const tipo = normalizarChaveStatus(e?.tipo || e?.tipo_evento || '');
      const descricao = String(e?.[1] || e?.descricao || '').toLowerCase();
      return (
        tipo === 'REVISAO' &&
        (descricao.includes('devolveu o cálculo') || descricao.includes('devolveu o calculo')) &&
        descricao.includes('motivo:')
      ) || (
        descricao.includes('devolveu o cálculo') || descricao.includes('devolveu o calculo')
      );
    }) || null;
}

function motivoUltimaDevolucao(r) {
  const evento = ultimaDevolucaoRevisao(r);
  if (!evento) return '';
  const descricao = String(evento?.[1] || evento?.descricao || '');
  const marcador = descricao.match(/motivo:\s*([\s\S]*)$/i);
  return marcador ? marcador[1].trim() : '';
}

function devolucaoPendenteParaCalculista(r) {
  return !!(r && r.status === 'EM_CÁLCULO' && motivoUltimaDevolucao(r));
}

function statusLabelCalculista(r) {
  if (devolucaoPendenteParaCalculista(r)) return 'Devolvido';
  return statusLabel[r.status] || r.status;
}

function statusClassCalculista(r) {
  if (devolucaoPendenteParaCalculista(r)) return 'devolvido';
  return statusClass(r.status);
}

function atualizarUsuarioInterface() {
  if (!currentProfile) return;

  const nome = nomeExibicaoUsuario(currentProfile);

  const perfil = rotuloPerfilUsuario(currentProfile);

  const inicial = nome.trim().charAt(0).toUpperCase() || 'U';

  const sidebarName = document.getElementById('sidebarUserName');
  const sidebarProfile = document.getElementById('sidebarUserProfile');
  const sidebarAvatar = document.getElementById('sidebarAvatar');

  const topbarName = document.getElementById('topbarUserName');
  const topbarAvatar = document.getElementById('topbarAvatar');

  if (sidebarName) sidebarName.textContent = nome;
  if (sidebarProfile) sidebarProfile.textContent = perfil;
  if (sidebarAvatar) sidebarAvatar.textContent = inicial;
  if (topbarName) topbarName.textContent = nome;
  if (topbarAvatar) topbarAvatar.textContent = inicial;

  const funcoes = funcoesUsuario();
  if (sidebarProfile) sidebarProfile.textContent = funcoes.join(' · ') || perfil;

  const calc = isCalculista();
  const admin = isAdministrador();

  // Usuário tem acesso de consulta aos painéis operacionais, sem ações de edição.
  // Os próprios handlers de edição continuam protegidos por isAdministrador().
  const driveGestaoButton = document.getElementById('driveGestaoButton');
  if (driveGestaoButton) {
    driveGestaoButton.style.display = admin ? '' : 'none';
  }

  document.querySelectorAll('.nav-item[data-view]').forEach(button => {
    const view = button.dataset.view;
    let visible = true;

    if (admin) {
      visible = true;
    } else if (isUsuario()) {
      visible = [
        'dashboard',
        'solicitacoes',
        'advogados',
        'clientes',
        'processos',
        'calculistas',
        'relatorios',
        'manual'
      ].includes(view);
    } else if (calc) {
      visible = ['producao', 'manual'].includes(view);
    } else {
      visible = ['manual'].includes(view);
    }

    button.style.display = visible ? '' : 'none';
  });

  const dashboardButton = document.querySelector('.nav-item[data-view="dashboard"]');
  const productionButton = document.querySelector('.nav-item[data-view="producao"]');
  if (dashboardButton) dashboardButton.innerHTML = '<span>⌂</span> Dashboard';
  if (productionButton) productionButton.innerHTML = '<span>∑</span> Minha produção';
}


function mostrarLogin(mensagem = '') {
  const appShell = document.getElementById('appShell');

  if (!appShell) return;

  appShell.innerHTML = `
    <div class="login-screen">
      <div class="login-card">

        <div class="login-brand">
          <div class="brand-mark"><span></span></div>
          <div>
            <strong>COMPUTUM</strong>
            <small>Gestão de Cálculos</small>
          </div>
        </div>

        <h1>Entrar</h1>
        <p class="login-subtitle">
          Acesse a Gestão Computum.
        </p>

        ${mensagem ? `
          <div class="login-message">
            ${mensagem}
          </div>
        ` : ''}

        <form id="loginForm">

          <div class="field">
            <label for="loginEmail">E-mail</label>
            <input
              id="loginEmail"
              type="email"
              class="input"
              autocomplete="email"
              required
            >
          </div>

          <div class="field">
            <label for="loginPassword">Senha</label>
            <input
              id="loginPassword"
              type="password"
              class="input"
              autocomplete="current-password"
              required
            >
          </div>

          <button
            type="submit"
            class="btn btn-primary login-button"
          >
            Entrar
          </button>

          <div id="loginError" class="login-error"></div>

        </form>

      </div>
    </div>
  `;

  const form = document.getElementById('loginForm');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const button = form.querySelector('button[type="submit"]');
    const errorBox = document.getElementById('loginError');

    button.disabled = true;
    button.textContent = 'Entrando...';
    errorBox.textContent = '';

    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Erro de login:', error);
      errorBox.textContent = 'E-mail ou senha inválidos.';
      button.disabled = false;
      button.textContent = 'Entrar';
      return;
    }

    window.location.reload();
  });
}

/* =========================================================
   DADOS — SUPABASE
   ========================================================= */

const db = {
  requests: [],
  calculistas: [],
  usuarios: [],
  advogados: [],
  clientes: [],
  processos: [],
  areas: [],
  tipos: [],
  retrabalhosCount: 0,
  save() {
    // A persistência no Supabase será feita pelas operações CRUD.
    // Nesta etapa, a leitura já vem do banco.
  }
};

function normalizarStatus(status) {
  const chave = normalizarChaveStatus(status);
  const mapa = {
    NOVO: 'NOVO',
    ANALISE: 'ANALISE',
    AGUARDANDO_DOCUMENTOS: 'AGUARDANDO_DOCUMENTOS',
    EM_CALCULO: 'EM_CÁLCULO',
    EM_REVISAO: 'EM_REVISÃO',
    ENVIADO: 'ENVIADO',
    AGUARDANDO_PAGAMENTO: 'AGUARDANDO_PAGAMENTO',
    CONCLUIDO: 'CONCLUÍDO',
    IMPUGNACAO: 'IMPUGNADO',
    RETRABALHO: 'RETRABALHO',
    PAUSADO: 'PAUSADO',
    CANCELADO: 'CANCELADO'
  };

  return mapa[chave] || status || 'NOVO';
}

function normalizarPrioridade(prioridade) {
  const mapa = {
    normal: 'Normal',
    alta: 'Alta',
    urgente: 'Urgente'
  };

  return mapa[prioridade] || prioridade || 'Normal';
}

async function carregarSolicitacoes() {
  try {
    const [
      solicitacoesResult,
      advogadosResult,
      clientesResult,
      processosResult,
      areasResult,
      tiposResult,
      calculistasResult,
      usuariosResult,
      sistemasResult,
      pagamentosResult,
      historicoResult,
      retrabalhosResult
    ] = await Promise.all([
      supabaseClient
        .from('solicitacoes')
        .select(`
          id,
          codigo,
          advogado_id,
          cliente_id,
          processo_id,
          area_id,
          tipo_servico_id,
          tipo_servico_outro,
          descricao,
          prazo,
          status,
          prioridade,
          calculista_id,
          revisor_id,
          tipo_entrega,
          data_solicitacao,
          data_inicio,
          data_conclusao,
          data_envio,
          valor_cobrado,
          desconto,
          valor_final,
          origem,
          cliente_antigo,
          google_drive_folder_id,
          google_drive_url,
          observacoes,
          created_by,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false }),

      supabaseClient
        .from('advogados')
        .select('id, nome, origem, ativo'),

      supabaseClient
        .from('clientes')
        .select('id, nome, cpf'),

      supabaseClient
        .from('processos')
        .select('id, numero_processo, cliente_id'),

      supabaseClient
        .from('areas_servico')
        .select('id, nome, ativo, ordem'),

      supabaseClient
        .from('tipos_servico')
        .select('id, area_id, nome, ativo, ordem'),

      supabaseClient
        .from('calculistas')
        .select('id, nome, ativo')
        .eq('ativo', true)
        .order('nome'),

      supabaseClient
        .from('usuarios')
        .select('id, nome, email, perfil, ativo'),

      supabaseClient
        .from('sistemas_especializados')
        .select('id, nome, url, area_id, descricao, ativo, ordem'),

      supabaseClient
        .from('pagamentos')
        .select('id, solicitacao_id, valor, data_pagamento, forma_pagamento, observacao, conta_recebimento, recibo_emitido, recibo_numero, recibo_data, recibo_observacoes, recibo_drive_url, created_at'),

      supabaseClient
        .from('historico_solicitacao')
        .select('id, solicitacao_id, usuario_id, tipo_evento, descricao, data_hora')
        .order('data_hora', { ascending: true }),

      supabaseClient
        .from('retrabalhos')
        .select('id')
    ]);

    const resultados = [
      solicitacoesResult,
      advogadosResult,
      clientesResult,
      processosResult,
      areasResult,
      tiposResult,
      calculistasResult,
      usuariosResult,
      sistemasResult,
      pagamentosResult,
      historicoResult,
      retrabalhosResult
    ];

    const erro = resultados.find(resultado => resultado.error);

    if (erro) {
      console.error('Erro ao carregar dados do Supabase:', erro.error);

      $('#content').innerHTML = `
        <div class="card" style="padding:24px">
          <h2>Não foi possível carregar as solicitações.</h2>
          <p class="muted" style="margin-top:8px">
            Verifique a conexão com o Supabase e tente novamente.
          </p>
        </div>
      `;

      return false;
    }

    const solicitacoes = solicitacoesResult.data || [];
    const advogados = advogadosResult.data || [];
    const clientes = clientesResult.data || [];
    const processos = processosResult.data || [];
    const areas = areasResult.data || [];
    const tipos = tiposResult.data || [];
    const calculistas = calculistasResult.data || [];
    const usuarios = usuariosResult.data || [];

    let calculistasComVinculo = calculistas;
    const linksResult = await supabaseClient
      .from('calculistas')
      .select('id, usuario_id');

    if (!linksResult.error) {
      const links = new Map((linksResult.data || []).map(item => [item.id, item.usuario_id]));
      calculistasComVinculo = calculistas.map(item => ({ ...item, usuario_id: links.get(item.id) || null }));
    }

    db.calculistas = calculistasComVinculo;
    db.usuarios = usuarios;
    db.advogados = advogados;
    db.clientes = clientes;
    db.processos = processos;
    db.areas = areas;
    db.tipos = tipos;

    const sistemas = sistemasResult.data || [];
    const pagamentos = pagamentosResult.data || [];
    const historico = historicoResult.data || [];
    const retrabalhos = retrabalhosResult.data || [];

    db.retrabalhosCount = retrabalhos.length;

    const advogadoMap = new Map(
      advogados.map(item => [item.id, item])
    );

    const clienteMap = new Map(
      clientes.map(item => [item.id, item])
    );

    const processoMap = new Map(
      processos.map(item => [item.id, item])
    );

    const areaMap = new Map(
      areas.map(item => [item.id, item])
    );

    const tipoMap = new Map(
      tipos.map(item => [item.id, item])
    );

    const usuarioMap = new Map(
      usuarios.map(item => [item.id, item])
    );

    const sistemaMap = new Map(
      sistemas.map(item => [item.area_id, item])
    );

    const pagamentosPorSolicitacao = new Map();
    const pagamentosDetalhesPorSolicitacao = new Map();

    pagamentos.forEach(pagamento => {
      const atual =
        pagamentosPorSolicitacao.get(pagamento.solicitacao_id) || 0;

      pagamentosPorSolicitacao.set(
        pagamento.solicitacao_id,
        atual + Number(pagamento.valor || 0)
      );
      const detalhes = pagamentosDetalhesPorSolicitacao.get(pagamento.solicitacao_id) || [];
      detalhes.push(pagamento);
      pagamentosDetalhesPorSolicitacao.set(pagamento.solicitacao_id, detalhes);
    });

    const historicoPorSolicitacao = new Map();

    historico.forEach(evento => {
      const lista =
        historicoPorSolicitacao.get(evento.solicitacao_id) || [];

      const usuario = usuarioMap.get(evento.usuario_id);

      lista.push([
        new Date(evento.data_hora).toLocaleString('pt-BR'),
        evento.descricao || evento.tipo_evento || 'Evento registrado',
        usuario?.nome || '',
        usuario?.email || ''
      ]);

      historicoPorSolicitacao.set(
        evento.solicitacao_id,
        lista
      );
    });

    db.requests = solicitacoes.map(solicitacao => {
      const advogado = advogadoMap.get(solicitacao.advogado_id);
      const cliente = clienteMap.get(solicitacao.cliente_id);
      const processo = processoMap.get(solicitacao.processo_id);
      const area = areaMap.get(solicitacao.area_id);
      const tipo = tipoMap.get(solicitacao.tipo_servico_id);
      const tipoServicoNome = tipo?.nome || 'Não informado';
      const tipoServicoOutro = String(solicitacao.tipo_servico_outro || '').trim();
      const tipoServicoExibicao =
        tipoServicoNome === 'Outro' && tipoServicoOutro
          ? `Outro — ${tipoServicoOutro}`
          : tipoServicoNome;

      const calculista =
        db.calculistas.find(
          item => item.id === solicitacao.calculista_id
        );

      const revisor = usuarioMap.get(solicitacao.revisor_id);
      const sistema = sistemaMap.get(solicitacao.area_id);

      return {
        id: solicitacao.id,
        advogadoId: solicitacao.advogado_id || '',
        clienteId: solicitacao.cliente_id || '',
        processoId: solicitacao.processo_id || '',
        areaId: solicitacao.area_id || '',
        tipoId: solicitacao.tipo_servico_id || '',
        calculistaId: solicitacao.calculista_id || '',
        codigo: solicitacao.codigo,
        advogado: advogado?.nome || 'Não informado',
        cliente: cliente?.nome || 'Não informado',
        processo: processo?.numero_processo || 'Não informado',
        area: area?.nome || 'Não informado',
        tipo: tipoServicoExibicao,
        tipoServicoNome,
        tipoServicoOutro,
        tipoEntrega: solicitacao.tipo_entrega || 'calculo',
        status: normalizarStatus(solicitacao.status),
        prioridade: normalizarPrioridade(solicitacao.prioridade),
        calculista: calculista?.nome || '',
        revisor: revisor?.nome || '',
        prazo: solicitacao.prazo || '',

        valor: Number(
          Number(solicitacao.valor_final || 0) > 0
            ? solicitacao.valor_final
            : (solicitacao.valor_cobrado || 0)
        ),

        recebido: Number(
          pagamentosPorSolicitacao.get(solicitacao.id) || 0
        ),

        pagamentos: (pagamentosDetalhesPorSolicitacao.get(solicitacao.id) || [])
          .slice()
          .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''))),

        ultimoPagamento: (() => {
          const lista = (pagamentosDetalhesPorSolicitacao.get(solicitacao.id) || []).slice();
          lista.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
          return lista.at(-1) || null;
        })(),

        origem: solicitacao.origem || advogado?.origem || '',
        sistema: sistema?.nome || '',
        descricao: solicitacao.descricao || '',

        data: solicitacao.data_solicitacao
          ? solicitacao.data_solicitacao.slice(0, 10)
          : '',

        drive: solicitacao.google_drive_url || '',

        historico:
          historicoPorSolicitacao.get(solicitacao.id) || []
      };
    });

    console.info(
      `Supabase: ${db.requests.length} solicitação(ões) carregada(s).`
    );

    return true;

  } catch (error) {
    console.error(
      'Erro inesperado ao carregar dados:',
      error
    );

    $('#content').innerHTML = `
      <div class="card" style="padding:24px">
        <h2>Erro ao carregar os dados.</h2>
        <p class="muted" style="margin-top:8px">
          Ocorreu um erro inesperado ao consultar o Supabase.
        </p>
      </div>
    `;

    return false;
  }
}

const state = {
  view: 'dashboard',
  query: '',
  status: '',
  area: '',
  selected: null,
  manualTab: 'visao',
  manualQuery: '',
  financeQuery: '',
  financeStatus: '',
  financeArea: ''
};

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const money = n =>
  Number(n || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

const fmtDate = s =>
  s
    ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR')
    : '—';

const today = new Date();

const daysTo = s =>
  s
    ? Math.ceil(
        (
          new Date(s + 'T12:00:00') -
          new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
          )
        ) / 86400000
      )
    : 9999;

const statusLabel = {
  NOVO: 'Novo',
  ANALISE: 'Análise',
  AGUARDANDO_DOCUMENTOS: 'Aguardando documentos',
  EM_CÁLCULO: 'Em cálculo',
  EM_REVISÃO: 'Em revisão',
  ENVIADO: 'Enviado',
  AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
  CONCLUÍDO: 'Concluído',
  IMPUGNADO: 'Impugnado',
  PAUSADO: 'Pausado',
  CANCELADO: 'Cancelado',
  RETRABALHO: 'Retrabalho'
};

const statusClass = s =>
  ({
    NOVO: 'novo',
    ANALISE: 'analise',
    AGUARDANDO_DOCUMENTOS: 'aguardando',
    EM_CÁLCULO: 'calculo',
    EM_REVISÃO: 'revisao',
    ENVIADO: 'enviado',
    AGUARDANDO_PAGAMENTO: 'pagamento',
    CONCLUÍDO: 'concluido',
    IMPUGNADO: 'impugnado',
    RETRABALHO: 'retrabalho',
    PAUSADO: 'pausado',
    CANCELADO: 'cancelado'
  }[s] || 'novo');

function showToast(msg) {
  const t = $('#toast');

  t.textContent = msg;
  t.classList.add('show');

  setTimeout(
    () => t.classList.remove('show'),
    2600
  );
}

function extrairGoogleDriveFolderId(url) {
  const texto = String(url || '').trim();

  const padroes = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/
  ];

  for (const padrao of padroes) {
    const match = texto.match(padrao);
    if (match) return match[1];
  }

  return '';
}

function abrirPastaGestao() {
  if (!isAdministrador()) {
    showToast('Acesso restrito ao administrador.');
    return;
  }

  const url = CONFIG.googleDriveGestaoUrl;

  if (!url) {
    showToast('A pasta de Gestão ainda não foi configurada.');
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

function abrirFormularioForms(r) {
  const url = CONFIG.googleFormUrl;

  if (!url) {
    showToast('O endereço do Google Forms ainda não foi configurado.');
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

function abrirVincularPastaModal(r) {
  $('#modalRoot').innerHTML = `
    <div class="modal-backdrop" id="driveLinkModal">
      <div class="modal">
        <div class="modal-head">
          <h2>Vincular pasta do Google Drive</h2>
          <button class="close" data-close>×</button>
        </div>

        <form id="driveLinkForm">
          <div class="modal-body">
            <div class="notice" style="margin-bottom:16px">
              Solicitação: <strong>${r.codigo}</strong><br>
              Cole aqui o link da pasta criada pelo Apps Script no Google Drive.
            </div>

            <div class="field">
              <label for="driveFolderUrl">Link da pasta</label>
              <input
                id="driveFolderUrl"
                name="driveFolderUrl"
                class="input"
                type="url"
                placeholder="https://drive.google.com/drive/folders/..."
                value="${r.drive || ''}"
                required
              >
            </div>

            <small class="muted" style="display:block;margin-top:8px">
              O link permanece privado conforme as permissões da sua conta Google.
            </small>
          </div>

          <div class="modal-foot">
            <button type="button" class="btn" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar vínculo</button>
          </div>
        </form>
      </div>
    </div>
  `;

  $('#driveLinkModal').addEventListener('click', e => {
    if (e.target.matches('[data-close]')) {
      closeModal();
    }
  });

  $('#driveLinkForm').addEventListener('submit', async e => {
    e.preventDefault();

    const url = e.target.driveFolderUrl.value.trim();
    const folderId = extrairGoogleDriveFolderId(url);
    const button = e.target.querySelector('button[type="submit"]');

    if (!folderId) {
      showToast('Cole um link válido de uma pasta do Google Drive.');
      return;
    }

    button.disabled = true;
    button.textContent = 'Salvando...';

    const { error } = await supabaseClient
      .from('solicitacoes')
      .update({
        google_drive_folder_id: folderId,
        google_drive_url: url,
        updated_at: new Date().toISOString()
      })
      .eq('id', r.id);

    if (error) {
      console.error('Erro ao vincular pasta do Drive:', error);
      showToast('Não foi possível salvar o vínculo com o Drive.');
      button.disabled = false;
      button.textContent = 'Salvar vínculo';
      return;
    }

    const item = db.requests.find(x => x.id === r.id);
    if (item) item.drive = url;

    closeModal();
    showToast('Pasta do Google Drive vinculada.');
    openDetail(r.id);
  });
}

let renderEmAndamento = false;
let renderPendente = false;
let queryRenderTimer = null;

function definirSidebarMobileRecolhida(recolhida) {
  if (window.innerWidth >= 801) return;

  const shell = $('#appShell');
  const button = $('#sidebarCollapseBtn');
  if (!shell) return;

  shell.classList.toggle('mobile-sidebar-collapsed', recolhida);

  if (button) {
    button.setAttribute('aria-label', recolhida ? 'Expandir menu' : 'Recolher menu');
    button.setAttribute('title', recolhida ? 'Expandir menu' : 'Recolher menu');
  }
}

function alternarSidebarMobile() {
  if (window.innerWidth >= 801) return;
  const shell = $('#appShell');
  if (!shell) return;

  definirSidebarMobileRecolhida(
    !shell.classList.contains('mobile-sidebar-collapsed')
  );
}

function nav(view) {
  if (!view || !views[view]) view = 'dashboard';

  if (isAdministrador()) {
    // administrador pode acessar todas as áreas
  } else if (isUsuario()) {
    if (!['dashboard', 'solicitacoes', 'advogados', 'clientes', 'processos', 'calculistas', 'relatorios', 'manual'].includes(view)) view = 'dashboard';
  } else if (isCalculista()) {
    if (!['producao', 'manual'].includes(view)) view = 'producao';
  } else {
    view = 'manual';
  }

  if (state.view === view && !renderEmAndamento) {
    activeNav();
    return;
  }

  state.view = view;
  state.query = '';
  if (view !== 'financeiro') {
    state.financeQuery = '';
    state.financeStatus = '';
    state.financeArea = '';
  }

  render();
}

function activeNav() {
  $$('.nav-item[data-view]').forEach(button => {
    const ativo = button.dataset.view === state.view;
    button.classList.toggle('active', ativo);
    button.setAttribute('aria-current', ativo ? 'page' : 'false');
  });
}

function render() {
  if (renderEmAndamento) {
    renderPendente = true;
    return;
  }

  renderEmAndamento = true;

  try {
    if (!isAdministrador() && isUsuario() && !['dashboard', 'solicitacoes', 'advogados', 'clientes', 'processos', 'calculistas', 'relatorios', 'manual'].includes(state.view)) {
      state.view = 'dashboard';
    } else if (!isAdministrador() && !isUsuario() && isCalculista() && !['producao', 'manual'].includes(state.view)) {
      state.view = 'producao';
    } else if (!isAdministrador() && !isCalculista() && !isUsuario()) {
      state.view = 'manual';
    }

    const titles = {
      dashboard: 'Dashboard',
      producao: 'Minha produção',
      solicitacoes: 'Solicitações',
      advogados: 'Advogados',
      clientes: 'Clientes',
      processos: 'Processos',
      calculistas: 'Calculistas',
      usuarios: 'Gerenciar usuários',
      financeiro: 'Financeiro',
      relatorios: 'Relatórios',
      configuracoes: 'Configurações',
      manual: 'Manual'
    };

    const content = $('#content');
    const breadcrumb = $('#breadcrumb');
    const fn = views[state.view] || views.dashboard;

    if (breadcrumb) breadcrumb.textContent = titles[state.view] || 'Dashboard';
    if (content) content.innerHTML = fn();

    activeNav();
  } finally {
    renderEmAndamento = false;
  }

  if (renderPendente) {
    renderPendente = false;
    requestAnimationFrame(() => render());
  }
}

function tutorialIcon(name) {
  const icons = {
    dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5M9 21v-6h6v6"/></svg>',
    solicitacoes: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3.5h6M8 8h8M8 12h8M8 16h5"/></svg>',
    advogados: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.7-3.5 3-5.3 6.5-5.3s5.8 1.8 6.5 5.3"/></svg>',
    clientes: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.8 20c.6-3.4 2.4-5.1 5.2-5.1s4.6 1.7 5.2 5.1"/><path d="M16 5.5a3 3 0 0 1 0 5.8M16 14.9c2.5.3 4 2 4.4 4.1"/></svg>',
    processos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5M10 12h5M10 16h5"/></svg>',
    calculistas: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><rect x="7" y="6" width="10" height="3" rx="1"/><path d="M8 13h2M14 13h2M8 17h2M14 17h2"/></svg>',
    usuarios: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.6-3.4 2.5-5.2 5.5-5.2s4.9 1.8 5.5 5.2"/><path d="M16 11a3 3 0 1 0 0-6"/><path d="M16 14.8c2.3.5 3.8 2.1 4.3 4.7"/></svg>',
    financeiro: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M14.8 8.7c-.7-.7-1.7-1.1-2.9-1.1-1.8 0-3 .8-3 2 0 3.1 6 1.4 6 4.5 0 1.2-1.2 2.1-3.1 2.1-1.3 0-2.4-.4-3.2-1.2M12 6v12"/></svg>',
    relatorios: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9M12 19V5M19 19v-7"/><path d="M3 19h18"/></svg>',
    manual: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v18H7.5A2.5 2.5 0 0 0 5 22V4.5Z"/><path d="M5 4.5V20M9 7h7M9 11h7M9 15h5"/></svg>',
    configuracoes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19 13.5 1.2 1-.9 1.6-1.5-.5a7.8 7.8 0 0 1-1.4 1.4l.5 1.5-1.6.9-1-1.2a7.5 7.5 0 0 1-1.9.3l-.5 1.5h-1.8l-.5-1.5a7.5 7.5 0 0 1-1.9-.3l-1 1.2-1.6-.9.5-1.5a7.8 7.8 0 0 1-1.4-1.4l-1.5.5-.9-1.6 1.2-1a7.5 7.5 0 0 1-.2-1.5c0-.5.1-1 .2-1.5l-1.2-1 .9-1.6 1.5.5A7.8 7.8 0 0 1 7.2 7l-.5-1.5 1.6-.9 1 1.2a7.5 7.5 0 0 1 1.9-.3l.5-1.5h1.8l.5 1.5a7.5 7.5 0 0 1 1.9.3l1-1.2 1.6.9-.5 1.5a7.8 7.8 0 0 1 1.4 1.4l1.5-.5.9 1.6-1.2 1c.1.5.2 1 .2 1.5s-.1 1-.2 1.5Z"/></svg>'
  };
  return icons[name] || icons.dashboard;
}

function tutorialForView(view) {
  const data = {
    dashboard: { title: 'Visão geral', steps: ['Acompanhe o volume de solicitações, os valores a receber e os valores já recebidos.', 'Identifique rapidamente as demandas que precisam de atenção, como prazos e pagamentos pendentes.', 'Abra uma solicitação para consultar documentos, responsáveis, prazo, valores e histórico.'] },
    solicitacoes: { title: 'Como funciona Solicitações', steps: ['Cadastre a demanda com advogado, cliente, processo, serviço e prazo.', 'Atribua o calculista e acompanhe o status da produção.', 'Use os detalhes para enviar documentos pelo Forms e acessar a pasta no Drive.'] },
    advogados: { title: 'Como funciona Advogados', steps: ['Cadastre quem solicita os cálculos.', 'Mantenha os dados de contato organizados para reutilização nas solicitações.', 'Acesse as solicitações relacionadas a cada advogado.'] },
    clientes: { title: 'Como funciona Clientes', steps: ['Cadastre os clientes atendidos pelo escritório.', 'Centralize os dados básicos para evitar novos cadastros repetidos.', 'Use o cadastro como referência ao criar solicitações e processos.'] },
    processos: { title: 'Como funciona Processos', steps: ['Registre os números dos processos e seus dados de referência.', 'Associe processos às solicitações quando necessário.', 'Consulte rapidamente o histórico relacionado ao processo.'] },
    calculistas: { title: 'Como funciona Calculistas', steps: ['Cadastre os profissionais que executam os cálculos.', 'Mantenha os calculistas ativos disponíveis para atribuição.', 'A distribuição das solicitações determina o que aparece no painel de produção de cada calculista.'] },
    usuarios: { title: 'Como funciona Gerenciar usuários', steps: ['Administre contas de acesso já existentes ou crie novas contas.', 'Defina Administrador, Calculista ou as duas funções para a mesma pessoa.', 'Altere dados de acesso e situação sem apagar o histórico operacional.'] },
    financeiro: { title: 'Como funciona Financeiro', steps: ['Acompanhe valores cobrados e recebidos.', 'Registre pagamentos vinculados às solicitações.', 'Use essas informações para acompanhar saldos pendentes.'] },
    relatorios: { title: 'Como funciona Relatórios', steps: ['Consulte os dados consolidados da operação.', 'Use os relatórios para acompanhar volume, prazos e situação das demandas.', 'Os relatórios servem como apoio à gestão e não alteram os registros.'] },
    configuracoes: { title: 'Como funciona Configurações', steps: ['Consulte as configurações gerais do sistema.', 'Mantenha os parâmetros e integrações organizados.', 'Alterações sensíveis devem ser feitas somente por usuários autorizados.'] },
    producao: { title: 'Como funciona Minha produção', steps: ['Veja somente as solicitações atribuídas ao seu cadastro de calculista.', 'Abra uma demanda para consultar documentos, orientações, prazo e sistema especializado.', 'Inicie o cálculo e, quando terminar a produção técnica, envie para revisão. A entrega e o pagamento são etapas administrativas.'] },
    manual: { title: 'Manual do sistema', steps: ['Consulte as orientações completas para a operação do Gestão Computum.', 'Use o manual correspondente ao seu perfil para entender responsabilidades, status e fluxos.', 'A documentação acompanha a evolução do sistema e deve ser consultada quando uma nova etapa for implantada.'] }
  };
  return { ...(data[view] || data.dashboard), icon: tutorialIcon(view) };
}

function abrirTutorialModal(view = state.view) {
  const g = tutorialForView(view);
  $('#modalRoot').innerHTML = `
    <div class="modal-backdrop" id="tutorialModal">
      <div class="modal tutorial-modal">
        <div class="modal-head">
          <div>
            <span class="eyebrow">ORIENTAÇÃO</span>
            <h2>${g.title}</h2>
          </div>
          <button class="close" data-close type="button" aria-label="Fechar">×</button>
        </div>
        <div class="modal-body">
          <div class="tutorial-list">${g.steps.map((step, i) => `<div class="tutorial-list-item"><span class="tutorial-step">${i + 1}</span><span class="tutorial-step-text">${step}</span></div>`).join('')}</div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-primary" data-close type="button">Entendi</button>
        </div>
      </div>
    </div>
  `;
  $('#tutorialModal').addEventListener('click', e => {
    if (e.target.matches('[data-close]')) closeModal();
  });
}

function pageHead(title, sub, action = '') {
  const guide = tutorialForView(state.view);
  return `
    <div class="page-head">
      <div>
        <div class="page-title-line">
          <h1>${title}</h1>
          <button class="tutorial-trigger" type="button" data-tutorial aria-label="Como funciona esta área" title="Como funciona esta área">${guide.icon}</button>
        </div>
        <p${state.view === 'solicitacoes' ? ' id="requestSearchSummary"' : ''}>${sub}</p>
      </div>
      ${action ? `<div class="actions">${action}</div>` : ''}
    </div>
  `;
}

function kpi(label, value, sub) {
  return `
    <div class="card kpi">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
      <div class="sub">${sub}</div>
    </div>
  `;
}

function codigoComCopia(codigo) {
  const valor = String(codigo || '');
  return `
    <span class="request-code">
      <button
        type="button"
        class="copy-code-btn"
        data-copy-code="${escapeHtml(valor)}"
        aria-label="Copiar código ${escapeHtml(valor)}"
        title="Copiar código"
      >⧉</button>
      <strong>${escapeHtml(valor)}</strong>
    </span>
  `;
}

function codigoComAberturaFinanceiro(codigo, id) {
  const valor = String(codigo || '');
  return `
    <span class="request-code">
      <button
        type="button"
        class="request-open-code"
        data-open="${escapeHtml(id)}"
        title="Abrir solicitação ${escapeHtml(valor)}"
      >${escapeHtml(valor)}</button>
      <button
        type="button"
        class="copy-code-btn"
        data-copy-code="${escapeHtml(valor)}"
        aria-label="Copiar código ${escapeHtml(valor)}"
        title="Copiar código"
      >⧉</button>
    </span>
  `;
}

async function copiarCodigo(codigo) {
  const valor = String(codigo || '').trim();
  if (!valor) return;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(valor);
    } else {
      const area = document.createElement('textarea');
      area.value = valor;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    showToast('Código copiado.');
  } catch (error) {
    console.error('Erro ao copiar código:', error);
    showToast('Não foi possível copiar o código.');
  }
}

function requestRow(r) {
  return `
    <tr>
      <td>
        <span class="request-code">
          <button
            type="button"
            class="request-open-code"
            data-open="${r.id}"
            title="Abrir solicitação ${escapeHtml(r.codigo)}"
          >${escapeHtml(r.codigo)}</button>
          <button
            type="button"
            class="copy-code-btn"
            data-copy-code="${escapeHtml(r.codigo)}"
            aria-label="Copiar código ${escapeHtml(r.codigo)}"
            title="Copiar código"
          >⧉</button>
        </span>
      </td>
      <td>${r.advogado}</td>
      <td>${r.cliente}</td>
      <td>${r.tipo}</td>
      <td>
        ${
          r.calculista ||
          '<span class="muted">Não atribuído</span>'
        }
      </td>
      <td>${fmtDate(r.prazo)}</td>
      <td>
        <span class="status ${statusClass(r.status)}">
          ${statusLabel[r.status] || r.status}
        </span>
      </td>
      <td class="money">${money(r.valor)}</td>
    </tr>
  `;
}

function tableRequests(rows) {
  if (!rows.length) {
    return `
      <div class="empty">
        Nenhuma solicitação encontrada.
      </div>
    `;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Advogado</th>
            <th>Cliente</th>
            <th>Serviço</th>
            <th>Calculista</th>
            <th>Prazo</th>
            <th>Status</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(requestRow).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function calculistaDashboard() {
  const rows = minhasSolicitacoes();
  const abertas = rows.filter(r => !['CONCLUÍDO', 'CANCELADO'].includes(r.status));
  const novas = rows.filter(r => r.status === 'NOVO');
  const calculo = rows.filter(r => r.status === 'EM_CÁLCULO');
  const revisao = rows.filter(r => estaEmRevisao(r.status));
  const atrasadas = abertas.filter(r => daysTo(r.prazo) < 0);
  const concluidas = rows.filter(r => r.status === 'CONCLUÍDO').length;

  const tarefaRow = r => `
    <tr data-open-calculista="${r.id}" style="cursor:pointer">
      <td>${codigoComCopia(r.codigo)}</td>
      <td>${r.cliente}</td>
      <td>${r.tipo}</td>
      <td>${r.processo}</td>
      <td>${fmtDate(r.prazo)}</td>
      <td><span class="status ${statusClassCalculista(r)}">${statusLabelCalculista(r)}</span></td>
      <td>${r.prioridade}</td>
    </tr>`;

  return pageHead(
    `Olá, ${currentProfile?.nome || 'Calculista'}`,
    'Minha produção — solicitações atribuídas a você.',
    ''
  ) + `
    <div class="grid kpi-grid calculista-kpis">
      ${kpi('Novas', novas.length, 'Aguardando início')}
      ${kpi('Em cálculo', calculo.length, 'Trabalhos em andamento')}
      ${kpi('Em revisão', revisao.length, 'Aguardando conferência')}
      ${kpi('Atrasadas', atrasadas.length, 'Exigem atenção')}
      ${kpi('Concluídas', concluidas, 'Histórico da sua produção')}
    </div>

    <section class="card calculista-flow" style="margin-top:18px">
      <div class="card-head">
        <div>
          <h2>Seu fluxo de trabalho</h2>
          <p class="muted" style="margin-top:4px">Você executa a produção e envia o cálculo para revisão. A entrega e o encerramento financeiro são administrativos.</p>
        </div>
      </div>
      <div class="flow-steps">
        <div class="flow-step"><span>1</span><strong>Receber</strong><small>Solicitação atribuída</small></div>
        <div class="flow-arrow">→</div>
        <div class="flow-step"><span>2</span><strong>Calcular</strong><small>Produção do cálculo</small></div>
        <div class="flow-arrow">→</div>
        <div class="flow-step"><span>3</span><strong>Revisar</strong><small>Enviar para revisão</small></div>
        <div class="flow-arrow">→</div>
        <div class="flow-step muted-step"><span>4</span><strong>Entregar</strong><small>Etapa administrativa</small></div>
      </div>
    </section>

    <section class="card" style="margin-top:18px">
      <div class="card-head">
        <div>
          <h2>Minhas solicitações</h2>
          <p class="muted" style="margin-top:4px">Abra uma solicitação para consultar documentos, orientações e executar a próxima etapa.</p>
        </div>
      </div>
      ${rows.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th><th>Cliente</th><th>Serviço</th><th>Processo</th><th>Prazo</th><th>Status</th><th>Prioridade</th>
              </tr>
            </thead>
            <tbody>${rows.map(tarefaRow).join('')}</tbody>
          </table>
        </div>` : `
        <div class="empty">Nenhuma solicitação foi atribuída a você.</div>`}
    </section>
  `;
}


function saldoPendente(r) {
  return Math.max(0, Number(r?.valor || 0) - Number(r?.recebido || 0));
}

function formatarFormaPagamento(valor) {
  const mapa = {
    PIX: 'PIX',
    CREDITO: 'Crédito',
    DEBITO: 'Débito',
    TRANSFERENCIA: 'Transferência',
    DINHEIRO: 'Dinheiro',
    CARTAO: 'Cartão',
    OUTRO: 'Outro'
  };
  return mapa[String(valor || '').toUpperCase()] || valor || '—';
}

function abrirModalConclusaoFinanceira(r) {
  if (!isAdministrador()) return;
  if (r.status !== 'AGUARDANDO_PAGAMENTO') {
    showToast('A solicitação precisa estar aguardando pagamento para registrar um recebimento.');
    return;
  }

  const saldo = saldoPendente(r);
  const dataPadrao = new Date().toISOString().slice(0, 10);
  const recebimentos = Array.isArray(r.pagamentos) ? r.pagamentos.slice().sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''))) : [];

  $('#modalRoot').innerHTML = `
    <div class="modal-backdrop" id="financialCloseModal">
      <div class="modal financial-modal" style="max-width:900px">
        <div class="modal-head">
          <div>
            <h2>Registrar recebimento</h2>
            <small class="muted">${escapeHtml(r.codigo)} · ${escapeHtml(r.cliente)}</small>
          </div>
          <button class="close" data-close>×</button>
        </div>
        <form id="financialCloseForm">
          <div class="modal-body">
            <div class="financial-summary">
              <div><small>Valor do serviço</small><strong>${money(r.valor)}</strong></div>
              <div><small>Total já recebido</small><strong>${money(r.recebido)}</strong></div>
              <div><small>Saldo a receber</small><strong>${money(saldo)}</strong></div>
            </div>

            <div class="notice" style="margin:16px 0">
              Registre o valor efetivamente recebido. Se o pagamento for parcial, a solicitação continuará em <strong>Aguardando pagamento</strong>. Quando o saldo chegar a <strong>R$ 0,00</strong>, o sistema encerrará a solicitação como <strong>Concluído</strong>.
            </div>

            ${recebimentos.length ? `
              <div class="card" style="margin-bottom:16px">
                <div class="card-head"><h2>Recebimentos registrados</h2></div>
                <div class="card-body" style="padding:0">
                  <div class="table-wrap">
                    <table class="data-table">
                      <thead><tr><th>Data</th><th>Valor</th><th>Forma</th><th>Conta</th></tr></thead>
                      <tbody>
                        ${recebimentos.map(pagamento => `
                          <tr>
                            <td>${fmtDate(pagamento.data_pagamento)}</td>
                            <td>${money(pagamento.valor)}</td>
                            <td>${escapeHtml(formatarFormaPagamento(pagamento.forma_pagamento))}</td>
                            <td>${escapeHtml(pagamento.conta_recebimento || '—')}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ` : ''}

            <div class="form-grid">
              <div class="field">
                <label>Valor recebido *</label>
                <input class="input" name="valor" inputmode="decimal" value="${saldo.toFixed(2).replace('.', ',')}" required>
              </div>
              <div class="field">
                <label>Data do recebimento *</label>
                <input class="input" type="date" name="data_pagamento" value="${dataPadrao}" required>
              </div>
              <div class="field full">
                <label>Conta de recebimento *</label>
                <input class="input" name="conta_recebimento" placeholder="Ex.: Banco X · conta corrente final 1234 / chave PIX ..." required>
                <small class="muted">Use uma identificação suficiente para eventual consulta futura. Não informe senha, token ou dado de autenticação.</small>
              </div>
              <div class="field">
                <label>Forma de pagamento *</label>
                <select class="input" name="forma_pagamento" required>
                  <option value="">Selecione</option>
                  <option value="PIX">PIX</option>
                  <option value="CREDITO">Crédito</option>
                  <option value="DEBITO">Débito</option>
                  <option value="TRANSFERENCIA">Transferência</option>
                  <option value="DINHEIRO">Dinheiro</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </div>
              <div class="field">
                <label>Recibo emitido?</label>
                <select class="input" name="recibo_emitido" id="reciboEmitido">
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>
              <div class="field full" id="reciboFields" hidden>
                <div class="form-grid receipt-grid">
                  <div class="field">
                    <label>Número / identificação do recibo *</label>
                    <input class="input" name="recibo_numero" placeholder="Ex.: REC-2026-00015">
                  </div>
                  <div class="field">
                    <label>Data do recibo *</label>
                    <input class="input" type="date" name="recibo_data" value="${dataPadrao}">
                  </div>
                  <div class="field full">
                    <label>Informações do recibo *</label>
                    <textarea class="input" name="recibo_observacoes" rows="3" placeholder="Descreva os dados relevantes do recibo."></textarea>
                  </div>
                  <div class="field full">
                    <label>Link do recibo no Google Drive (opcional)</label>
                    <input class="input" type="url" name="recibo_drive_url" placeholder="Cole o link do arquivo do recibo, se disponível.">
                  </div>
                </div>
                <div class="drive-receipt-box">
                  <div>
                    <strong>Arquivo do recibo</strong>
                    <p class="muted">Salve o recibo na pasta privada da solicitação, preferencialmente em <strong>05 - Financeiro</strong>.</p>
                  </div>
                  ${r.drive ? `<a class="btn" href="${escapeHtml(r.drive)}" target="_blank" rel="noopener noreferrer">Abrir pasta no Drive</a>` : '<span class="muted">Pasta do Drive ainda não vinculada.</span>'}
                </div>
              </div>
              <div class="field full">
                <label>Observação do recebimento</label>
                <textarea class="input" name="observacao" rows="3" placeholder="Informação adicional sobre o pagamento, se necessário."></textarea>
              </div>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Registrar recebimento</button>
          </div>
        </form>
      </div>
    </div>`;

  $('#financialCloseModal').addEventListener('click', e => {
    if (e.target.matches('[data-close]')) closeModal();
  });

  const reciboSelect = $('#reciboEmitido');
  const reciboFields = $('#reciboFields');
  const syncRecibo = () => {
    const sim = reciboSelect.value === 'sim';
    reciboFields.hidden = !sim;
    reciboFields.querySelectorAll('input, textarea').forEach(el => {
      if (el.name === 'recibo_drive_url') return;
      el.required = sim;
    });
  };
  reciboSelect.addEventListener('change', syncRecibo);
  syncRecibo();

  $('#financialCloseForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const button = e.target.querySelector('button[type="submit"]');
    const valorRecebido = parseMoney(f.get('valor'));
    const dataPagamento = String(f.get('data_pagamento') || '').trim();
    const conta = String(f.get('conta_recebimento') || '').trim();
    const forma = String(f.get('forma_pagamento') || '').trim();
    const reciboEmitido = f.get('recibo_emitido') === 'sim';
    const reciboNumero = String(f.get('recibo_numero') || '').trim();
    const reciboData = String(f.get('recibo_data') || '').trim();
    const reciboObs = String(f.get('recibo_observacoes') || '').trim();
    const reciboDrive = String(f.get('recibo_drive_url') || '').trim();
    const observacao = String(f.get('observacao') || '').trim();
    const saldoAtual = saldoPendente(r);

    if (valorRecebido <= 0) return showToast('Informe um valor de recebimento maior que zero.');
    if (valorRecebido > saldoAtual + 0.005) return showToast(`O recebimento não pode ser maior que o saldo de ${money(saldoAtual)}.`);
    if (!conta) return showToast('Informe a conta de recebimento.');
    if (!forma) return showToast('Selecione a forma de pagamento.');
    if (reciboEmitido && (!reciboNumero || !reciboData || !reciboObs)) {
      return showToast('Preencha número, data e informações do recibo.');
    }

    const quitado = valorRecebido >= saldoAtual - 0.005;
    const novoTotalRecebido = Number(r.recebido || 0) + valorRecebido;
    const novoSaldo = Math.max(0, Number(r.valor || 0) - novoTotalRecebido);

    button.disabled = true;
    button.textContent = quitado ? 'Registrando e concluindo...' : 'Registrando recebimento...';

    const agora = new Date().toISOString();
    const pagamento = {
      solicitacao_id: r.id,
      valor: valorRecebido,
      data_pagamento: dataPagamento,
      forma_pagamento: forma,
      observacao: observacao || null,
      conta_recebimento: conta,
      recibo_emitido: reciboEmitido,
      recibo_numero: reciboEmitido ? reciboNumero : null,
      recibo_data: reciboEmitido ? reciboData : null,
      recibo_observacoes: reciboEmitido ? reciboObs : null,
      recibo_drive_url: reciboEmitido ? (reciboDrive || null) : null,
      created_by: currentUser?.id || null
    };

    const inserido = await supabaseClient.from('pagamentos').insert(pagamento).select('id').single();
    if (inserido.error) {
      console.error('Erro ao registrar recebimento:', inserido.error);
      showToast(inserido.error.message || 'Não foi possível registrar o recebimento.');
      button.disabled = false;
      button.textContent = 'Registrar recebimento';
      return;
    }

    if (quitado) {
      const atualizado = await supabaseClient.from('solicitacoes').update({
        status: 'CONCLUIDO',
        data_conclusao: agora,
        updated_at: agora
      }).eq('id', r.id).eq('status', 'AGUARDANDO_PAGAMENTO').select('id,status').maybeSingle();

      if (atualizado.error || !atualizado.data) {
        console.error('Pagamento registrado, mas não foi possível concluir a solicitação:', atualizado.error);
        await supabaseClient.from('pagamentos').delete().eq('id', inserido.data?.id || '');
        showToast('Não foi possível concluir a solicitação. O registro de recebimento foi revertido.');
        button.disabled = false;
        button.textContent = 'Registrar recebimento';
        return;
      }
    }

    const partes = [
      quitado
        ? `Recebimento final de ${money(valorRecebido)} registrado.`
        : `Recebimento parcial de ${money(valorRecebido)} registrado.`,
      `Forma: ${formatarFormaPagamento(forma)}.`,
      `Conta: ${conta}.`,
      reciboEmitido ? `Recibo emitido: ${reciboNumero}.` : 'Recibo não emitido.',
      `Total recebido: ${money(novoTotalRecebido)}.`,
      `Saldo restante: ${money(novoSaldo)}.`,
      quitado ? 'Solicitação concluída.' : 'A solicitação permanece aguardando pagamento.'
    ];
    await supabaseClient.from('historico_solicitacao').insert({
      solicitacao_id: r.id,
      usuario_id: currentUser?.id || null,
      tipo_evento: 'PAGAMENTO',
      descricao: partes.join(' '),
      data_hora: agora
    });

    closeModal();
    await carregarSolicitacoes();
    render();
    showToast(quitado ? 'Recebimento final registrado e solicitação concluída.' : `Recebimento parcial de ${money(valorRecebido)} registrado. Saldo restante: ${money(novoSaldo)}.`);
    openDetail(r.id);
  });
}


function abrirModalAjusteFinanceiro(r) {
  if (!isAdministrador()) {
    showToast('Somente Administradores podem realizar ajustes financeiros.');
    return;
  }

  if (!r || !['CONCLUIDO', 'CONCLUÍDO'].includes(r.status)) {
    showToast('O ajuste financeiro excepcional está disponível somente para solicitações concluídas.');
    return;
  }

  const valorAtual = Number(r.valor || 0);

  const renderFormulario = () => {
    $('#modalRoot').innerHTML = `
      <div class="modal-backdrop" id="financialAdjustmentModal">
        <div class="modal financial-modal" style="max-width:720px">
          <div class="modal-head">
            <div>
              <span class="eyebrow">AJUSTE EXCEPCIONAL</span>
              <h2>Ajuste financeiro</h2>
              <small class="muted">${escapeHtml(r.codigo)} · ${escapeHtml(r.cliente)}</small>
            </div>
            <button class="close" data-close type="button" aria-label="Fechar">×</button>
          </div>

          <form id="financialAdjustmentForm">
            <div class="modal-body">
              <div class="notice" style="margin-bottom:16px">
                Esta solicitação já foi encerrada financeiramente. O ajuste é exclusivo para Administradores e ficará registrado no histórico.
              </div>

              <div class="financial-summary compact">
                <div>
                  <small>Valor atual</small>
                  <strong>${money(valorAtual)}</strong>
                </div>
                <div>
                  <small>Total recebido</small>
                  <strong>${money(r.recebido)}</strong>
                </div>
                <div>
                  <small>Saldo atual</small>
                  <strong>${money(saldoPendente(r))}</strong>
                </div>
              </div>

              <div class="field" style="margin-top:16px">
                <label for="financialAdjustmentValue">Novo valor cobrado *</label>
                <input
                  class="input"
                  id="financialAdjustmentValue"
                  name="novo_valor"
                  inputmode="decimal"
                  autocomplete="off"
                  value="${valorAtual.toFixed(2).replace('.', ',')}"
                  required
                >
              </div>

              <div class="field" style="margin-top:14px">
                <label for="financialAdjustmentReason">Motivo do ajuste *</label>
                <textarea
                  class="input"
                  id="financialAdjustmentReason"
                  name="motivo"
                  rows="4"
                  maxlength="500"
                  placeholder="Ex.: valor lançado incorretamente."
                  required
                ></textarea>
              </div>

              <small class="muted" style="display:block;margin-top:10px">
                O pagamento já registrado não será alterado automaticamente. O novo saldo será recalculado a partir do novo valor.
              </small>
            </div>

            <div class="modal-foot">
              <button type="button" class="btn" data-close>Cancelar</button>
              <button type="submit" class="btn btn-primary">Continuar</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const modal = $('#financialAdjustmentModal');
    modal.addEventListener('click', e => {
      if (e.target.matches('[data-close]')) closeModal();
    });

    $('#financialAdjustmentValue')?.focus();

    $('#financialAdjustmentForm').addEventListener('submit', e => {
      e.preventDefault();

      const novoValor = parseMoney(new FormData(e.target).get('novo_valor'));
      const motivo = String(new FormData(e.target).get('motivo') || '').trim();

      if (!Number.isFinite(novoValor) || novoValor < 0) {
        showToast('Informe um valor válido.');
        $('#financialAdjustmentValue')?.focus();
        return;
      }

      if (novoValor === valorAtual) {
        showToast('O novo valor deve ser diferente do valor atual.');
        $('#financialAdjustmentValue')?.focus();
        return;
      }

      if (!motivo) {
        showToast('Informe o motivo do ajuste.');
        $('#financialAdjustmentReason')?.focus();
        return;
      }

      const novoSaldo = Math.max(0, novoValor - Number(r.recebido || 0));

      $('#modalRoot').innerHTML = `
        <div class="modal-backdrop" id="financialAdjustmentConfirmModal">
          <div class="modal financial-modal" style="max-width:680px">
            <div class="modal-head">
              <div>
                <span class="eyebrow">CONFIRMAÇÃO</span>
                <h2>Confirmar ajuste financeiro</h2>
                <small class="muted">${escapeHtml(r.codigo)}</small>
              </div>
              <button class="close" data-close type="button" aria-label="Fechar">×</button>
            </div>

            <div class="modal-body">
              <div class="financial-summary compact">
                <div>
                  <small>Valor anterior</small>
                  <strong>${money(valorAtual)}</strong>
                </div>
                <div>
                  <small>Novo valor</small>
                  <strong>${money(novoValor)}</strong>
                </div>
                <div>
                  <small>Novo saldo</small>
                  <strong>${money(novoSaldo)}</strong>
                </div>
              </div>

              <div class="notice" style="margin-top:16px">
                <strong>Motivo:</strong><br>
                ${escapeHtml(motivo)}
              </div>

              <p class="muted" style="margin-top:14px">
                O pagamento registrado permanecerá inalterado. Esta operação será registrada no histórico financeiro com o usuário, data/hora, valor anterior, novo valor e motivo.
              </p>
            </div>

            <div class="modal-foot">
              <button type="button" class="btn" id="cancelFinancialAdjustment">Voltar</button>
              <button type="button" class="btn btn-primary" id="confirmFinancialAdjustment">Confirmar ajuste</button>
            </div>
          </div>
        </div>
      `;

      const confirmModal = $('#financialAdjustmentConfirmModal');
      confirmModal.addEventListener('click', ev => {
        if (ev.target.matches('[data-close]')) {
          closeModal();
        }
      });

      $('#cancelFinancialAdjustment').addEventListener('click', () => {
        renderFormulario();
      });

      $('#confirmFinancialAdjustment').addEventListener('click', async buttonEvent => {
        const button = buttonEvent.currentTarget;
        button.disabled = true;
        button.textContent = 'Salvando...';

        const { data, error } = await supabaseClient.rpc('ajustar_valor_financeiro', {
          p_solicitacao_id: r.id,
          p_novo_valor: novoValor,
          p_motivo: motivo
        });

        if (error) {
          console.error('Erro no ajuste financeiro excepcional:', error);
          showToast(error.message || 'Não foi possível realizar o ajuste financeiro.');
          button.disabled = false;
          button.textContent = 'Confirmar ajuste';
          return;
        }

        closeModal();
        await carregarSolicitacoes();
        render();
        showToast(`Valor ajustado de ${money(valorAtual)} para ${money(novoValor)}.`);
        openDetail(r.id);
      });
    });
  };

  renderFormulario();
}

async function registrarEntregaAguardandoPagamento(id) {
  if (!isAdministrador()) return false;

  const r = db.requests.find(item => item.id === id);
  if (!r || r.status !== 'ENVIADO') {
    showToast('A solicitação precisa estar como enviada para aguardar pagamento.');
    return false;
  }

  const agora = new Date().toISOString();
  const { data: atualizada, error } = await supabaseClient
    .from('solicitacoes')
    .update({ status: 'AGUARDANDO_PAGAMENTO', updated_at: agora })
    .eq('id', id)
    .eq('status', 'ENVIADO')
    .select('id,status')
    .maybeSingle();

  if (error) {
    console.error('Erro ao registrar entrega:', error);
    showToast(error.message || 'Não foi possível registrar a entrega.');
    return false;
  }
  if (!atualizada) {
    showToast('A solicitação não foi alterada. Atualize os dados e tente novamente.');
    return false;
  }

  const { error: historicoError } = await supabaseClient
    .from('historico_solicitacao')
    .insert({
      solicitacao_id: id,
      usuario_id: currentUser?.id || null,
      tipo_evento: 'ENTREGA',
      descricao: 'Administrador registrou a entrega e colocou a solicitação como aguardando pagamento.',
      data_hora: agora
    });

  if (historicoError) {
    console.error('Entrega registrada, mas houve erro ao registrar o histórico:', historicoError);
  }

  await carregarSolicitacoes();
  render();
  showToast('Entrega registrada. Solicitação aguardando pagamento.');
  return true;
}

async function processarRevisaoAdministrativa(id, acao, motivo = '') {
  if (!isAdministrador()) return false;

  const r = db.requests.find(item => item.id === id);
  if (!r || !estaEmRevisao(r.status)) {
    showToast('A solicitação não está mais aguardando revisão.');
    return false;
  }

  const motivoLimpo = String(motivo || '').trim();
  if (acao === 'devolver' && !motivoLimpo) {
    showToast('Informe o motivo da devolução para o calculista.');
    return false;
  }

  const agora = new Date().toISOString();
  const update = {
    status: acao === 'aprovar' ? 'ENVIADO' : 'EM_CALCULO',
    revisor_id: currentUser?.id || null,
    updated_at: agora
  };

  if (acao === 'aprovar') {
    update.data_envio = agora;
  }

  const { data: revisaoAtualizada, error } = await supabaseClient
    .from('solicitacoes')
    .update(update)
    .eq('id', id)
    .eq('status', 'EM_REVISAO')
    .select('id,status,revisor_id,data_envio')
    .maybeSingle();

  if (error) {
    console.error('Erro ao processar revisão:', error);
    const detalhe = error.message || error.details || error.hint || '';
    showToast(detalhe ? `Não foi possível concluir a revisão: ${detalhe}` : 'Não foi possível concluir a revisão.');
    return false;
  }

  if (!revisaoAtualizada) {
    console.error('Revisão não alterada: a solicitação pode ter mudado de status antes da confirmação.', { id, acao });
    showToast('A solicitação não foi alterada. Atualize os dados e tente novamente.');
    return false;
  }

  const descricao = acao === 'aprovar'
    ? 'Administrador aprovou o cálculo e marcou a solicitação como enviada.'
    : `Administrador devolveu o cálculo para ajuste. Motivo: ${motivoLimpo}`;

  const { error: historicoError } = await supabaseClient
    .from('historico_solicitacao')
    .insert({
      solicitacao_id: id,
      usuario_id: currentUser?.id || null,
      tipo_evento: 'REVISAO',
      descricao,
      data_hora: agora
    });

  if (historicoError) {
    console.error('Revisão concluída, mas houve erro ao registrar o histórico:', historicoError);
  }

  await carregarSolicitacoes();
  render();
  showToast(acao === 'aprovar' ? 'Cálculo aprovado e marcado como enviado.' : 'Cálculo devolvido para ajuste.');
  return true;
}

async function alterarStatusCalculista(id, novoStatus, descricao) {
  const r = minhasSolicitacoes().find(x => x.id === id);
  if (!r) return;

  const transicoes = {
    'NOVO': ['EM_CALCULO'],
    'EM_CÁLCULO': ['EM_REVISAO'],
    'RETRABALHO': ['EM_CALCULO']
  };
  const permitidos = transicoes[r.status] || [];
  const statusBanco = novoStatus === 'EM_CALCULO' ? 'EM_CALCULO' : 'EM_REVISAO';

  if (!permitidos.includes(novoStatus)) return;

  const update = { status: statusBanco, updated_at: new Date().toISOString() };
  if (novoStatus === 'EM_CALCULO' && !r.data_inicio) update.data_inicio = new Date().toISOString();

  const { error } = await supabaseClient
    .from('solicitacoes')
    .update(update)
    .eq('id', id)
    .eq('calculista_id', r.calculistaId);

  if (error) {
    console.error('Erro ao atualizar status:', error);
    showToast('Não foi possível atualizar o status.');
    return;
  }

  await supabaseClient.from('historico_solicitacao').insert({
    solicitacao_id: id,
    usuario_id: currentUser.id,
    tipo_evento: 'STATUS',
    descricao: descricao || `Status alterado para ${novoStatus}`,
    data_hora: new Date().toISOString()
  });

  await carregarSolicitacoes();
  render();
  showToast('Status atualizado.');
}

function openCalculistaDetail(id) {
  if (!isCalculista()) return;
  const r = minhasSolicitacoes().find(x => x.id === id);
  if (!r) return;

  const botoes = [];
  if (r.status === 'NOVO') {
    botoes.push(`<button class="btn btn-primary" data-calc-action="start" data-id="${r.id}">▶ Iniciar cálculo</button>`);
  }
  if (r.status === 'EM_CÁLCULO' || r.status === 'RETRABALHO') {
    botoes.push(`<button class="btn btn-primary" data-calc-action="review" data-id="${r.id}">✓ Enviar para revisão</button>`);
  }

  const root = document.getElementById('drawerRoot');
  root.innerHTML = `
    <div class="drawer-backdrop" id="calcDrawerBackdrop">
      <aside class="drawer">
        <div class="drawer-head">
          <div><span class="eyebrow">PRODUÇÃO</span><h2>${r.codigo}</h2></div>
          <button class="icon-btn" data-calc-close>×</button>
        </div>
        <div class="drawer-body">
          <div class="detail-status">
            <span class="status ${statusClassCalculista(r)}">${statusLabelCalculista(r)}</span>
            ${devolucaoPendenteParaCalculista(r) ? '<span class="status devolvido" style="margin-left:6px">Retorno da revisão</span>' : ''}
          </div>
          <div class="detail-grid">
            <div class="detail-box"><small>Cliente</small><strong>${r.cliente || '—'}</strong></div>
            <div class="detail-box"><small>Processo</small><strong>${r.processo || '—'}</strong></div>
            <div class="detail-box"><small>Serviço</small><strong>${r.tipo || '—'}</strong></div>
            <div class="detail-box"><small>Área</small><strong>${r.area || '—'}</strong></div>
            <div class="detail-box"><small>Prazo</small><strong>${fmtDate(r.prazo)}</strong></div>
            <div class="detail-box"><small>Prioridade</small><strong>${r.prioridade || '—'}</strong></div>
          </div>

          ${devolucaoPendenteParaCalculista(r) ? `
            <div class="card return-notice" style="margin-top:18px">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <h3 style="margin:0">Devolvido para ajuste</h3>
                <span class="status devolvido">Devolvido</span>
              </div>
              <p class="muted" style="margin-top:10px;white-space:pre-wrap">${escapeHtml(motivoUltimaDevolucao(r))}</p>
              ${(() => {
                const evento = ultimaDevolucaoRevisao(r);
                return evento ? `<small class="muted">${escapeHtml(evento[0] || '')}</small>` : '';
              })()}
            </div>` : ''}

          <div class="card" style="margin-top:18px;padding:16px">
            <h3>Orientações para o cálculo</h3>
            <p class="muted" style="margin-top:8px;white-space:pre-wrap">${r.descricao || 'Nenhuma orientação registrada.'}</p>
          </div>

          <div class="card" style="margin-top:18px;padding:16px">
            <h3>Documentos</h3>
            <p class="muted" style="margin:6px 0 14px">Os documentos ficam na pasta privada da solicitação.</p>
            ${r.drive ? `<a class="btn btn-secondary" href="${r.drive}" target="_blank" rel="noopener noreferrer">Abrir pasta no Drive</a>` : '<div class="empty">Pasta do Drive ainda não vinculada.</div>'}
          </div>

          <div class="card" style="margin-top:18px;padding:16px">
            <h3>Execução</h3>
            <p class="muted" style="margin:6px 0 14px">${r.sistema ? `Sistema indicado: <strong>${r.sistema}</strong>` : 'Sistema especializado não informado.'}</p>
            <div class="actions">${botoes.join('') || '<span class="muted">A solicitação está aguardando a próxima etapa administrativa.</span>'}</div>
          </div>

          <div class="notice" style="margin-top:18px">
            <strong>Importante:</strong> ao terminar o cálculo, envie para revisão. A entrega ao solicitante, o acompanhamento do pagamento e o status <strong>Concluído</strong> são etapas administrativas.
          </div>
        </div>
      </aside>
    </div>`;

  document.getElementById('calcDrawerBackdrop').addEventListener('click', async e => {
    if (e.target.id === 'calcDrawerBackdrop' || e.target.matches('[data-calc-close]')) {
      root.innerHTML = '';
      return;
    }
    const btn = e.target.closest('[data-calc-action]');
    if (!btn) return;
    const action = btn.dataset.calcAction;
    const status = action === 'start' ? 'EM_CALCULO' : 'EM_REVISAO';
    const desc = action === 'start' ? 'Calculista iniciou o cálculo.' : 'Calculista enviou o cálculo para revisão.';
    btn.disabled = true;
    await alterarStatusCalculista(id, status, desc);
    root.innerHTML = '';
  });
}

function manualView() {
  const admin = isAdministrador();
  const usuario = isUsuario();
  const calculista = isCalculista();
  const ambos = admin && calculista;

  const tabs = [
    ['visao', 'Visão geral', true],
    ['operacao', 'Operação', admin],
    ['producao', 'Minha produção', calculista],
    ['solicitacoes_usuario', 'Solicitações', usuario],
    ['cadastros_usuario', 'Cadastros', usuario],
    ['relatorios_usuario', 'Relatórios', usuario],
    ['fluxo', 'Fluxo de trabalho', true],
    ['revisao', 'Revisão', admin || calculista],
    ['usuarios', 'Usuários', admin],
    ['financeiro', 'Financeiro', admin],
    ['documentos', 'Documentos', true],
    ['integracoes', 'Integrações', admin],
    ['historico', 'Histórico', true]
  ].filter(x => x[2]);

  if (!tabs.some(x => x[0] === state.manualTab)) state.manualTab = tabs[0][0];

  const sections = {
    visao: {
      title: 'Visão geral',
      intro: 'O Manual do Sistema é a documentação de referência do Gestão Computum. Use as abas para consultar conceitos, responsabilidades, fluxos e procedimentos.',
      articles: [
        ['O que é o Gestão Computum', 'O Gestão Computum organiza a operação dos cálculos judiciais: solicitações, pessoas, processos, documentos, responsáveis, prazos, revisão, entrega, pagamentos, retrabalhos e histórico. Os cálculos são executados nos sistemas especializados vinculados ao serviço.'],
        ['Perfis de acesso', 'Administrador controla o ciclo administrativo. Calculista executa a produção atribuída. Um mesmo usuário pode exercer as duas funções simultaneamente.'],
        ['Como usar este manual', 'Consulte uma aba por assunto ou use a busca. A documentação é atualizada junto com as etapas funcionais do sistema. A ajuda contextual de cada tela explica somente o que é relevante naquele momento.'],
        ['Regra de documentação', 'Uma etapa funcional só deve ser considerada encerrada depois de implementada, testada, validada e documentada.']
      ]
    },
    operacao: {
      title: 'Operação administrativa',
      intro: 'Rotinas de administração das solicitações e dos cadastros.',
      articles: [
        ['Solicitações', 'Cadastre ou confira advogado, cliente, processo, área, serviço, prazo, prioridade, valor, origem e observações. A solicitação é o registro central do trabalho.'],
        ['Atribuição ao calculista', 'O administrador escolhe o calculista responsável. A solicitação passa a aparecer em Minha produção para esse profissional.'],
        ['Acompanhamento', 'O administrador acompanha status, prazo, prioridade, documentos, responsável, sistema especializado, revisão, entrega e situação financeira. Após a aprovação, registra a entrega administrativa e coloca a solicitação como aguardando pagamento.'],
        ['Edição e exclusão', 'Administradores podem editar solicitações e cadastros relacionados. Alterações relevantes devem preservar os vínculos e o histórico. A exclusão é uma ação administrativa e deve ser utilizada com cautela.'],
        ['Cadastros relacionados', 'Advogados, clientes e processos são cadastros reutilizáveis. Alterar um cadastro relacionado pode refletir em todas as solicitações que utilizam aquele registro.']
      ]
    },
    producao: {
      title: 'Minha produção',
      intro: 'Procedimentos para o calculista executar e acompanhar os trabalhos atribuídos.',
      articles: [
        ['Receber a solicitação', 'Confira cliente, processo, serviço, área, prazo, prioridade, orientações, documentos e sistema especializado indicado.'],
        ['Iniciar cálculo', 'Ao iniciar efetivamente a produção, a solicitação passa para Em cálculo e o início fica registrado no histórico.'],
        ['Executar o trabalho', 'Utilize os documentos privados da solicitação e o sistema especializado indicado para realizar a produção técnica.'],
        ['Enviar para revisão', 'Quando a produção estiver pronta, utilize Enviar para revisão. A solicitação passa para Em revisão e o histórico registra que o calculista concluiu a etapa técnica.'],
        ['Receber uma devolução', 'Quando o revisor devolver a solicitação, a produção permanece em EM CÁLCULO, mas é identificada visualmente como Devolvido. O motivo aparece em um bloco próprio no detalhe da produção, com a data do retorno. O calculista deve corrigir o trabalho e enviá-lo novamente para revisão.'],
        ['O que o calculista não encerra', 'O calculista não marca a solicitação como Concluído. Entrega, pagamento e encerramento financeiro são etapas administrativas.']
      ]
    },
    solicitacoes_usuario: {
      title: 'Solicitações',
      intro: 'Consulta e acompanhamento das solicitações, com possibilidade de registrar novas demandas e atribuir novas solicitações, sem editar ou excluir registros existentes.',
      articles: [
        ['Consultar solicitações', 'O Usuário pode consultar as solicitações, acompanhar seus status, responsáveis, prazos, documentos, valores e histórico.'],
        ['Criar solicitação', 'O Usuário pode registrar uma nova solicitação com os dados disponíveis no formulário.'],
        ['Atribuir uma nova solicitação', 'Quando permitido pelo fluxo da tela, o Usuário pode atribuir uma nova solicitação a um calculista. Essa permissão não inclui alterar a atribuição de uma solicitação já existente.'],
        ['O que o Usuário não pode fazer', 'O Usuário não pode editar ou excluir solicitações existentes, revisar cálculos, aprovar ou devolver cálculos, registrar pagamentos ou administrar usuários.']
      ]
    },
    cadastros_usuario: {
      title: 'Cadastros para consulta',
      intro: 'Os painéis de Advogados, Clientes, Processos e Calculistas ficam disponíveis para consulta.',
      articles: [
        ['Advogados', 'Consulte os advogados cadastrados e as informações relacionadas. O Usuário não pode criar, editar ou excluir registros.'],
        ['Clientes', 'Consulte os clientes e seus dados relacionados às solicitações. O Usuário não pode alterar os cadastros.'],
        ['Processos', 'Consulte processos e suas relações com as solicitações. O Usuário não pode criar, editar ou excluir processos.'],
        ['Calculistas', 'Consulte apenas os calculistas ativos com vínculo explícito a um usuário que exerce a função Calculista. O Usuário não pode editar cadastros, vincular usuários ou alterar a situação dos calculistas.']
      ]
    },
    relatorios_usuario: {
      title: 'Relatórios',
      intro: 'Relatórios são disponibilizados ao Usuário para acompanhamento da operação, sem alteração dos registros.',
      articles: [
        ['Consulta', 'O Usuário pode consultar os relatórios disponíveis para acompanhar volume, prazos, situação e demais informações liberadas pelo sistema.'],
        ['Somente leitura', 'A consulta de relatórios não concede permissão para editar, excluir ou alterar os dados que originam os relatórios.']
      ]
    },
    fluxo: {
      title: 'Fluxo de trabalho',
      intro: 'O ciclo principal da solicitação separa produção técnica, revisão, entrega e encerramento financeiro.',
      articles: [
        ['1. Novo', 'A solicitação foi registrada e ainda precisa ser analisada ou encaminhada.'],
        ['2. Análise', 'A demanda está sendo conferida quanto a dados, documentos, serviço, prazo e condições de execução.'],
        ['3. Aguardando documentos', 'Existem documentos ou informações necessários ainda não recebidos.'],
        ['4. Em cálculo', 'O calculista está executando a produção técnica.'],
        ['5. Em revisão', 'O calculista terminou a produção e enviou o trabalho para conferência administrativa.'],
        ['6. Enviado', 'O resultado foi aprovado e entregue ao solicitante. Entrega e pagamento são eventos diferentes.'],
        ['7. Aguardando pagamento', 'A entrega foi realizada e existe valor pendente de recebimento.'],
        ['8. Concluído', 'A solicitação foi encerrada administrativamente após a entrega e a confirmação do recebimento conforme o fluxo financeiro adotado.'],
        ['Fluxos excepcionais', 'Impugnação, retrabalho, pausa e cancelamento devem preservar a solicitação original e seu histórico.']
      ]
    },
    revisao: {
      title: 'Revisão',
      intro: 'A revisão é a etapa que conecta a produção técnica à entrega administrativa.',
      articles: [
        ['Quando a revisão começa', 'A revisão começa quando o calculista utiliza Enviar para revisão. O status passa para Em revisão.'],
        ['Aprovar e marcar como enviado', 'O administrador/revisor confere o trabalho e pode aprovar. A ação registra o revisor, a data de envio e altera o status para Enviado.'],
        ['Devolver para cálculo', 'Quando houver necessidade de correção, o revisor utiliza Devolver para cálculo e informa obrigatoriamente o motivo. A solicitação retorna para Em cálculo.'],
        ['Motivo da devolução', 'A justificativa deve ser apresentada ao calculista na área de produção, para que ele saiba o que precisa corrigir. A devolução também permanece registrada no histórico.'],
        ['Nova revisão', 'Depois da correção, o calculista envia novamente para revisão. O novo ciclo deve ficar registrado no histórico, sem apagar a devolução anterior.'],
        ['Revisão pelo próprio administrador-calculista', 'Usuário com as duas funções pode revisar trabalhos atribuídos a ele. O sistema não bloqueia essa situação por autoria.']
      ]
    },
    usuarios: {
      title: 'Usuários e permissões',
      intro: 'Configuração dos acessos e das funções atribuídas a cada pessoa.',
      articles: [
        ['Perfis', 'O sistema possui Usuário, Calculista e Administrador. Usuário tem visão geral e pode criar/visualizar/atribuir solicitações, sem editar/excluir, revisar ou operar o financeiro. Administrador e Calculista podem ser acumulados.'],
        ['Administrador', 'Acessa os módulos administrativos, acompanha todas as solicitações, atribui trabalhos, revisa, entrega, acompanha pagamentos e administra configurações.'],
        ['Calculista', 'Acessa Minha produção, trabalha nas solicitações atribuídas, consulta documentos, executa a produção e envia para revisão.'],
        ['Administrador + Calculista', 'O mesmo usuário pode ter acesso administrativo e também atuar como calculista. Patrick é o exemplo da configuração inicial do sistema.'],
        ['Gerenciar usuários', 'Somente Administradores acessam o painel Usuários. Nele podem criar, editar, ativar/desativar contas, alterar e-mail, definir funções e excluir contas que não possuam registros vinculados. A exclusão é bloqueada quando houver histórico ou qualquer vínculo operacional; nesses casos, a conta deve ser desativada.'],
        ['Novo usuário', 'O cadastro permite nome, e-mail, senha inicial, situação, Administrador, Calculista ou nenhuma função específica. Sem função, a conta aparece como Usuário.'],
        ['Alteração de e-mail', 'Alterar o e-mail de acesso preserva o mesmo usuário, identificador, permissões, vínculo como calculista, solicitações e histórico. Não se deve excluir e recriar a pessoa apenas para trocar o e-mail.'],
        ['Usuário já existente no Auth', 'Contas que já existem no Supabase Auth são sincronizadas pela migration 008. Depois disso, o administrador pode localizar a conta e definir suas funções no painel.'],
        ['Ativação e desativação', 'Usuários inativos não devem conseguir acessar o sistema. A desativação preserva os registros históricos e as solicitações já relacionadas ao usuário.'],
        ['Exclusão de usuário', 'A exclusão definitiva é restrita ao Administrador. O sistema verifica solicitações, retrabalhos, arquivos, pagamentos, histórico e vínculo como calculista. Havendo qualquer registro relacionado, a exclusão é bloqueada e a conta deve ser desativada. O último administrador ativo e o próprio usuário administrador não podem ser excluídos.'],
        ['Proteção administrativa', 'O sistema deve manter pelo menos um administrador ativo; o painel bloqueia uma alteração que deixaria o projeto sem administrador.']
      ]
    },
    financeiro: {
      title: 'Financeiro',
      intro: 'Acompanhamento do valor do serviço, pagamentos e encerramento.',
      articles: [
        ['Valor do serviço', 'A solicitação registra o valor cobrado e, quando aplicável, desconto e valor final.'],
        ['Aguardando pagamento', 'Depois da entrega, a solicitação pode permanecer aguardando pagamento até que o recebimento seja registrado.'],
        ['Pagamento recebido', 'O recebimento é registrado vinculado à solicitação. O saldo pendente deve refletir os pagamentos registrados.'],
        ['Conclusão financeira', 'Concluído é alcançado pelo fluxo Registrar recebimento e concluir. O sistema registra valor, data, conta de recebimento, forma de pagamento e, quando houver, os dados do recibo. O total recebido passa a compor Recebido e deixa de compor A receber.'],
        ['Conta de recebimento', 'Registre uma identificação suficiente para eventual consulta futura. Não devem ser armazenadas senhas, tokens ou dados de autenticação.'],
        ['Forma de pagamento', 'O registro aceita PIX, crédito, débito, transferência, dinheiro ou outra forma configurada.'],
        ['Recibo', 'Se houver recibo, informe número/identificação, data e informações relevantes. O sistema permite registrar o link do arquivo e abrir a pasta privada da solicitação no Google Drive para armazenamento do documento.'],
        ['Pasta financeira', 'O recibo deve ser guardado preferencialmente em 05 - Financeiro dentro da pasta privada da solicitação. A criação automática dessa subpasta depende da configuração do Apps Script do Drive.']
      ]
    },
    documentos: {
      title: 'Documentos e Google Drive',
      intro: 'Os arquivos permanecem privados no Google Drive e são organizados por solicitação.',
      articles: [
        ['Recebimento por Forms', 'O Google Forms recebe PDFs, imagens e outros documentos permitidos. O Apps Script organiza os arquivos na pasta correspondente à solicitação.'],
        ['Estrutura da pasta', 'A estrutura padrão é Computum/Gestão/CJ-2026-xxxxx, com 01 - Documentos recebidos, 02 - Cálculos, 03 - Parecer, 04 - Retrabalho e, para documentos financeiros, 05 - Financeiro.'],
        ['Vincular pasta', 'O administrador pode vincular o endereço da pasta à solicitação para acesso rápido pelo Gestão Computum.'],
        ['Privacidade', 'Os arquivos devem continuar sujeitos às permissões privadas do Google Drive. O sistema não deve exigir que os documentos sejam públicos.']
      ]
    },
    integracoes: {
      title: 'Integrações',
      intro: 'Serviços externos usados pelo Gestão Computum.',
      articles: [
        ['Google Forms', 'Usado para receber documentos. O formulário atual é o ponto de entrada dos arquivos recebidos.'],
        ['Google Drive + Apps Script', 'O Apps Script organiza automaticamente os arquivos enviados na pasta da solicitação.'],
        ['Supabase', 'Responsável pela autenticação, banco de dados, registros e controle de acesso do sistema.'],
        ['Sistemas especializados', 'Abono Computum, Diferenças Computum e Saúde Computum são exemplos de sistemas de execução vinculados às solicitações.']
      ]
    },
    historico: {
      title: 'Histórico e rastreabilidade',
      intro: 'O histórico registra a evolução da solicitação e deve refletir o que realmente ocorreu.',
      articles: [
        ['Eventos', 'Mudanças relevantes devem registrar descrição, usuário e data/hora.'],
        ['Status', 'Uma alteração manual de status deve registrar a transição real. O histórico não deve atribuir ao calculista uma ação que foi feita pelo administrador.'],
        ['Revisão', 'Envio para revisão, aprovação e devolução devem permanecer distinguíveis no histórico.'],
        ['Auditoria', 'O histórico é a trilha operacional da solicitação e deve ser preservado mesmo quando a demanda avança para etapas posteriores.']
      ]
    }
  };

  const query = String(state.manualQuery || '').trim().toLowerCase();
  const active = sections[state.manualTab] || sections.visao;
  const matches = active.articles.filter(([title, body]) => !query || `${title} ${body}`.toLowerCase().includes(query));

  const roleTitle = ambos
    ? 'Manual do Administrador e Calculista'
    : admin
      ? 'Manual do Administrador'
      : usuario
        ? 'Manual do Usuário'
        : 'Manual do Calculista';
  const roleIntro = ambos
    ? 'Documentação funcional e operacional para quem administra o ciclo das solicitações e também executa cálculos.'
    : admin
      ? 'Documentação funcional e operacional das rotinas administrativas do Gestão Computum.'
      : usuario
        ? 'Documentação para consulta e acompanhamento das solicitações, cadastros e relatórios, sem permissões de edição.'
        : 'Documentação funcional e operacional das rotinas de produção atribuídas ao calculista.';

  return `
    <div class="manual-page-head">
      <div>
        <div class="manual-kicker">GESTÃO COMPUTUM · DOCUMENTAÇÃO INTERNA</div>
        <h1>Manual do sistema</h1>
        <p>${roleIntro}</p>
      </div>
      <div class="manual-version">Versão 0.6 · 29/09/2026</div>
    </div>

    <section class="manual-hero card">
      <div>
        <h2>${roleTitle}</h2>
        <p>Consulte os capítulos por assunto ou pesquise diretamente pelo procedimento que procura.</p>
      </div>
      <label class="manual-search">
        <span>Pesquisar no manual</span>
        <input id="manualSearch" class="input" type="search" value="${escapeHtml(state.manualQuery)}" placeholder="Ex.: devolver cálculo, usuário, pagamento..." autocomplete="off">
      </label>
    </section>

    <section class="manual-workspace card">
      <nav class="manual-tabs" aria-label="Capítulos do manual">
        ${tabs.map(([id,label]) => `<button type="button" class="manual-tab ${state.manualTab === id ? 'active' : ''}" data-manual-tab="${id}">${label}</button>`).join('')}
      </nav>

      <div class="manual-content-head">
        <div>
          <span class="manual-section-kicker">CAPÍTULO</span>
          <h2>${active.title}</h2>
          <p>${active.intro}</p>
        </div>
        <span class="manual-result-count">${matches.length} tópico${matches.length === 1 ? '' : 's'}</span>
      </div>

      <div class="manual-articles">
        ${matches.length ? matches.map(([title,body], index) => `
          <article class="manual-article">
            <div class="manual-article-number">${String(index + 1).padStart(2,'0')}</div>
            <div>
              <h3>${title}</h3>
              <p>${body}</p>
            </div>
          </article>`).join('') : `
          <div class="manual-empty">
            <strong>Nenhum tópico encontrado.</strong>
            <p>Tente outro termo ou limpe a pesquisa.</p>
          </div>`}
      </div>
    </section>

    <section class="manual-help card">
      <div>
        <span class="manual-section-kicker">AJUDA CONTEXTUAL</span>
        <h2>Como funciona esta tela</h2>
        <p>Nas páginas operacionais, o ícone de informação junto ao título abre uma explicação curta sobre a função daquela área. O manual permanece como referência completa.</p>
      </div>
      <div class="manual-source">
        <strong>Fonte oficial</strong>
        <span>docs/MANUAL_DO_SISTEMA.md</span>
        <span>Atualizado junto com as etapas funcionais validadas.</span>
      </div>
    </section>
  `;
}


async function abrirUsuarioModal(usuario = null) {
  if (!isAdministrador()) return;
  const calculistaAtualDoUsuario = usuario ? db.calculistas.find(c => c.usuario_id === usuario.id) || null : null;
  const editando = !!usuario;
  const calculistaMarcado = !!calculistaAtualDoUsuario || usuario?.perfil === 'calculista';
  const adminMarcado = usuario?.perfil === 'administrador';

  $('#modalRoot').innerHTML = `
    <div class="modal-backdrop" id="userModal">
      <div class="modal user-management-modal">
        <div class="modal-head"><div><span class="eyebrow">ADMINISTRAÇÃO</span><h2>${editando ? 'Editar usuário' : 'Adicionar usuário'}</h2></div><button class="close" data-close type="button" aria-label="Fechar">×</button></div>
        <form id="userForm">
          <div class="modal-body">
            ${editando ? `<input type="hidden" name="user_id" value="${escapeHtml(usuario.id)}">` : ''}
            <div class="form-grid">
              <div class="field full"><label for="userName">Nome *</label><input class="input" id="userName" name="nome" required value="${escapeHtml(nomeExibicaoUsuario(usuario))}" placeholder="Nome completo"></div>
              <div class="field full"><label for="userEmail">E-mail *</label><input class="input" id="userEmail" name="email" type="email" required value="${escapeHtml(usuario?.email || '')}" placeholder="nome@dominio.com.br"></div>
              ${!editando ? `<div class="field full"><label for="userPassword">Senha inicial *</label><input class="input" id="userPassword" name="password" type="password" minlength="8" required placeholder="Mínimo de 8 caracteres"><small class="muted">A senha é usada somente na criação da conta e não fica registrada no Gestão Computum.</small></div>` : ''}
            </div>
            <div class="user-role-box">
              <div><strong>Funções</strong><p class="muted">Sem função específica, a conta fica como <strong>Usuário</strong>. Administrador e Calculista podem ser acumulados.</p></div>
              <label class="check-row"><input type="checkbox" name="administrador" ${adminMarcado ? 'checked' : ''}> <span><strong>Administrador</strong><small>Acesso às rotinas administrativas e configurações.</small></span></label>
              <label class="check-row"><input type="checkbox" name="calculista" id="userCalculista" ${calculistaMarcado ? 'checked' : ''}> <span><strong>Calculista</strong><small>Acesso a Minha produção e às demandas atribuídas.</small></span></label>
            </div>
            <div class="field"><label for="userCalcId">Cadastro de calculista</label><select class="input" id="userCalcId" name="calculista_id"><option value="">${calculistaMarcado ? 'Criar/vincular pelo nome' : 'Sem vínculo'}</option>${db.calculistas.filter(c => c.ativo !== false).sort((a,b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')).map(c => `<option value="${escapeHtml(c.id)}" ${c.id === calculistaAtualDoUsuario?.id ? 'selected' : ''}>${escapeHtml(c.nome)}</option>`).join('')}</select><small class="muted">Se Calculista estiver marcado e nenhum cadastro for escolhido, o sistema cria ou reaproveita um cadastro pelo nome.</small></div>
            <label class="check-row user-active-row"><input type="checkbox" name="ativo" ${usuario?.ativo !== false ? 'checked' : ''}> <span><strong>Usuário ativo</strong><small>Usuários inativos não conseguem acessar o sistema.</small></span></label>
            ${editando ? `<div class="notice">Alterar o e-mail preserva o mesmo usuário, permissões, vínculo como calculista, solicitações e histórico.</div>` : `<div class="notice">A nova conta será criada no Supabase Auth e também receberá o cadastro interno correspondente.</div>`}
          </div>
          <div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn btn-primary">${editando ? 'Salvar alterações' : 'Criar usuário'}</button></div>
        </form>
      </div>
    </div>`;

  const modal = $('#userModal');
  modal.addEventListener('click', e => { if (e.target.matches('[data-close]')) closeModal(); });
  const calcCheck = $('#userCalculista');
  const calcSelect = $('#userCalcId');
  const syncCalcState = () => { calcSelect.disabled = !calcCheck.checked; };
  calcCheck.addEventListener('change', syncCalcState);
  syncCalcState();
  $('#userForm').addEventListener('submit', salvarUsuarioModal);
}

async function obterAccessTokenGerenciamento() {
  let { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error('Erro ao recuperar sessão para gerenciamento:', error);
    throw new Error('Não foi possível recuperar a sessão atual.');
  }

  let session = data?.session || null;

  // Se a sessão local estiver ausente/expirada, tenta renová-la antes da chamada.
  if (!session?.access_token) {
    const refresh = await supabaseClient.auth.refreshSession();
    if (!refresh.error) session = refresh.data?.session || null;
  }

  if (!session?.access_token) {
    throw new Error('Sessão inválida. Faça login novamente.');
  }

  return session.access_token;
}

async function chamarGerenciarUsuario(payload) {
  const url = `${SUPABASE_URL}/functions/v1/gerenciar-usuario`;

  let token = await obterAccessTokenGerenciamento();

  async function executar(accessToken) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });

    const texto = await response.text();
    let data = {};
    try {
      data = texto ? JSON.parse(texto) : {};
    } catch (_) {
      data = { error: texto || 'Resposta inválida da Edge Function.' };
    }

    return { response, data };
  }

  let resultado = await executar(token);

  // Um access token pode expirar entre getSession() e o fetch().
  // Renova uma única vez e repete somente em 401.
  if (resultado.response.status === 401) {
    const refresh = await supabaseClient.auth.refreshSession();
    if (refresh.error || !refresh.data?.session?.access_token) {
      throw new Error(resultado.data?.error || 'Sessão expirada. Faça login novamente.');
    }
    token = refresh.data.session.access_token;
    resultado = await executar(token);
  }

  if (!resultado.response.ok) {
    const mensagem = resultado.data?.error || resultado.data?.message || `Erro HTTP ${resultado.response.status}.`;
    throw new Error(mensagem);
  }

  return resultado.data;
}

function nomeExibicaoUsuario(usuario) {
  const nome = String(usuario?.nome || '').trim();
  const email = String(usuario?.email || '').trim();

  if (nome && nome.toLowerCase() !== email.toLowerCase()) return nome;

  const local = email.split('@')[0] || '';
  return local
    .replace(/[._-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(parte => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase())
    .join(' ') || nome || 'Usuário';
}

async function salvarUsuarioModal(event) {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('button[type="submit"]');
  const dados = new FormData(form);
  const userId = String(dados.get('user_id') || '').trim();
  const payload = {
    action: userId ? 'update' : 'create', user_id: userId || undefined,
    nome: String(dados.get('nome') || '').trim(), email: String(dados.get('email') || '').trim().toLowerCase(),
    password: String(dados.get('password') || ''), admin: dados.get('administrador') === 'on',
    calculista: dados.get('calculista') === 'on', calculista_id: String(dados.get('calculista_id') || '').trim() || null,
    ativo: dados.get('ativo') === 'on'
  };
  // Sem função específica, a conta permanece como Usuário.
  button.disabled = true; button.textContent = userId ? 'Salvando…' : 'Criando…';
  try {
    const data = await chamarGerenciarUsuario(payload);
    if (data?.error) throw new Error(data.error);
    closeModal(); await carregarSolicitacoes(); atualizarUsuarioInterface(); render();
    showToast(userId ? 'Usuário atualizado.' : 'Usuário criado com sucesso.');
  } catch (error) {
    console.error('Erro ao gerenciar usuário:', error); showToast(error.message || 'Não foi possível salvar o usuário.');
    button.disabled = false; button.textContent = userId ? 'Salvar alterações' : 'Criar usuário';
  }
}

async function excluirUsuarioModal(usuario) {
  if (!isAdministrador() || !usuario?.id) return;

  const nome = nomeExibicaoUsuario(usuario);
  const confirmado = window.confirm(
    `Excluir definitivamente o usuário "${nome}"?\n\n` +
    `A conta será removida do Supabase Auth e do Gestão Computum somente se não houver solicitações, histórico, pagamentos, arquivos, retrabalhos ou vínculo como calculista.\n\n` +
    `Se houver qualquer registro relacionado, a exclusão será bloqueada e o usuário deverá ser desativado.\n\n` +
    `Esta ação não pode ser desfeita.`
  );

  if (!confirmado) return;

  try {
    const data = await chamarGerenciarUsuario({ action: 'delete', user_id: usuario.id });
    if (data?.error) throw new Error(data.error);
    await carregarSolicitacoes();
    atualizarUsuarioInterface();
    render();
    showToast('Usuário excluído com sucesso.');
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    showToast(error.message || 'Não foi possível excluir o usuário.');
  }
}

function abrirVincularCalculistaUsuarioModal(calculista) {
  if (!isAdministrador()) return;
  const usuarios = db.usuarios.filter(u => u.ativo !== false);
  $('#modalRoot').innerHTML = `
    <div class="modal-backdrop" id="linkCalcUserModal">
      <div class="modal">
        <div class="modal-head">
          <div><span class="eyebrow">ACESSO</span><h2>Vincular usuário</h2></div>
          <button class="close" data-close type="button" aria-label="Fechar">×</button>
        </div>
        <form id="linkCalcUserForm">
          <div class="modal-body">
            <div class="notice" style="margin-bottom:16px">
              Calculista: <strong>${calculista.nome}</strong><br>
              O usuário vinculado poderá acessar <strong>Minha produção</strong> e receber as solicitações atribuídas a este cadastro.
            </div>
            <div class="field">
              <label for="calcUserId">Usuário do sistema</label>
              <select class="input" id="calcUserId" name="usuario_id">
                <option value="">Sem usuário vinculado</option>
                ${usuarios.map(u => `<option value="${u.id}" ${u.id === calculista.usuario_id ? 'selected' : ''}>${u.nome} — ${u.email}</option>`).join('')}
              </select>
            </div>
            <small class="muted" style="display:block;margin-top:8px">O usuário precisa existir no Supabase Auth e na tabela de usuários do Gestão.</small>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar vínculo</button>
          </div>
        </form>
      </div>
    </div>
  `;
  $('#linkCalcUserModal').addEventListener('click', e => {
    if (e.target.matches('[data-close]')) closeModal();
  });
  $('#linkCalcUserForm').addEventListener('submit', async e => {
    e.preventDefault();
    const usuarioId = new FormData(e.target).get('usuario_id') || null;
    const button = e.target.querySelector('button[type="submit"]');
    button.disabled = true;
    const { error } = await supabaseClient
      .from('calculistas')
      .update({ usuario_id: usuarioId, updated_at: new Date().toISOString() })
      .eq('id', calculista.id);
    if (error) {
      console.error('Erro ao vincular calculista:', error);
      showToast('Não foi possível salvar o vínculo. Verifique se a migração V23 foi executada.');
      button.disabled = false;
      return;
    }
    closeModal();
    await carregarSolicitacoes();
    atualizarUsuarioInterface();
    render();
    showToast(usuarioId ? 'Usuário vinculado ao calculista.' : 'Vínculo removido.');
  });
}

function solicitacoesFiltradas() {
  return db.requests.filter(
    r =>
      (
        !state.query ||
        `
          ${r.codigo}
          ${r.advogado}
          ${r.cliente}
          ${r.processo}
          ${r.tipo}
        `
          .toLowerCase()
          .includes(state.query.toLowerCase())
      ) &&
      (!state.status || r.status === state.status) &&
      (!state.area || r.area === state.area)
  );
}


function financeiroFiltrado() {
  const q = String(state.financeQuery || '').trim().toLowerCase();

  return db.requests.filter(r => {
    const texto = [
      r.codigo,
      r.advogado,
      r.cliente,
      r.processo,
      r.tipo
    ].join(' ').toLowerCase();

    return (
      (!q || texto.includes(q)) &&
      (!state.financeStatus || normalizarChaveStatus(r.status) === normalizarChaveStatus(state.financeStatus)) &&
      (!state.financeArea || r.area === state.financeArea)
    );
  });
}

function financeiroTabelas(rows) {
  const contas = rows.filter(r => Number(r.valor || 0) > Number(r.recebido || 0));
  const concluidas = rows.filter(r => normalizarChaveStatus(r.status) === 'CONCLUIDO');

  return `
    <div class="card" style="margin-top:16px">
      <div class="card-head">
        <h2>Contas a receber</h2>
        <span class="muted">${contas.length} trabalho(s)</span>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Solicitação</th>
              <th>Advogado</th>
              <th>Serviço</th>
              <th>Cobrado</th>
              <th>Recebido</th>
              <th>Saldo</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${
              contas.length
                ? contas.map(r => `
                  <tr>
                    <td>${codigoComAberturaFinanceiro(r.codigo, r.id)}</td>
                    <td>${escapeHtml(r.advogado)}</td>
                    <td>${escapeHtml(r.tipo)}</td>
                    <td class="money">${money(r.valor)}</td>
                    <td class="money">${money(r.recebido)}</td>
                    <td class="money">${money(Number(r.valor || 0) - Number(r.recebido || 0))}</td>
                    <td>
                      <span class="status ${daysTo(r.prazo) < 0 ? 'atrasado' : 'aguardando'}">
                        ${daysTo(r.prazo) < 0 ? 'Em atraso' : 'A receber'}
                      </span>
                    </td>
                  </tr>
                `).join('')
                : `
                  <tr>
                    <td colspan="7">
                      <div class="empty">Nenhuma conta a receber encontrada com os filtros atuais.</div>
                    </td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-head">
        <div>
          <h2>Histórico financeiro</h2>
          <p class="muted" style="margin-top:4px">Solicitações encerradas financeiramente e seus recebimentos registrados.</p>
        </div>
        <span class="muted">${concluidas.length} trabalho(s)</span>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Solicitação</th>
              <th>Advogado</th>
              <th>Serviço</th>
              <th>Cobrado</th>
              <th>Recebido</th>
              <th>Último recebimento</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${
              concluidas.length
                ? concluidas.map(r => `
                  <tr>
                    <td>${codigoComAberturaFinanceiro(r.codigo, r.id)}</td>
                    <td>${escapeHtml(r.advogado)}</td>
                    <td>${escapeHtml(r.tipo)}</td>
                    <td class="money">${money(r.valor)}</td>
                    <td class="money">${money(r.recebido)}</td>
                    <td>
                      ${r.ultimoPagamento
                        ? `${fmtDate(r.ultimoPagamento.data_pagamento)} · ${escapeHtml(formatarFormaPagamento(r.ultimoPagamento.forma_pagamento))}`
                        : '<span class="muted">Sem pagamento registrado</span>'}
                    </td>
                    <td><span class="status concluido">Concluído</span></td>
                  </tr>
                `).join('')
                : `
                  <tr>
                    <td colspan="7">
                      <div class="empty">Nenhuma solicitação concluída encontrada com os filtros atuais.</div>
                    </td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function atualizarFinanceiroFiltrado() {
  const rows = financeiroFiltrado();
  const billed = rows.reduce((a, r) => a + Number(r.valor || 0), 0);
  const rec = rows.reduce((a, r) => a + Number(r.recebido || 0), 0);
  const due = Math.max(0, billed - rec);

  const tables = $('#financeTables');
  if (tables) tables.innerHTML = financeiroTabelas(rows);

  const summary = $('#financeFilterSummary');
  if (summary) {
    summary.innerHTML = `
      <strong>${rows.length}</strong> trabalho(s) encontrado(s)
      <span>·</span> Faturado <strong>${money(billed)}</strong>
      <span>·</span> Recebido <strong>${money(rec)}</strong>
      <span>·</span> A receber <strong>${money(due)}</strong>
    `;
  }
}

const views = {

  producao() {
    if (!isCalculista()) return views.dashboard();
    return calculistaDashboard();
  },

  dashboard() {
    if (isCalculista() && !isAdministrador()) {
      return calculistaDashboard();
    }

    const open =
      db.requests.filter(
        r =>
          ![
            'CONCLUÍDO',
            'CANCELADO'
          ].includes(r.status)
      ).length;

    const recv =
      db.requests.reduce(
        (a, r) => a + (r.recebido || 0),
        0
      );

    const billed =
      db.requests.reduce(
        (a, r) => a + (r.valor || 0),
        0
      );

    const due =
      db.requests.reduce(
        (a, r) =>
          a +
          Math.max(
            0,
            (r.valor || 0) -
              (r.recebido || 0)
          ),
        0
      );

    const retr = db.retrabalhosCount || 0;

    const attention =
      db.requests.filter(
        r =>
          daysTo(r.prazo) <= 3 &&
          ![
            'CONCLUÍDO',
            'CANCELADO'
          ].includes(r.status)
      );

    const horaAtual = new Date().getHours();
    const saudacao =
      horaAtual >= 5 && horaAtual < 12
        ? 'Bom dia'
        : horaAtual >= 12 && horaAtual < 18
          ? 'Boa tarde'
          : 'Boa noite';

    return (
      pageHead(
        `${saudacao}, ${
          currentProfile?.nome || 'Usuário'
        }`,
        'Visão geral da operação de cálculos judiciais.',
        '<button class="btn btn-primary" data-new>＋ Nova solicitação</button>'
      ) +

      `<div class="grid kpi-grid">
        ${kpi(
          'Em aberto',
          open,
          'Solicitações não concluídas'
        )}

        ${kpi(
          'A receber',
          money(due),
          'Saldo das demandas'
        )}

        ${kpi(
          'Recebido',
          money(recv),
          'Acumulado no protótipo'
        )}

        ${kpi(
          'Retrabalhos',
          retr,
          'Ocorrências recentes'
        )}
      </div>` +

      `
      <div class="section-grid">

        <section class="card">
          <div class="card-head">
            <h2>Solicitações recentes</h2>
            <button
              class="kpi-link"
              data-view-link="solicitacoes"
            >
              Ver todas
            </button>
          </div>

          ${tableRequests(
            db.requests.slice(0, 6)
          )}
        </section>

        <section class="card">
          <div class="card-head">
            <h2>Precisam de atenção</h2>
          </div>

          <div class="card-body">
            <div class="alert-list">

              ${
                attention.length
                  ? attention
                      .map(
                        r => `
                        <div
                          class="alert ${
                            daysTo(r.prazo) < 0
                              ? 'danger'
                              : 'warning'
                          }"
                          data-open="${r.id}"
                        >
                          <div class="mark"></div>

                          <div>
                            <strong>
                              ${r.codigo} · ${r.tipo}
                            </strong>

                            <small>
                              ${
                                daysTo(r.prazo) < 0
                                  ? 'Atrasado'
                                  : daysTo(r.prazo) === 0
                                  ? 'Vence hoje'
                                  : `Vence em ${daysTo(
                                      r.prazo
                                    )} dias`
                              }
                              · ${r.advogado}
                            </small>
                          </div>
                        </div>
                      `
                      )
                      .join('')
                  : `
                    <div class="empty">
                      Nenhuma pendência urgente.
                    </div>
                  `
              }

            </div>
          </div>
        </section>

      </div>
      `
    );
  },

  solicitacoes() {
    const rows = solicitacoesFiltradas();

    return (
      pageHead(
        'Solicitações',
        `${rows.length} demanda(s) encontrada(s).`,
        '<button class="btn btn-primary" data-new>＋ Nova solicitação</button>'
      ) +

      `
      <div class="card filters">

        <div class="field">
          <label>Pesquisar</label>

          <input
            class="input"
            id="q"
            placeholder="Advogado, cliente, processo ou código..."
            value="${state.query}"
          >
        </div>

        <div class="field small">
          <label>Status</label>

          <select id="filterStatus">
            <option value="">Todos</option>

            ${Object.entries(statusLabel)
              .map(
                ([k, v]) =>
                  `<option
                    value="${k}"
                    ${
                      state.status === k
                        ? 'selected'
                        : ''
                    }
                  >
                    ${v}
                  </option>`
              )
              .join('')}
          </select>
        </div>

        <div class="field small">
          <label>Área</label>

          <select id="filterArea">
            <option value="">Todas</option>

            ${
              [
                'Previdenciário',
                'Trabalhista',
                'Servidor Público',
                'Cível',
                'Tributário',
                'Saúde'
              ]
                .map(
                  v =>
                    `<option ${
                      state.area === v
                        ? 'selected'
                        : ''
                    }>${v}</option>`
                )
                .join('')
            }
          </select>
        </div>

        <div class="field small">
          <label>Visualização</label>

          <select id="viewMode">
            <option value="table">Tabela</option>
            <option value="kanban">Kanban</option>
          </select>
        </div>

      </div>

      <div
        id="requestList"
        class="card"
      >
        ${tableRequests(rows)}
      </div>
      `
    );
  },

  advogados() {
    const names = [
      ...new Set(
        db.requests.map(
          r => r.advogado
        )
      )
    ];

    return (
      pageHead(
        'Advogados',
        'Relacionamento e histórico dos solicitantes.'
      ) +

      `
      <div class="grid two-col">

        ${
          names
            .map(n => {
              const calc = db.calculistas.find(c => c.nome === n);
              const rs =
                db.requests.filter(
                  r => r.advogado === n
                );

              const bill =
                rs.reduce(
                  (a, r) => a + r.valor,
                  0
                );

              const rec =
                rs.reduce(
                  (a, r) =>
                    a + r.recebido,
                  0
                );

              return `
                <div class="card">

                  <div class="profile-card">

                    <div class="avatar">
                      ${
                        n
                          .replace(
                            /[^A-Za-zÀ-ÿ]/g,
                            ''
                          )
                          .slice(0, 1) ||
                        'A'
                      }
                    </div>

                    <div class="person-meta">
                      <h3>${n}</h3>
                      <p>
                        ${
                          rs[0]?.origem ||
                          ''
                        }
                        · ${rs.length}
                        solicitações
                      </p>
                    </div>

                  </div>

                  <div class="card-body">

                    <div class="mini-stats">

                      <div class="mini-stat">
                        <strong>${rs.length}</strong>
                        <small>Solicitações</small>
                      </div>

                      <div class="mini-stat">
                        <strong>${money(
                          bill
                        )}</strong>
                        <small>Faturado</small>
                      </div>

                      <div class="mini-stat">
                        <strong>${money(
                          bill - rec
                        )}</strong>
                        <small>A receber</small>
                      </div>

                    </div>

                  </div>

                </div>
              `;
            })
            .join('')
        }

      </div>
      `
    );
  },

  clientes() {
    const names = [
      ...new Set(
        db.requests.map(
          r => r.cliente
        )
      )
    ];

    return (
      pageHead(
        'Clientes',
        'Clientes finais relacionados às demandas.'
      ) +

      `
      <div class="card">

        ${
          names.length
            ? `
              <div class="table-wrap">
                <table>

                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Processo</th>
                      <th>Solicitações</th>
                      <th>Valor</th>
                      <th>Recebido</th>
                    </tr>
                  </thead>

                  <tbody>

                    ${names
                      .map(n => {
                        const rs =
                          db.requests.filter(
                            r =>
                              r.cliente === n
                          );

                        return `
                          <tr
                            data-open="${rs[0].id}"
                          >
                            <td>
                              <strong>${n}</strong>
                            </td>

                            <td>
                              ${
                                rs[0]
                                  .processo ||
                                '—'
                              }
                            </td>

                            <td>
                              ${rs.length}
                            </td>

                            <td class="money">
                              ${money(
                                rs.reduce(
                                  (a, r) =>
                                    a + r.valor,
                                  0
                                )
                              )}
                            </td>

                            <td class="money">
                              ${money(
                                rs.reduce(
                                  (a, r) =>
                                    a +
                                    r.recebido,
                                  0
                                )
                              )}
                            </td>

                          </tr>
                        `;
                      })
                      .join('')}

                  </tbody>

                </table>
              </div>
            `
            : `
              <div class="empty">
                Nenhum cliente.
              </div>
            `
        }

      </div>
      `
    );
  },

  processos() {
    return (
      pageHead(
        'Processos',
        'Pesquisa e acompanhamento das demandas por processo.'
      ) +

      `
      <div class="card filters">

        <div class="field">
          <label>Pesquisar processo</label>

          <input
            class="input"
            id="processSearch"
            placeholder="Número do processo..."
          >
        </div>

      </div>

      <div
        id="processTable"
        class="card"
      >
        ${processTable('')}
      </div>
      `
    );
  },

  calculistas() {
    const names = calculistasDisponiveis().map(c => c.nome);

    return (
      pageHead(
        'Calculistas',
        'Distribuição e acompanhamento operacional.'
      ) +

      `
      <div class="grid two-col">

        ${
          names
            .map(n => {
              const calc = db.calculistas.find(c => c.nome === n);
              const rs =
                db.requests.filter(
                  r =>
                    r.calculista === n
                );

              const done =
                rs.filter(
                  r =>
                    r.status ===
                    'CONCLUÍDO'
                ).length;

              const active =
                rs.filter(
                  r =>
                    ![
                      'CONCLUÍDO',
                      'CANCELADO'
                    ].includes(r.status)
                ).length;

              return `
                <div class="card">

                  <div class="card-body">

                    <div
                      class="profile-card"
                      style="padding:0"
                    >

                      <div class="avatar">
                        ${n[0]}
                      </div>

                      <div class="person-meta">
                        <h3>${n}</h3>
                        <p>Calculista</p>
                      </div>

                    </div>
                    <div class="mini-status">
                      ${(() => {
                        const u = calc?.usuario_id ? db.usuarios.find(x => x.id === calc.usuario_id && x.ativo !== false) : db.usuarios.find(x => (x.nome || '').trim().toLowerCase() === (n || '').trim().toLowerCase() && x.ativo !== false);
                        return u
                          ? `<span class="status concluido">Acesso vinculado</span><small>${u.email || ''}</small>`
                          : `<span class="status aguardando">Sem acesso</span><small>Crie o usuário no Supabase para liberar o login.</small>`;
                      })()}
                    </div>
                    ${isAdministrador() ? `
                      <div class="actions" style="margin-top:12px">
                        <button class="btn btn-secondary" type="button" data-link-calculista="${calc?.id || ''}">Vincular usuário</button>
                      </div>
                    ` : ''}

                    <div class="mini-stats">

                      <div class="mini-stat">
                        <strong>${active}</strong>
                        <small>Em andamento</small>
                      </div>

                      <div class="mini-stat">
                        <strong>${done}</strong>
                        <small>Concluídos</small>
                      </div>

                      <div class="mini-stat">
                        <strong>${rs.length}</strong>
                        <small>Total</small>
                      </div>

                    </div>

                  </div>

                </div>
              `;
            })
            .join('')
        }

      </div>
      `
    );
  },

  usuarios() {
    if (!isAdministrador()) return views.dashboard();

    const calculistaPorUsuario = new Map(
      db.calculistas.filter(c => c.usuario_id).map(c => [c.usuario_id, c])
    );
    const usuarios = db.usuarios.slice().sort((a, b) =>
      String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
    );

    return pageHead(
      'Gerenciar usuários',
      'Crie e administre contas de acesso, funções e vínculo com calculistas.',
      '<button class="btn btn-primary" type="button" data-new-user>＋ Adicionar usuário</button>'
    ) + `
      <section class="card user-management-card">
        <div class="card-head">
          <div>
            <h2>Usuários do sistema</h2>
            <p class="muted">As contas de acesso são vinculadas ao Supabase Auth. As funções são administradas aqui.</p>
          </div>
          <span class="status info">${usuarios.length} usuário(s)</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Usuário</th><th>E-mail</th><th>Funções</th><th>Calculista vinculado</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${usuarios.map(u => {
                const calc = calculistaPorUsuario.get(u.id);
                const funcoes = [];
                if (u.perfil === 'administrador') funcoes.push('Administrador');
                if (calc || u.perfil === 'calculista') funcoes.push('Calculista');
                const rotulo = funcoes.length ? funcoes.join(' · ') : 'Usuário';
                return `
                  <tr>
                    <td><strong>${escapeHtml(u.nome || 'Sem nome')}</strong><small class="muted user-uid">${escapeHtml(u.id)}</small></td>
                    <td>${escapeHtml(u.email || '—')}</td>
                    <td><strong>${rotulo}</strong></td>
                    <td>${calc ? escapeHtml(calc.nome) : '<span class="muted">—</span>'}</td>
                    <td><span class="status ${u.ativo !== false ? 'concluido' : 'cancelado'}">${u.ativo !== false ? 'Ativo' : 'Inativo'}</span></td>
                    <td class="actions-cell"><button class="btn btn-secondary" type="button" data-edit-user="${escapeHtml(u.id)}">Editar</button><button class="btn btn-danger" type="button" data-delete-user="${escapeHtml(u.id)}">Excluir</button></td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </section>
      <div class="notice" style="margin-top:16px"><strong>Importante:</strong> a criação ou alteração da conta de autenticação é feita de forma administrativa. Não é necessário editar manualmente <code>auth.users</code> para definir permissões.</div>
    `;
  },

  financeiro() {
    const filtered = financeiroFiltrado();
    const billed = filtered.reduce((a, r) => a + Number(r.valor || 0), 0);
    const rec = filtered.reduce((a, r) => a + Number(r.recebido || 0), 0);
    const due = Math.max(0, billed - rec);
    const overdue = filtered
      .filter(r => daysTo(r.prazo) < 0 && Number(r.valor || 0) > Number(r.recebido || 0))
      .reduce((a, r) => a + (Number(r.valor || 0) - Number(r.recebido || 0)), 0);

    const areas = [...new Set(db.requests.map(r => r.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return (
      pageHead(
        'Financeiro',
        'Faturamento, recebimentos e contas a receber.'
      ) +

      `
      <div class="card filters" style="margin-top:16px">
        <div class="field">
          <label>Pesquisar</label>
          <input
            class="input"
            id="financeQ"
            placeholder="Advogado, cliente, processo, serviço ou código..."
            value="${escapeHtml(state.financeQuery || '')}"
          >
        </div>

        <div class="field small">
          <label>Status</label>
          <select id="financeFilterStatus">
            <option value="">Todos</option>
            ${Object.entries(statusLabel).map(([k, v]) => `
              <option value="${escapeHtml(k)}" ${state.financeStatus === k ? 'selected' : ''}>${escapeHtml(v)}</option>
            `).join('')}
          </select>
        </div>

        <div class="field small">
          <label>Área</label>
          <select id="financeFilterArea">
            <option value="">Todas</option>
            ${areas.map(v => `
              <option value="${escapeHtml(v)}" ${state.financeArea === v ? 'selected' : ''}>${escapeHtml(v)}</option>
            `).join('')}
          </select>
        </div>

        <div class="field small">
          <label>Visualização</label>
          <select id="financeViewMode">
            <option value="tabela">Tabela</option>
          </select>
        </div>
      </div>

      <div class="grid kpi-grid financeiro-kpis" style="margin-top:16px">
        ${kpi('Faturado', money(billed), 'Total das solicitações')}
        ${kpi('Recebido', money(rec), 'Pagamentos registrados')}
        ${kpi('A receber', money(due), 'Saldo em aberto')}
        ${kpi('Em atraso', money(overdue), 'Prazos vencidos')}
      </div>

      <div class="finance-filter-summary" id="financeFilterSummary" style="margin-top:12px">
        <strong>${filtered.length}</strong> trabalho(s) encontrado(s)
        <span>·</span> Faturado <strong>${money(billed)}</strong>
        <span>·</span> Recebido <strong>${money(rec)}</strong>
        <span>·</span> A receber <strong>${money(due)}</strong>
      </div>

      <div id="financeTables">
        ${financeiroTabelas(filtered)}
      </div>
      `
    );
  },


  relatorios() {
    const areas = {};

    db.requests.forEach(
      r =>
        (areas[r.area] =
          (areas[r.area] || 0) +
          1)
    );

    const orig = {};

    db.requests.forEach(
      r =>
        (orig[r.origem] =
          (orig[r.origem] || 0) +
          1)
    );

    return (
      pageHead(
        'Relatórios',
        'Visões operacionais para produção, origem e financeiro.'
      ) +

      `
      <div class="grid two-col">

        <section class="card">

          <div class="card-head">
            <h2>Solicitações por área</h2>
          </div>

          <div class="card-body">

            ${
              Object.entries(areas)
                .map(
                  ([k, v]) => `
                    <div
                      style="
                        display:flex;
                        justify-content:space-between;
                        padding:11px 0;
                        border-bottom:1px solid var(--line);
                        font-size:13px
                      "
                    >
                      <span>${k}</span>
                      <strong>${v}</strong>
                    </div>
                  `
                )
                .join('')
            }

          </div>

        </section>

        <section class="card">

          <div class="card-head">
            <h2>Origem das solicitações</h2>
          </div>

          <div class="card-body">

            ${
              Object.entries(orig)
                .map(
                  ([k, v]) => `
                    <div
                      style="
                        display:flex;
                        justify-content:space-between;
                        padding:11px 0;
                        border-bottom:1px solid var(--line);
                        font-size:13px
                      "
                    >
                      <span>${k}</span>
                      <strong>${v}</strong>
                    </div>
                  `
                )
                .join('')
            }

          </div>

        </section>

      </div>

      <div
        class="notice"
        style="margin-top:16px"
      >
        Os gráficos avançados, exportação e indicadores históricos serão ligados ao Supabase na próxima etapa.
      </div>
      `
    );
  },

  manual() {
    return manualView();
  },

  configuracoes() {
    return (
      pageHead(
        'Configurações',
        'Cadastros e integrações do Gestão Computum.'
      ) +

      `
      <div class="grid two-col">

        <section class="card">

          <div class="card-head">
            <h2>Sistemas especializados</h2>

            <button
              class="btn"
              data-system
            >
              ＋ Adicionar
            </button>
          </div>

          <div class="card-body">

            <div class="alert-list">

              <div class="alert">
                <div class="mark"></div>

                <div>
                  <strong>
                    Abono Computum
                  </strong>

                  <small>
                    https://abono.computum.com.br
                  </small>
                </div>
              </div>

              <div class="alert">
                <div class="mark"></div>

                <div>
                  <strong>
                    Diferenças Computum
                  </strong>

                  <small>
                    https://diferencas.computum.com.br
                  </small>
                </div>
              </div>

              <div class="alert">
                <div class="mark"></div>

                <div>
                  <strong>
                    Saúde Computum
                  </strong>

                  <small>
                    https://saude.computum.com.br
                  </small>
                </div>
              </div>

            </div>

          </div>

        </section>

        <section class="card">

          <div class="card-head">
            <h2>Integrações</h2>
          </div>

          <div class="card-body">

            <div class="notice">
              <strong>Supabase:</strong>
              aguardando URL e chave pública do projeto.
            </div>

            <div
              class="notice"
              style="margin-top:10px"
            >
              <strong>Google Drive:</strong>
              integração preparada conceitualmente; requer OAuth/configuração da aplicação.
            </div>

          </div>

        </section>

      </div>
      `
    );
  }
};

function processTable(q) {
  const seen = new Map();

  db.requests.forEach(r => {
    if (
      q &&
      !r.processo
        .toLowerCase()
        .includes(
          q.toLowerCase()
        )
    ) {
      return;
    }

    if (!seen.has(r.processo)) {
      seen.set(
        r.processo,
        r
      );
    }
  });

  const rows = [
    ...seen.values()
  ];

  return rows.length
    ? `
      <div class="table-wrap">

        <table>

          <thead>
            <tr>
              <th>Processo</th>
              <th>Cliente</th>
              <th>Advogado</th>
              <th>Último serviço</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>

            ${
              rows
                .map(
                  r => `
                    <tr data-open="${r.id}">

                      <td>
                        <strong>
                          ${r.processo}
                        </strong>
                      </td>

                      <td>
                        ${r.cliente}
                      </td>

                      <td>
                        ${r.advogado}
                      </td>

                      <td>
                        ${r.tipo}
                      </td>

                      <td>
                        <span
                          class="status ${statusClass(
                            r.status
                          )}"
                        >
                          ${
                            statusLabel[
                              r.status
                            ]
                          }
                        </span>
                      </td>

                    </tr>
                  `
                )
                .join('')
            }

          </tbody>

        </table>

      </div>
    `
    : `
      <div class="empty">
        Nenhum processo encontrado.
      </div>
    `;
}

function newModal() {
  return `
    <div
      class="modal-backdrop"
      id="requestModal"
    >

      <div class="modal">

        <div class="modal-head">

          <h2>
            Nova solicitação
          </h2>

          <button
            class="close"
            data-close
          >
            ×
          </button>

        </div>

        <form id="requestForm">

          <div class="modal-body">

            <div
              class="notice"
              style="margin-bottom:16px"
            >
              Cadastro rápido: os dados podem ser complementados depois. Os documentos serão recebidos pelo Google Forms e organizados no Google Drive.
            </div>

            <div class="form-grid">

              <div class="field">
                <label>
                  Advogado *
                </label>

                <input
                  required
                  name="advogado"
                  class="input"
                  placeholder="Nome do advogado"
                >
              </div>

              <div class="field">
                <label>
                  Origem
                </label>

                <select name="origem">
                  <option>Indicação</option>
                  <option>Instagram</option>
                  <option>Site</option>
                  <option>WhatsApp</option>
                  <option>Cliente antigo</option>
                  <option>LinkedIn</option>
                  <option>Outro</option>
                </select>
              </div>

              <div class="field">
                <label>
                  Cliente *
                </label>

                <input
                  required
                  name="cliente"
                  class="input"
                  placeholder="Nome do cliente"
                >
              </div>

              <div class="field">
                <label>
                  CPF
                </label>

                <input
                  name="cpf"
                  class="input"
                  placeholder="Opcional"
                >
              </div>

              <div class="field">
                <label>
                  Número do processo
                </label>

                <input
                  name="processo"
                  class="input"
                  placeholder="0000000-00.0000.0.00.0000"
                >
              </div>

              <div class="field">
                <label>
                  Prazo
                </label>

                <input
                  type="date"
                  name="prazo"
                  class="input"
                >
              </div>

              <div class="field">
                <label>
                  Área *
                </label>

                <select
                  required
                  name="area"
                  id="newArea"
                >
                  <option value="">
                    Selecione
                  </option>
                  ${db.areas
                    .filter(a => a.ativo !== false)
                    .map(a => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.nome)}</option>`)
                    .join('')}
                </select>
              </div>

              <div class="field">
                <label>
                  Tipo de serviço *
                </label>

                <select
                  required
                  name="tipo"
                  id="newTipo"
                >
                  <option value="">
                    Selecione a área primeiro
                  </option>
                </select>
              </div>

              <div
                class="field full"
                id="newTipoOutroWrap"
                style="display:none"
              >
                <label for="newTipoOutro">
                  Especifique o tipo de serviço *
                </label>

                <input
                  id="newTipoOutro"
                  name="tipo_servico_outro"
                  class="input"
                  maxlength="100"
                  placeholder="Descreva o tipo de serviço"
                >

                <small
                  class="muted"
                  id="newTipoOutroCounter"
                  style="display:block;margin-top:5px"
                >0/100</small>
              </div>

              <div class="field">
                <label>
                  Calculista
                </label>

                <select name="calculista">

                  <option value="">
                    Não atribuído
                  </option>

                  ${calculistasDisponiveis()
                    .slice()
                    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
                    .map(
                      c =>
                        `<option value="${escapeHtml(c.id)}">
                          ${escapeHtml(c.nome)}
                        </option>`
                    )
                    .join('')}

                </select>
              </div>

              <div class="field">
                <label>
                  Valor cobrado
                </label>

                <input
                  name="valor"
                  class="input"
                  inputmode="decimal"
                  placeholder="0,00"
                >
              </div>

              <div class="field">
                <label>
                  Prioridade
                </label>

                <select name="prioridade">
                  <option>Normal</option>
                  <option>Alta</option>
                  <option>Urgente</option>
                </select>
              </div>

              <div class="field">
                <label>
                  Tipo de entrega
                </label>

                <select name="entrega">
                  <option>
                    Cálculo
                  </option>

                  <option>
                    Cálculo + parecer
                  </option>

                  <option>
                    Apenas parecer
                  </option>

                  <option>
                    Conferência
                  </option>
                </select>
              </div>

              <div class="field full">
                <label>
                  Texto da solicitação
                </label>

                <textarea
                  name="descricao"
                  rows="4"
                  placeholder="Cole aqui a mensagem ou descreva o que o advogado solicitou..."
                ></textarea>
              </div>

              <div class="field full">
                <label>
                  Documento inicial
                </label>

                <input
                  type="file"
                  name="arquivo"
                  class="input"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                >
              </div>

            </div>

          </div>

          <div class="modal-foot">

            <button
              type="button"
              class="btn"
              data-close
            >
              Cancelar
            </button>

            <button
              type="submit"
              class="btn btn-primary"
            >
              Criar solicitação
            </button>

          </div>

        </form>

      </div>

    </div>
  `;
}

function obterTiposParaArea(areaId) {
  // 'Outro' é uma opção especial do formulário e deve aparecer sempre por último,
  // independentemente de existir ou não como registro em tipos_servico.
  const tipos = db.tipos
    .filter(t =>
      t.ativo !== false &&
      String(t.area_id) === String(areaId) &&
      String(t.nome || '').trim().toLowerCase() !== 'outro'
    )
    .sort((a, b) => {
      const ordemA = Number(a.ordem ?? 9999);
      const ordemB = Number(b.ordem ?? 9999);
      if (ordemA !== ordemB) return ordemA - ordemB;
      return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    });

  return [
    ...tipos,
    { id: '__OUTRO__', nome: 'Outro', area_id: areaId, ativo: true, ordem: 99999 }
  ];
}

function preencherTiposNovo(areaId, valorSelecionado = '') {
  const tipo = $('#newTipo');
  if (!tipo) return;
  const tipos = obterTiposParaArea(areaId);
  tipo.innerHTML = '<option value="">Selecione</option>' + tipos.map(t => {
    const value = t.id === '__OUTRO__' ? '__OUTRO__' : t.id;
    return `<option value="${escapeHtml(value)}">${escapeHtml(t.nome)}</option>`;
  }).join('');
  if (valorSelecionado) tipo.value = valorSelecionado;
}

function atualizarCampoTipoOutroNovo() {
  const tipo = $('#newTipo');
  const wrap = $('#newTipoOutroWrap');
  const input = $('#newTipoOutro');
  const counter = $('#newTipoOutroCounter');
  if (!tipo || !wrap || !input) return;
  const outro = tipo.value === '__OUTRO__';
  wrap.style.display = outro ? '' : 'none';
  input.required = outro;
  if (!outro) input.value = '';
  if (counter) counter.textContent = `${input.value.length}/100`;
}

function openNew() {
  $('#modalRoot').innerHTML = newModal();
  const area = $('#newArea');
  const tipo = $('#newTipo');
  const outroInput = $('#newTipoOutro');
  const outroCounter = $('#newTipoOutroCounter');

  area.addEventListener('change', () => {
    preencherTiposNovo(area.value);
    atualizarCampoTipoOutroNovo();
  });
  tipo.addEventListener('change', atualizarCampoTipoOutroNovo);
  if (outroInput && outroCounter) {
    outroInput.addEventListener('input', () => {
      if (outroInput.value.length > 100) outroInput.value = outroInput.value.slice(0, 100);
      outroCounter.textContent = `${outroInput.value.length}/100`;
    });
  }
  $('#requestModal').addEventListener('click', e => {
    if (e.target.matches('[data-close]')) closeModal();
  });
  $('#requestForm').addEventListener('submit', createRequest);
}

function closeModal() {
  $('#modalRoot').innerHTML = '';
}

async function createRequest(e) {
  e.preventDefault();

  const f =
    new FormData(e.target);

  const submitButton =
    e.target.querySelector(
      'button[type="submit"]'
    );

  try {

    submitButton.disabled = true;
    submitButton.textContent =
      'Salvando...';

    const advogadoNome =
      String(
        f.get('advogado') || ''
      ).trim();

    const clienteNome =
      String(
        f.get('cliente') || ''
      ).trim();

    const cpf =
      String(
        f.get('cpf') || ''
      ).trim();

    const processoNumero =
      String(
        f.get('processo') || ''
      ).trim();

    const areaSelecionada =
      String(
        f.get('area') || ''
      ).trim();

    const areaCadastro =
      db.areas.find(a => String(a.id) === areaSelecionada);

    const areaNome =
      String(
        areaCadastro?.nome || areaSelecionada
      ).trim();

    const tipoSelecionado =
      String(
        f.get('tipo') || ''
      ).trim();

    const tipoCadastro =
      db.tipos.find(t => String(t.id) === tipoSelecionado);

    const tipoNome =
      tipoSelecionado === '__OUTRO__'
        ? 'Outro'
        : String(
            tipoCadastro?.nome || tipoSelecionado
          ).trim();

    const tipoServicoOutro =
      String(
        f.get('tipo_servico_outro') || ''
      ).trim();

    const origem =
      String(
        f.get('origem') || ''
      ).trim();

    const prioridadeLabel =
      String(
        f.get('prioridade') ||
          'Normal'
      ).trim();

    const calculistaIdSelecionado =
      String(
        f.get('calculista') || ''
      ).trim() || null;

    const entregaLabel =
      String(
        f.get('entrega') ||
          'Cálculo'
      ).trim();

    const descricao =
      String(
        f.get('descricao') || ''
      ).trim();

    const prazo =
      String(
        f.get('prazo') || ''
      ).trim();

    const valor =
      parseMoney(
        f.get('valor')
      );

    if (
      !advogadoNome ||
      !clienteNome ||
      !areaSelecionada ||
      !areaNome ||
      !tipoSelecionado ||
      !tipoNome
    ) {
      throw new Error(
        'Preencha os campos obrigatórios.'
      );
    }

    if (tipoNome === 'Outro' && !tipoServicoOutro) {
      throw new Error('Especifique o tipo de serviço quando selecionar Outro.');
    }
    if (tipoServicoOutro.length > 100) {
      throw new Error('A especificação do tipo de serviço deve ter no máximo 100 caracteres.');
    }

    /*
     * 1. LOCALIZA / CRIA O ADVOGADO
     */

    let advogado;

    const advogadoBusca =
      await supabaseClient
        .from('advogados')
        .select(
          'id, nome, origem'
        )
        .ilike(
          'nome',
          advogadoNome
        )
        .limit(1)
        .maybeSingle();

    if (advogadoBusca.error) {
      throw advogadoBusca.error;
    }

    advogado =
      advogadoBusca.data;

    if (!advogado) {

      const novoAdvogado =
        await supabaseClient
          .from('advogados')
          .insert({
            nome:
              advogadoNome,
            origem:
              origem || null
          })
          .select(
            'id, nome, origem'
          )
          .single();

      if (novoAdvogado.error) {
        throw novoAdvogado.error;
      }

      advogado =
        novoAdvogado.data;
    }

    /*
     * 2. LOCALIZA / CRIA O CLIENTE
     */

    let cliente = null;

    if (cpf) {

      const clienteCpf =
        await supabaseClient
          .from('clientes')
          .select(
            'id, nome, cpf'
          )
          .eq(
            'cpf',
            cpf
          )
          .limit(1)
          .maybeSingle();

      if (clienteCpf.error) {
        throw clienteCpf.error;
      }

      cliente =
        clienteCpf.data;
    }

    if (!cliente) {

      const clienteNomeBusca =
        await supabaseClient
          .from('clientes')
          .select(
            'id, nome, cpf'
          )
          .ilike(
            'nome',
            clienteNome
          )
          .limit(1)
          .maybeSingle();

      if (clienteNomeBusca.error) {
        throw clienteNomeBusca.error;
      }

      cliente =
        clienteNomeBusca.data;
    }

    if (!cliente) {

      const novoCliente =
        await supabaseClient
          .from('clientes')
          .insert({
            nome:
              clienteNome,
            cpf:
              cpf || null
          })
          .select(
            'id, nome, cpf'
          )
          .single();

      if (novoCliente.error) {
        throw novoCliente.error;
      }

      cliente =
        novoCliente.data;
    }

    /*
     * 3. LOCALIZA / CRIA O PROCESSO
     */

    let processo = null;

    if (processoNumero) {

      const processoBusca =
        await supabaseClient
          .from('processos')
          .select(
            'id, numero_processo, cliente_id'
          )
          .eq(
            'numero_processo',
            processoNumero
          )
          .limit(1)
          .maybeSingle();

      if (processoBusca.error) {
        throw processoBusca.error;
      }

      processo =
        processoBusca.data;

      if (!processo) {

        const novoProcesso =
          await supabaseClient
            .from('processos')
            .insert({
              numero_processo:
                processoNumero,
              cliente_id:
                cliente.id
            })
            .select(
              'id, numero_processo, cliente_id'
            )
            .single();

        if (novoProcesso.error) {
          throw novoProcesso.error;
        }

        processo =
          novoProcesso.data;
      }
    }

    /*
     * 4. LOCALIZA A ÁREA
     */

    const areaResult =
      await supabaseClient
        .from('areas_servico')
        .select(
          'id, nome'
        )
        .eq(
          'id',
          areaSelecionada
        )
        .limit(1)
        .maybeSingle();

    if (areaResult.error) {
      throw areaResult.error;
    }

    if (!areaResult.data) {
      throw new Error(
        `Área de serviço não encontrada: ${areaNome}`
      );
    }

    const area =
      areaResult.data;

    /*
     * 5. LOCALIZA / CRIA O TIPO DE SERVIÇO
     */

    let tipo = null;

    if (tipoSelecionado && tipoSelecionado !== '__OUTRO__') {
      const tipoResult =
        await supabaseClient
          .from('tipos_servico')
          .select(
            'id, nome, area_id'
          )
          .eq(
            'id',
            tipoSelecionado
          )
          .eq(
            'area_id',
            area.id
          )
          .limit(1)
          .maybeSingle();

      if (tipoResult.error) {
        throw tipoResult.error;
      }

      tipo = tipoResult.data;
    }

    if (!tipo) {
      const tipoResult =
        await supabaseClient
          .from('tipos_servico')
          .select(
            'id, nome, area_id'
          )
          .eq(
            'area_id',
            area.id
          )
          .eq(
            'nome',
            tipoNome
          )
          .limit(1)
          .maybeSingle();

      if (tipoResult.error) {
        throw tipoResult.error;
      }

      tipo = tipoResult.data;
    }

    if (!tipo) {
      const novoTipo =
        await supabaseClient
          .from('tipos_servico')
          .insert({
            area_id:
              area.id,
            nome:
              tipoNome
          })
          .select(
            'id, nome, area_id'
          )
          .single();

      if (novoTipo.error) {
        throw novoTipo.error;
      }

      tipo =
        novoTipo.data;
    }

    /*
     * 6. LOCALIZA O CALCULISTA
     *
     * A atribuição usa exclusivamente o ID do cadastro de calculista.
     * Nome nunca é usado para identificar ou conceder função.
     */

    let calculistaId = null;

    if (calculistaIdSelecionado) {
      const calculistaSelecionado = calculistasDisponiveis().find(c => c.id === calculistaIdSelecionado);
      if (!calculistaSelecionado) {
        throw new Error('O calculista selecionado não está disponível para atribuição.');
      }
      calculistaId = calculistaSelecionado.id;
    }

    /*
     * 7. CONVERTE VALORES DO FORMULÁRIO
     */

    const prioridadeMap = {
      Normal: 'normal',
      Alta: 'alta',
      Urgente: 'urgente'
    };

    const entregaMap = {
      'Cálculo':
        'calculo',

      'Cálculo + parecer':
        'calculo_parecer',

      'Apenas parecer':
        'parecer',

      'Conferência':
        'conferencia'
    };

    const prioridade =
      prioridadeMap[
        prioridadeLabel
      ] || 'normal';

    const tipoEntrega =
      entregaMap[
        entregaLabel
      ] || 'calculo';

    /*
     * 8. GERA O CÓDIGO DA SOLICITAÇÃO
     */

    const {
      data: ultimaSolicitacao,
      error: ultimaError
    } =
      await supabaseClient
        .from('solicitacoes')
        .select('codigo')
        .like(
          'codigo',
          `CJ-${today.getFullYear()}-%`
        )
        .order(
          'created_at',
          {
            ascending: false
          }
        )
        .limit(1)
        .maybeSingle();

    if (ultimaError) {
      throw ultimaError;
    }

    let proximoNumero = 1;

    if (
      ultimaSolicitacao?.codigo
    ) {

      const partes =
        ultimaSolicitacao.codigo
          .split('-');

      const ultimoNumero =
        Number(
          partes[2]
        );

      if (
        Number.isFinite(
          ultimoNumero
        )
      ) {
        proximoNumero =
          ultimoNumero + 1;
      }
    }

    const codigo =
      `CJ-${today.getFullYear()}-${String(
        proximoNumero
      ).padStart(5, '0')}`;

    /*
     * 9. CRIA A SOLICITAÇÃO NO SUPABASE
     */

    const solicitacaoResult =
      await supabaseClient
        .from('solicitacoes')
        .insert({
          codigo,
          advogado_id:
            advogado.id,
          cliente_id:
            cliente.id,
          processo_id:
            processo?.id || null,
          area_id:
            area.id,
          tipo_servico_id:
            tipo.id,
          tipo_servico_outro:
            tipoNome === 'Outro' ? (tipoServicoOutro || null) : null,
          descricao:
            descricao || null,
          prazo:
            prazo || null,
          status:
            'NOVO',
          prioridade,
          calculista_id:
            calculistaId,
          revisor_id:
            null,
          tipo_entrega:
            tipoEntrega,
          valor_cobrado:
            valor,
          desconto:
            0,
          valor_final:
            valor,
          origem:
            origem || null,
          cliente_antigo:
            origem ===
            'Cliente antigo',
          created_by:
            currentUser?.id ||
            null
        })
        .select(
          'id, codigo'
        )
        .single();

    if (solicitacaoResult.error) {
      throw solicitacaoResult.error;
    }

    const solicitacao =
      solicitacaoResult.data;

    /*
     * 10. REGISTRA O PRIMEIRO EVENTO NO HISTÓRICO
     */

    const historicoResult =
      await supabaseClient
        .from(
          'historico_solicitacao'
        )
        .insert({
          solicitacao_id:
            solicitacao.id,
          usuario_id:
            currentUser?.id ||
            null,
          tipo_evento:
            'CRIACAO',
          descricao:
            tipoNome === 'Outro'
              ? `Solicitação criada por ${currentProfile?.nome || currentUser?.email || 'Usuário'} (${currentProfile?.email || currentUser?.email || 'e-mail não informado'}). Tipo de serviço: Outro — ${tipoServicoOutro}.`
              : `Solicitação criada por ${currentProfile?.nome || currentUser?.email || 'Usuário'} (${currentProfile?.email || currentUser?.email || 'e-mail não informado'}).`
        });

    if (historicoResult.error) {
      console.error(
        'Solicitação criada, mas houve erro ao registrar o histórico:',
        historicoResult.error
      );
    }

    /*
     * 11. RECARREGA OS DADOS DO SUPABASE
     */

    const dadosCarregados =
      await carregarSolicitacoes();

    if (!dadosCarregados) {
      throw new Error(
        'A solicitação foi criada, mas não foi possível atualizar a tela.'
      );
    }

    /*
     * 12. FINALIZA
     */

    closeModal();

    state.view =
      'solicitacoes';

    render();

    showToast(
      `${solicitacao.codigo} criado com sucesso.`
    );

  } catch (error) {

    console.error(
      'Erro ao criar solicitação:',
      error
    );

    showToast(
      error?.message ||
      'Não foi possível criar a solicitação.'
    );

    const button =
      e.target.querySelector(
        'button[type="submit"]'
      );

    if (button) {
      button.disabled =
        false;

      button.textContent =
        'Criar solicitação';
    }
  }
}

function parseMoney(v) {
  return Number(
    String(v || '')
      .replace(/\./g, '')
      .replace(',', '.')
  ) || 0;
}

function serviceSystem(tipo) {
  if (
    tipo ===
    'Abono de Permanência'
  ) {
    return 'Abono Computum';
  }

  if (
    tipo ===
    'Plano de Saúde'
  ) {
    return 'Saúde Computum';
  }

  if (
    tipo ===
    'Diferenças'
  ) {
    return 'Diferenças Computum';
  }

  return '';
}

function abrirAtribuicaoSolicitacao(id) {
  if (!podeAtribuirSolicitacao()) return;
  const r = db.requests.find(item => item.id === id);
  if (!r) return;
  const calculistas = calculistasDisponiveis().slice().sort((a,b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  $('#modalRoot').innerHTML = `
    <div class="modal-backdrop" id="assignRequestModal"><div class="modal" style="max-width:620px">
      <div class="modal-head"><div><span class="eyebrow">OPERAÇÃO</span><h2>Atribuir solicitação</h2><small class="muted">${escapeHtml(r.codigo)} · ${escapeHtml(r.cliente)}</small></div><button class="close" data-close type="button">×</button></div>
      <form id="assignRequestForm"><div class="modal-body"><div class="notice" style="margin-bottom:16px">Esta ação altera somente o calculista responsável. Não permite editar ou excluir a solicitação.</div>
      <div class="field"><label for="assignCalc">Calculista</label><select class="input" id="assignCalc" name="calculista_id"><option value="">Não atribuído</option>${calculistas.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === r.calculistaId ? 'selected' : ''}>${escapeHtml(c.nome)}</option>`).join('')}</select></div>
      </div><div class="modal-foot"><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn btn-primary">Salvar atribuição</button></div></form>
    </div></div>`;
  $('#assignRequestModal').addEventListener('click', e => { if (e.target.matches('[data-close]')) closeModal(); });
  $('#assignRequestForm').addEventListener('submit', async e => {
    e.preventDefault(); const button = e.target.querySelector('button[type="submit"]'); const calculistaId = String(new FormData(e.target).get('calculista_id') || '').trim() || null; button.disabled = true;
    const { error } = await supabaseClient.from('solicitacoes').update({ calculista_id: calculistaId, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { console.error('Erro ao atribuir solicitação:', error); showToast('Não foi possível salvar a atribuição.'); button.disabled = false; return; }
    const calc = calculistas.find(c => c.id === calculistaId); const actor = `${currentProfile?.nome || currentUser?.email || 'Usuário'} (${currentProfile?.email || currentUser?.email || 'e-mail não informado'})`;
    const { error: histError } = await supabaseClient.from('historico_solicitacao').insert({ solicitacao_id: id, usuario_id: currentUser?.id || null, tipo_evento: 'ATRIBUICAO', descricao: calculistaId ? `Solicitação atribuída a ${calc?.nome || 'calculista'}. Ação realizada por ${actor}.` : `Atribuição removida. Ação realizada por ${actor}.`, data_hora: new Date().toISOString() });
    if (histError) console.error('Atribuição salva, mas o histórico não foi registrado:', histError);
    closeModal(); await carregarSolicitacoes(); render(); openDetail(id); showToast(calculistaId ? 'Solicitação atribuída.' : 'Atribuição removida.');
  });
}

function openDetail(id) {

  const r =
    db.requests.find(
      x => x.id === id
    );

  if (!r) return;

  state.selected =
    id;

  $('#drawerRoot').innerHTML = `
    <div
      class="drawer-backdrop"
      id="drawerBackdrop"
    >

      <aside class="drawer">

        <div class="drawer-head">

          <div>

            <strong>
              ${r.codigo}
            </strong>

            <div
              class="muted"
              style="
                font-size:11px;
                margin-top:3px
              "
            >
              Detalhes da solicitação
            </div>

          </div>

          <button
            class="close"
            data-drawer-close
          >
            ×
          </button>

          ${podeAtribuirSolicitacao() ? `
            <div class="actions" style="margin-left:auto;margin-right:10px">
              <button class="btn" data-assign-request="${r.id}">Atribuir</button>
              ${isAdministrador() ? `<button class="btn" data-edit-request="${r.id}">✎ Editar</button><button class="btn" data-delete-request="${r.id}">Excluir</button>` : ''}
            </div>
          ` : ''}

        </div>

        <div class="drawer-body">

          ${isAdministrador() && r.status === 'CONCLUIDO' ? `
            <div class="notice" style="margin-bottom:14px">
              Ajuste financeiro excepcional: <strong>Ctrl + Shift + E</strong>
            </div>
          ` : ''}

          <h2 class="detail-title">
            ${r.tipo}
          </h2>

          <div class="detail-meta">

            <span
              class="status ${statusClass(
                r.status
              )}"
            >
              ${
                statusLabel[
                  r.status
                ]
              }
            </span>

            <span
              class="status ${
                r.prioridade ===
                'Urgente'
                  ? 'atrasado'
                  : 'novo'
              }"
            >
              ${r.prioridade}
            </span>

          </div>

          <div class="detail-grid">

            <div class="detail-box">
              <small>Advogado</small>
              <strong>
                ${r.advogado}
              </strong>
            </div>

            <div class="detail-box">
              <small>Cliente</small>
              <strong>
                ${r.cliente}
              </strong>
            </div>

            <div class="detail-box">
              <small>Processo</small>
              <strong>
                ${r.processo}
              </strong>
            </div>

            <div class="detail-box">
              <small>Prazo</small>
              <strong>
                ${fmtDate(r.prazo)}
              </strong>
            </div>

            <div class="detail-box">
              <small>Calculista</small>
              <strong>
                ${
                  r.calculista ||
                  'Não atribuído'
                }
              </strong>
            </div>

            <div class="detail-box">
              <small>Valor</small>
              <strong>
                ${money(r.valor)}
              </strong>
            </div>

            <div class="detail-box">
              <small>Recebido</small>
              <strong>
                ${money(r.recebido)}
              </strong>
            </div>

            <div class="detail-box">
              <small>Sistema</small>
              <strong>
                ${
                  r.sistema ||
                  'Nenhum vinculado'
                }
              </strong>
            </div>

          </div>

          <div
            class="card"
            style="margin-top:16px"
          >

            <div class="card-head">
              <h2>Solicitação</h2>
            </div>

            <div class="card-body">

              <div
                style="
                  font-size:13px;
                  line-height:1.65
                "
              >
                ${
                  r.descricao ||
                  'Sem descrição.'
                }
              </div>

            </div>

          </div>

          ${isAdministrador() && estaEmRevisao(r.status) ? `
          <div class="card review-card" style="margin-top:16px;border-left:4px solid var(--terracotta)">
            <div class="card-head">
              <div>
                <h2>Revisão do cálculo</h2>
                <p class="muted" style="margin-top:4px">A produção foi enviada pelo calculista e aguarda conferência administrativa.</p>
              </div>
            </div>
            <div class="card-body">
              <div class="review-actions" style="display:flex;gap:10px;flex-wrap:wrap">
                <button class="btn btn-primary" type="button" data-review-approve="${r.id}">✓ Aprovar e marcar como enviado</button>
                <button class="btn" type="button" data-review-return="${r.id}">↩ Devolver para cálculo</button>
              </div>
              <div id="reviewReturnBox" style="display:none;margin-top:14px">
                <label class="field-label" for="reviewReturnReason">Motivo da devolução <span aria-hidden="true">*</span></label>
                <textarea id="reviewReturnReason" class="input" rows="4" placeholder="Descreva o que precisa ser ajustado pelo calculista."></textarea>
                <div class="actions" style="margin-top:10px">
                  <button class="btn" type="button" data-review-cancel-return>Cancelar</button>
                  <button class="btn btn-primary" type="button" data-review-confirm-return="${r.id}">Devolver para ajuste</button>
                </div>
              </div>
            </div>
          </div>
          ` : ''}

          ${isAdministrador() && r.status === 'ENVIADO' ? `
          <div class="card delivery-action-card" style="margin-top:16px;border-left:4px solid var(--terracotta)">
            <div class="card-head">
              <div>
                <h2>Entrega administrativa</h2>
                <p class="muted" style="margin-top:4px">O cálculo foi aprovado e está marcado como enviado. Registre a entrega para iniciar o acompanhamento do pagamento.</p>
              </div>
              <span class="status enviado">Enviado</span>
            </div>
            <div class="card-body">
              <div class="actions">
                <button class="btn btn-primary" type="button" data-register-delivery="${r.id}">Registrar entrega e aguardar pagamento</button>
              </div>
            </div>
          </div>
          ` : ''}

          ${isAdministrador() && r.status === 'AGUARDANDO_PAGAMENTO' ? `
          <div class="card financial-action-card" style="margin-top:16px">
            <div class="card-head">
              <div>
                <h2>Encerramento financeiro</h2>
                <p class="muted" style="margin-top:4px">A solicitação foi enviada e aguarda o registro do recebimento.</p>
              </div>
              <span class="status pagamento">Aguardando pagamento</span>
            </div>
            <div class="card-body">
              <div class="financial-summary compact">
                <div><small>Valor do serviço</small><strong>${money(r.valor)}</strong></div>
                <div><small>Já recebido</small><strong>${money(r.recebido)}</strong></div>
                <div><small>Saldo</small><strong>${money(saldoPendente(r))}</strong></div>
              </div>
              ${Array.isArray(r.pagamentos) && r.pagamentos.length ? `
              <div style="margin-top:14px">
                <strong>Recebimentos registrados</strong>
                <div class="table-wrap" style="margin-top:8px">
                  <table class="data-table">
                    <thead><tr><th>Data</th><th>Valor</th><th>Forma</th><th>Conta</th></tr></thead>
                    <tbody>
                      ${r.pagamentos.map(pagamento => `
                        <tr>
                          <td>${fmtDate(pagamento.data_pagamento)}</td>
                          <td>${money(pagamento.valor)}</td>
                          <td>${escapeHtml(formatarFormaPagamento(pagamento.forma_pagamento))}</td>
                          <td>${escapeHtml(pagamento.conta_recebimento || '—')}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
              ` : ''}
              <div class="actions" style="margin-top:14px">
                <button class="btn btn-primary" type="button" data-register-payment="${r.id}">Registrar recebimento</button>
              </div>
            </div>
          </div>
          ` : ''}

          ${r.status === 'CONCLUÍDO' && r.ultimoPagamento ? `
          <div class="card financial-action-card" style="margin-top:16px">
            <div class="card-head">
              <div>
                <h2>Recebimento registrado</h2>
                <p class="muted" style="margin-top:4px">Dados do último recebimento vinculado à solicitação.</p>
              </div>
              <span class="status concluido">Concluído</span>
            </div>
            <div class="card-body">
              <div class="financial-summary compact">
                <div><small>Total recebido</small><strong>${money(r.recebido)}</strong></div>
                <div><small>Último recebimento</small><strong>${money(r.ultimoPagamento.valor)}</strong></div>
                <div><small>Data</small><strong>${fmtDate(r.ultimoPagamento.data_pagamento)}</strong></div>
                <div><small>Forma</small><strong>${escapeHtml(formatarFormaPagamento(r.ultimoPagamento.forma_pagamento))}</strong></div>
                <div><small>Conta</small><strong>${escapeHtml(r.ultimoPagamento.conta_recebimento || '—')}</strong></div>
                <div><small>Recibo</small><strong>${r.ultimoPagamento.recibo_emitido ? escapeHtml(r.ultimoPagamento.recibo_numero || 'Emitido') : 'Não emitido'}</strong></div>
              </div>
              ${Array.isArray(r.pagamentos) && r.pagamentos.length > 1 ? `
              <div style="margin-top:14px">
                <strong>Histórico de recebimentos</strong>
                <div class="table-wrap" style="margin-top:8px">
                  <table class="data-table">
                    <thead><tr><th>Data</th><th>Valor</th><th>Forma</th><th>Conta</th></tr></thead>
                    <tbody>
                      ${r.pagamentos.map(pagamento => `
                        <tr>
                          <td>${fmtDate(pagamento.data_pagamento)}</td>
                          <td>${money(pagamento.valor)}</td>
                          <td>${escapeHtml(formatarFormaPagamento(pagamento.forma_pagamento))}</td>
                          <td>${escapeHtml(pagamento.conta_recebimento || '—')}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
              ` : ''}
              ${r.ultimoPagamento.recibo_drive_url ? `<div style="margin-top:12px"><a class="btn" href="${escapeHtml(r.ultimoPagamento.recibo_drive_url)}" target="_blank" rel="noopener noreferrer">Abrir recibo no Drive</a></div>` : ''}
            </div>
          </div>
          ` : ''}

          <div
            class="card"
            style="margin-top:16px"
          >

            <div class="card-head">

              <h2>
                Documentos e Google Drive
              </h2>

            </div>

            <div class="card-body">

              <div class="notice">
                Os documentos são recebidos pelo Google Forms e organizados automaticamente pelo Apps Script. A pasta da solicitação pode ser vinculada aqui para acesso direto.
              </div>

              <div class="actions" style="margin-top:14px">
                <button class="btn btn-primary" data-drive-form>📤 Enviar pelo Forms</button>
                <button class="btn" data-drive-link>🔗 Vincular pasta</button>
                <button class="btn" data-drive>📁 Abrir pasta no Drive</button>
              </div>

              <div class="mini-stats" style="margin-top:14px">
                <div class="mini-stat">
                  <strong>FORM</strong>
                  <small>Recebimento de PDFs, imagens e outros documentos permitidos.</small>
                </div>
                <div class="mini-stat">
                  <strong>MANUAL</strong>
                  <small>Vinculação de arquivos ou pastas já existentes no Drive.</small>
                </div>
                <div class="mini-stat">
                  <strong>SUPABASE</strong>
                  <small>Registro da referência, categoria, origem e histórico.</small>
                </div>
              </div>

            </div>

          </div>

          <div
            class="card"
            style="margin-top:16px"
          >

            <div class="card-head">
              <h2>Histórico</h2>
            </div>

            <div class="card-body">

              <div class="timeline">

                ${
                  (
                    r.historico ||
                    []
                  )
                    .map(
                      e => `
                        <div class="event">

                          <strong>
                            ${e[1]}
                          </strong>

                          <small>
                            ${e[0]}
                          </small>
                          ${e[2] ? `<div class="muted" style="margin-top:4px;font-size:12px">${escapeHtml(e[2])}${e[3] ? ` · ${escapeHtml(e[3])}` : ''}</div>` : ''}

                        </div>
                      `
                    )
                    .join('')
                }

              </div>

            </div>

          </div>

        </div>

      </aside>

    </div>
  `;

  $('#drawerBackdrop')
    .addEventListener(
      'click',
      async e => {

        if (
          e.target.id ===
            'drawerBackdrop' ||
          e.target.matches(
            '[data-drawer-close]'
          )
        ) {
          closeDrawer();
        }

        const deliveryButton = e.target.closest('[data-register-delivery]');
        if (deliveryButton) {
          deliveryButton.disabled = true;
          const ok = await registrarEntregaAguardandoPagamento(deliveryButton.dataset.registerDelivery);
          if (!ok) deliveryButton.disabled = false;
          else $('#drawerRoot').innerHTML = '';
          return;
        }

        const paymentButton = e.target.closest('[data-register-payment]');
        if (paymentButton) {
          abrirModalConclusaoFinanceira(db.requests.find(x => x.id === paymentButton.dataset.registerPayment));
          return;
        }

        const reviewApprove = e.target.closest('[data-review-approve]');
        if (reviewApprove) {
          reviewApprove.disabled = true;
          const ok = await processarRevisaoAdministrativa(reviewApprove.dataset.reviewApprove, 'aprovar');
          if (!ok) reviewApprove.disabled = false;
          else $('#drawerRoot').innerHTML = '';
          return;
        }

        const reviewReturn = e.target.closest('[data-review-return]');
        if (reviewReturn) {
          const box = $('#reviewReturnBox');
          if (box) {
            box.style.display = 'block';
            const textarea = $('#reviewReturnReason');
            if (textarea) textarea.focus();
          }
          return;
        }

        const reviewCancel = e.target.closest('[data-review-cancel-return]');
        if (reviewCancel) {
          const box = $('#reviewReturnBox');
          if (box) box.style.display = 'none';
          return;
        }

        const reviewConfirm = e.target.closest('[data-review-confirm-return]');
        if (reviewConfirm) {
          const textarea = $('#reviewReturnReason');
          const motivo = textarea?.value || '';
          if (!motivo.trim()) {
            showToast('Informe o motivo da devolução.');
            textarea?.focus();
            return;
          }
          reviewConfirm.disabled = true;
          const ok = await processarRevisaoAdministrativa(reviewConfirm.dataset.reviewConfirmReturn, 'devolver', motivo);
          if (!ok) reviewConfirm.disabled = false;
          else $('#drawerRoot').innerHTML = '';
          return;
        }

        if (e.target.matches('[data-drive]')) {
          if (r.drive) {
            window.open(r.drive, '_blank', 'noopener,noreferrer');
          } else {
            showToast('A pasta desta solicitação ainda não foi vinculada ao Google Drive.');
          }
        }

        if (e.target.matches('[data-drive-form]')) {
          abrirFormularioForms(r);
        }

        if (e.target.matches('[data-drive-link]')) {
          abrirVincularPastaModal(r);
        }
      }
    );
}


function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function optionSelected(value, current) {
  return String(value || '') === String(current || '') ? ' selected' : '';
}


function entidadeNome(tipo, id) {
  if (tipo === 'advogado') return db.advogados.find(x => x.id === id)?.nome || 'Advogado';
  if (tipo === 'cliente') return db.clientes.find(x => x.id === id)?.nome || 'Cliente';
  if (tipo === 'processo') return db.processos.find(x => x.id === id)?.numero_processo || 'Processo';
  return 'Cadastro';
}

function quantidadeVinculos(tipo, id) {
  return db.requests.filter(r =>
    tipo === 'advogado' ? r.advogadoId === id :
    tipo === 'cliente' ? r.clienteId === id :
    tipo === 'processo' ? r.processoId === id : false
  ).length;
}

function abrirEdicaoCadastro(tipo, id, requestId = null) {
  if (!isAdministrador()) return;

  let registro = null;
  if (tipo === 'advogado') registro = db.advogados.find(x => x.id === id);
  if (tipo === 'cliente') registro = db.clientes.find(x => x.id === id);
  if (tipo === 'processo') registro = db.processos.find(x => x.id === id);
  if (!registro) {
    showToast('Cadastro não encontrado.');
    return;
  }

  const vinculos = quantidadeVinculos(tipo, id);
  const titulo = tipo === 'advogado' ? 'Editar advogado' : tipo === 'cliente' ? 'Editar cliente' : 'Editar processo';
  const aviso = vinculos > 1
    ? `Este cadastro está vinculado a ${vinculos} solicitações. A alteração será refletida em todas elas.`
    : 'A alteração será refletida nas solicitações que utilizam este cadastro.';

  let fields = '';
  if (tipo === 'advogado') {
    fields = `
      <div class="form-grid">
        <div class="field"><label>Nome *</label><input class="input" name="nome" required value="${escapeHtml(registro.nome || '')}"></div>
        <div class="field"><label>OAB</label><input class="input" name="oab" value="${escapeHtml(registro.oab || '')}"></div>
        <div class="field"><label>UF da OAB</label><input class="input" name="uf_oab" maxlength="2" value="${escapeHtml(registro.uf_oab || '')}"></div>
        <div class="field"><label>Escritório</label><input class="input" name="escritorio" value="${escapeHtml(registro.escritorio || '')}"></div>
        <div class="field"><label>Telefone</label><input class="input" name="telefone" value="${escapeHtml(registro.telefone || '')}"></div>
        <div class="field"><label>WhatsApp</label><input class="input" name="whatsapp" value="${escapeHtml(registro.whatsapp || '')}"></div>
        <div class="field"><label>E-mail</label><input class="input" type="email" name="email" value="${escapeHtml(registro.email || '')}"></div>
        <div class="field"><label>Origem</label><select class="input" name="origem"><option value="">Selecione</option>${['Instagram','Site','WhatsApp','Indicação','Cliente antigo','LinkedIn','Outro'].map(v => `<option value="${v}"${registro.origem === v ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field full"><label>Observações</label><textarea class="input" name="observacoes" rows="4">${escapeHtml(registro.observacoes || '')}</textarea></div>
      </div>`;
  } else if (tipo === 'cliente') {
    fields = `
      <div class="form-grid">
        <div class="field"><label>Nome *</label><input class="input" name="nome" required value="${escapeHtml(registro.nome || '')}"></div>
        <div class="field"><label>CPF</label><input class="input" name="cpf" value="${escapeHtml(registro.cpf || '')}"></div>
        <div class="field"><label>E-mail</label><input class="input" type="email" name="email" value="${escapeHtml(registro.email || '')}"></div>
        <div class="field"><label>Telefone</label><input class="input" name="telefone" value="${escapeHtml(registro.telefone || '')}"></div>
        <div class="field full"><label>Observações</label><textarea class="input" name="observacoes" rows="4">${escapeHtml(registro.observacoes || '')}</textarea></div>
      </div>`;
  } else {
    const clienteProcessoOptions = db.clientes.map(c => `<option value="${c.id}"${optionSelected(c.id, registro.cliente_id)}>${escapeHtml(c.nome)}${c.cpf ? ` — ${escapeHtml(c.cpf)}` : ''}</option>`).join('');
    fields = `
      <div class="form-grid">
        <div class="field full"><label>Número do processo *</label><input class="input" name="numero_processo" required value="${escapeHtml(registro.numero_processo || '')}"></div>
        <div class="field"><label>Cliente do processo</label><select class="input" name="cliente_id"><option value="">Sem cliente</option>${clienteProcessoOptions}</select></div>
        <div class="field"><label>Tribunal</label><input class="input" name="tribunal" value="${escapeHtml(registro.tribunal || '')}"></div>
        <div class="field"><label>Vara</label><input class="input" name="vara" value="${escapeHtml(registro.vara || '')}"></div>
        <div class="field"><label>Comarca</label><input class="input" name="comarca" value="${escapeHtml(registro.comarca || '')}"></div>
        <div class="field full"><label>Observações</label><textarea class="input" name="observacoes" rows="4">${escapeHtml(registro.observacoes || '')}</textarea></div>
      </div>`;
  }

  $('#modalRoot').innerHTML = `
    <div class="modal-backdrop" id="entityEditModal">
      <div class="modal" style="max-width:900px">
        <div class="modal-head">
          <div><h2>${titulo}</h2><small class="muted">${escapeHtml(entidadeNome(tipo, id))}</small></div>
          <button class="close" data-close>×</button>
        </div>
        <form id="entityEditForm">
          <div class="modal-body">
            <div class="notice" style="margin-bottom:16px">${aviso}</div>
            ${fields}
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar cadastro</button>
          </div>
        </form>
      </div>
    </div>`;

  $('#entityEditModal').addEventListener('click', e => {
    if (e.target.matches('[data-close]')) closeModal();
  });
  $('#entityEditForm').addEventListener('submit', e => salvarEdicaoCadastro(e, tipo, id, requestId));
}


function abrirNovoProcessoParaSolicitacao(requestId, clienteId = null) {
  if (!isAdministrador()) return;

  const clienteOptions = db.clientes.map(c =>
    `<option value="${c.id}"${optionSelected(c.id, clienteId)}>${escapeHtml(c.nome)}${c.cpf ? ` — ${escapeHtml(c.cpf)}` : ''}</option>`
  ).join('');

  $('#modalRoot').innerHTML = `
    <div class="modal-backdrop" id="newProcessModal">
      <div class="modal" style="max-width:760px">
        <div class="modal-head">
          <div><h2>Cadastrar processo</h2><small class="muted">Será vinculado à solicitação selecionada.</small></div>
          <button class="close" data-close>×</button>
        </div>
        <form id="newProcessForm">
          <div class="modal-body">
            <div class="notice" style="margin-bottom:16px">
              Informe o número correto do processo. Depois de salvar, ele ficará vinculado à solicitação.
            </div>
            <div class="form-grid">
              <div class="field full"><label>Número do processo *</label><input class="input" name="numero_processo" required placeholder="0000000-00.0000.0.00.0000"></div>
              <div class="field"><label>Cliente</label><select class="input" name="cliente_id"><option value="">Sem cliente</option>${clienteOptions}</select></div>
              <div class="field"><label>Tribunal</label><input class="input" name="tribunal"></div>
              <div class="field"><label>Vara</label><input class="input" name="vara"></div>
              <div class="field"><label>Comarca</label><input class="input" name="comarca"></div>
              <div class="field full"><label>Observações</label><textarea class="input" name="observacoes" rows="4"></textarea></div>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Cadastrar e vincular</button>
          </div>
        </form>
      </div>
    </div>`;

  $('#newProcessModal').addEventListener('click', e => {
    if (e.target.matches('[data-close]')) closeModal();
  });
  $('#newProcessForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const numero = String(f.get('numero_processo') || '').trim();
    const button = e.target.querySelector('button[type="submit"]');
    if (!numero) {
      showToast('Informe o número do processo.');
      return;
    }
    button.disabled = true;
    button.textContent = 'Salvando...';

    const existing = await supabaseClient
      .from('processos')
      .select('id, numero_processo')
      .eq('numero_processo', numero)
      .limit(1)
      .maybeSingle();

    if (existing.error) {
      console.error(existing.error);
      showToast('Não foi possível verificar o processo.');
      button.disabled = false;
      button.textContent = 'Cadastrar e vincular';
      return;
    }

    let processo = existing.data;
    if (processo) {
      const confirma = window.confirm(`O processo ${numero} já existe. Deseja vinculá-lo a esta solicitação?`);
      if (!confirma) {
        button.disabled = false;
        button.textContent = 'Cadastrar e vincular';
        return;
      }
    } else {
      const criado = await supabaseClient.from('processos').insert({
        numero_processo: numero,
        cliente_id: f.get('cliente_id') || null,
        tribunal: String(f.get('tribunal') || '').trim() || null,
        vara: String(f.get('vara') || '').trim() || null,
        comarca: String(f.get('comarca') || '').trim() || null,
        observacoes: String(f.get('observacoes') || '').trim() || null
      }).select('id, numero_processo').single();
      if (criado.error) {
        console.error(criado.error);
        showToast('Não foi possível cadastrar o processo.');
        button.disabled = false;
        button.textContent = 'Cadastrar e vincular';
        return;
      }
      processo = criado.data;
    }

    const update = await supabaseClient.from('solicitacoes').update({
      processo_id: processo.id,
      updated_at: new Date().toISOString()
    }).eq('id', requestId);

    if (update.error) {
      console.error(update.error);
      showToast('O processo foi salvo, mas não foi possível vinculá-lo à solicitação.');
      button.disabled = false;
      button.textContent = 'Cadastrar e vincular';
      return;
    }

    await supabaseClient.from('historico_solicitacao').insert({
      solicitacao_id: requestId,
      usuario_id: currentUser?.id || null,
      tipo_evento: 'EDICAO',
      descricao: `Processo ${processo.numero_processo} vinculado à solicitação pelo administrador.`
    });

    closeModal();
    await carregarSolicitacoes();
    showToast('Processo vinculado à solicitação.');
    openDetail(requestId);
  });
}

async function salvarEdicaoCadastro(e, tipo, id, requestId = null) {
  e.preventDefault();
  const f = new FormData(e.target);
  const button = e.target.querySelector('button[type="submit"]');
  let changes;

  if (tipo === 'advogado') {
    changes = {
      nome: String(f.get('nome') || '').trim(),
      oab: String(f.get('oab') || '').trim() || null,
      uf_oab: String(f.get('uf_oab') || '').trim().toUpperCase() || null,
      escritorio: String(f.get('escritorio') || '').trim() || null,
      telefone: String(f.get('telefone') || '').trim() || null,
      whatsapp: String(f.get('whatsapp') || '').trim() || null,
      email: String(f.get('email') || '').trim() || null,
      origem: String(f.get('origem') || '').trim() || null,
      observacoes: String(f.get('observacoes') || '').trim() || null,
      updated_at: new Date().toISOString()
    };
  } else if (tipo === 'cliente') {
    changes = {
      nome: String(f.get('nome') || '').trim(),
      cpf: String(f.get('cpf') || '').trim() || null,
      email: String(f.get('email') || '').trim() || null,
      telefone: String(f.get('telefone') || '').trim() || null,
      observacoes: String(f.get('observacoes') || '').trim() || null,
      updated_at: new Date().toISOString()
    };
  } else {
    changes = {
      numero_processo: String(f.get('numero_processo') || '').trim(),
      cliente_id: f.get('cliente_id') || null,
      tribunal: String(f.get('tribunal') || '').trim() || null,
      vara: String(f.get('vara') || '').trim() || null,
      comarca: String(f.get('comarca') || '').trim() || null,
      observacoes: String(f.get('observacoes') || '').trim() || null,
      updated_at: new Date().toISOString()
    };
  }

  if (!changes.nome && (tipo === 'advogado' || tipo === 'cliente')) {
    showToast('Informe o nome.');
    return;
  }
  if (!changes.numero_processo && tipo === 'processo') {
    showToast('Informe o número do processo.');
    return;
  }

  button.disabled = true;
  button.textContent = 'Salvando...';

  const tabela = tipo === 'advogado' ? 'advogados' : tipo === 'cliente' ? 'clientes' : 'processos';
  const { error } = await supabaseClient.from(tabela).update(changes).eq('id', id);
  if (error) {
    console.error(`Erro ao editar ${tipo}:`, error);
    showToast(error.code === '23505' ? 'Já existe um cadastro com esse identificador.' : 'Não foi possível salvar o cadastro.');
    button.disabled = false;
    button.textContent = 'Salvar cadastro';
    return;
  }

  await carregarSolicitacoes();
  closeModal();
  showToast('Cadastro atualizado. As solicitações relacionadas foram atualizadas.');

  if (requestId) {
    const atual = db.requests.find(x => x.id === requestId);
    if (atual) openDetail(requestId);
  } else {
    render();
  }
}

function editRequestModal(r) {
  const areaOptions = db.areas.filter(a => a.ativo !== false).map(a =>
    `<option value="${a.id}"${optionSelected(a.id, r.areaId)}>${a.nome}</option>`
  ).join('');
  const tiposEdicao = r.areaId ? obterTiposParaArea(r.areaId) : db.tipos.filter(t => t.ativo !== false);
  const tipoOptions = tiposEdicao.map(t => {
    const value = t.id === '__OUTRO__' ? '' : t.id;
    const selected = optionSelected(t.id, r.tipoId) || (t.nome === 'Outro' && r.tipoServicoNome === 'Outro');
    return `<option value="${value}"${selected ? ' selected' : ''}>${escapeHtml(t.nome)}</option>`;
  }).join('');
  const advogadoOptions = db.advogados.filter(a => a.ativo !== false).map(a =>
    `<option value="${a.id}"${optionSelected(a.id, r.advogadoId)}>${a.nome}${a.oab ? ` — OAB ${a.oab}${a.uf_oab ? '/' + a.uf_oab : ''}` : ''}</option>`
  ).join('');
  const clienteOptions = db.clientes.map(c =>
    `<option value="${c.id}"${optionSelected(c.id, r.clienteId)}>${c.nome}${c.cpf ? ` — ${c.cpf}` : ''}</option>`
  ).join('');
  const processoOptions = db.processos.map(p =>
    `<option value="${p.id}"${optionSelected(p.id, r.processoId)}>${p.numero_processo}</option>`
  ).join('');
  const calcOptions = calculistasDisponiveis().map(c =>
    `<option value="${c.id}"${optionSelected(c.id, r.calculistaId)}>${c.nome}</option>`
  ).join('');

  $('#modalRoot').innerHTML = `
    <div class="modal-backdrop" id="editRequestModal">
      <div class="modal" style="max-width:900px">
        <div class="modal-head">
          <div>
            <h2>Editar solicitação</h2>
            <small class="muted">${r.codigo}</small>
          </div>
          <button class="close" data-close>×</button>
        </div>
        <form id="editRequestForm">
          <div class="modal-body">
            <div class="notice" style="margin-bottom:16px">
              As alterações são salvas na mesma solicitação e ficarão disponíveis imediatamente para o calculista. A alteração também será registrada no histórico.
            </div>
            ${r.status === 'CONCLUÍDO' ? `
              <div class="notice" style="margin-bottom:16px">
                Esta solicitação já foi encerrada financeiramente. O status <strong>Concluído</strong> não pode ser alterado por este formulário e o valor cobrado fica bloqueado. Novos recebimentos devem ser tratados pelo fluxo financeiro.
              </div>` : ''}
            <div class="form-grid">
              <div class="field">
                <label>Advogado</label>
                <div class="select-with-action">
                  <select class="input" name="advogado_id">${advogadoOptions}</select>
                  ${r.advogadoId ? `<button type="button" class="entity-edit-link" data-edit-entity="advogado" data-entity-id="${r.advogadoId}" data-request-id="${r.id}" title="Editar cadastro do advogado">✎ Editar cadastro</button>` : ''}
                </div>
              </div>
              <div class="field">
                <label>Cliente</label>
                <div class="select-with-action">
                  <select class="input" name="cliente_id">${clienteOptions}</select>
                  ${r.clienteId ? `<button type="button" class="entity-edit-link" data-edit-entity="cliente" data-entity-id="${r.clienteId}" data-request-id="${r.id}" title="Editar cadastro do cliente">✎ Editar cadastro</button>` : ''}
                </div>
              </div>
              <div class="field">
                <label>Processo</label>
                <div class="select-with-action">
                  <select class="input" name="processo_id"><option value="">Sem processo</option>${processoOptions}</select>
                  ${r.processoId ? `<button type="button" class="entity-edit-link" data-edit-entity="processo" data-entity-id="${r.processoId}" data-request-id="${r.id}" title="Editar cadastro do processo">✎ Editar cadastro</button>` : `<button type="button" class="entity-edit-link" data-create-process-for-request="${r.id}" title="Cadastrar processo para esta solicitação">＋ Cadastrar processo</button>`}
                </div>
              </div>
              <div class="field"><label>Área</label><select class="input" name="area_id" id="editArea">${areaOptions}</select></div>
              <div class="field"><label>Tipo de serviço</label><select class="input" name="tipo_servico_id" id="editTipo">${tipoOptions}</select></div>
              <div class="field full" id="editTipoOutroWrap" style="display:${r.tipoServicoNome === 'Outro' ? '' : 'none'}">
                <label for="editTipoOutro">Especifique o tipo de serviço *</label>
                <input class="input" id="editTipoOutro" name="tipo_servico_outro" maxlength="100" value="${escapeHtml(r.tipoServicoOutro || '')}" placeholder="Descreva o tipo de serviço">
                <small class="muted" id="editTipoOutroCounter" style="display:block;margin-top:5px">${String(r.tipoServicoOutro || '').length}/100</small>
              </div>
              <div class="field"><label>Calculista</label><select class="input" name="calculista_id"><option value="">Não atribuído</option>${calcOptions}</select></div>
              <div class="field"><label>Status</label><select class="input" name="status">
                ${Object.entries(statusLabel).filter(([v]) => v !== 'CONCLUÍDO').map(([v,l]) => `<option value="${v}"${optionSelected(v,r.status)}>${l}</option>`).join('')}
                ${r.status === 'CONCLUÍDO' ? '<option value="CONCLUÍDO" selected disabled>Concluído — encerramento financeiro</option>' : ''}
              </select></div>
              <div class="field"><label>Prioridade</label><select class="input" name="prioridade">
                <option value="normal"${r.prioridade === 'Normal' ? ' selected' : ''}>Normal</option>
                <option value="alta"${r.prioridade === 'Alta' ? ' selected' : ''}>Alta</option>
                <option value="urgente"${r.prioridade === 'Urgente' ? ' selected' : ''}>Urgente</option>
              </select></div>
              <div class="field"><label>Prazo</label><input class="input" type="date" name="prazo" value="${r.prazo || ''}"></div>
              <div class="field">
                <label>Valor cobrado</label>
                <div style="display:flex;gap:8px;align-items:center">
                  <input class="input" id="editValorCobrado" name="valor_cobrado" inputmode="decimal" value="${Number(r.valor || 0).toFixed(2).replace('.', ',')}"${['CONCLUIDO','CONCLUÍDO'].includes(r.status) ? ' readonly aria-readonly="true" tabindex="-1"' : ''} style="flex:1">
                  ${['CONCLUIDO','CONCLUÍDO'].includes(r.status) && isAdministrador() ? `
                    <button
                      type="button"
                      class="icon-btn financial-lock-btn"
                      data-open-financial-adjustment="true"
                      title="Ajuste financeiro excepcional"
                      aria-label="Abrir ajuste financeiro excepcional"
                    >🔒</button>
                  ` : ''}
                </div>
                ${['CONCLUIDO','CONCLUÍDO'].includes(r.status) ? `<small class="muted" style="display:block;margin-top:5px">${isAdministrador() ? 'Bloqueado após o encerramento financeiro. Use o cadeado para ajuste excepcional.' : 'Bloqueado após o encerramento financeiro.'}</small>` : ''}
              </div>
              <div class="field"><label>Origem</label><select class="input" name="origem">
                ${['Indicação','Instagram','Site','WhatsApp','Cliente antigo','LinkedIn','Outro'].map(v => `<option${r.origem === v ? ' selected' : ''}>${v}</option>`).join('')}
              </select></div>
              <div class="field"><label>Tipo de entrega</label><select class="input" name="tipo_entrega">
                ${[['calculo','Cálculo'],['calculo_parecer','Cálculo + parecer'],['parecer','Apenas parecer'],['conferencia','Conferência'],['outro','Outro']].map(([v,l]) => `<option value="${v}"${String(r.tipoEntrega || '') === v ? ' selected' : ''}>${l}</option>`).join('')}
              </select></div>
              <div class="field full"><label>Descrição / observações</label><textarea class="input" name="descricao" rows="5">${r.descricao || ''}</textarea></div>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" data-close>Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar alterações</button>
          </div>
        </form>
      </div>
    </div>`;

  const area = $('#editArea');
  const tipo = $('#editTipo');
  const outroWrap = $('#editTipoOutroWrap');
  const outroInput = $('#editTipoOutro');
  const outroCounter = $('#editTipoOutroCounter');

  const atualizarTipoOutroEdicao = () => {
    const outroSelecionado = tipo.selectedOptions?.[0]?.textContent.trim() === 'Outro';
    if (outroWrap) outroWrap.style.display = outroSelecionado ? '' : 'none';
    if (outroInput) outroInput.required = outroSelecionado;
    if (outroCounter && outroInput) outroCounter.textContent = `${outroInput.value.length}/100`;
  };

  area.addEventListener('change', () => {
    const tiposArea = obterTiposParaArea(area.value);
    tipo.innerHTML = '<option value="">Selecione</option>' + tiposArea.map(t => {
      const value = t.id === '__OUTRO__' ? '' : t.id;
      return `<option value="${value}">${escapeHtml(t.nome)}</option>`;
    }).join('');
    atualizarTipoOutroEdicao();
  });

  tipo.addEventListener('change', atualizarTipoOutroEdicao);
  if (outroInput && outroCounter) {
    outroInput.addEventListener('input', () => {
      if (outroInput.value.length > 100) outroInput.value = outroInput.value.slice(0, 100);
      outroCounter.textContent = `${outroInput.value.length}/100`;
    });
  }
  atualizarTipoOutroEdicao();
  $('#editRequestModal').addEventListener('click', e => {
    if (e.target.matches('[data-close]')) closeModal();
  });
// Ações dos cadastros relacionados: listeners diretos no modal.
  // Mantemos também a delegação global como fallback, mas o listener direto
  // garante que o clique funcione mesmo após a reconstrução do modal.
  $('#editRequestModal').querySelectorAll('[data-edit-entity]').forEach(button => {
    button.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!isAdministrador()) return;
      abrirEdicaoCadastro(
        button.dataset.editEntity,
        button.dataset.entityId,
        button.dataset.requestId || r.id
      );
    });
  });

  $('#editRequestModal').querySelectorAll('[data-create-process-for-request]').forEach(button => {
    button.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!isAdministrador()) return;
      abrirNovoProcessoParaSolicitacao(
        button.dataset.createProcessForRequest,
        button.dataset.clienteId || r.clienteId || null
      );
    });
  });

  $('#editRequestForm').addEventListener('submit', e => updateRequest(e, r));
}

async function updateRequest(e, r) {
  e.preventDefault();
  const f = new FormData(e.target);
  const button = e.target.querySelector('button[type="submit"]');
  const valor = parseMoney(f.get('valor_cobrado'));
  const tipoOutro = String(f.get('tipo_servico_outro') || '').trim();
  const tipoSelect = e.target.querySelector('[name="tipo_servico_id"]');
  const tipoSelecionadoNome = tipoSelect?.selectedOptions?.[0]?.textContent.trim() || '';
  const changes = {
    advogado_id: f.get('advogado_id') || null,
    cliente_id: f.get('cliente_id') || null,
    processo_id: f.get('processo_id') || null,
    area_id: f.get('area_id') || null,
    tipo_servico_id: f.get('tipo_servico_id') || null,
    tipo_servico_outro: tipoSelecionadoNome === 'Outro' ? (tipoOutro || null) : null,
    calculista_id: f.get('calculista_id') || null,
    status: normalizarChaveStatus(f.get('status') || 'NOVO'),
    prioridade: f.get('prioridade') || 'normal',
    prazo: f.get('prazo') || null,
    valor_cobrado: valor,
    valor_final: valor,
    origem: f.get('origem') || null,
    tipo_entrega: f.get('tipo_entrega') || 'calculo',
    descricao: String(f.get('descricao') || '').trim(),
    cliente_antigo: f.get('origem') === 'Cliente antigo',
    updated_at: new Date().toISOString()
  };
  if (r.status === 'CONCLUÍDO') {
    changes.status = 'CONCLUIDO';
    changes.valor_cobrado = Number(r.valor || 0);
    changes.valor_final = Number(r.valor || 0);
  }
  if (changes.status === 'CONCLUIDO' && r.status !== 'CONCLUÍDO') {
    showToast('Use Registrar recebimento e concluir para encerrar financeiramente a solicitação.');
    return;
  }
  if (tipoSelecionadoNome === 'Outro' && !tipoOutro) {
    showToast('Especifique o tipo de serviço quando selecionar Outro.');
    return;
  }
  if (tipoOutro.length > 100) {
    showToast('A especificação do tipo de serviço deve ter no máximo 100 caracteres.');
    return;
  }
  button.disabled = true;
  button.textContent = 'Salvando...';
  const { error } = await supabaseClient.from('solicitacoes').update(changes).eq('id', r.id);
  if (error) {
    console.error('Erro ao editar solicitação:', error);
    showToast('Não foi possível salvar as alterações.');
    button.disabled = false;
    button.textContent = 'Salvar alterações';
    return;
  }
  const tipoAnterior = r.tipoServicoNome === 'Outro'
    ? `Outro${r.tipoServicoOutro ? ` — ${r.tipoServicoOutro}` : ''}`
    : (r.tipoServicoNome || r.tipo || 'Não informado');
  const tipoAtual = tipoSelecionadoNome === 'Outro'
    ? `Outro${tipoOutro ? ` — ${tipoOutro}` : ''}`
    : (tipoSelecionadoNome || 'Não informado');
  const detalheTipo = tipoAnterior !== tipoAtual
    ? ` Tipo de serviço alterado de "${tipoAnterior}" para "${tipoAtual}".`
    : '';
  const descricaoHistorico = `Solicitação editada pelo administrador.${detalheTipo}`;
  await supabaseClient.from('historico_solicitacao').insert({ solicitacao_id: r.id, usuario_id: currentUser?.id || null, tipo_evento: 'EDICAO', descricao: descricaoHistorico });
  closeModal();
  await carregarSolicitacoes();
  showToast('Solicitação atualizada. O calculista verá os dados atualizados.');
  openDetail(r.id);
  if (state.view === 'solicitacoes') render();
}

async function excluirSolicitacao(r) {
  const confirmacao = window.confirm(`Excluir definitivamente a solicitação ${r.codigo}?\n\nOs registros relacionados, como histórico, pagamentos, retrabalhos e arquivos vinculados ao registro serão removidos conforme as regras do banco.\n\nEsta ação não pode ser desfeita.`);
  if (!confirmacao) return;
  const segunda = window.confirm(`Confirma novamente a exclusão de ${r.codigo}?`);
  if (!segunda) return;
  const { error } = await supabaseClient.from('solicitacoes').delete().eq('id', r.id);
  if (error) {
    console.error('Erro ao excluir solicitação:', error);
    showToast('Não foi possível excluir a solicitação.');
    return;
  }
  closeDrawer();
  state.selected = null;
  await carregarSolicitacoes();
  render();
  showToast(`${r.codigo} excluída.`);
}

function closeDrawer() {
  $('#drawerRoot').innerHTML = '';
}

function bindView() {
  // A navegação e os controles dinâmicos usam delegação de eventos.
  // Isso evita registrar novos listeners a cada renderização.
}

function toggleProfileMenu() {
  const existing = document.getElementById('profileMenu');
  if (existing) {
    existing.remove();
    return;
  }

  const btn = document.getElementById('profileBtn');
  if (!btn) return;
  const funcoes = funcoesUsuario();
  const email = currentProfile?.email || currentUser?.email || '';
  const menu = document.createElement('div');
  menu.id = 'profileMenu';
  menu.className = 'profile-menu';
  menu.innerHTML = `
    <div class="profile-menu-head">
      <strong>${currentProfile?.nome || 'Usuário'}</strong>
      <small>${email}</small>
      <span>${funcoes.join(' · ') || 'Usuário'}</span>
    </div>
    <div class="profile-menu-divider"></div>
    <button type="button" data-profile-action="manual">Manual</button>
    <button type="button" data-profile-action="logout">Sair</button>
  `;
  document.body.appendChild(menu);
  const rect = btn.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 8}px`;
  menu.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
}

async function sairDoSistema() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    showToast('Não foi possível sair do sistema.');
    return;
  }
  const menu = document.getElementById('profileMenu');
  if (menu) menu.remove();
  currentUser = null;
  currentProfile = null;
  mostrarLogin();
}

function prepararNavegacaoMobile() {
  const collapseButton = $('#sidebarCollapseBtn');
  const menuButton = $('#menuBtn');

  if (collapseButton && !collapseButton.dataset.eventsReady) {
    collapseButton.dataset.eventsReady = 'true';
    collapseButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      alternarSidebarMobile();
    });
  }

  if (menuButton && !menuButton.dataset.eventsReady) {
    menuButton.dataset.eventsReady = 'true';
    menuButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      definirSidebarMobileRecolhida(false);
    });
  }
}

function initEventDelegation() {
  const profileBtn = $('#profileBtn');
  if (profileBtn && !profileBtn.dataset.eventsReady) {
    profileBtn.dataset.eventsReady = 'true';
    profileBtn.addEventListener('click', event => {
      event.stopPropagation();
      toggleProfileMenu();
    });
  }

  if (!document.documentElement.dataset.profileMenuReady) {
    document.documentElement.dataset.profileMenuReady = 'true';
    document.addEventListener('click', event => {
      const action = event.target.closest('[data-profile-action]');
      if (action) {
        const menu = document.getElementById('profileMenu');
        if (action.dataset.profileAction === 'manual') {
          if (menu) menu.remove();
          nav('manual');
        } else if (action.dataset.profileAction === 'logout') {
          sairDoSistema();
        }
        return;
      }
      const menu = document.getElementById('profileMenu');
      if (menu && !event.target.closest('#profileBtn') && !menu.contains(event.target)) menu.remove();
    });
    document.addEventListener('click', event => {
  const target = event.target?.closest?.('.financial-lock-btn[data-open-financial-adjustment]');
  if (!target) return;

  event.preventDefault();
  event.stopPropagation();

  if (!isAdministrador()) {
    showToast('Somente Administradores podem realizar ajustes financeiros.');
    return;
  }

  if (!['solicitacoes', 'financeiro'].includes(state.view) || !state.selected) return;

  const r = db.requests.find(item => item.id === state.selected);
  if (!r || !['CONCLUIDO', 'CONCLUÍDO'].includes(r.status)) {
    showToast('O ajuste financeiro excepcional está disponível somente para solicitações concluídas.');
    return;
  }

  abrirModalAjusteFinanceiro(r);
});

document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        const menu = document.getElementById('profileMenu');
        if (menu) menu.remove();
      }
    });
  }

  const content = $('#content');
  const menu = $('#sidebar');

  if (menu && !menu.dataset.eventsReady) {
    menu.dataset.eventsReady = 'true';
    menu.addEventListener('click', event => {
      const driveButton = event.target.closest('[data-drive-gestao]');
      if (driveButton && menu.contains(driveButton)) {
        event.preventDefault();
        abrirPastaGestao();
        return;
      }

      const button = event.target.closest('.nav-item[data-view]');
      if (!button || !menu.contains(button)) return;
      event.preventDefault();
      nav(button.dataset.view);
    });
  }

  const drawerRoot = $('#drawerRoot');
  if (drawerRoot && !drawerRoot.dataset.eventsReady) {
    drawerRoot.dataset.eventsReady = 'true';
    drawerRoot.addEventListener('click', event => {
      const assignButton = event.target.closest('[data-assign-request]');
      if (assignButton && drawerRoot.contains(assignButton)) {
        if (podeAtribuirSolicitacao()) abrirAtribuicaoSolicitacao(assignButton.dataset.assignRequest);
        return;
      }

      const editButton = event.target.closest('[data-edit-request]');
      if (editButton && drawerRoot.contains(editButton)) {
        const r = db.requests.find(x => x.id === editButton.dataset.editRequest);
        if (r && isAdministrador()) editRequestModal(r);
        return;
      }

      const deleteButton = event.target.closest('[data-delete-request]');
      if (deleteButton && drawerRoot.contains(deleteButton)) {
        const r = db.requests.find(x => x.id === deleteButton.dataset.deleteRequest);
        if (r && isAdministrador()) excluirSolicitacao(r);
        return;
      }
    });
  }

  // Ações de edição/cadastro de entidades são delegadas ao documento.
  // Isso continua funcionando mesmo quando #modalRoot troca seu innerHTML.
  if (!document.documentElement.dataset.entityActionsReady) {
    document.documentElement.dataset.entityActionsReady = 'true';
    document.addEventListener('click', event => {
      const entityButton = event.target.closest('[data-edit-entity]');
      if (entityButton) {
        event.preventDefault();
        event.stopPropagation();
        if (!isAdministrador()) return;
        const entityType = entityButton.dataset.editEntity;
        const entityId = entityButton.dataset.entityId;
        const requestId = entityButton.dataset.requestId || null;
        abrirEdicaoCadastro(entityType, entityId, requestId);
        return;
      }

      const createProcessButton = event.target.closest('[data-create-process-for-request]');
      if (createProcessButton) {
        event.preventDefault();
        event.stopPropagation();
        if (!isAdministrador()) return;
        abrirNovoProcessoParaSolicitacao(
          createProcessButton.dataset.createProcessForRequest,
          createProcessButton.dataset.clienteId || null
        );
      }
    });
  }

  if (!content || content.dataset.eventsReady) return;
  content.dataset.eventsReady = 'true';

  content.addEventListener('click', event => {
    const manualTab = event.target.closest('[data-manual-tab]');
    if (manualTab) {
      state.manualTab = manualTab.dataset.manualTab || 'visao';
      render();
      return;
    }

    const tutorial = event.target.closest('[data-tutorial]');
    if (tutorial) {
      abrirTutorialModal(state.view);
      return;
    }

    const newUserButton = event.target.closest('[data-new-user]');
    if (newUserButton) { event.preventDefault(); if (!isAdministrador()) return; abrirUsuarioModal(); return; }

    const editUserButton = event.target.closest('[data-edit-user]');
    if (editUserButton) { event.preventDefault(); if (!isAdministrador()) return; const usuario = db.usuarios.find(u => u.id === editUserButton.dataset.editUser); if (usuario) abrirUsuarioModal(usuario); return; }

    const deleteUserButton = event.target.closest('[data-delete-user]');
    if (deleteUserButton) {
      event.preventDefault();
      if (!isAdministrador()) return;
      const usuario = db.usuarios.find(u => u.id === deleteUserButton.dataset.deleteUser);
      if (usuario) excluirUsuarioModal(usuario);
      return;
    }

    const linkCalcButton = event.target.closest('[data-link-calculista]');
    if (linkCalcButton) {
      event.preventDefault();
      if (!isAdministrador()) return;
      const calculista = db.calculistas.find(x => x.id === linkCalcButton.dataset.linkCalculista);
      if (calculista) abrirVincularCalculistaUsuarioModal(calculista);
      return;
    }

    const newButton = event.target.closest('[data-new]');
    if (newButton) {
      openNew();
      return;
    }

    const viewLink = event.target.closest('[data-view-link]');
    if (viewLink) {
      nav(viewLink.dataset.viewLink);
      return;
    }

    const calcButton = event.target.closest('[data-open-calculista]');
    if (calcButton) {
      openCalculistaDetail(calcButton.dataset.openCalculista);
      return;
    }

    const copyCodeButton = event.target.closest('[data-copy-code]');
    if (copyCodeButton) {
      event.preventDefault();
      event.stopPropagation();
      copiarCodigo(copyCodeButton.dataset.copyCode || '');
      return;
    }

    const openButton = event.target.closest('[data-open]');
    if (openButton) {
      openDetail(openButton.dataset.open);
      return;
    }

    const editButton = event.target.closest('[data-edit-request]');
    if (editButton) {
      const r = db.requests.find(x => x.id === editButton.dataset.editRequest);
      if (r && isAdministrador()) editRequestModal(r);
      return;
    }

    const deleteButton = event.target.closest('[data-delete-request]');
    if (deleteButton) {
      const r = db.requests.find(x => x.id === deleteButton.dataset.deleteRequest);
      if (r && isAdministrador()) excluirSolicitacao(r);
      return;
    }

    const systemButton = event.target.closest('[data-system]');
    if (systemButton) {
      showToast('Cadastro de sistemas será conectado ao Supabase.');
    }
  });

  content.addEventListener('input', event => {
    const manualSearch = event.target.closest('#manualSearch');
    if (manualSearch) {
      state.manualQuery = manualSearch.value;
      clearTimeout(queryRenderTimer);
      queryRenderTimer = setTimeout(() => render(), 100);
      return;
    }

    const financeQ = event.target.closest('#financeQ');
    if (financeQ) {
      state.financeQuery = financeQ.value;
      clearTimeout(queryRenderTimer);
      queryRenderTimer = setTimeout(() => atualizarFinanceiroFiltrado(), 80);
      return;
    }

    const q = event.target.closest('#q');
    if (q) {
      state.query = q.value;
      clearTimeout(queryRenderTimer);
      queryRenderTimer = setTimeout(() => {
        const rows = solicitacoesFiltradas();
        const list = $('#requestList');
        if (list) list.innerHTML = tableRequests(rows);

        const summary = $('#requestSearchSummary');
        if (summary) {
          summary.textContent = `${rows.length} demanda(s) encontrada(s).`;
        }
      }, 80);
      return;
    }

    const processSearch = event.target.closest('#processSearch');
    if (processSearch) {
      const table = $('#processTable');
      if (table) table.innerHTML = processTable(processSearch.value);
    }
  });

  content.addEventListener('change', event => {
    const financeStatus = event.target.closest('#financeFilterStatus');
    if (financeStatus) {
      state.financeStatus = financeStatus.value;
      atualizarFinanceiroFiltrado();
      return;
    }

    const financeArea = event.target.closest('#financeFilterArea');
    if (financeArea) {
      state.financeArea = financeArea.value;
      atualizarFinanceiroFiltrado();
      return;
    }

    const status = event.target.closest('#filterStatus');
    if (status) {
      state.status = status.value;
      render();
      return;
    }

    const area = event.target.closest('#filterArea');
    if (area) {
      state.area = area.value;
      render();
      return;
    }

    const viewMode = event.target.closest('#viewMode');
    if (viewMode) {
      const list = $('#requestList');
      if (!list) return;

      if (viewMode.value === 'kanban') {
        list.innerHTML = kanban();
      } else {
        const rows = solicitacoesFiltradas();
        list.innerHTML = tableRequests(rows);
      }
    }
  });
}

function kanban() {

  const cols = [
    ['NOVO', 'Novas'],
    ['EM_CÁLCULO', 'Em cálculo'],
    ['EM_REVISÃO', 'Em revisão'],
    ['ENVIADO', 'Enviadas']
  ];

  return `
    <div class="kanban">

      ${
        cols
          .map(
            ([s, l]) => `
              <div class="kanban-col">

                <div class="kanban-head">
                  <span>${l}</span>
                  <span>
                    ${
                      db.requests.filter(
                        r =>
                          r.status === s
                      ).length
                    }
                  </span>
                </div>

                ${
                  db.requests
                    .filter(
                      r =>
                        r.status === s
                    )
                    .map(
                      r => `
                        <div
                          class="kanban-card"
                          data-open="${r.id}"
                        >

                          <strong>
                            ${r.codigo}
                          </strong>

                          <small>
                            ${r.tipo}
                            <br>
                            ${r.advogado}
                            <br>
                            Prazo:
                            ${fmtDate(
                              r.prazo
                            )}
                          </small>

                        </div>
                      `
                    )
                    .join('')
                }

              </div>
            `
          )
          .join('')
      }

    </div>
  `;
}


document.addEventListener('keydown', event => {
  const tecla = String(event.key || '').toLowerCase();
  const atalhoAjusteFinanceiro =
    (event.ctrlKey || event.metaKey) && event.shiftKey && tecla === 'e';

  if (!atalhoAjusteFinanceiro) return;

  if (!isAdministrador()) return;
  if (!['solicitacoes', 'financeiro'].includes(state.view) || !state.selected) return;

  // O atalho funciona com o drawer da solicitação aberto, inclusive
  // quando o foco estiver em um campo do formulário.
  if (!$('#drawerBackdrop')) return;

  // Evita abrir um segundo modal caso outro modal já esteja em uso.
  if ($('#modalRoot')?.querySelector('.modal-backdrop')) return;

  const r = db.requests.find(item => item.id === state.selected);
  if (!r || !['CONCLUIDO', 'CONCLUÍDO'].includes(r.status)) {
    showToast('O ajuste financeiro excepcional está disponível somente para solicitações concluídas.');
    return;
  }

  event.preventDefault();
  abrirModalAjusteFinanceiro(r);
});

prepararNavegacaoMobile();
initEventDelegation();

(async function iniciarAplicacao() {

  const autenticado =
    await carregarSessao();

  if (!autenticado) return;

  const dadosCarregados =
    await carregarSolicitacoes();

  if (!dadosCarregados) return;

  atualizarUsuarioInterface();
  render();

})();
