# RC music_eventos

Aplicación web responsive para fiestas y DJs: asistentes buscan canciones, escuchan una previa, envían pedidos, agregan dedicatorias y votan; el DJ administra eventos y controla la cola.

## Stack

- React + Vite
- Tailwind CSS
- Lucide React para iconos
- Persistencia local con `localStorage` para demo
- Búsqueda combinada en YouTube y Spotify mediante API

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

## Búsqueda en YouTube y Spotify

La búsqueda consulta YouTube y, cuando el backend de Spotify está configurado, también Spotify. YouTube usa:

```env
VITE_YOUTUBE_API_KEY=tu_api_key
```

Spotify no debe usar el client secret en React. El backend de `../rc-download-server` expone `/api/spotify-search` y usa Client Credentials en el servidor:

```bash
cd ../rc-download-server
cp .env.example .env
# Completa SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET
npm install
npm start
```

El frontend local usa `VITE_SPOTIFY_API_BASE_URL=http://localhost:8787/api`. En producción, cambia esa variable por la dirección pública del backend. Si Spotify no está configurado, YouTube sigue funcionando de forma independiente.

Si tampoco existe la clave de YouTube, `src/lib/music.js` usa un catálogo simulado para mantener el flujo funcionando en local.

## Estructura

```text
src/
  components/
    AttendeeApp.jsx   # buscador, pedidos, likes, Yape y previews
    DjApp.jsx         # eventos, cola, estados y reproducción
    DjLogin.jsx       # acceso protegido
    HomeScreen.jsx    # selección de rol
    JoinEvent.jsx     # ingreso por código o nombre
    Brand.jsx         # layout y elementos de marca
  lib/
    music.js          # Búsqueda combinada YouTube + Spotify
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
5. Copia `.env.example` a `.env` y completa:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
VITE_SUPABASE_DJ_EMAIL=dj@tudominio.com
```

Con esas variables, los asistentes usan Supabase para buscar eventos, crear pedidos y votar; el DJ inicia sesión con su cuenta y sus eventos quedan aislados por RLS. Sin esas variables, la aplicación vuelve automáticamente al modo demo local.

## Despliegue

La guía operativa completa está en `DEPLOY.md`.

### Backend de Spotify

La carpeta `rc-download-server` puede desplegarse como servicio Node en Render o Railway. El archivo `render.yaml` deja preparada la configuración para Render. Define estas variables en el panel del proveedor:

```env
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
CORS_ORIGIN=origen-del-frontend
```

Después copia la dirección pública del backend en `VITE_SPOTIFY_API_BASE_URL` dentro de las variables del frontend y vuelve a desplegarlo.

### Vercel

```bash
npm install
npm run build
npx vercel --prod
```

En el panel de Vercel agrega las mismas variables `VITE_*`. El archivo `vercel.json` ya incluye el fallback de rutas.

### Netlify

Conecta el repositorio y usa:

- Build command: `npm run build`
- Publish directory: `dist`

El archivo `netlify.toml` ya configura el fallback SPA. Añade las variables `VITE_*` en Site configuration > Environment variables.

## Para producción

La clave incluida (`rcdj2026`) solo se usa en modo demo. Cuando Supabase está configurado, el acceso del DJ usa Authentication y las políticas RLS protegen sus eventos. Para un entorno más completo se puede añadir recuperación de contraseña, perfiles de DJ, moderación de pedidos y límites anti-spam.
