import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authentication required');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) throw new Error('Authentication required');

    const { data: caller } = await admin.from('profiles').select('*').eq('id', user.id).single();
    if (!caller || !(caller.is_platform_admin || caller.role === 'admin' || caller.role === 'institution_admin')) {
      throw new Error('Not authorized to invite users');
    }

    const { email, role } = await req.json();
    if (!email) throw new Error('Email is required');
    const allowed = ['institution_admin', 'accountant', 'front_office', 'member'];
    if (!allowed.includes(role)) throw new Error('Invalid role');

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: '', role },
      redirectTo: `${req.headers.get('origin') || Deno.env.get('SITE_URL') || ''}/login`,
    });
    if (inviteError) throw inviteError;

    await admin.from('profiles').update({
      role,
      institution_id: caller.institution_id,
      institution_name: caller.institution_name,
      account_status: 'approved',
    }).eq('id', invited.user.id);

    return new Response(JSON.stringify({ user_id: invited.user.id, email }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
