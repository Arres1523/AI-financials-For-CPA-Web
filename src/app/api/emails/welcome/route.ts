import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResend } from "@/lib/resend";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.user_metadata?.welcome_sent) {
    return NextResponse.json({ sent: false, reason: "already_sent" });
  }

  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL ?? "Valoris <noreply@valoris.cpa>";

  const { error } = await resend.emails.send({
    from,
    to: [user.email],
    subject: "Welcome to Valoris — AI Financials for CPAs",
    html: `<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
<h1 style="color: #FFD60A;">Welcome to Valoris</h1>
<p>Hi${user.user_metadata?.full_name ? " " + user.user_metadata.full_name : ""},</p>
<p>We're excited to have you on board. Valoris helps CPAs manage financial data — import bank statements, classify transactions, and generate financial reports.</p>
<p>To get started:</p>
<ul>
<li>Create a new workspace for your client</li>
<li>Import their bank statements</li>
<li>Review and classify transactions</li>
<li>Generate CPA-ready reports</li>
</ul>
<p style="color: #666; font-size: 0.875rem;">If you have any questions, reply to this email.</p>
</div>`,
  }, { idempotencyKey: `welcome-email/${user.id}` });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.auth.updateUser({ data: { welcome_sent: true } }).catch(() => {});

  return NextResponse.json({ sent: true });
}
