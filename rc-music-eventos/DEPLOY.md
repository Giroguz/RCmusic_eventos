# Despliegue de RC music_eventos

## 1. Frontend en Cloudflare Pages

1. Conecta el repositorio de GitHub.
2. Selecciona `rc-music-eventos` como **Root directory**.
3. Usa estos valores:

- Framework preset: `Vite`
- Install command: `npm install`
- Build command: `npm run build`
- Build output directory: `dist`

4. Configura las variables del frontend:

- `VITE_MUSIC_API_BASE_URL`
- `VITE_SPOTIFY_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

No agregues `VITE_YOUTUBE_API_KEY`: la clave debe permanecer únicamente en el backend.

## 2. Backend en Render

1. Crea o actualiza un Web Service usando la carpeta `rc-download-server`.
2. Usa:

- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/health`

3. Configura estas variables en el panel del servicio:

- `YOUTUBE_API_KEY`
- `YOUTUBE_DAILY_CALL_LIMIT=100`
- `YOUTUBE_CACHE_TTL_MS=21600000`
- `YOUTUBE_CACHE_MAX_ENTRIES=500`
- `SPOTIFY_CLIENT_ID` (opcional)
- `SPOTIFY_CLIENT_SECRET` (opcional)
- `CORS_ORIGIN` con el origen exacto del frontend publicado

Endpoints de búsqueda:

- `/api/spotify-search?q=...`
- `/api/deezer-search?q=...`
- `/api/youtube-search?q=...`

El frontend consulta Spotify → Deezer → YouTube y se detiene en la primera fuente con resultados. Las búsquedas repetidas se sirven desde caché y las solicitudes iguales simultáneas se agrupan.

## 3. Orden recomendado

1. Mantener el backup o branch anterior disponible.
2. Desplegar primero el backend con `YOUTUBE_API_KEY` configurada.
3. Comprobar `/health` y los tres endpoints de búsqueda.
4. Configurar `VITE_MUSIC_API_BASE_URL` y `VITE_SPOTIFY_API_BASE_URL` en Cloudflare Pages.
5. Desplegar el frontend.
6. Probar la búsqueda y el envío de pedidos antes de promover a producción.

## 4. Verificación

Comprobar estos casos:

- Spotify devuelve resultados y evita consultar Deezer/YouTube.
- Deezer se consulta cuando Spotify no devuelve resultados.
- YouTube solo se consulta cuando Spotify y Deezer no devuelven resultados.
- Se muestra la fuente de cada resultado.
- Las canciones de Deezer reproducen su previa cuando existe o muestran el enlace externo.
- El pedido conserva el proveedor y su identificador.
- La API key de YouTube no aparece en el bundle de `dist`.
