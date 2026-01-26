# Omni Hub MVP (Fase 1/2/3) — WhatsApp (Baileys) + Instagram/Messenger + Panel + Bot (OpenAI)

Monorepo **multi-tenant** para:
- **gateway-wa**: WhatsApp no oficial via **Baileys (QR)** ✅
- **gateway-meta**: Instagram/Messenger via **Meta Graph API** (stub / base) ✅
- **core-api**: CRM + motor BOT/HUMAN + persistencia + realtime ✅
- **panel-web**: Inbox web para agentes ✅

> Este ZIP es un **MVP funcional** para Fase 1 (WhatsApp + Panel + Core) y una base lista para extender Fase 2/3.

---

## Requisitos
- Node.js 20+
- Postgres 14+ (local o remoto)
- (Opcional) Redis para colas (no requerido en este MVP)

---

## Quickstart (local)

### 1) Instalar dependencias
```bash
npm install
```

### 2) Configurar envs
Copiá `.env.example` de cada app a `.env` y completá.

- `apps/core-api/.env.example`
- `apps/gateway-wa/.env.example`
- `apps/gateway-meta/.env.example`
- `apps/panel-web/.env.example`

### 3) Levantar Postgres (opcional con docker)
```bash
docker compose up -d db
```

### 4) Migraciones Prisma (core-api)
```bash
cd apps/core-api
npx prisma migrate dev --name init
cd ../..
```

### 5) Iniciar todo
```bash
npm run dev
```

- Core API: http://localhost:4000
- Gateway WA: http://localhost:4010
- Gateway Meta: http://localhost:4020
- Panel Web: http://localhost:5173

---

## FASE 1 — MVP (incluida)
**Objetivo:** Inbox + historial + enviar/recibir WhatsApp + handoff bot→humano.

Incluye:
- Multi-tenant básico (tenant_id en headers/body)
- DB: conversations + messages + users
- Realtime (Socket.IO) para que el panel actualice inbox/mensajes
- Gateway WA (Baileys):
  - `POST /session/start`
  - `GET /session/qr`
  - `GET /session/status`
  - `POST /send/text`
  - `POST /send/image`
- Core API:
  - `GET /api/inbox`
  - `GET /api/conversations/:id/messages`
  - `POST /api/conversations/:id/reply`
  - `POST /api/conversations/:id/takeover`
  - `POST /api/conversations/:id/return-to-bot`
  - `POST /api/conversations/:id/assign`

> Nota: el “bot OpenAI” en Fase 1 está implementado como **módulo** con una función `maybeBotReply(...)`. Está listo para habilitarse con `OPENAI_API_KEY`, pero por defecto no spamea (reglas conservadoras).

---

## FASE 2 — Omnicanal (base incluida, completar)
**Objetivo:** unificar Instagram + Messenger en el mismo inbox.

Incluye en este repo:
- `apps/gateway-meta` con:
  - `POST /webhooks/meta` (stub)
  - `POST /send` (stub)
- Contrato de eventos normalizados (`packages/shared/src/events.ts`)
- Core ya soporta `channel = whatsapp|instagram|messenger`

Pendiente para completar:
- Verificación de firma de Meta (X-Hub-Signature-256)
- Suscripción webhooks IG/Messenger y mapping de payloads reales
- Envío real por Graph API

---

## FASE 3 — SaaS vendible (pendiente, roadmap)
- RBAC completo (admin/supervisor/agent/viewer) + políticas
- Audit log completo (quién hizo qué, cuándo)
- Reglas de routing (round-robin, skills, horarios)
- Colas (BullMQ) para envíos, reintentos, media uploads
- Storage serio (Supabase Storage / S3/R2)
- Observabilidad (metrics, tracing, alertas)
- Hardening (rate limits, encryption de secretos por tenant)

---

## Contrato multi-tenant (MVP)
Para simplificar:
- El panel envía `x-tenant-id` (UUID) en requests al core.
- Core usa ese tenant_id para filtrar conversaciones/mensajes.
- Gateway WA maneja **una sesión por tenant** (auth en `apps/gateway-wa/data/auth/<tenant_id>`).

---

## Scripts
- `npm run dev` — levanta todo en paralelo
- `npm run build` — build de todos los paquetes

---

## Estructura
```
apps/
  core-api/
  gateway-wa/
  gateway-meta/
  panel-web/
packages/
  shared/
```
