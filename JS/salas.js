const salas = [
  { id: 1, nome: "Sala 1", assunto: "Física quântica", mentor: "Prof. Helena Costa", horario: "Agora · 14:30", participantes: 18, capacidade: 24, acento: "#F5821F", status: "vivo" },
  { id: 2, nome: "Sala 2", assunto: "Astronomia aplicada", mentor: "Prof. Miguel Rocha", horario: "Hoje · 15:00", participantes: 12, capacidade: 24, acento: "#163B74", status: "breve" },
  { id: 3, nome: "Sala 3", assunto: "Laboratório de ideias", mentor: "Prof. Nina Alves", horario: "Hoje · 16:30", participantes: 7, capacidade: 18, acento: "#15803d", status: "breve" },
  { id: 4, nome: "Sala 4", assunto: "Matemática avançada", mentor: "Prof. Caio Mendes", horario: "Amanhã · 09:00", participantes: 0, capacidade: 20, acento: "#7c3aed", status: "livre" },
  { id: 5, nome: "Sala 5", assunto: "Robótica e futuro", mentor: "Prof. Luan Freire", horario: "Amanhã · 10:30", participantes: 21, capacidade: 24, acento: "#0891b2", status: "breve" },
  { id: 6, nome: "Sala 6", assunto: "Clube de leitura", mentor: "Prof. Alice Barros", horario: "Qui · 13:00", participantes: 4, capacidade: 18, acento: "#F5821F", status: "livre" },
  { id: 7, nome: "Sala 7", assunto: "Biologia molecular", mentor: "Prof. Theo Martins", horario: "Qui · 14:30", participantes: 9, capacidade: 22, acento: "#be185d", status: "breve" },
  { id: 8, nome: "Sala 8", assunto: "Oficina de pesquisa", mentor: "Prof. Bia Nascimento", horario: "Sex · 08:30", participantes: 0, capacidade: 16, acento: "#166534", status: "livre" },
  { id: 9, nome: "Sala 9", assunto: "Encontro geral", mentor: "Coordenação CONRAD", horario: "Sex · 16:00", participantes: 36, capacidade: 60, acento: "#7c3aed", status: "breve" }
];

const rotuloStatus = { vivo: "Ao vivo", breve: "Em breve", livre: "Livre" };

const grid = document.getElementById("salas-grid");
const busca = document.getElementById("busca-sala");
const videoView = document.getElementById("sala-video-view");
const videoTitulo = document.getElementById("sala-video-titulo");
const videoIframe = document.getElementById("sala-video-iframe");
const btnMic = document.getElementById("btn-mic");
const btnCam = document.getElementById("btn-cam");

let micLigado = true;
let camLigada = true;

function renderizarSalas(lista) {
  grid.innerHTML = "";
  lista.forEach(sala => {
    const card = document.createElement("div");
    card.className = "sala-card";
    card.style.setProperty("--acento", sala.acento);
    card.innerHTML = `
      <div class="sala-card-topo">
        <span class="status-pill ${sala.status}">${rotuloStatus[sala.status]}</span>
      </div>
      <h3>${sala.nome} — ${sala.assunto}</h3>
      <p>${sala.mentor}</p>
      <div class="sala-card-rodape">
        <span>${sala.horario}</span>
        <span>${sala.participantes}/${sala.capacidade}</span>
      </div>
    `;
    card.addEventListener("click", () => entrarNaSala(sala));
    grid.appendChild(card);
  });
}

function entrarNaSala(sala) {
  videoTitulo.textContent = `${sala.nome} — ${sala.assunto}`;
  videoIframe.src = `https://meet.jit.si/conrad-virtual-school-sala-${sala.id}#config.prejoinPageEnabled=false`;
  document.getElementById("salas-grid").classList.add("oculto");
  videoView.classList.add("ativa");
}

function sairDaSala() {
  videoIframe.src = "";
  videoView.classList.remove("ativa");
  document.getElementById("salas-grid").classList.remove("oculto");
}

busca.addEventListener("input", () => {
  const termo = busca.value.toLowerCase();
  const filtradas = salas.filter(s =>
    `${s.nome} ${s.assunto} ${s.mentor}`.toLowerCase().includes(termo)
  );
  renderizarSalas(filtradas);
});

document.getElementById("voltar-salas").addEventListener("click", sairDaSala);
document.getElementById("btn-sair").addEventListener("click", sairDaSala);

btnMic.addEventListener("click", () => {
  micLigado = !micLigado;
  btnMic.classList.toggle("desligado", !micLigado);
  btnMic.innerHTML = micLigado ? '<i class="fa fa-microphone"></i>' : '<i class="fa fa-microphone-slash"></i>';
});

btnCam.addEventListener("click", () => {
  camLigada = !camLigada;
  btnCam.classList.toggle("desligado", !camLigada);
  btnCam.innerHTML = camLigada ? '<i class="fa fa-video"></i>' : '<i class="fa fa-video-slash"></i>';
});

renderizarSalas(salas);