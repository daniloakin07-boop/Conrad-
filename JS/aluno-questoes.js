/*
===============================================
ATIVIDADES COM QUESTÕES — LADO DO ALUNO  (aluno-atividades.html)
===============================================
Para cada atividade que tem questões, a página chama:

    AlunoQuestoes.criarAcoes(atividade, { usuarioId, aoAtualizar })

e recebe o botão + o painel que ficam dentro do card. O painel mostra, conforme o estado
devolvido por GET /api/aluno/atividades/:id:

    nao_iniciada    atividade com tempo: tela de instruções com o botão "Iniciar agora"
    em_andamento    questões para responder (com o cronômetro, se houver tempo)
    enviada         respostas já enviadas, aguardando correção
    corrigida       nota, gabarito e comentários do professor
    tempo_esgotado  o tempo acabou e nada foi enviado

Sobre o cronômetro: quem manda no tempo é o SERVIDOR. A tela só mostra a contagem
regressiva a partir dos segundos que o servidor informou (e se acerta de novo quando a
aba volta a ficar visível). Mexer no relógio do computador não ganha tempo.

As respostas em andamento ficam guardadas em sessionStorage (só nesta aba) para não se
perderem se a página for recarregada.
*/
(function () {
    "use strict";

    // Atividades com o painel aberto: continuam abertas quando a lista é recarregada
    const abertos = new Set();
    // Atividades cujo envio foi automático (o tempo acabou): a tela de "enviada" explica isso
    const enviadasPorTempo = new Set();
    const LETRAS = "ABCDEF";

    // Cria um elemento com texto seguro (textContent evita injeção de HTML)
    function h(tag, classe, texto) {
        const el = document.createElement(tag);
        if (classe) el.className = classe;
        if (texto != null) el.textContent = texto;
        return el;
    }

    const pad = (n) => String(n).padStart(2, "0");
    const pts = (n) => String(Math.round(Number(n) * 100) / 100).replace(".", ",");
    const dataHora = (valor) => (valor ? new Date(valor).toLocaleString("pt-BR") : "");

    function relogio(segundos) {
        const total = Math.max(0, Math.ceil(segundos));
        const horas = Math.floor(total / 3600);
        const minutos = Math.floor((total % 3600) / 60);
        const segs = total % 60;
        return horas > 0 ? horas + ":" + pad(minutos) + ":" + pad(segs) : minutos + ":" + pad(segs);
    }

    function duracao(minutos) {
        if (minutos < 60) return minutos + (minutos === 1 ? " minuto" : " minutos");
        const horas = Math.floor(minutos / 60);
        const resto = minutos % 60;
        return horas + "h" + (resto ? pad(resto) : "") + " (" + minutos + " minutos)";
    }

    // ------------------------------------------------------------ rascunho (só nesta aba)

    const chaveRascunho = (usuarioId, atividadeId) => "conrad:rascunho:" + (usuarioId || "x") + ":" + atividadeId;

    function lerRascunho(usuarioId, atividadeId) {
        try {
            return JSON.parse(sessionStorage.getItem(chaveRascunho(usuarioId, atividadeId))) || {};
        } catch {
            return {};
        }
    }

    function guardarRascunho(usuarioId, atividadeId, dados) {
        try {
            sessionStorage.setItem(chaveRascunho(usuarioId, atividadeId), JSON.stringify(dados));
        } catch {
            // sem armazenamento (aba privada, por exemplo): a tela continua funcionando
        }
    }

    function apagarRascunho(usuarioId, atividadeId) {
        try {
            sessionStorage.removeItem(chaveRascunho(usuarioId, atividadeId));
        } catch {
            // nada a fazer
        }
    }

    // ------------------------------------------------------------ ponto de entrada

    function criarAcoes(a, opcoes) {
        opcoes = opcoes || {};
        const usuarioId = opcoes.usuarioId;
        const aoAtualizar = opcoes.aoAtualizar || function () {};

        const raiz = h("div", "aq");
        const painel = h("div", "aq-painel");
        painel.hidden = true;
        painel.setAttribute("aria-live", "off");

        let relogioId = null;
        let ressincronizar = null;

        function pararRelogio() {
            if (relogioId) clearInterval(relogioId);
            relogioId = null;
            if (ressincronizar) document.removeEventListener("visibilitychange", ressincronizar);
            ressincronizar = null;
        }

        const detalhe = () => conradFetch("/api/aluno/atividades/" + a.id);

        // ---- botão principal (o texto depende do estado que a lista já informou)
        let rotulo;
        if (a.corrigida_em) rotulo = "Ver correção e gabarito";
        else if (a.enviada_em) rotulo = a.tempo_limite_min ? "Ver minhas respostas" : "Ver / atualizar respostas";
        else if (a.tempo_esgotado) rotulo = null;
        else if (a.iniciada) rotulo = "Continuar a atividade";
        else rotulo = a.tempo_limite_min ? "Responder (" + a.tempo_limite_min + " min)" : "Responder";

        if (a.tempo_esgotado && !a.enviada_em) {
            raiz.append(h("p", "aq-aviso erro",
                "O tempo desta atividade acabou e as respostas não foram enviadas. Fale com o seu professor."));
            return raiz;
        }

        const botao = h("button", "btn", rotulo);
        botao.type = "button";
        botao.setAttribute("aria-expanded", "false");

        const acoes = h("div", "acoes");
        acoes.append(botao);
        raiz.append(acoes, painel);

        async function abrir() {
            abertos.add(a.id);
            painel.hidden = false;
            botao.setAttribute("aria-expanded", "true");
            botao.textContent = "Fechar";
            painel.replaceChildren(h("p", "aq-carregando", "Carregando…"));
            try {
                mostrar(await detalhe());
            } catch (erro) {
                painel.replaceChildren(h("p", "msg erro", erro.message));
            }
        }

        function fechar() {
            abertos.delete(a.id);
            painel.hidden = true;
            botao.setAttribute("aria-expanded", "false");
            botao.textContent = rotulo;
        }

        botao.addEventListener("click", () => (painel.hidden ? abrir() : fechar()));

        // ---- escolhe a tela conforme o estado
        function mostrar(d) {
            pararRelogio();
            painel.replaceChildren();
            switch (d.estado) {
                case "nao_iniciada": painel.append(telaInicio(d)); break;
                case "em_andamento": painel.append(telaResponder(d)); break;
                case "enviada":
                    painel.append(d.atividade.tempo_limite_min ? telaEnviadaSomenteLeitura(d) : telaResponder(d));
                    break;
                case "corrigida": painel.append(telaResultado(d)); break;
                case "tempo_esgotado":
                    painel.append(h("p", "aq-aviso erro",
                        "O tempo desta atividade acabou e as respostas não foram enviadas. Fale com o seu professor."));
                    break;
                default:
                    painel.append(h("p", "msg erro", "Não foi possível abrir esta atividade."));
            }
        }

        // ---- 1) antes de começar (só atividades com tempo)
        function telaInicio(d) {
            const caixa = h("div", "aq-inicio");
            caixa.append(h("h4", null, "Antes de começar"));

            const itens = h("ul");
            const minutos = d.atividade.tempo_limite_min;
            const n = d.atividade.total_questoes;
            [
                "Esta atividade tem " + n + (n === 1 ? " questão" : " questões") + " e vale " + pts(d.atividade.valor_maximo) + " pontos.",
                "Você terá " + duracao(minutos) + " para responder.",
                "O tempo começa a contar assim que você clicar em Iniciar e não pausa, mesmo que feche a página.",
                "Só dá para enviar uma vez. Quando o tempo acabar, o que estiver respondido é enviado sozinho."
            ].forEach((texto) => itens.append(h("li", null, texto)));
            caixa.append(itens);

            const iniciar = h("button", "btn", "Iniciar agora");
            iniciar.type = "button";
            const msg = h("span", "msg");
            iniciar.addEventListener("click", async () => {
                iniciar.disabled = true;
                try {
                    mostrar(await conradFetch("/api/atividades/" + a.id + "/iniciar", { method: "POST" }));
                } catch (erro) {
                    msg.className = "msg erro";
                    msg.setAttribute("role", "alert");
                    msg.textContent = erro.message;
                    iniciar.disabled = false;
                }
            });
            const linha = h("div", "acoes");
            linha.append(iniciar, msg);
            caixa.append(linha);
            return caixa;
        }

        // ---- 2) responder (e atualizar, quando a atividade não tem tempo)
        function telaResponder(d) {
            const caixa = h("div", "aq-responder");
            const atividadeId = d.atividade.id;
            const comTempo = d.segundos_restantes != null;
            const jaEnviada = d.estado === "enviada";

            // respostas já gravadas no servidor (atividade enviada) ou rascunho local (em andamento)
            const iniciais = new Map();
            (d.respostas || []).forEach((r) => iniciais.set(r.questao_id, r));
            const rascunho = jaEnviada ? {} : lerRascunho(usuarioId, atividadeId);

            if (jaEnviada) {
                caixa.append(h("p", "aq-aviso ok",
                    "Respostas enviadas em " + dataHora(d.enviada_em) + ". Você pode atualizá-las até o professor corrigir."));
            }

            // cronômetro
            let barra = null;
            let mostrador = null;
            let anuncio = null;
            if (comTempo) {
                barra = h("div", "aq-relogio");
                barra.setAttribute("role", "timer");
                barra.append(h("span", null, "Tempo restante"));
                mostrador = h("strong", null, relogio(d.segundos_restantes));
                barra.append(mostrador);
                anuncio = h("p", "aq-sr");
                anuncio.setAttribute("aria-live", "polite");
                caixa.append(barra, anuncio);
            }

            const formulario = h("form", "aq-form");
            formulario.noValidate = true;
            const cartoes = d.questoes.map((q) => criarCartaoResposta(q, iniciais.get(q.id), rascunho[q.id]));
            cartoes.forEach((c) => formulario.append(c.elemento));

            const aviso = h("p", "aq-aviso");
            aviso.hidden = true;
            const msg = h("span", "msg");
            const enviar = h("button", "btn", jaEnviada ? "Atualizar respostas" : "Enviar respostas");
            enviar.type = "submit";
            const linha = h("div", "acoes");
            linha.append(enviar, msg);
            formulario.append(aviso, linha);
            caixa.append(formulario);

            const lerTudo = () => cartoes.map((c) => c.ler());

            if (!jaEnviada) {
                const guardar = () => {
                    const dados = {};
                    lerTudo().forEach((r) => { dados[r.questao_id] = r; });
                    guardarRascunho(usuarioId, atividadeId, dados);
                };
                formulario.addEventListener("input", guardar);
                formulario.addEventListener("change", guardar);
            }

            let enviando = false;

            async function enviarRespostas(automatico) {
                if (enviando) return;

                if (!automatico) {
                    const embranco = cartoes.filter((c) => !c.respondida()).length;
                    let pergunta = "";
                    if (embranco > 0) pergunta += "Você deixou " + embranco + (embranco === 1 ? " questão" : " questões") + " sem resposta. ";
                    if (comTempo) pergunta += "Depois de enviar, não será possível alterar as respostas. ";
                    if (pergunta && !window.confirm(pergunta + "Enviar mesmo assim?")) return;
                }

                enviando = true;
                enviar.disabled = true;
                msg.className = "msg";
                msg.textContent = "Enviando…";

                try {
                    await conradFetch("/api/atividades/" + atividadeId + "/entrega", {
                        method: "POST",
                        body: JSON.stringify({ respostas: lerTudo() })
                    });
                    apagarRascunho(usuarioId, atividadeId);
                    if (automatico) enviadasPorTempo.add(atividadeId);
                    pararRelogio();
                    await aoAtualizar(); // recarrega a lista; este painel reabre já com o novo estado
                } catch (erro) {
                    enviando = false;
                    enviar.disabled = false;
                    msg.className = "msg erro";
                    msg.setAttribute("role", "alert");
                    msg.textContent = erro.message;
                    if (automatico) enviar.textContent = "Tentar enviar de novo";
                }
            }

            formulario.addEventListener("submit", (evento) => {
                evento.preventDefault();
                enviarRespostas(false);
            });

            // ---- contagem regressiva
            if (comTempo) {
                // performance.now() não anda para trás nem muda se o relógio do computador for alterado
                let fim = performance.now() + d.segundos_restantes * 1000;
                const anunciados = new Set();

                const avisos = [[300, "Restam 5 minutos."], [60, "Resta 1 minuto."], [30, "Restam 30 segundos."]];

                const atualizar = () => {
                    if (!caixa.isConnected) { pararRelogio(); return; }
                    const resta = Math.max(0, (fim - performance.now()) / 1000);
                    mostrador.textContent = relogio(resta);
                    barra.classList.toggle("atencao", resta <= 300 && resta > 60);
                    barra.classList.toggle("urgente", resta <= 60);

                    for (const [limite, texto] of avisos) {
                        if (resta <= limite && !anunciados.has(limite)) {
                            anunciados.add(limite);
                            anuncio.textContent = texto;
                        }
                    }

                    if (resta <= 0) {
                        pararRelogio();
                        formulario.querySelectorAll("input, textarea").forEach((campo) => { campo.disabled = true; });
                        aviso.hidden = false;
                        aviso.className = "aq-aviso erro";
                        aviso.textContent = "Tempo esgotado! Enviando as suas respostas…";
                        anuncio.textContent = "Tempo esgotado. Enviando as respostas.";
                        enviarRespostas(true);
                    }
                };

                // O painel só entra na página depois que esta função devolve o elemento; por isso a
                // primeira conferência é a do intervalo (250 ms depois). O mostrador já nasce com o valor certo.
                relogioId = setInterval(atualizar, 250);

                // Se a aba ficou escondida (ou o computador dormiu), pergunta de novo ao servidor
                ressincronizar = async () => {
                    if (document.visibilityState !== "visible" || !caixa.isConnected || enviando) return;
                    try {
                        const novo = await detalhe();
                        if (novo.estado === "em_andamento" && novo.segundos_restantes != null) {
                            fim = performance.now() + novo.segundos_restantes * 1000;
                        }
                    } catch {
                        // sem internet agora: segue com a contagem local
                    }
                };
                document.addEventListener("visibilitychange", ressincronizar);
            }

            return caixa;
        }

        // ---- 3) enviada, sem poder alterar (atividade com tempo)
        function telaEnviadaSomenteLeitura(d) {
            const caixa = h("div", "aq-resultado");
            const porTempo = enviadasPorTempo.has(d.atividade.id);
            caixa.append(h("p", "aq-aviso ok",
                (porTempo ? "O tempo acabou e as suas respostas foram enviadas automaticamente. " : "") +
                "Respostas enviadas em " + dataHora(d.enviada_em) + ". Aguarde a correção do professor."));

            const dadas = new Map((d.respostas || []).map((r) => [r.questao_id, r]));
            d.questoes.forEach((q) => {
                const r = dadas.get(q.id) || {};
                const bloco = h("section", "aq-questao-res");
                bloco.append(cabecalhoQuestao(q, null), h("p", "aq-texto", q.enunciado));
                if (q.tipo === "objetiva") {
                    bloco.append(listaAlternativas(q, r.alternativa, null));
                } else {
                    bloco.append(caixaResposta(r.resposta));
                }
                caixa.append(bloco);
            });
            return caixa;
        }

        // ---- 4) corrigida: nota, gabarito e comentários
        function telaResultado(d) {
            // A nota total e o feedback geral já aparecem no card da página; aqui vai o detalhe por questão.
            const caixa = h("div", "aq-resultado");

            d.questoes.forEach((q) => {
                const bloco = h("section", "aq-questao-res");
                bloco.append(cabecalhoQuestao(q, q.pontos_obtidos), h("p", "aq-texto", q.enunciado));
                if (q.tipo === "objetiva") {
                    bloco.append(listaAlternativas(q, q.alternativa, q.correta));
                } else {
                    bloco.append(caixaResposta(q.resposta));
                }
                if (q.comentario) bloco.append(h("p", "aq-comentario", "Comentário do professor: " + q.comentario));
                caixa.append(bloco);
            });
            return caixa;
        }

        // abre sozinho se estava aberto antes de a lista ser recarregada
        if (abertos.has(a.id)) abrir();

        return raiz;
    }

    // ------------------------------------------------------------ peças de tela

    function cabecalhoQuestao(q, obtidos) {
        const topo = h("div", "aq-questao-topo");
        topo.append(h("strong", null, "Questão " + q.ordem));
        topo.append(h("span", "aq-tipo", q.tipo === "objetiva" ? "Objetiva" : "Discursiva"));
        const valor = obtidos == null
            ? "vale " + pts(q.pontos) + (Number(q.pontos) === 1 ? " ponto" : " pontos")
            : pts(obtidos) + " / " + pts(q.pontos) + " pts";
        topo.append(h("span", "aq-pts", valor));
        return topo;
    }

    function caixaResposta(texto) {
        if (!texto) return h("p", "aq-branco", "Em branco.");
        return h("div", "resposta-enviada", texto);
    }

    // Lista de alternativas para leitura. `correta` é null quando o gabarito ainda não pode aparecer.
    function listaAlternativas(q, marcada, correta) {
        const lista = h("ul", "aq-alts");
        q.alternativas.forEach((texto, i) => {
            const item = h("li", "aq-alt-res");
            const sua = marcada === i;
            const certa = correta != null && correta === i;
            if (sua) item.classList.add("marcada");
            if (certa) item.classList.add("certa");
            else if (sua && correta != null) item.classList.add("errada");

            item.append(h("span", "aq-letra", LETRAS[i] + ")"), h("span", "aq-alt-texto", texto));
            if (sua) item.append(h("span", "aq-etiqueta", "Sua resposta"));
            if (certa) item.append(h("span", "aq-etiqueta certa", "Resposta correta"));
            lista.append(item);
        });
        const caixa = h("div");
        caixa.append(lista);
        if (marcada == null) caixa.append(h("p", "aq-branco", "Você não marcou nenhuma alternativa."));
        return caixa;
    }

    // Uma questão para responder. Devolve { elemento, ler(), respondida() }
    function criarCartaoResposta(q, salva, rascunho) {
        const bloco = h("section", "aq-questao");
        bloco.append(cabecalhoQuestao(q, null));

        const idEnunciado = "aq-enunciado-" + q.id;
        const enunciado = h("p", "aq-texto", q.enunciado);
        enunciado.id = idEnunciado;
        bloco.append(enunciado);

        // o rascunho local (se existir) tem prioridade sobre o que veio do servidor
        const base = rascunho || salva || {};

        if (q.tipo === "objetiva") {
            const grupo = h("div", "aq-opcoes");
            grupo.setAttribute("role", "radiogroup");
            grupo.setAttribute("aria-labelledby", idEnunciado);

            const radios = q.alternativas.map((texto, i) => {
                const rotulo = h("label", "aq-opcao");
                const radio = h("input");
                radio.type = "radio";
                radio.name = "aq-q" + q.id;
                radio.value = String(i);
                radio.checked = base.alternativa === i;
                rotulo.append(radio, h("span", "aq-letra", LETRAS[i] + ")"), h("span", "aq-alt-texto", texto));
                grupo.append(rotulo);
                return radio;
            });
            bloco.append(grupo);

            const marcada = () => {
                const i = radios.findIndex((r) => r.checked);
                return i === -1 ? null : i;
            };
            return {
                elemento: bloco,
                ler: () => ({ questao_id: q.id, alternativa: marcada() }),
                respondida: () => marcada() !== null
            };
        }

        const campo = h("textarea");
        campo.id = "aq-resposta-" + q.id;
        campo.maxLength = 5000;
        campo.rows = 5;
        campo.placeholder = "Escreva aqui a sua resposta…";
        campo.setAttribute("aria-labelledby", idEnunciado);
        campo.value = base.resposta || "";
        bloco.append(campo);

        return {
            elemento: bloco,
            ler: () => ({ questao_id: q.id, resposta: campo.value }),
            respondida: () => campo.value.trim() !== ""
        };
    }

    window.AlunoQuestoes = { criarAcoes };
})();