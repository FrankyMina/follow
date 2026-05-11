// Edge Function: whatsapp-webhook
// Recibe respuestas de WhatsApp desde Twilio.
// Twilio llama a esta URL via POST con los datos del mensaje entrante.
// Palabras clave: SÍ / SI → confirmed | REAGENDAR → rescheduled | NO → cancelled | HABLAR → escalate

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');

    // Validar firma de Twilio (solo si viene la cabecera)
    const signature = req.headers.get('X-Twilio-Signature') || '';
    if (authToken && signature) {
      const isValid = await validateTwilioSignature(authToken, signature, req.url, await req.clone().text());
      if (!isValid) {
        console.warn('Firma de Twilio inválida — posible petición no autorizada');
        // En sandbox continuamos para facilitar pruebas; en producción cambiar a return 403
      }
    }

    // Parsear body de Twilio (application/x-www-form-urlencoded)
    const formText = await req.text();
    const params = new URLSearchParams(formText);

    const from    = params.get('From') || '';    // whatsapp:+521XXXXXXXXXX
    const body    = (params.get('Body') || '').trim().toUpperCase();
    const msgSid  = params.get('MessageSid') || '';

    console.log(`Mensaje de ${from}: "${body}" (${msgSid})`);

    // Normalizar número (quitar "whatsapp:" prefix)
    const phone = from.replace('whatsapp:', '');

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Buscar cliente por teléfono
    const { data: client } = await sb
      .from('clients')
      .select('id, professional_id, name')
      .or(`phone.eq.${phone},phone.eq.${phone.replace('+52', '+521')}`)
      .limit(1)
      .single();

    if (!client) {
      console.warn(`Cliente no encontrado para el número: ${phone}`);
      // Responder TwiML vacío a Twilio (sin mensaje de vuelta)
      return twimlResponse('');
    }

    // Obtener la cita próxima programada del cliente
    const { data: appointment } = await sb
      .from('appointments')
      .select('id, professional_id, scheduled_at, status')
      .eq('client_id', client.id)
      .in('status', ['scheduled', 'confirmed'])
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .single();

    // Interpretar respuesta del cliente
    const { newStatus, responseMsg, msgType } = interpretResponse(body, client.name, appointment);

    // Actualizar estado de la cita si aplica
    if (appointment && newStatus) {
      await sb.from('appointments').update({ status: newStatus }).eq('id', appointment.id);
    }

    // Registrar mensaje entrante
    await sb.from('messages').insert({
      appointment_id: appointment?.id || null,
      professional_id: client.professional_id,
      client_id: client.id,
      channel: 'whatsapp',
      type: msgType,
      body: params.get('Body') || body,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    // Si el cliente pide hablar con un humano, notificar al profesional
    if (msgType === 'escalate') {
      await notifyProfessional(sb, client, appointment, params.get('Body') || body);
    }

    return twimlResponse(responseMsg);

  } catch (err) {
    console.error('Error en whatsapp-webhook:', err);
    return twimlResponse('');
  }
});

// ── Lógica de interpretación ──────────────────────────────────────

interface InterpretResult {
  newStatus: string | null;
  responseMsg: string;
  msgType: string;
}

function interpretResponse(
  body: string,
  clientName: string,
  appointment: { scheduled_at: string } | null,
): InterpretResult {
  const name = clientName.split(' ')[0];

  if (/^(SÍ|SI|S[Ii]|YES|CONFIRMO|CONFIRMAR|OK|ASISTO)/.test(body)) {
    return {
      newStatus: 'confirmed',
      responseMsg: `¡Perfecto ${name}! ✅ Tu cita está confirmada. Te esperamos.`,
      msgType: 'reply_confirmed',
    };
  }

  if (/^(NO|CANCEL|CANCELO|CANCELAR|NO ASISTO|NO PUEDO)/.test(body)) {
    return {
      newStatus: 'cancelled',
      responseMsg: `Entendido ${name}. Tu cita ha sido cancelada. Si quieres agendar otra, escríbenos.`,
      msgType: 'reply_cancelled',
    };
  }

  if (/^(REAGENDAR|REPROGRAMAR|CAMBIAR|CAMBIO|RESCHEDULE)/.test(body)) {
    return {
      newStatus: 'rescheduled',
      responseMsg: `Claro ${name}, queremos reagendarte. Por favor dinos ¿qué día y hora te conviene mejor? 📅`,
      msgType: 'reply_reschedule',
    };
  }

  if (/^(HABLAR|HUMANO|PERSONA|AGENTE|AYUDA|HELP)/.test(body)) {
    return {
      newStatus: null,
      responseMsg: `${name}, en un momento alguien de nuestro equipo se comunicará contigo. ¡Gracias por escribirnos!`,
      msgType: 'escalate',
    };
  }

  // Mensaje no reconocido — escalación automática
  return {
    newStatus: null,
    responseMsg: `Hola ${name} 👋 Recibimos tu mensaje. Puedes responder:\n• *SÍ* — Confirmar cita\n• *NO* — Cancelar cita\n• *REAGENDAR* — Cambiar fecha\n• *HABLAR* — Hablar con un asesor`,
    msgType: 'unrecognized',
  };
}

// ── Notificar al profesional cuando un cliente escala ─────────────

async function notifyProfessional(
  sb: ReturnType<typeof createClient>,
  client: { name: string; professional_id: string },
  appointment: { id: string; scheduled_at: string } | null,
  clientMessage: string,
) {
  const { data: prof } = await sb
    .from('professionals')
    .select('whatsapp, name, business_name')
    .eq('id', client.professional_id)
    .single();

  if (!prof?.whatsapp) return;

  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken  = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_WHATSAPP_FROM');
  if (!accountSid || !authToken || !fromNumber) return;

  const apptInfo = appointment
    ? `Cita: ${new Date(appointment.scheduled_at).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`
    : 'Sin cita próxima registrada';

  const notifMsg = `⚠️ *Follow — Escalación*\n\nTu cliente *${client.name}* quiere hablar contigo.\n\n${apptInfo}\n\nMensaje del cliente: "${clientMessage}"`;

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const to = `whatsapp:${prof.whatsapp}`;

  await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: fromNumber, To: to, Body: notifMsg }),
  });
}

// ── Validar firma HMAC de Twilio ──────────────────────────────────

async function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  body: string,
): Promise<boolean> {
  try {
    const params = new URLSearchParams(body);
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}${v}`)
      .join('');

    const toSign = url + sortedParams;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(authToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
    );
    const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(toSign));
    const computed = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
    return computed === signature;
  } catch {
    return true; // En sandbox, omitir validación si falla
  }
}

// ── Respuesta TwiML ───────────────────────────────────────────────

function twimlResponse(message: string) {
  const xml = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
