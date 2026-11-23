/*
===============================================
JS/chat-privado.js
===============================================
Página: pages/bate-papo.html (educador e aluno)
Finalidade: bate-papo PRIVADO (1 a 1) entre um aluno e o educador de uma turma, em tempo real.

Como funciona:
  1. Lê da URL ?turmaId=N&participanteId=M (a conversa escolhida na lista de contatos).
  2. GET /api/chat/contatos     -> preenche a lista lateral de contatos (JS/chat.js, rota REST).
  3. GET /api/chat/contexto     -> valida a conversa e traz nome/turma do outro participante.
  4. Carrega o cliente do Socket.IO a partir do próprio servidor (/socket.io/socket.io.js),
     inclusive quando o front-end está hospedado em outro domínio (GitHub Pages).
  5. Eventos Socket.IO: "chat:entrar" (entra na sala privada e recebe o histórico),
     "chat:enviar" (envia texto/imagem/áudio) e "chat:mensagem" (recebe mensagens novas).
  6. Imagens e áudios (até 3 MB) viajam como data URL (Base64) e o servidor as guarda como anexos
     (rota GET /api/chat/anexos/:id usada para exibi-los).

Segurança: todo texto de usuário entra na tela com textContent; o servidor decide quem pode
entrar em cada conversa (este arquivo não é a fonte da regra de permissão).
Depende de: JS/config.js (CONRAD_API) e do layout.js (menu).
Observação: os ícones usam classes "fa-..." (Font Awesome), mas nenhuma página nem CSS do projeto
carrega essa biblioteca; os ícones só aparecem se ela for adicionada (ex.: via CDN).
*/

(() => {
    // ---- Atalho, base da API e parâmetros da conversa selecionada na URL
  const $ = (seletor) => document.querySelector(seletor);
  const API = window.CONRAD_API || "";
  const params = new URLSearchParams(location.search);
  const turmaId = params.get("turmaId");
  const participanteId = params.get("participanteId");

    // ---- Elementos da tela (ids definidos em pages/bate-papo.html)
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

    // ---- Estado da tela: conexão, conversa aberta e gravação de áudio em andamento
  let socket = null;
  let conversaAtiva = null;
  let gravador = null;
  let fluxoMicrofone = null;
  let partesAudio = [];
  let gravando = false;

    // fetch com cookie de sessão que converte respostas de erro em Error (com .status).
    // Obs.: não define Content-Type; as rotas usadas aqui são GET.
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

    // Cria um elemento com texto seguro (textContent)
  function elemento(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

    // Mensagem de aviso/erro abaixo do campo de texto (erro=true aplica a classe "erro")
  function mostrarFeedback(texto, erro = false) {
    feedbackEl.textContent = texto || "";
    feedbackEl.classList.toggle("erro", Boolean(erro));
  }

    // Texto de estado da conexão no topo da conversa; `estado` vira classe CSS (privado/offline)
  function definirStatus(texto, estado = "") {
    statusEl.textContent = texto;
    statusEl.className = "chat-status" + (estado ? ` ${estado}` : "");
  }

    // Formata data/hora como HH:MM (pt-BR); data inválida devolve texto vazio
  function formatarHora(valor) {
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(data);
  }

    // Iniciais (até 2 letras) para o avatar redondo
  function iniciais(nome) {
    return String(nome || "CV").trim().split(/\s+/).slice(0, 2).map((parte) => parte[0] || "").join("").toUpperCase();
  }

    // Mantém a conversa rolada até a mensagem mais recente
  function rolarParaFim() {
    mensagensEl.scrollTop = mensagensEl.scrollHeight;
  }

    // Estado vazio: convida a enviar a primeira mensagem
  function mensagemVazia() {
    const vazio = elemento("div", "chat-boas-vindas");
    vazio.append(
      elemento("i", "fa-regular fa-message"),
      elemento("strong", "", "Nenhuma mensagem ainda"),
      elemento("span", "", "Envie uma mensagem para iniciar a conversa.")
    );
    mensagensEl.replaceChildren(vazio);
  }

    /**
     * Desenha uma mensagem na conversa.
     * @param {object} mensagem { autorId, autor, tipo: "texto"|"imagem"|"audio", conteudo,
     *                           anexoUrl, nomeArquivo, data }
     * "propria" é decidido comparando autorId com o usuário logado (window.usuarioConrad).
     */
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

    // Liga/desliga o campo de texto e os botões. O microfone também exige suporte do navegador.
  function habilitarComposer(habilitado) {
    campoTexto.disabled = !habilitado;
    botaoEnviar.disabled = !habilitado;
    botaoImagem.disabled = !habilitado;
    botaoGravar.disabled = !habilitado || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder;
  }

    // Monta um item da lista de contatos (link para bate-papo.html com turma e participante)
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

    // Carrega os contatos da lista lateral (alunos do professor ou educadores do aluno)
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

    // Injeta dinamicamente o script do Socket.IO servido pelo backend (uma única vez)
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

    /**
     * Abre a conversa selecionada: valida o contexto na API, conecta o socket e entra na sala
     * privada. Registra os eventos connect/disconnect/connect_error/chat:mensagem.
     * Sem ?turmaId e ?participanteId apenas mostra "Selecione um contato".
     */
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

    // Converte um arquivo/blob em data URL (Base64) para ser enviado pelo socket
  function lerComoDataUrl(arquivo) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result);
      leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."));
      leitor.readAsDataURL(arquivo);
    });
  }

    // Envia uma mensagem pelo evento "chat:enviar" e devolve uma Promise (usa o callback de confirmação do servidor)
  function enviar(payload) {
    return new Promise((resolve, reject) => {
      if (!socket?.connected) return reject(new Error("Aguarde a conexão com o bate-papo."));
      socket.emit("chat:enviar", payload, (resposta) => {
        if (!resposta?.ok) reject(new Error(resposta?.erro || "Não foi possível enviar a mensagem."));
        else resolve(resposta);
      });
    });
  }

    // ---- Envio de texto: botão Enviar ou Enter (Shift+Enter quebra a linha)
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

    // Faz o campo crescer conforme o texto digitado (limite de 120 px)
  campoTexto.addEventListener("input", () => {
    campoTexto.style.height = "auto";
    campoTexto.style.height = `${Math.min(campoTexto.scrollHeight, 120)}px`;
  });

    // ---- Envio de imagem: valida tipo e tamanho (máx. 3 MB) antes de enviar
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

    // ---- Mensagem de voz: usa MediaRecorder; escolhe o primeiro formato suportado pelo navegador
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

    // Ao parar a gravação: monta o áudio, confere tamanho (máx. 3 MB), envia e libera o microfone
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

    // Um clique inicia a gravação; o clique seguinte a finaliza e envia
  botaoGravar.addEventListener("click", async () => {
    if (!gravando) await iniciarGravacao();
    else if (gravador && gravador.state !== "inactive") gravador.stop();
  });

    // Ao sair da página: fecha o socket e solta o microfone
  window.addEventListener("beforeunload", () => {
    if (socket) socket.disconnect();
    fluxoMicrofone?.getTracks().forEach((track) => track.stop());
  });

    // ---- Inicialização: sessão -> contatos -> (se houver conversa selecionada) entra nela
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
