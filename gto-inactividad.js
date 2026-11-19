/* Cierre de sesión por inactividad — Sistema Integrado GTO (19/11/2026, pedido por Alexis).
   Si nadie mueve el mouse, escribe, hace clic o desplaza la pantalla durante 5 minutos, la sesión se cierra.
   Al minuto 4 aparece un aviso con un botón para seguir trabajando. La actividad en cualquier pestaña del
   mismo sistema mantiene viva la sesión en las demás. No lee ni envía datos: solo usa el botón "Salir" del
   propio sistema y, si no lo encuentra, borra la sesión guardada en este navegador. */
(function () {
  'use strict';
  if (window.__gtoInactividad) return;
  window.__gtoInactividad = true;

  var LIMITE = 5 * 60 * 1000;   // 5 minutos sin actividad
  var AVISO = 60 * 1000;        // aviso 1 minuto antes
  var CLAVE = 'gto_ultima_actividad';
  var BANDERA = 'gto_cierre_inactividad';
  var aviso = null, cerrando = false, ultimoGuardado = 0;

  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  function clavesSesion() {
    var out = [];
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/^sb-.+-auth-token/.test(k)) out.push(k); } } catch (e) {}
    return out;
  }
  function cookiesSesion() {
    return document.cookie.split(';').map(function (c) { return c.trim().split('=')[0]; }).filter(function (n) { return /^sb-.+-auth-token/.test(n); });
  }
  function haySesion() { return clavesSesion().length > 0 || cookiesSesion().length > 0; }
  function ultima() { return +(leer(CLAVE) || 0); }
  function marcar() { ultimoGuardado = Date.now(); guardar(CLAVE, String(ultimoGuardado)); }

  function actividad() {
    if (cerrando) return;
    if (aviso || Date.now() - Math.max(ultimoGuardado, ultima()) > 5000) marcar();
    if (aviso) quitarAviso();
  }
  ['mousemove', 'mousedown', 'keydown', 'scroll', 'wheel', 'touchstart', 'input'].forEach(function (ev) {
    window.addEventListener(ev, actividad, { passive: true, capture: true });
  });

  function estilos() {
    if (document.getElementById('gto-inact-css')) return;
    var s = document.createElement('style');
    s.id = 'gto-inact-css';
    s.textContent =
      '.gto-inact{position:fixed;right:18px;bottom:18px;z-index:2147483000;max-width:min(340px,calc(100vw - 36px));background:#fff;color:#1A2420;' +
      'border:1px solid #CBE1D3;border-left:5px solid #06612E;border-radius:12px;box-shadow:0 12px 32px rgba(5,59,30,.22);padding:14px 16px;' +
      'font:600 14px/1.4 Nunito,"Segoe UI",system-ui,sans-serif}' +
      '.gto-inact b{display:block;font-size:15px;color:#064925;margin-bottom:4px}' +
      '.gto-inact button{margin-top:10px;background:#06612E;color:#fff;border:0;border-radius:9px;padding:8px 14px;font:800 14px Nunito,"Segoe UI",sans-serif;cursor:pointer}' +
      '.gto-inact button:hover{background:#077A3A}';
    (document.head || document.documentElement).appendChild(s);
  }
  function mostrarAviso(seg) {
    estilos();
    if (!aviso) {
      aviso = document.createElement('div');
      aviso.className = 'gto-inact';
      aviso.setAttribute('role', 'alertdialog');
      aviso.innerHTML = '<b>¿Sigues ahí?</b><span></span><br><button type="button">Seguir trabajando</button>';
      aviso.querySelector('button').addEventListener('click', function () { marcar(); quitarAviso(); });
      document.body.appendChild(aviso);
    }
    aviso.querySelector('span').textContent = 'Por seguridad, tu sesión se cerrará en ' + seg + ' s por inactividad.';
  }
  function quitarAviso() { if (aviso) { aviso.remove(); aviso = null; } }
  function avisoCerrada() {
    estilos();
    var d = document.createElement('div');
    d.className = 'gto-inact';
    d.setAttribute('role', 'status');
    d.innerHTML = '<b>Sesión cerrada</b>Se cerró por 5 minutos sin actividad. Vuelve a ingresar para continuar.';
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 9000);
  }

  function botonSalir() {
    var sel = document.querySelector('#salir, #logout, #b-out, .sidebar-logout, .signout-button');
    if (sel) return sel;
    var cands = document.querySelectorAll('button, a');
    for (var i = 0; i < cands.length; i++) {
      var t = (cands[i].textContent || '').trim();
      if (/^(salir|cerrar sesión|cerrar sesion)$/i.test(t) && !cands[i].closest('.gto-inact')) return cands[i];
    }
    return null;
  }
  function borrarSesionLocal() {
    clavesSesion().forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    cookiesSesion().forEach(function (n) {
      document.cookie = n + '=; Max-Age=0; path=/';
      document.cookie = n + '=; Max-Age=0; path=/; domain=' + location.hostname;
    });
  }
  function cerrar() {
    if (cerrando) return;
    cerrando = true;
    quitarAviso();
    try { sessionStorage.setItem(BANDERA, '1'); } catch (e) {}
    var b = botonSalir();
    if (b) { try { b.click(); } catch (e) {} }
    setTimeout(function () {
      if (haySesion()) { borrarSesionLocal(); location.reload(); return; }
      cerrando = false;
      guardar(CLAVE, '0');
      if (!document.querySelector('.gto-inact')) mostrarSiCerrada();
    }, 2500);
  }
  function mostrarSiCerrada() {
    var f = null;
    try { f = sessionStorage.getItem(BANDERA); sessionStorage.removeItem(BANDERA); } catch (e) {}
    if (f && !haySesion()) avisoCerrada();
  }

  function revisar() {
    if (cerrando) return;
    if (!haySesion()) { quitarAviso(); return; }
    var u = ultima();
    if (!u) { marcar(); return; }
    var inactivo = Date.now() - u;
    if (inactivo >= LIMITE) cerrar();
    else if (inactivo >= LIMITE - AVISO) mostrarAviso(Math.ceil((LIMITE - inactivo) / 1000));
    else quitarAviso();
  }

  function iniciar() {
    mostrarSiCerrada();
    // Abrir o recargar una pantalla cuenta como actividad (así no se cierra justo después de ingresar).
    marcar();
    setInterval(revisar, 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) revisar(); });
  }
  if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);
})();
