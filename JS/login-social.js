// JS/login-social.js
// Carregue na página de login DEPOIS do script do supabase-js (CDN).
//
// Fluxo:
// 1) Clique no botão -> Supabase leva o usuário ao Google.
// 2) Google -> Supabase -> volta para esta página com o token na URL.
// 3) Enviamos o token ao seu servidor (POST /auth/supabase), que confere com o
//    Supabase e abre a sessão do express-session. O resto do site segue igual.

// Precisa ser lido ANTES de criar o cliente: o Supabase limpa a URL
// assim que processa o token que veio do Google.
const voltouDoProvedor = window.location.hash.includes('access_token');
const veioComErro =
  window.location.hash.includes('error_description') ||
  window.location.search.includes('error_description');

// TODO: Supabase -> Project Settings -> API (URL e chave publishable/anon).
// Essas duas são públicas por design; podem ficar no front-end.
// NUNCA coloque aqui a chave secret / service_role.
const SUPABASE_URL = 'https://xdgguheuntobmzfyeqbc.supabase.co'; // confira com o botão Copy do Supabase
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_56pxaeACP5RiBEew651Oow_fT4rS1Ka';

// Atenção ao nome: "supabase" já é a biblioteca global do CDN.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const PAGINA_LOGIN = '/pages/login.html'; // TODO: confirme o caminho
const DEPOIS_DO_LOGIN = '/';              // TODO: para onde ir após entrar

function mostrarErro(mensagem) {
  const el = document.getElementById('login-erro');
  if (el) {
    el.textContent = mensagem;
    el.hidden = false;
  } else {
    alert(mensagem);
  }
}

// ---------- 1) Clique nos botões ----------
document.querySelectorAll('[data-provider]').forEach((botao) => {
  botao.addEventListener('click', async () => {
    botao.disabled = true;

    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: botao.dataset.provider, // 'google' ou 'facebook'
      options: { redirectTo: `${window.location.origin}${PAGINA_LOGIN}` },
    });

    // Se deu certo, o navegador já está indo para o Google e nada abaixo roda.
    if (error) {
      botao.disabled = false;
      mostrarErro('Não foi possível iniciar o login. Tente novamente.');
      console.error(error);
    }
  });
});

// ---------- 2) Volta do Google: abre a sessão no servidor ----------
if (veioComErro) {
  mostrarErro('O login foi cancelado ou falhou. Tente novamente.');
}

let jaEnviado = false;

supabaseClient.auth.onAuthStateChange((evento, sessao) => {
  if (!voltouDoProvedor || jaEnviado || !sessao) return;
  if (evento !== 'SIGNED_IN' && evento !== 'INITIAL_SESSION') return;

  jaEnviado = true;
  criarSessaoNoServidor(sessao.access_token);
});

async function criarSessaoNoServidor(accessToken) {
  try {
    const resposta = await fetch('/auth/supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ access_token: accessToken }),
    });

    if (!resposta.ok) throw new Error(`Servidor respondeu ${resposta.status}`);

    window.location.href = DEPOIS_DO_LOGIN;
  } catch (erro) {
    console.error(erro);
    mostrarErro('Não foi possível concluir o login. Tente novamente.');
  }
}