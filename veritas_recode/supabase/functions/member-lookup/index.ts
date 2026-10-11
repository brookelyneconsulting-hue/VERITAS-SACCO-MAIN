import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) throw new Error('Authentication required');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = auth.replace('Bearer ','');
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) throw new Error('Authentication required');
    const { data: me } = await admin.from('profiles').select('role,institution_id,member_id').eq('id', user.id).single();
    if (!me || me.role !== 'member') throw new Error('Member session required');
    const { member_number } = await req.json();
    const { data: member, error } = await admin.from('members').select('id,full_name,member_number,email,phone,id_number,institution_id,status').eq('member_number', member_number).eq('institution_id', me.institution_id).maybeSingle();
    if (error) throw error;
    if (!member) throw new Error('Member not found');
    return new Response(JSON.stringify(member), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
