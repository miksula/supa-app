export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseKey:
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY,
  powersyncUrl: import.meta.env.VITE_POWERSYNC_URL,
  isOfflineMode: import.meta.env.VITE_OFFLINE_MODE === "true",
  isDevelopment: import.meta.env.DEV,
  localAuthEmail: import.meta.env.VITE_LOCAL_AUTH_EMAIL ?? "",
  localAuthPassword: import.meta.env.VITE_LOCAL_AUTH_PASSWORD ?? "",
  devEmail: import.meta.env.DEV ? (import.meta.env.VITE_DEV_EMAIL ?? "") : "",
  devPassword: import.meta.env.DEV ? (import.meta.env.VITE_DEV_PASSWORD ?? "") : "",
};
