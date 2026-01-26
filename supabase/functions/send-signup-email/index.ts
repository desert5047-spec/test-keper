// Supabase Edge Function: 新規登録完了メール送信
// この関数は、Database Triggerから呼び出されてメールを送信します

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@yourdomain.com';

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text: string;
}

serve(async (req) => {
  try {
    // CORS ヘッダー
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    // OPTIONS リクエストの処理
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // リクエストボディの取得
    const { to, subject, html, text }: EmailRequest = await req.json();

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Resend APIを使用してメール送信
    if (RESEND_API_KEY) {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [to],
          subject: subject,
          html: html,
          text: text,
        }),
      });

      if (!resendResponse.ok) {
        const error = await resendResponse.text();
        console.error('Resend API error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to send email via Resend' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const result = await resendResponse.json();
      return new Response(
        JSON.stringify({ success: true, messageId: result.id }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      // Resend APIキーが設定されていない場合、ログに記録
      console.log('Email would be sent:', { to, subject });
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'RESEND_API_KEY not configured. Email logged only.' 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
