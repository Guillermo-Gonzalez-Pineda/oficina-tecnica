#!/usr/bin/env node
/* ===================================================================
   build.js — genera dist/oficina-tecnica.html
   --------------------------------------------------------------------
   Crea un ÚNICO fichero autocontenido con el CSS, el JS y los datos
   (temario + preguntas) embebidos, para abrir con doble clic SIN
   servidor y SIN fetch (evita el bloqueo CORS de file://).

   Uso:   node build.js
   Sin dependencias externas: solo Node.
   =================================================================== */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const read = p => fs.readFileSync(path.join(ROOT, p), "utf8");

// 1) Leer las piezas
const html = read("index.html");
const css = read("css/styles.css");
const js = read("js/app.js");
const temario = JSON.parse(read("data/temario.json"));
const preguntas = JSON.parse(read("data/preguntas.json"));

// 2) Datos embebidos. Escapamos "<" para que ninguna cadena de los datos
//    pueda cerrar accidentalmente la etiqueta </script>.
const dataJson = JSON.stringify({ temario, preguntas }).replace(/</g, "\\u003c");
const dataScript = `<script>window.__OT_DATA__=${dataJson};</script>`;

// 3) Inlinar: sustituir el <link> del CSS y el <script src> del JS.
//    Antes del JS de la app inyectamos los datos para que window.__OT_DATA__
//    exista cuando app.js arranque (entonces no hace fetch).
const LINK = '<link rel="stylesheet" href="css/styles.css">';
const SCRIPT = '<script src="js/app.js"></script>';

if (!html.includes(LINK)) throw new Error("No se encontró el <link> del CSS en index.html");
if (!html.includes(SCRIPT)) throw new Error("No se encontró el <script> de app.js en index.html");

let out = html
  .replace(LINK, `<style>\n${css}\n</style>`)
  .replace(SCRIPT, `${dataScript}\n<script>\n${js}\n</script>`);

// 4) Comprobaciones de seguridad: el resultado debe ser autocontenido.
if (!out.includes("window.__OT_DATA__")) throw new Error("Los datos no se inyectaron");
if (out.includes('href="css/styles.css"')) throw new Error("El CSS no se inlineó");
if (out.includes('src="js/app.js"')) throw new Error("El JS no se inlineó");

// 5) Escribir dist/
const distDir = path.join(ROOT, "dist");
fs.mkdirSync(distDir, { recursive: true });
const outPath = path.join(distDir, "oficina-tecnica.html");
fs.writeFileSync(outPath, out, "utf8");

// 6) Resumen
const nTemas = temario.partes.reduce((a, P) => a + P.temas.length, 0);
const nPreg = Object.values(preguntas).reduce((a, arr) => a + arr.length, 0);
const kb = (Buffer.byteLength(out, "utf8") / 1024).toFixed(0);
console.log(`✓ dist/oficina-tecnica.html (${kb} KB) — ${temario.partes.length} partes, ${nTemas} temas, ${nPreg} preguntas.`);
console.log("  Ábrelo con doble clic: funciona sin servidor.");
