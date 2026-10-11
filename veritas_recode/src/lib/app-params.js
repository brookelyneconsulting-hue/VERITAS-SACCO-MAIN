// Base44 URL/token parameters are intentionally removed.
// Runtime configuration now comes from Vite environment variables and Supabase Auth.
export const appParams = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
};
