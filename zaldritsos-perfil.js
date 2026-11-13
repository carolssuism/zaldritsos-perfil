/* ZALDRITSOS: carregador das abas do perfil.
   Este arquivo é estável e quase nunca muda: ele só busca o código e o estilo reais no GitHub Pages,
   que atualiza em cerca de 10 minutos. Para alterar o visual, edite zaldritsos-perfil-app.js / .css. */
(function () {
  if (window.__zpCarregador) return;
  window.__zpCarregador = true;
  var base = 'https://carolssuism.github.io/zaldritsos-perfil/';
  var css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = base + 'zaldritsos-perfil-app.css';
  document.head.appendChild(css);
  var js = document.createElement('script');
  js.src = base + 'zaldritsos-perfil-app.js';
  document.head.appendChild(js);
})();