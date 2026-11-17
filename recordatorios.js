/* =====================================================================
   RECORDATORIOS DEL MENÚ — GTO PERÚ
   Este es el único archivo que hay que editar para la campana.
   En GitHub: abrir este archivo → lápiz (Edit) → cambiar → "Commit changes".
   ===================================================================== */

/* 1) VISITAS Y RECOJOS (eventos con fecha)
   - fecha: 'AAAA-MM-DD'   hora: 'HH:MM' (24 h)
   - tipo: 'visita' o 'recojo'
   - Aparecen desde el día anterior y desaparecen solos al pasar el día.
   Para agregar uno, copiar una línea de ejemplo, quitar las // del inicio y cambiar los datos. */
window.EVENTOS = [
  // { fecha:'2026-11-20', hora:'10:00', tipo:'visita', titulo:'Visita de Minera Las Bambas', texto:'Recorrido por laboratorio. Ordenar área de trabajo y tener EPP para visitantes.' },
  // { fecha:'2026-11-21', hora:'15:00', tipo:'recojo', titulo:'Recojo de módulos ACS2000 — Shougang', texto:'Tener guía de remisión y embalaje listos en almacén.' },
];

/* 2) RECORDATORIOS FIJOS (se repiten cada semana)
   - dias: 0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado
   - desde / hasta: horario en que se muestra ese día ('HH:MM')
   - previo: true → también avisa la tarde anterior (desde las 15:00) */
window.FIJOS = [
  { tipo:'basura', dias:[3], desde:'00:00', hasta:'12:00', previo:true,
    titulo:'Hoy pasa el camión de basura', texto:'Sacar las bolsas de basura en la mañana (miércoles). Separar residuos electrónicos y no mezclarlos con la basura común.',
    tituloPrevio:'Mañana miércoles pasa la basura', textoPrevio:'Dejar la basura lista para sacarla temprano.' },
];

/* 3) SEGURIDAD — se muestra uno distinto cada día (rotan solos) */
window.SEGURIDAD = [
  'Usa siempre tu EPP: lentes, guantes y zapatos de seguridad en laboratorio y taller.',
  'Antes de manipular tarjetas electrónicas, colócate la pulsera antiestática (ESD).',
  'Descarga los condensadores y verifica ausencia de tensión antes de intervenir un variador o módulo de potencia.',
  'Aplica bloqueo y etiquetado (LOTO) antes de trabajar en cualquier equipo energizado.',
  'Mantén el orden y la limpieza: pasillos libres y cables sin cruzar zonas de tránsito.',
  'Levanta cargas pesadas con ayuda o con equipo; no fuerces la espalda.',
  'Conoce la ubicación de extintores, botiquín y salidas de emergencia.',
  'No uses herramientas ni cables dañados; repórtalos al supervisor.',
  'Reporta cualquier incidente o condición insegura, por pequeña que sea.',
];
