import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getAccessDecision, getSupabaseEnv, isSupabaseAuthConfigured } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  let isAuthenticated = false;

  if (isSupabaseAuthConfigured()) {
    const { url, publishableKey } = getSupabaseEnv();
    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthenticated = Boolean(user);
  }

  const decision = getAccessDecision(request.nextUrl.pathname, isAuthenticated);

  if (decision.allowed) {
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  if ("status" in decision) {
    return NextResponse.json(
      { error: decision.status === 503 ? "Supabase auth is not configured" : "Unauthorized" },
      { status: decision.status }
    );
  }

  const loginUrl = new URL(decision.redirectTo, request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
