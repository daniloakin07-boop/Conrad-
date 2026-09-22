const mensagens = document.getElementById("mensagens");
const campoTexto = document.getElementById("texto");
const botaoEnviar = document.querySelector(".enviarr button");
const statusChat = document.getElementById("status-chat");
const contadorOnline = document.getElementById("contador-online");

const socket = io({
    withCredentials: true
});

let meuNome = "Aluno Anônimo";

function formatarHora(data) {
    return new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(data));
}

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

function mostrarEstado(texto, conectado) {
    if (!statusChat) return;
    statusChat.textContent = texto;
    statusChat.classList.toggle("conectado", conectado);
}

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

socket.on("connect", () => mostrarEstado("Online", true));
socket.on("disconnect", () => mostrarEstado("Reconectando...", false));
socket.on("connect_error", () => mostrarEstado("Servidor indisponível", false));

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

campoTexto.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" && !evento.shiftKey) {
        evento.preventDefault();
        enviarMensagem();
    }
});

botaoEnviar.addEventListener("click", enviarMensagem);

carregarUsuario();

window.enviarMensagem = enviarMensagem;
