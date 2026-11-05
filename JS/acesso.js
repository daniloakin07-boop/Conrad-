/*
===============================================
REGRAS DE ACESSO ÀS PÁGINAS E AOS ARQUIVOS
===============================================
Usado apenas pelo servidor (JS/server.js). Fica separado para poder ser testado
sem subir o Express: veja JS/acesso.test.js (rode com `npm test`).
*/

// Compara nomes sem diferença de maiúsculas/minúsculas e de acentuação "decomposta"
// (ex.: "avaliação.html" digitado de formas diferentes continua sendo a mesma página).
const normalizar = (texto) => String(texto).normalize("NFC").toLowerCase();
const conjunto = (...nomes) => new Set(nomes.map(normalizar));

// Páginas internas de cada tipo de usuário (dentro de /pages)
const PAGINAS_ALUNO = conjunto(
    "aluno.html",
    "aluno-atividades.html",
    "perfil-aluno.html",
    "boletim.html",
    "dashboard.html"
);

const PAGINAS_EDUCADOR = conjunto(
    "educador.html",
    "perfil-educador.html",
    "agenda-professor.html",
    "professor-correcao.html",
    "nova-atividade.html",
    "nova-avaliacao.html"
);

// Páginas internas que qualquer usuário logado pode abrir
const PAGINAS_COMUNS = conjunto("salas.html", "bate-papo.html");

// Páginas antigas (de exemplo) que foram substituídas. Quem abrir um link/favorito
// antigo é levado para a página que faz o mesmo papel hoje.
const PAGINAS_ANTIGAS = conjunto("atividades.html", "avaliação.html");

const ehEducador = (usuario) => usuario?.tipo === "educador";

// Extrai o nome da página do que vem depois de /pages na URL (ex.: "/aluno.html").
// Decodifica ANTES de decidir (aluno%2Ehtml = aluno.html) e ignora barras repetidas
// (/pages//aluno.html). Retorna null para o que não é um nome de arquivo simples:
// subpastas, "..", barras invertidas ou URL malformada. O servidor responde 404 nesses casos.
function nomeDaPagina(caminhoUrl) {
    let texto;
    try {
        texto = decodeURIComponent(caminhoUrl);
    } catch {
        return null;
    }
    texto = texto.replace(/^\/+/, "");
    if (texto.includes("/") || texto.includes("\\") || texto.includes("\0")) return null;
    return texto;
}

// Decide o que fazer com um pedido para /pages/<pagina>.
// Retorna { acao: "liberar" | "redirecionar", destino?, privada }
//   - privada: true quando a página só deve ser vista por quem está logado
//     (o servidor manda "Cache-Control: no-store" para o botão "Voltar" não reabrir a tela depois do Sair).
// Contas antigas têm `tipo` vazio e são tratadas como aluno (igual ao JS/layout.js).
function decidirAcesso(pagina, usuario) {
    const nome = normalizar(pagina);

    if (PAGINAS_ANTIGAS.has(nome)) {
        if (!usuario) return { acao: "redirecionar", destino: "/pages/login.html", privada: true };
        return {
            acao: "redirecionar",
            destino: ehEducador(usuario) ? "/pages/professor-correcao.html" : "/pages/aluno-atividades.html",
            privada: true
        };
    }

    const doAluno = PAGINAS_ALUNO.has(nome);
    const doEducador = PAGINAS_EDUCADOR.has(nome);

    // Qualquer outra página (index, login, cadastro, sobre, contato...) é pública
    if (!doAluno && !doEducador && !PAGINAS_COMUNS.has(nome)) {
        return { acao: "liberar", privada: false };
    }

    if (!usuario) return { acao: "redirecionar", destino: "/pages/login.html", privada: true };
    if (doAluno && ehEducador(usuario)) return { acao: "redirecionar", destino: "/pages/educador.html", privada: true };
    if (doEducador && !ehEducador(usuario)) return { acao: "redirecionar", destino: "/pages/aluno.html", privada: true };

    return { acao: "liberar", privada: true };
}

// Scripts da pasta JS/ que o navegador pode baixar. Todo o resto
// (server.js, db.js, medias.js, atividades.js, sessionStore.js, acesso.js, migrations...)
// fica fora do ar. Se criar um novo script de front-end, acrescente o nome aqui.
const JS_PUBLICOS = new Set([
    "auth.js",
    "boletim.js",
    "config.js",
    "educador.js",
    "horarios.js",
    "layout.js",
    "salas.js",
    "script.js"
]);

// `caminhoUrl` é o que vem depois de /JS na URL (ex.: "/layout.js", "/server%2Ejs").
// O caminho é decodificado ANTES de comparar, para que "server%2Ejs" não escape do bloqueio.
function arquivoJsPublico(caminhoUrl) {
    let nome;
    try {
        nome = decodeURIComponent(caminhoUrl);
    } catch {
        return false; // URL malformada
    }
    return JS_PUBLICOS.has(nome.replace(/^\/+/, ""));
}

module.exports = { decidirAcesso, arquivoJsPublico, nomeDaPagina, JS_PUBLICOS };
