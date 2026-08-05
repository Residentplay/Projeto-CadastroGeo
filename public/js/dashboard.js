function renderizarResumo(dadosDashboard){

  document.getElementById("dash-total").textContent =
    dadosDashboard.totalMissoes;

  document.getElementById("dash-pendentes").textContent =
    dadosDashboard.pendentes;

  document.getElementById("dash-andamento").textContent =
    dadosDashboard.andamento;

  document.getElementById("dash-concluidas").textContent =
    dadosDashboard.concluidas;

}