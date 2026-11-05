/*
===============================================
CORREÇÃO POR QUESTÃO — LADO DO PROFESSOR  (professor-correcao.html)
===============================================
Para atividades que têm questões, a página chama:

    CorrecaoQuestoes.criarEntrega(entrega, dados, aoSalvar)

    entrega: um item de `entregas` de GET /api/atividades/:id/entregas (com `respostas`)
    dados:   a resposta inteira dessa rota ({ valor_maximo, questoes, ... })
    aoSalvar: função chamada depois que a correção é salva

O professor vê, questão por questão, o que o aluno respondeu:
  - objetiva: a alternativa marcada e o gabarito. A nota já vem calculada, mas dá para ajustar;
  - discursiva: o texto do aluno, a nota (de 0 até o valor da questão) e um comentário opcional.
A nota total é a soma das notas das questões e aparece atualizada enquanto o professor digita.
Salvar envia PUT /api/entregas/:id/correcao com { respostas: [...], feedback }.
*/
(function () {
    "use strict";

    const LETRAS = "ABCDEF";

    // Cria um elemento com texto seguro (textContent evita injeção de HTML)
    function h(tag, classe, texto) {
        const el = document.createElement(tag);
        if (classe) el.className = classe;
        if (texto != null) el.textContent = texto;
        return el;
    }

    const arredondar = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
    const pts = (n) => String(arredondar(n)).replace(".", ",");

    let contador = 0;

    function criarEntrega(entrega, dados, aoSalvar) {
        const sufixo = "e" + entrega.id + "-" + ++contador;
        const valorMaximo = Number(dados.valor_maximo);
        const respostas = new Map((entrega.respostas || []).map((r) => [r.questao_id, r]));

        const caixa = h("details", "cq-entrega");
        caixa.open = !entrega.corrigida_em;

        // ---- resumo (sempre visível)
        const selo = h("span", "cq-selo");
        const resumo = h("summary", "cq-resumo");
        resumo.append(
            h("strong", null, entrega.aluno),
            h("span", "cq-data", "Enviada em " + new Date(entrega.enviada_em).toLocaleString("pt-BR")),
            selo
        );
        caixa.append(resumo);

        function marcarSelo(corrigida, nota) {
            selo.className = "cq-selo " + (corrigida ? "corrigida" : "aguardando");
            selo.textContent = corrigida
                ? "Corrigida: " + pts(nota) + " / " + pts(valorMaximo)
                : "Aguardando correção";
        }
        marcarSelo(!!entrega.corrigida_em, entrega.nota);

        const corpo = h("div", "cq-corpo");
        caixa.append(corpo);

        // ---- uma seção por questão
        const itens = dados.questoes.map((q) => {
            const r = respostas.get(q.id) || {};
            const bloco = h("section", "cq-questao");

            const topo = h("div", "cq-questao-topo");
            topo.append(
                h("strong", null, "Questão " + q.ordem),
                h("span", "cq-tipo", q.tipo === "objetiva" ? "Objetiva" : "Discursiva"),
                h("span", "cq-valor", "vale " + pts(q.pontos) + (Number(q.pontos) === 1 ? " ponto" : " pontos"))
            );
            bloco.append(topo, h("p", "cq-enunciado", q.enunciado));

            if (q.tipo === "objetiva") {
                const lista = h("ul", "cq-alts");
                q.alternativas.forEach((texto, i) => {
                    const item = h("li", "cq-alt");
                    const marcada = r.alternativa === i;
                    const certa = q.correta === i;
                    if (certa) item.classList.add("certa");
                    if (marcada && !certa) item.classList.add("errada");
                    item.append(h("span", "cq-letra", LETRAS[i] + ")"), h("span", "cq-alt-texto", texto));
                    if (marcada) item.append(h("span", "cq-etiqueta", "Resposta do aluno"));
                    if (certa) item.append(h("span", "cq-etiqueta certa", "Gabarito"));
                    lista.append(item);
                });
                bloco.append(lista);
                if (r.alternativa == null) bloco.append(h("p", "cq-branco", "O aluno não marcou nenhuma alternativa."));
            } else if (r.resposta) {
                bloco.append(h("div", "resposta", r.resposta));
            } else {
                bloco.append(h("p", "cq-branco", "O aluno deixou esta questão em branco."));
            }

            // ---- nota (e comentário, nas discursivas)
            const campoNota = h("input");
            campoNota.type = "number";
            campoNota.id = "cq-nota-" + sufixo + "-" + q.id;
            campoNota.min = "0";
            campoNota.max = String(Number(q.pontos));
            campoNota.step = "any";
            if (r.pontos != null) campoNota.value = r.pontos;

            const rotuloNota = h("label", null, "Nota (0 a " + pts(q.pontos) + ")");
            rotuloNota.htmlFor = campoNota.id;

            const grupoNota = h("div", "cq-nota");
            grupoNota.append(rotuloNota, campoNota);

            let campoComentario = null;
            if (q.tipo === "discursiva") {
                const maxima = h("button", "cq-rapido", "Nota máxima");
                maxima.type = "button";
                maxima.addEventListener("click", () => { campoNota.value = Number(q.pontos); campoNota.dispatchEvent(new Event("input")); });
                const zero = h("button", "cq-rapido", "Zero");
                zero.type = "button";
                zero.addEventListener("click", () => { campoNota.value = 0; campoNota.dispatchEvent(new Event("input")); });
                const rapidos = h("div", "cq-rapidos");
                rapidos.append(maxima, zero);
                grupoNota.append(rapidos);

                campoComentario = h("textarea");
                campoComentario.id = "cq-comentario-" + sufixo + "-" + q.id;
                campoComentario.maxLength = 1000;
                campoComentario.rows = 2;
                campoComentario.placeholder = "Comentário sobre esta resposta (opcional)";
                campoComentario.value = r.comentario || "";
                const rotuloComentario = h("label", null, "Comentário");
                rotuloComentario.htmlFor = campoComentario.id;
                const grupoComentario = h("div", "cq-comentario");
                grupoComentario.append(rotuloComentario, campoComentario);

                const linha = h("div", "cq-linha-nota");
                linha.append(grupoNota, grupoComentario);
                bloco.append(linha);
            } else {
                bloco.append(grupoNota);
            }

            corpo.append(bloco);
            return { q, campoNota, campoComentario, bloco };
        });

        // ---- total ao vivo
        const total = h("p", "cq-total");
        function atualizarTotal() {
            let soma = 0;
            let faltam = 0;
            itens.forEach((item) => {
                const valor = item.campoNota.value === "" ? NaN : Number(item.campoNota.value);
                if (Number.isFinite(valor)) soma += valor;
                else if (item.q.tipo === "discursiva") faltam++;
            });
            const forte = h("strong", null, pts(soma));
            total.replaceChildren("Nota total: ", forte, " / " + pts(valorMaximo));
            if (faltam > 0) {
                total.append(h("span", "cq-falta", " • " + faltam + (faltam === 1 ? " questão discursiva sem nota" : " questões discursivas sem nota")));
            }
        }
        itens.forEach((item) => {
            item.campoNota.addEventListener("input", () => {
                item.bloco.classList.remove("cq-invalida");
                atualizarTotal();
            });
        });
        atualizarTotal();
        corpo.append(total);

        // ---- feedback geral e salvar
        const campoFeedback = h("textarea");
        campoFeedback.id = "cq-feedback-" + sufixo;
        campoFeedback.rows = 3;
        campoFeedback.placeholder = "Feedback geral para o aluno (opcional)";
        campoFeedback.value = entrega.feedback || "";
        const rotuloFeedback = h("label", null, "Feedback geral");
        rotuloFeedback.htmlFor = campoFeedback.id;
        const grupoFeedback = h("div", "cq-feedback");
        grupoFeedback.append(rotuloFeedback, campoFeedback);
        corpo.append(grupoFeedback);

        const botao = h("button", "btn", entrega.corrigida_em ? "Atualizar correção" : "Salvar correção");
        botao.type = "button";
        const msg = h("span", "msg");
        const acoes = h("div", "acoes");
        acoes.append(botao, msg);
        corpo.append(acoes);

        function erro(texto, item) {
            msg.className = "msg erro";
            msg.setAttribute("role", "alert");
            msg.textContent = texto;
            if (item) {
                item.bloco.classList.add("cq-invalida");
                item.campoNota.focus();
            }
        }

        botao.addEventListener("click", async () => {
            msg.textContent = "";

            for (const item of itens) {
                const texto = item.campoNota.value;
                const rotulo = "Questão " + item.q.ordem + ": ";
                if (texto === "") {
                    if (item.q.tipo === "discursiva") return erro(rotulo + "dê uma nota (pode ser zero).", item);
                    continue; // objetiva sem nota digitada: o servidor usa a nota automática
                }
                const valor = Number(texto);
                if (!Number.isFinite(valor) || valor < 0 || valor > Number(item.q.pontos)) {
                    return erro(rotulo + "a nota deve ficar entre 0 e " + pts(item.q.pontos) + ".", item);
                }
            }

            botao.disabled = true;
            try {
                const resposta = await conradFetch("/api/entregas/" + entrega.id + "/correcao", {
                    method: "PUT",
                    body: JSON.stringify({
                        respostas: itens.map((item) => ({
                            questao_id: item.q.id,
                            pontos: item.campoNota.value === "" ? undefined : Number(item.campoNota.value),
                            comentario: item.campoComentario ? item.campoComentario.value : undefined
                        })),
                        feedback: campoFeedback.value
                    })
                });
                msg.className = "msg ok";
                msg.setAttribute("role", "status");
                msg.textContent = "Correção salva!";
                botao.textContent = "Atualizar correção";
                marcarSelo(true, resposta.nota);
                if (aoSalvar) aoSalvar();
            } catch (e) {
                erro(e.message);
            } finally {
                botao.disabled = false;
            }
        });

        return caixa;
    }

    window.CorrecaoQuestoes = { criarEntrega };
})();
