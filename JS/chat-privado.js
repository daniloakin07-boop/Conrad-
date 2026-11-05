// Front-end do bate-papo privado. Socket.IO é carregado a partir do servidor Express,
// inclusive quando o front-end está hospedado no GitHub Pages.
(() => {
  const $ = (seletor) => document.querySelector(seletor);
  const API = window.CONRAD_API || "";
  const params = new URLSearchParams(location.search);
  const turmaId = params.get("turmaId");
  const participanteId = params.get("participanteId");

  const listaContatos = $("#chat-contact-list");
  const mensagensEl = $("#chat-messages");
  const nomeEl = $("#chat-nome");
  const turmaEl = $("#chat-turma");
  const avatarEl = $("#chat-avatar");
  const statusEl = $("#chat-status");
  const feedbackEl = $("#chat-feedback");
  const form = $("#chat-form");
  const campoTexto = $("#chat-text");
  const botaoEnviar = $("#chat-send-button");
  const botaoImagem = $("#chat-image-button");
  const inputImagem = $("#chat-image-input");
  const botaoGravar = $("#chat-record-button");

  let socket = null;
  let conversaAtiva = null;
  let gravador = null;
  let fluxoMicrofone = null;
  let partesAudio = [];
  let gravando = false;

  async function api(caminho, opcoes = {}) {
    const resposta = await fetch(API + caminho, {
      credentials: "include",
      ...opcoes
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      const erro = new Error(dados.erro || `Erro ${resposta.status}`);
      erro.status = resposta.status;
      throw erro;
    }
    return dados;
  }

  function elemento(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  function mostrarFeedback(texto, erro = false) {
    feedbackEl.textContent = texto || "";
    feedbackEl.classList.toggle("erro", Boolean(erro));
  }

  function definirStatus(texto, estado = "") {
    statusEl.textContent = texto;
    statusEl.className = "chat-status" + (estado ? ` ${estado}` : "");
  }

  function formatarHora(valor) {
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(data);
  }

  function iniciais(nome) {
    return String(nome || "CV").trim().split(/\s+/).slice(0, 2).map((parte) => parte[0] || "").join("").toUpperCase();
  }

  function rolarParaFim() {
    mensagensEl.scrollTop = mensagensEl.scrollHeight;
  }

  function mensagemVazia() {
    const vazio = elemento("div", "chat-boas-vindas");
    vazio.append(
      elemento("i", "fa-regular fa-message"),
      elemento("strong", "", "Nenhuma mensagem ainda"),
      elemento("span", "", "Envie uma mensagem para iniciar a conversa.")
    );
    mensagensEl.replaceChildren(vazio);
  }

  function renderizarMensagem(mensagem) {
    // Todos os textos de usuário são inseridos com textContent, sem interpretar HTML.
    const propria = Number(mensagem.autorId) === Number(window.usuarioConrad?.id);
    const caixa = elemento("article", `chat-mensagem ${propria ? "minha" : "outra"}`);
    const autor = elemento("strong", "chat-mensagem-autor", propria ? "Você" : mensagem.autor);
    const corpo = elemento("div", "chat-mensagem-conteudo");

    if (mensagem.tipo === "imagem") {
      const imagem = document.createElement("img");
      imagem.src = API + mensagem.anexoUrl;
      imagem.alt = mensagem.nomeArquivo || "Imagem enviada na conversa";
      imagem.loading = "lazy";
      imagem.className = "chat-imagem-enviada";
      imagem.addEventListener("click", () => window.open(imagem.src, "_blank", "noopener"));
      corpo.append(imagem);
    } else if (mensagem.tipo === "audio") {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.preload = "metadata";
      audio.src = API + mensagem.anexoUrl;
      audio.className = "chat-audio-enviado";
      corpo.append(audio);
      corpo.append(elemento("small", "chat-nome-arquivo", mensagem.nomeArquivo || "Mensagem de voz"));
    } else {
      corpo.append(elemento("span", "", mensagem.conteudo));
    }

    const hora = elemento("time", "chat-mensagem-hora", formatarHora(mensagem.data));
    caixa.append(autor, corpo, hora);
    mensagensEl.append(caixa);
    rolarParaFim();
  }

  function habilitarComposer(habilitado) {
    campoTexto.disabled = !habilitado;
    botaoEnviar.disabled = !habilitado;
    botaoImagem.disabled = !habilitado;
    botaoGravar.disabled = !habilitado || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder;
  }

  function renderizarContato(contato) {
    const link = elemento("a", "chat-contato");
    link.href = `bate-papo.html?turmaId=${encodeURIComponent(contato.turmaId)}&participanteId=${encodeURIComponent(contato.participanteId)}`;
    const avatar = elemento("span", "chat-contato-avatar", iniciais(contato.participanteNome));
    const dados = elemento("span", "chat-contato-dados");
    dados.append(
      elemento("strong", "", contato.participanteNome),
      elemento("small", "", `${contato.turmaNome} · ${contato.disciplina || "Turma"}`)
    );
    const icone = elemento("i", "fa-solid fa-chevron-right chat-contato-seta");
    link.append(avatar, dados, icone);

    const selecionado = Number(contato.turmaId) === Number(turmaId) &&
      Number(contato.participanteId) === Number(participanteId);
    link.classList.toggle("selecionado", selecionado);
    return link;
  }

  async function carregarContatos() {
    try {
      const dados = await api("/api/chat/contatos");
      const contatos = dados.contatos || [];
      listaContatos.replaceChildren();

      if (!contatos.length) {
        listaContatos.append(elemento("p", "chat-vazio", "Nenhum aluno ou educador vinculado às suas turmas foi encontrado."));
        return;
      }

      contatos.forEach((contato) => listaContatos.append(renderizarContato(contato)));
    } catch (erro) {
      if (erro.status === 401) {
        location.href = "login.html";
        return;
      }
      listaContatos.replaceChildren(elemento("p", "chat-vazio chat-erro", erro.message));
    }
  }

  function carregarSocketIo() {
    return new Promise((resolve, reject) => {
      if (window.io) return resolve();
      const script = document.createElement("script");
      script.src = `${API || location.origin}/socket.io/socket.io.js`;
      script.async = true;
      script.onload = () => window.io ? resolve() : reject(new Error("Não foi possível iniciar o serviço de mensagens."));
      script.onerror = () => reject(new Error("Servidor de bate-papo indisponível. Confira se o servidor Node está ativo."));
      document.head.append(script);
    });
  }

  async function entrarNaConversa() {
    if (!turmaId || !participanteId) {
      definirStatus("Selecione um contato");
      return;
    }

    try {
      const query = new URLSearchParams({ turmaId, participanteId });
      const dados = await api(`/api/chat/contexto?${query.toString()}`);
      conversaAtiva = dados.conversa;
      window.usuarioConrad = (await api("/me")).usuario;

      nomeEl.textContent = conversaAtiva.participante.nome;
      turmaEl.textContent = `${conversaAtiva.turmaNome} · ${conversaAtiva.disciplina || "Turma"}`;
      avatarEl.textContent = iniciais(conversaAtiva.participante.nome);
      habilitarComposer(true);
      definirStatus("Conversa individual", "privado");
      mensagemVazia();

      await carregarSocketIo();
      socket = window.io(API || undefined, { withCredentials: true, transports: ["websocket", "polling"] });

      socket.on("connect", () => {
        definirStatus("Conectando à conversa...", "privado");
        socket.emit("chat:entrar", { turmaId, participanteId }, (resposta) => {
          if (!resposta?.ok) {
            definirStatus("Acesso não autorizado", "offline");
            habilitarComposer(false);
            mostrarFeedback(resposta?.erro || "Não foi possível entrar nesta conversa.", true);
            return;
          }
          conversaAtiva = resposta.conversa;
          mensagensEl.replaceChildren();
          if (!resposta.mensagens?.length) mensagemVazia();
          else resposta.mensagens.forEach(renderizarMensagem);
          definirStatus("Conectado · conversa privada", "privado");
        });
      });

      socket.on("disconnect", () => definirStatus("Reconectando...", "offline"));
      socket.on("connect_error", () => {
        definirStatus("Servidor indisponível", "offline");
        mostrarFeedback("Não foi possível conectar ao servidor de mensagens.", true);
      });
      socket.on("chat:mensagem", renderizarMensagem);
    } catch (erro) {
      definirStatus("Não foi possível abrir a conversa", "offline");
      habilitarComposer(false);
      mostrarFeedback(erro.message, true);
    }
  }

  function lerComoDataUrl(arquivo) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result);
      leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."));
      leitor.readAsDataURL(arquivo);
    });
  }

  function enviar(payload) {
    return new Promise((resolve, reject) => {
      if (!socket?.connected) return reject(new Error("Aguarde a conexão com o bate-papo."));
      socket.emit("chat:enviar", payload, (resposta) => {
        if (!resposta?.ok) reject(new Error(resposta?.erro || "Não foi possível enviar a mensagem."));
        else resolve(resposta);
      });
    });
  }

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const conteudo = campoTexto.value.trim();
    if (!conteudo) return;
    botaoEnviar.disabled = true;
    mostrarFeedback("");
    try {
      await enviar({ tipo: "texto", conteudo });
      campoTexto.value = "";
      campoTexto.style.height = "auto";
      campoTexto.focus();
    } catch (erro) {
      mostrarFeedback(erro.message, true);
    } finally {
      botaoEnviar.disabled = !socket?.connected;
    }
  });

  campoTexto.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault();
      form.requestSubmit();
    }
  });

  campoTexto.addEventListener("input", () => {
    campoTexto.style.height = "auto";
    campoTexto.style.height = `${Math.min(campoTexto.scrollHeight, 120)}px`;
  });

  botaoImagem.addEventListener("click", () => inputImagem.click());
  inputImagem.addEventListener("change", async () => {
    const arquivo = inputImagem.files?.[0];
    inputImagem.value = "";
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) return mostrarFeedback("Escolha um arquivo de imagem válido.", true);
    if (arquivo.size > 3 * 1024 * 1024) return mostrarFeedback("A imagem deve ter no máximo 3 MB.", true);

    try {
      mostrarFeedback("Enviando imagem...");
      await enviar({ tipo: "imagem", conteudo: await lerComoDataUrl(arquivo), nomeArquivo: arquivo.name });
      mostrarFeedback("");
    } catch (erro) {
      mostrarFeedback(erro.message, true);
    }
  });

  async function iniciarGravacao() {
    try {
      fluxoMicrofone = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipos = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];
      const mimeType = tipos.find((tipo) => MediaRecorder.isTypeSupported(tipo)) || "";
      gravador = new MediaRecorder(fluxoMicrofone, mimeType ? { mimeType } : undefined);
      partesAudio = [];
      gravador.addEventListener("dataavailable", (evento) => {
        if (evento.data.size) partesAudio.push(evento.data);
      });
      gravador.addEventListener("stop", finalizarGravacao, { once: true });
      gravador.start();
      gravando = true;
      botaoGravar.classList.add("gravando");
      botaoGravar.innerHTML = '<i class="fa-solid fa-stop"></i>';
      botaoGravar.title = "Parar e enviar áudio";
      mostrarFeedback("Gravando mensagem de voz. Clique novamente para finalizar.");
    } catch (erro) {
      mostrarFeedback("Não foi possível acessar o microfone. Verifique a permissão do navegador.", true);
    }
  }

  async function finalizarGravacao() {
    try {
      const tipo = gravador?.mimeType || "audio/webm";
      const blob = new Blob(partesAudio, { type: tipo });
      if (!blob.size) throw new Error("A gravação ficou vazia. Tente novamente.");
      if (blob.size > 3 * 1024 * 1024) throw new Error("O áudio excedeu o limite de 3 MB. Grave uma mensagem mais curta.");
      mostrarFeedback("Enviando mensagem de voz...");
      await enviar({ tipo: "audio", conteudo: await lerComoDataUrl(blob), nomeArquivo: "Mensagem de voz" });
      mostrarFeedback("");
    } catch (erro) {
      mostrarFeedback(erro.message, true);
    } finally {
      fluxoMicrofone?.getTracks().forEach((track) => track.stop());
      fluxoMicrofone = null;
      gravador = null;
      partesAudio = [];
      gravando = false;
      botaoGravar.classList.remove("gravando");
      botaoGravar.innerHTML = '<i class="fa-solid fa-microphone"></i>';
      botaoGravar.title = "Gravar mensagem de voz";
    }
  }

  botaoGravar.addEventListener("click", async () => {
    if (!gravando) await iniciarGravacao();
    else if (gravador && gravador.state !== "inactive") gravador.stop();
  });

  window.addEventListener("beforeunload", () => {
    if (socket) socket.disconnect();
    fluxoMicrofone?.getTracks().forEach((track) => track.stop());
  });

  (async () => {
    try {
      const sessao = await api("/me");
      window.usuarioConrad = sessao.usuario;
      await carregarContatos();
      await entrarNaConversa();
    } catch (erro) {
      if (erro.status === 401) location.href = "login.html";
      else mostrarFeedback(erro.message, true);
    }
  })();
})();
