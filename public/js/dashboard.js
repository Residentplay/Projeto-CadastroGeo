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

function renderizarEquipe(dadosEquipe, casasAtuais){

  const lista = document.getElementById("lista-equipe");

  lista.innerHTML = "";

  dadosEquipe.forEach(item => {

    const usuario = users.find(
      u => u.user === item.colaborador
    );

    const nome = usuario
      ? usuario.name
      : item.colaborador;

    const casaAtual = casasAtuais.find(
      casa => casa.colaborador === item.colaborador
    );  

    lista.innerHTML += `
      <div class="card" style="margin-top:10px;padding:15px;">

        <strong>${nome}</strong>

        ${casaAtual ? `
          <div style="margin-top:8px;color:#ffd600;">
            📍 Casa atual: ${casaAtual.numero || casaAtual.casa_id}
          </div>

          <div style="margin-top:4px;color:#ffd600;">
            🟡 Em andamento
          </div>
        ` : `
          <div style="margin-top:8px;color:var(--text2);">
            Sem missão em andamento
          </div>
        `}

        <div style="margin-top:8px;">
          Total: ${item.total}
        </div>

        <div style="margin-top:4px;">
          🟡 Pendentes: ${item.pendentes}
        </div>

        <div style="margin-top:4px;">
          🔵 Em andamento: ${item.andamento}
        </div>

        <div style="margin-top:4px;">
          🟢 Concluídas: ${item.concluidas}
        </div>

      </div>
    `;

  });

}

async function atualizarDashboard(){

  const res = await fetch("/dashboard");
  const dadosDashboard = await res.json();

  renderizarResumo(dadosDashboard);

}

window.carregarDashboard = async function(){

  const res = await fetch("/dashboard");
  const dadosDashboard = await res.json();
  const resEquipe = await fetch("/dashboard/equipe");
  const dadosEquipe = await resEquipe.json();
  const resCasasAtuais = await fetch("/dashboard/casas-atuais");
  const casasAtuais = await resCasasAtuais.json();

  document.getElementById("dashboard-resumo").innerHTML = `

  
  
    <div class="card">
      <h3>📍 Total de Missões</h3>
      <h1 id="dash-total">0</h1>
    </div>

    <div class="card">
      <h3>🟡 Pendentes</h3>
      <h1 id="dash-pendentes">0</h1>
    </div>

    <div class="card">
      <h3>🔵 Em andamento</h3>
      <h1 id="dash-andamento">0</h1>
    </div>

    <div class="card">
      <h3>🟢 Concluídas</h3>
      <h1 id="dash-concluidas">0</h1>
    </div>

  `;

  document.getElementById("dashboard-equipe").innerHTML = `
    <h2>👷 Equipe</h2>
    <div id="lista-equipe"></div>
  `;
  
  renderizarResumo(dadosDashboard);
  renderizarEquipe(dadosEquipe, casasAtuais);
  renderizarEquipe(dadosEquipe, casasAtuais);
  

  if(window.dashboardTimer){
    clearInterval(window.dashboardTimer);
  }

  window.dashboardTimer = setInterval(() => {

    atualizarDashboard();

  },10000);

};