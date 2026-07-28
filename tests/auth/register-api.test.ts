import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateUser = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        createUser: (...args: unknown[]) => mockCreateUser(...args),
      },
    },
  }),
}));

describe("POST /api/auth/register", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalPublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    vi.resetModules();
    mockCreateUser.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalPublishableKey;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
  });

  it("returns setup guidance when server registration is not configured", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    const { POST } = await import("@/app/api/auth/register/route");

    const response = await POST(
      new Request("https://app.test/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: "miguel@example.com",
          password: "password123",
          fullName: "Miguel",
        }),
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Server registration is not configured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel and redeploy.",
    });
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("creates a confirmed user through Supabase Admin Auth", async () => {
    mockCreateUser.mockResolvedValue({
      data: { user: { id: "user-id" } },
      error: null,
    });
    const { POST } = await import("@/app/api/auth/register/route");

    const response = await POST(
      new Request("https://app.test/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: " miguel@example.com ",
          password: "password123",
          fullName: " Miguel ",
        }),
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ userId: "user-id" });
    expect(mockCreateUser).toHaveBeenCalledWith({
      email: "miguel@example.com",
      password: "password123",
      email_confirm: true,
      user_metadata: { full_name: "Miguel" },
    });
  });
});
