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