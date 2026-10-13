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

  // Ativar item do menu lateral
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function (e) {
      document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('ativo'));
      this.classList.add('ativo');
    });
  });

  // Acessar turma (botões 'Acessar')
  document.querySelectorAll('.aluno a.btn-secundario').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const turma = this.closest('.aluno').querySelector('strong').innerText;
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

  // Quick actions
  document.querySelectorAll('.quick-actions a').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const text = this.innerText.trim();
      showModal({title: text, message: text + ' — função de exemplo (implemente backend)', confirmText: 'OK'});
    });
  });

});
