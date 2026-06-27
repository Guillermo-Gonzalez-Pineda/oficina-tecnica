/* ===================================================================
   Oficina Técnica — Apuntes y Test
   --------------------------------------------------------------------
   Toda la lógica de la app:
     · carga de datos (datos embebidos del build o vía fetch en servidor)
     · validación y combinación temario + banco de preguntas (por id de tema)
     · índice lateral, render de apuntes, motor del test, examen completo
     · barra de progreso y guardado del porcentaje por tema
   Los contenidos viven en data/temario.json y data/preguntas.json.
   =================================================================== */

/* ============ almacenamiento protegido (no rompe en sandbox/file://) ============ */
const store = (() => {
  let mem = {}, ok = false;
  try { const k = "__ot_test__"; localStorage.setItem(k, "1"); localStorage.removeItem(k); ok = true; }
  catch (e) { ok = false; }
  return {
    get(k){ try { return ok ? localStorage.getItem(k) : (k in mem ? mem[k] : null); } catch (e) { return k in mem ? mem[k] : null; } },
    set(k, v){ try { ok ? localStorage.setItem(k, v) : (mem[k] = v); } catch (e) { mem[k] = v; } }
  };
})();
const loadProgress = () => { try { return JSON.parse(store.get("ot_progress") || "{}"); } catch (e) { return {}; } };
const saveProgress = p => store.set("ot_progress", JSON.stringify(p));

/* ============ estado y referencias ============ */
let PARTES = [];        // modelo en memoria (temario con preguntas combinadas)
let ALLQ = [];          // todas las preguntas válidas (para el examen completo)
let TOTAL_TEMAS = 0;
let progress = loadProgress();   // { temaId: mejorPct }
let current = null;     // tema actual
let quiz = null;        // estado del test en curso

const panel = document.getElementById("panel");
const indexList = document.getElementById("indexList");
const indexPanel = document.getElementById("indexPanel");

/* ============ carga de datos: embebidos (dist) o vía fetch (servidor) ============ */
async function loadData(){
  // build.js inyecta window.__OT_DATA__ en el fichero único de dist/
  if (window.__OT_DATA__) return window.__OT_DATA__;
  // si no, los pedimos por fetch (requiere servidor local; ver README)
  const grab = async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + " → HTTP " + r.status);
    return r.json();
  };
  const [temario, preguntas] = await Promise.all([
    grab("./data/temario.json"),
    grab("./data/preguntas.json")
  ]);
  return { temario, preguntas };
}

/* ============ validación de una pregunta ============ */
function isValidQuestion(q){
  if (!q || typeof q !== "object") return false;
  if (typeof q.enunciado !== "string" || !q.enunciado.trim()) return false;
  if (!Array.isArray(q.opciones) || q.opciones.length < 2) return false;
  if (!Number.isInteger(q.correcta) || q.correcta < 0 || q.correcta >= q.opciones.length) return false;
  return true;
}

/* ============ modelo: combina temario + preguntas por id de tema ============ */
function buildModel(temario, preguntas){
  PARTES = (temario && Array.isArray(temario.partes)) ? temario.partes : [];
  preguntas = preguntas || {};
  ALLQ = [];
  TOTAL_TEMAS = 0;
  let gid = 0;
  PARTES.forEach((P, pi) => {
    (P.temas || []).forEach((t, ti) => {
      TOTAL_TEMAS++;
      t._pi = pi; t._ti = ti;
      const banco = Array.isArray(preguntas[t.id]) ? preguntas[t.id] : [];
      t.test = [];
      banco.forEach(q => {
        if (!isValidQuestion(q)){
          console.warn(`[OT] Pregunta omitida en tema "${t.id}" (falta 'correcta' válida u opciones):`, q);
          return;
        }
        q._tema = t.titulo;
        q._gid = gid++;
        t.test.push(q);
        ALLQ.push(q);
      });
    });
  });
}

/* ============ sidebar / índice ============ */
function buildIndex(){
  indexList.innerHTML = "";
  PARTES.forEach((P, pi) => {
    const wrap = document.createElement("div"); wrap.className = "parte" + (pi === 0 ? " open" : "");
    const head = document.createElement("button"); head.className = "parte-h";
    head.innerHTML = `<span class="parte-tag">${P.tag}</span><span class="pt">${P.titulo}</span><span class="chev">▸</span>`;
    head.onclick = () => wrap.classList.toggle("open");
    const temas = document.createElement("div"); temas.className = "temas";
    P.temas.forEach((t, ti) => {
      const b = document.createElement("button"); b.className = "tema-link"; b.dataset.id = t.id;
      const done = progress[t.id] != null;
      b.innerHTML = `<span class="tnum">${pi + 1}.${t.num}</span><span>${t.titulo}</span>${done ? `<span class="done">${progress[t.id]}%</span>` : ""}`;
      b.onclick = () => { openTema(t); if (window.innerWidth <= 880) indexPanel.classList.remove("open"); };
      temas.appendChild(b);
    });
    wrap.appendChild(head); wrap.appendChild(temas); indexList.appendChild(wrap);
  });
  refreshActive(); updateGlobal();
}
function refreshActive(){
  document.querySelectorAll(".tema-link").forEach(el => {
    el.classList.toggle("active", current && el.dataset.id === current.id);
    const t = findTema(el.dataset.id);
    const done = t && progress[t.id] != null;
    let d = el.querySelector(".done");
    if (done){ if (!d){ d = document.createElement("span"); d.className = "done"; el.appendChild(d); } d.textContent = progress[t.id] + "%"; }
    else if (d) d.remove();
  });
}
function findTema(id){ for (const P of PARTES) for (const t of P.temas) if (t.id === id) return t; }
function updateGlobal(){
  document.getElementById("globalTotal").textContent = TOTAL_TEMAS;
  document.getElementById("globalDone").textContent = Object.keys(progress).length;
}

/* ============ render: bienvenida ============ */
function renderHero(){
  current = null; quiz = null; refreshActive();
  panel.innerHTML = `
  <div class="hero">
    <div class="hero-top">
      <div class="hero-grid"></div>
      <div class="eyebrow">PROYECTOS · DISEÑO · FABRICACIÓN · COSTES</div>
      <h2>Estudia Oficina Técnica sin perder tiempo</h2>
      <p>Las 4 partes del temario divididas en 13 temas, con apuntes condensados y un test por tema que se corrige al instante. Empieza por el índice de la izquierda o lánzate a un examen completo.</p>
    </div>
    <div class="hero-body">
      <div class="steps">
        <div class="step"><div class="n">01 · LEE</div><h4>Apuntes por tema</h4><p>Definiciones, clasificaciones y fórmulas reescritas para que entren rápido.</p></div>
        <div class="step"><div class="n">02 · PRUÉBATE</div><h4>Test inmediato</h4><p>Preguntas tipo test con corrección y explicación al momento.</p></div>
        <div class="step"><div class="n">03 · REPITE</div><h4>Solo lo que fallas</h4><p>Tu porcentaje queda guardado por tema para volver a lo flojo.</p></div>
      </div>
      <div class="method">
        <h4>El método que de verdad cunde con poco tiempo</h4>
        <p>No releas: hazte el test, falla, lee por qué, y vuelve a los temas con menor porcentaje. El recuerdo activo fija las definiciones y leyes mucho más rápido que subrayar.</p>
      </div>
      <div class="stat-row">
        <div class="stat"><div class="v">${PARTES.length}</div><div class="l">PARTES</div></div>
        <div class="stat"><div class="v">${TOTAL_TEMAS}</div><div class="l">TEMAS</div></div>
        <div class="stat"><div class="v">${ALLQ.length}</div><div class="l">PREGUNTAS</div></div>
        <div class="stat"><div class="v" id="heroDone">0</div><div class="l">TEMAS HECHOS</div></div>
      </div>
      <div class="note-cta">
        <button class="btn btn-blue" id="startBtn">Empezar por el Tema 1</button>
        <button class="btn btn-line" id="heroExam">Examen completo (20 preguntas)</button>
      </div>
    </div>
  </div>`;
  document.getElementById("heroDone").textContent = Object.keys(progress).length;
  const firstTema = PARTES[0] && PARTES[0].temas[0];
  document.getElementById("startBtn").onclick = () => { if (firstTema) openTema(firstTema); };
  document.getElementById("heroExam").onclick = startExam;
}

/* ============ render: tema ============ */
function openTema(t, tab = "apuntes"){
  current = t; quiz = null;
  panel.innerHTML = `
    <div class="tema-head">
      <div class="tema-eyebrow">
        <span class="ref">${PARTES[t._pi].tag} · T${t.num}</span>
        <span class="pname">${PARTES[t._pi].titulo}</span>
      </div>
      <h2>${t.titulo}</h2>
      <p class="resumen">${t.resumen}</p>
    </div>
    <div class="tabs">
      <button class="tab" data-tab="apuntes">Apuntes</button>
      <button class="tab" data-tab="test">Test<span class="cnt">${t.test.length}</span></button>
    </div>
    <div class="tab-body" id="tabBody"></div>`;
  panel.querySelectorAll(".tab").forEach(b => b.onclick = () => setTab(b.dataset.tab));
  setTab(tab); refreshActive();
  panel.scrollIntoView({ block: "start" });
}
function setTab(tab){
  panel.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  const body = document.getElementById("tabBody");
  if (tab === "apuntes") renderNotes(body); else renderQuizIntro(body);
}
function renderNotes(body){
  const t = current; let h = "";
  t.bloques.forEach(b => {
    h += `<div class="bloque"><h4 class="bloque-t">${b.t}</h4><ul>`;
    b.puntos.forEach(p => {
      if (typeof p === "string") h += `<li>${p}</li>`;
      else h += `<li class="kv"><span class="term">${p.termino}</span> — ${p.definicion}</li>`;
    });
    h += `</ul></div>`;
  });
  if (t.formulas && t.formulas.length){
    h += `<div class="formulas"><div class="ft">Fórmulas clave</div>`;
    t.formulas.forEach(f => h += `<div class="f">${f}</div>`); h += `</div>`;
  }
  h += `<div class="note-cta"><span>¿Te lo sabes? Compruébalo.</span><button class="btn btn-accent" id="toTest">Hacer el test de este tema →</button></div>`;
  body.innerHTML = h;
  document.getElementById("toTest").onclick = () => setTab("test");
}

/* ============ quiz ============ */
function renderQuizIntro(body){
  const t = current; const best = progress[t.id];
  if (!t.test.length){
    body.innerHTML = `<div class="empty">Este tema todavía no tiene preguntas.<br>Añádelas en <b>data/preguntas.json</b> bajo la clave <b>"${t.id}"</b>.</div>`;
    return;
  }
  body.innerHTML = `
   <div class="results" style="padding-top:8px">
     <h3>Test · ${t.titulo}</h3>
     <p class="msg">${t.test.length} preguntas tipo test con corrección y explicación inmediata.${best != null ? ` Tu mejor resultado: <b style="color:var(--blue)">${best}%</b>.` : ""}</p>
     <div class="actions"><button class="btn btn-blue" id="go">Empezar test</button>
     <button class="btn btn-line" id="back">Ver apuntes</button></div>
   </div>`;
  document.getElementById("go").onclick = () => startQuiz(t.test, t.id, t.titulo);
  document.getElementById("back").onclick = () => setTab("apuntes");
}
function shuffle(a){ a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function startExam(){
  if (!ALLQ.length) return;
  const qs = shuffle(ALLQ).slice(0, Math.min(20, ALLQ.length));
  current = null; refreshActive();
  startQuiz(qs, "__exam__", "Examen completo");
}
function startQuiz(questions, saveId, title){
  quiz = { qs: questions, i: 0, correct: 0, answered: false, saveId, title };
  // si venimos del examen, montamos el panel limpio
  if (saveId === "__exam__"){
    panel.innerHTML = `<div class="tema-head"><div class="tema-eyebrow"><span class="ref">EXAMEN</span><span class="pname">Preguntas aleatorias de todo el temario</span></div><h2>${title}</h2></div><div class="tab-body" id="tabBody"></div>`;
  }
  renderQuestion();
  panel.scrollIntoView({ block: "start" });
}
function renderQuestion(){
  const body = document.getElementById("tabBody");
  const { qs, i } = quiz; const q = qs[i]; quiz.answered = false;
  const keys = ["A", "B", "C", "D", "E"];
  let opts = "";
  q.opciones.forEach((o, k) => { opts += `<button class="opt" data-k="${k}"><span class="key">${keys[k]}</span><span>${o}</span></button>`; });
  body.innerHTML = `
    <div class="quiz-top">
      <div class="qcount">PREGUNTA <b>${i + 1}</b> / ${qs.length}</div>
      <div class="qcount">ACIERTOS <b>${quiz.correct}</b></div>
    </div>
    <div class="progress"><i style="width:${(i / qs.length) * 100}%"></i></div>
    ${quiz.saveId === "__exam__" ? `<div class="qcount" style="margin-bottom:6px;color:var(--accent)">▸ ${q._tema}</div>` : ""}
    <div class="qtext">${q.enunciado}</div>
    <div class="opts">${opts}</div>
    <div class="explain" id="exp"><span class="lbl"></span><span id="expTxt"></span></div>
    <div class="quiz-foot" id="foot"></div>`;
  body.querySelectorAll(".opt").forEach(b => b.onclick = () => answer(parseInt(b.dataset.k), q));
}
function answer(k, q){
  if (quiz.answered) return; quiz.answered = true;
  const body = document.getElementById("tabBody");
  const opts = body.querySelectorAll(".opt");
  const ok = k === q.correcta; if (ok) quiz.correct++;
  opts.forEach((b, idx) => {
    b.disabled = true;
    if (idx === q.correcta) b.classList.add("correct");
    else if (idx === k) b.classList.add("wrong");
    else b.classList.add("dim");
  });
  const exp = document.getElementById("exp");
  exp.className = "explain show " + (ok ? "good" : "bad");
  exp.querySelector(".lbl").textContent = ok ? "¡Correcto!" : "No exactamente";
  document.getElementById("expTxt").textContent = q.explicacion;
  const last = quiz.i === quiz.qs.length - 1;
  const foot = document.getElementById("foot");
  foot.innerHTML = `<button class="btn btn-blue" id="next">${last ? "Ver resultado" : "Siguiente pregunta →"}</button>`;
  document.getElementById("next").onclick = () => { if (last) finishQuiz(); else { quiz.i++; renderQuestion(); } };
}
function finishQuiz(){
  const { correct, qs, saveId, title } = quiz;
  const pct = Math.round((correct / qs.length) * 100);
  if (saveId && saveId !== "__exam__"){
    if (progress[saveId] == null || pct > progress[saveId]){ progress[saveId] = pct; saveProgress(progress); }
    refreshActive(); updateGlobal();
  }
  const body = document.getElementById("tabBody") || panel;
  const C = 2 * Math.PI * 54; const off = C * (1 - pct / 100);
  const col = pct >= 80 ? "var(--ok)" : pct >= 50 ? "var(--accent)" : "var(--bad)";
  let msg;
  if (pct >= 80) msg = "Dominas este tema. Repásalo solo de pasada antes del examen.";
  else if (pct >= 50) msg = "Vas bien, pero relee los apuntes y vuelve a intentarlo: lo subes seguro.";
  else msg = "Toca repasar este tema con calma. Lee los apuntes y repite el test.";
  const html = `
   <div class="results">
     <div class="result-ring">
       <svg width="128" height="128"><circle cx="64" cy="64" r="54" fill="none" stroke="var(--line-soft)" stroke-width="11"/>
       <circle cx="64" cy="64" r="54" fill="none" stroke="${col}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}"/></svg>
       <div class="pct"><b>${pct}%</b><small>${correct}/${qs.length}</small></div>
     </div>
     <h3>${title}</h3>
     <p class="msg">${msg}</p>
     <div class="actions">
       <button class="btn btn-blue" id="retry">Repetir test</button>
       ${saveId !== "__exam__" ? `<button class="btn btn-line" id="notes">Volver a los apuntes</button>` : `<button class="btn btn-line" id="newexam">Nuevo examen</button>`}
       <button class="btn btn-line" id="home">Índice</button>
     </div>
   </div>`;
  if (body === panel) panel.innerHTML = `<div class="tab-body">${html}</div>`; else body.innerHTML = html;
  const r = document.getElementById("retry");
  r.onclick = () => { if (saveId === "__exam__") startExam(); else startQuiz(current.test, current.id, current.titulo || title); };
  const n = document.getElementById("notes"); if (n) n.onclick = () => openTema(current, "apuntes");
  const ne = document.getElementById("newexam"); if (ne) ne.onclick = startExam;
  document.getElementById("home").onclick = renderHero;
}

/* ============ init ============ */
async function init(){
  // botones del topbar (no dependen de los datos)
  document.getElementById("examBtn").onclick = startExam;
  document.getElementById("menuBtn").onclick = () => indexPanel.classList.toggle("open");

  let data;
  try {
    data = await loadData();
  } catch (e) {
    console.error("[OT] No se pudieron cargar los datos:", e);
    panel.innerHTML = `<div class="empty" style="padding:48px 24px;text-align:center">
      <h3 style="margin-bottom:10px">No se han podido cargar los datos</h3>
      <p>Has abierto <b>index.html</b> directamente y el navegador bloquea <code>fetch()</code> por seguridad (protocolo <b>file://</b>).</p>
      <p style="margin-top:10px">Tienes dos opciones:</p>
      <p style="margin-top:6px">• Arranca un servidor local —<b>python3 -m http.server</b>— y abre <b>http://localhost:8000</b></p>
      <p>• O usa el fichero único <b>dist/oficina-tecnica.html</b> (genéralo con <b>node build.js</b>), que abre con doble clic.</p>
    </div>`;
    return;
  }
  buildModel(data.temario, data.preguntas);
  buildIndex();
  renderHero();
}
init();
