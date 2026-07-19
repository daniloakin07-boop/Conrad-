# Conrad Virtual School

Plataforma web para conectar alunos e educadores em um ambiente escolar digital, com cadastro, login e área de contato.

## Funcionalidades

- Cadastro de usuários como **estudante** ou **educador**
- Login com sessão (cookie), sem expor senha no front-end
- Redirecionamento automático para a página correta (`aluno.html` ou `educador.html`) após cadastro/login
- Verificação de sessão ativa (`/me`) e logout (`/logout`)
- Formulário de contato (`/contato`)

## Tecnologias

- **Back-end:** Node.js, Express
- **Sessão:** express-session
- **Senha:** bcryptjs (hash, nunca armazenada em texto puro)
- **CORS:** cors
- **Variáveis de ambiente:** dotenv
- **Front-end:** HTML, CSS e JavaScript puro (sem framework)

## Estrutura do projeto

```
conrad-virtual-school/
├── pages/          # Páginas HTML (index, login, cadastro, contato, aluno, educador...)
├── CSS/            # style.css e auth.css
├── JS/             # auth.js
├── img/            # Imagens do site
└── server/
    └── server.js   # Servidor Express
```

> Ajuste os caminhos acima conforme a organização real das suas pastas — o `server.js` serve os arquivos estáticos a partir da pasta raiz do projeto (`path.join(__dirname, "..")`).

## Como rodar localmente

1. Instale as dependências:
   ```bash
   npm install express cors dotenv express-session bcryptjs
   ```

2. Crie um arquivo `.env` na raiz com:
   ```
   PORT=3000
   SESSION_SECRET=uma_chave_secreta_qualquer
   NODE_ENV=development
   ```

3. Inicie o servidor:
   ```bash
   node server.js
   ```

4. Acesse `http://localhost:3000`

> **Importante:** os dados de usuários e mensagens de contato ficam apenas em memória (arrays). Isso significa que tudo é apagado quando o servidor reinicia. Para persistência real, é necessário conectar um banco de dados.

## Rotas da API

| Método | Rota         | Descrição                                      |
|--------|--------------|-------------------------------------------------|
| GET    | `/`          | Redireciona para `/pages/index.html`            |
| POST   | `/cadastro`  | Cria um novo usuário (`nome`, `email`, `senha`, `tipo`) e já inicia a sessão |
| POST   | `/login`     | Autentica o usuário (`email`, `senha`) e inicia a sessão |
| GET    | `/me`        | Retorna os dados da sessão ativa, se houver     |
| POST   | `/logout`    | Encerra a sessão do usuário                     |
| POST   | `/contato`   | Registra uma mensagem de contato (`nome`, `email`, `mensagem`) |
| GET    | `/health`    | Verifica se o servidor está no ar               |

## Deploy

Em produção (`NODE_ENV=production`), o servidor ajusta automaticamente as configurações de cookie (`secure` e `sameSite`) para funcionar em HTTPS, por exemplo no Render. Lembre-se de atualizar a `BASE_URL` no `auth.js` e a lista `listOrigins` no `server.js` com o domínio real do seu front-end.