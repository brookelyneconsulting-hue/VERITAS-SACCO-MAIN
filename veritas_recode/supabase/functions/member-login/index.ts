import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { member_number, id_number } = await req.json();
    if (!member_number || !id_number) throw new Error('Member number and ID number are required');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: member, error: memberError } = await admin.from('members').select('*').eq('member_number', member_number.trim()).maybeSingle();
    if (memberError) throw memberError;
    if (!member) throw new Error('Member not found');
    if (String(member.id_number || '').trim().toLowerCase() !== String(id_number).trim().toLowerCase()) throw new Error('ID number does not match our records');
    const secret = Deno.env.get('MEMBER_AUTH_SECRET');
    if (!secret) throw new Error('MEMBER_AUTH_SECRET is not configured');
    const syntheticEmail = `member-${await sha256(`${member.id}:${member.member_number}`)}@members.veritas.local`;
    const password = await sha256(`${member.member_number}:${member.id_number}:${secret}`);
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    let authUser = existing.users.find((u) => u.email === syntheticEmail);
    if (!authUser) {
      const { data, error } = await admin.auth.admin.createUser({ email: syntheticEmail, password, email_confirm: true, user_metadata: { full_name: member.full_name } });
      if (error) throw error;
      authUser = data.user;
    } else {
      const { error } = await admin.auth.admin.updateUserById(authUser.id, { password });
      if (error) throw error;
    }
    await admin.from('profiles').upsert({ id: authUser.id, email: syntheticEmail, full_name: member.full_name, role: 'member', institution_id: member.institution_id, member_id: member.id, account_status: 'approved' }, { onConflict: 'id' });
    return new Response(JSON.stringify({ email: syntheticEmail, password, member }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
