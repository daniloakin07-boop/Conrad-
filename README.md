# CONRAD Virtual School

Plataforma web de apoio ao ambiente escolar, desenvolvida para aproximar estudantes e educadores por meio de turmas virtuais, atividades, avaliações, acompanhamento de notas e comunicação.

> **Repositório:** [daniloakin07-boop/Conrad-](https://github.com/daniloakin07-boop/Conrad-)

## Sumário

- [Sobre o projeto](#sobre-o-projeto)
- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Requisitos](#requisitos)
- [Instalação e execução](#instalação-e-execução)
- [Configuração do banco de dados](#configuração-do-banco-de-dados)
- [Como utilizar](#como-utilizar)
- [Principais rotas da API](#principais-rotas-da-api)
- [Testes](#testes)
- [Segurança e configuração](#segurança-e-configuração)

## Sobre o projeto

O **CONRAD Virtual School** é uma aplicação web que oferece recursos para a organização de atividades escolares e a interação entre estudantes e educadores. O sistema possui páginas públicas e áreas autenticadas, com funcionalidades específicas para cada tipo de usuário.

A aplicação utiliza uma interface desenvolvida com HTML, CSS e JavaScript, enquanto o servidor é construído com Node.js e Express. Os dados são armazenados em PostgreSQL, com suporte à utilização do Supabase como serviço de banco de dados.

## Funcionalidades

### Recursos gerais

- Cadastro e autenticação de usuários.
- Sessão de usuário e encerramento de sessão.
- Edição de informações da conta e do perfil.
- Formulário de contato.
- Interface responsiva e componentes visuais compartilhados.
- Alternância de tema e elementos comuns de navegação.

### Área do estudante

- Painel do estudante.
- Visualização e ingresso em turmas por código.
- Consulta de atividades e avaliações das turmas em que está matriculado.
- Envio ou atualização de entregas.
- Consulta de notas, médias e boletim.
- Visualização e edição do perfil.
- Acesso ao bate-papo e às salas de vídeo.

### Área do educador

- Painel de acompanhamento.
- Criação e gerenciamento de turmas.
- Geração de códigos de entrada para as turmas.
- Publicação de atividades e avaliações.
- Consulta às entregas dos estudantes.
- Correção de entregas, registro de notas e feedback.
- Consulta de médias e informações das turmas.
- Agenda do professor e edição do perfil.
- Comunicação com estudantes pelo bate-papo.

### Comunicação

- Bate-papo privado entre educador e estudante, condicionado ao vínculo do usuário com a turma.
- Envio e consulta de mensagens em tempo real por meio do Socket.IO.
- Suporte a anexos nas conversas privadas.

## Tecnologias

| Tecnologia | Utilização |
|---|---|
| HTML5 | Estrutura das páginas |
| CSS3 | Estilização, layout e responsividade |
| JavaScript | Interações e funcionalidades do front-end |
| Node.js | Ambiente de execução do servidor |
| Express | Servidor HTTP e rotas da aplicação |
| PostgreSQL | Banco de dados relacional |
| Supabase | Hospedagem/serviço PostgreSQL |
| `pg` | Conexão com PostgreSQL |
| Socket.IO | Comunicação em tempo real |
| `express-session` | Gerenciamento de sessões |
| `bcryptjs` | Hash e verificação de senhas |
| `cors` | Configuração de acesso entre origens |
| `dotenv` | Leitura de variáveis de ambiente |

## Estrutura do projeto

```text
Conrad-/
├── CSS/                         # Folhas de estilo
│   ├── variaveis.css             # Variáveis visuais e de tema
│   ├── geral.css                 # Estilos gerais e estrutura compartilhada
│   ├── componentes.css           # Componentes reutilizáveis
│   ├── usuarios.css               # Estilos das áreas e páginas de usuário
│   ├── atividades.css             # Estilos de atividades e avaliações
│   └── contador-projeto.css       # Estilos do contador da apresentação
│
├── JS/                          # Scripts do front-end e módulos do servidor
│   ├── server.js                  # Inicialização do Express e rotas principais
│   ├── db.js                      # Pool e adaptação da conexão PostgreSQL
│   ├── config.js                  # Configuração da API no front-end
│   ├── auth.js                    # Fluxos de autenticação das páginas públicas
│   ├── layout.js                  # Navegação e layout compartilhado
│   ├── tema.js                    # Controle do tema visual
│   ├── turmas.js                  # Rotas de turmas e matrículas
│   ├── atividades.js              # Rotas de atividades, entregas e correções
│   ├── medias.js                  # Cálculo de médias e dados do boletim
│   ├── chat.js                    # Rotas e eventos do bate-papo privado
│   ├── chat-privado.js            # Interface do bate-papo
│   ├── sessionStore.js            # Persistência de sessões
│   ├── migrations/                # Scripts SQL de criação e atualização do banco
│   └── ...                        # Outros módulos das páginas e funcionalidades
│
├── pages/                        # Páginas HTML da aplicação
│   ├── cadastro.html
│   ├── login.html
│   ├── contato.html
│   ├── aluno.html
│   ├── educador.html
│   ├── turmas.html
│   ├── turma.html
│   ├── aluno-atividades.html
│   ├── nova-atividade.html
│   ├── nova-avaliacao.html
│   ├── professor-correcao.html
│   ├── boletim.html
│   ├── perfil-aluno.html
│   ├── perfil-educador.html
│   ├── bate-papo.html
│   └── ...
│
├── img/                          # Imagens, banners e emblemas
├── data/                         # Arquivos JSON de apoio
├── certs/                        # Certificados utilizados na conexão TLS, quando aplicável
├── index.html                    # Página inicial
├── package.json                  # Dependências e scripts npm
├── package-lock.json             # Versões instaladas das dependências
└── README.md                     # Documentação do projeto
```

## Requisitos

Antes de executar o projeto, tenha instalado:

- [Node.js](https://nodejs.org/) em uma versão compatível com as dependências.
- npm (incluído na instalação do Node.js).
- Uma instância PostgreSQL acessível. O projeto pode utilizar um banco Supabase.
- Git, caso deseje clonar o repositório.

## Instalação e execução

1. Clone o repositório:

   ```bash
   git clone https://github.com/daniloakin07-boop/Conrad-.git
   ```

2. Acesse a pasta do projeto:

   ```bash
   cd Conrad-
   ```

3. Instale as dependências:

   ```bash
   npm install
   ```

4. Crie o arquivo `.env` na raiz do projeto e configure as variáveis de ambiente descritas na próxima seção.

5. Configure o banco de dados executando o script SQL indicado em [Configuração do banco de dados](#configuração-do-banco-de-dados).

6. Inicie o servidor:

   ```bash
   npm start
   ```

7. Acesse a aplicação pelo navegador:

   ```text
   http://localhost:3000
   ```

O comando `npm start` executa `JS/server.js`. Para páginas que dependem de sessão, API ou comunicação em tempo real, utilize o endereço servido pelo Express, e não abra os arquivos HTML diretamente pelo protocolo `file://`.

## Configuração do banco de dados

O projeto utiliza PostgreSQL por meio do pacote `pg`. A conexão aceita duas formas de configuração: uma URL completa (`DATABASE_URL`) ou variáveis individuais.

Exemplo de `.env` utilizando variáveis individuais:

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=defina-uma-chave-aleatoria-e-segura

DB_HOST=seu-host-postgresql
DB_PORT=5432
DB_NAME=postgres
DB_USER=seu-usuario
DB_PASSWORD=sua-senha-do-banco
DB_SSL=true

# Opcional: caminho do certificado CA, quando necessário
DB_SSL_CA_PATH=certs/prod-ca-2021.crt
```

Também é possível utilizar:

```env
DATABASE_URL=postgresql://usuario:senha@host:5432/postgres
```

Quando `DATABASE_URL` está definida, ela tem prioridade sobre as variáveis individuais. Não mantenha as duas configurações com valores conflitantes.

### Criar as tabelas

No painel do Supabase, abra o **SQL Editor**, copie o conteúdo de `JS/migrations/supabase-schema-corrigido.sql` e execute o script no banco utilizado pela aplicação.

As migrações adicionais em `JS/migrations/` documentam alterações específicas no esquema. Confira quais já foram aplicadas antes de executar scripts individualmente.

### Certificado SSL/TLS

Se o provedor do banco exigir um certificado CA, configure `DB_SSL_CA_PATH` com o caminho do arquivo no ambiente em que o servidor será executado. O repositório contém arquivos de certificado na pasta `certs/`; confirme que o certificado corresponde ao provedor e ao ambiente utilizado.

Não desative a validação do certificado TLS em produção como forma de contornar erros de conexão.

## Como utilizar

### Estudante

1. Crie uma conta pela página de cadastro ou entre com uma conta existente.
2. Acesse a área de turmas.
3. Informe o código de entrada fornecido pelo educador para ingressar em uma turma.
4. Abra a turma para consultar as atividades e avaliações disponibilizadas.
5. Envie suas entregas e acompanhe as notas e os feedbacks nas páginas correspondentes.

### Educador

1. Crie uma conta selecionando o perfil de educador ou entre com uma conta existente.
2. Acesse o painel e crie uma turma.
3. Compartilhe o código de entrada gerado com os estudantes.
4. Publique atividades ou avaliações na turma desejada.
5. Consulte as entregas recebidas e registre notas e feedbacks na área de correção.

## Principais rotas da API

As rotas abaixo representam os principais endpoints identificados nos módulos atuais do servidor. As rotas protegidas exigem uma sessão válida e, conforme a funcionalidade, o tipo de usuário correspondente.

| Método | Endpoint | Finalidade |
|---|---|---|
| `GET` | `/` | Redireciona para a página inicial |
| `POST` | `/cadastro` | Cadastra um usuário |
| `POST` | `/login` | Autentica um usuário |
| `GET` | `/me` | Retorna os dados básicos da sessão atual |
| `POST` | `/logout` | Encerra a sessão |
| `GET` | `/perfil` | Consulta conta e informações do perfil autenticado |
| `PUT` | `/perfil` | Atualiza conta e informações do perfil |
| `POST` | `/contato` | Registra uma mensagem enviada pelo formulário de contato |
| `GET` | `/health` | Verifica se o servidor está respondendo |
| `GET` | `/api/turmas` | Lista as turmas disponíveis para o usuário autenticado |
| `POST` | `/api/turmas` | Cria uma turma (educador) |
| `POST` | `/api/turmas/entrar` | Permite ao estudante ingressar por código |
| `GET` | `/api/turmas/:id` | Consulta detalhes e participantes da turma |
| `DELETE` | `/api/turmas/:id/alunos/:alunoId` | Remove um estudante da turma (educador) |
| `POST` | `/api/atividades` | Publica atividade ou avaliação (educador) |
| `GET` | `/api/atividades` | Lista atividades do educador |
| `GET` | `/api/atividades/:id/entregas` | Lista entregas de uma atividade |
| `PUT` | `/api/entregas/:id/correcao` | Registra correção, nota e feedback |
| `GET` | `/api/aluno/atividades` | Lista atividades do estudante |
| `POST` | `/api/atividades/:id/entrega` | Envia ou atualiza a entrega do estudante |
| `GET` | `/api/medias` | Consulta médias para o educador |
| `GET` | `/api/boletim` | Consulta boletim do estudante autenticado |
| `GET` | `/api/chat/contatos` | Lista contatos com vínculo permitido |
| `GET` | `/api/chat/contexto` | Valida e carrega o contexto de uma conversa |

O Socket.IO também é utilizado para os eventos de comunicação em tempo real. Os eventos são configurados em `JS/chat.js` e compartilham a sessão do Express.

## Testes

O `package.json` disponibiliza o comando:

```bash
npm test
```

Esse comando executa o test runner nativo do Node.js (`node --test`). A existência do script não garante, por si só, cobertura automatizada; verifique os arquivos de teste presentes no repositório antes de considerar uma funcionalidade validada.