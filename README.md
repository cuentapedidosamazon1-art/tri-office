# Calculadora de Volumen de Impresión — TRI OFFICE

Herramienta para levantamientos técnicos de equipos de impresión. Corre 100% en el navegador (sin backend todavía) y guarda los datos en `localStorage`.

## Estructura del proyecto

```
tri-office-calculadora/
├── index.html          → estructura de la página (HTML)
├── css/
│   └── styles.css      → todos los estilos (paleta, layout, responsive)
├── js/
│   └── app.js          → toda la lógica: cálculos, render, eventos, localStorage
├── assets/
│   ├── logo.png         → logo con fondo transparente (encabezado)
│   ├── logo-icon.png     → solo el triángulo (uso futuro)
│   └── favicon.png       → ícono de la pestaña del navegador
└── README.md
```

## Cómo abrirlo y editarlo en Visual Studio Code

1. Abre la carpeta `tri-office-calculadora/` completa con **Archivo → Abrir carpeta...** en VS Code (no abras solo el `index.html` suelto, o los enlaces relativos a `css/` y `js/` no se resuelven bien al editar).
2. Instala la extensión **Live Server** (de Ritwick Dey) si no la tienes.
3. Clic derecho sobre `index.html` → **Open with Live Server**. Esto abre la app en el navegador y se recarga sola cada vez que guardas un cambio.
4. Si prefieres no usar Live Server, también puedes abrir `index.html` directamente con doble clic desde el explorador de archivos — la app funciona igual, solo que sin autorecarga.

## Dónde está cada cosa (para no perderte)

- **Cambiar colores / tipografía / espaciados** → `css/styles.css`, sección `:root { ... }` al inicio (tokens de diseño).
- **Cambiar fórmulas de cálculo** (resmas → páginas, umbrales de nivel, etc.) → `js/app.js`, sección `CÁLCULOS` (primeras funciones: `computeDept`, `tierFor`, `totals`).
- **Cambiar textos / estructura de secciones** → `index.html`.
- **Datos de ejemplo precargados** → `js/app.js`, función `sampleData()`.
- **Guardado/carga de levantamientos** → `js/app.js`, sección `PERSISTENCIA`.

## Estado del proyecto

- ✅ Fase 1: app funcional completa (departamentos, dashboard, análisis, gráficos, recomendación, módulo de equipos, modo claro/oscuro, guardar/cargar, impresión).
- ✅ Fase 2: logo integrado + estructura separada para trabajar en VS Code.
- ⏳ Fase 3: exportación a PDF y Excel.
- ✅ Fase 4: despliegue en Netlify.
- ✅ Fase 5: backend con Netlify Functions + base de datos Neon (Postgres). Ver más abajo.

## Fase 5 — Configurar Neon (base de datos en la nube)

Con esto, "Guardar" y "Cargar" ya no dependen solo del navegador: los levantamientos quedan en una base de datos real que puedes ver desde cualquier dispositivo. Si algo falla (sin internet, Neon no configurado todavía), la app **sigue funcionando** guardando localmente — nunca se rompe por esto.

### 1. Crear el proyecto en Neon

1. Entra a [neon.tech](https://neon.tech) y crea una cuenta gratuita (puedes usar tu cuenta de GitHub).
2. Crea un proyecto nuevo. Neon te da automáticamente una base de datos llamada `neondb`.
3. Ve a **Dashboard → Connection string** y copia la cadena completa (empieza con `postgresql://...`).

### 2. Crear la tabla

1. En el panel de Neon, abre el **SQL Editor**.
2. Copia y pega todo el contenido de [`db/schema.sql`](./db/schema.sql) de este proyecto.
3. Dale a **Run**. Esto crea la tabla `levantamientos` una sola vez.

### 3. Conectar Neon con Netlify

**Opción A — Integración oficial (más simple):** en el panel de Netlify de tu sitio, ve a **Extensions → busca "Neon" → Install**, y sigue el asistente para vincular tu cuenta/proyecto de Neon. Esto configura automáticamente la variable `NETLIFY_DATABASE_URL`.

**Opción B — Manual:** en tu sitio de Netlify, ve a **Site configuration → Environment variables → Add a variable**, y crea:
- Key: `DATABASE_URL`
- Value: la cadena de conexión que copiaste de Neon

### 4. Volver a desplegar

Después de configurar la variable de entorno, ve a **Deploys → Trigger deploy → Deploy site** en Netlify para que la función serverless la tome en cuenta.

### 5. Probar

Abre tu sitio publicado, llena un levantamiento y dale a **Guardar**. Si todo quedó bien conectado, verás el mensaje "Levantamiento guardado en la nube (Neon)". Puedes confirmarlo entrando al **SQL Editor** de Neon y corriendo: `SELECT * FROM levantamientos;`

### Probar localmente antes de desplegar (opcional)

Si quieres probar la conexión a Neon desde tu computadora antes de subir cambios:

```bash
npm install -g netlify-cli
cp .env.example .env       # y pega tu DATABASE_URL real dentro
netlify dev                 # levanta la app + las funciones localmente
```

### Dónde está cada cosa de esta fase

- `db/schema.sql` → estructura de la tabla en Neon.
- `netlify/functions/levantamientos.js` → la función serverless (crear/leer/listar/borrar).
- `package.json` (raíz) → dependencia `@neondatabase/serverless` que usa la función.
- `js/app.js`, sección **API — Netlify Functions + Neon** → las llamadas `fetch` desde el frontend, con `localStorage` como respaldo si la nube no responde.
