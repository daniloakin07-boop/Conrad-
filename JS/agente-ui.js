(() => {
  const API = window.CONRAD_API || (
    ["localhost", "127.0.0.1"].includes(location.hostname)
      ? `${location.protocol}//${location.hostname}:3000`
      : location.hostname.endsWith("github.io") || location.hostname.endsWith("vercel.app")
        ? "https://conrad.onrender.com"
        : ""
  );

  const estilos = document.createElement("style");
  estilos.textContent = `
    #conrad-ia-fab{position:fixed;right:24px;bottom:24px;width:56px;height:56px;border:0;border-radius:50%;background:#6c63ff;color:#fff;font-size:24px;box-shadow:0 10px 28px rgba(31,41,55,.25);cursor:pointer;z-index:9998}
    #conrad-ia-fab:hover{background:#554ae6}
    /* Telas largas: o botao fica dentro da barra lateral, abaixo de Suporte e do nome */
    @media (min-width:1001px){
      .menu-lateral > #conrad-ia-fab,.menu-lateral > .menu-perfil + #conrad-ia-fab{position:static;right:auto;bottom:auto;display:block;margin:18px 0 0 8px;box-shadow:0 6px 18px rgba(0,0,0,.35)}
      #conrad-ia-painel.no-menu{left:calc(var(--painel-menu-largura,230px) + 16px);right:auto;bottom:24px}
    }
    #conrad-ia-painel{position:fixed;right:24px;bottom:92px;width:min(380px,calc(100vw - 48px));height:min(520px,calc(100vh - 120px));background:#fff;border:1px solid #dde3ef;border-radius:16px;box-shadow:0 18px 50px rgba(31,41,55,.25);z-index:9999;display:none;overflow:hidden;font-family:Arial,sans-serif}
    #conrad-ia-painel.aberto{display:flex;flex-direction:column}
    .conrad-ia-cabecalho{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:#17296a;color:#fff}
    .conrad-ia-cabecalho strong{font-size:15px}.conrad-ia-cabecalho button{border:0;background:transparent;color:#fff;font-size:20px;cursor:pointer}
    #conrad-ia-mensagens{flex:1;overflow:auto;padding:14px;background:#f7f8fc}
    .conrad-ia-msg{max-width:88%;margin:8px 0;padding:10px 12px;border-radius:12px;line-height:1.4;font-size:13px;white-space:pre-wrap;word-break:break-word}
    .conrad-ia-msg.usuario{margin-left:auto;background:#6c63ff;color:#fff;border-bottom-right-radius:4px}
    .conrad-ia-msg.assistente{background:#fff;border:1px solid #e2e6ef;color:#26324a;border-bottom-left-radius:4px}
    .conrad-ia-msg.erro{background:#fff1f1;border-color:#fecaca;color:#991b1b}
    .conrad-ia-form{display:flex;gap:8px;padding:10px;border-top:1px solid #e2e6ef}.conrad-ia-form input{flex:1;min-width:0;border:1px solid #ccd5e6;border-radius:10px;padding:10px 12px;font-size:13px}.conrad-ia-form button{border:0;border-radius:10px;background:#17296a;color:#fff;padding:0 14px;cursor:pointer}.conrad-ia-form button:disabled{opacity:.6}
  `;
  document.head.appendChild(estilos);

  const fab = document.createElement("button");
  fab.id = "conrad-ia-fab";
  fab.type = "button";
  fab.setAttribute("aria-label", "Abrir assistente de IA");
  fab.textContent = "✦";

  const painel = document.createElement("section");
  painel.id = "conrad-ia-painel";
  painel.setAttribute("aria-label", "Assistente de IA");
  painel.innerHTML = `
    <div class="conrad-ia-cabecalho"><strong>Assistente CONRAD</strong><button type="button" aria-label="Fechar">×</button></div>
    <div id="conrad-ia-mensagens"><div class="conrad-ia-msg assistente">Olá! Posso consultar suas atividades, notas, aulas e turmas.</div></div>
    <form class="conrad-ia-form"><input name="pergunta" maxlength="500" placeholder="Digite sua pergunta..." autocomplete="off" required><button type="submit">Enviar</button></form>
  `;
  document.body.appendChild(painel);

  // Se a pagina tem barra lateral, o botao vai para o espaco vazio abaixo do bloco do nome.
  // Em paginas sem barra lateral ele continua flutuando no canto da tela.
  const menuLateral = document.querySelector(".menu-lateral");
  if (menuLateral) {
    const blocoPerfil = menuLateral.querySelector(".menu-perfil");
    if (blocoPerfil) blocoPerfil.after(fab);
    else menuLateral.appendChild(fab);
    painel.classList.add("no-menu");
  } else {
    document.body.appendChild(fab);
  }

  const fechar = painel.querySelector(".conrad-ia-cabecalho button");
  const alternar = () => {
    painel.classList.toggle("aberto");
    if (painel.classList.contains("aberto")) painel.querySelector("input").focus();
  };
  fab.addEventListener("click", alternar);
  fechar.addEventListener("click", () => painel.classList.remove("aberto"));

  const area = painel.querySelector("#conrad-ia-mensagens");
  const form = painel.querySelector("form");
  const input = form.querySelector("input");
  const botao = form.querySelector("button");
  const historico = [];

  function adicionar(texto, tipo) {
    const msg = document.createElement("div");
    msg.className = `conrad-ia-msg ${tipo}`;
    msg.textContent = texto;
    area.appendChild(msg);
    area.scrollTop = area.scrollHeight;
  }

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const pergunta = input.value.trim();
    if (!pergunta) return;

    input.value = "";
    botao.disabled = true;
    adicionar(pergunta, "usuario");
    historico.push({ role: "user", content: pergunta });

    try {
      const resposta = await fetch(`${API}/api/agente`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta, historico: historico.slice(-10) })
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(dados.erro || `Erro ${resposta.status}`);

      adicionar(dados.resposta || "Não consegui responder.", "assistente");
      historico.push({ role: "assistant", content: dados.resposta || "" });
    } catch (erro) {
      adicionar(erro.message, "erro");
    } finally {
      botao.disabled = false;
      input.focus();
    }
  });
})();