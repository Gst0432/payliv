import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const webhookData = await req.json();
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Log webhook for debugging
    await supabaseAdmin.from('webhook_logs').insert({
      provider: 'apiweb',
      payload: webhookData,
      status: 'received'
    });

    // Extract order information from webhook
    const orderId = webhookData.personal_Info?.[0]?.orderId;
    const paymentStatus = webhookData.statut;
    const transactionId = webhookData.transaction_id;

    if (!orderId) {
      throw new Error('Order ID not found in webhook data');
    }

    if (paymentStatus === 'paid') {
      // Get order to check if it's digital
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('has_digital, customer')
        .eq('id', orderId)
        .single();

      if (order?.has_digital) {
        // Finalize digital order
        await supabaseAdmin.functions.invoke('finalize-digital-order', {
          body: {
            orderId,
            providerTransactionId: transactionId,
            paymentProvider: 'apiweb'
          }
        });
      } else {
        // Update physical order status
        await supabaseAdmin.rpc('finalize_order_payment', {
          p_order_id: orderId,
          p_provider_tx_id: transactionId,
          p_payment_provider: 'apiweb'
        });
      }

      // Update webhook log status
      await supabaseAdmin.from('webhook_logs').update({
        status: 'processed',
        related_order_id: orderId
      }).eq('payload->transaction_id', transactionId);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Log error
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    await supabaseAdmin.from('webhook_logs').insert({
      provider: 'apiweb',
      payload: await req.json(),
      status: 'error',
      error_message: error.message
    });

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});