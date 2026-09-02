# Despliegue de RC music_eventos

## 1. Frontend en Vercel

1. Sube el repositorio a GitHub.
2. En Vercel importa el repositorio y selecciona la carpeta `rc-music-eventos` como raíz del proyecto.
3. Usa estos valores:

- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

4. Agrega las variables de entorno del archivo `.env.example`:

- `VITE_YOUTUBE_API_KEY`
- `VITE_SPOTIFY_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_DJ_EMAIL`
- `VITE_DJ_ACCESS_KEY`

`VITE_SPOTIFY_API_BASE_URL` debe apuntar al backend desplegado, no al valor local.

## 2. Backend en Render

1. Crea un Web Service usando la carpeta `rc-download-server`.
2. Usa:

- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/health`

3. Configura en el panel del servicio:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `CORS_ORIGIN` con el origen del frontend publicado

El archivo `render.yaml` ya contiene esta configuración como Blueprint.

## 3. Backend en Railway

Usa `rc-download-server` como raíz del servicio. Railway detectará `package.json` y ejecutará `npm start`. El archivo `railway.json` configura el health check en `/health`.

Añade las mismas tres variables del backend: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` y `CORS_ORIGIN`.

## 4. Orden recomendado

1. Desplegar primero el backend.
2. Copiar la dirección pública del backend.
3. Configurar `VITE_SPOTIFY_API_BASE_URL` en Vercel.
4. Desplegar el frontend.
5. Actualizar `CORS_ORIGIN` del backend con el origen final del frontend.
6. Reiniciar o redeplegar ambos servicios.

## 5. Verificación

En local, ejecutar:

```bash
cd rc-download-server
npm install
npm start
```

En otra terminal:

```bash
cd rc-music-eventos
npm install
npm run build
npm run dev
```

Comprobar tres casos: búsqueda en YouTube, búsqueda en Spotify y creación de un pedido desde cada fuente.
