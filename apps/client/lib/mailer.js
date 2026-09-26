import nodemailer from 'nodemailer'
import { supabaseAdmin } from './supabaseAdmin'

/**
 * Returns today's date in YYYY-MM-DD format (UTC)
 */
function getTodayDateString() {
  return new Date().toISOString().split('T')[0]
}

/**
 * Creates a Nodemailer transporter for a given Gmail account
 */
function createTransporter(user, pass) {
  if (!user || !pass) return null
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user.trim(),
      pass: pass.trim().replace(/\s+/g, ''),
    },
  })
}

/**
 * Determines which mailbox to use based on daily quotas and configuration:
 * Mailbox A is primary (limit: 500 emails/day).
 * Mailbox B is failover when Mailbox A hits 500 or when configured.
 */
async function selectActiveMailbox() {
  const today = getTodayDateString()
  const hasMailboxB = Boolean(process.env.MAILBOX_B_USER && process.env.MAILBOX_B_PASS)

  // Query mail_log for mailbox_a usage today
  let mailboxACount = 0
  try {
    const { data, error } = await supabaseAdmin
      .from('mail_log')
      .select('sent_count')
      .eq('mailbox', 'mailbox_a')
      .eq('date', today)
      .maybeSingle()

    if (!error && data?.sent_count) {
      mailboxACount = data.sent_count
    }
  } catch (err) {
    console.warn('Could not query mail_log, defaulting to mailbox_a:', err.message)
  }

  // Failover condition: If mailbox_a sent >= 500 and mailbox_b is configured, switch to mailbox_b
  if (mailboxACount >= 500 && hasMailboxB) {
    return {
      mailboxName: 'mailbox_b',
      user: process.env.MAILBOX_B_USER,
      pass: process.env.MAILBOX_B_PASS,
    }
  }

  // Default to mailbox_a
  return {
    mailboxName: 'mailbox_a',
    user: process.env.MAILBOX_A_USER,
    pass: process.env.MAILBOX_A_PASS,
  }
}

/**
 * Increments sent_count for the chosen mailbox in mail_log
 */
async function logSentEmail(mailboxName) {
  const today = getTodayDateString()

  try {
    const { data: existing } = await supabaseAdmin
      .from('mail_log')
      .select('sent_count')
      .eq('mailbox', mailboxName)
      .eq('date', today)
      .maybeSingle()

    const newCount = (existing?.sent_count || 0) + 1

    await supabaseAdmin.from('mail_log').upsert(
      {
        mailbox: mailboxName,
        date: today,
        sent_count: newCount,
      },
      { onConflict: 'mailbox,date' }
    )
  } catch (err) {
    console.warn('Failed to update mail_log entry:', err.message)
  }
}

/**
 * Dispatches an OTP email to the user with Central Perk branding
 */
export async function sendPasswordResetEmail(toEmail, otpCode) {
  const { mailboxName, user, pass } = await selectActiveMailbox()

  if (!user || !pass) {
    throw new Error(
      `Mailbox credentials for ${mailboxName} are missing. Please configure MAILBOX_A_USER and MAILBOX_A_PASS in .env.local`
    )
  }

  const transporter = createTransporter(user, pass)

  const mailOptions = {
    from: `"Central Perk Cafe" <${user}>`,
    to: toEmail,
    subject: `Your Central Perk Cafe Password Reset Code: ${otpCode}`,
    text: `Hello,\n\nYour 6-digit password reset code for Central Perk Cafe is: ${otpCode}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this, you can safely ignore this email.\n\nWarm regards,\nCentral Perk Cafe Team`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; background-color: #f5f0e8; border: 1px solid #e4d9c9; border-radius: 12px; padding: 32px; color: #2e241d;">
        <h2 style="color: #316c52; margin-top: 0; font-size: 24px;">Central Perk Cafe</h2>
        <p style="font-size: 15px; line-height: 1.5; color: #5a4f47;">You requested to reset your password. Use the verification code below to proceed:</p>
        <div style="text-align: center; margin: 28px 0;">
          <div style="display: inline-block; background-color: #fffdf9; border: 2px dashed #316c52; border-radius: 8px; padding: 14px 28px; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #2e241d;">
            ${otpCode}
          </div>
        </div>
        <p style="font-size: 14px; color: #7a6e65;">This code expires in <strong>10 minutes</strong>.</p>
        <p style="font-size: 13px; color: #8a7e75; margin-top: 24px; border-top: 1px solid #e4d9c9; padding-top: 16px;">
          If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
  await logSentEmail(mailboxName)

  return { success: true, mailboxUsed: mailboxName }
}
