// Edge Function: stripe-webhook
// Recibe eventos de Stripe y actualiza el plan del profesional en Supabase.
// Eventos: checkout.session.completed, customer.subscription.deleted

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PLAN_MAP: Record<string, string> = {
  [Deno.env.get('STRIPE_PRICE_BASICO') || '']:      'basico',
  [Deno.env.get('STRIPE_PRICE_PRO') || '']:         'pro',
  [Deno.env.get('STRIPE_PRICE_PROFESIONAL') || '']: 'profesional',
};

Deno.serve(async (req) => {
  try {
    const body = await req.text();
    const sig  = req.headers.get('stripe-signature') || '';
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    // Verificar firma de Stripe si está configurado el secret
    if (webhookSecret && sig) {
      const valid = await verifyStripeSignature(body, sig, webhookSecret);
      if (!valid) {
        console.warn('Firma de Stripe inválida');
        return new Response('Unauthorized', { status: 401 });
      }
    }

    const event = JSON.parse(body);
    console.log(`Evento Stripe: ${event.type}`);

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const professionalId = session.subscription_data?.metadata?.professional_id
        || session.metadata?.professional_id;
      const plan = session.subscription_data?.metadata?.plan
        || session.metadata?.plan;

      if (professionalId) {
        await sb.from('professionals').update({
          plan: plan || 'basico',
          plan_status: 'active',
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          trial_ends_at: null,
        }).eq('id', professionalId);
        console.log(`Plan activado para profesional ${professionalId}: ${plan}`);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const { data: prof } = await sb
        .from('professionals')
        .select('id')
        .eq('stripe_subscription_id', sub.id)
        .single();

      if (prof) {
        await sb.from('professionals').update({ plan_status: 'cancelled' }).eq('id', prof.id);
        console.log(`Suscripción cancelada para profesional ${prof.id}`);
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const { data: prof } = await sb
        .from('professionals')
        .select('id')
        .eq('stripe_customer_id', invoice.customer)
        .single();

      if (prof) {
        await sb.from('professionals').update({ plan_status: 'past_due' }).eq('id', prof.id);
        console.log(`Pago fallido para profesional ${prof.id}`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Error en stripe-webhook:', err);
    return new Response(String(err), { status: 500 });
  }
});

async function verifyStripeSignature(payload: string, sig: string, secret: string): Promise<boolean> {
  try {
    const parts = Object.fromEntries(sig.split(',').map(p => p.split('=')));
    const timestamp = parts['t'];
    const signature = parts['v1'];
    const toSign = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const computed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign));
    const hex = Array.from(new Uint8Array(computed)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hex === signature;
  } catch {
    return false;
  }
}
