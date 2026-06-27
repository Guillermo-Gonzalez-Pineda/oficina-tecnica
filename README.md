# Oficina Técnica — Apuntes y Test

Web de estudio autocontenida para la asignatura **Oficina Técnica**: apuntes por
tema y tests tipo test con corrección inmediata, examen completo aleatorio y
progreso guardado por tema.

Todo el **contenido** (temario + banco de preguntas) vive en **JSON editable**:
para añadir preguntas no hace falta tocar el código.

---

## Estructura del proyecto

```
.
├── index.html              Esqueleto + <link> al CSS y <script> al JS
├── css/
│   └── styles.css          Todos los estilos
├── js/
│   └── app.js              Toda la lógica (apuntes, test, examen, progreso)
├── data/
│   ├── temario.json        Partes → temas (apuntes, bloques, fórmulas)
│   └── preguntas.json      BANCO DE PREGUNTAS, agrupado por id de tema
├── build.js                Script Node (sin dependencias) que genera el dist
├── dist/
│   └── oficina-tecnica.html Fichero ÚNICO autocontenido (abre con doble clic)
└── README.md
```

El temario y las preguntas están **separados**: `app.js` los carga y los combina
por el **id de tema**, de modo que basta con añadir un objeto a `preguntas.json`
para que la pregunta aparezca en el test de ese tema.

La versión **principal** es la estructura multi-fichero (`index.html` + `css/` +
`js/` + `data/`). Está pensada para publicarse en **GitHub Pages** y funciona al
100% **sin ejecutar nada** (las rutas a los datos son relativas: `./data/…`).
`build.js` y `dist/` son **opcionales** (solo para uso offline con doble clic) y
**no hacen falta** si no tienes Node instalado.

---

## Publicar en GitHub Pages (recomendado)

GitHub Pages sirve por **HTTPS**, así que el `fetch()` de los JSON funciona sin
montar nada. Pasos:

1. Crea un repositorio en GitHub (por ejemplo `oficina-tecnica`).
2. Sube **todos** los ficheros de esta carpeta a la rama `main`
   (index.html, `css/`, `js/`, `data/`, README…):

   ```bash
   git init
   git add .
   git commit -m "Web de Oficina Técnica"
   git branch -M main
   git remote add origin https://github.com/USUARIO/oficina-tecnica.git
   git push -u origin main
   ```

3. En GitHub: **Settings → Pages**. En *Build and deployment*, elige
   **Source: Deploy from a branch** y selecciona **Branch: `main`** y carpeta
   **`/ (root)`**. Guarda.
4. Espera un minuto. La web queda publicada en:

   ```
   https://USUARIO.github.io/oficina-tecnica/
   ```

> Como el sitio cuelga de un subdirectorio (`/oficina-tecnica/`), el código usa
> **rutas relativas** (`./data/…`) y **nunca** rutas con barra inicial
> (`/data/…`), que romperían en Pages.

### Añadir preguntas con la web ya publicada

1. Edita **`data/preguntas.json`** (añade el objeto al array del id de tema).
2. Guarda y súbelo:

   ```bash
   git add data/preguntas.json
   git commit -m "Nuevas preguntas"
   git push
   ```

3. En un minuto, **la web online se actualiza sola**. No hay que tocar código ni
   reconstruir nada.

---

## Cómo estudiar / desarrollar en local

Hay dos formas de usar la app sin GitHub Pages.

### A) Con servidor local (para editar el contenido)

La app carga los JSON con `fetch()`. Si abres `index.html` con **doble clic**, el
navegador lo bloquea por seguridad (protocolo `file://`). Por eso, para
desarrollar levanta un servidor local en esta carpeta:

```bash
python3 -m http.server 8000
```

y abre **http://localhost:8000**.

> Alternativa en VS Code: instala la extensión **Live Server** y pulsa
> «Go Live»; abrirá la web en `http://127.0.0.1:5500` (o similar).

Con servidor, cualquier cambio en `data/temario.json` o `data/preguntas.json` se
ve recargando la página (no hace falta volver a construir nada).

### B) Sin servidor y sin Node (fichero único, OPCIONAL)

Si quieres estudiar con **doble clic** y sin conexión, existe el fichero único
`dist/oficina-tecnica.html`, que lleva el CSS, el JS y los datos **embebidos**
(sin `fetch`, sin CORS).

Ese fichero ya viene generado en `dist/`. Si **tienes Node** y has cambiado los
JSON, puedes regenerarlo:

```bash
node build.js
```

> `build.js` es **opcional**: la web principal (GitHub Pages o servidor local) no
> lo necesita. Si no tienes Node, simplemente **ignora `dist/`** y usa la versión
> multi-fichero. La app detecta sola de dónde vienen los datos: si están
> embebidos (dist) los usa; si no, los pide por `fetch`.

---

## Cómo añadir una pregunta nueva

1. Abre **`data/preguntas.json`**.
2. Busca la clave del tema (su `id`). Los ids siguen el patrón
   `p<parte>t<tema>` — por ejemplo `"p1t1"` es Parte I · Tema 1. Puedes
   consultar los ids en `data/temario.json`.
3. Añade un objeto al array de ese tema con estos campos:

   ```json
   {
     "id": "p1t1-q6",
     "enunciado": "¿Cuál de estas fases es la primera de un proyecto?",
     "opciones": ["Ejecución", "Inicio (viabilidad)", "Cierre", "Control"],
     "correcta": 1,
     "explicacion": "El ciclo es Inicio → Planificación → Ejecución → Control → Cierre."
   }
   ```

   - `enunciado`: el texto de la pregunta.
   - `opciones`: lista de respuestas (de 2 a 5).
   - `correcta`: **índice** de la opción correcta empezando en **0**
     (en el ejemplo, `1` = la segunda opción, *«Inicio (viabilidad)»*).
   - `explicacion`: lo que se muestra al corregir.
   - `id`: identificador libre, único; útil para localizarla. Conviene seguir el
     patrón `"<idTema>-q<n>"`.
   - `fuente` *(opcional)*: de dónde sale la pregunta (p. ej.
     `"Julio_2024 Ej2"`). No se muestra al usuario; solo sirve para revisarla.

   Ejemplo del array completo de un tema (se añade la nueva al final):

   ```json
   "p1t1": [
     { "id": "p1t1-q1", "enunciado": "…", "opciones": ["…","…","…","…"], "correcta": 1, "explicacion": "…" },
     { "id": "p1t1-q6", "enunciado": "¿Cuál de estas fases…?", "opciones": ["Ejecución","Inicio (viabilidad)","Cierre","Control"], "correcta": 1, "explicacion": "…" }
   ]
   ```

4. Guarda. Recarga la web (servidor) o ejecuta `node build.js` (dist).

**Crear un tema nuevo:** añade su clave en `preguntas.json` (p. ej. `"p1t5": [ … ]`)
y el tema correspondiente en `temario.json`, usando el **mismo id**.

> **Validación automática:** al cargar, la app revisa cada pregunta. Si a una le
> falta `correcta` válida (un entero dentro del rango de `opciones`) o le faltan
> opciones, la **omite** y avisa por la **consola del navegador** (F12), en lugar
> de romper la app. Si una pregunta tuya no aparece, mira ahí.

---

## Esquema de los datos

### `data/temario.json`

```json
{
  "partes": [
    {
      "id": "p1",
      "tag": "P-I",
      "titulo": "Gestión y desarrollo de proyectos industriales",
      "temas": [
        {
          "id": "p1t1",
          "num": "1",
          "titulo": "Metodología de proyectos",
          "resumen": "…",
          "bloques": [
            {
              "t": "1.1 · ¿Qué es un proyecto?",
              "puntos": [
                "Un punto de texto normal",
                { "termino": "Definición clásica", "definicion": "conjunto de escritos…" }
              ]
            }
          ],
          "formulas": ["PEM = ΣCD + ΣCI"]
        }
      ]
    }
  ]
}
```

- Un elemento de `puntos` puede ser **texto** (string) o un par
  `{ "termino": …, "definicion": … }` (se muestra resaltado).
- `formulas` es **opcional**; si está, se muestra el recuadro «Fórmulas clave».

### `data/preguntas.json`

Objeto cuyas claves son los **ids de tema** y cuyos valores son arrays de
preguntas (ver «Cómo añadir una pregunta nueva»).

---

## Notas

- El progreso (mejor porcentaje por tema) se guarda en `localStorage` del
  navegador, con un *shim* protegido en `try/catch` para que no falle en
  entornos restringidos; en ese caso se mantiene solo durante la sesión.
- Las fuentes se cargan desde Google Fonts; sin conexión, la web usa fuentes del
  sistema como respaldo (funciona igual).
- `oficina-tecnica.html` (en la raíz) es el **monolito original** previo al
  refactor; ya no se usa y puedes borrarlo cuando quieras.
