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
    const { to, message, templateName } = await req.json();
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get WhatsApp configuration
    const { data: settings } = await supabaseAdmin
      .from('superadmin_settings')
      .select('whatsapp_sender_number, whatsapp_api_url, whatsapp_waba_id')
      .eq('id', 1)
      .single();

    if (!settings?.whatsapp_sender_number || !settings?.whatsapp_api_url) {
      throw new Error('WhatsApp not configured');
    }

    const apiKey = Deno.env.get('YCLOUD_API_KEY');
    if (!apiKey) {
      throw new Error('YCloud API key not configured');
    }

    // Send message via YCloud API
    const response = await fetch(`${settings.whatsapp_api_url}/whatsapp/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        from: settings.whatsapp_sender_number,
        to: to.replace(/\D/g, ''), // Remove non-digits
        type: 'text',
        text: {
          body: message
        }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`YCloud API error: ${result.message || 'Unknown error'}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: result.id,
        message: 'WhatsApp message sent successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('WhatsApp sending error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});