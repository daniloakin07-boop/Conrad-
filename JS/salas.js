(function () {
    const lista = document.getElementById("lista-salas-video");

    function elemento(tag, classe, texto) {
        const el = document.createElement(tag);
        if (classe) el.className = classe;
        if (texto !== undefined && texto !== null) el.textContent = texto;
        return el;
    }

    async function iniciar() {
        try {
            const dados = await conradFetch("/api/turmas");
            const turmas = dados.turmas || [];
            lista.replaceChildren();

            if (!turmas.length) {
                lista.append(elemento("p", "turmas-vazio", "Você ainda não tem turmas com sala de vídeo. Entre em uma turma ou crie uma nova para começar."));
                return;
            }

            turmas.forEach((turma, indice) => {
                const card = elemento("article", "turma-card");
                const capa = elemento("div", "turma-card-capa");
                const titulo = elemento("h2", "", turma.nome);
                const disciplina = elemento("p", "", turma.disciplina);
                const avatar = elemento("span", "turma-card-iniciais", String(turma.nome).split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase());
                capa.append(titulo, disciplina, avatar);
                capa.style.background = indice % 2 ? "linear-gradient(120deg,#163b74,#356a9d)" : "linear-gradient(120deg,#0a1f44,#1f4e79)";

                const corpo = elemento("div", "turma-card-corpo");
                corpo.append(
                    elemento("p", "", `Professor(a): ${turma.professor || "Equipe Conrad"}`),
                    elemento("p", "", `${Number(turma.quantidade_alunos || 0)} aluno(s) matriculado(s)`)
                );

                const rodape = elemento("div", "turma-card-rodape");
                rodape.append(elemento("span", "", "Sala de vídeo disponível"));
                const entrar = elemento("a", "turma-card-abrir", "Entrar na sala →");
                entrar.href = `turma.html?id=${encodeURIComponent(turma.id)}&aba=video`;
                rodape.append(entrar);
                card.append(capa, corpo, rodape);
                lista.append(card);
            });
        } catch (erro) {
            lista.replaceChildren(elemento("p", "turmas-vazio", erro.message));
            if (erro.status === 401) location.href = "login.html";
        }
    }

    iniciar();
})();
