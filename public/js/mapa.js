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