# Configurar Twilio WhatsApp en Follow

## Paso 1 — Crear cuenta Twilio

1. Ve a https://www.twilio.com/try-twilio
2. Regístrate con frankmina78@gmail.com
3. Verifica tu número de teléfono

---

## Paso 2 — Activar el Sandbox de WhatsApp (para pruebas)

1. En Twilio Console → **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Twilio te dará un número de sandbox: `+1 415 523 8886`
3. Envía el mensaje de activación desde tu WhatsApp:  
   `join <palabra-de-twilio>` (ej: `join silver-tiger`)
4. Repite desde el WhatsApp de cada número que quieras probar

> El sandbox es gratis y no requiere aprobación de Meta.

---

## Paso 3 — Obtener credenciales

En https://console.twilio.com → página principal:

| Variable | Dónde encontrarla |
|----------|-------------------|
| `TWILIO_ACCOUNT_SID` | "Account SID" en el Dashboard principal |
| `TWILIO_AUTH_TOKEN` | "Auth Token" (click en el ojo para revelar) |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` (sandbox) o tu número aprobado |

---

## Paso 4 — Agregar secrets en Supabase

Tienes dos opciones:

### Opción A — Via CLI (recomendado)

```bash
# Instalar Supabase CLI si no lo tienes
npm install -g supabase

# Login
supabase login

# Agregar secrets (reemplaza con tus valores reales)
supabase secrets set --project-ref bvzjqtesmcqdnbdxeksj \
  TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  TWILIO_WHATSAPP_FROM="whatsapp:+14155238886"
```

### Opción B — Via Dashboard

1. Ve a https://supabase.com/dashboard/project/bvzjqtesmcqdnbdxeksj/settings/functions
2. Sección **Edge Function Secrets**
3. Agrega los 3 secrets:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_WHATSAPP_FROM`

---

## Paso 5 — Deploy de las Edge Functions

```bash
# Desde la raíz del proyecto
supabase functions deploy send-whatsapp --project-ref bvzjqtesmcqdnbdxeksj
supabase functions deploy whatsapp-webhook --project-ref bvzjqtesmcqdnbdxeksj
```

Las URLs quedarán así:
- **send-whatsapp**: `https://bvzjqtesmcqdnbdxeksj.supabase.co/functions/v1/send-whatsapp`
- **whatsapp-webhook**: `https://bvzjqtesmcqdnbdxeksj.supabase.co/functions/v1/whatsapp-webhook`

---

## Paso 6 — Configurar Webhook en Twilio

1. En Twilio Console → **Messaging** → **Settings** → **WhatsApp Sandbox settings**
2. En el campo **"When a message comes in"**, pega:  
   `https://bvzjqtesmcqdnbdxeksj.supabase.co/functions/v1/whatsapp-webhook`
3. Método: **HTTP POST**
4. Guarda

---

## Paso 7 — Probar

### Probar send-whatsapp (desde terminal o Postman):
```bash
curl -X POST \
  https://bvzjqtesmcqdnbdxeksj.supabase.co/functions/v1/send-whatsapp \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"appointment_id": "<UUID_DE_CITA>", "type": "confirmation"}'
```

### Probar desde el dashboard:
1. Sube un cliente con teléfono en formato `+521XXXXXXXXXX`
2. Agrega una cita para ese cliente
3. En el tab **Citas** → click en **📲 Confirmar**
4. El cliente recibirá el mensaje de WhatsApp

### Respuestas que entiende el sistema:
| Cliente escribe | Acción |
|----------------|--------|
| `SÍ` / `SI` / `CONFIRMO` | Marca cita como **Confirmada** ✅ |
| `NO` / `CANCELAR` | Marca cita como **Cancelada** ❌ |
| `REAGENDAR` | Marca como **Reagendada** y pide nueva fecha |
| `HABLAR` | Notifica al profesional por WhatsApp |
| Cualquier otra cosa | Muestra menú de opciones al cliente |

---

## Próximos pasos

- [ ] **pg_cron scheduler** — Envío automático 24h y 2h antes de cada cita
- [ ] **Resend Email** — Confirmaciones por correo
- [ ] **Stripe** — Cobro de suscripciones
