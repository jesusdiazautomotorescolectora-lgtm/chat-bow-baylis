# Panel MVP (Inbox + Reply) — limpio

Este repo es un **MVP mínimo funcional** para que el Panel sea usable:

- listar conversaciones (Inbox)
- ver historial completo
- enviar mensajes desde el panel (texto y/o imagen)

## Arquitectura
- `apps/panel-api`: Express + TypeScript + Prisma + PostgreSQL
- `apps/panel-web`: Vite + React + TypeScript (UI básica)

## Variables de entorno
Copiá `.env.example` a `.env` y completá:

- `DATABASE_URL` (con `schema=panel` recomendado)
- `BOT_ADMIN_TOKEN` (token para header `x-panel-token`)
- `BOT_API_URL` (opcional, solo si querés forward)

> **Headers requeridos en la API**
> - `x-panel-token: <BOT_ADMIN_TOKEN>`
> - `x-tenant-id: <uuid del tenant>`

## Setup local

### 1) Instalar deps
```bash
npm install
```

### 2) Migrar DB
```bash
npm -w @omni/panel-api run prisma:generate
npm -w @omni/panel-api run prisma:migrate
npm -w @omni/panel-api run seed
```

### 3) Correr API
```bash
npm -w @omni/panel-api run dev
```

### 4) Correr Web
```bash
npm -w @omni/panel-web run dev
```

Abrís la web y te loguea por token/tenant.

## Endpoints
- `GET /api/health`
- `GET /api/inbox`
- `GET /api/inbox/:id/messages`
- `POST /api/inbox/:id/reply`

### Body de reply
```json
{ "text": "hola", "imageUrl": "https://..." }
```
Se normaliza a `image_url`.

## Seed
Se crean:
- 1 tenant
- 1 usuario
- 1 conversación
- algunos mensajes

Así ya podés probar UI y API sin depender de Evolution.
