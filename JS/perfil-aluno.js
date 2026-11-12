// Carrega e atualiza os dados do perfil do estudante.
(() => {
  const elemento = (id) => document.getElementById(id);
  const modal = elemento("modalEdicaoPerfil");
  const formulario = elemento("formPerfilAluno");
  const statusFormulario = elemento("perfilFormStatus");
  const botaoSalvar = elemento("salvarPerfilBtn");

  if (!modal || !formulario) return;

  let usuarioAtual = null;
  let perfilAtual = {};
  let fotoAtual = "";
  let fotoRascunho = "";
  let turmasAtuais = [];

  const iniciais = (nome) => String(nome || "A").trim().split(/\s+/).filter(Boolean)
    .slice(0, 2).map((parte) => parte.charAt(0)).join("").toUpperCase() || "A";

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

  const limparLista = (valor) => formatarLista(valor)
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 12);

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

  function mostrarAvatar(foto, nome) {
    atualizarAvatar(foto, nome, "profileAvatar", "profileInitials");
    atualizarAvatar(foto, nome, "profilePreview", "previewInitials");
  }

  function mostrarPreview(foto, nome) {
    atualizarAvatar(foto, nome, "profilePreview", "previewInitials");
  }

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

  function renderizarPerfil(perfil, usuario) {
    usuarioAtual = usuario;
    perfilAtual = perfil || {};
    fotoAtual = perfilAtual.foto_perfil || "";
    fotoRascunho = fotoAtual;
    const nome = usuario.nome || "Estudante";
    const email = usuario.email || "E-mail não informado";
    const interesses = limparLista(perfilAtual.interesses);
    const habilidades = limparLista(perfilAtual.habilidades);

    elemento("profileName").textContent = nome;
    elemento("profileEmail").textContent = email;
    elemento("profileBio").textContent = perfilAtual.sobre_mim || "Adicione uma apresentação para que seus colegas e educadores conheçam um pouco mais sobre você.";
    elemento("infoName").textContent = nome;
    elemento("infoEmail").textContent = email;
    elemento("infoClasses").textContent = turmasAtuais.length
      ? `${turmasAtuais.length} ${turmasAtuais.length === 1 ? "turma" : "turmas"}`
      : "Nenhuma turma vinculada";
    elemento("profileClassSummary").textContent = turmasAtuais.length
      ? `${turmasAtuais.length} ${turmasAtuais.length === 1 ? "turma vinculada" : "turmas vinculadas"}`
      : "Ainda sem turma vinculada";

    desenharTags(elemento("profileInterests"), elemento("interessesVazio"), interesses);
    desenharTags(elemento("profileSkills"), elemento("habilidadesVazio"), habilidades);
    mostrarAvatar(fotoAtual, nome);
  }

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


  function abrirModal() {
    preencherFormulario();
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    elemento("perfilNome").focus();
  }

  function fecharModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    formulario.reset();
    elemento("photoInput").value = "";
    fotoRascunho = fotoAtual;
    mostrarAvatar(fotoAtual, usuarioAtual?.nome || "A");
  }

  document.querySelectorAll("#abrirEdicaoPerfil, [data-editar-perfil]").forEach((botao) => {
    botao.addEventListener("click", abrirModal);
  });

  modal.querySelectorAll("[data-fechar-modal]").forEach((botao) => {
    botao.addEventListener("click", fecharModal);
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && !modal.hidden) fecharModal();
  });

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

  async function carregarTurmas() {
    try {
      const dados = await window.conradFetch("/api/turmas");
      turmasAtuais = Array.isArray(dados.turmas) ? dados.turmas : [];
    } catch {
      turmasAtuais = [];
    }
  }

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
