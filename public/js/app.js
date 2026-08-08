let currentUser = null;
let confirmCb = null;


window.authHeaders = function(contentType = false) {
  const headers = {};

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


document.getElementById('inp-pass').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });


window.doLogout = async function(){

  try {

    await fetch("/logout", {
      method: "POST"
    });

  } catch (erro) {
    console.error("Erro ao sair:", erro);
  }

  cancelAnimationFrame(animFrame);

  currentUser = null;

  document.getElementById('screen-app').style.display = 'none';
  document.getElementById('screen-login').style.display = 'flex';

  document.getElementById('inp-user').value = '';
  document.getElementById('inp-pass').value = '';
};


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

      const erro = await res.json();

      const loginError =
        document.getElementById('login-error');

      loginError.textContent =
        erro.erro || "Erro ao realizar login.";

      loginError.style.display = 'block';

      return;
    }

    const usuario = await res.json();

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

  menu.style.display = "block";
  menu.style.gridTemplateColumns = "none";
  menu.style.maxWidth = "1000px";
  menu.style.width = "100%";

  menu.innerHTML = `
    <div style="width:100%;">

      <button
        type="button"
        class="btn"
        onclick="mostrarMenuRelatorios()"
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

        <button
            class="btn"
            onclick="exportarRelatorioPDF()"
            style="margin-left:10px;"
        >
            📄 Exportar PDF
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

    resultado.innerHTML = `

      <div class="relatorio-tabela-wrap">

        <table class="relatorio-tabela">

          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Total</th>
              <th>Pendentes</th>
              <th>Em andamento</th>
              <th>Concluídas</th>
            </tr>
          </thead>

          <tbody>
            ${filtrados.map(item => `
              <tr>
                <td>
                  ${item.nome_colaborador || item.colaborador}
                </td>

                <td>${item.total}</td>

                <td>${item.pendentes}</td>

                <td>${item.andamento}</td>

                <td>${item.concluidas}</td>
              </tr>
            `).join("")}
          </tbody>

        </table>

      </div>

    `;

  }catch(err){

    console.error(err);

    showToast("Erro ao consultar relatório.", true);

  }

};


window.exportarRelatorioPDF = async function(){

  const data =
    document.getElementById("relatorio-data").value;

  const tabela =
    document.querySelector(".relatorio-tabela");

  if(!data || !tabela){

    showToast(
      "Consulte um relatório antes de exportar.",
      true
    );

    return;
  }

  const dataFormatada =
    data.split("-").reverse().join("/");

  const agora =
    new Date().toLocaleString("pt-BR");

  const pdf = document.createElement("div");

  pdf.style.background = "#ffffff";
  pdf.style.color = "#111111";
  pdf.style.padding = "30px";
  pdf.style.fontFamily = "Arial, sans-serif";
  pdf.style.width = "750px";

  pdf.innerHTML = `

    <div style="
      text-align:center;
      margin-bottom:25px;
    ">

      <h1 style="
        margin:0;
        font-size:24px;
        color:#111;
      ">
        CadastroGeo
      </h1>

      <h2 style="
        margin:8px 0 0;
        font-size:18px;
        color:#333;
      ">
        Relatório Diário
      </h2>

      <div style="
        margin-top:8px;
        font-size:14px;
        color:#555;
      ">
        Data: ${dataFormatada}
      </div>

    </div>

    <table style="
      width:100%;
      border-collapse:collapse;
      font-size:13px;
      color:#111;
    ">

      <thead>

        <tr style="background:#eeeeee;">

          <th style="
            border:1px solid #999;
            padding:8px;
            text-align:left;
          ">
            Colaborador
          </th>

          <th style="
            border:1px solid #999;
            padding:8px;
          ">
            Total
          </th>

          <th style="
            border:1px solid #999;
            padding:8px;
          ">
            Pendentes
          </th>

          <th style="
            border:1px solid #999;
            padding:8px;
          ">
            Andamento
          </th>

          <th style="
            border:1px solid #999;
            padding:8px;
          ">
            Concluídas
          </th>

        </tr>

      </thead>

      <tbody>
        ${
          Array.from(tabela.querySelectorAll("tbody tr"))
          .map(linha => {

            const colunas =
              Array.from(linha.querySelectorAll("td"));

            return `
              <tr>

                ${colunas.map((coluna, index) => `
                  <td style="
                    border:1px solid #bbb;
                    padding:7px;
                    text-align:${index === 0 ? "left" : "center"};
                  ">
                    ${coluna.textContent.trim()}
                  </td>
                `).join("")}

              </tr>
            `;

          }).join("")
        }
      </tbody>

    </table>

    <div style="
      margin-top:25px;
      padding-top:10px;
      border-top:1px solid #aaa;
      font-size:11px;
      color:#555;
    ">
      Emitido em: ${agora}
    </div>

  `;

  const opcoes = {

    margin: 10,

    filename:
      `CadastroGeo_Relatorio_Diario_${data}.pdf`,

    image: {
      type: "jpeg",
      quality: 1
    },

    html2canvas: {
      scale: 2,
      backgroundColor: "#ffffff"
    },

    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait"
    },

    pagebreak: {
      mode: ["avoid-all", "css", "legacy"]
    }

  };

  html2pdf()
    .set(opcoes)
    .from(pdf)
    .save();

};


window.abrirRelatorioMensal = function(){

  const menu =
    document.getElementById("relatorios-menu");

  menu.style.display = "block";
  menu.style.gridTemplateColumns = "none";
  menu.style.maxWidth = "1000px";
  menu.style.width = "100%";

  menu.innerHTML = `

    <button
      class="btn"
      onclick="mostrarMenuRelatorios()"
      style="margin-bottom:20px;"
    >
      ← Voltar
    </button>

    <h2 style="margin-bottom:20px;">
      📆 Relatório Mensal
    </h2>

    <div style="
      display:flex;
      gap:12px;
      align-items:end;
      flex-wrap:wrap;
      margin-bottom:20px;
    ">

      <div>

        <label>Mês</label>

        <select
          id="relatorio-mes"
          class="inp"
        >
          <option value="1">Janeiro</option>
          <option value="2">Fevereiro</option>
          <option value="3">Março</option>
          <option value="4">Abril</option>
          <option value="5">Maio</option>
          <option value="6">Junho</option>
          <option value="7">Julho</option>
          <option value="8" selected>Agosto</option>
          <option value="9">Setembro</option>
          <option value="10">Outubro</option>
          <option value="11">Novembro</option>
          <option value="12">Dezembro</option>
        </select>

      </div>

      <div>

        <label>Ano</label>

        <input
          id="relatorio-ano"
          class="inp"
          type="number"
          value="2026"
          style="width:120px;"
        >

      </div>

      <button
        class="btn-blue"
        onclick="consultarRelatorioMensal()"
      >
        Consultar
      </button>

      <button
        class="btn"
        onclick="exportarRelatorioMensalPDF()"
      >
        📄 Exportar PDF
      </button>

    </div>

    <div id="resultado-relatorio-mensal"></div>

  `;

};


window.consultarRelatorioMensal = async function(){

  const mes =
    document.getElementById("relatorio-mes").value;

  const ano =
    document.getElementById("relatorio-ano").value;

  const resultado =
    document.getElementById("resultado-relatorio-mensal");

  try{

    const res = await fetch(
      `/relatorios/mensal?ano=${ano}&mes=${mes}`,
      {
        headers: authHeaders()
      }
    );

    const dados = await res.json();

    if(!res.ok){

      showToast(
        dados.erro || "Erro ao consultar relatório mensal.",
        true
      );

      return;
    }

    if(!dados.length){

      resultado.innerHTML = `
        <div class="card">
          Nenhum relatório encontrado para esse período.
        </div>
      `;

      return;
    }

    resultado.innerHTML = `

      <div class="relatorio-tabela-wrap">

        <table class="relatorio-tabela">

          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Total</th>
              <th>Pendentes</th>
              <th>Andamento</th>
              <th>Concluídas</th>
            </tr>
          </thead>

          <tbody>

            ${dados.map(item => `
              <tr>

                <td>
                  ${item.nome_colaborador || item.colaborador}
                </td>

                <td>${item.total}</td>

                <td>${item.pendentes}</td>

                <td>${item.andamento}</td>

                <td>${item.concluidas}</td>

              </tr>
            `).join("")}

          </tbody>

        </table>

      </div>

    `;

  }catch(err){

    console.error(err);

    showToast(
      "Erro ao consultar relatório mensal.",
      true
    );

  }

};

window.exportarRelatorioMensalPDF = async function(){

  const mes =
    document.getElementById("relatorio-mes").value;

  const ano =
    document.getElementById("relatorio-ano").value;

  const tabela =
    document.querySelector("#resultado-relatorio-mensal .relatorio-tabela");

  if(!tabela){

    showToast(
      "Consulte o relatório mensal antes de exportar.",
      true
    );

    return;
  }

  const nomesMeses = [
    "",
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro"
  ];

  const nomeMes = nomesMeses[Number(mes)];

  const agora =
    new Date().toLocaleString("pt-BR");

  const pdf = document.createElement("div");

  pdf.style.background = "#ffffff";
  pdf.style.color = "#111111";
  pdf.style.padding = "30px";
  pdf.style.fontFamily = "Arial, sans-serif";
  pdf.style.width = "750px";

  pdf.innerHTML = `

    <div style="
      text-align:center;
      margin-bottom:25px;
    ">

      <h1 style="
        margin:0;
        font-size:24px;
        color:#111;
      ">
        CadastroGeo
      </h1>

      <h2 style="
        margin:8px 0 0;
        font-size:18px;
        color:#333;
      ">
        Relatório Mensal
      </h2>

      <div style="
        margin-top:8px;
        font-size:14px;
        color:#555;
      ">
        Período: ${nomeMes} / ${ano}
      </div>

    </div>

    <table style="
      width:100%;
      border-collapse:collapse;
      font-size:13px;
      color:#111;
    ">

      <thead>

        <tr style="background:#eeeeee;">

          <th style="border:1px solid #999;padding:8px;text-align:left;">
            Colaborador
          </th>

          <th style="border:1px solid #999;padding:8px;">
            Total
          </th>

          <th style="border:1px solid #999;padding:8px;">
            Pendentes
          </th>

          <th style="border:1px solid #999;padding:8px;">
            Andamento
          </th>

          <th style="border:1px solid #999;padding:8px;">
            Concluídas
          </th>

        </tr>

      </thead>

      <tbody>
        ${
          Array.from(tabela.querySelectorAll("tbody tr"))
          .map(linha => {

            const colunas =
              Array.from(linha.querySelectorAll("td"));

            return `
              <tr>

                ${colunas.map((coluna, index) => `
                  <td style="
                    border:1px solid #bbb;
                    padding:7px;
                    text-align:${index === 0 ? "left" : "center"};
                  ">
                    ${coluna.textContent.trim()}
                  </td>
                `).join("")}

              </tr>
            `;

          }).join("")
        }
      </tbody>

    </table>

    <div style="
      margin-top:25px;
      padding-top:10px;
      border-top:1px solid #aaa;
      font-size:11px;
      color:#555;
    ">
      Emitido em: ${agora}
    </div>

  `;

  const opcoes = {

    margin: 10,

    filename:
      `CadastroGeo_Relatorio_Mensal_${ano}_${String(mes).padStart(2,"0")}.pdf`,

    image: {
      type: "jpeg",
      quality: 1
    },

    html2canvas: {
      scale: 2,
      backgroundColor: "#ffffff"
    },

    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait"
    },

    pagebreak: {
      mode: ["avoid-all", "css", "legacy"]
    }

  };

  html2pdf()
    .set(opcoes)
    .from(pdf)
    .save();

};


window.abrirRelatorioAnual = function(){

  const menu =
    document.getElementById("relatorios-menu");

  menu.style.display = "block";
  menu.style.gridTemplateColumns = "none";
  menu.style.maxWidth = "1000px";
  menu.style.width = "100%";

  menu.innerHTML = `

    <button
      class="btn"
      onclick="mostrarMenuRelatorios()"
      style="margin-bottom:20px;"
    >
      ← Voltar
    </button>

    <h2 style="margin-bottom:20px;">
      📈 Relatório Anual
    </h2>

    <div style="
      display:flex;
      gap:12px;
      align-items:end;
      flex-wrap:wrap;
      margin-bottom:20px;
    ">

      <div>

        <label>Ano</label>

        <input
          id="relatorio-anual-ano"
          class="inp"
          type="number"
          value="2026"
          style="width:120px;"
        >

      </div>

      <button
        class="btn-blue"
        onclick="consultarRelatorioAnual()"
      >
        Consultar
      </button>

      <button
        class="btn"
        onclick="exportarRelatorioAnualPDF()"
      >
        📄 Exportar PDF
      </button>

    </div>

    <div id="resultado-relatorio-anual"></div>

  `;

};


window.consultarRelatorioAnual = async function(){

  const ano =
    document.getElementById("relatorio-anual-ano").value;

  const resultado =
    document.getElementById("resultado-relatorio-anual");

  try{

    const res = await fetch(
      `/relatorios/anual?ano=${ano}`,
      {
        headers: authHeaders()
      }
    );

    const dados = await res.json();

    if(!res.ok){

      showToast(
        dados.erro || "Erro ao consultar relatório anual.",
        true
      );

      return;

    }

    if(!dados.length){

      resultado.innerHTML = `
        <div class="card">
          Nenhum relatório encontrado para esse ano.
        </div>
      `;

      return;

    }

    resultado.innerHTML = `

      <div class="relatorio-tabela-wrap">

        <table class="relatorio-tabela">

          <thead>

            <tr>
              <th>Colaborador</th>
              <th>Total</th>
              <th>Pendentes</th>
              <th>Andamento</th>
              <th>Concluídas</th>
            </tr>

          </thead>

          <tbody>

            ${dados.map(item => `

              <tr>

                <td>${item.nome_colaborador || item.colaborador}</td>

                <td>${item.total}</td>

                <td>${item.pendentes}</td>

                <td>${item.andamento}</td>

                <td>${item.concluidas}</td>

              </tr>

            `).join("")}

          </tbody>

        </table>

      </div>

    `;

  }catch(err){

    console.error(err);

    showToast(
      "Erro ao consultar relatório anual.",
      true
    );

  }

};

window.exportarRelatorioAnualPDF = async function(){

  const ano =
    document.getElementById("relatorio-anual-ano").value;

  const tabela =
    document.querySelector("#resultado-relatorio-anual .relatorio-tabela");

  if(!tabela){

    showToast(
      "Consulte o relatório anual antes de exportar.",
      true
    );

    return;
  }

  const agora =
    new Date().toLocaleString("pt-BR");

  const pdf = document.createElement("div");

  pdf.style.background = "#ffffff";
  pdf.style.color = "#111111";
  pdf.style.padding = "30px";
  pdf.style.fontFamily = "Arial, sans-serif";
  pdf.style.width = "750px";

  pdf.innerHTML = `

    <div style="
      text-align:center;
      margin-bottom:25px;
    ">

      <h1 style="
        margin:0;
        font-size:24px;
        color:#111;
      ">
        CadastroGeo
      </h1>

      <h2 style="
        margin:8px 0 0;
        font-size:18px;
        color:#333;
      ">
        Relatório Anual
      </h2>

      <div style="
        margin-top:8px;
        font-size:14px;
        color:#555;
      ">
        Ano: ${ano}
      </div>

    </div>

    <table style="
      width:100%;
      border-collapse:collapse;
      font-size:13px;
      color:#111;
    ">

      <thead>

        <tr style="background:#eeeeee;">

          <th style="border:1px solid #999;padding:8px;text-align:left;">
            Colaborador
          </th>

          <th style="border:1px solid #999;padding:8px;">
            Total
          </th>

          <th style="border:1px solid #999;padding:8px;">
            Pendentes
          </th>

          <th style="border:1px solid #999;padding:8px;">
            Andamento
          </th>

          <th style="border:1px solid #999;padding:8px;">
            Concluídas
          </th>

        </tr>

      </thead>

      <tbody>
        ${
          Array.from(tabela.querySelectorAll("tbody tr"))
          .map(linha => {

            const colunas =
              Array.from(linha.querySelectorAll("td"));

            return `
              <tr>

                ${colunas.map((coluna, index) => `
                  <td style="
                    border:1px solid #bbb;
                    padding:7px;
                    text-align:${index === 0 ? "left" : "center"};
                  ">
                    ${coluna.textContent.trim()}
                  </td>
                `).join("")}

              </tr>
            `;

          }).join("")
        }
      </tbody>

    </table>

    <div style="
      margin-top:25px;
      padding-top:10px;
      border-top:1px solid #aaa;
      font-size:11px;
      color:#555;
    ">
      Emitido em: ${agora}
    </div>

  `;

  const opcoes = {

    margin: 10,

    filename:
      `CadastroGeo_Relatorio_Anual_${ano}.pdf`,

    image: {
      type: "jpeg",
      quality: 1
    },

    html2canvas: {
      scale: 2,
      backgroundColor: "#ffffff"
    },

    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait"
    },

    pagebreak: {
      mode: ["avoid-all", "css", "legacy"]
    }

  };

  html2pdf()
    .set(opcoes)
    .from(pdf)
    .save();

};


window.mostrarMenuRelatorios = function(){

  const menu = document.getElementById("relatorios-menu");

  menu.style.display = "grid";
  menu.style.gridTemplateColumns = "repeat(2, minmax(220px,1fr))";
  menu.style.maxWidth = "700px";
  menu.style.width = "";

  menu.innerHTML = `

    <div
      class="card relatorio-opcao"
      onclick="abrirRelatorioDiario()"
      style="cursor:pointer;"
    >
      <h3>📅 Diário</h3>
      <p>Consultar o fechamento de um dia específico.</p>
    </div>

    <div
      class="card relatorio-opcao"
      onclick="abrirRelatorioMensal()"
      style="cursor:pointer;"
    >
      <h3>📆 Mensal</h3>
      <p>Ver os resultados consolidados de um mês.</p>
    </div>

    <div
      class="card relatorio-opcao"
      onclick="abrirRelatorioAnual()"
      style="cursor:pointer;"
    >
      <h3>📈 Anual</h3>
      <p>Consultar produtividade e resultados de um ano inteiro.</p>
    </div>

  `;

}