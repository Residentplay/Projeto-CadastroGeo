// Mapa do CadastroGeo

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

function drawMap(){

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

}

function renderHousesList(lista = houses){

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