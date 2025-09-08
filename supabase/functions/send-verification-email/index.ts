// Supabase Edge Function für Email-Versand mit Resend
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, verificationToken } = await req.json()

    console.log('📧 Sending verification email to:', email)
    console.log('🔑 Token:', verificationToken)

    // Validate input
    if (!email || !verificationToken) {
      return new Response(
        JSON.stringify({ error: 'Email and verification token required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get Resend API key from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('❌ RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create verification URL
    const baseUrl = Deno.env.get('SITE_URL') || 'http://localhost:3000'
    const verificationUrl = `${baseUrl}/verify.html?token=${verificationToken}`

    // Email HTML template
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ClubJoin - Email bestätigen</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #2D2D2D;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #dc474b 0%, #b8383b 100%);
          padding: 50px 20px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .header::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
          background-size: 30px 30px;
          animation: floating 20s linear infinite;
        }
        @keyframes floating {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .logo {
          position: relative;
          z-index: 2;
          margin-bottom: 20px;
        }
        .logo svg {
          height: 60px;
          width: auto;
        }
        .logo svg path {
          fill: white;
        }
        .header h1 {
          position: relative;
          z-index: 2;
          margin: 0;
          font-size: 32px;
          font-weight: 700;
          color: white;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .content {
          padding: 50px 30px;
          text-align: center;
        }
        .icon {
          font-size: 80px;
          margin-bottom: 30px;
          background: linear-gradient(135deg, #dc474b, #ff6b6f);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 2px 4px rgba(220, 71, 75, 0.3));
        }
        h2 {
          color: #1A1A1A;
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 20px;
          line-height: 1.3;
        }
        .subtitle {
          color: #666666;
          font-size: 18px;
          margin-bottom: 40px;
          line-height: 1.6;
          font-weight: 400;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #dc474b 0%, #b8383b 100%);
          color: white;
          padding: 18px 40px;
          text-decoration: none;
          border-radius: 50px;
          font-weight: 600;
          font-size: 18px;
          margin: 30px 0;
          box-shadow: 0 8px 25px rgba(220, 71, 75, 0.4);
          transition: all 0.3s ease;
          border: none;
        }
        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 35px rgba(220, 71, 75, 0.5);
        }
        .security-note {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border: 1px solid #bae6fd;
          border-radius: 12px;
          padding: 20px;
          margin: 40px 0;
          font-size: 15px;
          color: #0c4a6e;
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.1);
        }
        .security-note strong {
          color: #0369a1;
        }
        .fallback-link {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e9ecef;
        }
        .fallback-link p {
          font-size: 14px;
          color: #999;
          margin-bottom: 10px;
        }
        .fallback-link a {
          color: #dc474b;
          word-break: break-all;
          font-weight: 500;
        }
        .footer {
          background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
          padding: 30px 20px;
          text-align: center;
          color: white;
        }
        .footer p {
          margin: 0;
          font-size: 14px;
          color: #cccccc;
          line-height: 1.6;
        }
        .footer .brand {
          font-weight: 600;
          color: white;
          margin-bottom: 5px;
        }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .container {
            background: #1a1a1a;
          }
          h2 {
            color: #ffffff;
          }
          .subtitle {
            color: #cccccc;
          }
        }
        
        /* Mobile responsiveness */
        @media (max-width: 480px) {
          body {
            padding: 10px;
          }
          .header {
            padding: 40px 15px;
          }
          .header h1 {
            font-size: 24px;
          }
          .content {
            padding: 30px 20px;
          }
          h2 {
            font-size: 24px;
          }
          .cta-button {
            padding: 16px 30px;
            font-size: 16px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">
            <svg width="320" height="94" viewBox="0 0 320 94" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M26.4442 74.7199C34.9042 74.7199 42.8242 70.5799 47.5942 63.6499L36.4342 55.9999C34.1842 59.2399 30.4942 61.2199 26.4442 61.2199C19.7842 61.2199 14.2942 55.8199 14.2942 49.0699C14.2942 42.4099 19.7842 36.9199 26.4442 36.9199C30.4042 36.9199 34.0942 38.8999 36.4342 42.1399L47.4142 34.3099C45.0742 31.0699 42.0142 28.2799 38.4142 26.3899C34.8142 24.4999 30.5842 23.4199 26.4442 23.4199C23.0242 23.4199 19.6042 24.1399 16.4542 25.4899C13.3942 26.7499 10.6942 28.6399 8.26421 30.9799C5.92421 33.3199 4.12421 36.1099 2.77421 39.0799C1.51421 42.3199 0.794189 45.6499 0.794189 49.0699C0.794189 52.5799 1.51421 55.9099 2.77421 59.0599C4.12421 62.1199 5.92421 64.9099 8.26421 67.2499C10.6942 69.5899 13.3942 71.4799 16.4542 72.7399C19.6042 74.0899 23.0242 74.7199 26.4442 74.7199Z" fill="white"/>
              <path d="M50.9678 6.0503V74.0903H64.5578V1.55029L50.9678 6.0503Z" fill="white"/>
              <path d="M93.8204 74.63C99.7604 74.63 105.43 72.29 109.66 68.06C113.98 63.83 116.32 58.16 116.32 52.13V23.96H102.82V52.13C102.82 57.17 98.7704 61.13 93.8204 61.13C88.7804 61.13 84.8204 57.17 84.8204 52.13V23.96H71.3204V52.13C71.3204 58.16 73.6604 63.83 77.8904 68.06C82.1204 72.29 87.7904 74.63 93.8204 74.63Z" fill="white"/>
              <path d="M174.055 48.9801C174.055 45.5601 173.425 42.1401 172.075 38.9901C170.725 35.9301 168.925 33.2301 166.585 30.8901C164.245 28.4601 161.455 26.6601 158.395 25.4001C155.245 24.0501 151.915 23.3301 148.405 23.3301C144.985 23.3301 141.565 24.0501 138.415 25.4001C137.695 25.6701 136.975 26.0301 136.255 26.3901V0.830078L122.755 5.33008V48.9801C122.755 52.4901 123.475 55.8201 124.735 58.9701C126.085 62.0301 127.885 64.8201 130.225 67.1601C132.655 69.5001 135.355 71.3901 138.415 72.6501C141.565 74.0001 144.985 74.6301 148.405 74.6301C151.825 74.6301 155.245 74.0001 158.395 72.6501C161.455 71.3001 164.155 69.5001 166.585 67.1601C168.925 64.8201 170.725 62.0301 172.075 58.9701C173.425 55.8201 174.055 52.4901 174.055 48.9801ZM160.555 48.9801C160.555 55.7301 155.065 61.1301 148.405 61.1301C141.745 61.1301 136.255 55.7301 136.255 48.9801C136.255 42.3201 141.745 36.8301 148.405 36.8301C155.065 36.8301 160.555 42.3201 160.555 48.9801Z" fill="white"/>
              <path d="M166.251 79.67V93.17C173.001 93.17 179.391 90.56 184.161 85.7C188.931 80.93 191.541 74.63 191.541 67.79V22.52L178.041 27.02V67.79C178.041 74.36 172.731 79.67 166.251 79.67Z" fill="white"/>
              <path d="M221.476 74.6301C224.896 74.6301 228.226 74.0001 231.466 72.6501C234.526 71.3901 237.226 69.5001 239.566 67.1601C241.906 64.8201 243.796 62.0301 245.056 58.9701C246.406 55.8201 247.126 52.4901 247.126 48.9801C247.126 45.5601 246.406 42.2301 245.056 38.9901C243.796 35.9301 241.906 33.2301 239.566 30.8901C237.226 28.5501 234.436 26.6601 231.466 25.4001C228.226 24.0501 224.896 23.3301 221.476 23.3301C217.966 23.3301 214.636 24.0501 211.486 25.4001C208.426 26.6601 205.636 28.5501 203.296 30.8901C200.956 33.2301 199.066 36.0201 197.806 38.9901C196.456 42.2301 195.826 45.5601 195.826 48.9801C195.826 52.4901 196.456 55.8201 197.806 58.9701C199.066 62.0301 200.956 64.8201 203.296 67.1601C205.636 69.5001 208.426 71.3901 211.486 72.6501C214.636 74.0001 217.966 74.6301 221.476 74.6301ZM221.476 36.8301C228.136 36.8301 233.626 42.3201 233.626 48.9801C233.626 55.7301 228.136 61.1301 221.476 61.1301C214.726 61.1301 209.326 55.7301 209.326 48.9801C209.326 42.3201 214.726 36.8301 221.476 36.8301Z" fill="white"/>
              <path d="M252.413 26.6602V74.0902H266.003V22.1602L252.413 26.6602Z" fill="white"/>
              <path d="M312.546 31.4299C308.316 27.1099 302.556 24.7699 296.526 24.7699C293.376 24.7699 290.226 25.3999 287.436 26.6599V23.4199H273.936V45.4699C273.846 46.0999 273.846 46.8199 273.846 47.4499H273.936V74.0899H287.436V46.1899C288.066 41.6899 291.936 38.2699 296.526 38.2699C301.566 38.2699 305.706 42.4099 305.706 47.4499V74.0899H319.206V47.4499C319.206 41.4199 316.866 35.7499 312.546 31.4299Z" fill="white"/>
            </svg>
          </div>
          <h1>Willkommen bei ClubJoin!</h1>
        </div>
        <div class="content">
          <div class="icon">📧</div>
          <h2>Fast geschafft!</h2>
          <p class="subtitle">
            Vielen Dank für dein Interesse am ClubJoin Early Access.<br>
            <strong>Nur noch ein Klick fehlt:</strong> Bestätige deine E-Mail-Adresse, um dabei zu sein.
          </p>
          
          <a href="${verificationUrl}" class="cta-button">
            ✅ E-Mail-Adresse bestätigen
          </a>
          
          <div class="security-note">
            <strong>🛡️ Sicherheitshinweis:</strong><br>
            Dieser Link ist einmalig verwendbar und läuft nach 24 Stunden ab.
            Falls du dich nicht angemeldet hast, ignoriere diese E-Mail einfach.
          </div>
          
          <div class="fallback-link">
            <p><strong>Button funktioniert nicht?</strong></p>
            <p>Kopiere diesen Link in deinen Browser:</p>
            <a href="${verificationUrl}">${verificationUrl}</a>
          </div>
        </div>
        <div class="footer">
          <p class="brand">ClubJoin</p>
          <p>Die digitale Zukunft für Vereine<br>
          Diese E-Mail wurde automatisch versendet.</p>
        </div>
      </div>
    </body>
    </html>`

    // Plain text version
    const textVersion = `
ClubJoin - E-Mail bestätigen

Willkommen bei ClubJoin!

Vielen Dank für dein Interesse am ClubJoin Early Access. 
Bitte bestätige deine E-Mail-Adresse, um deine Anmeldung zu vervollständigen.

Klicke auf diesen Link oder kopiere ihn in deinen Browser:
${verificationUrl}

🛡️ Sicherheitshinweis:
Dieser Link ist einmalig verwendbar und läuft nach 24 Stunden ab.
Falls du dich nicht angemeldet hast, ignoriere diese E-Mail.

---
ClubJoin - Die digitale Zukunft für Vereine
Diese E-Mail wurde automatisch versendet.
    `

    // Send email via Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ClubJoin <noreply@clubjoin.io>',
        to: [email],
        subject: 'ClubJoin Early Access - E-Mail bestätigen 📧',
        html: htmlTemplate,
        text: textVersion,
        tags: [
          { name: 'category', value: 'verification' },
          { name: 'environment', value: Deno.env.get('ENVIRONMENT') || 'development' }
        ]
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('❌ Resend API error:', resendData)
      return new Response(
        JSON.stringify({
          error: 'Failed to send email',
          details: resendData
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ Email sent successfully:', resendData.id)

    return new Response(
      JSON.stringify({
        success: true,
        messageId: resendData.id,
        message: 'Verification email sent successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Function error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})