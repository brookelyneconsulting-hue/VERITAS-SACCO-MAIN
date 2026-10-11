import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { to, subject, body, from_name } = await req.json();
    if (!to || !subject || !body) throw new Error('to, subject and body are required');

    const apiKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('MAIL_FROM') || 'Veritas SACCO <noreply@example.com>';
    if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: from_name ? `${from_name} <${from}>` : from,
        to: [to],
        subject,
        text: body,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Email provider rejected the message');
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
