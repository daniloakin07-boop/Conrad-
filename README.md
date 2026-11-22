# Conrad Virtual School

Projeto simples de uma plataforma web com páginas de cadastro, login e contato.

## O que o projeto faz

- Exibe páginas estáticas do site em HTML
- Permite cadastro de usuários
- Permite login de usuários
- Envia mensagens pelo formulário de contato
- Usa um servidor Node.js com Express
- Oferece bate-papo em tempo real com Socket.IO
- Permite que educadores criem turmas com código de entrada
- Organiza atividades, avaliações, entregas e sala de vídeo por turma

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
- PostgreSQL (Supabase) via `pg`

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

3. Copie `.env.example` para `.env` e preencha a senha do banco (não é a senha da sua conta Supabase):
   ```env
   DB_HOST=aws-0-us-east-1.pooler.supabase.com
   DB_PORT=5432
   DB_NAME=postgres
   DB_USER=postgres.xdgguheuntobmzfyeqbc
   DB_PASSWORD=sua-senha-do-banco
   DB_SSL=true
   DB_SSL_CA_PATH=C:\caminho\para\o\certificado-raiz-supabase.crt
   SESSION_SECRET=uma-chave-aleatoria
   ```
   No Windows PowerShell, copie com `Copy-Item .env.example .env`. Para corrigir erros de certificado TLS, baixe o certificado raiz em **Supabase Dashboard > Database Settings > SSL Configuration > Download Certificate** e substitua `DB_SSL_CA_PATH` pelo caminho completo do arquivo baixado. Com esse caminho configurado, o backend valida a conexão usando o certificado informado. Não desative a validação TLS. Não publique nem compartilhe o `.env`. A senha usada é a senha do banco definida no Supabase; se ela tiver caracteres especiais, este formato por variáveis individuais evita precisar codificá-los para URL. Se preferir `DATABASE_URL`, codifique esses caracteres.

4. No Supabase, abra **SQL Editor**, cole e execute `JS/migrations/supabase-schema-corrigido.sql`.

5. Inicie o servidor:
   ```bash
   npm start
   ```

6. Acesse no navegador:
   ```text
   http://localhost:3000
   ```

## Fluxo das salas virtuais

- Após cadastro ou login, o aluno acessa `Turmas`, informa o código do professor e entra na turma.
- O aluno é direcionado ao painel da turma ingressada; os cartões de turmas já ingressadas abrem a sala virtual com mural, atividades, avaliações, pessoas e vídeo.
- O educador cria uma turma em `Turmas` e compartilha o código exibido com seus alunos.
- Atividades e avaliações são publicadas dentro da turma escolhida e ficam disponíveis somente aos alunos matriculados nela.

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

Os dados da aplicação e as sessões são armazenados no PostgreSQL do Supabase. O servidor usa `DATABASE_URL` quando definida; caso contrário, usa `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD`.
