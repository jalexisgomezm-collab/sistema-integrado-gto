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
    const css=BASE+'gto-status.css';
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
    const head=el('header'), title=el('h2','','Avisos y actividad'), close=el('button','','Cerrar');close.type='button';head.append(title,close);
    const status=el('p'), list=el('div');status.setAttribute('role','status');dialog.append(head,status,list);document.body.append(backdrop,dialog);backdrop.hidden=dialog.hidden=true;
    let disposed=false, general=[], activity=[], loading=false, error='', configError='', lastFocus=null, generation=0;
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
      general.forEach(x=>{const row=el('article','gto-status-item'+(!read.includes(x.id)?' unread':''));row.append(el('small','',x.label),el('strong','',x.title),el('p','',x.text));list.append(row);});
      if(general.some(x=>!read.includes(x.id))){const b=el('button','','Marcar avisos generales como leídos');b.type='button';b.onclick=()=>{try{localStorage.setItem(key,JSON.stringify([...new Set([...read,...general.map(x=>x.id)])].slice(-300)));redraw();}catch{status.textContent='El navegador no permitió guardar la lectura de los avisos.';}};list.append(b);}
      list.append(el('h3','','Actividad del sistema'));
      if(!options.source){list.append(el('p','',options.activityNote||'Los avisos generales están disponibles. Las alertas de actividad de este módulo aún no están conectadas.'));return;}
      if(loading)list.append(el('p','','Consultando actividad…'));
      if(error){list.append(el('p','gto-status-error',error));const retry=el('button','','Reintentar');retry.type='button';retry.onclick=refresh;list.append(retry);}
      if(!loading&&!error&&!activity.length)list.append(el('p','','No hay OT recientes disponibles para tu usuario.'));
      if(activity.length)list.append(el('p','','Hasta 50 OT de los últimos 30 días. La lectura se guarda con tu usuario.'));
      activity.forEach(x=>{const row=el('article','gto-status-item'+(!x.leida?' unread':''));row.append(el('strong','',x.titulo),el('p','',new Date(x.created_at).toLocaleString('es-PE',{timeZone:'America/Lima'})));
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
    function keydown(e){if(dialog.hidden)return;if(e.key==='Escape'){e.preventDefault();hide();}if(e.key==='Tab'){const nodes=Array.from(dialog.querySelectorAll('button:not([disabled]),a[href]'));const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}
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
  global.GTOStatus={mount,otSource,notices,context};
  const script=document.currentScript;
  if(script.dataset.gtoTarget){
    let host=null, api=null, owner=null;
    function sync(){
      const target=document.querySelector(script.dataset.gtoTarget);
      if(target===owner&&host?.isConnected)return;
      api?.dispose();host?.remove();api=host=owner=null;
      if(!target)return;
      owner=target;host=el('div');
      if(script.dataset.gtoBellOnly!==undefined){target.replaceWith(host);}else target.after(host);
      const client=global.DirectorioGTO_opts?.sb;
      api=mount(host,{module:script.dataset.gtoModule,bellOnly:script.dataset.gtoBellOnly!==undefined,activityNote:script.dataset.gtoActivityNote,source:script.dataset.gtoActivity==='ot'&&client?otSource(client):null});
      // Bell replacement target is intentionally gone: observe its containing toolbar instead.
      if(script.dataset.gtoBellOnly!==undefined)owner=host;
    }
    if(script.dataset.gtoBellOnly!==undefined){sync();}else{new MutationObserver(sync).observe(document.body,{childList:true,subtree:true});sync();}
  }
})(window);
