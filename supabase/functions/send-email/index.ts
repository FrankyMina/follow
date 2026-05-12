// Edge Function: send-email
// Envía un email de confirmación/recordatorio via Resend.
// POST body: { appointment_id: string, type: 'confirmation'|'reminder_24h'|'reminder_2h'|'followup' }

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
    if (!appointment_id) return json({ error: 'appointment_id requerido' }, 400);

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) return json({ error: 'Resend no configurado. Agrega RESEND_API_KEY en los secrets de Supabase.' }, 500);

    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Follow <noreply@follow.app>';

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Obtener datos de la cita
    const { data: appt, error: apptErr } = await sb
      .from('appointments')
      .select(`
        id, scheduled_at, service, status,
        clients ( id, name, email ),
        professionals ( id, name, business_name, industry )
      `)
      .eq('id', appointment_id)
      .single();

    if (apptErr || !appt) return json({ error: 'Cita no encontrada' }, 404);

    const client = appt.clients as { id: string; name: string; email: string };
    const prof   = appt.professionals as { id: string; name: string; business_name: string; industry: string };

    if (!client.email) return json({ error: 'El cliente no tiene email registrado' }, 400);

    // Obtener plantilla
    const { data: template } = await sb
      .from('templates')
      .select('body, subject')
      .eq('type', type)
      .eq('channel', 'email')
      .or(`industry.eq.${prof.industry},industry.is.null`)
      .order('industry', { ascending: false })
      .limit(1)
      .single();

    if (!template) return json({ error: `Plantilla email '${type}' no encontrada` }, 404);

    const citaDate = new Date(appt.scheduled_at);
    const fecha = citaDate.toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City',
    });
    const hora = citaDate.toLocaleTimeString('es-MX', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City',
    });

    const negocio = prof.business_name || prof.name;
    const bodyText = template.body
      .replace(/\{\{nombre\}\}/g, client.name)
      .replace(/\{\{negocio\}\}/g, negocio)
      .replace(/\{\{fecha\}\}/g,   fecha)
      .replace(/\{\{hora\}\}/g,    hora)
      .replace(/\{\{servicio\}\}/g, appt.service || 'tu cita');

    const subject = (template.subject || `Tu cita con ${negocio}`)
      .replace(/\{\{negocio\}\}/g, negocio)
      .replace(/\{\{fecha\}\}/g, fecha);

    // Convertir saltos de línea a HTML básico
    const bodyHtml = `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#14130f;max-width:520px;margin:0 auto;padding:32px 24px">
      ${bodyText.replace(/\n/g, '<br>')}
      <hr style="border:none;border-top:1px solid #e5e3de;margin:32px 0">
      <p style="font-size:12px;color:#9b9890">Este mensaje fue enviado por Follow · Gestión de citas automática</p>
    </div>`;

    // Enviar via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: client.email,
        subject,
        html: bodyHtml,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      await sb.from('messages').insert({
        appointment_id,
        professional_id: prof.id,
        client_id: client.id,
        channel: 'email',
        type,
        body: bodyText,
        status: 'failed',
        sent_at: new Date().toISOString(),
      });
      return json({ error: resendData.message || 'Error al enviar email', resend: resendData }, 502);
    }

    await sb.from('messages').insert({
      appointment_id,
      professional_id: prof.id,
      client_id: client.id,
      channel: 'email',
      type,
      body: bodyText,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    return json({ success: true, email_id: resendData.id, to: client.email, type });

  } catch (err) {
    console.error('Error en send-email:', err);
    return json({ error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
