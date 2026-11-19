// Contagem regressiva para 24/11/2026 às 14h45 no horário de Brasília.
// O deslocamento -03:00 fixa o instante correto independentemente do fuso do dispositivo.
(() => {
  const dataApresentacao = new Date('2026-11-24T14:45:00-03:00').getTime();

  const elementos = {
    dias: document.getElementById('pi-web-dias'),
    horas: document.getElementById('pi-web-horas'),
    minutos: document.getElementById('pi-web-minutos'),
    segundos: document.getElementById('pi-web-segundos'),
    status: document.getElementById('pi-web-status'),
  };

  // Evita erros caso o script seja carregado em uma página sem o contador.
  if (Object.values(elementos).some((elemento) => !elemento)) return;

  let intervalo;

  function atualizarContador() {
    const diferenca = dataApresentacao - Date.now();

    if (diferenca <= 0) {
      elementos.dias.textContent = '00';
      elementos.horas.textContent = '00';
      elementos.minutos.textContent = '00';
      elementos.segundos.textContent = '00';
      elementos.status.textContent = 'Chegou a hora da apresentação!';
      clearInterval(intervalo);
      return;
    }

    const segundo = 1000;
    const minuto = segundo * 60;
    const hora = minuto * 60;
    const dia = hora * 24;

    const dias = Math.floor(diferenca / dia);
    const horas = Math.floor((diferenca % dia) / hora);
    const minutos = Math.floor((diferenca % hora) / minuto);
    const segundos = Math.floor((diferenca % minuto) / segundo);

    elementos.dias.textContent = String(dias).padStart(2, '0');
    elementos.horas.textContent = String(horas).padStart(2, '0');
    elementos.minutos.textContent = String(minutos).padStart(2, '0');
    elementos.segundos.textContent = String(segundos).padStart(2, '0');
    elementos.status.textContent = 'Tempo restante para a apresentação';
  }

  atualizarContador();
  intervalo = setInterval(atualizarContador, 1000);
})();
