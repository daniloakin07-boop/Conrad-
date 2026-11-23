// JS/social-auth.js
// Login com Google e Facebook usando Passport (sem sessão do Passport:
// ao final, gravamos o usuário na sessão do express-session que você já usa).
//
// Atenção: os trechos marcados com TODO dependem de como o seu projeto
// já faz login (nome do módulo do MySQL, colunas da tb_usuarios, formato
// da sessão). Ajuste esses pontos para bater com o seu código.

const express = require('express');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: FacebookStrategy } = require('passport-facebook');

// TODO: troque pelo módulo/pool de conexão MySQL que o projeto já usa
// (precisa suportar `await db.query(sql, params)` retornando [rows]).
const db = require('./db');

const router = express.Router();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const LOGIN_PAGE = '/pages/login.html'; // TODO: confirme o caminho da sua página de login
const AFTER_LOGIN = '/';                // TODO: para onde o usuário vai depois de entrar

// ---------- Banco: acha ou cria o usuário ----------
async function findOrCreateUser({ provider, providerId, email, nome }) {
  // 1) Já entrou antes com esse provedor
  let [rows] = await db.query(
    'SELECT * FROM tb_usuarios WHERE provider = ? AND provider_id = ?',
    [provider, providerId]
  );
  if (rows[0]) return rows[0];

  // 2) Já existe conta com o mesmo e-mail: vincula ao provedor.
  //    (O Google verifica o e-mail. No Facebook, se preferir mais cautela,
  //    pule esta etapa e crie uma conta separada.)
  if (email) {
    [rows] = await db.query('SELECT * FROM tb_usuarios WHERE email = ?', [email]);
    if (rows[0]) {
      await db.query(
        'UPDATE tb_usuarios SET provider = ?, provider_id = ? WHERE id = ?',
        [provider, providerId, rows[0].id]
      );
      return rows[0];
    }
  }

  // 3) Conta nova.
  //    TODO: se a tabela tem a coluna `tipo` (migração 001), defina o valor
  //    padrão de quem se cadastra (ex.: 'aluno') no INSERT abaixo.
  const [result] = await db.query(
    'INSERT INTO tb_usuarios (nome, email, provider, provider_id) VALUES (?, ?, ?, ?)',
    [nome, email, provider, providerId]
  );
  return { id: result.insertId, nome, email };
}

// ---------- Estratégias do Passport ----------
function verify(provider) {
  return async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails && profile.emails[0] && profile.emails[0].value;
      const user = await findOrCreateUser({
        provider,
        providerId: profile.id,
        email,
        nome: profile.displayName,
      });
      done(null, user);
    } catch (err) {
      done(err);
    }
  };
}

// Só registra se as chaves existirem no .env (o servidor não quebra sem elas)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${BASE_URL}/auth/google/callback`,
      },
      verify('google')
    )
  );
}

if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: `${BASE_URL}/auth/facebook/callback`,
        profileFields: ['id', 'displayName', 'emails'],
      },
      verify('facebook')
    )
  );
}

// ---------- Sessão: mesmo formato do seu POST /login ----------
function iniciarSessao(req, res) {
  // TODO: copie aqui exatamente o que o seu POST /login grava na sessão,
  // para que GET /me e o resto do site reconheçam o usuário.
  req.session.user = {
    id: req.user.id,
    nome: req.user.nome,
    email: req.user.email,
    tipo: req.user.tipo,
  };
  req.session.save(() => res.redirect(AFTER_LOGIN));
}

// ---------- Rotas ----------
const falha = { session: false, failureRedirect: `${LOGIN_PAGE}?erro=social` };

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get('/google/callback', passport.authenticate('google', falha), iniciarSessao);

router.get('/facebook', passport.authenticate('facebook', { scope: ['email'], session: false }));
router.get('/facebook/callback', passport.authenticate('facebook', falha), iniciarSessao);

module.exports = router;
