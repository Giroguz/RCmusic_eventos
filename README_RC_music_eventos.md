# RC music_eventos

Proyecto dividido en dos servicios:

- `rc-music-eventos/`: frontend React + Vite.
- `rc-download-server/`: API Node para búsqueda en Spotify.

## Subir a GitHub

Sube ambas carpetas conservando esta estructura. No subas archivos `.env` ni credenciales. Los archivos `.env.example` sirven como plantilla.

## Frontend

En Vercel o Netlify usa como raíz `rc-music-eventos`:

```bash
npm install
npm run build
```

Configura las variables indicadas en `rc-music-eventos/.env.example`.

## Backend

En Render o Railway usa como raíz `rc-download-server`:

```bash
npm install
npm start
```

Configura `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` y `CORS_ORIGIN` en el panel del proveedor.

## Orden de publicación

1. Publicar el backend.
2. Configurar su dirección en `VITE_SPOTIFY_API_BASE_URL` del frontend.
3. Publicar el frontend.
4. Configurar `CORS_ORIGIN` con el origen final del frontend.

Consulta `rc-music-eventos/DEPLOY.md` para el procedimiento detallado.
