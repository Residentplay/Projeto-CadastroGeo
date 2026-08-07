let currentUser = null;
let confirmCb = null;


window.authHeaders = function(contentType = false) {

  const headers = {
    Authorization: `Bearer ${localStorage.getItem("token")}`
  };

  if (contentType) {
    headers["Content-Type"] = "application/json";
  }

  return headers;

};


window.openConfirm = function(title, msg, cb){
  document.getElementById('confirm-title').textContent=title;
  document.getElementById('confirm-msg').textContent=msg;
  confirmCb=cb;
  document.getElementById('confirm-wrap').classList.add('open');
  document.getElementById('confirm-ok').onclick=()=>{ closeConfirm(); if(confirmCb) confirmCb(); };
};


window.closeConfirm = function(){ document.getElementById('confirm-wrap').classList.remove('open'); };


window.showToast = function(msg, err = false){
  const t=document.getElementById('toast');
  t.textContent=(err?'⚠ ':'✓ ')+msg;
  t.style.background=err?'#da3633':'#2ea043';
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
};


window.switchView = function(v){

  document.getElementById('view-dashboard').style.display =
    v === 'dashboard' ? 'flex' : 'none';

  document.getElementById('view-map').style.display =
    v === 'map' ? 'flex' : 'none';

  document.getElementById('view-admin').style.display =
    v === 'admin' ? 'flex' : 'none';

  document.getElementById('view-missoes').style.display =
    v === 'missoes' ? 'flex' : 'none';

  document.getElementById('view-relatorios').style.display =
    v === 'relatorios' ? 'flex' : 'none';  

  document.getElementById('nav-map')
    .classList.toggle('active', v === 'map');

  document.getElementById('nav-admin')
    .classList.toggle('active', v === 'admin');

  document.getElementById('nav-dashboard')
    .classList.toggle('active', v === 'dashboard');  

  document.getElementById('btn-missoes')
    .classList.toggle('active', v === 'missoes');

  if(v === 'map'){
    initMap();
  }

  if(v === 'admin'){
    renderUsersTable();
    renderActivity();
  }

  if(v === 'missoes'){
    carregarTelaMissoes();
  }

  if(v === 'dashboard'){
    carregarDashboard();
  }

  

};


window.setupUI = async function(){
  document.getElementById('user-name').textContent = currentUser.name;
  const av = document.getElementById('user-avatar');
  av.textContent = currentUser.name.split(' ').map(n=>n[0]).join('').slice(0,2);
  av.style.background = AVATAR_BG[currentUser.role]||'#1f6feb';
  const rp = document.getElementById('role-pill');
  rp.textContent = ROLE_LABEL[currentUser.role];
  rp.className = 'role-pill role-'+currentUser.role;
  document.getElementById('nav-admin').style.display = currentUser.role==='engenheiro'?'':'none';
  document.getElementById('btn-missoes').style.display = currentUser.role === 'colaborador' ? '' : 'none';
  document.getElementById('upload-zone').style.display = currentUser.role==='engenheiro'?'block':'none';
  document.getElementById('btn-import-top').style.display = currentUser.role==='engenheiro'?'':'none';
  const titles={colaborador:'Imóveis para cadastrar',assistente:'Fichas de cadastro',engenheiro:'Painel de fiscalização'};
  const subs={colaborador:'Clique em um imóvel para preencher o formulário',assistente:'Clique em um imóvel cadastrado para ver a ficha',engenheiro:'Importe o GeoJSON do QGIS e monitore os cadastros'};
  document.getElementById('sidebar-title').textContent=titles[currentUser.role];
  document.getElementById('sidebar-sub').textContent=subs[currentUser.role];

  await carregarLotes();
  await carregarCasas();
  await carregarCadastrosDoBanco();

  lotesLayer.eachLayer(layer => {
    if (layer.bringToFront) {
      layer.bringToFront();
    }
  });

  updateStats();
};


window.doLogout = function(){

    localStorage.removeItem("token");

  cancelAnimationFrame(animFrame);
  currentUser = null;
  document.getElementById('screen-app').style.display='none';
  document.getElementById('screen-login').style.display='flex';
  document.getElementById('inp-user').value='';
  document.getElementById('inp-pass').value='';
};


document.getElementById('inp-pass').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });


window.doLogin = async function(){

  const u = document.getElementById('inp-user').value.trim();
  const p = document.getElementById('inp-pass').value;

  try{

    const res = await fetch("/login",{

      method:"POST",

      headers:{
        "Content-Type":"application/json"
      },

      body:JSON.stringify({

        usuario:u,
        senha:p

      })

    });

    if(!res.ok){

      document.getElementById('login-error').style.display='block';
      return;

    }

    const usuario = await res.json();

    localStorage.setItem("token", usuario.token);

    currentUser = {

      id:"u"+Date.now(),

      name:usuario.nome,

      user:usuario.usuario,

      role:usuario.papel,

      active:usuario.ativo

    };

    document.getElementById('login-error').style.display='none';

    document.getElementById('screen-login').style.display='none';

    const app = document.getElementById('screen-app');

    app.style.display='flex';

    setupUI();

    switchView('map');

    startGPS();


  }catch(err){

    console.error(err);

    showToast("Erro ao realizar login!",true);

  }

};


window.abrirRelatorioDiario = function(){

  const menu = document.getElementById("relatorios-menu");

  menu.innerHTML = `
    <div style="width:100%;">

      <button
        class="btn"
        onclick="location.reload()"
        style="margin-bottom:20px;"
      >
        ← Voltar
      </button>

      <h2>📅 Relatório Diário</h2>

      <div style="
        margin-top:20px;
        display:flex;
        gap:12px;
        align-items:end;
      ">

        <div>
          <label>Data</label><br>

          <input
            type="date"
            id="relatorio-data"
            class="inp"
          >
        </div>

        <button
          class="btn-blue"
          onclick="consultarRelatorioDiario()"
        >
          Consultar
        </button>

      </div>

      <div
        id="resultado-relatorio-diario"
        style="margin-top:25px;"
      ></div>

    </div>
  `;

};


window.consultarRelatorioDiario = async function(){

  const data = document.getElementById("relatorio-data").value;

  if(!data){
    showToast("Selecione uma data.", true);
    return;
  }

  try{

    const res = await fetch("/relatorios", {
      headers: authHeaders()
    });

    const dados = await res.json();

    const filtrados = dados.filter(item =>
      item.data_relatorio &&
      item.data_relatorio.slice(0,10) === data
    );

    console.log("RELATÓRIO DIÁRIO:", filtrados);

    const resultado = document.getElementById(
      "resultado-relatorio-diario"
    );

    if(!filtrados.length){

      resultado.innerHTML = `
        <div class="card">
          Nenhum relatório encontrado para essa data.
        </div>
      `;

      return;
    }

    resultado.innerHTML = "";

    filtrados.forEach(item => {

      resultado.innerHTML += `

      <div class="relatorio-colaborador">

          <h2 style="margin-bottom:18px;">
              👷 ${item.nome_colaborador || item.colaborador}
          </h2>

          <div style="
              display:grid;
              grid-template-columns:repeat(4,minmax(140px,1fr));
              gap:14px;
          ">

              <div class="card card-casas">
                  <h3>Total</h3>
                  <h1>${item.total}</h1>
              </div>

              <div class="card card-pendentes">
                  <h3>🟡 Pendentes</h3>
                  <h1>${item.pendentes}</h1>
              </div>

              <div class="card card-andamento">
                  <h3>🔵 Andamento</h3>
                  <h1>${item.andamento}</h1>
              </div>

              <div class="card card-concluidas">
                  <h3>🟢 Concluídas</h3>
                  <h1>${item.concluidas}</h1>
              </div>

          </div>

      </div>

      `;

    });

  }catch(err){

    console.error(err);

    showToast("Erro ao consultar relatório.", true);

  }

};