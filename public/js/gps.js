let userLat = null, userLng = null;


window.obterMinhaLocalizacao = function() {

  if (!navigator.geolocation) {
    showToast("GPS não disponível neste dispositivo.", true);
    return;
  }

  showToast("Obtendo localização...");

  navigator.geolocation.getCurrentPosition(

    function(posicao) {

      const lat = posicao.coords.latitude;
      const lng = posicao.coords.longitude;
      const precisao = Math.round(posicao.coords.accuracy);

      userLat = lat;
      userLng = lng;

      const locText = document.getElementById('loc-text');

      if (locText) {
        locText.textContent =
          `Você está aqui — ${lat.toFixed(5)}, ${lng.toFixed(5)} ` +
          `(precisão: ${precisao}m)`;
      }

      showToast(
        `Localização encontrada. Precisão aproximada: ${precisao}m`
      );

      drawMap();
    },

    function(erro) {

      console.error(
        "Erro GPS:",
        erro.code,
        erro.message
      );

      if (erro.code === 1) {
        showToast("Permissão de localização negada.", true);
      }
      else if (erro.code === 2) {
        showToast("Não foi possível determinar sua localização.", true);
      }
      else if (erro.code === 3) {
        showToast("Tempo limite ao buscar localização.", true);
      }
      else {
        showToast("Erro ao acessar o GPS.", true);
      }
    },

    {
      enableHighAccuracy: true,
      timeout: 15000,
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