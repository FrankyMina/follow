// Edge Function: create-checkout
// Crea una sesión de Stripe Checkout para suscripción mensual.
// POST body: { plan: 'basico'|'pro'|'profesional' }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRICE_IDS: Record<string, string> = {
  basico:       Deno.env.get('STRIPE_PRICE_BASICO')!,
  pro:          Deno.env.get('STRIPE_PRICE_PRO')!,
  profesional:  Deno.env.get('STRIPE_PRICE_PROFESIONAL')!,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return json({ error: 'Stripe no configurado' }, 500);

    // Verificar sesión del profesional
    const authHeader = req.headers.get('Authorization') || '';
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) return json({ error: 'No autorizado' }, 401);

    const { plan } = await req.json();
    const priceId = PRICE_IDS[plan?.toLowerCase()];
    if (!priceId) return json({ error: 'Plan inválido. Usa: basico, pro o profesional' }, 400);

    const successUrl = `https://follow-ruby.vercel.app/dashboard.html?payment=success`;
    const cancelUrl  = `https://follow-ruby.vercel.app/dashboard.html?payment=cancelled`;

    // Obtener o crear customer de Stripe
    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: prof } = await sbAdmin
      .from('professionals')
      .select('id, email, name, stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (!prof) return json({ error: 'Perfil de profesional no encontrado' }, 404);

    let customerId = prof.stripe_customer_id;

    if (!customerId) {
      // Crear customer en Stripe
      const custRes = await stripeRequest(stripeKey, 'POST', '/customers', {
        email: prof.email || user.email,
        name: prof.name,
        metadata: { professional_id: prof.id, supabase_user_id: user.id },
      });
      customerId = custRes.id;

      // Guardar customer_id en Supabase
      await sbAdmin.from('professionals').update({ stripe_customer_id: customerId }).eq('id', prof.id);
    }

    // Crear sesión de Checkout
    const session = await stripeRequest(stripeKey, 'POST', '/checkout/sessions', {
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: '1' }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: { professional_id: prof.id, plan },
      },
    });

    return json({ url: session.url });

  } catch (err) {
    console.error('Error en create-checkout:', err);
    return json({ error: String(err) }, 500);
  }
});

async function stripeRequest(key: string, method: string, path: string, params: Record<string, unknown>) {
  const body = new URLSearchParams();
  flattenParams(params, '', body);
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
  return data;
}

function flattenParams(obj: unknown, prefix: string, result: URLSearchParams) {
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => flattenParams(item, `${prefix}[${i}]`, result));
  } else if (obj !== null && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flattenParams(v, prefix ? `${prefix}[${k}]` : k, result);
    }
  } else if (obj !== undefined && obj !== null) {
    result.append(prefix, String(obj));
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
