// Supabase Auth "Send Email" hook.
//
// Once this hook is enabled in Authentication -> Hooks in the dashboard,
// Supabase stops sending auth emails (signup confirmation, magic link,
// invite, email change, reauthentication) itself and calls this function
// instead, for every one of them. This delivers the email through one of
// our two Gmail mailboxes instead -- the SAME mail_log failover table used
// for password-reset OTPs in Feature 2, so both features share one daily
// 500-send quota per mailbox (matches Gmail's real per-account limit).
//
// Required secrets (set with `supabase secrets set ...` -- see README note
// at the bottom of this file):
//   SEND_EMAIL_HOOK_SECRET   - the "v1,whsec_..." signing secret shown when
//                              you create the hook in the dashboard
//   MAILBOX_A_EMAIL          - first Gmail address
//   MAILBOX_A_APP_PASSWORD   - first Gmail App Password (not the login password)
//   MAILBOX_B_EMAIL          - second Gmail address
//   MAILBOX_B_APP_PASSWORD   - second Gmail App Password
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by
// the Edge Functions platform -- no need to set those two yourself.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Webhook } from "npm:standardwebhooks@1";
import nodemailer from "npm:nodemailer@10";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function todayUTC() {
  return new Date().toISOString().split("T")[0];
}

// Same 500/day-per-mailbox failover as apps/client/lib/mailer.js.
async function selectActiveMailbox() {
  const today = todayUTC();
  const userB = Deno.env.get("MAILBOX_B_EMAIL");
  const passB = Deno.env.get("MAILBOX_B_APP_PASSWORD");
  const hasMailboxB = Boolean(userB && passB);

  let mailboxACount = 0;
  const { data, error } = await supabaseAdmin
    .from("mail_log")
    .select("sent_count")
    .eq("mailbox", "mailbox_a")
    .eq("date", today)
    .maybeSingle();

  if (!error && data?.sent_count) {
    mailboxACount = data.sent_count;
  }

  if (mailboxACount >= 500 && hasMailboxB) {
    return { mailboxName: "mailbox_b", user: userB!, pass: passB! };
  }

  return {
    mailboxName: "mailbox_a",
    user: Deno.env.get("MAILBOX_A_EMAIL") ?? "",
    pass: Deno.env.get("MAILBOX_A_APP_PASSWORD") ?? "",
  };
}

async function logSentEmail(mailboxName: string) {
  const today = todayUTC();
  const { data: existing } = await supabaseAdmin
    .from("mail_log")
    .select("sent_count")
    .eq("mailbox", mailboxName)
    .eq("date", today)
    .maybeSingle();

  const newCount = (existing?.sent_count ?? 0) + 1;

  await supabaseAdmin.from("mail_log").upsert(
    { mailbox: mailboxName, date: today, sent_count: newCount },
    { onConflict: "mailbox,date" },
  );
}

function buildActionLink(tokenHash: string, emailActionType: string, redirectTo: string) {
  const url = new URL(`${SUPABASE_URL}/auth/v1/verify`);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", emailActionType);
  url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

function copyFor(emailActionType: string) {
  switch (emailActionType) {
    case "signup":
      return {
        subject: "Confirm your Central Perk Cafe account",
        body: "Welcome to Central Perk Cafe! Click the button below to verify your college email and activate your account.",
        cta: "Confirm my account",
      };
    case "email_change":
      return {
        subject: "Confirm your new email for Central Perk Cafe",
        body: "Click the button below to confirm this is your new email address.",
        cta: "Confirm new email",
      };
    case "invite":
      return {
        subject: "You've been invited to Central Perk Cafe",
        body: "Click the button below to accept your invite and set up your account.",
        cta: "Accept invite",
      };
    default:
      return {
        subject: "Central Perk Cafe: action required",
        body: "Click the button below to continue.",
        cta: "Continue",
      };
  }
}

function renderHtml(body: string, link: string, cta: string) {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; background-color: #f5f0e8; border: 1px solid #e4d9c9; border-radius: 12px; padding: 32px; color: #2e241d;">
      <h2 style="color: #316c52; margin-top: 0; font-size: 24px;">Central Perk Cafe</h2>
      <p style="font-size: 15px; line-height: 1.5; color: #5a4f47;">${body}</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${link}" style="display: inline-block; background-color: #316c52; color: #fffdf9; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 32px; border-radius: 8px;">${cta}</a>
      </div>
      <p style="font-size: 12px; color: #8a7e75; word-break: break-all;">Or paste this link into your browser:<br>${link}</p>
      <p style="font-size: 13px; color: #8a7e75; margin-top: 24px; border-top: 1px solid #e4d9c9; padding-top: 16px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
}

serve(async (req) => {
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  try {
    if (HOOK_SECRET) {
      const wh = new Webhook(HOOK_SECRET);
      wh.verify(payload, headers);
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(JSON.stringify({ error: { message: "Invalid webhook signature" } }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { user, email_data } = JSON.parse(payload);
  const { token_hash, redirect_to, email_action_type } = email_data;

  const link = buildActionLink(token_hash, email_action_type, redirect_to);
  const { subject, body, cta } = copyFor(email_action_type);

  const { mailboxName, user: mailUser, pass: mailPass } = await selectActiveMailbox();

  if (!mailUser || !mailPass) {
    console.error(`Mailbox credentials for ${mailboxName} are missing.`);
    return new Response(
      JSON.stringify({ error: { message: `Mailbox credentials for ${mailboxName} are not configured.` } }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: mailUser.trim(), pass: mailPass.trim().replace(/\s+/g, "") },
  });

  try {
    await transporter.sendMail({
      from: `"Central Perk Cafe" <${mailUser}>`,
      to: user.email,
      subject,
      html: renderHtml(body, link, cta),
      text: `${body}\n\n${link}`,
    });
    await logSentEmail(mailboxName);
  } catch (err) {
    console.error("Failed to send auth email:", err);
    return new Response(JSON.stringify({ error: { message: "Failed to send email" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
