/*
===============================================
JS/aluno-atividade.js
===============================================
Página: pages/aluno-atividades.html (perfil: aluno)
Finalidade: lista as atividades/avaliações publicadas nas turmas do aluno, permite
enviar (ou atualizar) a resposta em texto e mostra nota e feedback depois da correção.

Parâmetros de URL (todos opcionais):
  ?turmaId=N              -> mostra só a turma N (o servidor confere a matrícula)
  ?tipo=atividade|avaliacao -> filtra o tipo de conteúdo e ajusta o título da página

API usada (via conradFetch, de JS/config.js):
  GET  /me                              -> descobre quem está logado (educador é redirecionado)
  GET  /api/aluno/atividades[?filtros]  -> lista com entrega, nota e feedback (JS/atividades.js)
  GET  /api/turmas                      -> turmas do aluno, para os botões de filtro
  POST /api/atividades/:id/entrega      -> envia a resposta ({ resposta })
  POST /logout                          -> botão Sair

Segurança: todo texto vindo do servidor entra na tela com textContent (nunca innerHTML).
*/

// Atalho para document.querySelector
const $ = (seletor) => document.querySelector(seletor);
// ---- Leitura dos filtros da URL e montagem da query string enviada à API
const params = new URLSearchParams(location.search);
const turmaId = params.get('turmaId');
const tipoFiltro = params.get('tipo');
const query = new URLSearchParams();
if (turmaId) query.set('turmaId', turmaId);
if (tipoFiltro === 'atividade' || tipoFiltro === 'avaliacao') query.set('tipo', tipoFiltro);
const filtro = query.toString() ? '?' + query.toString() : '';

// Ajusta título/subtítulo da página conforme o tipo filtrado
if (tipoFiltro === 'avaliacao') {
    $('#titulo-conteudo').textContent = 'Minhas avaliações';
    $('#subtitulo-conteudo').textContent = 'Consulte as avaliações, envie suas respostas e acompanhe suas notas.';
} else if (tipoFiltro === 'atividade') {
    $('#titulo-conteudo').textContent = 'Minhas atividades';
    $('#subtitulo-conteudo').textContent = 'Consulte as tarefas, envie suas respostas e acompanhe suas entregas.';
}

// Cria um elemento com texto seguro (textContent evita injeção de HTML)
// Helper de criação de elementos: h('div', 'classe', 'texto') — usa textContent por segurança
// (os dados vêm do banco e nunca devem ser interpretados como HTML).
function h(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto != null) el.textContent = texto;
    return el;
}

// Converte 'AAAA-MM-DD' em 'DD/MM/AAAA'. Sem data, informa 'sem prazo'.
function dataBR(iso) {
    if (!iso) return 'sem prazo';
    const [a, m, d] = iso.split('-');
    return d + '/' + m + '/' + a;
}

// Define o status exibido: corrigida (tem corrigida_em) > enviada (tem enviada_em) > pendente.
// Retorna [classe CSS, rótulo].
function statusDe(a) {
    if (a.corrigida_em) return ['corrigida', 'Corrigida'];
    if (a.enviada_em) return ['enviada', 'Enviada'];
    return ['pendente', 'Pendente'];
}

/**
 * Monta o cartão de uma atividade.
 * @param {object} a  item de GET /api/aluno/atividades (titulo, disciplina, turma, tipo,
 *                   data_aplicacao, valor_maximo, resposta, enviada_em, nota, feedback, corrigida_em)
 * @returns {HTMLElement}  cartão com cabeçalho, descrição e: nota+feedback (se corrigida)
 *                         ou caixa de resposta + botão Enviar/Atualizar (se ainda aberta).
 * Regra de negócio: depois de corrigida a resposta não pode mais ser alterada
 * (o servidor também bloqueia, com HTTP 409).
 */
function criarCard(a) {
    const [classeStatus, rotuloStatus] = statusDe(a);
    const card = h('article', 'card');

    const topo = h('div', 'card-topo');
    topo.append(
        h('span', 'tag ' + a.tipo, a.tipo === 'avaliacao' ? 'Avaliação' : 'Atividade'),
        h('span', 'status ' + classeStatus, rotuloStatus)
    );

    card.append(
        topo,
        h('h3', null, a.titulo),
        h('p', 'meta', a.disciplina + ' • ' + a.turma + ' • Prazo: ' + dataBR(a.data_aplicacao) +
            ' • Valor: ' + Number(a.valor_maximo) + ' pts')
    );
    if (a.descricao) card.append(h('p', 'desc', a.descricao));

    // Já corrigida: mostra nota, feedback e a resposta enviada
    if (a.corrigida_em) {
        const box = h('div', 'nota-box');
        box.append(h('strong', null, 'Nota: ' + Number(a.nota) + ' / ' + Number(a.valor_maximo)));
        if (a.feedback) box.append(h('p', null, 'Feedback: ' + a.feedback));
        card.append(box, h('div', 'resposta-enviada', 'Sua resposta: ' + a.resposta));
        return card;
    }

    // Pendente ou enviada: formulário de resposta
    const campo = h('textarea');
    campo.placeholder = 'Escreva aqui a sua resposta…';
    campo.maxLength = 5000;
    campo.value = a.resposta || '';

    const botao = h('button', 'btn', a.enviada_em ? 'Atualizar resposta' : 'Enviar resposta');
    botao.type = 'button';
    const msg = h('span', 'msg');

    botao.addEventListener('click', async () => {
        if (!campo.value.trim()) {
            msg.className = 'msg erro';
            msg.textContent = 'Escreva a resposta antes de enviar.';
            return;
        }
        botao.disabled = true;
        try {
            await conradFetch('/api/atividades/' + a.id + '/entrega', {
                method: 'POST',
                body: JSON.stringify({ resposta: campo.value })
            });
            await carregar();
        } catch (erro) {
            msg.className = 'msg erro';
            msg.textContent = erro.message;
            botao.disabled = false;
        }
    });

    const acoes = h('div', 'acoes');
    acoes.append(botao, msg);
    card.append(campo, acoes);
    return card;
}

/**
 * Busca as atividades no servidor e redesenha a tela: contexto da turma (voltar/escolher turma),
 * lista de cartões e contadores de pendentes/enviadas/corrigidas.
 * Também é chamada após cada envio, para refletir o novo status.
 */
async function carregar() {
    const dados = await conradFetch('/api/aluno/atividades' + filtro);
    const contexto = $('#turma-contexto');
    contexto.replaceChildren();
    if (turmaId) {
        const nomeTurma = document.createElement('strong');
        nomeTurma.textContent = `Turma: ${dados.turma || 'Selecionada'}`;
        const voltar = document.createElement('a');
        voltar.href = `turma.html?id=${encodeURIComponent(turmaId)}`;
        voltar.className = 'btn-sec';
        voltar.textContent = 'Voltar para turma';
        contexto.append(nomeTurma, voltar);
    } else {
        const turmas = await conradFetch('/api/turmas');
        contexto.append(h('strong', null, 'Escolha uma turma para filtrar o conteúdo:'));
        (turmas.turmas || []).forEach((turma) => {
            const linkTurma = document.createElement('a');
            linkTurma.href = `aluno-atividades.html?turmaId=${encodeURIComponent(turma.id)}${tipoFiltro ? '&tipo=' + encodeURIComponent(tipoFiltro) : ''}`;
            linkTurma.className = 'btn-sec';
            linkTurma.textContent = turma.nome;
            contexto.append(linkTurma);
        });
    }

    const lista = $('#lista');
    lista.replaceChildren();

    let pendentes = 0, enviadas = 0, corrigidas = 0;
    dados.atividades.forEach((a) => {
        if (a.corrigida_em) corrigidas++;
        else if (a.enviada_em) enviadas++;
        else pendentes++;
        lista.append(criarCard(a));
    });

    $('#n-pendentes').textContent = pendentes;
    $('#n-enviadas').textContent = enviadas;
    $('#n-corrigidas').textContent = corrigidas;

    if (!turmaId && !(dados.atividades || []).length && !(turmasFallbackCount())) {
        lista.append(h('p', 'vazio', 'Entre em uma turma para visualizar as atividades e avaliações.'));
    } else if (dados.atividades.length === 0) {
        lista.append(h('p', 'vazio', 'Nenhum conteúdo publicado nesta turma ainda.'));
    }
}

// Conta quantos botões de turma foram desenhados (usado para decidir a mensagem de lista vazia)
function turmasFallbackCount() {
    return document.querySelectorAll('#turma-contexto a').length;
}

// Botão Sair: encerra a sessão no servidor e volta para a página inicial
$('#sair').addEventListener('click', (evento) => {
    evento.preventDefault();
    conradFetch('/logout', { method: 'POST' }).finally(() => { location.href = '../index.html'; });
});

// Exibe a falha de carregamento no lugar da lista
function mostrarErro(erro) {
    $('#lista').replaceChildren(h('p', 'msg erro', 'Não foi possível carregar: ' + erro.message));
}

// Ponto de entrada: confere a sessão (401 -> login; educador -> tela de correção) e carrega a lista
(async function iniciar() {
    try {
        const eu = await conradFetch('/me');
        if (eu.usuario.tipo === 'educador') {
            location.href = 'professor-correcao.html';
            return;
        }
        $('#nome-usuario').textContent = '👤 ' + eu.usuario.nome;
        await carregar();
    } catch (erro) {
        if (erro.status === 401) location.href = 'login.html';
        else mostrarErro(erro);
    }
})();