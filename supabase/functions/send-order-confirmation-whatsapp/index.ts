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
    const { orderId, recipientType } = await req.json(); // recipientType: 'customer' | 'seller' | 'partner'
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get order and store details
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*, store:store_id(name, user_id, settings)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    // Get WhatsApp settings
    const { data: whatsappSettings } = await supabaseAdmin
      .from('superadmin_settings')
      .select('whatsapp_sender_number, whatsapp_template_seller, whatsapp_template_customer')
      .eq('id', 1)
      .single();

    if (!whatsappSettings?.whatsapp_sender_number) {
      throw new Error('WhatsApp not configured');
    }

    let recipientNumber = '';
    let message = '';

    if (recipientType === 'customer') {
      recipientNumber = order.customer.phone;
      message = `Bonjour ${order.customer.name}, votre commande #${orderId.substring(0, 8)} sur ${order.store.name} a été confirmée. Montant: ${order.total} ${order.currency}. Merci !`;
    } else if (recipientType === 'seller') {
      // Get seller's WhatsApp from store settings or profile
      const storeWhatsApp = order.store.settings?.whatsapp_number;
      if (storeWhatsApp) {
        recipientNumber = storeWhatsApp;
        message = `Nouvelle commande ! Client: ${order.customer.name}, Montant: ${order.total} ${order.currency}. Consultez votre tableau de bord: https://payliv.shop/orders`;
      }
    }

    if (!recipientNumber) {
      return new Response(
        JSON.stringify({ message: 'No recipient number configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send WhatsApp message via YCloud
    const { error: whatsappError } = await supabaseAdmin.functions.invoke('send-whatsapp-message', {
      body: {
        to: recipientNumber,
        message: message
      }
    });

    if (whatsappError) {
      console.error('WhatsApp sending failed:', whatsappError);
      throw whatsappError;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'WhatsApp notification sent' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending WhatsApp notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});