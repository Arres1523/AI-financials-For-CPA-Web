export class UnauthorizedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

type AccessDecision =
  | { allowed: true }
  | { allowed: false; redirectTo: string }
  | { allowed: false; status: number };

function getEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not configured`);
  }
  return value;
}

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  );
}

function isAuthPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/update-password") ||
    pathname.startsWith("/auth/callback")
  );
}

export function getSupabaseEnv() {
  return {
    url: getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: getEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}

export async function requireUser(): Promise<{ id: string; email: string }> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new UnauthorizedError("Authentication required");
  return { id: user.id, email: user.email! };
}

export function getAccessDecision(
  pathname: string,
  isAuthenticated: boolean
): AccessDecision {
  if (isPublicPath(pathname) || isAuthPath(pathname)) {
    return { allowed: true };
  }

  if (!isSupabaseAuthConfigured()) {
    if (pathname.startsWith("/api/")) {
      return { allowed: false, status: 503 };
    }
    return { allowed: false, redirectTo: "/login?error=setup" };
  }

  if (isAuthenticated) return { allowed: true };

  if (pathname.startsWith("/api/")) {
    return { allowed: false, status: 401 };
  }

  return { allowed: false, redirectTo: "/login" };
}
