// Edge Function: whatsapp-webhook
// Recibe mensajes entrantes de WhatsApp via Twilio.
//
// Flujos manejados:
//   1. CITA-[code]  → inicia agendamiento conversacional para un profesional
//   2. Sesión activa → continúa el flujo de reserva paso a paso
//   3. Cliente existente → confirma / cancela / reagenda su cita próxima

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const signature = req.headers.get('X-Twilio-Signature') || '';
    if (authToken && signature) {
      await validateTwilioSignature(authToken, signature, req.url, await req.clone().text());
    }

    const formText = await req.text();
    const params   = new URLSearchParams(formText);

    const from   = params.get('From') || '';
    const rawMsg = (params.get('Body') || '').trim();
    const body   = rawMsg.toUpperCase();

    const phone = from.replace('whatsapp:', '');

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 1. ¿Hay una sesión de agendamiento activa para este número? ──
    const { data: session } = await sb
      .from('booking_sessions')
      .select('*')
      .eq('phone', phone)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (session) {
      return await handleBookingStep(sb, phone, rawMsg, body, session);
    }

    // ── 2. ¿Está iniciando un agendamiento nuevo? (CITA-[code]) ──
    const citaMatch = body.match(/^CITA[-\s]?([A-Z0-9]{6,})/);
    if (citaMatch) {
      const code = citaMatch[1].toLowerCase();
      const { data: prof } = await sb
        .from('professionals')
        .select('id, name, business_name')
        .ilike('id', `${code}%`)
        .limit(1)
        .maybeSingle();

      if (!prof) {
        return twiml('No encontramos ese profesional. Verifica el enlace que te compartieron.');
      }

      // Limpiar sesiones expiradas de este número y crear una nueva
      await sb.from('booking_sessions').delete().eq('phone', phone);
      await sb.from('booking_sessions').insert({
        phone,
        professional_id: prof.id,
        step: 'name',
        data: {},
      });

      const negocio = prof.business_name || prof.name;
      return twiml(
        `¡Hola! 👋 Vamos a agendar tu cita con *${negocio}*.\n\n` +
        `¿Cuál es tu *nombre completo*?\n\n_(Escribe CANCELAR en cualquier momento para salir)_`,
      );
    }

    // ── 3. Flujo existente: cliente conocido responde sobre su cita ──
    const { data: client } = await sb
      .from('clients')
      .select('id, professional_id, name')
      .or(`phone.eq.${phone},phone.eq.${phone.replace('+52', '+521')}`)
      .limit(1)
      .maybeSingle();

    if (!client) {
      return twiml('');
    }

    const { data: appointment } = await sb
      .from('appointments')
      .select('id, professional_id, scheduled_at, status')
      .eq('client_id', client.id)
      .in('status', ['scheduled', 'confirmed'])
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const { newStatus, responseMsg, msgType } = interpretResponse(body, client.name, appointment);

    if (appointment && newStatus) {
      await sb.from('appointments').update({ status: newStatus }).eq('id', appointment.id);
    }

    await sb.from('messages').insert({
      appointment_id: appointment?.id || null,
      professional_id: client.professional_id,
      client_id: client.id,
      channel: 'whatsapp',
      type: msgType,
      body: rawMsg,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    if (msgType === 'escalate') {
      notifyProfessional(sb, client, appointment, rawMsg).catch(console.error);
    }

    return twiml(responseMsg);

  } catch (err) {
    console.error('Error en whatsapp-webhook:', err);
    return twiml('');
  }
});

// ── Flujo conversacional de agendamiento ─────────────────────────

async function handleBookingStep(
  sb: ReturnType<typeof createClient>,
  phone: string,
  rawMsg: string,
  body: string,
  session: Record<string, unknown>,
) {
  const step = session.step as string;
  const data = (session.data as Record<string, string>) || {};
  const sessionId = session.id as string;
  const professionalId = session.professional_id as string;

  if (body === 'CANCELAR') {
    await sb.from('booking_sessions').delete().eq('id', sessionId);
    return twiml('Agendamiento cancelado. ¡Hasta pronto! 👋');
  }

  if (step === 'name') {
    const name = rawMsg.trim();
    if (name.length < 2) {
      return twiml('Por favor escribe tu nombre completo.');
    }
    await updateSession(sb, sessionId, 'service', { ...data, name });
    return twiml(
      `Gracias, *${name}*! 😊\n\n` +
      `¿Qué *servicio* necesitas?\n_(Ej: Consulta, Corte, Sesión, Limpieza facial…)_`,
    );
  }

  if (step === 'service') {
    await updateSession(sb, sessionId, 'date', { ...data, service: rawMsg.trim() });
    return twiml(
      `Anotado ✏️\n\n¿Qué *fecha* prefieres?\nEscríbela en formato *DD/MM/YYYY*\n_Ej: 20/06/2026_`,
    );
  }

  if (step === 'date') {
    const date = parseDate(rawMsg.trim());
    if (!date) {
      return twiml(
        `No reconocí esa fecha. Por favor usa el formato *DD/MM/YYYY*\n_Ej: 20/06/2026_`,
      );
    }
    await updateSession(sb, sessionId, 'time', { ...data, date });
    return twiml(
      `Perfecto 📅 ¿A qué *hora* te queda bien?\nEscríbela en formato *HH:MM*\n_Ej: 10:00 o 15:30_`,
    );
  }

  if (step === 'time') {
    const time = parseTime(rawMsg.trim());
    if (!time) {
      return twiml(
        `No reconocí esa hora. Por favor usa el formato *HH:MM*\n_Ej: 10:00 o 15:30_`,
      );
    }

    const finalData = { ...data, time };
    const scheduledAt = `${finalData.date}T${time}:00`;

    // Crear cliente nuevo
    const { data: newClient, error: cErr } = await sb
      .from('clients')
      .insert({
        professional_id: professionalId,
        name: finalData.name,
        phone,
      })
      .select('id')
      .single();

    if (cErr || !newClient) {
      console.error('Error creando cliente:', cErr);
      return twiml('Hubo un error al registrar tu cita. Por favor intenta de nuevo.');
    }

    // Crear cita
    await sb.from('appointments').insert({
      professional_id: professionalId,
      client_id: newClient.id,
      scheduled_at: scheduledAt,
      service: finalData.service || null,
      status: 'scheduled',
      source: 'whatsapp',
    });

    // Borrar sesión
    await sb.from('booking_sessions').delete().eq('id', sessionId);

    // Notificar al profesional
    notifyProfessionalNewBooking(sb, professionalId, finalData.name, finalData.service, scheduledAt).catch(console.error);

    const fechaLegible = new Date(scheduledAt).toLocaleString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City',
    });

    return twiml(
      `¡Listo, *${finalData.name}*! ✅\n\n` +
      `Tu cita para *${finalData.service}* ha sido registrada para el *${fechaLegible}*.\n\n` +
      `En breve recibirás una confirmación. ¡Hasta pronto! 🎉`,
    );
  }

  return twiml('');
}

async function updateSession(
  sb: ReturnType<typeof createClient>,
  id: string,
  nextStep: string,
  data: Record<string, string>,
) {
  await sb.from('booking_sessions').update({
    step: nextStep,
    data,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  }).eq('id', id);
}

// ── Notificación al profesional: nueva reserva por WhatsApp ──────

async function notifyProfessionalNewBooking(
  sb: ReturnType<typeof createClient>,
  professionalId: string,
  clientName: string,
  service: string,
  scheduledAt: string,
) {
  const { data: prof } = await sb
    .from('professionals')
    .select('whatsapp, name, business_name')
    .eq('id', professionalId)
    .single();

  if (!prof?.whatsapp) return;

  const accountSid  = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken   = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber  = Deno.env.get('TWILIO_WHATSAPP_FROM');
  if (!accountSid || !authToken || !fromNumber) return;

  const fecha = new Date(scheduledAt).toLocaleString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City',
  });

  const msg =
    `📅 *Nueva cita reservada en Follow*\n\n` +
    `Cliente: *${clientName}*\n` +
    `Servicio: *${service || '—'}*\n` +
    `Fecha: *${fecha}*\n\n` +
    `Revisa tu dashboard para confirmarla.`;

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: fromNumber, To: `whatsapp:${prof.whatsapp}`, Body: msg }),
  });
}

// ── Interpretar respuesta de cliente existente ───────────────────

function interpretResponse(
  body: string,
  clientName: string,
  appointment: { scheduled_at: string } | null,
) {
  const name = clientName.split(' ')[0];

  if (/^(SÍ|SI|S[Ii]|YES|CONFIRMO|CONFIRMAR|OK|ASISTO)/.test(body)) {
    return { newStatus: 'confirmed', responseMsg: `¡Perfecto ${name}! ✅ Tu cita está confirmada. ¡Te esperamos!`, msgType: 'reply_confirmed' };
  }
  if (/^(NO|CANCEL|CANCELO|CANCELAR|NO ASISTO|NO PUEDO)/.test(body)) {
    return { newStatus: 'cancelled', responseMsg: `Entendido ${name}. Tu cita ha sido cancelada. Si quieres agendar otra, escríbenos.`, msgType: 'reply_cancelled' };
  }
  if (/^(REAGENDAR|REPROGRAMAR|CAMBIAR|CAMBIO|RESCHEDULE)/.test(body)) {
    return { newStatus: 'rescheduled', responseMsg: `Claro ${name}, queremos reagendarte. ¿Qué día y hora te conviene mejor? 📅`, msgType: 'reply_reschedule' };
  }
  if (/^(HABLAR|HUMANO|PERSONA|AGENTE|AYUDA|HELP)/.test(body)) {
    return { newStatus: null, responseMsg: `${name}, en un momento alguien de nuestro equipo se comunicará contigo. ¡Gracias!`, msgType: 'escalate' };
  }

  return {
    newStatus: null,
    responseMsg:
      `Hola ${name} 👋 Recibimos tu mensaje. Puedes responder:\n` +
      `• *SÍ* — Confirmar cita\n• *NO* — Cancelar cita\n` +
      `• *REAGENDAR* — Cambiar fecha\n• *HABLAR* — Hablar con un asesor`,
    msgType: 'unrecognized',
  };
}

// ── Notificar al profesional cuando escala un cliente ───────────

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

  const accountSid  = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken   = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber  = Deno.env.get('TWILIO_WHATSAPP_FROM');
  if (!accountSid || !authToken || !fromNumber) return;

  const apptInfo = appointment
    ? `Cita: ${new Date(appointment.scheduled_at).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`
    : 'Sin cita próxima registrada';

  const msg =
    `⚠️ *Follow — Escalación*\n\n` +
    `Tu cliente *${client.name}* quiere hablar contigo.\n\n` +
    `${apptInfo}\n\nMensaje: "${clientMessage}"`;

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: fromNumber, To: `whatsapp:${prof.whatsapp}`, Body: msg }),
  });
}

// ── Parsers de fecha y hora ──────────────────────────────────────

function parseDate(val: string): string | null {
  // Acepta: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
  let m = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return val;
  return null;
}

function parseTime(val: string): string | null {
  const m = val.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1]), min = parseInt(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ── Validar firma HMAC de Twilio ─────────────────────────────────

async function validateTwilioSignature(
  authToken: string, signature: string, url: string, body: string,
): Promise<boolean> {
  try {
    const params = new URLSearchParams(body);
    const sorted = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}${v}`).join('');
    const toSign = url + sorted;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(authToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(toSign));
    return btoa(String.fromCharCode(...new Uint8Array(sig))) === signature;
  } catch { return true; }
}

// ── TwiML response ───────────────────────────────────────────────

function twiml(message: string) {
  const xml = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
}

function escXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
