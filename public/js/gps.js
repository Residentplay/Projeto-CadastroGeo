let userLat = null, userLng = null;


window.obterMinhaLocalizacao = function() {

  if (!navigator.geolocation) {
    alert("Seu navegador não suporta GPS.");
    return;
  }

  navigator.geolocation.getCurrentPosition(

    function(posicao) {

      const lat = posicao.coords.latitude;
      const lng = posicao.coords.longitude;

      console.log("Minha localização:", lat, lng);

    },

    function(erro) {

      console.error(
        "Erro GPS:",
        erro.code,
        erro.message
      );

      alert(
        "Erro ao obter localização: " +
        erro.message
      );

    },

    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }

  );

};


window.calcularDistancia = function(lat1, lng1, lat2, lng2){

  const rad = valor => valor * Math.PI / 180;
  const raioTerra = 6371;

  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) *
    Math.cos(rad(lat2)) *
    Math.sin(dLng / 2) ** 2;

  return raioTerra * 2 * Math.atan2(
    Math.sqrt(a),
    Math.sqrt(1 - a)
  );

};


window.navegarParaCasa = function(latitude, longitude){

  const url =
    `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  window.open(url, "_blank");

};