/*
===============================================
JS/perfil-excluir-conta.js  (FRONT-END — roda no navegador)
===============================================
Páginas: pages/perfil-aluno.html e pages/perfil-educador.html (aluno e educador).
Finalidade: botão "Excluir minha conta" -> janela de confirmação -> senha atual -> DELETE /conta.

Fluxo (espelha o app Mobile, app/perfil.js):
  1. O botão #btnExcluirConta abre a janela #modalExcluirConta (aviso de exclusão permanente).
  2. O usuário digita a senha atual em #senhaExcluirConta e confirma.
  3. Enviamos DELETE /conta { senha } com o cookie de sessão. O servidor (JS/exclusao-conta.js)
     reconfere a senha, trata os dados relacionados em transação e encerra a sessão.
  4. SOMENTE depois da resposta de sucesso do servidor mostramos a mensagem e vamos para a
     página inicial. Em qualquer erro (senha incorreta, falha de rede...) a conta continua
     existindo e a mensagem de erro aparece na própria janela.

Proteções: o envio fica bloqueado enquanto a requisição está em andamento (sem cliques repetidos),
a janela não fecha durante o envio e todo texto entra na tela com textContent.
Depende de: JS/config.js (conradFetch), carregado antes, sem defer.
*/
(() => {
    const modal = document.getElementById("modalExcluirConta");
    const botaoAbrir = document.getElementById("btnExcluirConta");
    const formulario = document.getElementById("formExcluirConta");
    // Sem a janela ou o botão (outra página), o script não faz nada
    if (!modal || !botaoAbrir || !formulario) return;

    const campoSenha = document.getElementById("senhaExcluirConta");
    const status = document.getElementById("statusExcluirConta");
    const botaoConfirmar = document.getElementById("confirmarExcluirConta");
    const botaoCancelar = document.getElementById("cancelarExcluirConta");

    // true enquanto o servidor processa a exclusão: bloqueia cliques repetidos e o fechamento
    let enviando = false;

    // Mostra uma mensagem na janela (tipo: "erro" | "ok" | "")
    function mostrarStatus(texto, tipo) {
        status.textContent = texto;
        status.className = "modal-conta-status" + (tipo ? " " + tipo : "");
    }

    function abrirJanela() {
        formulario.reset();
        mostrarStatus("", "");
        modal.hidden = false;
        document.body.style.overflow = "hidden";
        campoSenha.focus();
    }

    function fecharJanela() {
        if (enviando) return; // não fecha no meio da exclusão
        modal.hidden = true;
        document.body.style.overflow = "";
        campoSenha.value = ""; // a senha não fica guardada na página
        botaoAbrir.focus();
    }

    botaoAbrir.addEventListener("click", abrirJanela);
    modal.querySelectorAll("[data-fechar-exclusao]").forEach((el) => el.addEventListener("click", fecharJanela));
    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && !modal.hidden) fecharJanela();
    });

    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        if (enviando) return;

        const senha = campoSenha.value;
        if (!senha) {
            mostrarStatus("Digite sua senha para confirmar a exclusão.", "erro");
            campoSenha.focus();
            return;
        }

        enviando = true;
        botaoConfirmar.disabled = true;
        botaoCancelar.disabled = true;
        campoSenha.disabled = true;
        botaoConfirmar.textContent = "Excluindo...";
        mostrarStatus("Aguarde, excluindo sua conta...", "");

        try {
            // O ID da conta NÃO é enviado: o servidor usa o da sessão
            await conradFetch("/conta", { method: "DELETE", body: JSON.stringify({ senha }) });

            // Sucesso confirmado pelo servidor (sessão e cookie já foram encerrados lá)
            mostrarStatus("Conta excluída com sucesso. Redirecionando...", "ok");
            campoSenha.value = "";
            setTimeout(() => { location.href = "../index.html"; }, 1500);
        } catch (erro) {
            // 401 aqui = sessão expirada ou conta inexistente: volta para o login
            if (erro.status === 401) {
                location.href = "login.html";
                return;
            }
            enviando = false;
            botaoConfirmar.disabled = false;
            botaoCancelar.disabled = false;
            campoSenha.disabled = false;
            botaoConfirmar.textContent = "Excluir definitivamente";
            mostrarStatus(erro.message || "Não foi possível excluir a conta.", "erro");
            campoSenha.focus();
            campoSenha.select();
        }
    });
})();
