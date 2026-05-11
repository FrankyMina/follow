// Edge Function: send-whatsapp
// Envía un mensaje de WhatsApp via Twilio para una cita específica.
// POST body: { appointment_id: string, type: 'confirmation'|'reminder_24h'|'reminder_2h'|'followup'|'reschedule' }

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
    const { appointment_id, type = 'confirmation' } = await req.json();
    if (!appointment_id) {
      return json({ error: 'appointment_id requerido' }, 400);
    }

    // Credenciales de Twilio desde secrets de Supabase
    const accountSid  = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken   = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber  = Deno.env.get('TWILIO_WHATSAPP_FROM'); // ej: whatsapp:+14155238886

    if (!accountSid || !authToken || !fromNumber) {
      return json({ error: 'Twilio no configurado. Revisa los secrets de Supabase.' }, 500);
    }

    // Cliente Supabase con service role para leer datos sin RLS
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Obtener datos de la cita + cliente + profesional + plantilla
    const { data: appt, error: apptErr } = await sb
      .from('appointments')
      .select(`
        id, scheduled_at, service, status,
        clients ( id, name, phone ),
        professionals ( id, name, business_name, whatsapp, industry )
      `)
      .eq('id', appointment_id)
      .single();

    if (apptErr || !appt) {
      return json({ error: 'Cita no encontrada' }, 404);
    }

    const client = appt.clients as { id: string; name: string; phone: string };
    const prof   = appt.professionals as { id: string; name: string; business_name: string; whatsapp: string; industry: string };

    if (!client.phone) {
      return json({ error: 'El cliente no tiene teléfono registrado' }, 400);
    }

    // Obtener plantilla (industria específica primero, luego global)
    const { data: template } = await sb
      .from('templates')
      .select('body')
      .eq('type', type)
      .eq('channel', 'whatsapp')
      .or(`industry.eq.${prof.industry},industry.is.null`)
      .order('industry', { ascending: false }) // industria específica primero
      .limit(1)
      .single();

    if (!template) {
      return json({ error: `Plantilla '${type}' no encontrada` }, 404);
    }

    // Formatear fecha y hora en español México
    const citaDate = new Date(appt.scheduled_at);
    const fecha = citaDate.toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City',
    });
    const hora = citaDate.toLocaleTimeString('es-MX', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City',
    });

    // Reemplazar variables en la plantilla
    const body = template.body
      .replace(/\{\{nombre\}\}/g,  client.name)
      .replace(/\{\{negocio\}\}/g, prof.business_name || prof.name)
      .replace(/\{\{fecha\}\}/g,   fecha)
      .replace(/\{\{hora\}\}/g,    hora)
      .replace(/\{\{servicio\}\}/g, appt.service || 'tu cita');

    // Normalizar número a formato WhatsApp (+52...)
    const toPhone = normalizePhone(client.phone);
    const to = `whatsapp:${toPhone}`;

    // Enviar mensaje via Twilio REST API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = btoa(`${accountSid}:${authToken}`);

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: fromNumber, To: to, Body: body }),
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error('Twilio error:', twilioData);
      // Registrar el intento fallido
      await sb.from('messages').insert({
        appointment_id,
        professional_id: prof.id,
        client_id: client.id,
        channel: 'whatsapp',
        type,
        body,
        status: 'failed',
        sent_at: new Date().toISOString(),
      });
      return json({ error: twilioData.message || 'Error al enviar WhatsApp', twilio: twilioData }, 502);
    }

    // Registrar mensaje enviado exitosamente
    await sb.from('messages').insert({
      appointment_id,
      professional_id: prof.id,
      client_id: client.id,
      channel: 'whatsapp',
      type,
      body,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    // Actualizar estado de la cita si es confirmación
    if (type === 'confirmation') {
      await sb.from('appointments').update({ status: 'scheduled' }).eq('id', appointment_id);
    }

    return json({
      success: true,
      message_sid: twilioData.sid,
      to: toPhone,
      type,
    });

  } catch (err) {
    console.error('Error en send-whatsapp:', err);
    return json({ error: String(err) }, 500);
  }
});

function normalizePhone(phone: string): string {
  // Eliminar todo excepto dígitos y +
  let clean = phone.replace(/[\s\-\(\)\.]/g, '');
  if (!clean.startsWith('+')) {
    // Asumir México si no tiene código de país
    clean = clean.replace(/^52/, ''); // evitar doble 52
    clean = `+52${clean}`;
  }
  return clean;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
