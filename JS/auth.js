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

    // TODO: fetch('/login', { method: 'POST', body: JSON.stringify({ email, senha }) })
    console.log('Login:', { email });
    msg.textContent = 'Login realizado com sucesso!';
    msg.className = 'mensagem-auth sucesso';
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

    // TODO: fetch('/cadastro', { method: 'POST', body: JSON.stringify({ nome, email, senha, tipo }) })
    console.log('Cadastro:', { nome, email, tipo });
    msg.textContent = 'Conta criada com sucesso!';
    msg.className = 'mensagem-auth sucesso';
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

    // TODO: fetch('/contato', { method: 'POST', body: JSON.stringify({ nome, email, mensagem }) })
    console.log('Contato:', { nome, email });
    msg.textContent = 'Mensagem enviada com sucesso!';
    msg.className = 'mensagem-auth sucesso';
    formContato.reset();
  });
}