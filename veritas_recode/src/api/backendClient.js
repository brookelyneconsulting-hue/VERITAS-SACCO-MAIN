import { supabase } from '@/lib/supabaseClient';

// This adapter deliberately exposes the same small data-access shape used by
// the existing React application, but it contains NO Base44 SDK dependency.
// It is the migration seam between the existing business logic and Supabase.

const tableName = (entity) => {
  if (entity === 'User') return 'profiles';
  return entity
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase() + 's';
};

const normalizeOrder = (order) => {
  if (!order) return { column: 'created_date', ascending: false };
  const raw = Array.isArray(order) ? order[0] : order;
  const value = String(raw);
  return value.startsWith('-')
    ? { column: value.slice(1), ascending: false }
    : { column: value, ascending: true };
};

const throwIfError = (error) => {
  if (error) throw error;
};

const makeEntity = (entity) => {
  const table = tableName(entity);

  return {
    async list(order = '-created_date', limit) {
      const sort = normalizeOrder(order);
      let query = supabase.from(table).select('*').order(sort.column, { ascending: sort.ascending });
      if (limit != null) query = query.limit(limit);
      const { data, error } = await query;
      throwIfError(error);
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      throwIfError(error);
      return data;
    },

    async filter(filters = {}, order = '-created_date', limit) {
      const sort = normalizeOrder(order);
      let query = supabase.from(table).select('*');
      for (const [key, value] of Object.entries(filters || {})) {
        if (value === null) query = query.is(key, null);
        else if (Array.isArray(value)) query = query.in(key, value);
        else query = query.eq(key, value);
      }
      query = query.order(sort.column, { ascending: sort.ascending });
      if (limit != null) query = query.limit(limit);
      const { data, error } = await query;
      throwIfError(error);
      return data || [];
    },

    async create(record) {
      const payload = { ...(record || {}) };
      const { data, error } = await supabase.from(table).insert(payload).select('*').single();
      throwIfError(error);
      return data;
    },

    async bulkCreate(records) {
      if (!records?.length) return [];
      const { data, error } = await supabase.from(table).insert(records).select('*');
      throwIfError(error);
      return data || [];
    },

    async update(id, patch) {
      const { data, error } = await supabase
        .from(table)
        .update({ ...(patch || {}), updated_date: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      throwIfError(error);
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      throwIfError(error);
      return true;
    },

    async deleteMany(filters = {}) {
      let query = supabase.from(table).delete();
      for (const [key, value] of Object.entries(filters || {})) {
        if (Array.isArray(value)) query = query.in(key, value);
        else if (value === null) query = query.is(key, null);
        else query = query.eq(key, value);
      }
      const { error } = await query;
      throwIfError(error);
      return true;
    },

    subscribe(callback) {
      const channel = supabase
        .channel(`realtime:${table}:${crypto.randomUUID()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => callback?.(payload),
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    },
  };
};

const entityNames = [
  'AuditLog', 'BankDeposit', 'BankWithdrawal', 'ChartOfAccount',
  'DividendDeclaration', 'DividendPayment', 'Institution', 'InstitutionSetting',
  'JournalEntry', 'Loan', 'LoanApplication', 'LoanPayment', 'Member',
  'MemberAccount', 'MemberMessage', 'MemberPayment', 'Repayment', 'Share',
  'ShareSchedule', 'ShareTransaction', 'User',
];

const entities = Object.fromEntries(entityNames.map((name) => [name, makeEntity(name)]));

const auth = {
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw error || new Error('Not authenticated');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    return {
      id: user.id,
      email: user.email,
      full_name: profile?.full_name || user.user_metadata?.full_name || '',
      ...profile,
    };
  },

  async register({ email, password, options = {} }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: options.data || {},
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    throwIfError(error);
    return data;
  },

  async verifyOtp({ email, otpCode }) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'email',
    });
    throwIfError(error);
    return { ...data, access_token: data.session?.access_token };
  },

  async resendOtp(email) {
    const { data, error } = await supabase.auth.resend({ type: 'signup', email });
    throwIfError(error);
    return data;
  },

  async setToken() {
    // Supabase owns the session token and persists it automatically.
    return true;
  },

  async updateMe(patch) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    throwIfError(userError);
    if (!user) throw new Error('Not authenticated');

    const profilePatch = { ...(patch || {}), updated_date: new Date().toISOString() };
    const authMetadata = {};
    if ('full_name' in profilePatch) authMetadata.full_name = profilePatch.full_name;

    if (Object.keys(authMetadata).length) {
      const { error } = await supabase.auth.updateUser({ data: authMetadata });
      throwIfError(error);
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, email: user.email, ...profilePatch }, { onConflict: 'id' })
      .select('*')
      .single();
    throwIfError(error);
    return data;
  },

  async changePassword({ currentPassword, newPassword }) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    throwIfError(userError);
    if (!user?.email) throw new Error('No authenticated email account');

    if (currentPassword) {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      throwIfError(verifyError);
    }

    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    throwIfError(error);
    return data;
  },

  async resetPasswordRequest(email) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    throwIfError(error);
    return data;
  },

  async resetPassword({ newPassword }) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    throwIfError(error);
    return data;
  },

  async loginViaEmailPassword(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    throwIfError(error);
    return data;
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    throwIfError(error);
  },



  async enrollMember(payload) {
    const { data, error } = await supabase.functions.invoke('enroll-member', { body: payload });
    throwIfError(error);
    return data;
  },

  async publicInstitutions() {
    const { data, error } = await supabase.functions.invoke('public-institutions', { body: {} });
    throwIfError(error);
    return data || [];
  },

  async memberLookup(member_number) {
    const { data, error } = await supabase.functions.invoke('member-lookup', { body: { member_number } });
    throwIfError(error);
    return data;
  },

  async memberLogin(member_number, id_number) {
    const { data, error } = await supabase.functions.invoke('member-login', {
      body: { member_number, id_number },
    });
    throwIfError(error);
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    throwIfError(sessionError);
    return { ...data.member, session: sessionData.session };
  },

  redirectToLogin(returnTo = window.location.href) {
    const path = `/login?returnTo=${encodeURIComponent(returnTo)}`;
    window.location.assign(path);
  },
};

const users = {
  async inviteUser(email, role = 'member') {
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email, role },
    });
    throwIfError(error);
    return data;
  },
};

const integrations = {
  Core: {
    async SendEmail(payload) {
      const { data, error } = await supabase.functions.invoke('send-email', { body: payload });
      throwIfError(error);
      return data;
    },

    async UploadFile({ file }) {
      if (!file) throw new Error('A file is required');
      const safeName = String(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to upload a file');
      const path = `uploads/${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage.from('documents').upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      throwIfError(error);
      const { data, error: signedUrlError } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
      throwIfError(signedUrlError);
      return { file_url: data.signedUrl, path };
    },

    async ExtractDataFromUploadedFile({ file_url, file_name, json_schema }) {
      const { data, error } = await supabase.functions.invoke('extract-uploaded-file', {
        body: { file_url, file_name, json_schema },
      });
      throwIfError(error);
      return data;
    },

    async InvokeLLM(payload) {
      const { data, error } = await supabase.functions.invoke('invoke-llm', { body: payload });
      throwIfError(error);
      return data;
    },
  },
};

export const backend = { entities, auth, users, integrations };
export { supabase };
