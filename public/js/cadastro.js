let fotosPorCasa = {};
let cadastros = {};
let currentHouse = null;


window.openHouse = async function(h){

  console.log("PASSOU 1");

  currentHouse=h;
  const done=!!cadastros[h.id];
  const viewOnly=(currentUser.role==='assistente')||(currentUser.role==='colaborador'&&done);
  document.getElementById('modal-title').textContent=done?'Ficha de Cadastro Social':'Novo Cadastro Social';
  document.getElementById('modal-addr').innerHTML=`<b>${h.label}</b>${h.bairro?' — '+h.bairro:''} &nbsp;<span style="font-size:10px;padding:2px 7px;border-radius:4px;background:${done?'rgba(46,160,67,.15)':'rgba(125,133,144,.15)'};color:${done?'#3fb950':'#7d8590'}">${done?'Cadastrado':'Pendente'}</span>`;
  const modal=document.getElementById('modal');
  viewOnly?modal.classList.add('view-only'):modal.classList.remove('view-only');
  const cadastro = await carregarCadastro(h.id);

  await carregarFotosCasa(h.id);

  console.log("CADASTRO CARREGADO:", cadastro);

  console.log("PASSOU 2");
  console.log(cadastro);

if (cadastro && cadastro.casa_id) {

  console.log("PASSOU 3");

  fillForm({

  end: cadastro.endereco,
  bairro: cadastro.bairro,

  lat: cadastro.latitude,
  lng: cadastro.longitude,

  data: cadastro.data_cadastro,

  nome: cadastro.nome,
  cpf: cadastro.cpf,

  nasc: cadastro.nascimento,
  sexo: cadastro.sexo,
  esc: cadastro.escolaridade,

  tel: cadastro.telefone,
  nis: cadastro.nis,

  mor: cadastro.moradores,
  men: cadastro.menores,
  ido: cadastro.idosos,

  renda: cadastro.renda,
  fonte: cadastro.fonte_renda,

  tipo: cadastro.tipo_moradia,
  mat: cadastro.material,

  agua: cadastro.agua,
  esg: cadastro.esgoto,
  en: cadastro.energia,

  obs: cadastro.observacoes,

  colab: cadastro.colaborador,
  status: cadastro.status

});
}
  else{

    console.log("PASSOU 4");

    clearForm();
    document.getElementById('f-end').value=h.label;
    document.getElementById('f-bairro').value=h.bairro||'';
    document.getElementById('f-lat').value=h.lat.toFixed(6);
    document.getElementById('f-lng').value=h.lng.toFixed(6);
    document.getElementById('f-data').value=new Date().toLocaleDateString('pt-BR');
    document.getElementById('f-colab').value=currentUser.name;
  }
  document.querySelectorAll('.house-item').forEach(el=>el.classList.remove('selected'));
  const li=document.getElementById('li-'+h.id); if(li) li.classList.add('selected');

  console.log("PASSOU 5");

  let btnAtribuir = document.getElementById("btn-atribuir");

    if (!btnAtribuir) {

      btnAtribuir = document.createElement("button");

      btnAtribuir.id = "btn-atribuir";

      btnAtribuir.className = "btn btn-green";

      btnAtribuir.textContent = "👷 Atribuir ao colaborador";

      btnAtribuir.style.marginTop = "10px";

      btnAtribuir.onclick = () => atribuirCasa();

      document.getElementById("modal-foot").prepend(btnAtribuir);

    }

    btnAtribuir.style.display =
      currentUser.role === "engenheiro"
        ? "inline-flex"
        : "none";

  document.getElementById('modal-wrap').classList.add('open');

  console.log("PASSOU 6");

  console.log("ABRINDO CASA:", h);
  console.log("LAT:", h.lat);
  console.log("LNG:", h.lng);

  console.log("ANTES DO PANTO");

if(
  map &&
  Number.isFinite(h.lat) &&
  Number.isFinite(h.lng)
){
  console.log("VAI PAN");
  map.panTo([h.lat, h.lng]);

  casasLayer.eachLayer(layer => {

    const casaId = layer.feature?.properties?.id || layer.casaId;

    if(casaId === h.id){
      layer.setStyle({
        color: "#ffff00",
        weight: 5
      });
    }else{
      layer.setStyle({
        color: "#3388ff",
        weight: 2
      });
    }

  });
}

console.log("DEPOIS DO PANTO");

};

window.mostrarAba = function(nome, botao){

  document.querySelectorAll(".tab-page").forEach(aba => {
    aba.classList.remove("active");
  });

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  document.getElementById("tab-" + nome).classList.add("active");
  botao.classList.add("active");

};

let fotosCasa = [];


window.arquivoParaBase64 = function(arquivo) {

  return new Promise((resolve, reject) => {

    const leitor = new FileReader();

    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = () => reject(leitor.error);

    leitor.readAsDataURL(arquivo);

  });

};


window.carregarFotosCasa = async function(casaId) {

  const galeria = document.getElementById("galeria-fotos");

  galeria.innerHTML = "<p>Carregando fotos...</p>";


  const res = await fetch("/fotos/" + casaId);

  const fotos = await res.json();

  fotos.forEach(foto => {

    const img = document.createElement("img");

    img.src = foto.dados;

    img.style.width = "120px";
    img.style.height = "90px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "8px";
    img.style.border = "1px solid #ccc";

    galeria.appendChild(img);

  });

};


window.previewFotos = function() {

  const input = document.getElementById("f-fotos");
  const preview = document.getElementById("preview-fotos");
  const galeria = document.getElementById("galeria-fotos");

  preview.innerHTML = "";
  galeria.innerHTML = "";

  fotosCasa = [...input.files];

  [...input.files].forEach(file => {

    const img = document.createElement("img");

    img.src = URL.createObjectURL(file);

    img.style.width = "120px";
    img.style.height = "90px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "8px";
    img.style.border = "1px solid #ccc";

    preview.appendChild(img);

    const imgGaleria = img.cloneNode();

    galeria.appendChild(imgGaleria);

  });

  console.log("Fotos da casa:", fotosCasa);

};


window.fillForm = function(c){
  ['end','bairro','lat','lng','data','nome','cpf','nasc','sexo','esc','tel','nis','mor','men','ido','renda','fonte','tipo','mat','agua','esg','en','obs','colab','status'].forEach(k=>{
    const el=document.getElementById('f-'+k); if(el) el.value=c[k]||'';
  });
};
window.clearForm = function(){
  ['end','bairro','lat','lng','data','nome','cpf','nasc','sexo','esc','tel','nis','mor','men','ido','renda','fonte','tipo','mat','agua','esg','en','obs','colab','status'].forEach(k=>{
    const el=document.getElementById('f-'+k); if(el) el.value='';
  });
};
window.closeModal = function(){
  document.getElementById('modal-wrap').classList.remove('open');
  document.querySelectorAll('.house-item').forEach(el=>el.classList.remove('selected'));
  currentHouse=null;
};


window.saveCadastro = async function() {

  if (currentHouse) {
    fotosPorCasa[currentHouse.id] = [...fotosCasa];
  }

  if (!currentHouse) return;

  const cadastro = {

    casa_id: currentHouse.id,

    endereco: document.getElementById('f-end').value,
    bairro: document.getElementById('f-bairro').value,
    latitude: document.getElementById('f-lat').value,
    longitude: document.getElementById('f-lng').value,

    nome: document.getElementById('f-nome').value,
    cpf: document.getElementById('f-cpf').value,
    nascimento: document.getElementById('f-nasc').value,
    sexo: document.getElementById('f-sexo').value,
    escolaridade: document.getElementById('f-esc').value,

    telefone: document.getElementById('f-tel').value,
    nis: document.getElementById('f-nis').value,

    moradores: document.getElementById('f-mor').value,
    menores: document.getElementById('f-men').value,
    idosos: document.getElementById('f-ido').value,

    renda: document.getElementById('f-renda').value,
    fonte_renda: document.getElementById('f-fonte').value,

    tipo_moradia: document.getElementById('f-tipo').value,
    material: document.getElementById('f-mat').value,

    agua: document.getElementById('f-agua').value,
    esgoto: document.getElementById('f-esg').value,
    energia: document.getElementById('f-en').value,

    observacoes: document.getElementById('f-obs').value,

    colaborador: document.getElementById('f-colab').value,
    status: document.getElementById('f-status').value || 'Cadastrado',

    data_cadastro: document.getElementById('f-data').value

  };

  try {

    const casaIdAtual = currentHouse.id;

    const res = await fetch('/cadastro', {

      method: 'POST',

      headers: authHeaders(true),

      body: JSON.stringify(cadastro)

    });

    const retorno = await res.json();

    if (!res.ok) {
      throw new Error(retorno.erro || 'Erro ao salvar');
    }

    if (casaIdAtual && fotosCasa.length) {

      for (const foto of fotosCasa) {

        const base64 = await arquivoParaBase64(foto);

        await fetch("/fotos", {
          method: "POST",
          headers: authHeaders(true),
          body: JSON.stringify({
            casa_id: casaIdAtual,
            nome_arquivo: foto.name,
            tipo: foto.type,
            dados: base64
          })
        });

      }

    }

    cadastros[currentHouse.id] = cadastro;

    activities.push({
      ...cadastro,
      time: new Date().toLocaleTimeString('pt-BR')
    });

    renderHousesList();
    updateStats();
    drawMap();
    closeModal();

    if (casaIdAtual) {

      await fetch("/status-missao", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          casa_id: casaIdAtual,
          status: "concluida"
        })
      });

      const casaConcluida = houses.find(h => h.id === casaIdAtual);

      if (casaConcluida) {
        casaConcluida.statusMissao = "concluida";
      }

      casaSelecionada = null;

      drawMap();

    }

    document.getElementById("modal-missao").classList.add("open");

  } catch (err) {

    console.error(err);

    showToast('Erro ao salvar cadastro!', true);

  }

  console.log("Fotos por casa:", fotosPorCasa);

};


window.carregarCadastro = async function(casaId) {

  try {

    const res = await fetch(`/cadastro/${casaId}`);

    return await res.json();

  } catch (err) {

    console.error(err);

    return {};

  }

};


window.carregarCadastrosDoBanco = async function() {

  try {

    const res = await fetch("/cadastro", {
      headers: authHeaders()
    });

    const dados = await res.json();

    cadastros = {};

    dados.forEach(c => {
      cadastros[c.casa_id] = c;
    });

    await carregarUsuarios();

    renderHousesList();
    drawMap();
    updateStats();

  } catch (err) {

    console.error(err);

    showToast("Erro ao carregar cadastros!", true);

  }
};