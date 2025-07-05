import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Container } from "typedi";
import { IDatabase } from "../types/database.types";
import { databaseConfig } from "./database";
import { env } from "./env";

// Singleton pattern for consistent client usage
let supabaseInstance: SupabaseClient<IDatabase> | null = null;

// Create typed Supabase client for enhanced type safety
function createSupabaseClient(): SupabaseClient<IDatabase> {
  const { url, serviceKey, anonKey } = databaseConfig;
  const key = serviceKey || anonKey;

  if (
    !url ||
    !key ||
    url.includes("your_supabase_url_here") ||
    key.includes("your_supabase")
  ) {
    console.warn(
      "⚠️  Supabase configuration not found or using placeholder values. Creating mock client for development."
    );

    // Create a mock client for development when Supabase is not configured
    return {
      from: () => ({
        select: () => ({
          limit: () =>
            Promise.resolve({
              data: null,
              error: {
                code: "SUPABASE_NOT_CONFIGURED",
                message: "Supabase not configured",
              },
            }),
          single: () =>
            Promise.resolve({
              data: null,
              error: {
                code: "SUPABASE_NOT_CONFIGURED",
                message: "Supabase not configured",
              },
            }),
        }),
      }),
    } as unknown as SupabaseClient<IDatabase>;
  }

  return createClient<IDatabase>(url, key, {
    auth: databaseConfig.options.auth,
    global: databaseConfig.options.global,
  });
}

// Get singleton Supabase client
export function getSupabaseClient(): SupabaseClient<IDatabase> {
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient();
  }
  return supabaseInstance;
}

// Export the singleton instance
export const supabase = getSupabaseClient();

// Authentication-specific client with proper config
export const supabaseAuth = ((): SupabaseClient => {
  if (
    !env.SUPABASE_URL ||
    !env.SUPABASE_ANON_KEY ||
    env.SUPABASE_URL.includes("your_supabase_url_here") ||
    env.SUPABASE_ANON_KEY.includes("your_supabase")
  ) {
    return {
      auth: {
        signUp: () =>
          Promise.resolve({
            data: null,
            error: { message: "Supabase not configured" },
          }),
        signInWithPassword: () =>
          Promise.resolve({
            data: null,
            error: { message: "Supabase not configured" },
          }),
        signOut: () => Promise.resolve({ error: null }),
        getUser: () =>
          Promise.resolve({
            data: { user: null },
            error: { message: "Supabase not configured" },
          }),
        refreshSession: () =>
          Promise.resolve({
            data: { session: null },
            error: { message: "Supabase not configured" },
          }),
        setSession: () =>
          Promise.resolve({
            data: { session: null },
            error: { message: "Supabase not configured" },
          }),
        resetPasswordForEmail: () =>
          Promise.resolve({
            data: {},
            error: { message: "Supabase not configured" },
          }),
        updateUser: () =>
          Promise.resolve({
            data: { user: null },
            error: { message: "Supabase not configured" },
          }),
        verifyOtp: () =>
          Promise.resolve({
            data: { user: null },
            error: { message: "Supabase not configured" },
          }),
        resend: () =>
          Promise.resolve({
            data: {},
            error: { message: "Supabase not configured" },
          }),
        onAuthStateChange: (): {
          data: { subscription: { unsubscribe: () => void } };
        } => ({
          data: { subscription: { unsubscribe: (): void => {} } },
        }),
      },
    } as unknown as SupabaseClient;
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
})();

// Service client for admin operations
export const supabaseAdmin = ((): SupabaseClient => {
  if (
    !env.SUPABASE_URL ||
    !env.SUPABASE_SERVICE_KEY ||
    env.SUPABASE_URL.includes("your_supabase_url_here") ||
    env.SUPABASE_SERVICE_KEY.includes("your_supabase")
  ) {
    return {
      auth: {
        admin: {
          listUsers: () =>
            Promise.resolve({
              data: null,
              error: { message: "Supabase not configured" },
            }),
          createUser: () =>
            Promise.resolve({
              data: null,
              error: { message: "Supabase not configured" },
            }),
          deleteUser: () =>
            Promise.resolve({
              data: null,
              error: { message: "Supabase not configured" },
            }),
        },
      },
    } as unknown as SupabaseClient;
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
})();

// Health check function
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("health_check")
      .select("count")
      .limit(1);

    // If using mock client (not configured), return false
    if (error && error.code === "SUPABASE_NOT_CONFIGURED") {
      return false;
    }

    // PGRST116 means table doesn't exist, but connection is working
    return !error || error.code === "PGRST116";
  } catch (error) {
    console.error("Supabase connection check failed:", error);
    return false;
  }
}

// Set up TypeDI container
Container.set("supabase", supabase);
Container.set("supabaseAuth", supabaseAuth);
Container.set("supabaseAdmin", supabaseAdmin);

export default supabase;
