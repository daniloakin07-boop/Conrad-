/*
===============================================
JS/perfil-chat.js
===============================================
Páginas: pages/perfil-aluno.html e pages/perfil-educador.html
Finalidade: preencher a seção #atalhos-chat do perfil com atalhos de conversa privada:
  - educador: lista os alunos das suas turmas ("Conversar com meus alunos");
  - aluno: lista o educador de cada turma ("Conversar com meu educador").
Cada atalho abre pages/bate-papo.html?turmaId=N&participanteId=M (tratado por JS/chat-privado.js).

API usada (via window.conradFetch): GET /me e GET /api/chat/contatos (rota em JS/chat.js).
Se a seção #atalhos-chat não existir ou o config.js não estiver carregado, o script não faz nada.
*/

(() => {
  const painel = document.getElementById("atalhos-chat");
  if (!painel || typeof window.conradFetch !== "function") return;

    // Cria um elemento com texto seguro (textContent)
  const criar = (tag, classe, texto) => {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined) el.textContent = texto;
    return el;
  };

    // Iniciais (até 2 letras) para o avatar do contato
  const iniciais = (nome) => String(nome || "CV").trim().split(/\s+/).slice(0, 2)
    .map((parte) => parte[0] || "").join("").toUpperCase();

    // Busca sessão e contatos em paralelo e monta o cabeçalho + a grade de atalhos (401 -> login)
  async function carregar() {
    try {
      const [sessao, resultado] = await Promise.all([
        window.conradFetch("/me"),
        window.conradFetch("/api/chat/contatos")
      ]);
      const educador = sessao.usuario.tipo === "educador";
      const titulo = educador ? "Conversar com meus alunos" : "Conversar com meu educador";
      const descricao = educador
        ? "Escolha um aluno matriculado em uma das suas turmas."
        : "Entre em contato com o educador responsável pela sua turma.";

      const cabecalho = criar("div", "perfil-chat-cabecalho");
      const texto = criar("div");
      texto.append(criar("h2", "", titulo), criar("p", "", descricao));
      const botaoGeral = criar("a", "btn-primario", "Abrir bate-papo");
      botaoGeral.href = "bate-papo.html";
      cabecalho.append(texto, botaoGeral);

      const grade = criar("div", "perfil-chat-grade");
      const contatos = resultado.contatos || [];
      if (!contatos.length) {
        grade.append(criar("p", "chat-vazio", educador
          ? "Você ainda não possui alunos matriculados nas suas turmas."
          : "Você ainda não está matriculado em uma turma com educador responsável."));
      }

      contatos.forEach((contato) => {
        const link = criar("a", "perfil-chat-link");
        link.href = `bate-papo.html?turmaId=${encodeURIComponent(contato.turmaId)}&participanteId=${encodeURIComponent(contato.participanteId)}`;
        const avatar = criar("span", "chat-contato-avatar", iniciais(contato.participanteNome));
        const dados = criar("span", "chat-contato-dados");
        dados.append(
          criar("strong", "", contato.participanteNome),
          criar("small", "", `${contato.turmaNome} · ${contato.disciplina || "Turma"}`)
        );
        link.append(avatar, dados, criar("span", "perfil-chat-acao", "Conversar"));
        grade.append(link);
      });

      painel.replaceChildren(cabecalho, grade);
    } catch (erro) {
      if (erro.status === 401) location.href = "login.html";
      else painel.replaceChildren(criar("p", "chat-erro", erro.message || "Não foi possível carregar seus contatos."));
    }
  }

    // Executa ao carregar (script com defer: o HTML já está pronto)
  carregar();
})();
