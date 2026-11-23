/*
===============================================
JS/script.js
===============================================
STATUS: arquivo legado — NÃO é carregado por nenhuma página atual (o bate-papo atual é
JS/chat-privado.js). Foi mantido para não remover código do projeto.
Finalidade original: bate-papo geral em tempo real (Socket.IO) com os elementos #mensagens,
#texto, #status-chat e #contador-online. Dependia de eventos "chat:historico", "chat:mensagem",
"chat:online" e "chat:enviar" de um servidor de chat geral que não existe mais em JS/chat.js
(que agora só trata conversas privadas).
*/

// Elementos da tela do chat geral
const mensagens = document.getElementById("mensagens");
const campoTexto = document.getElementById("texto");
const botaoEnviar = document.querySelector(".enviarr button");
const statusChat = document.getElementById("status-chat");
const contadorOnline = document.getElementById("contador-online");

// Conexão Socket.IO (envia o cookie de sessão)
const socket = io({
    withCredentials: true
});

// Nome usado para marcar as mensagens "minhas" (substituído pelo nome do usuário logado)
let meuNome = "Aluno Anônimo";

// Formata a hora (HH:MM) no padrão brasileiro
function formatarHora(data) {
    return new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(data));
}

// Desenha uma mensagem na lista (textContent: sem interpretar HTML)
function criarMensagem(mensagem) {
    const caixa = document.createElement("div");
    caixa.className = "msg";
    caixa.classList.toggle("eu", mensagem.autor === meuNome);
    caixa.classList.toggle("outro", mensagem.autor !== meuNome);

    const autor = document.createElement("strong");
    autor.textContent = mensagem.autor;

    const texto = document.createElement("span");
    texto.textContent = mensagem.texto;

    const horario = document.createElement("small");
    horario.textContent = formatarHora(mensagem.data);

    caixa.append(autor, texto, horario);
    mensagens.appendChild(caixa);
    mensagens.scrollTop = mensagens.scrollHeight;
}

// Atualiza o texto/estilo do indicador de conexão
function mostrarEstado(texto, conectado) {
    if (!statusChat) return;
    statusChat.textContent = texto;
    statusChat.classList.toggle("conectado", conectado);
}

// Consulta GET /me para saber o nome do usuário logado
async function carregarUsuario() {
    try {
        const resposta = await fetch("/me", { credentials: "include" });
        if (resposta.ok) {
            const dados = await resposta.json();
            meuNome = dados.usuario.nome;
        }
    } catch (erro) {
        console.warn("Não foi possível identificar o usuário logado.", erro);
    }
}

// Eventos de conexão
socket.on("connect", () => mostrarEstado("Online", true));
socket.on("disconnect", () => mostrarEstado("Reconectando...", false));
socket.on("connect_error", () => mostrarEstado("Servidor indisponível", false));

// Eventos de mensagens e de pessoas online
socket.on("chat:historico", (historico) => {
    mensagens.replaceChildren();
    historico.forEach(criarMensagem);
});

socket.on("chat:mensagem", criarMensagem);

socket.on("chat:online", ({ quantidade }) => {
    if (contadorOnline) {
        contadorOnline.textContent = `${quantidade} ${quantidade === 1 ? "pessoa" : "pessoas"} online`;
    }
});

// Envia o texto digitado pelo evento "chat:enviar" e limpa o campo quando o servidor confirma
function enviarMensagem() {
    const texto = campoTexto.value.trim();
    if (!texto || !socket.connected) return;

    socket.emit("chat:enviar", texto, (resposta) => {
        if (!resposta?.ok) {
            alert(resposta?.erro || "Não foi possível enviar a mensagem.");
            return;
        }
        campoTexto.value = "";
        campoTexto.focus();
    });
}

// Enter envia; Shift+Enter quebra linha
campoTexto.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" && !evento.shiftKey) {
        evento.preventDefault();
        enviarMensagem();
    }
});

botaoEnviar.addEventListener("click", enviarMensagem);

carregarUsuario();

// Mantém a função acessível globalmente (compatibilidade com usos antigos)
window.enviarMensagem = enviarMensagem;
