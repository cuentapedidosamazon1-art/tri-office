/* ================================================================
   CALCULADORA DE VOLUMEN DE IMPRESIÓN — TRI OFFICE
   Lógica de la aplicación. Todo corre en el navegador (sin backend),
   persistencia mediante localStorage.
   ================================================================ */
(function(){
  'use strict';

  /* ---------- Constantes de negocio ---------- */
  const PAGES_PER_RESMA = 500;
  const WEEKS_PER_MONTH = 4.33;
  const MONTHS_PER_YEAR = 12;

  const DEFAULT_THRESHOLDS = { low: 1000, high: 2000 }; // páginas/semana
  const LS_KEYS = {
    current: 'trioffice_current_v1',
    saved: 'trioffice_levantamientos_v1',
    theme: 'trioffice_theme',
    thresholds: 'trioffice_thresholds_v1'
  };

  const fmt = new Intl.NumberFormat('es-DO', { maximumFractionDigits: 0 });
  const fmt1 = new Intl.NumberFormat('es-DO', { maximumFractionDigits: 1 });

  const uid = () => 'd' + Math.random().toString(36).slice(2, 9);

  /* ---------- Acceso seguro a localStorage ----------
     En algunos navegadores/entornos (Safari con archivos abiertos como
     file://, modo privado, políticas corporativas, vistas embebidas)
     localStorage.getItem/setItem puede LANZAR una excepción en vez de
     simplemente fallar. Si eso ocurre sin protección durante el arranque,
     toda la app se detiene y ningún botón queda conectado. Por eso todo
     acceso a almacenamiento pasa por aquí. */
  const storageAvailable = (()=>{
    try{
      const k = '__trioffice_test__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    }catch(e){ return false; }
  })();

  const safeStorage = {
    get(key){
      if (!storageAvailable) return null;
      try{ return window.localStorage.getItem(key); }
      catch(e){ console.warn('No se pudo leer de localStorage:', e); return null; }
    },
    set(key, value){
      if (!storageAvailable) return false;
      try{ window.localStorage.setItem(key, value); return true; }
      catch(e){ console.warn('No se pudo guardar en localStorage:', e); return false; }
    }
  };

  /* ---------- Estado ---------- */
  let state = {
    meta: { cliente:'', tecnico:'', fecha:'', codigo:'', observaciones:'' },
    departamentos: [],
    equipos: [],
  };
  let thresholds = { ...DEFAULT_THRESHOLDS };

  /* ---------- Datos de ejemplo (para poder probar de inmediato) ---------- */
  function sampleData(){
    const nombres = ['Recepción','Contabilidad','Recursos Humanos','Ventas','Compras','Legal',
      'Sistemas / TI','Gerencia General','Mercadeo','Servicio al Cliente','Almacén','Auditoría Interna'];
    const departamentos = nombres.map((n,i)=>({
      id: uid(),
      nombre: n,
      resmas: i === 6 ? 4 : 2 // "Sistemas / TI" = departamento de mayor volumen (4 resmas/semana)
    }));
    return departamentos;
  }

  /* ================================================================
     CÁLCULOS
     ================================================================ */
  function computeDept(d){
    const resmas = Number(d.resmas) || 0;
    const semanal = resmas * PAGES_PER_RESMA;
    const mensual = semanal * WEEKS_PER_MONTH;
    const anual = mensual * MONTHS_PER_YEAR;
    return { semanal, mensual, anual, tier: tierFor(semanal) };
  }

  function tierFor(pagesWeek){
    if (pagesWeek < thresholds.low) return 'bajo';
    if (pagesWeek > thresholds.high) return 'alto';
    return 'medio';
  }

  function tierLabel(t){ return t === 'bajo' ? 'Bajo' : t === 'alto' ? 'Alto' : 'Medio'; }

  function tierIconSvg(){
    // pequeño triángulo — eco directo del logo TRI OFFICE
    return '<svg viewBox="0 0 12 12" fill="currentColor"><path d="M6 1 11 10.5H1Z"/></svg>';
  }

  function totals(){
    const rows = state.departamentos.map(computeDept);
    const totalResmas = state.departamentos.reduce((s,d)=> s + (Number(d.resmas)||0), 0);
    const semanal = rows.reduce((s,r)=> s + r.semanal, 0);
    const mensual = rows.reduce((s,r)=> s + r.mensual, 0);
    const anual = rows.reduce((s,r)=> s + r.anual, 0);
    const n = state.departamentos.length;
    const promedio = n ? semanal / n : 0;
    const counts = { bajo:0, medio:0, alto:0 };
    rows.forEach(r=> counts[r.tier]++);
    return { rows, totalResmas, semanal, mensual, anual, promedio, n, counts };
  }

  /* ================================================================
     RENDER — TABLA DE DEPARTAMENTOS (desktop) + TARJETAS (móvil)
     ================================================================ */
  function renderDepts(){
    const tbody = document.getElementById('dept-tbody');
    const cardsWrap = document.getElementById('dept-cards');

    if (!state.departamentos.length){
      tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Aún no hay departamentos. Usa "Agregar departamento" para iniciar el levantamiento.</td></tr>`;
      cardsWrap.innerHTML = `<div class="empty-row" style="padding:28px 14px;">Aún no hay departamentos registrados.</div>`;
      return;
    }

    let rowsHtml = '';
    let cardsHtml = '';
    state.departamentos.forEach(d=>{
      const c = computeDept(d);
      rowsHtml += `
        <tr data-id="${d.id}">
          <td><input type="text" class="in-nombre" value="${escapeAttr(d.nombre)}" placeholder="Nombre del departamento"></td>
          <td><input type="number" class="in-resmas" min="0" step="0.5" value="${d.resmas}"></td>
          <td class="num">${fmt.format(c.semanal)}</td>
          <td class="num">${fmt.format(c.mensual)}</td>
          <td class="num">${fmt.format(c.anual)}</td>
          <td><span class="tier ${c.tier}">${tierIconSvg()}${tierLabel(c.tier)}</span></td>
          <td><button class="row-delete" data-action="del-dept" data-id="${d.id}" aria-label="Eliminar departamento">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
          </button></td>
        </tr>`;
      cardsHtml += `
        <div class="dept-card" data-id="${d.id}">
          <div class="dept-card-top">
            <input type="text" class="in-nombre" value="${escapeAttr(d.nombre)}" placeholder="Nombre del departamento">
            <button class="row-delete" data-action="del-dept" data-id="${d.id}" aria-label="Eliminar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
            </button>
          </div>
          <div class="dept-card-row editable">
            <span class="label">Resmas / semana</span>
            <input type="number" class="in-resmas" min="0" step="0.5" value="${d.resmas}">
          </div>
          <div class="dept-card-row"><span class="label">Páginas / semana</span><span class="val">${fmt.format(c.semanal)}</span></div>
          <div class="dept-card-row"><span class="label">Páginas / mes</span><span class="val">${fmt.format(c.mensual)}</span></div>
          <div class="dept-card-row"><span class="label">Volumen anual</span><span class="val">${fmt.format(c.anual)}</span></div>
          <div class="dept-card-row"><span class="label">Nivel</span><span class="tier ${c.tier}">${tierIconSvg()}${tierLabel(c.tier)}</span></div>
        </div>`;
    });
    tbody.innerHTML = rowsHtml;
    cardsWrap.innerHTML = cardsHtml;
  }

  function escapeAttr(s){
    return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  }

  /* ================================================================
     RENDER — DASHBOARD
     ================================================================ */
  function renderDashboard(){
    const t = totals();
    const grid = document.getElementById('stats-grid');
    const cards = [
      { label:'Departamentos', value: fmt.format(t.n), sub: 'Registrados en este levantamiento' },
      { label:'Resmas / semana', value: fmt1.format(t.totalResmas), sub: 'Suma total declarada' },
      { label:'Volumen semanal', value: fmt.format(t.semanal), sub: 'Páginas estimadas / semana' },
      { label:'Volumen mensual', value: fmt.format(t.mensual), sub: 'Páginas estimadas / mes' },
      { label:'Volumen anual', value: fmt.format(t.anual), sub: 'Páginas estimadas / año' },
      { label:'Promedio / depto.', value: fmt.format(t.promedio), sub: 'Páginas semanales por depto.' },
    ];
    grid.innerHTML = cards.map(c=>`
      <div class="stat-card">
        <div class="stat-label">${c.label}</div>
        <div class="stat-value">${c.value}</div>
        <div class="stat-sub">${c.sub}</div>
      </div>`).join('');
  }

  /* ================================================================
     RENDER — ANÁLISIS + GRÁFICOS
     ================================================================ */
  let barChart = null, pieChart = null;

  function renderAnalysis(){
    const t = totals();
    const list = document.getElementById('insight-list');
    const tierSummary = document.getElementById('tier-summary');

    if (!t.n){
      list.innerHTML = `<div class="insight"><span class="k">Sin datos suficientes</span><span class="v">Agrega departamentos</span></div>`;
      tierSummary.innerHTML = '';
      destroyCharts();
      return;
    }

    let maxIdx = 0, minIdx = 0;
    t.rows.forEach((r,i)=>{
      if (r.semanal > t.rows[maxIdx].semanal) maxIdx = i;
      if (r.semanal < t.rows[minIdx].semanal) minIdx = i;
    });
    const maxDept = state.departamentos[maxIdx];
    const minDept = state.departamentos[minIdx];

    list.innerHTML = `
      <div class="insight"><span class="k">Departamento con mayor volumen</span><span class="v">${escapeHtml(maxDept.nombre || 'Sin nombre')} · ${fmt.format(t.rows[maxIdx].semanal)} pág/sem</span></div>
      <div class="insight"><span class="k">Departamento con menor volumen</span><span class="v">${escapeHtml(minDept.nombre || 'Sin nombre')} · ${fmt.format(t.rows[minIdx].semanal)} pág/sem</span></div>
      <div class="insight"><span class="k">Promedio por departamento</span><span class="v">${fmt.format(t.promedio)} pág/sem</span></div>
      <div class="insight"><span class="k">Total de departamentos</span><span class="v">${t.n}</span></div>
    `;

    tierSummary.innerHTML = `
      <div class="insight"><span class="k"><span class="tier bajo">${tierIconSvg()}Bajo</span></span><span class="v">${t.counts.bajo} depto(s)</span></div>
      <div class="insight"><span class="k"><span class="tier medio">${tierIconSvg()}Medio</span></span><span class="v">${t.counts.medio} depto(s)</span></div>
      <div class="insight"><span class="k"><span class="tier alto">${tierIconSvg()}Alto</span></span><span class="v">${t.counts.alto} depto(s)</span></div>
    `;

    renderCharts(t);
  }

  function escapeHtml(s){
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function destroyCharts(){
    if (barChart){ barChart.destroy(); barChart = null; }
    if (pieChart){ pieChart.destroy(); pieChart = null; }
  }

  function tierColor(t){
    return t === 'bajo' ? '#03A460' : t === 'alto' ? '#E72428' : '#2970B0';
  }

  function renderCharts(t){
    // Si la librería Chart.js no cargó (p. ej. sin conexión a internet o
    // bloqueada por la red), mostramos un aviso en vez de romper la app.
    if (typeof Chart === 'undefined'){
      ['chart-bar','chart-pie'].forEach(id=>{
        const canvas = document.getElementById(id);
        if (canvas && canvas.parentElement){
          canvas.parentElement.innerHTML = '<p style="font-size:12.5px; color:var(--text-faint); text-align:center; padding:30px 10px;">No se pudo cargar la librería de gráficos (revisa tu conexión a internet). El resto de la app funciona con normalidad.</p>';
        }
      });
      return;
    }
    const labels = state.departamentos.map(d=> d.nombre || 'Sin nombre');
    const dataSemanal = t.rows.map(r=> r.semanal);
    const colors = t.rows.map(r=> tierColor(r.tier));
    const totalSemanal = t.semanal || 1;
    const percentages = dataSemanal.map(v => (v/totalSemanal*100));

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
    const tickColor = isDark ? '#93A4B8' : '#5B6B7A';

    destroyCharts();

    const barCtx = document.getElementById('chart-bar').getContext('2d');
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: { labels, datasets:[{ label:'Páginas / semana', data: dataSemanal, backgroundColor: colors, borderRadius:6, maxBarThickness:34 }] },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:(ctx)=> fmt.format(ctx.parsed.y) + ' pág/sem' } } },
        scales:{
          y:{ beginAtZero:true, grid:{ color:gridColor }, ticks:{ color:tickColor, callback:(v)=>fmt.format(v) } },
          x:{ grid:{ display:false }, ticks:{ color:tickColor, autoSkip:false, maxRotation:45, minRotation: labels.length>6?45:0 } }
        }
      }
    });

    const pieCtx = document.getElementById('chart-pie').getContext('2d');
    pieChart = new Chart(pieCtx, {
      type:'doughnut',
      data:{ labels, datasets:[{ data:percentages, backgroundColor: colors, borderColor: isDark?'#121E2C':'#fff', borderWidth:2 }] },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{ position:'bottom', labels:{ color:tickColor, boxWidth:10, font:{ size:11 } } },
          tooltip:{ callbacks:{ label:(ctx)=> `${ctx.label}: ${fmt1.format(ctx.parsed)}%` } }
        }
      }
    });
  }

  /* ================================================================
     RENDER — RECOMENDACIÓN DE CAPACIDAD
     ================================================================ */
  function renderReco(){
    const t = totals();
    const monthlyLow = thresholds.low * WEEKS_PER_MONTH;
    const monthlyHigh = thresholds.high * WEEKS_PER_MONTH;

    let tier = 'bajo';
    if (t.mensual > monthlyHigh) tier = 'alto';
    else if (t.mensual >= monthlyLow) tier = 'medio';

    const labelMap = {
      bajo:{ title:'Equipo de bajo / mediano rendimiento', color:'green' },
      medio:{ title:'Equipo de rendimiento medio', color:'blue' },
      alto:{ title:'Equipo de alto rendimiento', color:'red' }
    };
    const info = labelMap[tier];

    const badge = document.getElementById('reco-badge');
    badge.style.background = `var(--brand-${info.color}-soft)`;
    badge.querySelector('.tag').style.color = `var(--brand-${info.color})`;
    badge.querySelector('.tag').textContent = 'Volumen detectado: ' + fmt.format(t.mensual) + ' páginas/mes';
    badge.querySelector('.title').style.color = `var(--brand-${info.color})`;
    badge.querySelector('.title').textContent = 'Recomendación: ' + info.title;

    // posición del marcador en el gauge (0-100%), en escala hasta 1.6x el umbral alto mensual
    const scaleMax = monthlyHigh * 1.6;
    const pos = Math.max(2, Math.min(98, (t.mensual / scaleMax) * 100));
    document.getElementById('gauge-marker').style.left = pos + '%';
  }

  /* ================================================================
     EQUIPOS (módulo opcional)
     ================================================================ */
  function renderEquipos(){
    const tbody = document.getElementById('equipo-tbody');
    const empty = document.getElementById('equipo-empty');
    const table = document.getElementById('equipo-table');
    if (!state.equipos.length){
      table.style.display = 'none';
      empty.style.display = 'block';
      return;
    }
    table.style.display = '';
    empty.style.display = 'none';
    const deptOptions = state.departamentos.map(d=>`<option value="${escapeAttr(d.nombre)}"></option>`).join('');
    tbody.innerHTML = state.equipos.map(e=>`
      <tr data-id="${e.id}">
        <td><input type="text" class="eq-field" data-field="departamento" list="dept-options" value="${escapeAttr(e.departamento)}" placeholder="Departamento"></td>
        <td><input type="text" class="eq-field" data-field="fabricante" value="${escapeAttr(e.fabricante)}" placeholder="Fabricante"></td>
        <td><input type="text" class="eq-field" data-field="modelo" value="${escapeAttr(e.modelo)}" placeholder="Modelo"></td>
        <td><input type="text" class="eq-field" data-field="serial" value="${escapeAttr(e.serial)}" placeholder="Serial"></td>
        <td>
          <select class="eq-field" data-field="tecnologia">
            <option ${e.tecnologia==='Láser'?'selected':''}>Láser</option>
            <option ${e.tecnologia==='Tinta'?'selected':''}>Tinta</option>
            <option ${e.tecnologia==='Multifuncional'?'selected':''}>Multifuncional</option>
          </select>
        </td>
        <td>
          <select class="eq-field" data-field="color">
            <option ${e.color==='Monocromático'?'selected':''}>Monocromático</option>
            <option ${e.color==='Color'?'selected':''}>Color</option>
          </select>
        </td>
        <td><input type="number" class="eq-field" data-field="contador" min="0" value="${e.contador||0}"></td>
        <td><button class="row-delete" data-action="del-equipo" data-id="${e.id}" aria-label="Eliminar equipo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
        </button></td>
      </tr>`).join('') + `<datalist id="dept-options">${deptOptions}</datalist>`;
  }

  /* ================================================================
     REPORTE DE IMPRESIÓN
     Genera el contenido de #print-report: solo lo necesario para
     presentar al jefe — datos del cliente, volumen por departamento
     y la recomendación de equipo. Se reconstruye cada vez que cambian
     los datos, pero solo es visible al imprimir (ver CSS @media print).
     ================================================================ */
  function renderPrintReport(){
    const el = document.getElementById('print-report');
    if (!el) return;
    const t = totals();

    const monthlyLow = thresholds.low * WEEKS_PER_MONTH;
    const monthlyHigh = thresholds.high * WEEKS_PER_MONTH;
    let tier = 'bajo';
    if (t.mensual > monthlyHigh) tier = 'alto';
    else if (t.mensual >= monthlyLow) tier = 'medio';
    const labelMap = {
      bajo: 'Equipo de bajo / mediano rendimiento',
      medio: 'Equipo de rendimiento medio',
      alto: 'Equipo de alto rendimiento'
    };

    const filas = state.departamentos.map(d=>{
      const c = computeDept(d);
      return `<tr>
        <td>${escapeHtml(d.nombre || 'Sin nombre')}</td>
        <td class="num">${fmt1.format(Number(d.resmas)||0)}</td>
        <td class="num">${fmt.format(c.semanal)}</td>
        <td class="num">${fmt.format(c.mensual)}</td>
        <td class="num">${fmt.format(c.anual)}</td>
        <td>${tierLabel(c.tier)}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="6">Sin departamentos registrados</td></tr>`;

    el.innerHTML = `
      <div class="pr-header">
        <img src="assets/logo.png" alt="TRI OFFICE">
        <div>
          <h1>Informe de Volumen de Impresión</h1>
          <p>Levantamiento Técnico de Equipos de Impresión</p>
        </div>
      </div>
      <table class="pr-meta">
        <tr><td style="width:50%"><strong>Cliente:</strong> ${escapeHtml(state.meta.cliente || '—')}</td><td><strong>Técnico:</strong> ${escapeHtml(state.meta.tecnico || '—')}</td></tr>
        <tr><td><strong>Fecha:</strong> ${escapeHtml(state.meta.fecha || '—')}</td><td><strong>N.° de levantamiento:</strong> ${escapeHtml(state.meta.codigo || '—')}</td></tr>
      </table>

      <h2>Volumen de impresión por departamento</h2>
      <table class="pr-table">
        <thead><tr>
          <th>Departamento</th><th class="num">Resmas/sem</th><th class="num">Páginas/sem</th>
          <th class="num">Páginas/mes</th><th class="num">Volumen anual</th><th>Nivel</th>
        </tr></thead>
        <tbody>${filas}</tbody>
        <tfoot><tr>
          <td>Total</td>
          <td class="num">${fmt1.format(t.totalResmas)}</td>
          <td class="num">${fmt.format(t.semanal)}</td>
          <td class="num">${fmt.format(t.mensual)}</td>
          <td class="num">${fmt.format(t.anual)}</td>
          <td></td>
        </tr></tfoot>
      </table>

      <h2>Recomendación de capacidad de impresora</h2>
      <p class="pr-reco"><strong>Volumen detectado:</strong> ${fmt.format(t.mensual)} páginas/mes &nbsp;→&nbsp; <strong>Recomendación:</strong> ${labelMap[tier]}</p>
      <p class="pr-note">Esta recomendación es referencial y debe validarse considerando el ciclo de trabajo, velocidad, tipo de documento, frecuencia de impresión y características del equipo.</p>

      <p class="pr-footer">Generado el ${new Date().toLocaleDateString('es-DO')} · Calculadora de Volumen de Impresión — TRI OFFICE</p>
    `;
  }

  /* ================================================================
     RENDER GENERAL
     ================================================================ */
  function renderAll(){
    // Cada sección se renderiza de forma aislada: si una falla, no arrastra a las demás.
    [renderDepts, renderDashboard, renderAnalysis, renderReco, renderEquipos, renderPrintReport].forEach(fn=>{
      try{ fn(); }
      catch(err){ console.error(`Error en ${fn.name}:`, err); }
    });
  }

  /* ================================================================
     PERSISTENCIA
     ================================================================ */
  function persistDraft(){
    safeStorage.set(LS_KEYS.current, JSON.stringify(state));
  }

  function loadDraft(){
    try{
      const raw = safeStorage.get(LS_KEYS.current);
      if (raw){ state = JSON.parse(raw); return true; }
    }catch(e){ console.warn('No se pudo leer el borrador guardado', e); }
    return false;
  }

  function genCodigo(){
    const d = new Date();
    const pad = n => String(n).padStart(2,'0');
    return `LEV-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${Math.floor(Math.random()*900+100)}`;
  }

  /* ================================================================
     API — Netlify Functions + Neon (Fase 5)
     Diseño de "un solo registro": la nube guarda ÚNICAMENTE el
     levantamiento en el que estás trabajando ahora mismo (se sobrescribe
     cada vez que guardas). Así nunca hay que limpiar la base de datos
     manualmente. Si la función no existe o falla la conexión, cada
     llamada lanza un error y quien la invoque cae de regreso a
     localStorage — la app nunca deja de funcionar, con o sin nube.
     ================================================================ */
  const API_URL = '/.netlify/functions/levantamientos';

  async function apiSave(snapshot){
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot)
    });
    if (!res.ok) throw new Error('API save falló: ' + res.status);
    return res.json();
  }

  async function apiGet(){
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('API get falló: ' + res.status);
    return res.json();
  }

  async function apiDelete(){
    const res = await fetch(API_URL, { method: 'DELETE' });
    if (!res.ok) throw new Error('API delete falló: ' + res.status);
    return res.json();
  }

  async function saveLevantamiento(){
    if (!state.meta.cliente || !state.meta.cliente.trim()){
      showToast('Ingresa el nombre del cliente antes de guardar.', true);
      document.getElementById('in-cliente').focus();
      return;
    }
    if (!state.meta.codigo) state.meta.codigo = genCodigo();
    const snapshot = JSON.parse(JSON.stringify(state));
    snapshot.thresholds = thresholds;
    snapshot.savedAt = new Date().toISOString();

    document.getElementById('in-codigo').value = state.meta.codigo;
    persistDraft(); // siempre queda al menos en este dispositivo

    try{
      await apiSave(snapshot);
      showToast('Levantamiento guardado en la nube (Neon).');
    }catch(err){
      console.warn('No se pudo guardar en la nube, se queda guardado localmente:', err);
      showToast('Guardado localmente. No se pudo conectar con la base de datos en la nube.', true);
    }
  }

  /* ================================================================
     UTILIDADES DE UI: toasts + modal de confirmación
     ================================================================ */
  function showToast(msg, isErr){
    const wrap = document.getElementById('toast-wrap');
    const el = document.createElement('div');
    el.className = 'toast' + (isErr ? ' err' : '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(()=> el.remove(), 3200);
  }

  function confirmAction(title, text, onConfirm){
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-text').textContent = text;
    modal.classList.add('open');
    const ok = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');
    function cleanup(){ modal.classList.remove('open'); ok.removeEventListener('click', onOk); cancel.removeEventListener('click', onCancel); }
    function onOk(){ cleanup(); onConfirm(); }
    function onCancel(){ cleanup(); }
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
  }

  /* ================================================================
     EVENTOS — FICHA DEL LEVANTAMIENTO
     ================================================================ */
  function bindMetaFields(){
    const map = { 'in-cliente':'cliente', 'in-tecnico':'tecnico', 'in-fecha':'fecha', 'in-obs':'observaciones' };
    Object.entries(map).forEach(([id,key])=>{
      const el = document.getElementById(id);
      el.addEventListener('input', ()=>{ state.meta[key] = el.value; persistDraft(); });
    });
  }

  function syncMetaInputs(){
    document.getElementById('in-cliente').value = state.meta.cliente || '';
    document.getElementById('in-tecnico').value = state.meta.tecnico || '';
    document.getElementById('in-fecha').value = state.meta.fecha || '';
    document.getElementById('in-obs').value = state.meta.observaciones || '';
    document.getElementById('in-codigo').value = state.meta.codigo || '';
  }

  /* ================================================================
     EVENTOS — DEPARTAMENTOS
     ================================================================ */
  function addDept(){
    state.departamentos.push({ id: uid(), nombre:'', resmas: 1 });
    persistDraft();
    renderAll();
    // enfocar el nombre del nuevo departamento
    const inputs = document.querySelectorAll('#dept-tbody .in-nombre');
    if (inputs.length) inputs[inputs.length-1].focus();
  }

  function deleteDept(id){
    const dept = state.departamentos.find(d=> d.id === id);
    confirmAction(
      'Eliminar departamento',
      `¿Eliminar "${dept?.nombre || 'este departamento'}"? Esta acción no se puede deshacer.`,
      ()=>{
        state.departamentos = state.departamentos.filter(d=> d.id !== id);
        persistDraft();
        renderAll();
        showToast('Departamento eliminado.');
      }
    );
  }

  function onDeptInput(e){
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const id = row.getAttribute('data-id');
    const dept = state.departamentos.find(d=> d.id === id);
    if (!dept) return;

    if (e.target.classList.contains('in-nombre')){
      dept.nombre = e.target.value;
    } else if (e.target.classList.contains('in-resmas')){
      let v = parseFloat(e.target.value);
      if (isNaN(v) || v < 0){ v = 0; }
      dept.resmas = v;
    }
    persistDraft();
    // Re-render solo lo que depende de los números (sin perder el foco del input de texto)
    renderDashboard();
    renderAnalysis();
    renderReco();
    updateComputedCellsForRow(id);
  }

  // Actualiza celdas calculadas de una fila sin re-renderizar todo (evita perder el foco al escribir)
  function updateComputedCellsForRow(id){
    const dept = state.departamentos.find(d=> d.id === id);
    if (!dept) return;
    const c = computeDept(dept);
    const row = document.querySelector(`#dept-tbody tr[data-id="${id}"]`);
    if (row){
      const cells = row.querySelectorAll('td.num');
      cells[0].textContent = fmt.format(c.semanal);
      cells[1].textContent = fmt.format(c.mensual);
      cells[2].textContent = fmt.format(c.anual);
      const tierEl = row.querySelector('.tier');
      tierEl.className = 'tier ' + c.tier;
      tierEl.innerHTML = tierIconSvg() + tierLabel(c.tier);
    }
    const card = document.querySelector(`#dept-cards .dept-card[data-id="${id}"]`);
    if (card){
      const vals = card.querySelectorAll('.dept-card-row .val');
      vals[0].textContent = fmt.format(c.semanal);
      vals[1].textContent = fmt.format(c.mensual);
      vals[2].textContent = fmt.format(c.anual);
      const tierEl = card.querySelector('.tier');
      tierEl.className = 'tier ' + c.tier;
      tierEl.innerHTML = tierIconSvg() + tierLabel(c.tier);
    }
  }

  /* ================================================================
     EVENTOS — EQUIPOS
     ================================================================ */
  function addEquipo(){
    state.equipos.push({
      id: uid(), departamento:'', fabricante:'', modelo:'', serial:'',
      tecnologia:'Láser', color:'Monocromático', contadorInicial:0, contador:0,
      estado:'Activo', observaciones:''
    });
    persistDraft();
    renderEquipos();
  }

  function deleteEquipo(id){
    confirmAction('Eliminar equipo', '¿Eliminar este equipo del inventario?', ()=>{
      state.equipos = state.equipos.filter(e=> e.id !== id);
      persistDraft();
      renderEquipos();
      showToast('Equipo eliminado.');
    });
  }

  function onEquipoInput(e){
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const id = row.getAttribute('data-id');
    const eq = state.equipos.find(x=> x.id === id);
    if (!eq || !e.target.dataset.field) return;
    const field = e.target.dataset.field;
    eq[field] = field === 'contador' ? Math.max(0, parseFloat(e.target.value)||0) : e.target.value;
    persistDraft();
  }

  /* ================================================================
     TEMA CLARO / OSCURO
     ================================================================ */
  function applyTheme(theme){
    document.documentElement.setAttribute('data-theme', theme);
    safeStorage.set(LS_KEYS.theme, theme);
    const icon = document.getElementById('theme-icon');
    if (theme === 'dark'){
      icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>';
    } else {
      icon.innerHTML = '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>';
    }
    if (state.departamentos.length) renderCharts(totals());
  }

  function toggleTheme(){
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'light' ? 'dark' : 'light');
  }

  /* ================================================================
     CONFIGURACIÓN DE UMBRALES
     ================================================================ */
  function openSettings(){
    document.getElementById('cfg-low').value = thresholds.low;
    document.getElementById('cfg-high').value = thresholds.high;
    document.getElementById('overlay').classList.add('open');
    document.getElementById('drawer-settings').classList.add('open');
  }
  function closeSettings(){
    document.getElementById('overlay').classList.remove('open');
    document.getElementById('drawer-settings').classList.remove('open');
  }
  function saveThresholds(){
    const low = parseFloat(document.getElementById('cfg-low').value);
    const high = parseFloat(document.getElementById('cfg-high').value);
    if (isNaN(low) || isNaN(high) || low <= 0 || high <= 0){
      showToast('Ingresa valores numéricos válidos.', true); return;
    }
    if (low >= high){
      showToast('El límite "Bajo" debe ser menor que el límite "Alto".', true); return;
    }
    thresholds = { low, high };
    safeStorage.set(LS_KEYS.thresholds, JSON.stringify(thresholds));
    closeSettings();
    renderAll();
    showToast('Umbrales actualizados.');
  }
  function resetThresholds(){
    thresholds = { ...DEFAULT_THRESHOLDS };
    document.getElementById('cfg-low').value = thresholds.low;
    document.getElementById('cfg-high').value = thresholds.high;
  }

  /* ================================================================
     ACCIONES PRINCIPALES: nuevo / cargar / eliminar todo
     ================================================================ */
  function newLevantamiento(){
    confirmAction('Nuevo levantamiento', 'Se limpiará el formulario actual. Si no lo has guardado, los cambios se perderán.', ()=>{
      state = { meta:{ cliente:'', tecnico:'', fecha:'', codigo:'', observaciones:'' }, departamentos:[], equipos:[] };
      persistDraft();
      syncMetaInputs();
      renderAll();
      showToast('Nuevo levantamiento iniciado.');
    });
  }

  async function loadLevantamiento(){
    let cloud;
    try{
      cloud = await apiGet();
    }catch(err){
      console.warn('No se pudo traer el levantamiento desde la nube:', err);
      showToast('No hay ningún levantamiento guardado en la nube todavía (o no hay conexión). Se mantiene lo que tienes en pantalla.', true);
      return;
    }

    confirmAction(
      'Cargar desde la nube',
      `Se encontró un levantamiento guardado en la nube para "${cloud.meta.cliente || 'Sin nombre'}". ¿Reemplazar lo que tienes en pantalla con esa versión?`,
      ()=>{
        state = cloud;
        if (!state.equipos) state.equipos = [];
        // Los umbrales viajan junto al levantamiento; si no vienen, se
        // mantienen los umbrales actuales de la app.
        if (state.thresholds){
          thresholds = state.thresholds;
          safeStorage.set(LS_KEYS.thresholds, JSON.stringify(thresholds));
        }
        delete state.thresholds; // no forma parte de la estructura interna de "state"
        persistDraft();
        syncMetaInputs();
        renderAll();
        showToast('Levantamiento cargado desde la nube: ' + (state.meta.cliente || ''));
      }
    );
  }

  function deleteAll(){
    confirmAction('Eliminar levantamiento', 'Esto borrará todos los departamentos, equipos y datos del formulario actual (y el registro en la nube, si existe). Esta acción no se puede deshacer.', async ()=>{
      state.departamentos = [];
      state.equipos = [];
      persistDraft();
      renderAll();
      try{
        await apiDelete();
      }catch(err){
        console.warn('No se pudo borrar el registro en la nube (puede que no existiera todavía):', err);
      }
      showToast('Datos del levantamiento eliminados.');
    });
  }

  /* ================================================================
     NAVEGACIÓN POR PESTAÑAS (scroll a sección + estado activo)
     ================================================================ */
  function bindSubnav(){
    const items = document.querySelectorAll('.subnav-item');
    items.forEach(item=>{
      item.addEventListener('click', ()=>{
        const target = document.querySelector(item.dataset.target);
        if (target) target.scrollIntoView({ behavior:'smooth', block:'start' });
      });
    });
    // El resaltado automático de la pestaña activa al hacer scroll es una
    // mejora visual, no algo crítico: si el navegador no soporta
    // IntersectionObserver, simplemente se omite sin afectar el resto de la app.
    if (typeof IntersectionObserver === 'undefined') return;
    try{
      const sections = [...document.querySelectorAll('.section')];
      const observer = new IntersectionObserver((entries)=>{
        entries.forEach(entry=>{
          if (entry.isIntersecting){
            items.forEach(i=> i.classList.remove('active'));
            const match = document.querySelector(`.subnav-item[data-target="#${entry.target.id}"]`);
            if (match) match.classList.add('active');
          }
        });
      }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });
      sections.forEach(s=> observer.observe(s));
    }catch(e){ console.warn('No se pudo activar el resaltado de navegación:', e); }
  }

  /* ================================================================
     CONEXIÓN DE BOTONES
     Aislada en su propia función y llamada PRIMERO que cualquier otra
     cosa en init(). Si algo más adelante falla (tema, datos, gráficos),
     los botones ya están conectados y la app se puede seguir usando.
     ================================================================ */
  function bindAllEvents(){
    const on = (id, evt, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(evt, handler);
      else console.warn(`No se encontró #${id} para conectar el evento "${evt}".`);
    };

    bindMetaFields();

    // Departamentos
    on('btn-add-dept', 'click', addDept);
    on('dept-tbody', 'input', onDeptInput);
    on('dept-cards', 'input', onDeptInput);
    document.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-action="del-dept"]');
      if (btn) deleteDept(btn.dataset.id);
      const btnEq = e.target.closest('[data-action="del-equipo"]');
      if (btnEq) deleteEquipo(btnEq.dataset.id);
    });

    // Equipos
    on('btn-add-equipo', 'click', addEquipo);
    on('equipo-tbody', 'input', onEquipoInput);

    // Tema y configuración
    on('btn-theme', 'click', toggleTheme);
    on('btn-settings', 'click', openSettings);
    on('btn-close-settings', 'click', closeSettings);
    on('overlay', 'click', closeSettings);
    on('btn-save-thresholds', 'click', saveThresholds);
    on('btn-reset-thresholds', 'click', resetThresholds);

    // Acciones principales
    on('btn-new', 'click', newLevantamiento);
    on('btn-save', 'click', saveLevantamiento);
    on('btn-load', 'click', loadLevantamiento);
    on('btn-delete', 'click', deleteAll);
    on('btn-print', 'click', ()=>{ renderPrintReport(); window.print(); });
    on('btn-pdf', 'click', ()=> showToast('La exportación a PDF llega en la próxima fase.'));
    on('btn-xls', 'click', ()=> showToast('La exportación a Excel llega en la próxima fase.'));

    // Navegación por pestañas (no crítico: protegido internamente)
    bindSubnav();
  }

  /* ================================================================
     INICIALIZACIÓN
     Cada etapa está aislada: si una falla, se registra en consola y
     las siguientes se ejecutan igual. Los botones se conectan primero
     y siempre, pase lo que pase con el resto.
     ================================================================ */
  function init(){
    step('Conectar botones', bindAllEvents);

    step('Aplicar tema', ()=>{
      const savedTheme = safeStorage.get(LS_KEYS.theme) ||
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      applyTheme(savedTheme);
    });

    step('Cargar umbrales', ()=>{
      const rawT = safeStorage.get(LS_KEYS.thresholds);
      if (rawT) thresholds = JSON.parse(rawT);
    });

    step('Cargar datos del levantamiento', ()=>{
      const hadDraft = loadDraft();
      if (!hadDraft || !state.departamentos || !state.departamentos.length){
        if (!hadDraft){
          state.meta.cliente = 'Empresa Ejemplo, S.R.L.';
          state.meta.tecnico = '';
          state.meta.fecha = new Date().toISOString().slice(0,10);
          state.meta.codigo = genCodigo();
          state.departamentos = sampleData();
          state.equipos = state.equipos || [];
          persistDraft();
        }
      }
      if (!state.equipos) state.equipos = [];
    });

    step('Mostrar datos en el formulario', syncMetaInputs);

    step('Renderizar la app', renderAll, ()=>{
      showToast('Hubo un problema al cargar alguna sección. Revisa la consola (F12) para más detalle.', true);
    });
  }

  // Ejecuta una etapa de arranque de forma aislada: un fallo aquí nunca
  // detiene las etapas siguientes ni deja botones sin conectar.
  function step(name, fn, onError){
    try{ fn(); }
    catch(err){
      console.error(`Error en la etapa "${name}":`, err);
      if (onError){ try{ onError(err); }catch(e2){ /* nunca dejar que el manejador de error rompa algo */ } }
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  // Si el script se carga con "defer" después de que DOMContentLoaded ya
  // disparó (poco común, pero puede pasar en recargas desde caché muy
  // rápidas), arrancamos igual en vez de quedarnos esperando el evento.
  if (document.readyState === 'interactive' || document.readyState === 'complete'){
    init();
  }
})();
