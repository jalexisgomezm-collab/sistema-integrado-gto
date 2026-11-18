/* Shared UI. No credentials, cross-project tokens, business writes or fake activity. */
(function (global) {
  'use strict';
  if (global.GTOStatus) return;
  const BASE = new URL('.', document.currentScript.src).href;
  const mounts = new WeakMap();
  const dateFormat = new Intl.DateTimeFormat('es-PE', {timeZone:'America/Lima',weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const clockFormat = new Intl.DateTimeFormat('es-PE', {timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const partsFormat = new Intl.DateTimeFormat('en-GB', {timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',weekday:'short',hourCycle:'h23'});
  function context(now) {
    const p=Object.fromEntries(partsFormat.formatToParts(now).map(x=>[x.type,x.value]));
    return {day:`${p.year}-${p.month}-${p.day}`,hm:`${p.hour}:${p.minute}`,weekday:{Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[p.weekday]};
  }
  function addDays(day,n) {const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
  function notices(now, data) {
    const c=context(now), next=addDays(c.day,1), items=[];
    (data.events||[]).filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x.fecha)&&x.fecha>=c.day&&x.fecha<=addDays(c.day,30)).forEach((x,i)=>items.push({id:'ev-'+x.fecha+'-'+x.titulo,title:x.titulo,text:x.texto||'',label:(x.fecha===c.day?'Hoy':x.fecha===next?'Mañana':x.fecha)+(x.hora?' · '+x.hora:''),active:x.fecha<=next}));
    (data.fixed||[]).forEach((x,i)=>{
      const today=(x.dias||[]).includes(c.weekday)&&c.hm>=(x.desde||'00:00')&&c.hm<=(x.hasta||'23:59');
      const before=!today&&x.previo&&(x.dias||[]).includes((c.weekday+1)%7)&&c.hm>='15:00';
      if(today||before)items.push({id:`${before?'fxp':'fx'}-${i}-${c.day}`,title:before?(x.tituloPrevio||x.titulo):x.titulo,text:before?(x.textoPrevio||x.texto):x.texto,label:before?'Mañana':'Hoy',active:true});
    });
    if(data.safety?.length){const n=Math.floor(Date.parse(c.day+'T00:00:00Z')/86400000)%data.safety.length;items.push({id:'sg-'+c.day,title:'Seguridad del día',text:data.safety[n],label:'Seguridad',active:true});}
    return items;
  }
  function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
  function assertOT(item){return item&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)&&typeof item.titulo==='string'&&Number.isFinite(Date.parse(item.created_at));}
  let configPromise;
  function config(){
    if(global.EVENTOS&&global.FIJOS&&global.SEGURIDAD)return Promise.resolve();
    if(!configPromise)configPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=BASE+'recordatorios.js';s.onload=resolve;s.onerror=()=>{configPromise=null;reject(Error('No se pudieron cargar los avisos.'));};document.head.append(s);});
    return configPromise;
  }
  function mount(host, options={}) {
    if(mounts.has(host))return mounts.get(host);
    const css=BASE+'gto-status.css?v=20261118-6';
    if(!Array.from(document.querySelectorAll('link[rel=stylesheet]')).some(l=>l.href===css)){const l=el('link');l.rel='stylesheet';l.href=css;document.head.append(l);}
    const root=el('div','gto-status'+(options.bellOnly?' gto-status-bell-only':''));
    root.setAttribute('aria-label','Hora de Perú y notificaciones');
    const clock=el('div','gto-status-clock'), time=el('time'), label=el('small');clock.append(time,label);
    const note=el('span','gto-status-note','Hora de Perú · '+(options.module||'GTO'));
    const bell=el('button','','Avisos');bell.type='button';bell.setAttribute('aria-haspopup','dialog');
    const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('stroke-width','2');icon.setAttribute('aria-hidden','true');
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a2 2 0 0 0 3.4 0');icon.append(path);bell.prepend(icon);
    const count=el('span','gto-status-count');bell.append(count);
    if(!options.bellOnly)root.append(clock,note);root.append(bell);host.append(root);
    const backdrop=el('div','gto-status-backdrop'), dialog=el('section','gto-status-dialog');
    dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Avisos y actividad');dialog.tabIndex=-1;
    const head=el('header'), title=el('h2','','Bandeja de avisos'), close=el('button','','Cerrar');close.type='button';head.append(title,close);
    const status=el('p'), list=el('div');status.setAttribute('role','status');dialog.append(head,status,list);document.body.append(backdrop,dialog);backdrop.hidden=dialog.hidden=true;
    let disposed=false, general=[], activity=[], loading=false, error='', configError='', lastFocus=null, generation=0;
    const filters=el('form','gto-inbox-filters');
    const search=el('input'); search.type='search';search.placeholder='Buscar aviso u OT';
    function field(label,input){const wrap=el('label','',label);wrap.append(input);filters.append(wrap);return input;}
    field('Buscar',search);
    function select(label,values){const input=el('select');values.forEach(([value,text])=>input.add(new Option(text,value)));return field(label,input);}
    const origin=select('Sistema',[['','Todos'],['general','Portal GTO'],...(options.source?[['activity',options.module||'Operaciones']]:[])]);
    const state=select('Estado',[['','Todos'],['new','Sin leer'],['seen','Leído']]);
    const dateFrom=field('Desde',el('input')),dateTo=field('Hasta',el('input'));dateFrom.type=dateTo.type='date';
    const clear=el('button','','Limpiar');clear.type='reset';filters.append(clear);
    filters.oninput=redraw;filters.onreset=()=>setTimeout(redraw,0);filters.onsubmit=e=>e.preventDefault();
    dialog.insertBefore(filters,status);
    function matches(system,read,day,text){return (!origin.value||origin.value===system)&&(!state.value||state.value===(read?'seen':'new'))&&(!dateFrom.value||day>=dateFrom.value)&&(!dateTo.value||day<=dateTo.value)&&text.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase());}
    const key='gto_recordatorios_vistos';
    function seen(){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[];}catch{return [];}}
    function redraw(){
      if(disposed)return;
      general=notices(new Date(),{events:global.EVENTOS,fixed:global.FIJOS,safety:global.SEGURIDAD});
      const read=seen(), n=general.filter(x=>x.active&&!read.includes(x.id)).length+activity.filter(x=>!x.leida).length;
      count.textContent=n?String(n):'';bell.setAttribute('aria-label',`Avisos y actividad, ${n} sin leer`);
      if(dialog.hidden)return;
      list.replaceChildren();
      if(configError)list.append(el('p','gto-status-error',configError));
      list.append(el('h3','','Avisos generales'));
      if(!general.length)list.append(el('p','','No hay avisos generales para esta fecha.'));
      const shownGeneral=general.filter(x=>matches('general',read.includes(x.id),x.id.startsWith('ev-')?x.id.slice(3,13):x.label==='Mañana'?addDays(context(new Date()).day,1):context(new Date()).day,[x.title,x.text,x.label].join(' ')));
      const shownActivity=activity.filter(x=>matches('activity',x.leida,context(new Date(x.created_at)).day,x.titulo));
      if(!shownGeneral.length&&!shownActivity.length&&!loading)list.append(el('p','','Sin resultados para estos filtros.'));
      shownGeneral.forEach(x=>{const row=el('article','gto-status-item'+(!read.includes(x.id)?' unread':''));row.append(el('small','',x.label),el('strong','',x.title),el('p','',x.text));list.append(row);});
      if(shownGeneral.some(x=>!read.includes(x.id))){const b=el('button','','Marcar avisos generales como leídos');b.type='button';b.onclick=()=>{try{localStorage.setItem(key,JSON.stringify([...new Set([...read,...shownGeneral.map(x=>x.id)])].slice(-300)));redraw();}catch{status.textContent='El navegador no permitió guardar la lectura de los avisos.';}};list.append(b);}
      list.append(el('h3','','Actividad del sistema'));
      if(!options.source){list.append(el('p','',options.activityNote||'Los avisos generales están disponibles. Las alertas de actividad de este módulo aún no están conectadas.'));return;}
      if(loading)list.append(el('p','','Consultando actividad…'));
      if(error){list.append(el('p','gto-status-error',error));const retry=el('button','','Reintentar');retry.type='button';retry.onclick=refresh;list.append(retry);}
      if(!loading&&!error&&!activity.length)list.append(el('p','','No hay OT recientes disponibles para tu usuario.'));
      if(activity.length)list.append(el('p','','Hasta 50 OT de los últimos 30 días. La lectura se guarda con tu usuario.'));
      shownActivity.forEach(x=>{const row=el('article','gto-status-item'+(!x.leida?' unread':''));row.append(el('strong','',x.titulo),el('p','',new Date(x.created_at).toLocaleString('es-PE',{timeZone:'America/Lima'})));
        const a=el('a','','Abrir OT');a.href='https://maestro-gestion-operaciones.vercel.app/#/servicio/'+encodeURIComponent(x.id);row.append(a);
        if(!x.leida){const b=el('button','','Marcar como leída');b.type='button';b.onclick=async()=>{b.disabled=true;try{await options.source.read(x.id);if(disposed)return;x.leida=true;status.textContent='Lectura guardada.';redraw();}catch{status.textContent='No se pudo guardar la lectura. Reintenta.';b.disabled=false;}};row.append(b);}else row.append(el('small','gto-status-success','Leída'));list.append(row);
      });
    }
    async function refresh(){
      if(disposed||loading||!options.source||document.hidden)return;
      const gen=++generation;loading=true;error='';redraw();
      try{const data=await options.source.list();if(disposed||gen!==generation)return;activity=(Array.isArray(data)?data:[]).filter(assertOT).slice(0,50);}
      catch{if(disposed||gen!==generation)return;activity=[];error='No se pudo consultar la actividad. La integración puede estar pendiente de activación o tu sesión necesita renovarse.';}
      finally{if(!disposed&&gen===generation){loading=false;redraw();}}
    }
    function hide(){dialog.hidden=backdrop.hidden=true;bell.setAttribute('aria-expanded','false');lastFocus?.focus?.();}
    function open(){lastFocus=document.activeElement;dialog.hidden=backdrop.hidden=false;bell.setAttribute('aria-expanded','true');status.textContent='';redraw();close.focus();config().then(()=>{configError='';redraw();}).catch(()=>{configError='No se pudieron cargar los avisos generales. Reabre el panel para reintentar.';redraw();});refresh();}
    function keydown(e){if(dialog.hidden)return;if(e.key==='Escape'){e.preventDefault();hide();}if(e.key==='Tab'){const nodes=Array.from(dialog.querySelectorAll('button:not([disabled]),a[href],input,select'));const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}
    function tick(){const now=new Date();time.textContent=clockFormat.format(now);time.dateTime=now.toISOString();label.textContent=dateFormat.format(now);}
    function visible(){if(!document.hidden){tick();refresh();}}
    function onStorage(e){if(e.key===key)redraw();}
    bell.onclick=open;close.onclick=hide;backdrop.onclick=hide;bell.setAttribute('aria-expanded','false');
    document.addEventListener('keydown',keydown);document.addEventListener('visibilitychange',visible);global.addEventListener('storage',onStorage);
    tick();redraw();config().then(()=>{configError='';redraw();}).catch(()=>{configError='No se pudieron cargar los avisos generales. Reabre el panel para reintentar.';redraw();});refresh();
    const timer=setInterval(tick,1000), update=setInterval(()=>{redraw();refresh();},60000);
    const api={refresh,dispose(){if(disposed)return;disposed=true;generation++;clearInterval(timer);clearInterval(update);document.removeEventListener('keydown',keydown);document.removeEventListener('visibilitychange',visible);global.removeEventListener('storage',onStorage);root.remove();dialog.remove();backdrop.remove();mounts.delete(host);}};
    mounts.set(host,api);return api;
  }
  function otSource(client){return {async list(){const r=await client.rpc('gto_ot_actividad');if(r.error)throw r.error;return r.data;},async read(id){const r=await client.rpc('gto_ot_marcar_leida',{p_ot:id});if(r.error)throw r.error;}};}
function mountToolbar(host, options={}) {
 const previous=mounts.get(host); if(previous)return previous;
 const shell=el('div','gto-shared-toolbar');
 shell.dataset.gtoModule=options.module||'GTO';
 const brand=el('a','gto-toolbar-brand');brand.href=options.home||'https://sistema-integrado-gto.vercel.app';
 const logo=el('img');logo.src=BASE+'assets/logo-gto.png';logo.alt='GTO';
 const name=el('span','','Sistema Integrado GTO');name.append(el('b','',options.module||'GTO'));brand.append(logo,name);
 const CLIMA={lat:-16.41,lon:-71.54,lugar:'Arequipa'};
 const TZ='America/Lima';
const svg=(d,w=2.2)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I={
  flecha:svg('<path d="M9 5l7 7-7 7"/>',3.2),
  reloj:svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  sol:svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  nube:svg('<path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z"/>'),
  solnube:svg('<path d="M8 3v1.5M3.5 8H5M4.8 4.8l1 1M12.2 4.8l-1 1"/><path d="M5.5 10.5a3 3 0 0 1 5.6-1.6"/><path d="M8.5 20h9a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 8.3 12a3.9 3.9 0 0 0 .2 8z"/>'),
  lluvia:svg('<path d="M7 15h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 6.2 4.5 4.5 0 0 0 7 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>'),
  tormenta:svg('<path d="M7 15h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 6.2 4.5 4.5 0 0 0 7 15z"/><path d="M12 15l-2 4h3l-2 4"/>'),
  niebla:svg('<path d="M4 9h16M3 13h18M5 17h14"/>'),
  dolar:svg('<path d="M12 2v20"/><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
  campana:svg('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
  soporte:svg('<path d="M3 14v-3a9 9 0 0 1 18 0v3"/><path d="M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z"/><path d="M3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z"/><path d="M18 17v1a3 3 0 0 1-3 3h-3"/>'),
  completa:svg('<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/>'),
  salir:svg('<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>'),
  wa:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg>',
  basura:svg('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/><path d="M10 11v6M14 11v6"/>'),
  seguridad:svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>'),
  visita:svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 4.5a3 3 0 0 1 0 6M21 20a5 5 0 0 0-4-4.9"/>'),
  recojo:svg('<path d="M1 6h13v10H1z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="5.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/>'),
  mail:svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
};


 const barra=`<div class="barra">
  <div class="chip" title="Clima en ${CLIMA.lugar}"><span class="ico" data-cico>${I.solnube}</span><div><div class="v" data-ct>-- °C</div><div class="l" data-cl>${CLIMA.lugar}</div></div></div>
  <div class="chip" title="Tipo de cambio del dólar"><span class="ico">${I.dolar}</span><div><div class="v" data-tc>S/ --</div><div class="l" data-tcl>Tipo de cambio</div></div></div>
  <div class="chip reloj" role="timer"><span class="ico">${I.reloj}</span><div><div class="v"><span data-h>--:--</span><small data-s></small></div><div class="l" data-f></div></div><div class="sal" data-g></div></div>
  <button class="btn" data-abrir="pAvisos" title="Recordatorios" aria-label="Recordatorios">${I.campana}<span class="badge" data-badge></span></button>
  <button class="btn" data-abrir="pSoporte" title="Soporte de sistemas" aria-label="Soporte de sistemas">${I.soporte}</button>
  <button class="btn" data-full title="Pantalla completa" aria-label="Pantalla completa">${I.completa}</button>
</div>`;

 const wrap=el('div');wrap.innerHTML=barra;shell.append(brand,wrap);host.append(shell);
 const bellHost=el('div','gto-shared-bell');wrap.querySelector('[data-abrir=pAvisos]').replaceWith(bellHost);
 const api=mount(bellHost,{...options,bellOnly:true});
 const bell=bellHost.querySelector('button');bell.classList.add('btn');
 Array.from(bell.childNodes).filter(n=>n.nodeType===3).forEach(n=>n.remove());
 const set=(q,value)=>wrap.querySelectorAll(q).forEach(node=>{node.innerHTML=value;});
 const fH=new Intl.DateTimeFormat('es-PE',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:true});
const fS=new Intl.DateTimeFormat('es-PE',{timeZone:TZ,second:'2-digit'});
const fF=new Intl.DateTimeFormat('es-PE',{timeZone:TZ,weekday:'long',day:'numeric',month:'long',year:'numeric'});
const fHH=new Intl.DateTimeFormat('es-PE',{timeZone:TZ,hour:'numeric',hour12:false});
function tic(){
  const d=new Date(), p=fH.formatToParts(d), v=t=>(p.find(x=>x.type===t)||{}).value||'';
  const ap=v('dayPeriod').replace(/[.\s]/g,'').toUpperCase();
  const h=+fHH.format(d);
  set('[data-h]',v('hour')+':'+v('minute'));
  set('[data-s]',fS.format(d).padStart(2,'0')+' '+ap);
  set('[data-f]',fF.format(d).replace(/^./,c=>c.toUpperCase()));
  set('[data-g]',h<12?'Buenos<br>días':h<19?'Buenas<br>tardes':'Buenas<br>noches');
}

 function iconoClima(c){ if(c===0)return[I.sol,'Despejado']; if(c<=2)return[I.solnube,'Parcial nublado']; if(c===3)return[I.nube,'Nublado'];
  if(c<=48)return[I.niebla,'Neblina']; if(c<=67||(c>=80&&c<=82))return[I.lluvia,'Lluvia']; if(c<=77)return[I.nube,'Nieve']; return[I.tormenta,'Tormenta']; }
async function clima(){
  try{
    const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${CLIMA.lat}&longitude=${CLIMA.lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=${encodeURIComponent(TZ)}&forecast_days=1`);
    const j=await r.json(); const [ic,txt]=iconoClima(j.current.weather_code);
    set('[data-cico]',ic); set('[data-ct]',Math.round(j.current.temperature_2m)+' °C');
    set('[data-cl]',`${CLIMA.lugar} · ${txt} · ${Math.round(j.daily.temperature_2m_min[0])}°/${Math.round(j.daily.temperature_2m_max[0])}°`);
  }catch(e){ set('[data-cl]',CLIMA.lugar+' · sin datos'); }
}

 const n3=x=>Number(x).toFixed(3);
async function tipoCambio(){
  try{
    const r=await fetch('https://api.apis.net.pe/v1/tipo-cambio-sunat'); if(!r.ok) throw 0;
    const j=await r.json(); if(!j.venta) throw 0;
    set('[data-tc]',`S/ ${n3(j.venta)}<small>V</small>`); set('[data-tcl]',`SUNAT · compra ${n3(j.compra)}`); return;
  }catch(e){}
  try{
    const r=await fetch('https://open.er-api.com/v6/latest/USD'); const j=await r.json();
    set('[data-tc]',`S/ ${n3(j.rates.PEN)}`); set('[data-tcl]','Dólar · referencial');
  }catch(e){ set('[data-tcl]','Tipo de cambio · sin datos'); }
}

 const exchange=wrap.querySelector('[data-tc]').closest('.chip');
 const isBitacora=options.module==='Bitácora Técnica';
 if(isBitacora){
   const shortcut=el('a','chip gto-ot-shortcut');
   shortcut.href='#/ot';
   shortcut.innerHTML='<span class="ico">'+I.campana+'</span><span><strong>Órdenes de trabajo</strong><span class="l">Consultar OT / PI</span></span>';
   exchange.replaceWith(shortcut);
 }
 const support=wrap.querySelector('[data-abrir=pSoporte]');
 support.onclick=()=>{location.href='https://sistema-integrado-gto.vercel.app/#soporte';};
 const full=wrap.querySelector('[data-full]');
 full.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}};

 const moduleName=options.module;
 const quick=el('nav','gto-toolbar-quick');
 quick.setAttribute('aria-label','Accesos del módulo');
 shell.insertBefore(quick,wrap);
 const toolsMenu=el('details','gto-toolbar-menu');
 const previousHeader=host.previousElementSibling;
 const originalHeader=host.closest('header.top')||(previousHeader?.matches('.workspace-topbar')?previousHeader:null);
 const logout=originalHeader?.querySelector('#logout,#b-out')||
   document.querySelector('.sidebar-logout,.signout-button')||
   (moduleName==='Logística y Compras'?Array.from(document.querySelectorAll('aside button')).find(b=>/^(cerrar sesión|salir)$/i.test(b.textContent.trim())):null);
 const account=originalHeader?.querySelector('.workspace-person b,.user span,.user')?.textContent.trim();
 const toolsSummary=el('summary','',account?'Mi cuenta':'Herramientas');
 toolsMenu.append(toolsSummary);
 const toolPanel=el('div','gto-toolbar-popover');
 toolsMenu.append(toolPanel);
 if(account)toolPanel.append(el('strong','gto-toolbar-account',account));
 const moved=[];
 function addAction(container,label,action){
   const button=el('button','gto-toolbar-action',label);
   button.type='button';button.onclick=action;container.append(button);
 }
 function mirror(container,label,control,hide=false){
   if(!control)return;
   if(control instanceof HTMLAnchorElement && control.href && control.getAttribute('href')!=='#' && !control.hasAttribute('data-directorio-gto')){
     const a=el('a','gto-toolbar-action',label);a.href=control.href;
     if(control.target){a.target=control.target;a.rel='noopener noreferrer';}
     container.append(a);
   }else addAction(container,label,()=>control.click());
   if(hide){control.setAttribute('data-gto-mirrored','');moved.push(control);}
 }
 function link(path){return Array.from(document.querySelectorAll('nav a[href],aside a[href]')).find(a=>a.getAttribute('href')===path);}
 if(moduleName==='Maestro de Gestión'){
   const actions=Array.from(originalHeader?.querySelectorAll(':scope > a,:scope > button')||[]);
   mirror(quick,'Correos',actions.find(a=>a.matches('[data-directorio-gto]')||/Correos/i.test(a.textContent)),true);
   mirror(quick,'Sistema OC',actions.find(a=>/Sistema OC/i.test(a.textContent)),true);
 }else if(moduleName==='Cotizaciones'){
   mirror(quick,'Nueva cotización',link('/nueva'));
   mirror(quick,'Historial',link('/historial'));
 }else if(moduleName==='Logística y Compras'){
   mirror(quick,'Solicitudes',link('/solicitudes'));
   mirror(quick,'Órdenes de compra',link('/ordenes'));
 }else if(moduleName==='Bitácora Técnica'){
   mirror(quick,'Mi día',link('#/dia')||link('#/'));
   mirror(quick,'Órdenes de trabajo',link('#/ot'));
 }else if(moduleName==='RR. HH. y Personal'){
   addAction(quick,'Inicio',()=>{location.hash='/inicio';});
 }else if(moduleName==='Finanzas'){
   for(const label of ['Resumen','Presupuesto']){
     const control=Array.from(document.querySelectorAll('aside button')).find(b=>b.textContent.trim().includes(label));
     mirror(quick,label,control);
   }
 }
 if(!quick.childElementCount)quick.hidden=true;
 const actionsBar=wrap.querySelector('.barra');
 const indicators=el('details','gto-toolbar-menu gto-toolbar-indicators');
 const indicatorPanel=el('div','gto-toolbar-popover');
 indicators.append(el('summary','','Indicadores'),indicatorPanel);
 for(const chip of actionsBar.querySelectorAll('.chip:not(.reloj)'))indicatorPanel.append(chip);
 actionsBar.prepend(indicators);
 support.hidden=true;full.hidden=true;
 addAction(toolPanel,'Soporte de sistemas',()=>support.click());
 addAction(toolPanel,'Pantalla completa',()=>{toolsMenu.open=false;full.click();});
 const portal=el('a','gto-toolbar-action','Menú GTO');portal.href='https://sistema-integrado-gto.vercel.app';if(moduleName==='Maestro de Gestión'){portal.classList.add('gto-portal-access');quick.append(portal);quick.hidden=false;}else toolPanel.append(portal);
 if(logout)mirror(toolPanel,'Salir',logout,!!originalHeader?.contains(logout));
 actionsBar.append(toolsMenu);
 for(const panel of [indicators,toolsMenu]){
   panel.ontoggle=()=>{if(panel.open){for(const other of [indicators,toolsMenu])if(other!==panel)other.open=false;}};
 }
 const closeMenus=e=>{for(const panel of [indicators,toolsMenu]){
   if(e.type==='keydown'&&e.key==='Escape'&&panel.open){panel.open=false;panel.querySelector('summary').focus();}
   if(e.type==='click'&&!panel.contains(e.target))panel.open=false;
 }};
 document.addEventListener('click',closeMenus);
 document.addEventListener('keydown',closeMenus);

 tic();clima();if(!isBitacora)tipoCambio();
 const timers=[setInterval(tic,1000),setInterval(clima,1800000)];
 if(!isBitacora)timers.push(setInterval(tipoCambio,3600000));
 const result={refresh:api.refresh,dispose(){timers.forEach(clearInterval);document.removeEventListener('click',closeMenus);document.removeEventListener('keydown',closeMenus);moved.forEach(node=>node.removeAttribute('data-gto-mirrored'));api.dispose();shell.remove();mounts.delete(host);}};
 mounts.set(host,result);return result;
}
  const mountView=(host,options={})=>options.bellOnly?mount(host,options):mountToolbar(host,options);
  global.GTOStatus={mount:mountView,otSource,notices,context};
  const script=document.currentScript;
  if(script.dataset.gtoTarget){
    let host=null, api=null, owner=null;
    function sync(){
      const target=document.querySelector(script.dataset.gtoTarget);
      if(target===owner&&host?.isConnected)return;
      api?.dispose();host?.remove();api=host=owner=null;
      if(!target)return;
      owner=target;host=el('div');
      if(script.dataset.gtoBellOnly!==undefined){target.replaceWith(host);}else if(script.dataset.gtoModule==='Maestro de Gestión'||script.dataset.gtoModule==='Bitácora Técnica'||script.dataset.gtoModule==='RR. HH. y Personal'){
        target.classList.add('gto-integrated-header');
        host.className='gto-integrated-host';
        target.append(host);
      }else target.after(host);
      const client=global.DirectorioGTO_opts?.sb;
      api=mountView(host,{module:script.dataset.gtoModule,bellOnly:script.dataset.gtoBellOnly!==undefined,activityNote:script.dataset.gtoActivityNote,home:script.dataset.gtoModule==='RR. HH. y Personal'?target.querySelector(':scope > a.brand')?.getAttribute('href'):undefined,source:script.dataset.gtoActivity==='ot'&&client?otSource(client):null});
      // Bell replacement target is intentionally gone: observe its containing toolbar instead.
      if(script.dataset.gtoBellOnly!==undefined)owner=host;
    }
    if(script.dataset.gtoBellOnly!==undefined){sync();}else{new MutationObserver(sync).observe(document.body,{childList:true,subtree:true});sync();}
  }
})(window);
