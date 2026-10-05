// Seleciona o elemento onde os horários vão aparecer
const listaHorarios = document.querySelector("#lista-horarios");

// Cria um objeto vazio para armazenar os dados do calendário
let calendario = {};

// Função assíncrona para carregar o JSON
async function carregarHorarios() {
    // Faz uma requisição para pegar o arquivo JSON
    const resposta = await fetch("../data/horarios.json");

    // Converte o JSON em objeto JavaScript
    calendario = await resposta.json();

    // Mostra o primeiro dia ao abrir a página
    renderizarDia("seg");
}

// Função responsável por mostrar as aulas do dia na tela
function renderizarDia(dia) {
    // Limpa o conteúdo antes de renderizar novamente
    listaHorarios.innerHTML = "";

    // Percorre cada aula do dia escolhido
    calendario[dia].forEach(aula => {

        // Cria um li para cada aula
        const item = document.createElement("li");

        // Insere o conteúdo HTML dentro do item
        item.innerHTML = `
        <span class="hora">${aula.hora}</span>
        <div class="barra"></div>
        <div class="info">
            <div class="materia">${aula.materia}</div>
            <div class="sala">${aula.sala ? aula.sala + " · " + aula.professor : ""}</div>
        </div>
        `;

        // Adiciona o item dentro da lista na página
        listaHorarios.appendChild(item);
    });
}

// Troca o dia ao clicar em uma aba
document.querySelectorAll(".tabs a").forEach(aba => {
    aba.addEventListener("click", e => {
        e.preventDefault();

        // Tira a classe "ativo" da aba antiga e coloca na clicada
        document.querySelector(".tabs a.ativo").classList.remove("ativo");
        aba.classList.add("ativo");

        // Mostra as aulas do dia da aba clicada
        renderizarDia(aba.dataset.dia);
    });
});

// Chama a função para carregar os horários ao iniciar a página
carregarHorarios();