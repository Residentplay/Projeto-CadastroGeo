let missaoAtual = null;


window.voltarMissoes = function(){

  document
    .getElementById("modal-missao")
    .classList.remove("open");

  switchView("missoes");

};


window.proximaMissao = function(){

  document
    .getElementById("modal-missao")
    .classList.remove("open");

  iniciarTrabalho();

};


window.carregarTelaMissoes = async function(){

  const lista = document.getElementById("lista-missoes");

  lista.innerHTML = "<p>Carregando...</p>";

  try{

    let missoes = [];

    if (navigator.onLine) {

      const res = await fetch(
        "/minhas-missoes/" + currentUser.user
      );

      missoes = await res.json();

      await salvarMissoesOffline(missoes);

    } else {

      missoes = await carregarMissoesOffline();

      showToast(
        "Sem internet. Exibindo missões salvas no aparelho."
      );

    }

    missoes.forEach(missao => {

      const casa = houses.find(h =>
        h.id === missao.casa_id
      );

      if(casa){
        casa.statusMissao = missao.status_missao;
      }

    });

    if(missoes.length === 0){

      lista.innerHTML = `
        <div class="empty-state">
          <h3>📭 Nenhuma missão atribuída</h3>
          <p>O engenheiro ainda não atribuiu nenhuma casa para você.</p>
        </div>
      `;

      return;

    }

    lista.innerHTML = "";

    missoes.forEach(missao =>{

      const card = document.createElement("div");

      card.className = "card";

      card.innerHTML = `

        <h3>🏠 ${missao.numero || "Casa"}</h3>

        <p>
          ${missao.endereco || "Endereço ainda não cadastrado"}
        </p>

        <p>
          ${missao.bairro || ""}
        </p>

        <p>
          Status: ${missao.status_missao || "pendente"}
        </p>

        <button
          class="btn btn-primary"
          onclick="navegarParaCasa(
            ${missao.latitude},
            ${missao.longitude}
          )">
          🧭 Navegar
        </button>

        <button
          class="btn btn-secondary"
          onclick="abrirCadastroMissao('${missao.casa_id}')">

          📋 Abrir Cadastro

        </button>

      `;

      lista.appendChild(card);

    });

  }catch(err){

    console.error(err);

    lista.innerHTML =
      "<p>Erro ao carregar missões.</p>";

  }

};


window.iniciarTrabalho = async function(){

  if(!navigator.geolocation){

    showToast("GPS não disponível neste dispositivo!", true);

    return;

  }

  navigator.geolocation.getCurrentPosition(

    async posicao => {

      try{

        const minhaLat = posicao.coords.latitude;
        const minhaLng = posicao.coords.longitude;

        const res = await fetch(
          "/minhas-missoes/" + currentUser.user,
          {
            headers: authHeaders()
          }
        );

        const missoes = await res.json();

        const pendentes = missoes.filter(
          missao =>
            missao.status_missao === "pendente" &&
            Number.isFinite(Number(missao.latitude)) &&
            Number.isFinite(Number(missao.longitude))
        );

        if(!pendentes.length){

          showToast("Você não possui missões pendentes!");

          return;

        }

        pendentes.forEach(missao => {

          missao.distancia = calcularDistancia(
            minhaLat,
            minhaLng,
            Number(missao.latitude),
            Number(missao.longitude)
          );

        });

        pendentes.sort(
          (a, b) => a.distancia - b.distancia
        );

        const maisProxima = pendentes[0];

        missaoAtual = maisProxima.casa_id;

        atualizarMissaoAtual();

        navegarParaCasa(
          maisProxima.latitude,
          maisProxima.longitude
        );

      }catch(err){

        console.error(err);

        showToast("Erro ao iniciar trabalho!", true);

      }

    },

    erro => {

      console.error("Erro GPS:", erro);

      showToast(
        "Não foi possível obter sua localização.",
        true
      );

    },

    {
      enableHighAccuracy:false,
      timeout:30000,
      maximumAge:60000
    }

  );

};


window.abrirMissaoAtual = function(){

  if(!missaoAtual){

    showToast("Nenhuma missão selecionada!", true);

    return;

  }

  abrirCadastroMissao(missaoAtual);

};


window.abrirCadastroMissao = async function(casaId){

  const casa = houses.find(h => h.id === casaId);

  if(!casa){

    showToast("Casa não encontrada!", true);

    return;

  }

    switchView("map");

    setTimeout(async () => {

        initMap();

        map.setView(
          [casa.lat, casa.lng],
          21,
          {
            animate:true,
            duration:1
          }
        );

        await fetch("/status-missao",{

          method:"POST",

          headers: authHeaders(true),

          body:JSON.stringify({

            casa_id:casaId,

            status:"em_andamento"

          })

        });

        casa.statusMissao = "em_andamento";

        casaSelecionada = casa.id;

        drawMap();

        await openHouse(casa);

    },300);

};


window.atualizarMissaoAtual = function(){

  const card = document.getElementById("missao-atual-card");

  if(missaoAtual){

    card.style.display = "block";

  }else{

    card.style.display = "none";

  }

};


window.carregarMinhasMissoes = async function(){

  if(currentUser.role !== "colaborador"){
    return;
  }

  try{

    const res = await fetch(
      "/minhas-missoes/" + currentUser.user,
      {
        headers: authHeaders()
      }
    );

    const missoes = await res.json();

    const ids = missoes.map(m => m.casa_id);

    houses = houses.filter(casa =>
      ids.includes(casa.id)
    );

    renderHousesList();

    drawMap();

    updateStats();

  }catch(err){

    console.error(err);

    showToast("Erro ao carregar missões!", true);

  }

};