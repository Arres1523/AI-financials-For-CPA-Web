import { describe, expect, it, beforeEach, afterEach } from "vitest";

describe("auth helpers", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  it("reports when supabase auth is configured", async () => {
    const { isSupabaseAuthConfigured } = await import("@/lib/auth");

    expect(isSupabaseAuthConfigured()).toBe(true);
  });

  it("reports when supabase auth is missing configuration", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    const { isSupabaseAuthConfigured } = await import("@/lib/auth");
    expect(isSupabaseAuthConfigured()).toBe(false);
  });

  it("allows authenticated page requests and blocks anonymous api requests", async () => {
    const { getAccessDecision } = await import("@/lib/auth");

    expect(getAccessDecision("/dashboard", true)).toEqual({ allowed: true });
    expect(getAccessDecision("/api/companies", false)).toEqual({
      allowed: false,
      status: 401,
    });
  });

  it("redirects anonymous page requests to the login screen", async () => {
    const { getAccessDecision } = await import("@/lib/auth");

    expect(getAccessDecision("/wizard", false)).toEqual({
      allowed: false,
      redirectTo: "/login",
    });
  });

  it("redirects to setup guidance when supabase auth config is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "";
    const { getAccessDecision } = await import("@/lib/auth");

    expect(getAccessDecision("/wizard", false)).toEqual({
      allowed: false,
      redirectTo: "/login?error=setup",
    });
    expect(getAccessDecision("/api/companies", false)).toEqual({
      allowed: false,
      status: 503,
    });
  });

  it("allows access to auth paths without authentication", async () => {
    const { getAccessDecision } = await import("@/lib/auth");

    expect(getAccessDecision("/register", false)).toEqual({ allowed: true });
    expect(getAccessDecision("/forgot-password", false)).toEqual({ allowed: true });
    expect(getAccessDecision("/forgot-password/some-token", false)).toEqual({ allowed: true });
    expect(getAccessDecision("/update-password", false)).toEqual({ allowed: true });
    expect(getAccessDecision("/auth/callback?code=xxx", false)).toEqual({ allowed: true });
  });
});

describe("UnauthorizedError", () => {
  it("is an instance of Error with name UnauthorizedError", async () => {
    const { UnauthorizedError } = await import("@/lib/auth");
    const err = new UnauthorizedError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("UnauthorizedError");
    expect(err.message).toBe("Authentication required");
  });

  it("accepts custom message", async () => {
    const { UnauthorizedError } = await import("@/lib/auth");
    const err = new UnauthorizedError("Custom message");
    expect(err.message).toBe("Custom message");
  });
});
