/*
===============================================
JS/educador.js
===============================================
Página: pages/educador.html (painel do educador).
Contém DUAS partes independentes:
  1. Interações do painel (modal genérico #appModal, dropdown do perfil, botões de demonstração),
     registradas em DOMContentLoaded.
  2. Carregamento dos dados reais do painel (turmas, alunos, entregas a corrigir) a partir da
     API — antes era um <script> inline em educador.html e foi movido para cá.
Depende de: JS/config.js (conradFetch) e do layout.js (nome do usuário no topo/menu).
*/
document.addEventListener('DOMContentLoaded', function () {
  // Função que exibe modal e retorna Promise<boolean>
  function showModal({title = '', message = '', confirmText = 'OK', cancelText = null} = {}) {
    return new Promise(resolve => {
      const modal = document.getElementById('appModal');
      if (!modal) { alert(message); return resolve(true); }

      const titleEl = modal.querySelector('.modal-title');
      const bodyEl = modal.querySelector('.modal-body');
      const confirmBtn = modal.querySelector('.modal-confirm');
      const cancelBtn = modal.querySelector('.modal-cancel');
      const closeBtn = modal.querySelector('.modal-close');

      titleEl.innerText = title || '';
      bodyEl.innerText = message || '';
      confirmBtn.innerText = confirmText || 'OK';
      if (cancelText) { cancelBtn.style.display = 'inline-block'; cancelBtn.innerText = cancelText; } else { cancelBtn.style.display = 'none'; }

      modal.style.display = 'flex';

      function cleanup() {
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
        closeBtn.onclick = null;
        modal.onclick = null;
      }

      confirmBtn.onclick = () => { cleanup(); modal.style.display = 'none'; resolve(true); };
      cancelBtn.onclick = () => { cleanup(); modal.style.display = 'none'; resolve(false); };
      closeBtn.onclick = () => { cleanup(); modal.style.display = 'none'; resolve(false); };

      modal.onclick = (e) => { if (e.target === modal) { cleanup(); modal.style.display = 'none'; resolve(false); } };
    });
  }

  // (removido) bloco antigo referenciava variáveis inexistentes (nome/item) e interrompia o script;
  // o nome do usuário e o item ativo do menu são preenchidos pelo layout.js.

  // Links com destino real abrem a página da turma normalmente.
  // Mantém o modal apenas para os antigos links de demonstração (#).
  document.querySelectorAll('.aluno a.btn-secundario').forEach(btn => {
    btn.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href && href !== '#') return;
      e.preventDefault();
      const turma = this.closest('.aluno')?.querySelector('strong')?.innerText || 'Turma';
      showModal({title: 'Abrir turma', message: 'Abrindo página da turma: ' + turma, confirmText: 'OK'});
    });
  });

  // Corrigir atividade (botões .btn-primario dentro de .pendencia)
  document.querySelectorAll('.pendencia .btn-primario').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const titulo = this.closest('.pendencia').querySelector('h4')?.innerText || 'Atividade';
      showModal({title: 'Corrigir atividade', message: 'Marcar como corrigida: "' + titulo + '" ?', confirmText: 'Sim', cancelText: 'Cancelar'})
        .then(confirmado => {
          if (confirmado) {
            this.textContent = 'Corrigido';
            this.disabled = true;
            this.classList.add('disabled');
          }
        });
    });
  });

  // Abrir chat (botão do card de mensagens)
  document.querySelectorAll('.titulo-card a.btn-secundario').forEach(btn => {
    btn.addEventListener('click', function (e) {
      if (this.innerText.trim().toLowerCase().includes('abrir')) {
        e.preventDefault();
        showModal({title: 'Bate-papo', message: 'Abrindo bate-papo...', confirmText: 'OK'});
      }
    });
  });

  // Toggle dropdown do perfil
  const profileToggle = document.getElementById('profileToggle');
  const profileDropdown = document.getElementById('profileDropdown');
  if (profileToggle && profileDropdown) {
    profileToggle.addEventListener('click', function (e) {
      e.preventDefault();
      const shown = profileDropdown.style.display === 'block';
      profileDropdown.style.display = shown ? 'none' : 'block';
    });

    // fechar ao clicar fora
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('.header-profile')) {
        profileDropdown.style.display = 'none';
      }
    });
  }

  // Quick actions - only simulate for placeholder links (href="#" or missing)
  document.querySelectorAll('.quick-actions a').forEach(btn => {
    btn.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href && href !== '#') return; // allow real navigation
      e.preventDefault();
      const text = this.innerText.trim();
      showModal({title: text, message: text + ' — função de exemplo (implemente backend)', confirmText: 'OK'});
    });
  });

});


// ===========================================================================
// PARTE 2 — DADOS REAIS DO PAINEL DO EDUCADOR
// Fluxo: GET /me (confere se é educador) -> GET /api/atividades e GET /api/turmas ->
// preenche cartões-resumo, lista de turmas e "submissões recentes".
// Sem sessão (401) redireciona para login.html; aluno é enviado para aluno.html.
// ===========================================================================
(async function () {
    const h = (tag, classe, texto) => {
        const el = document.createElement(tag);
        if (classe) el.className = classe;
        if (texto != null) el.textContent = texto;
        return el;
    };

    function saudacao() {
        const hora = new Date().getHours();
        return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
    }

    function iniciais(nome) {
        const p = nome.trim().split(/\s+/);
        return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
    }

    function preencherNome(nome) {
        const titulo = document.querySelector('.titulo-dashboard h1');
        if (titulo) titulo.textContent = saudacao() + ', ' + nome;
        document.querySelectorAll('.menu-lateral > div > strong, .profile-name strong')
            .forEach((el) => { el.textContent = nome; });
        const avatar = document.querySelector('.header-profile .avatar');
        if (avatar) avatar.textContent = iniciais(nome);
    }

    document.querySelectorAll('[data-sair]').forEach((link) => {
        link.addEventListener('click', (evento) => {
            evento.preventDefault();
            conradFetch('/logout', { method: 'POST' }).finally(() => { location.href = '../index.html'; });
        });
    });

    try {
        const eu = await conradFetch('/me');
        if (eu.usuario.tipo !== 'educador') { location.href = 'aluno.html'; return; }
        preencherNome(eu.usuario.nome);

        const [atividades, dadosTurmas] = await Promise.all([
            conradFetch('/api/atividades'),
            conradFetch('/api/turmas')
        ]);

        const minhasTurmas = dadosTurmas.turmas || [];
        const listaTurmas = document.getElementById('lista-turmas-dashboard');
        listaTurmas.replaceChildren();
        const totalAlunos = minhasTurmas.reduce((total, turma) => total + Number(turma.quantidade_alunos || 0), 0);
        const cartoesTurmas = document.querySelectorAll('.cards-resumo .card-resumo');
        if (cartoesTurmas[0]) cartoesTurmas[0].querySelector('h2').textContent = minhasTurmas.length;
        if (cartoesTurmas[1]) cartoesTurmas[1].querySelector('h2').textContent = totalAlunos;

        if (!minhasTurmas.length) {
            const vazio = h('p', null, 'Você ainda não criou turmas. Use o botão abaixo para começar.');
            listaTurmas.append(vazio);
        } else {
            minhasTurmas.slice(0, 4).forEach((turma) => {
                const item = h('div', 'aluno');
                const info = document.createElement('div');
                info.append(h('strong', null, turma.nome), h('small', null, `${turma.disciplina} · ${turma.quantidade_alunos} alunos`));
                const total = h('strong', null, String(turma.quantidade_alunos || 0));
                const acao = document.createElement('div');
                const abrir = h('a', 'btn-secundario', 'Acessar');
                abrir.href = `turma.html?id=${encodeURIComponent(turma.id)}`;
                acao.append(abrir);
                item.append(info, total, acao);
                listaTurmas.append(item);
            });
        }

        // Quarto cartão: entregas aguardando correção
        const aCorrigir = atividades.reduce(
            (soma, a) => soma + (Number(a.total_entregas) - Number(a.corrigidas)), 0);
        const cartoes = document.querySelectorAll('.cards-resumo .card-resumo');
        if (cartoes[3]) {
            cartoes[3].querySelector('h2').textContent = aCorrigir;
            cartoes[3].querySelector('h3').textContent = 'Para corrigir';
            cartoes[3].querySelector('span').textContent = 'Entregas aguardando correção';
        }

        // Submissões recentes: atividades que já têm entregas
        const cartao = document.querySelector('.submissions-card');
        if (cartao) {
            cartao.querySelectorAll('.pendencia').forEach((el) => el.remove());
            const comEntregas = atividades.filter((a) => Number(a.total_entregas) > 0).slice(0, 5);

            if (comEntregas.length === 0) {
                cartao.append(h('p', null, 'Nenhuma entrega recebida ainda.'));
            }

            comEntregas.forEach((a) => {
                const item = h('div', 'pendencia');
                item.style.cursor = 'pointer';
                item.addEventListener('click', () => { location.href = a.turma_id ? `professor-correcao.html?turmaId=${a.turma_id}&tipo=${a.tipo}` : 'professor-correcao.html'; });
                item.append(
                    h('h4', null, a.titulo),
                    h('p', null, 'Turma: ' + a.turma + ' · ' + a.total_entregas + ' entrega(s) · ' + a.corrigidas + ' corrigida(s)')
                );
                cartao.append(item);
            });
        }
    } catch (erro) {
        if (erro.status === 401) location.href = 'login.html';
        else console.error(erro);
    }
})();
