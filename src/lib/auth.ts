type AccessDecision =
  | { allowed: true }
  | { allowed: false; redirectTo: string }
  | { allowed: false; status: number };

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL environment variable is not configured");
  }

  if (!publishableKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variable is not configured");
  }

  return {
    url,
    publishableKey,
  };
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
