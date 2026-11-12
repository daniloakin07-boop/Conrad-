// Tarefas: marcar como concluída e atualizar o contador
const listaTarefas = document.getElementById('listaTarefas');
const contadorTarefas = document.getElementById('contadorTarefas');

listaTarefas.addEventListener('change', (event) => {
    if (event.target.type !== 'checkbox') return;
    event.target.closest('li').classList.toggle('feita', event.target.checked);
    contadorTarefas.textContent =
        listaTarefas.querySelectorAll('input:not(:checked)').length;
});
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

    function iso(data) {
        return data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0') + '-' + String(data.getDate()).padStart(2, '0');
    }

    function dataBR(valor) {
        const [a, m, d] = valor.split('-');
        return d + '/' + m + '/' + a;
    }

    // ?turmaId=N: o aluno entrou nesta turma (pelo código do professor ou pela lista de turmas)
    const turmaId = new URLSearchParams(location.search).get('turmaId');
    const filtroTurma = turmaId ? '?turmaId=' + encodeURIComponent(turmaId) : '';

    function ajustarParaTurma(nomeTurma) {
        const id = encodeURIComponent(turmaId);
        const verAtividades = document.querySelector('.quick-actions a[href^="aluno-atividades"]');
        const salaVideo = document.querySelector('.quick-actions a[href^="salas"]');
        if (verAtividades) verAtividades.href = 'aluno-atividades.html?turmaId=' + id;
        if (salaVideo) salaVideo.href = 'turma.html?id=' + id + '&aba=video';

        const mural = h('a', 'btn-secundario', 'Abrir turma');
        mural.href = 'turma.html?id=' + id;
        document.querySelector('.quick-actions')?.append(mural);

        const subtitulo = document.querySelector('.titulo-dashboard p');
        if (subtitulo) subtitulo.textContent = 'Turma: ' + (nomeTurma || 'selecionada') + ' — resumo das suas notas e pendências';
    }

    try {
        const eu = await conradFetch('/me');
        if (eu.usuario.tipo === 'educador') { location.href = 'educador.html'; return; }
        preencherNome(eu.usuario.nome);

        const dados = await conradFetch('/api/aluno/atividades' + filtroTurma);
        if (turmaId) ajustarParaTurma(dados.turma);
        const cartoes = document.querySelectorAll('.cards-resumo .card-resumo');

        // Média geral: notas corrigidas convertidas para a escala de 0 a 10
        const notas = dados.atividades
            .filter((a) => a.nota != null && Number(a.valor_maximo) > 0)
            .map((a) => Number(a.nota) / Number(a.valor_maximo) * 10);

        if (cartoes[0]) {
            cartoes[0].querySelector('h2').textContent = notas.length
                ? (notas.reduce((x, y) => x + y, 0) / notas.length).toFixed(1).replace('.', ',')
                : '—';
            cartoes[0].querySelector('span').textContent = notas.length
                ? 'Média de ' + notas.length + ' atividade(s) corrigida(s)'
                : 'Ainda sem notas lançadas';
        }

        // Tarefas pendentes = ainda sem resposta enviada
        const pendentes = dados.atividades.filter((a) => !a.enviada_em);
        if (cartoes[2]) cartoes[2].querySelector('h2').textContent = pendentes.length;
        document.getElementById('contadorTarefas').textContent = pendentes.length;

        const lista = document.getElementById('listaTarefas');
        lista.replaceChildren();
        const amanha = iso(new Date(Date.now() + 86400000));

        if (pendentes.length === 0) {
            const vazio = h('li');
            vazio.append(h('p', 'al-tarefa-titulo', 'Nenhuma tarefa pendente 🎉'));
            lista.append(vazio);
        }

        pendentes.forEach((a) => {
            const item = h('li');
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {
                location.href = 'aluno-atividades.html' + (turmaId ? '?turmaId=' + encodeURIComponent(turmaId) : '');
            });

            const urgente = a.data_aplicacao && a.data_aplicacao <= amanha;
            const caixa = h('div');
            caixa.append(
                h('p', 'al-tarefa-titulo', a.titulo),
                h('p', 'al-tarefa-meta' + (urgente ? ' urgente' : ''),
                    a.disciplina + ' · ' + (a.tipo === 'avaliacao' ? 'Avaliação' : 'Atividade') +
                    (a.data_aplicacao ? ' · Prazo ' + dataBR(a.data_aplicacao) : ''))
            );
            item.append(caixa);
            lista.append(item);
        });
    } catch (erro) {
        if (erro.status === 401) location.href = 'login.html';
        else if (erro.status === 403 && turmaId) location.href = 'turmas.html';
        else console.error(erro);
    }
})();