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
    const { customerEmail, customerName, orderId } = await req.json();
    
    if (!customerEmail || !customerName || !orderId) {
      throw new Error('Missing required fields: customerEmail, customerName, orderId');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(customerEmail);
    
    if (existingUser.user) {
      return new Response(
        JSON.stringify({ 
          message: 'User already exists', 
          userId: existingUser.user.id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new user account
    const temporaryPassword = Math.random().toString(36).slice(-12) + 'A1!';
    
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: customerEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        name: customerName,
        created_from_order: orderId,
      }
    });

    if (createError) {
      throw createError;
    }

    // Send welcome email with access instructions
    const welcomeEmailHtml = `
      <h1>Bienvenue sur PayLiv !</h1>
      <p>Bonjour ${customerName},</p>
      <p>Merci pour votre achat ! Un compte a été créé automatiquement pour vous permettre d'accéder à vos produits digitaux.</p>
      <p><strong>Vos informations de connexion :</strong></p>
      <ul>
        <li>Email : ${customerEmail}</li>
        <li>Mot de passe temporaire : ${temporaryPassword}</li>
      </ul>
      <p>Vous pouvez vous connecter et changer votre mot de passe à l'adresse : <a href="https://payliv.shop/login">https://payliv.shop/login</a></p>
      <p>Accédez à vos achats : <a href="https://payliv.shop/my-purchases">https://payliv.shop/my-purchases</a></p>
      <p>L'équipe PayLiv</p>
    `;

    await supabaseAdmin.functions.invoke('send-transactional-email', {
      body: {
        to: customerEmail,
        subject: 'Votre compte PayLiv a été créé - Accédez à vos produits',
        html: welcomeEmailHtml
      }
    });

    return new Response(
      JSON.stringify({ 
        message: 'User account created successfully',
        userId: newUser.user.id,
        temporaryPassword 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating user account:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});