/*
===============================================
JS/perfil-educador.js
===============================================
Página: pages/perfil-educador.html (perfil: educador)
Finalidade: comportamentos do formulário de perfil do educador:
  1. Botão da foto abre o seletor de arquivos e mostra a prévia da imagem escolhida.
  2. Envio do formulário confere nome e e-mail (validação básica no navegador).
Origem: antes era um <script> inline no HTML; foi externalizado sem mudar o comportamento.

Observações:
  - A foto é lida com FileReader (data URL) apenas para PRÉVIA; não é enviada ao servidor.
  - O "Perfil atualizado" é só uma confirmação visual: não há rota de atualização de perfil
    de educador no server.js.
  - Os valores dos campos (nome, e-mail, cargo etc.) são texto de exemplo escritos no próprio HTML;
    esta página ainda não carrega nem grava dados reais do educador.
  - Os atalhos de chat com alunos desta página ficam em JS/perfil-chat.js.
Depende dos ids do HTML: #photoInput, #profilePreview, #profileForm, #nome, #email
e da classe .perfil-foto-btn.
*/
(function () {
    const photoInput = document.getElementById('photoInput');
    const profilePreview = document.getElementById('profilePreview');
    const photoButton = document.querySelector('.perfil-foto-btn');

    // O botão visível apenas "clica" no <input type="file"> escondido
    photoButton.addEventListener('click', () => photoInput.click());

    // Ao escolher o arquivo, converte em data URL e troca a imagem de prévia
    photoInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            profilePreview.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    // Validação simples: nome e e-mail são obrigatórios
    document.getElementById('profileForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const nome = document.getElementById('nome').value.trim();
        const email = document.getElementById('email').value.trim();

        if (!nome || !email) {
            alert('Nome e e-mail são obrigatórios.');
            return;
        }

        alert('Perfil atualizado com sucesso!');
    });
})();
