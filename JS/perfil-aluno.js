/*
===============================================
JS/perfil-aluno.js (compartilhado entre aluno e educador)
===============================================
Páginas: pages/perfil-aluno.html e pages/perfil-educador.html (perfil compartilhado)
Finalidade: carregar e editar o perfil do usuário autenticado — nome, e-mail, apresentação ("sobre mim"),
interesses, habilidades e foto — e mostrar quantas turmas ele tem.

API usada (via window.conradFetch, de JS/config.js):
  GET /perfil        -> { usuario, perfil: { sobre_mim, interesses[], habilidades[], foto_perfil } }
  PUT /perfil        -> grava as alterações (rota em JS/server.js; tabela tb_perfis_alunos)
  GET /api/turmas    -> conta as turmas vinculadas (aluno) ou gerenciadas (educador)
Regras (espelham o servidor, que confere tudo de novo): até 12 itens por lista; foto JPG/PNG/WebP
de até 8 MB, reduzida no navegador para no máximo 480 px e enviada como data URL JPEG.
Todo texto entra na tela com textContent. O script termina logo se o modal de edição não existir.
*/

(() => {
    // Atalho para getElementById e elementos principais do modal de edição
  const elemento = (id) => document.getElementById(id);
  const modal = elemento("modalEdicaoPerfil");
  const formulario = elemento("formPerfilAluno");
  const statusFormulario = elemento("perfilFormStatus");
  const botaoSalvar = elemento("salvarPerfilBtn");

  if (!modal || !formulario) return;

    // Estado: dados atuais, foto salva (fotoAtual) e foto escolhida ainda não salva (fotoRascunho)
  let usuarioAtual = null;
  let perfilAtual = {};
  let fotoAtual = "";
  let fotoRascunho = "";
  let turmasAtuais = [];

    // Iniciais (até 2 letras) mostradas quando o usuário não tem foto
  const iniciais = (nome) => String(nome || "A").trim().split(/\s+/).filter(Boolean)
    .slice(0, 2).map((parte) => parte.charAt(0)).join("").toUpperCase() || "A";

    // Aceita lista, texto JSON ou texto separado por vírgula/ponto e vírgula/quebra de linha
  const formatarLista = (valor) => {
    if (Array.isArray(valor)) return valor;
    if (typeof valor !== "string" || !valor.trim()) return [];
    try {
      const convertido = JSON.parse(valor);
      if (Array.isArray(convertido)) return convertido;
    } catch {
      // Compatibilidade com valores antigos separados por vírgula.
    }
    return valor.split(/[,;\n]+/);
  };

    // Normaliza uma lista: remove vazios e limita a 12 itens
  const limparLista = (valor) => formatarLista(valor)
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 12);

    // Mostra a foto (se houver) ou as iniciais, no par de elementos indicado
  function atualizarAvatar(foto, nome, fotoId, iniciaisId) {
    const fotoElemento = elemento(fotoId);
    const iniciaisElemento = elemento(iniciaisId);
    iniciaisElemento.textContent = iniciais(nome);

    if (foto) {
      fotoElemento.src = foto;
      fotoElemento.hidden = false;
      iniciaisElemento.hidden = true;
    } else {
      fotoElemento.removeAttribute("src");
      fotoElemento.hidden = true;
      iniciaisElemento.hidden = false;
    }
  }

    // Atualiza o avatar do cabeçalho do perfil e a prévia do formulário
  function mostrarAvatar(foto, nome) {
    atualizarAvatar(foto, nome, "profileAvatar", "profileInitials");
    atualizarAvatar(foto, nome, "profilePreview", "previewInitials");
  }

    // Atualiza apenas a prévia do formulário (usada ao escolher uma foto ainda não salva)
  function mostrarPreview(foto, nome) {
    atualizarAvatar(foto, nome, "profilePreview", "previewInitials");
  }

    // Desenha interesses/habilidades como etiquetas; mostra o aviso "vazio" quando não há itens
  function desenharTags(destino, vazio, itens) {
    destino.replaceChildren();
    vazio.hidden = itens.length > 0;

    itens.forEach((item) => {
      const tag = document.createElement("span");
      tag.className = "perfil-tag";
      tag.textContent = item;
      destino.appendChild(tag);
    });
  }

    // Preenche toda a página com os dados do usuário e do perfil recebidos do servidor
  function renderizarPerfil(perfil, usuario) {
    usuarioAtual = usuario;
    perfilAtual = perfil || {};
    fotoAtual = perfilAtual.foto_perfil || "";
    fotoRascunho = fotoAtual;
    const ehEducador = usuario.tipo === "educador";
    const papel = ehEducador ? "Educador" : "Estudante";
    const nome = usuario.nome || (ehEducador ? "Educador" : "Estudante");
    const email = usuario.email || "E-mail não informado";
    const interesses = limparLista(perfilAtual.interesses);
    const habilidades = limparLista(perfilAtual.habilidades);
    const quantidadeTurmas = turmasAtuais.length;
    const tipoTurma = ehEducador ? "gerenciada" : "vinculada";
    const resumoTurmas = quantidadeTurmas
      ? `${quantidadeTurmas} ${quantidadeTurmas === 1 ? "turma" : "turmas"} ${quantidadeTurmas === 1 ? tipoTurma : tipoTurma + "s"}`
      : (ehEducador ? "Nenhuma turma gerenciada" : "Nenhuma turma vinculada");

    elemento("profileName").textContent = nome;
    elemento("profileEmail").textContent = email;
    elemento("profileBio").textContent = perfilAtual.sobre_mim || (ehEducador
      ? "Adicione uma apresentação para que alunos e colegas conheçam um pouco mais sobre seu trabalho."
      : "Adicione uma apresentação para que seus colegas e educadores conheçam um pouco mais sobre você.");
    elemento("infoName").textContent = nome;
    elemento("infoEmail").textContent = email;
    elemento("infoClasses").textContent = quantidadeTurmas
      ? `${quantidadeTurmas} ${quantidadeTurmas === 1 ? "turma" : "turmas"}`
      : (ehEducador ? "Nenhuma turma gerenciada" : "Nenhuma turma vinculada");
    elemento("profileClassSummary").textContent = resumoTurmas;

    if (elemento("profileRole")) elemento("profileRole").textContent = `${papel} Conrad`;
    if (elemento("profileAccountType")) elemento("profileAccountType").textContent = papel;
    if (elemento("labelTurmasPerfil")) {
      elemento("labelTurmasPerfil").textContent = ehEducador ? "Turmas que gerencio" : "Minhas turmas";
    }

    // Mantém o nome e o papel sincronizados no menu e no cabeçalho após salvar o perfil.
    document.querySelectorAll(".menu-lateral .menu-perfil > strong").forEach((campo) => {
      campo.textContent = nome;
    });
    document.querySelectorAll(".menu-lateral .menu-perfil > span").forEach((campo) => {
      campo.textContent = papel;
    });
    const partesNome = nome.trim().split(/\s+/).filter(Boolean);
    const nomeTopo = ehEducador
      ? `Prof. ${partesNome[0] || nome}`
      : partesNome.length > 2 ? `${partesNome[0]} ${partesNome[partesNome.length - 1]}` : nome;
    const nomeNoCabecalho = document.querySelector(".topo .user-link span:not(.user-avatar)");
    if (nomeNoCabecalho) nomeNoCabecalho.textContent = nomeTopo;

    desenharTags(elemento("profileInterests"), elemento("interessesVazio"), interesses);
    desenharTags(elemento("profileSkills"), elemento("habilidadesVazio"), habilidades);
    mostrarAvatar(fotoAtual, nome);
  }

    // Copia os dados atuais para o formulário de edição ao abrir o modal
  function preencherFormulario() {
    if (!usuarioAtual) return;
    elemento("perfilNome").value = usuarioAtual.nome || "";
    elemento("perfilEmail").value = usuarioAtual.email || "";
    elemento("perfilBio").value = perfilAtual.sobre_mim || "";
    elemento("perfilInteresses").value = limparLista(perfilAtual.interesses).join(", ");
    elemento("perfilHabilidades").value = limparLista(perfilAtual.habilidades).join(", ");
    fotoRascunho = fotoAtual;
    mostrarPreview(fotoRascunho, usuarioAtual.nome);
    statusFormulario.textContent = "";
    statusFormulario.className = "perfil-form-status";
  }


    // Abre o modal de edição e trava a rolagem da página (overflow hidden no body)
  function abrirModal() {
    preencherFormulario();
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    elemento("perfilNome").focus();
  }

    // Fecha o modal, descarta alterações não salvas e restaura a foto atual
  function fecharModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    formulario.reset();
    elemento("photoInput").value = "";
    fotoRascunho = fotoAtual;
    mostrarAvatar(fotoAtual, usuarioAtual?.nome || "A");
  }

    // Botões que abrem/fecham o modal e a tecla Esc
  document.querySelectorAll("#abrirEdicaoPerfil, [data-editar-perfil]").forEach((botao) => {
    botao.addEventListener("click", abrirModal);
  });

  modal.querySelectorAll("[data-fechar-modal]").forEach((botao) => {
    botao.addEventListener("click", fecharModal);
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && !modal.hidden) fecharModal();
  });

    /**
     * Valida e reduz a foto escolhida: confere tipo/tamanho, redimensiona em um <canvas>
     * (lado maior = 480 px) e devolve um data URL JPEG com qualidade 0,82.
     * Lança Error com mensagem amigável se o arquivo for inválido.
     */
  async function prepararFoto(file) {
    if (!file) return "";
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      throw new Error("Escolha uma imagem JPG, PNG ou WebP.");
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new Error("A imagem deve ter no máximo 8 MB antes do ajuste.");
    }

    const url = URL.createObjectURL(file);
    try {
      const imagem = new Image();
      imagem.src = url;
      await new Promise((resolve, reject) => {
        imagem.onload = resolve;
        imagem.onerror = () => reject(new Error("Não foi possível abrir essa imagem."));
      });

      const maiorLado = Math.max(imagem.naturalWidth, imagem.naturalHeight);
      const escala = Math.min(1, 480 / maiorLado);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
      canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
      const contexto = canvas.getContext("2d");
      if (!contexto) throw new Error("Não foi possível preparar a imagem.");
      contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.82);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

    // Ao escolher uma foto: prepara e mostra a prévia (só é salva ao enviar o formulário)
  elemento("photoInput").addEventListener("change", async (evento) => {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    statusFormulario.textContent = "Preparando foto...";
    statusFormulario.className = "perfil-form-status";
    try {
      fotoRascunho = await prepararFoto(arquivo);
      mostrarPreview(fotoRascunho, usuarioAtual?.nome || "A");
      statusFormulario.textContent = "Foto pronta. Salve as alterações para atualizar o perfil.";
    } catch (erro) {
      statusFormulario.textContent = erro.message;
      statusFormulario.className = "perfil-form-status erro";
      evento.target.value = "";
    }
  });

    // Envio do formulário: valida nome/e-mail, faz PUT /perfil e atualiza a tela com a resposta
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (typeof window.conradFetch !== "function") {
      statusFormulario.textContent = "A conexão com o servidor não está disponível.";
      statusFormulario.className = "perfil-form-status erro";
      return;
    }

    const payload = {
      nome: elemento("perfilNome").value.trim(),
      email: elemento("perfilEmail").value.trim(),
      sobre_mim: elemento("perfilBio").value.trim(),
      interesses: limparLista(elemento("perfilInteresses").value),
      habilidades: limparLista(elemento("perfilHabilidades").value),
      foto_perfil: fotoRascunho
    };

    if (!payload.nome || !payload.email) {
      statusFormulario.textContent = "Preencha seu nome e e-mail.";
      statusFormulario.className = "perfil-form-status erro";
      return;
    }

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";
    statusFormulario.textContent = "";
    statusFormulario.className = "perfil-form-status";

    try {
      const resposta = await window.conradFetch("/perfil", {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      usuarioAtual = resposta.usuario;
      fotoAtual = resposta.perfil.foto_perfil || "";
      fotoRascunho = fotoAtual;
      renderizarPerfil(resposta.perfil, resposta.usuario);
      statusFormulario.textContent = "Perfil atualizado com sucesso!";
      statusFormulario.className = "perfil-form-status sucesso";
      window.setTimeout(fecharModal, 650);
    } catch (erro) {
      if (erro.status === 401) {
        window.location.href = "login.html";
        return;
      }
      statusFormulario.textContent = erro.message || "Não foi possível salvar seu perfil.";
      statusFormulario.className = "perfil-form-status erro";
    } finally {
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = "Salvar alterações";
    }
  });

    // Busca as turmas para o resumo "N turmas vinculadas" (falha silenciosa: mostra 0)
  async function carregarTurmas() {
    try {
      const dados = await window.conradFetch("/api/turmas");
      turmasAtuais = Array.isArray(dados.turmas) ? dados.turmas : [];
    } catch {
      turmasAtuais = [];
    }
  }

    // Ponto de entrada: carrega perfil e turmas em paralelo e desenha a página (401 -> login)
  async function iniciar() {
    if (typeof window.conradFetch !== "function") {
      elemento("profileName").textContent = "Perfil indisponível";
      elemento("profileEmail").textContent = "Não foi possível conectar ao servidor.";
      return;
    }

    try {
      const [dadosPerfil] = await Promise.all([
        window.conradFetch("/perfil"),
        carregarTurmas()
      ]);
      renderizarPerfil(dadosPerfil.perfil || {}, dadosPerfil.usuario || {});
    } catch (erro) {
      if (erro.status === 401) {
        window.location.href = "login.html";
        return;
      }
      elemento("profileName").textContent = "Não foi possível carregar o perfil";
      elemento("profileEmail").textContent = erro.message || "Tente atualizar a página.";
      elemento("profileClassSummary").textContent = "";
      elemento("infoClasses").textContent = "Indisponível";
    }
  }

  iniciar();
})();
