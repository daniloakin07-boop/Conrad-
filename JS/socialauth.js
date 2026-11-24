
// JS/social-auth.js
// Login com Google e GitHub usando Passport.

const express = require('express');
const passport = require('passport');

const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: GitHubStrategy } = require('passport-github2');

// Conexão com o banco de dados
const db = require('./db');

const router = express.Router();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const LOGIN_PAGE = '/pages/login.html';
const AFTER_LOGIN = '/';

// ---------- Banco: acha ou cria o usuário ----------

async function findOrCreateUser({ provider, providerId, email, nome }) {

  // 1) Verifica se o usuário já entrou anteriormente
  let [rows] = await db.query(
    'SELECT * FROM tb_usuarios WHERE provider = ? AND provider_id = ?',
    [provider, providerId]
  );

  if (rows[0]) return rows[0];

  // 2) Verifica se já existe uma conta com o mesmo e-mail
  if (email) {

    [rows] = await db.query(
      'SELECT * FROM tb_usuarios WHERE email = ?',
      [email]
    );

    if (rows[0]) {

      await db.query(
        'UPDATE tb_usuarios SET provider = ?, provider_id = ? WHERE id = ?',
        [provider, providerId, rows[0].id]
      );

      return rows[0];
    }
  }

  // 3) Cria uma nova conta
  const [result] = await db.query(
    'INSERT INTO tb_usuarios (nome, email, provider, provider_id) VALUES (?, ?, ?, ?)',
    [nome, email, provider, providerId]
  );

  return {
    id: result.insertId,
    nome,
    email
  };
}

// ---------- Estratégias do Passport ----------

function verify(provider) {

  return async (_accessToken, _refreshToken, profile, done) => {

    try {

      const email =
        profile.emails &&
        profile.emails[0] &&
        profile.emails[0].value
          ? profile.emails[0].value
          : null;

      const nome =
        profile.displayName ||
        profile.username ||
        'Usuário';

      const user = await findOrCreateUser({
        provider,
        providerId: profile.id,
        email,
        nome
      });

      done(null, user);

    } catch (err) {

      done(err);

    }
  };
}

// ---------- Login com Google ----------

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

// ---------- Login com GitHub ----------

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {

  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${BASE_URL}/auth/github/callback`,
        scope: ['user:email'],
      },
      verify('github')
    )
  );

}

// ---------- Sessão ----------

function iniciarSessao(req, res) {

  req.session.user = {
    id: req.user.id,
    nome: req.user.nome,
    email: req.user.email,
    tipo: req.user.tipo,
  };

  req.session.save(() => {
    res.redirect(AFTER_LOGIN);
  });

}

// ---------- Configuração de falha ----------

const falha = {
  session: false,
  failureRedirect: `${LOGIN_PAGE}?erro=social`
};

// ---------- Rotas do Google ----------

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', falha),
  iniciarSessao
);

// ---------- Rotas do GitHub ----------

router.get(
  '/github',
  passport.authenticate('github', {
    scope: ['user:email'],
    session: false
  })
);

router.get(
  '/github/callback',
  passport.authenticate('github', falha),
  iniciarSessao
);

// ---------- Exportação ----------

module.exports = router;
