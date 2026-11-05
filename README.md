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

3. Atualize o esquema do MySQL, no banco configurado no `.env`, executando as migrações nesta ordem:
   - `JS/migrations/001-add-tipo-to-tb-usuarios.sql`
   - `JS/migrations/003-create-atividades-notas.sql`
   - `JS/migrations/002-atividades-entregas.sql`
   - `JS/migrations/004-turmas-e-salas.sql`
   - `JS/migrations/006-atividades-colunas-avaliativas.sql`
   - `JS/migrations/005-atividades-contam-no-boletim.sql`

   As migrações preparam os tipos de usuário, atividades, notas, entregas, turmas, códigos de entrada e salas de vídeo. Execute-as no banco `defaultdb` configurado no `.env`, usando um cliente MySQL, e confirme que cada uma terminou sem erros antes de iniciar o servidor. Elas não removem dados. Se já existirem notas duplicadas para o mesmo aluno e atividade, a migração `002` para ao criar a restrição única; revise os registros duplicados antes de executá-la novamente. As migrações `001` e `003` devem ser aplicadas apenas uma vez; as migrações `004` e `006` são seguras para reaplicar.

4. Inicie o servidor:
   ```bash
   npm start
   ```

5. Acesse no navegador:
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

Os dados são armazenados em memória, então ao reiniciar o servidor eles são apagados. Para um projeto mais completo, seria possível guardar tudo em banco de dados.
