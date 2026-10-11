import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
    const { prompt, response_json_schema } = await req.json();
    if (!prompt) throw new Error('prompt is required');

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') || 'gpt-5-mini',
        input: prompt,
        ...(response_json_schema ? {
          text: { format: { type: 'json_schema', name: 'veritas_result', strict: true, schema: response_json_schema } },
        } : {}),
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'AI request failed');

    let output = data.output_text;
    if (response_json_schema) {
      try { output = JSON.parse(output); } catch { /* leave raw output */ }
    }
    return new Response(JSON.stringify(output && typeof output === 'object' ? output : { output }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
