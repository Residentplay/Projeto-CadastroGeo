// Mapa do CadastroGeo

let map;
let lotes = [];
let houses = [];
let drawnItems;
let modoDesenho = "lote";
let lotesLayer;
let casasLayer;
let markersLayer;
let modoAtual = null;
let anguloMapa = 0;
let cam = {lat:-5.0892, lng:-42.8016, zoom:15};
let dragging = false, dragStart = {x:0,y:0}, camStart = {lat:0,lng:0};
let tileCache = {}, pendingTiles = {};
let animFrame = null;
let casaSelecionada = null;

window.initMap = function(){

  if(map) return;


  map = L.map('map', {
  rotate: true,
  touchRotate: true
}).setView(
  [-5.0892, -42.8019],
  19
);

  

  const normal = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      attribution:'© OpenStreetMap',
      maxZoom: 22
    }
  ).addTo(map);

  const satelite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution:'© Esri',
      maxZoom: 19,
      maxNativeZoom: 19
    }
  );

  L.control.layers({
    "Mapa": normal,
    "Satélite": satelite
  }).addTo(map);

  drawnItems = new L.FeatureGroup();

  map.addLayer(drawnItems);

  lotesLayer = L.layerGroup().addTo(map);

  casasLayer = L.layerGroup().addTo(map);

  markersLayer = L.layerGroup().addTo(map);

const drawControl = new L.Control.Draw({
  draw: {
    polygon: {
      allowIntersection: false
    },
    rectangle: true,
    marker: false,
    circle: false,
    circlemarker: false,
    polyline: false
  },
  edit: {
    featureGroup: drawnItems
  }
});

map.addControl(drawControl);

map.on(L.Draw.Event.CREATED, function (e) {

  console.log("DRAW CREATED");
  console.log("modoDesenho =", modoDesenho);

  const layer = e.layer;

  const tipo = prompt(

    "O que foi desenhado?\n\nDigite:\nL = Lote\nC = Casa"

);

  if (!tipo) return;

  if (tipo.toUpperCase() === "L") {

    lotesLayer.addLayer(layer);

    const pontos = layer.getLatLngs()[0].map(p => [
      p.lng,
      p.lat
    ]);

    const centro = layer.getBounds().getCenter();

    const novoLote = {
      id: "lote_" + Date.now(),
      label: "Lote " + (lotes.length + 1),
      status: "livre",
      lat: centro.lat,
      lng: centro.lng,
      polygon: pontos
    };

    lotes.push(novoLote);

    layer.loteId = novoLote.id;

    console.log("Lote manual adicionado:", novoLote);

  }
  else if (tipo.toUpperCase() === "C") {

      casasLayer.addLayer(layer);
      drawnItems.addLayer(layer);

      const centro = layer.getBounds().getCenter();

      let loteEncontrado = null;

      lotes.forEach(lote => {

        if (!lote.polygon || !lote.polygon.length) return;

        const poligonoLote = L.polygon(
          lote.polygon.map(p => [p[1], p[0]])
        );

        if (poligonoLote.getBounds().contains(centro)) {
          loteEncontrado = lote;
        }

      });


      houses.push({

          id: "casa_" + Date.now(),

          lote_id: loteEncontrado ? loteEncontrado.id : null,

          label: "Nova Casa",

          bairro: "",

          lat: centro.lat,

          lng: centro.lng,

          polygon: layer.getLatLngs()[0].map(p => [p.lng, p.lat])

      });


      renderHousesList();

      drawMap();

}

  layer.on("click", function(){

    if(layer.selecionada){

      layer.setStyle({
        color:"#3388ff",
        weight:2,
        fillOpacity:0.2
      });

      layer.selecionada = false;

    }else{

      layer.setStyle({
        color:"yellow",
        weight:4,
        fillOpacity:0.6
      });

      layer.selecionada = true;

    }

  });

});

      map.on(L.Draw.Event.EDITED, async function(e){

        e.layers.eachLayer(layer=>{

          console.log("Casa editada:", layer);

          const centro = layer.getBounds().getCenter();

          const casa = houses.find(h =>
            h.id === layer.casaId
          );

          if(!casa) return;

          casa.lat = centro.lat;
          casa.lng = centro.lng;

          casa.polygon = layer.getLatLngs()[0].map(p => [
            p.lng,
            p.lat
          ]);

          console.log("Casa atualizada:", casa);
          

        });
        await salvarCasas();

      });

};

window.drawMap = function(){

  if(!map || !markersLayer) return;

  markersLayer.clearLayers();
  drawnItems.clearLayers();

  houses.forEach(h => {

    const cadastrado = !!cadastros[h.id];

    console.log(
      h.id,
      "cadastrado:",
      cadastrado,
      cadastros[h.id]
    );

    let corBorda = "#666";
    let corPreenchimento = "#666";

    if(h.statusMissao === "pendente"){
      corBorda = "#2196f3";
      corPreenchimento = "#2196f3";
    }

    if(h.statusMissao === "em_andamento"){
      corBorda = "#ffd600";
      corPreenchimento = "#ffd600";
    }

    if(h.statusMissao === "concluida"){
      corBorda = "#00cc44";
      corPreenchimento = "#00cc44";
    }

    if(cadastrado && !h.statusMissao){
      corBorda = "#00cc44";
      corPreenchimento = "#00cc44";
    }

    if(casaSelecionada === h.id){
      corBorda = "#ffff00";
      corPreenchimento = "#ffff00";
    }

    // Se veio polígono do KML
    if(h.polygon && h.polygon.length){

      const poly = L.polygon(

        h.polygon.map(p => [p[1], p[0]]),

        {
          color: corBorda,
          fillColor: corPreenchimento,
          fillOpacity: 0.90,
          weight: casaSelecionada === h.id ? 4 : 2
        }

      );

      poly.casaId = h.id;

      poly.bindPopup(`
        <b>${h.label}</b><br>
        ${cadastrado ? '✅ Cadastrado' : '⏳ Pendente'}
      `);

      poly.on("click", () => {

        casaSelecionada = h.id;

        drawMap();

        openHouse(h);

      });

      if (casaSelecionada === h.id) {
          drawnItems.addLayer(poly);
      } else {
          markersLayer.addLayer(poly);
      }

    }

    // Se for ponto normal (GeoJSON Point)
    else{

      if(
        h.lat == null ||
        h.lng == null
      ){
        console.warn(
          "Casa sem coordenadas:",
          h
        );
        return;
      }

      const marker = L.circleMarker(
        [h.lat, h.lng],
        {
          radius: casaSelecionada === h.id ? 12 : 8,
          color: corBorda,
          fillColor: corPreenchimento,
          fillOpacity: 1,
          weight: 2
        }
      );

      marker.bindPopup(`
        <b>${h.label}</b><br>
        ${cadastrado ? '✅ Cadastrado' : '⏳ Pendente'}
      `);

      marker.on("click", () => {

        casaSelecionada = h.id;

        drawMap();

        openHouse(h);

      });

      markersLayer.addLayer(marker);

    }

  });

  console.log("Desenhando:", houses);

};

window.renderHousesList = function(lista = houses){

  const el = document.getElementById("houses-list");

  el.innerHTML = "";

  lista.forEach(h=>{

    const cadastro = cadastros[h.id] || {};

    const item = document.createElement("div");

    item.className="house-item";

    item.id="li-"+h.id;

    item.onclick = () => {
      document.getElementById("search-house").value = h.label;
      openHouse(h);
    };

    item.innerHTML=`
      <strong>${h.label}</strong><br>

      <small>
      ${cadastro.nome || ""}
      </small><br>

      <small>
      ${cadastro.endereco || ""}
      </small>

    `;

    el.appendChild(item);

  });

}
 
document.getElementById("search-house").addEventListener("input", function(){

  const busca = this.value.toLowerCase().trim();

  if (busca === "") {

    document.getElementById("sidebar-sub").textContent =
      "Clique em um imóvel para abrir o cadastro"; 

    casasLayer.eachLayer(layer => {
      layer.setStyle({
        color: "#3388ff",
        weight: 2
      });
    });

  }

  const listaFiltrada = houses.filter(h => {

    const cadastro = cadastros[h.id] || {};

    return (
  (h.label || "").toLowerCase().includes(busca) ||
    (cadastro.nome || "").toLowerCase().includes(busca) ||
    (cadastro.endereco || "").toLowerCase().includes(busca) ||
    (cadastro.cpf || "").toLowerCase().includes(busca) ||
    (cadastro.bairro || "").toLowerCase().includes(busca)
  );

  });

  renderHousesList(listaFiltrada);

  document.getElementById("sidebar-sub").textContent =
  `${listaFiltrada.length} imóvel(is) encontrado(s)`;

  if(listaFiltrada.length === 1 && busca !== ""){
    openHouse(listaFiltrada[0]);
  }

});

window.importarKML = async function(xml){

  console.log("ENTROU EM importarKML");

  lotes = [];

  houses = [];

  lotesLayer.clearLayers();

  const placemarks = xml.getElementsByTagName("Placemark");

  console.log("Placemarks encontrados:", placemarks.length);

  

  Array.from(placemarks).forEach((p, i) => {

    const name =
      p.getElementsByTagName("name")[0]?.textContent ||
      ("Lote " + (i + 1));

    const coordText =
      p.getElementsByTagName("coordinates")[0]?.textContent;

    if(!coordText) return;

    const pontos = coordText
      .trim()
      .split(/\s+/)
      .map(c => {

        const partes = c.split(",");

        return [
          parseFloat(partes[0]),
          parseFloat(partes[1])
        ];

      });

    if(!pontos.length) return;

    let somaLat = 0;
    let somaLng = 0;

    pontos.forEach(pt => {

      somaLng += pt[0];
      somaLat += pt[1];

    });

    const centroLng = somaLng / pontos.length;
    const centroLat = somaLat / pontos.length;

    const lote = {

      id: "lote_" + i,

      label: name,

      bairro: "",

      lat: centroLat,

      lng: centroLng,

      polygon: pontos

    };

    lotes.push(lote);

    // TEMPORÁRIO
    //houses.push(lote);

    const polygonLayer = L.polygon(

      pontos.map(p => [p[1], p[0]]),

      {
        color: "#2563eb",
        weight: 2,
        fillOpacity: 0.25
      }

    );

    polygonLayer.feature = {
      type: "Feature",
      properties: {
        id: "lote_" + i,
        nome: name,
        status: "livre"
      }
    };

    lotesLayer.addLayer(polygonLayer);

  });

  console.log("Lotes carregados:", lotes);

  console.log(
    "Polígonos em drawnItems:",
    drawnItems.getLayers().length
  );

  // TEMPORÁRIO
  // Enquanto o sistema usa houses para desenhar,
  // copiamos os lotes para houses.
  //houses = [...lotes];

    await salvarLotes();

    await carregarLotes();
    await carregarCasas();

    renderHousesList();
    updateStats();
    drawMap();
  
  if(drawnItems.getLayers().length){

    map.fitBounds(
      drawnItems.getBounds(),
      { padding:[30,30] }
    );

  }

  showToast("KML carregado com sucesso!");

};

window.loadMapFile = async function(input){



  const normal = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    attribution:'© OpenStreetMap'
  }
  ).addTo(map);

  const satelite = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    attribution:'© Esri'
  }
  );

  L.control.layers({
  "Mapa": normal,
  "Satélite": satelite
}).addTo(map);

  console.log("Arquivo selecionado:", input.files)

  const file = input.files[0];

  console.log("Arquivo:", file);

  if(!file) return;

  const ext = file.name.split('.').pop().toLowerCase();

  console.log("Extensão:", ext);

  // GEOJSON
  if(ext === 'geojson' || ext === 'json'){

    const reader = new FileReader();

    reader.onload = e => {

      console.log("Arquivo lido");

      try{

        const gj = JSON.parse(e.target.result);

        console.log("GeoJSON convertido");
        console.log(gj);

        importarGeoJSON(gj);

      }catch(err){

        console.error("Erro JSON:", err);

        showToast('Erro ao ler GeoJSON', true);

      }

    };

    reader.readAsText(file);

  }

  // KML
  else if(ext === 'kml'){

    const reader = new FileReader();

    reader.onload = e => {

      console.log("KML lido");

      try{

        const parser = new DOMParser();

        const xml = parser.parseFromString(
          e.target.result,
          "text/xml"
        );

        console.log(xml);

        importarKML(xml);

      }catch(err){

        console.error(err);

        showToast('Erro ao ler KML', true);

      }

    };

    reader.readAsText(file);

  }

  // KMZ
  else if(ext === 'kmz'){

    showToast('KMZ ainda em desenvolvimento');

  }

};

function latLngToTile(lat,lng,z){
  const n = Math.pow(2,z);
  const x = Math.floor((lng+180)/360*n);
  const latR = lat*Math.PI/180;
  const y = Math.floor((1-Math.log(Math.tan(latR)+1/Math.cos(latR))/Math.PI)/2*n);
  return {x,y};
}
function tileToLatLng(tx,ty,z){
  const n = Math.pow(2,z);
  const lng = tx/n*360-180;
  const latR = Math.atan(Math.sinh(Math.PI*(1-2*ty/n)));
  return {lat:latR*180/Math.PI, lng};
}
function latLngToPixel(lat,lng,cx,cy,z,w,h){
  const n = Math.pow(2,z);
  const scale = 256;
  const camTile = {
    x:(cx+180)/360*n,
    y:(1-Math.log(Math.tan(cx*Math.PI/180+Math.PI/2))/Math.PI)/2*n
  };
  // reuse camTile for cam center
  const camX=(cam.lng+180)/360*n;
  const camLatR=cam.lat*Math.PI/180;
  const camY=(1-Math.log(Math.tan(camLatR)+1/Math.cos(camLatR))/Math.PI)/2*n;
  const ptX=(lng+180)/360*n;
  const ptLatR=lat*Math.PI/180;
  const ptY=(1-Math.log(Math.tan(ptLatR)+1/Math.cos(ptLatR))/Math.PI)/2*n;
  return {
    px: w/2+(ptX-camX)*scale,
    py: h/2+(ptY-camY)*scale
  };
}
 
let canvasReady = false;

function ativarDesenhoCasa(){

  modoAtual = "desenho";

  showToast("Modo desenho ativado");

}

function modoSelecao(){

  modoAtual = "selecao";

  showToast("Modo seleção ativado");

}

function dividirLotes(){

  showToast("Ferramenta de divisão ativada");

}






function girarEsquerda(){

  anguloMapa -= 5;

  map.setBearing(anguloMapa);

}

function girarDireita(){

  anguloMapa += 5;

  map.setBearing(anguloMapa);

}

function resetarRotacao(){

  anguloMapa = 0;

  map.setBearing(0);

}
 
function resizeCanvas(){
  const canvas=document.getElementById('map-canvas');
  const wrap=document.getElementById('map-wrap');
  canvas.width=wrap.clientWidth;
  canvas.height=wrap.clientHeight;
}
 
function loadTile(url, cb){
  if(tileCache[url]){ cb(tileCache[url]); return; }
  if(pendingTiles[url]){ pendingTiles[url].push(cb); return; }
  pendingTiles[url]=[cb];
  const img=new Image();
  img.crossOrigin='anonymous';
  img.onload=()=>{ tileCache[url]=img; (pendingTiles[url]||[]).forEach(fn=>fn(img)); delete pendingTiles[url]; drawMap(); };
  img.onerror=()=>{ delete pendingTiles[url]; };
  img.src=url;
}
 
console.log(
  "Casas reconstruídas:",
  JSON.stringify(houses, null, 2)
);


 
//
// GPS
//
function startGPS(){
  if(!navigator.geolocation){ document.getElementById('loc-text').textContent='GPS não disponível.'; return; }
  navigator.geolocation.watchPosition(pos=>{
    userLat=pos.coords.latitude; userLng=pos.coords.longitude;
    document.getElementById('loc-text').textContent=
      `Você está aqui — ${userLat.toFixed(5)}, ${userLng.toFixed(5)} (precisão: ${Math.round(pos.coords.accuracy)}m)`;
    drawMap();
  }, ()=>{ document.getElementById('loc-text').textContent='Localizacao aproximada (GPS negado).'; }, {enableHighAccuracy:true, maximumAge:5000});
}
 
//
// CASAS
//


async function salvarLotes(){

  try{

    const lotesParaSalvar = [];

    lotes.forEach((lote, i) => {

      lotesParaSalvar.push({
        id: lote.id,
        nome: lote.label || `Lote ${i + 1}`,
        status: lote.status || "livre",
        geojson: {
          type: "Feature",
          properties: {
            id: lote.id,
            nome: lote.label || `Lote ${i + 1}`,
            status: lote.status || "livre"
          },
          geometry: {
            type: "Polygon",
            coordinates: [lote.polygon]
          }
        }
      });

    });

    console.log("Enviando lotes:", lotesParaSalvar);

    const res = await fetch("/lotes", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(lotesParaSalvar)
    });

    console.log("Status:", res.status);

    const texto = await res.text();

    console.log("Resposta bruta:", texto);

    showToast("Lotes salvos com sucesso!");

  }
  catch(err){

    console.error(err);

    showToast("Erro ao salvar lotes", true);

  }

}

window.salvarCasas = async function(){

  try{

    console.log("Casas para salvar:");
    console.log(houses);

    const res = await fetch("/casas", {

      method: "POST",

      headers: authHeaders(true),

      body: JSON.stringify(houses)

    });

    const dados = await res.json();

    console.log(dados);

    showToast("Casas salvas com sucesso!");

  }
  catch(err){

    console.error(err);

    showToast("Erro ao salvar casas.", true);

  }

};

function importarGeoJSON(gj){

  houses = [];

  gj.features.forEach((f, i) => {

    if(!f.geometry) return;

    const p = f.properties || {};

    let lat = null;
    let lng = null;
    let polygon = null;

    if(f.geometry.type === "Polygon"){

      polygon = f.geometry.coordinates[0];

      let somaLat = 0;
      let somaLng = 0;

      polygon.forEach(coord => {

        somaLng += coord[0];
        somaLat += coord[1];

      });

      lng = somaLng / polygon.length;
      lat = somaLat / polygon.length;

    }

    else if(f.geometry.type === "Point"){

      lng = f.geometry.coordinates[0];
      lat = f.geometry.coordinates[1];

    }

    else{
      return;
    }

    lotes.push({
      id: 'lote_' + Date.now() + '_' + i,
      label:p.endereco || p.nome || p.name || ('Lote '+(i+1)),
      bairro:p.bairro || '',
      lat,
      lng,
      polygon
    });

  });

  console.log("Casas carregadas:", houses);

  renderHousesList();
  updateStats();
  drawMap();

  if(houses.length){

    map.fitBounds(
      L.geoJSON(gj).getBounds()
    );

  }

  showToast("GeoJSON carregado!");

}

function updateStats(){
  const done=Object.keys(cadastros).length;
  document.getElementById('stat-total').textContent=houses.length;
  document.getElementById('stat-done').textContent=done;
  document.getElementById('stat-pend').textContent=houses.length-done;
  document.getElementById('stat-users').textContent=users.filter(u=>u.role==='colaborador'&&u.active).length;
}


window.carregarCasas = async function() {

  try {

    const res = await fetch("/casas", {
      headers: authHeaders()
    });

    const dados = await res.json();

    houses = [];

    dados.forEach(casa => {

      let geo = {};

      try {
        geo = typeof casa.geojson === "string"
          ? JSON.parse(casa.geojson)
          : (casa.geojson || {});
      } catch (err) {
        console.error("GeoJSON inválido da casa:", casa.id, err);
      }

      houses.push({
        id: casa.id,
        lote_id: casa.lote_id,
        label: casa.numero || geo.label || "Casa",
        bairro: geo.bairro || "",
        lat: Number(casa.latitude),
        lng: Number(casa.longitude),
        polygon: Array.isArray(geo.polygon) ? geo.polygon : []
      });

    });

    console.log("Casas carregadas do banco:", houses);

    renderHousesList();
    updateStats();
    drawMap();

  } catch (err) {

    console.error("Erro ao carregar casas:", err);

    showToast("Erro ao carregar casas!", true);

  }

};


window.carregarLotes = async function(){

  try{

    const res = await fetch("/lotes", {
      headers: authHeaders()
    });

    const dados = await res.json();

    lotes = [];

    if(lotesLayer){
      lotesLayer.clearLayers();
    }

    dados.forEach(lote => {

      try{

        const obj =
          typeof lote.geojson === "string"
            ? JSON.parse(lote.geojson)
            : lote.geojson;
        const feature = obj.geojson || obj;

        if(
          !feature.geometry ||
          feature.geometry.type !== "Polygon"
        ){
          return;
        }

        const coords = feature.geometry.coordinates[0];

        let somaLat = 0;
        let somaLng = 0;

        coords.forEach(p => {
          somaLng += Number(p[0]);
          somaLat += Number(p[1]);
        });

        const loteReconstruido = {
          id: lote.id,
          label: lote.nome || "Lote",
          status: lote.status || "livre",
          lat: somaLat / coords.length,
          lng: somaLng / coords.length,
          polygon: coords
        };

        lotes.push(loteReconstruido);

        const poly = L.polygon(
          coords.map(p => [p[1], p[0]]),
          {
            color: "#2563eb",
            fillColor: "#2563eb",
            fillOpacity: 0.12,
            weight: 3
          }
        );

        poly.loteId = loteReconstruido.id;

        poly.bindPopup(`
          <b>${loteReconstruido.label}</b><br>
          Área do lote
        `);

        lotesLayer.addLayer(poly);

        console.log(
          "Polígono adicionado:",
          poly.getBounds()
        );

        console.log(
          "Quantidade de lotes na camada:",
          lotesLayer.getLayers().length
        );

      }
      catch(err){

        console.error(
          "Erro ao reconstruir lote:",
          lote,
          err
        );

      }

    });

    console.log("Lotes carregados do banco:", lotes);

    if (lotesLayer && lotesLayer.getLayers().length > 0) {

      const grupo = L.featureGroup(lotesLayer.getLayers());

      map.fitBounds(
        grupo.getBounds(),
        {
          padding: [30, 30]
        }
      );

    }

  }
  catch(err){

    console.error("Erro ao carregar lotes:", err);

  }

};


window.testarRelatorios = async function(){

  const res = await fetch("/relatorios", {
    headers: authHeaders()
  });

  const dados = await res.json();

  console.log("RELATÓRIOS:", dados);

};