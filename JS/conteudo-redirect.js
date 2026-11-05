/*
Atalhos "Atividades" e "Avaliações" do menu lateral (pages/atividades.html e pages/avaliacoes.html).
Mandam cada tipo de usuário para a tela certa:
  - aluno    -> aluno-atividades.html (lista, entrega e notas; ele escolhe a turma lá)
  - educador -> professor-correcao.html (atividades por turma, entregas e correção)
O tipo de conteúdo vem de <body data-tipo="atividade|avaliacao">.
*/
(async function () {
    const tipo = document.body.dataset.tipo === "avaliacao" ? "avaliacao" : "atividade";
    const aviso = document.querySelector("main p");

    try {
        const sessao = await conradFetch("/me");
        const destino = sessao.usuario.tipo === "educador" ? "professor-correcao.html" : "aluno-atividades.html";
        location.replace(`${destino}?tipo=${tipo}`);
    } catch (erro) {
        if (erro.status === 401) {
            location.replace("login.html");
        } else if (aviso) {
            aviso.textContent = "Não foi possível abrir: " + erro.message;
        }
    }
})();
