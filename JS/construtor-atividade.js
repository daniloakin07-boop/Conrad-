/*
===============================================
CONSTRUTOR DE QUESTÕES  (nova-atividade.html e nova-avaliacao.html)
===============================================
Cuida de TODO o formulário de criação: monta a área de questões e do tempo limite,
confere os campos e envia para POST /api/atividades.

Cada página só precisa definir, antes de carregar este script:
    window.ATIVIDADE_TIPO   = "atividade"  (ou "avaliacao")
    window.ATIVIDADE_ROTULO = "atividade"  (ou "avaliação")   <- usado na mensagem de sucesso

O que o professor controla:
  - quantas questões a atividade tem (e dá para mudar a ordem e remover);
  - como cada uma é feita: objetiva (o aluno marca UMA alternativa, de 2 a 6) ou
    discursiva (o aluno escreve) — dá para misturar;
  - se a atividade tem tempo limite (em minutos);
  - quanto vale cada questão. O "Valor" da atividade vira a soma das questões.

Sem nenhuma questão, tudo funciona como antes: um único campo de texto para o aluno
e uma nota só.

As regras abaixo espelham as do servidor (JS/questoes.js). O servidor confere tudo de novo.
*/
(function () {
    "use strict";

    const TIPO = window.ATIVIDADE_TIPO === "avaliacao" ? "avaliacao" : "atividade";
    const ROTULO = window.ATIVIDADE_ROTULO || (TIPO === "avaliacao" ? "avaliação" : "atividade");

    const MAX_QUESTOES = 50;
    const MIN_ALTERNATIVAS = 2;
    const MAX_ALTERNATIVAS = 6;
    const ALTERNATIVAS_INICIAIS = 4;
    const MAX_TEMPO_MIN = 600;
    const MAX_PONTOS = 1000;
    const LETRAS = "ABCDEF";

    const form = document.querySelector("form");
    if (!form) return;

    const campoValor = document.getElementById("valor");
    const rodapeForm = form.querySelector(".actions");

    // ---------------------------------------------------------------- utilidades

    // Cria um elemento com texto seguro (textContent evita injeção de HTML)
    function h(tag, classe, texto) {
        const el = document.createElement(tag);
        if (classe) el.className = classe;
        if (texto != null) el.textContent = texto;
        return el;
    }

    function botao(texto, classe, aoClicar, rotuloAcessivel) {
        const b = h("button", classe, texto);
        b.type = "button";
        if (rotuloAcessivel) b.setAttribute("aria-label", rotuloAcessivel);
        b.addEventListener("click", aoClicar);
        return b;
    }

    const arredondar = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
    const numero = (valor) => (valor === "" || valor == null ? NaN : Number(valor));
    const pts = (n) => String(arredondar(n)).replace(".", ",");

    // Divide `total` em `n` partes iguais, em centavos, sem sobrar nem faltar (a sobra vai para as últimas)
    function dividir(total, n) {
        const centavos = Math.round(total * 100);
        const base = Math.floor(centavos / n);
        const resto = centavos - base * n;
        return Array.from({ length: n }, (_, i) => (base + (i >= n - resto ? 1 : 0)) / 100);
    }

    // ---------------------------------------------------------------- estado

    let proximoId = 1;
    const questoes = []; // { uid, tipo, enunciado, pontos, alternativas: string[], correta: number|null }
    let totalBase = Number(campoValor && campoValor.value) || 10; // valor a repartir quando as notas são automáticas
    let manual = false; // verdadeiro depois que o professor mexe no valor de alguma questão
    let salvo = false;

    function novaQuestao(tipo) {
        return {
            uid: proximoId++,
            tipo,
            enunciado: "",
            pontos: 1,
            alternativas: tipo === "objetiva" ? Array(ALTERNATIVAS_INICIAIS).fill("") : [],
            correta: null
        };
    }

    const somar = () => arredondar(questoes.reduce((soma, q) => soma + (Number(q.pontos) || 0), 0));

    // ---------------------------------------------------------------- estrutura da página

    const bloco = h("section", "qb");
    bloco.setAttribute("aria-labelledby", "qb-titulo");

    bloco.append(
        Object.assign(h("h3", "qb-titulo", "Questões e tempo"), { id: "qb-titulo" }),
        h("p", "qb-ajuda",
            "Monte as questões aqui. Se não adicionar nenhuma, o aluno responde em um único campo de texto " +
            "e você dá uma nota só.")
    );

    // --- Tempo limite
    const usaTempo = h("input");
    usaTempo.type = "checkbox";
    usaTempo.id = "qb-usa-tempo";

    const campoTempo = h("input");
    campoTempo.type = "number";
    campoTempo.id = "qb-tempo";
    campoTempo.min = "1";
    campoTempo.max = String(MAX_TEMPO_MIN);
    campoTempo.step = "1";
    campoTempo.value = "30";
    campoTempo.setAttribute("aria-label", "Tempo limite em minutos");

    const rotuloUsaTempo = h("label", "qb-check");
    rotuloUsaTempo.htmlFor = usaTempo.id;
    rotuloUsaTempo.append(usaTempo, h("span", null, "Definir tempo limite"));

    const linhaTempo = h("div", "qb-tempo-valor");
    linhaTempo.hidden = true;
    linhaTempo.append(campoTempo, h("span", null, "minutos"));

    const ajudaTempo = h("p", "qb-ajuda",
        "O cronômetro começa quando o aluno clica em Iniciar e não pausa (nem se ele fechar a página). " +
        "Quando zera, as respostas são enviadas sozinhas, e só dá para enviar uma vez.");
    ajudaTempo.hidden = true;

    const caixaTempo = h("div", "qb-tempo");
    caixaTempo.append(rotuloUsaTempo, linhaTempo, ajudaTempo);

    usaTempo.addEventListener("change", () => {
        linhaTempo.hidden = !usaTempo.checked;
        ajudaTempo.hidden = !usaTempo.checked;
        if (usaTempo.checked) campoTempo.focus();
    });

    // --- Adicionar questões
    const campoQuantidade = h("input");
    campoQuantidade.type = "number";
    campoQuantidade.id = "qb-quantidade";
    campoQuantidade.min = "1";
    campoQuantidade.max = String(MAX_QUESTOES);
    campoQuantidade.value = "1";

    const campoTipo = h("select");
    campoTipo.id = "qb-tipo-novo";
    [["objetiva", "Objetiva (de marcar)"], ["discursiva", "Discursiva (de escrever)"]].forEach(([valor, texto]) => {
        const opcao = h("option", null, texto);
        opcao.value = valor;
        campoTipo.append(opcao);
    });

    const botaoAdicionar = botao("Adicionar", "qb-adicionar-botao", () => {
        const pedido = Math.floor(numero(campoQuantidade.value));
        if (!Number.isFinite(pedido) || pedido < 1) {
            mensagem("Digite quantas questões quer adicionar (1 ou mais).", "erro");
            campoQuantidade.focus();
            return;
        }
        const cabem = MAX_QUESTOES - questoes.length;
        if (cabem <= 0) {
            mensagem("Uma atividade pode ter no máximo " + MAX_QUESTOES + " questões.", "erro");
            return;
        }
        const quantidade = Math.min(pedido, cabem);
        if (quantidade < pedido) {
            mensagem("Só cabem mais " + cabem + " questões (máximo de " + MAX_QUESTOES + "). Adicionei " + cabem + ".", "erro");
        } else {
            mensagem("");
        }

        const primeira = proximoId;
        if (questoes.length === 0) {
            manual = false;
            if (campoValor) totalBase = numero(campoValor.value) > 0 ? numero(campoValor.value) : 10;
        }
        for (let i = 0; i < quantidade; i++) questoes.push(novaQuestao(campoTipo.value));
        redistribuir();
        render('[data-uid="' + primeira + '"] [data-campo="enunciado"]');
    });

    const rotuloQuantidade = h("label", null, "Quantas questões?");
    rotuloQuantidade.htmlFor = campoQuantidade.id;
    const rotuloTipo = h("label", null, "Como é feita?");
    rotuloTipo.htmlFor = campoTipo.id;

    const linhaAdicionar = h("div", "qb-adicionar");
    const gQuantidade = h("div", "qb-grupo");
    gQuantidade.append(rotuloQuantidade, campoQuantidade);
    const gTipo = h("div", "qb-grupo");
    gTipo.append(rotuloTipo, campoTipo);
    linhaAdicionar.append(gQuantidade, gTipo, botaoAdicionar);

    // --- Lista de questões e resumo
    const vazio = h("p", "qb-vazio", "Nenhuma questão ainda. Escolha a quantidade e o tipo acima e clique em Adicionar.");
    const lista = h("div", "qb-lista");
    const resumo = h("div", "qb-resumo");
    const textoResumo = h("span");
    const botaoDividir = botao("Dividir o valor igualmente", "qb-link", () => {
        totalBase = somar();
        manual = false;
        redistribuir();
        atualizarPontosNaTela();
        atualizarResumo();
    });
    resumo.append(textoResumo, botaoDividir);

    bloco.append(caixaTempo, linhaAdicionar, vazio, lista, resumo);

    // --- Mensagem do formulário (erros e sucesso)
    const caixaMensagem = h("p", "qb-msg");
    caixaMensagem.hidden = true;

    function mensagem(texto, tipo, link) {
        caixaMensagem.className = "qb-msg" + (tipo ? " " + tipo : "");
        caixaMensagem.setAttribute("role", tipo === "erro" ? "alert" : "status");
        caixaMensagem.replaceChildren(texto || "");
        if (link) {
            const a = h("a", null, link.texto);
            a.href = link.href;
            caixaMensagem.append(" ", a);
        }
        caixaMensagem.hidden = !texto;
    }

    if (rodapeForm) {
        form.insertBefore(bloco, rodapeForm);
        form.insertBefore(caixaMensagem, rodapeForm);
    } else {
        form.append(bloco, caixaMensagem);
    }

    // ---------------------------------------------------------------- pontuação

    // Enquanto o professor não mexe no valor de nenhuma questão, o valor total é repartido igualmente
    function redistribuir() {
        if (questoes.length === 0) return;
        if (manual) {
            // modo manual: questões novas valem 1 ponto e o total é a soma
            questoes.forEach((q) => {
                if (q.pontos === "" || q.pontos == null) q.pontos = 1;
            });
        } else {
            const partes = dividir(totalBase, questoes.length);
            questoes.forEach((q, i) => { q.pontos = partes[i]; });
        }
        atualizarTotal();
    }

    function atualizarTotal() {
        if (!campoValor || questoes.length === 0) return;
        if (document.activeElement === campoValor) return; // não escreve por cima de quem está digitando
        campoValor.value = String(somar());
    }

    function atualizarPontosNaTela() {
        questoes.forEach((q) => {
            const campo = lista.querySelector('[data-uid="' + q.uid + '"] [data-campo="pontos"]');
            if (campo) campo.value = q.pontos;
        });
        atualizarTotal();
    }

    function atualizarResumo() {
        const n = questoes.length;
        resumo.hidden = n === 0;
        vazio.hidden = n > 0;
        if (n === 0) return;
        const objetivas = questoes.filter((q) => q.tipo === "objetiva").length;
        const discursivas = n - objetivas;
        const partes = [];
        if (objetivas) partes.push(objetivas + (objetivas === 1 ? " objetiva" : " objetivas"));
        if (discursivas) partes.push(discursivas + (discursivas === 1 ? " discursiva" : " discursivas"));
        textoResumo.textContent =
            n + (n === 1 ? " questão" : " questões") + " (" + partes.join(", ") + ") • Valor total: " + pts(somar()) + " pts";
        botaoDividir.hidden = !manual;
    }

    // O campo "Valor" da página: com questões, mudar o valor divide igualmente entre elas
    if (campoValor) {
        campoValor.step = "any";
        campoValor.min = "0.01";
        campoValor.addEventListener("input", () => {
            if (questoes.length === 0) return;
            const novo = numero(campoValor.value);
            if (!(novo > 0)) return;
            totalBase = novo;
            manual = false;
            redistribuir();
            atualizarPontosNaTela();
            atualizarResumo();
        });
        campoValor.addEventListener("blur", () => {
            atualizarTotal();
        });
    }

    // ---------------------------------------------------------------- desenho das questões

    function render(seletorFoco) {
        lista.replaceChildren(...questoes.map(criarCartao));
        atualizarResumo();
        atualizarTotal();
        if (seletorFoco) {
            const alvo = lista.querySelector(seletorFoco);
            if (alvo) alvo.focus();
        }
    }

    function mover(indice, delta, campoFoco) {
        const destino = indice + delta;
        if (destino < 0 || destino >= questoes.length) return;
        const [q] = questoes.splice(indice, 1);
        questoes.splice(destino, 0, q);
        // o botão que acabou de ser usado fica desativado no começo/fim da lista: foca o outro
        if (destino === 0 && campoFoco === "subir") campoFoco = "descer";
        if (destino === questoes.length - 1 && campoFoco === "descer") campoFoco = "subir";
        render('[data-uid="' + q.uid + '"] [data-campo="' + campoFoco + '"]');
    }

    function remover(indice) {
        questoes.splice(indice, 1);
        if (questoes.length === 0) manual = false;
        if (!manual) redistribuir();
        const vizinha = questoes[Math.min(indice, questoes.length - 1)];
        render(vizinha ? '[data-uid="' + vizinha.uid + '"] [data-campo="enunciado"]' : "#qb-quantidade");
        mensagem("");
    }

    function rotulado(texto, controle, classe) {
        const rotulo = h("label", classe, texto);
        rotulo.htmlFor = controle.id;
        return rotulo;
    }

    function criarCartao(q, indice) {
        const cartao = h("article", "qb-questao");
        cartao.dataset.uid = q.uid;
        const id = (campo) => "q" + q.uid + "-" + campo;

        // --- cabeçalho: número, tipo, valor e ações
        const topo = h("div", "qb-questao-topo");
        topo.append(h("strong", "qb-num", "Questão " + (indice + 1)));

        const tipo = h("select");
        tipo.id = id("tipo");
        tipo.dataset.campo = "tipo";
        [["objetiva", "Objetiva (de marcar)"], ["discursiva", "Discursiva (de escrever)"]].forEach(([valor, texto]) => {
            const opcao = h("option", null, texto);
            opcao.value = valor;
            tipo.append(opcao);
        });
        tipo.value = q.tipo;
        tipo.addEventListener("change", () => {
            q.tipo = tipo.value;
            if (q.tipo === "objetiva" && q.alternativas.length === 0) q.alternativas = Array(ALTERNATIVAS_INICIAIS).fill("");
            render('[data-uid="' + q.uid + '"] [data-campo="tipo"]');
        });

        const pontos = h("input");
        pontos.type = "number";
        pontos.id = id("pontos");
        pontos.dataset.campo = "pontos";
        pontos.min = "0.01";
        pontos.max = String(MAX_PONTOS);
        pontos.step = "any";
        pontos.value = q.pontos;
        pontos.addEventListener("input", () => {
            q.pontos = pontos.value === "" ? "" : Number(pontos.value);
            manual = true;
            atualizarTotal();
            atualizarResumo();
        });

        const acoes = h("div", "qb-acoes");
        const subir = botao("↑", "qb-icone", () => mover(indice, -1, "subir"), "Mover a questão " + (indice + 1) + " para cima");
        subir.dataset.campo = "subir";
        subir.disabled = indice === 0;
        const descer = botao("↓", "qb-icone", () => mover(indice, 1, "descer"), "Mover a questão " + (indice + 1) + " para baixo");
        descer.dataset.campo = "descer";
        descer.disabled = indice === questoes.length - 1;
        const excluir = botao("Remover", "qb-icone qb-remover", () => remover(indice), "Remover a questão " + (indice + 1));
        acoes.append(subir, descer, excluir);

        const gTipo = h("div", "qb-grupo");
        gTipo.append(rotulado("Como é feita?", tipo), tipo);
        const gPontos = h("div", "qb-grupo qb-grupo-pontos");
        gPontos.append(rotulado("Valor (pts)", pontos), pontos);
        topo.append(gTipo, gPontos, acoes);

        // --- enunciado
        const enunciado = h("textarea");
        enunciado.id = id("enunciado");
        enunciado.dataset.campo = "enunciado";
        enunciado.maxLength = 2000;
        enunciado.rows = 3;
        enunciado.placeholder = "Escreva o enunciado da questão…";
        enunciado.value = q.enunciado;
        enunciado.addEventListener("input", () => { q.enunciado = enunciado.value; });

        const gEnunciado = h("div", "qb-grupo qb-enunciado");
        gEnunciado.append(rotulado("Enunciado", enunciado), enunciado);

        cartao.append(topo, gEnunciado);

        // --- resposta esperada
        if (q.tipo === "objetiva") {
            cartao.append(criarAlternativas(q, cartao));
        } else {
            cartao.append(h("p", "qb-ajuda",
                "O aluno escreve a resposta. Você dá a nota (de 0 até o valor da questão) depois, na correção."));
        }
        return cartao;
    }

    function criarAlternativas(q) {
        const caixa = h("div", "qb-alternativas");
        caixa.append(h("p", "qb-ajuda", "Escreva as alternativas e marque a bolinha ao lado da correta (só uma vale)."));

        q.alternativas.forEach((texto, i) => {
            const linha = h("div", "qb-alt");

            const radio = h("input");
            radio.type = "radio";
            radio.name = "correta-" + q.uid;
            radio.checked = q.correta === i;
            radio.dataset.campo = "correta-" + i;
            radio.setAttribute("aria-label", "A alternativa " + LETRAS[i] + " é a correta");
            radio.addEventListener("change", () => { q.correta = i; });

            const campo = h("input");
            campo.type = "text";
            campo.maxLength = 300;
            campo.value = texto;
            campo.placeholder = "Alternativa " + LETRAS[i];
            campo.dataset.campo = "alt-" + i;
            campo.setAttribute("aria-label", "Texto da alternativa " + LETRAS[i]);
            campo.addEventListener("input", () => { q.alternativas[i] = campo.value; });

            const tirar = botao("✕", "qb-icone", () => {
                q.alternativas.splice(i, 1);
                if (q.correta === i) q.correta = null;
                else if (q.correta !== null && q.correta > i) q.correta -= 1;
                render('[data-uid="' + q.uid + '"] [data-campo="alt-' + Math.min(i, q.alternativas.length - 1) + '"]');
            }, "Remover a alternativa " + LETRAS[i]);
            tirar.disabled = q.alternativas.length <= MIN_ALTERNATIVAS;

            linha.append(radio, h("span", "qb-letra", LETRAS[i] + ")"), campo, tirar);
            caixa.append(linha);
        });

        const mais = botao("+ Adicionar alternativa", "qb-link", () => {
            q.alternativas.push("");
            render('[data-uid="' + q.uid + '"] [data-campo="alt-' + (q.alternativas.length - 1) + '"]');
        });
        mais.disabled = q.alternativas.length >= MAX_ALTERNATIVAS;
        caixa.append(mais);
        return caixa;
    }

    // Tirar o destaque de erro assim que a pessoa mexe na questão
    lista.addEventListener("input", (e) => {
        const cartao = e.target.closest && e.target.closest(".qb-questao");
        if (cartao) cartao.classList.remove("qb-invalida");
    });
    lista.addEventListener("change", (e) => {
        const cartao = e.target.closest && e.target.closest(".qb-questao");
        if (cartao) cartao.classList.remove("qb-invalida");
    });

    // ---------------------------------------------------------------- conferência antes de enviar

    // Devolve null se está tudo certo, ou { texto, campo, cartao } com o primeiro problema encontrado
    function validar() {
        if (usaTempo.checked) {
            const minutos = numero(campoTempo.value);
            if (!Number.isInteger(minutos) || minutos < 1 || minutos > MAX_TEMPO_MIN) {
                return { texto: "O tempo limite deve ser um número inteiro de minutos entre 1 e " + MAX_TEMPO_MIN + ".", campo: campoTempo };
            }
            if (questoes.length === 0) {
                return { texto: "Para definir um tempo limite, adicione pelo menos uma questão.", campo: campoQuantidade };
            }
        }

        for (let i = 0; i < questoes.length; i++) {
            const q = questoes[i];
            const rotulo = "Questão " + (i + 1) + ": ";
            const cartao = lista.querySelector('[data-uid="' + q.uid + '"]');
            const achar = (campo) => cartao && cartao.querySelector('[data-campo="' + campo + '"]');

            if (!q.enunciado.trim()) return { texto: rotulo + "escreva o enunciado.", campo: achar("enunciado"), cartao };

            const valor = Number(q.pontos);
            if (q.pontos === "" || !Number.isFinite(valor) || valor <= 0 || valor > MAX_PONTOS) {
                return { texto: rotulo + "o valor deve ser maior que zero e no máximo " + MAX_PONTOS + ".", campo: achar("pontos"), cartao };
            }

            if (q.tipo === "objetiva") {
                const textos = q.alternativas.map((a) => a.trim());
                const vazia = textos.findIndex((a) => !a);
                if (vazia !== -1) {
                    return { texto: rotulo + "preencha a alternativa " + LETRAS[vazia] + " (ou remova as que não vai usar).", campo: achar("alt-" + vazia), cartao };
                }
                const vistas = new Map();
                for (let j = 0; j < textos.length; j++) {
                    const chave = textos[j].toLowerCase();
                    if (vistas.has(chave)) {
                        return { texto: rotulo + "as alternativas " + LETRAS[vistas.get(chave)] + " e " + LETRAS[j] + " são iguais.", campo: achar("alt-" + j), cartao };
                    }
                    vistas.set(chave, j);
                }
                if (q.correta === null || q.correta < 0 || q.correta >= textos.length) {
                    return { texto: rotulo + "marque qual alternativa é a correta.", campo: achar("correta-0"), cartao };
                }
            }
        }
        return null;
    }

    function montarQuestoes() {
        return questoes.map((q) => {
            const base = { tipo: q.tipo, enunciado: q.enunciado.trim(), pontos: Number(q.pontos) };
            if (q.tipo === "objetiva") {
                base.alternativas = q.alternativas.map((a) => a.trim());
                base.correta = q.correta;
            }
            return base;
        });
    }

    // ---------------------------------------------------------------- enviar

    form.addEventListener("submit", async function (evento) {
        evento.preventDefault();
        mensagem("");

        const titulo = document.getElementById("titulo");
        const data = document.getElementById("data");
        const descricao = document.getElementById("descricao");

        const faltando = [titulo, data, descricao].find((campo) => !campo.value.trim());
        if (faltando) {
            mensagem("Preencha o nome, a data e a descrição.", "erro");
            faltando.focus();
            return;
        }

        const temQuestoes = questoes.length > 0;
        if (!temQuestoes && !(numero(campoValor.value) > 0)) {
            mensagem("Informe um valor/pontuação maior que zero.", "erro");
            campoValor.focus();
            return;
        }

        const problema = validar();
        if (problema) {
            mensagem(problema.texto, "erro");
            if (problema.cartao) {
                problema.cartao.classList.add("qb-invalida");
                problema.cartao.scrollIntoView({ block: "center" });
            }
            if (problema.campo) problema.campo.focus();
            return;
        }

        const dados = {
            titulo: titulo.value.trim(),
            turma: document.getElementById("turma").value,
            disciplina: document.getElementById("disciplina").value,
            data_aplicacao: data.value,
            valor_maximo: temQuestoes ? somar() : Number(campoValor.value),
            descricao: descricao.value.trim(),
            tipo: TIPO,
            tempo_limite_min: usaTempo.checked ? Number(campoTempo.value) : null,
            questoes: montarQuestoes()
        };

        const enviar = form.querySelector('[type="submit"]');
        enviar.disabled = true;

        try {
            const resposta = await conradFetch("/api/atividades", {
                method: "POST",
                body: JSON.stringify(dados)
            });
            salvo = true;

            const detalhe = temQuestoes
                ? " (" + resposta.total_questoes + (resposta.total_questoes === 1 ? " questão" : " questões") +
                  (dados.tempo_limite_min ? ", " + dados.tempo_limite_min + " min" : "") + ")"
                : "";
            mensagem("Sua " + ROTULO + detalhe + " foi publicada e já aparece para os alunos da turma!", "ok",
                { texto: "Ver atividades e entregas", href: "professor-correcao.html" });

            form.reset();
            questoes.length = 0;
            manual = false;
            totalBase = 10;
            campoValor.value = 10;
            usaTempo.checked = false;
            linhaTempo.hidden = true;
            ajudaTempo.hidden = true;
            campoTempo.value = "30";
            render();
            caixaMensagem.scrollIntoView({ block: "center" });
        } catch (erro) {
            mensagem(erro.message, "erro");
        } finally {
            enviar.disabled = false;
        }
    });

    // "Cancelar" não fazia nada: agora volta para o painel
    const cancelar = form.querySelector('.actions button[type="button"]');
    if (cancelar) {
        cancelar.addEventListener("click", () => { location.href = "educador.html"; });
    }

    // Evita perder uma lista grande de questões por um clique sem querer em outro link
    window.addEventListener("beforeunload", (evento) => {
        if (questoes.length > 0 && !salvo) {
            evento.preventDefault();
            evento.returnValue = "";
        }
    });

    form.addEventListener("input", () => { salvo = false; });

    render();
})();
