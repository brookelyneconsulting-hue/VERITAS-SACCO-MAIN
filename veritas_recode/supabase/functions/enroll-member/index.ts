import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const institutionPrefix = (name: string) => {
  const letters = String(name || '').replace(/[^A-Za-z]/g, '').toUpperCase();
  return (letters.slice(0, 3) || 'MEM').padEnd(3, 'X');
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) throw new Error('Authentication required');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = auth.replace('Bearer ', '');
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) throw new Error('Authentication required');

    const form = await req.json();
    const { full_name, email, phone, id_number, institution_id } = form;
    if (!full_name || !email || !id_number || !institution_id) throw new Error('Full name, email, ID number and institution are required');

    const { data: institution, error: institutionError } = await admin.from('institutions').select('id,name,status').eq('id', institution_id).eq('status','approved').single();
    if (institutionError || !institution) throw new Error('Selected institution is not available');

    const { data: members, error: membersError } = await admin.from('members').select('member_number').eq('institution_id', institution_id);
    if (membersError) throw membersError;
    const prefix = institutionPrefix(institution.name);
    const used = new Set((members || []).map((m) => String(m.member_number || '').toUpperCase()));
    let n = 1;
    while (used.has(`${prefix}${String(n).padStart(3,'0')}`)) n++;
    const memberNumber = `${prefix}${String(n).padStart(3,'0')}`;

    const { data: member, error: memberError } = await admin.from('members').insert({
      full_name, member_number: memberNumber, email, phone: phone || '', id_number,
      institution_id, status: 'inactive', subscription_status: 'pending', joined_date: new Date().toISOString().slice(0,10),
    }).select('*').single();
    if (memberError) throw memberError;

    await admin.from('profiles').upsert({
      id: user.id, email: user.email, full_name, role: 'member', member_id: member.id,
      institution_id, institution_name: institution.name, account_status: 'pending',
    }, { onConflict: 'id' });

    return new Response(JSON.stringify({ member, member_number: memberNumber }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
