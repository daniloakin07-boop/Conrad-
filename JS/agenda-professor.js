/*
===============================================
JS/agenda-professor.js
===============================================
Página: pages/agenda-professor.html (perfil: educador)
Finalidade: controla o modal "Novo evento" da agenda semanal do professor.
Origem: este código ficava dentro de um <script> no próprio HTML e foi externalizado
sem alterar o comportamento.

Observações importantes:
  - Os eventos são adicionados apenas no DOM da página; NÃO há persistência
    (ao recarregar, os eventos criados somem). Não existe rota de agenda no server.js.
  - Depende dos ids/classes do HTML: #agendaModal, #openNew, .close-modal,
    #cancelEventBtn, #eventForm, #eventDay, #eventTime, #eventTitle e
    das colunas .agenda-day[data-day="..."].
  - Carregado com `defer`: roda depois que o HTML inteiro foi lido.
*/
(function () {
    // ---- Elementos usados pelo modal
    const modal = document.getElementById('agendaModal');
    const openNew = document.getElementById('openNew');
    const closeBtn = document.querySelector('.close-modal');
    const cancelBtn = document.getElementById('cancelEventBtn');
    const form = document.getElementById('eventForm');

    // Abre o modal (o CSS o mantém oculto até receber display:flex)
    function showModal() { modal.style.display = 'flex'; }

    // Fecha o modal e limpa os campos para a próxima abertura
    function hideModal() { modal.style.display = 'none'; form.reset(); }

    // ---- Eventos de abrir/fechar
    openNew.addEventListener('click', showModal);
    closeBtn.addEventListener('click', hideModal);
    cancelBtn.addEventListener('click', hideModal);

    // ---- Envio do formulário: valida horário/título e cria o cartão na coluna do dia escolhido
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const day = document.getElementById('eventDay').value;
        const time = document.getElementById('eventTime').value.trim();
        const title = document.getElementById('eventTitle').value.trim();
        if (!time || !title) { alert('Preencha horário e título'); return; }

        // Coluna do dia (data-day) que receberá o novo evento
        const col = document.querySelector('.agenda-day[data-day="' + day + '"]');
        if (col) {
            const d = document.createElement('div');
            d.className = 'agenda-evento';
            d.textContent = time + ' · ' + title; // textContent: nunca interpreta HTML digitado
            col.appendChild(d);
        }
        hideModal();
    });
})();
