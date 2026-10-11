import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { file_url, file_name, json_schema } = await req.json();
    if (!file_url) throw new Error('file_url is required');

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) throw new Error('Could not download uploaded file');
    const bytes = new Uint8Array(await fileResponse.arrayBuffer());
    const mime = fileResponse.headers.get('content-type') || 'application/octet-stream';

    // The OpenAI Files API can receive the uploaded document. The model is then
    // asked to return the structured schema required by the existing import screen.
    const form = new FormData();
    form.append('purpose', 'user_data');
    form.append('file', new Blob([bytes], { type: mime }), file_name || 'upload');
    const upload = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const uploaded = await upload.json();
    if (!upload.ok) throw new Error(uploaded?.error?.message || 'File upload to AI provider failed');

    const prompt = `Extract loan records from this uploaded file. Return only JSON matching this schema: ${JSON.stringify(json_schema || { type: 'object' })}. Do not invent records.`;
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') || 'gpt-5-mini',
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_file', file_id: uploaded.id }] }],
        text: { format: { type: 'json_schema', name: 'veritas_import', strict: true, schema: json_schema || { type: 'object' } } },
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error?.message || 'File extraction failed');
    return new Response(JSON.stringify({ output: JSON.parse(result.output_text) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
