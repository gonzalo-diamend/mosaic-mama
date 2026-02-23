# Mosaic Mama

Aplicacion web para convertir fotos en patrones de mosaico listos para imprimir y trabajar.

## Funcionalidades actuales

- Carga de imagen local.
- Ajuste de tamano de tesela y cantidad de colores.
- Edicion de paleta (incluye bloqueo de colores).
- Vista previa del mosaico y alternancia con imagen original.
- Exportacion de patron a PDF A4.
- Guardado local del ultimo proyecto.
- Modo PWA basico (manifest + service worker).

## Stack tecnico

- Next.js 16 (App Router)
- React 19
- TypeScript
- Vitest (tests unitarios)
- ESLint

## Requisitos

- Node.js 20+
- npm 10+

## Desarrollo local

```bash
npm ci
npm run dev
```

Abrir `http://localhost:3000`.

## Scripts disponibles

```bash
npm run dev        # desarrollo
npm run test       # tests unitarios
npm run lint       # lint
npm run build      # build de produccion
npm run start      # ejecutar build local
```

## Calidad y CI

Pipeline en GitHub Actions (`.github/workflows/ci.yml`) con:

1. `npm test`
2. `npm run lint`
3. `npm run build`

## Deploy en Vercel

### Opcion A: desde dashboard (recomendada)

1. Crear proyecto en Vercel e importar este repo.
2. Framework detectado: `Next.js`.
3. Build command: `npm run build`.
4. Output setting: default de Next.js.
5. Deploy.

No requiere variables de entorno para la version actual.

### Opcion B: CLI

```bash
npm i -g vercel
vercel login
vercel
vercel --prod
```

## Estructura principal

- `src/app/page.tsx`: flujo principal de la app.
- `src/components/`: UI (uploader, controles, preview, paleta, PWA register).
- `src/lib/mosaic/`: procesamiento de imagen, cuantizacion y export.
- `src/lib/storage/projects.ts`: persistencia local.
- `src/workers/mosaic.worker.ts`: procesamiento en worker.

## Estado actual

El proyecto compila en produccion y tiene tests/lint pasando.
