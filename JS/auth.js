// CONRAD Virtual School - auth.js

// Lida com o envio do formulário de login.
const formLogin = document.getElementById('formLogin');
if (formLogin) {
  formLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;
    const msg = document.getElementById('mensagemLogin');

    if (!email || !senha) {
      msg.textContent = 'Preencha todos os campos.';
      msg.className = 'mensagem-auth erro';
      return;
    }

    fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    })
      .then((response) => response.json().then((data) => ({ status: response.status, body: data })))
      .then(({ status, body }) => {
        if (status !== 200) {
          msg.textContent = body.error || 'Falha ao fazer login.';
          msg.className = 'mensagem-auth erro';
          return;
        }

        const tipoUsuario = body.user?.tipo?.toLowerCase();
        const destino = tipoUsuario === 'educador' ? 'educador.html' : 'aluno.html';

        msg.textContent = `Bem-vindo, ${body.user.nome}!`;
        msg.className = 'mensagem-auth sucesso';
        window.location.href = destino;
      })
      .catch(() => {
        msg.textContent = 'Erro de conexão. Tente novamente.';
        msg.className = 'mensagem-auth erro';
      });
  });
}

// Valida e envia os dados do formulário de cadastro.
const formCadastro = document.getElementById('formCadastro');
if (formCadastro) {
  formCadastro.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome    = document.getElementById('nome').value.trim();
    const email   = document.getElementById('email').value.trim();
    const senha   = document.getElementById('senha').value;
    const confirma = document.getElementById('confirmasenha').value;
    const tipo    = document.querySelector('input[name="tipo"]:checked')?.value;
    const msg     = document.getElementById('mensagemCadastro');

    if (!nome || !email || !senha || !confirma) {
      msg.textContent = 'Preencha todos os campos.';
      msg.className = 'mensagem-auth erro';
      return;
    }
    if (senha !== confirma) {
      msg.textContent = 'As senhas não coincidem.';
      msg.className = 'mensagem-auth erro';
      return;
    }

    fetch('/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha, tipo })
    })
      .then((response) => response.json().then((data) => ({ status: response.status, body: data })))
      .then(({ status, body }) => {
        if (status !== 201) {
          msg.textContent = body.error || 'Falha ao criar conta.';
          msg.className = 'mensagem-auth erro';
          return;
        }

        msg.textContent = 'Conta criada com sucesso!';
        msg.className = 'mensagem-auth sucesso';
        formCadastro.reset();
      })
      .catch(() => {
        msg.textContent = 'Erro de conexão. Tente novamente.';
        msg.className = 'mensagem-auth erro';
      });
  });
}

// Processa a mensagem enviada pelo formulário de contato.
const formContato = document.getElementById('formContato');
if (formContato) {
  formContato.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome     = document.getElementById('nome').value.trim();
    const email    = document.getElementById('email').value.trim();
    const mensagem = document.getElementById('mensagem').value.trim();
    const msg      = document.getElementById('mensagemContato');

    if (!nome || !email || !mensagem) {
      msg.textContent = 'Preencha todos os campos.';
      msg.className = 'mensagem-auth erro';
      return;
    }

    fetch('/contato', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, mensagem })
    })
      .then((response) => response.json().then((data) => ({ status: response.status, body: data })))
      .then(({ status, body }) => {
        if (status !== 201) {
          msg.textContent = body.error || 'Falha ao enviar mensagem.';
          msg.className = 'mensagem-auth erro';
          return;
        }

        msg.textContent = 'Mensagem enviada com sucesso!';
        msg.className = 'mensagem-auth sucesso';
        formContato.reset();
      })
      .catch(() => {
        msg.textContent = 'Erro de conexão. Tente novamente.';
        msg.className = 'mensagem-auth erro';
      });
  });
}