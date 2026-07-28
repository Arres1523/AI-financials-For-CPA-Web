import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServiceRoleKey } from "@/lib/auth";

export const runtime = "nodejs";

const SETUP_ERROR = "Server registration is not configured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel and redeploy.";

function getErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }
  return "Account creation failed. Check your connection and Supabase Auth settings, then try again.";
}

export async function POST(request: Request) {
  if (!getSupabaseServiceRoleKey()) {
    return NextResponse.json({ error: SETUP_ERROR }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = body as { email?: unknown; password?: unknown; fullName?: unknown };
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  const fullName = typeof payload.fullName === "string" ? payload.fullName.trim() : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }

  return NextResponse.json({ userId: data.user?.id }, { status: 201 });
}
