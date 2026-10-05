document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('../JS/dashboardData.json');
    if (!response.ok) throw new Error('Erro ao carregar JSON');

    const data = await response.json();

    const page = document.body.dataset.page || 'avaliacao';

    if (page === 'avaliacao') {
      renderResumo(data.metrics);
      renderAlunos(data.alunos);
      renderMedia(data.mediaGeral, data.materias);
      renderPendencias(data.pendencias);
      renderAvisos(data.avisos);
      renderCabecalhos(data.professor);
    }

    if (page === 'atividades') {
      renderAtividadesCards(data.atividades);
      renderStats(data);
      renderTarefas(data.tarefas);
      renderCronograma(data.cronograma);
    }

    bindNavigation();
  } catch (error) {
    console.error('Erro ao iniciar dashboard:', error);
  }
});

function renderCabecalhos(professor) {
  const nome = document.querySelector('.boas-vindas h1');
  const disciplina = document.querySelector('.info-professor div:nth-child(1) span');
  const acesso = document.querySelector('.info-professor div:nth-child(2) span');

  if (nome) nome.textContent = `Olá, ${professor.nome}! 👋`;
  if (disciplina) disciplina.textContent = professor.disciplina;
  if (acesso) acesso.textContent = professor.ultimoAcesso;
}

function renderResumo(metrics) {
  const container = document.querySelector('.cards-resumo');
  if (!container) return;

  container.innerHTML = metrics.map((item) => `
    <div class="card-resumo">
      <div class="icone-card">${item.icon}</div>
      <div>
        <h3>${item.titulo}</h3>
        <strong class="numero-card">${item.valor}</strong>
        <span>${item.descricao}</span>
      </div>
      <button type="button" class="btn-secundario" data-link="${item.destino}">
        ${item.acao}
      </button>
    </div>
  `).join('');
}

function renderAlunos(alunos) {
  const card = document.querySelector('.card-avaliacoes');
  if (!card) return;

  const rows = alunos.map((aluno) => `
    <div class="aluno">
      <span>${aluno.nome}</span>
      <strong>${aluno.nota}</strong>
      <span class="status ${aluno.tipo}">${aluno.status}</span>
    </div>
  `).join('');

  card.innerHTML = `
    <div class="titulo-card">
      <div>
        <span class="subtitulo-card">DESEMPENHO</span>
        <h2>Avaliação dos Alunos</h2>
      </div>
      <button type="button" class="btn-secundario" data-link="print">📊 Exportar Relatório</button>
    </div>
    <div class="cabecalho-alunos">
      <span>Aluno</span>
      <span>Nota</span>
      <span>Status</span>
    </div>
    ${rows}
  `;
}

function renderMedia(mediaGeral, materias) {
  const mediaCard = document.querySelector('.card-media');
  if (!mediaCard) return;

  mediaCard.innerHTML = `
    <div class="cabecalho-media">
      <div>
        <span class="subtitulo-card">DESEMPENHO DA TURMA</span>
        <h3>Média Geral</h3>
      </div>
      <span class="icone-media">📈</span>
    </div>
    <h1>${mediaGeral}</h1>
    <p>Média das avaliações da turma.</p>
    <div class="barra-progresso"><div class="progresso"></div></div>
    <small>Bom desempenho geral</small>
    <div class="materias-media">
      <h4>Média por matéria</h4>
      ${materias.map((materia) => `
        <div class="materia-item">
          <span>${materia.nome}</span>
          <strong>${materia.nota}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPendencias(pendencias) {
  const container = document.querySelector('.card-pendencias');
  if (!container) return;

  const pendenciasHtml = pendencias.map((item) => `
    <div class="pendencia">
      <div class="icone-pendencia">${item.icon}</div>
      <div>
        <h4>${item.titulo}</h4>
        <p>${item.descricao}</p>
      </div>
      <button type="button" class="btn-${item.tipo}" data-link="${item.destino}">${item.acao}</button>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="titulo-card">
      <h3>Atividades Pendentes</h3>
      <span class="contador">${pendencias.length}</span>
    </div>
    ${pendenciasHtml}
  `;
}

function renderAvisos(avisos) {
  const cards = document.querySelectorAll('.card-pendencias');
  const alvo = cards[1] || cards[0];
  if (!alvo) return;

  alvo.innerHTML = `
    <div class="titulo-card">
      <h3>📢 Avisos</h3>
    </div>
    ${avisos.map((aviso) => `
      <div class="aviso">
        <span class="aviso-data">${aviso.data}</span>
        <div>
          <h4>${aviso.titulo}</h4>
          <p>${aviso.texto}</p>
        </div>
      </div>
    `).join('')}
  `;
}

function renderAtividadesCards(atividades) {
  const container = document.querySelector('#atividadesList');
  if (!container) return;

  container.innerHTML = atividades.map((item) => `
    <div class="card-atividade">
      <div class="card-atividade-main">
        <div class="icone-atividade">${item.icon}</div>
        <div>
          <h3>${item.titulo}</h3>
          <p>${item.descricao}</p>
        </div>
      </div>
      <div class="card-atividade-actions">
        <span class="status-badge ${item.statusClass}">${item.status}</span>
        <a href="${item.destino}" class="${item.botaoClass}">${item.acao}</a>
      </div>
    </div>
  `).join('');
}

function renderStats(data) {
  const container = document.querySelector('#statsRapidas');
  if (!container) return;

  container.innerHTML = `
    <div class="stat-box">
      <h4>Ativas</h4>
      <strong>${data.atividades.length}</strong>
      <span>tarefas em andamento</span>
    </div>
    <div class="stat-box">
      <h4>Pendentes</h4>
      <strong>${data.atividades.filter(i => i.statusClass === 'pendente').length}</strong>
      <span>requere atenção</span>
    </div>
    <div class="stat-box">
      <h4>Entregues</h4>
      <strong>28</strong>
      <span>alunos concluíram</span>
    </div>
    <div class="stat-box">
      <h4>Notas</h4>
      <strong>8,7</strong>
      <span>média geral</span>
    </div>
  `;
}

function renderTarefas(tarefas) {
  const container = document.querySelector('#tarefasList');
  if (!container) return;

  container.innerHTML = tarefas.map((item) => `
    <div class="mini-item">
      <div>
        <strong>${item.titulo}</strong>
        <span>${item.meta}</span>
      </div>
      <a href="${item.destino}" class="${item.botaoClass}">${item.botao}</a>
    </div>
  `).join('');
}

function renderCronograma(cronograma) {
  const container = document.querySelector('#cronogramaList');
  if (!container) return;

  container.innerHTML = cronograma.map((item) => `
    <div class="mini-item">
      <div>
        <strong>${item.titulo}</strong>
        <span>${item.meta}</span>
      </div>
      <span class="status-badge ${item.statusClass}">${item.status}</span>
    </div>
  `).join('');
}

function bindNavigation() {
  document.querySelectorAll('[data-link]').forEach((element) => {
    element.addEventListener('click', (event) => {
      const target = event.currentTarget.getAttribute('data-link');

      if (!target || target === 'print') {
        if (target === 'print') {
          window.print();
        }
        return;
      }

      window.location.href = target;
    });
  });
}
