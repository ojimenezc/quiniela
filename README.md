# Quiniela Mundial

App React + Supabase para registrar pronósticos, resultados y ranking de una quiniela interna.

## Stack

- React + Vite + TypeScript
- Supabase PostgreSQL
- Hosting estático: Vercel, Netlify o Cloudflare Pages

## Configuración

1. En Supabase, abre el SQL editor y ejecuta `supabase/schema.sql`.
2. Para reemplazar los partidos de ejemplo por el calendario completo, ejecuta `supabase/reset_and_seed_worldcup_2026.sql`.
3. Si ya habías creado la base antes de este cambio, ejecuta `supabase/lock_predictions_after_kickoff.sql` para bloquear predicciones después del inicio.
4. Copia `.env.example` a `.env`.
5. Completa:

```bash
VITE_SUPABASE_URL=https://jvhguffyycvgrwyvwfut.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_public_key
```

6. Instala dependencias y corre la app:

```bash
npm install
npm run dev
```

## Seguridad

No pongas el password de PostgreSQL en React. El frontend solo debe usar la URL del proyecto y la `anon public key`.

El modelo actual usa alias + PIN y políticas abiertas para una quiniela interna temporal. Si la app será pública o habrá dinero relevante de por medio, conviene cambiar a Supabase Auth para que cada usuario solo pueda editar sus propios pronósticos y solo el admin pueda cargar resultados.

## Puntaje

- Marcador exacto: 5 puntos.
- Resultado correcto: 3 puntos.
- Goles correctos por equipo: 1 punto cada uno.
- Desempate del ranking: más marcadores exactos, luego más resultados correctos.
