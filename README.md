# Conrad Virtual School

Projeto simples de uma plataforma web com páginas de cadastro, login e contato.

## O que o projeto faz

- Exibe páginas estáticas do site em HTML
- Permite cadastro de usuários
- Permite login de usuários
- Envia mensagens pelo formulário de contato
- Usa um servidor Node.js com Express
- Oferece bate-papo em tempo real com Socket.IO

## Tecnologias usadas

- Node.js
- Express
- HTML
- CSS
- JavaScript
- dotenv
- cors
- express-session
- bcryptjs
- socket.io

## Estrutura do projeto

```text
Conrad-
├── CSS/
├── JS/
├── img/
├── pages/
├── package.json
└── README.md
```

## Como rodar

1. Entre na pasta do projeto:
   ```bash
   cd Conrad-
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Inicie o servidor:
   ```bash
   npm start
   ```

4. Acesse no navegador:
   ```text
   http://localhost:3000
   ```

## Principais rotas

- GET `/` → redireciona para a página inicial
- POST `/cadastro` → cadastra um usuário
- POST `/login` → faz login
- GET `/me` → verifica se há sessão ativa
- POST `/logout` → encerra a sessão
- POST `/contato` → envia mensagem de contato
- GET `/health` → verifica se o servidor está funcionando

## Como testar o bate-papo

O chat está disponível em `/pages/bate-papo.html`. Inicie o projeto com `npm start` e abra essa página em duas janelas ou abas do navegador usando `http://localhost:3000`. As mensagens são transmitidas em tempo real, as últimas 100 mensagens ficam disponíveis para quem entra depois e o nome do usuário autenticado é usado automaticamente. Para testar sem login, o chat identifica o remetente como `Aluno Anônimo`.

O servidor deve ser iniciado pelo `JS/server.js`, pois o Socket.IO precisa compartilhar o mesmo servidor HTTP do Express. Não abra o HTML diretamente pelo arquivo (`file://`) nem use o Live Server para essa página; acesse a URL fornecida pelo Express.

## Observação

Os dados são armazenados em memória, então ao reiniciar o servidor eles são apagados. Para um projeto mais completo, seria possível guardar tudo em banco de dados.
