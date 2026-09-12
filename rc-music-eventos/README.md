# RC music_eventos

Aplicación web responsive para fiestas y DJs: asistentes buscan canciones, escuchan una previa, envían pedidos, agregan dedicatorias y votan; el DJ administra eventos y controla la cola.

## Stack

- React + Vite
- Tailwind CSS
- Lucide React para iconos
- Persistencia local con `localStorage` para demo
- Búsqueda musical escalonada: Spotify → Deezer → YouTube

## Arranque

```bash
npm install
cp .env.example .env
npm run dev
```

La app se abre en la URL que muestre Vite.

## Demo

- Evento público: `RC26`
- Clave del Panel de DJ: `rcdj2026`

Al crear un evento, se genera un código único automáticamente. Los cambios se sincronizan entre pestañas mediante `localStorage` y un polling corto para simular tiempo real sin backend.

## Búsqueda musical multifuente

La búsqueda se realiza en este orden:

1. Spotify.
2. Deezer.
3. YouTube como último recurso.

La siguiente fuente solo se consulta si la anterior no devuelve resultados. La API key de YouTube no se incluye en React/Vite; queda únicamente en el backend. El backend mantiene caché de búsquedas durante 6 horas y agrupa solicitudes simultáneas iguales.

Configura el backend:

```bash
cd ../rc-download-server
cp .env.example .env
# Completa YOUTUBE_API_KEY
# Completa SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET si usarás Spotify
npm install
npm start
```

El frontend local usa:

```env
VITE_MUSIC_API_BASE_URL=http://localhost:8787/api
VITE_SPOTIFY_API_BASE_URL=http://localhost:8787/api
```

En producción, ambas variables deben apuntar al backend público. Si no existe `VITE_MUSIC_API_BASE_URL`, YouTube usa un catálogo simulado local y no expone ninguna API key.

## Estructura

```text
src/
  components/
    AttendeeApp.jsx   # buscador multifuente, pedidos, likes, Yape y previews
    DjApp.jsx         # eventos, cola, estados y reproducción
    DjLogin.jsx       # acceso protegido
    HomeScreen.jsx    # selección de rol
    JoinEvent.jsx     # ingreso por código o nombre
    Brand.jsx         # layout y elementos de marca
  lib/
    music.js          # Spotify → Deezer → YouTube
    storage.js        # eventos, likes y códigos en localStorage
  App.jsx
  main.jsx
  index.css
```

## Activar Supabase y usuarios reales

La carpeta `supabase/schema.sql` contiene las tablas, políticas RLS, likes únicos por usuario y la función segura para votar. En Supabase:

1. Crea un proyecto.
2. Ejecuta `supabase/schema.sql` desde **SQL Editor**.
3. Activa **Anonymous Sign-ins** en Authentication > Providers para que el público pueda pedir y votar sin registrarse.
4. Crea el usuario DJ en Authentication > Users con correo y contraseña.
5. Copia `.env.example` a `.env` y completa las variables de Supabase.

Con esas variables, los asistentes usan Supabase para buscar eventos, crear pedidos y votar; el DJ inicia sesión con su cuenta y sus eventos quedan aislados por RLS. Sin esas variables, la aplicación vuelve automáticamente al modo demo local.

## Despliegue

La guía operativa completa está en `DEPLOY.md`.

### Backend de música

La carpeta `rc-download-server` puede desplegarse como servicio Node en Render o Railway. Define en el backend:

```env
YOUTUBE_API_KEY=...
YOUTUBE_DAILY_CALL_LIMIT=100
YOUTUBE_CACHE_TTL_MS=21600000
YOUTUBE_CACHE_MAX_ENTRIES=500
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
CORS_ORIGIN=origen-del-frontend
```

Después configura `VITE_MUSIC_API_BASE_URL` y `VITE_SPOTIFY_API_BASE_URL` con la dirección pública del backend, terminada en `/api`.

### Vercel o Cloudflare Pages

Selecciona `rc-music-eventos` como raíz del proyecto y usa:

- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

No agregues `VITE_YOUTUBE_API_KEY`; la clave debe permanecer en el backend.
