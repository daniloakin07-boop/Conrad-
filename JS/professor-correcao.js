const $ = (seletor) => document.querySelector(seletor);
const params = new URLSearchParams(location.search);
const seletorTurma = $('#filtro-turma');
const seletorTipo = $('#filtro-tipo');

seletorTipo.value = ['atividade', 'avaliacao'].includes(params.get('tipo')) ? params.get('tipo') : '';

// Cria um elemento com texto seguro (textContent evita injeção de HTML)
function h(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto != null) el.textContent = texto;
    return el;
}

function dataBR(iso) {
    if (!iso) return 'sem prazo';
    const [a, m, d] = String(iso).slice(0, 10).split('-');
    return d + '/' + m + '/' + a;
}

function dataHoraBR(valor) {
    const data = new Date(valor);
    return isNaN(data) ? '' : data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function numero(valor) {
    return Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------- Filtros / topo
function atualizarTopo() {
    const tipo = seletorTipo.value;
    const turmaId = seletorTurma.value;
    $('#titulo-conteudo').textContent =
        tipo === 'avaliacao' ? 'Avaliações' : tipo === 'atividade' ? 'Atividades' : 'Atividades e avaliações';

    const botoes = $('#botoes-topo');
    botoes.replaceChildren();
    const sufixo = turmaId ? '?turmaId=' + encodeURIComponent(turmaId) : '';

    const novaAtividade = h('a', 'btn', '+ Nova atividade');
    novaAtividade.href = 'nova-atividade.html' + sufixo;
    const novaAvaliacao = h('a', 'btn-sec', '+ Nova avaliação');
    novaAvaliacao.href = 'nova-avaliacao.html' + sufixo;
    botoes.append(novaAtividade, novaAvaliacao);

    if (turmaId) {
        const voltar = h('a', 'btn-sec', 'Abrir turma');
        voltar.href = 'turma.html?id=' + encodeURIComponent(turmaId);
        botoes.append(voltar);
    }

    // Mantém os filtros na URL para poder recarregar/compartilhar o link
    const url = new URL(location.href);
    turmaId ? url.searchParams.set('turmaId', turmaId) : url.searchParams.delete('turmaId');
    tipo ? url.searchParams.set('tipo', tipo) : url.searchParams.delete('tipo');
    history.replaceState(null, '', url);
}

// ---------------------------------------------------------------- Entregas de uma atividade
function textoContagem(total, corrigidas) {
    return total + ' entrega(s) · ' + corrigidas + ' corrigida(s)';
}

function criarEntrega(entrega, valorMaximo, aoCorrigir) {
    const bloco = h('div', 'entrega');
    const topo = h('div', 'entrega-topo');
    const status = h('span', null, entrega.corrigida_em ? 'Corrigida' : 'Aguardando correção');
    topo.append(h('strong', null, entrega.aluno), h('span', null, 'Enviada em ' + dataHoraBR(entrega.enviada_em)), status);

    const resposta = h('div', 'resposta', entrega.resposta);

    const corrigir = h('div', 'corrigir');
    const nota = h('input');
    nota.type = 'number';
    nota.min = '0';
    nota.max = String(valorMaximo);
    nota.step = 'any';
    nota.placeholder = 'Nota (0–' + numero(valorMaximo) + ')';
    nota.setAttribute('aria-label', 'Nota de ' + entrega.aluno);
    if (entrega.nota != null) nota.value = Number(entrega.nota);

    const feedback = h('textarea');
    feedback.placeholder = 'Feedback para o aluno (opcional)';
    feedback.value = entrega.feedback || '';
    corrigir.append(nota, feedback);
    const botao = h('button', 'btn', entrega.corrigida_em ? 'Atualizar correção' : 'Salvar correção');
    botao.type = 'button';
    const msg = h('span', 'msg');
    const acoes = h('div', 'acoes');
    acoes.append(botao, msg);

    botao.addEventListener('click', async () => {
        const valor = nota.value.trim();
        if (valor === '' || !Number.isFinite(Number(valor)) || Number(valor) < 0 || Number(valor) > Number(valorMaximo)) {
            msg.className = 'msg erro';
            msg.textContent = 'A nota deve ficar entre 0 e ' + numero(valorMaximo) + '.';
            return;
        }
        botao.disabled = true;
        msg.className = 'msg';
        msg.textContent = 'Salvando...';
        try {
            await conradFetch('/api/entregas/' + entrega.id + '/correcao', {
                method: 'PUT',
                body: JSON.stringify({ nota: Number(valor), feedback: feedback.value.trim() })
            });
            const eraCorrigida = Boolean(entrega.corrigida_em);
            entrega.corrigida_em = new Date().toISOString();
            status.textContent = 'Corrigida';
            botao.textContent = 'Atualizar correção';
            msg.className = 'msg ok';
            msg.textContent = 'Correção salva.';
            if (!eraCorrigida) aoCorrigir();
        } catch (erro) {
            msg.className = 'msg erro';
            msg.textContent = erro.message;
        } finally {
            botao.disabled = false;
        }
    });

    bloco.append(topo, resposta, corrigir, acoes);
    return bloco;
}

// ---------------------------------------------------------------- Cartão de cada atividade
function criarCard(atividade) {
    const card = h('article', 'card');
    let total = Number(atividade.total_entregas || 0);
    let corrigidas = Number(atividade.corrigidas || 0);

    const topo = h('div', 'card-topo');
    const contagem = h('span', 'contagem', textoContagem(total, corrigidas));
    topo.append(h('span', 'tag ' + atividade.tipo, atividade.tipo === 'avaliacao' ? 'Avaliação' : 'Atividade'), contagem);

    const meta = h('p', 'meta',
        atividade.disciplina + ' • ' + atividade.turma + ' • Prazo: ' + dataBR(atividade.data_aplicacao) +
        ' • Valor: ' + numero(atividade.valor_maximo) + ' pts');

    const botao = h('button', 'btn-sec', total ? 'Ver entregas' : 'Nenhuma entrega ainda');
    botao.type = 'button';
    botao.disabled = total === 0;
    botao.style.marginTop = '10px';

    const area = h('div', 'entregas');
    area.style.display = 'none';
    let carregada = false;

    botao.addEventListener('click', async () => {
        if (area.style.display !== 'none') {
            area.style.display = 'none';
            botao.textContent = 'Ver entregas';
            return;
        }
        area.style.display = '';
        botao.textContent = 'Ocultar entregas';
        if (carregada) return;

        area.replaceChildren(h('p', 'vazio', 'Carregando entregas...'));
        try {
            const dados = await conradFetch('/api/atividades/' + atividade.id + '/entregas');
            area.replaceChildren();
            dados.entregas.forEach((entrega) => {
                area.append(criarEntrega(entrega, dados.valor_maximo, () => {
                    corrigidas++;
                    contagem.textContent = textoContagem(total, corrigidas);
                }));
            });
            if (!dados.entregas.length) area.append(h('p', 'vazio', 'Nenhuma entrega recebida.'));
            carregada = true;
        } catch (erro) {
            area.replaceChildren(h('p', 'msg erro', erro.message));
        }
    });

    card.append(topo, h('h3', null, atividade.titulo), meta);
    if (atividade.descricao) card.append(h('p', 'meta', atividade.descricao));
    card.append(botao, area);
    return card;
}

async function carregar() {
    atualizarTopo();
    const lista = $('#lista');
    lista.replaceChildren(h('p', 'vazio', 'Carregando...'));

    const consulta = new URLSearchParams();
    if (seletorTurma.value) consulta.set('turmaId', seletorTurma.value);
    if (seletorTipo.value) consulta.set('tipo', seletorTipo.value);

    try {
        const atividades = await conradFetch('/api/atividades' + (consulta.toString() ? '?' + consulta : ''));
        lista.replaceChildren();
        atividades.forEach((atividade) => lista.append(criarCard(atividade)));
        if (!atividades.length) {
            lista.append(h('p', 'vazio', 'Nada publicado por aqui ainda. Use “+ Nova atividade” ou “+ Nova avaliação” e escolha a turma.'));
        }
    } catch (erro) {
        lista.replaceChildren(h('p', 'msg erro', 'Não foi possível carregar: ' + erro.message));
    }
}

seletorTurma.addEventListener('change', carregar);
seletorTipo.addEventListener('change', carregar);

$('#sair').addEventListener('click', (evento) => {
    evento.preventDefault();
    conradFetch('/logout', { method: 'POST' }).finally(() => { location.href = '../index.html'; });
});

(async function iniciar() {
    try {
        const eu = await conradFetch('/me');
        if (eu.usuario.tipo !== 'educador') {
            location.href = 'aluno-atividades.html';
            return;
        }
        $('#nome-usuario').textContent = '👤 ' + eu.usuario.nome;

        const dados = await conradFetch('/api/turmas');
        (dados.turmas || []).forEach((turma) => {
            seletorTurma.add(new Option(turma.nome + ' — ' + turma.disciplina, String(turma.id)));
        });
        const turmaInicial = params.get('turmaId');
        if (turmaInicial && [...seletorTurma.options].some((opcao) => opcao.value === turmaInicial)) {
            seletorTurma.value = turmaInicial;
        }
        await carregar();
    } catch (erro) {
        if (erro.status === 401) location.href = 'login.html';
        else $('#lista').replaceChildren(h('p', 'msg erro', 'Não foi possível carregar: ' + erro.message));
    }
})();