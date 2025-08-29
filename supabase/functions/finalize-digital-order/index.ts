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
    const { orderId, providerTransactionId, paymentProvider } = await req.json();
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get order details
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*, store:store_id(name, user_id)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    // Update order status to paid and delivered for digital products
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'delivered',
        provider_transaction_id: providerTransactionId,
        payment_provider: paymentProvider,
        paid_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      throw updateError;
    }

    // Create user account if customer doesn't exist
    try {
      await supabaseAdmin.functions.invoke('create-user-account-from-order', {
        body: {
          customerEmail: order.customer.email,
          customerName: order.customer.name,
          orderId: orderId
        }
      });
    } catch (accountError) {
      console.warn('Failed to create user account:', accountError);
    }

    // Process payment and update ledgers
    const { error: paymentError } = await supabaseAdmin.rpc('finalize_order_payment', {
      p_order_id: orderId,
      p_provider_tx_id: providerTransactionId,
      p_payment_provider: paymentProvider
    });

    if (paymentError) {
      console.error('Payment processing error:', paymentError);
    }

    // Send digital product access email
    try {
      await supabaseAdmin.functions.invoke('send-digital-product-email', {
        body: { orderId }
      });
    } catch (emailError) {
      console.warn('Failed to send digital product email:', emailError);
    }

    // Create notification for seller
    await supabaseAdmin.rpc('create_notification', {
      p_user_id: order.store.user_id,
      p_title: 'Vente digitale confirmée ! 💰',
      p_message: `Paiement de ${order.total} ${order.currency} reçu pour votre produit digital.`,
      p_link: '/orders'
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Digital order finalized successfully',
        orderId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error finalizing digital order:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});