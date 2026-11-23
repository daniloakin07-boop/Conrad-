/*
===============================================
JS/conteudo-redirect.js
===============================================
Páginas: pages/avaliacoes.html e pages/atividades.html (atalhos do menu lateral).
Finalidade: mandar cada tipo de usuário para a tela certa, consultando GET /me:
  - aluno    -> aluno-atividades.html (lista, entrega e notas; ele escolhe a turma lá)
  - educador -> professor-correcao.html (atividades por turma, entregas e correção)

Dois modos, definidos por <body data-tipo="...">:
  1. COM data-tipo ("atividade" | "avaliacao") — usado por avaliacoes.html:
     o destino recebe ?tipo=<tipo> (filtra a lista) e, sem sessão (401), vai para o login;
     outros erros aparecem no primeiro <p> do <main>.
  2. SEM data-tipo — usado por atividades.html (página antiga mantida só para links e
     favoritos antigos): o destino NÃO recebe ?tipo (a lista mostra atividades e avaliações)
     e qualquer falha (sem sessão ou sem servidor) manda para o login.
     Este modo reproduz o script que antes ficava inline em atividades.html.

Depende de: JS/config.js (conradFetch), carregado antes, sem defer.
*/
(async function () {
    const temTipo = document.body.dataset.tipo !== undefined;
    const tipo = document.body.dataset.tipo === "avaliacao" ? "avaliacao" : "atividade";
    const aviso = document.querySelector("main p");

    try {
        const sessao = await conradFetch("/me");
        const destino = sessao.usuario.tipo === "educador" ? "professor-correcao.html" : "aluno-atividades.html";
        location.replace(temTipo ? `${destino}?tipo=${tipo}` : destino);
    } catch (erro) {
        if (!temTipo || erro.status === 401) {
            location.replace("login.html");
        } else if (aviso) {
            aviso.textContent = "Não foi possível abrir: " + erro.message;
        }
    }
})();
