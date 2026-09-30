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
 *
 * This quota is shared across every email type sent through this module
 * (password-reset OTPs and signup confirmations both count against the
 * same 500/day-per-mailbox limit), since mail_log is keyed only on
 * (mailbox, date), not on what the email was for.
 */
async function selectActiveMailbox() {
  const today = getTodayDateString()
  const hasMailboxB = Boolean(process.env.MAILBOX_B_EMAIL && process.env.MAILBOX_B_APP_PASSWORD)

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
      user: process.env.MAILBOX_B_EMAIL,
      pass: process.env.MAILBOX_B_APP_PASSWORD,
    }
  }

  // Default to mailbox_a
  return {
    mailboxName: 'mailbox_a',
    user: process.env.MAILBOX_A_EMAIL,
    pass: process.env.MAILBOX_A_APP_PASSWORD,
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
      `Mailbox credentials for ${mailboxName} are missing. Please configure MAILBOX_A_EMAIL and MAILBOX_A_APP_PASSWORD in .env.local`
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

/**
 * Dispatches the signup confirmation email with Central Perk branding.
 * `confirmationLink` is the real Supabase-generated verification link
 * (from supabaseAdmin.auth.admin.generateLink), so clicking it confirms
 * the account exactly like Supabase's own built-in email would have —
 * we're only replacing who sends the email, not how confirmation works.
 */
export async function sendSignupConfirmationEmail(toEmail, confirmationLink, name) {
  const { mailboxName, user, pass } = await selectActiveMailbox()

  if (!user || !pass) {
    throw new Error(
      `Mailbox credentials for ${mailboxName} are missing. Please configure MAILBOX_A_EMAIL and MAILBOX_A_APP_PASSWORD in .env.local`
    )
  }

  const transporter = createTransporter(user, pass)
  const greetingName = name && name.trim() ? name.trim() : 'there'

  const mailOptions = {
    from: `"Central Perk Cafe" <${user}>`,
    to: toEmail,
    subject: 'Confirm your Central Perk Cafe account',
    text: `Hi ${greetingName},\n\nThanks for signing up for Central Perk Cafe. Confirm your account by opening this link:\n\n${confirmationLink}\n\nIf you didn't create this account, you can safely ignore this email.\n\nWarm regards,\nCentral Perk Cafe Team`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; background-color: #f5f0e8; border: 1px solid #e4d9c9; border-radius: 12px; padding: 32px; color: #2e241d;">
        <h2 style="color: #316c52; margin-top: 0; font-size: 24px;">Central Perk Cafe</h2>
        <p style="font-size: 15px; line-height: 1.5; color: #5a4f47;">Hi ${greetingName}, thanks for signing up. Confirm your account to get started:</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${confirmationLink}" style="display: inline-block; background-color: #316c52; color: #fffdf9; text-decoration: none; border-radius: 8px; padding: 14px 28px; font-size: 16px; font-weight: 700;">
            Confirm your account
          </a>
        </div>
        <p style="font-size: 13px; color: #8a7e75; word-break: break-all;">Or paste this link into your browser: ${confirmationLink}</p>
        <p style="font-size: 13px; color: #8a7e75; margin-top: 24px; border-top: 1px solid #e4d9c9; padding-top: 16px;">
          If you didn't create this account, you can safely ignore this email.
        </p>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
  await logSentEmail(mailboxName)

  return { success: true, mailboxUsed: mailboxName }
}

/**
 * Dispatches the 6-digit device-verification code shown when someone logs
 * in from a browser we don't recognize yet (see trusted_devices / login
 * route). Separate template from the password-reset OTP so the subject
 * line is unambiguous about which flow it's for.
 */
export async function sendDeviceVerificationEmail(toEmail, otpCode) {
  const { mailboxName, user, pass } = await selectActiveMailbox()

  if (!user || !pass) {
    throw new Error(
      `Mailbox credentials for ${mailboxName} are missing. Please configure MAILBOX_A_EMAIL and MAILBOX_A_APP_PASSWORD in .env.local`
    )
  }

  const transporter = createTransporter(user, pass)

  const mailOptions = {
    from: `"Central Perk Cafe" <${user}>`,
    to: toEmail,
    subject: `New device sign-in code: ${otpCode}`,
    text: `Hello,\n\nSomeone is signing into your Central Perk Cafe account from a device we don't recognize. If this is you, enter this code to continue:\n\n${otpCode}\n\nThis code will expire in 10 minutes. If this wasn't you, do not share this code with anyone -- just ignore this email and the sign-in attempt will fail on its own.\n\nWarm regards,\nCentral Perk Cafe Team`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; background-color: #f5f0e8; border: 1px solid #e4d9c9; border-radius: 12px; padding: 32px; color: #2e241d;">
        <h2 style="color: #316c52; margin-top: 0; font-size: 24px;">Central Perk Cafe</h2>
        <p style="font-size: 15px; line-height: 1.5; color: #5a4f47;">Someone is signing into your account from a device we don't recognize. If this is you, enter this code to continue:</p>
        <div style="text-align: center; margin: 28px 0;">
          <div style="display: inline-block; background-color: #fffdf9; border: 2px dashed #316c52; border-radius: 8px; padding: 14px 28px; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #2e241d;">
            ${otpCode}
          </div>
        </div>
        <p style="font-size: 14px; color: #7a6e65;">This code expires in <strong>10 minutes</strong>.</p>
        <p style="font-size: 13px; color: #8a7e75; margin-top: 24px; border-top: 1px solid #e4d9c9; padding-top: 16px;">
          If this wasn't you, don't share this code with anyone -- just ignore this email and the sign-in attempt will fail on its own.
        </p>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
  await logSentEmail(mailboxName)

  return { success: true, mailboxUsed: mailboxName }
}

/**
 * Single neutral "review this sign-in" link used by both device alert
 * emails below -- deliberately ONE link that only loads a page, rather
 * than separate pre-answered Yes/No links. That keeps the email itself
 * inert (safe against corporate mail scanners that prefetch links) and
 * matches how the actual Yes/No choice works: it's a real button press
 * on the /device-confirm page, not which link in the email got clicked.
 */
function renderConfirmButton(confirmLink) {
  return `
    <div style="text-align: center; margin: 28px 0;">
      <a href="${confirmLink}" style="display: inline-block; background-color: #316c52; color: #fffdf9; text-decoration: none; border-radius: 8px; padding: 14px 28px; font-size: 16px; font-weight: 700;">
        Review this sign-in
      </a>
    </div>
  `
}

/**
 * Sent when someone fails the device-verification code (wrong 6-digit
 * code on a new device) -- NOT sent for a plain wrong password, only
 * after a real attempt got past the password check and then failed 2FA.
 */
export async function sendDeviceVerificationFailedEmail(toEmail, confirmLink) {
  const { mailboxName, user, pass } = await selectActiveMailbox()

  if (!user || !pass) {
    throw new Error(
      `Mailbox credentials for ${mailboxName} are missing. Please configure MAILBOX_A_EMAIL and MAILBOX_A_APP_PASSWORD in .env.local`
    )
  }

  const transporter = createTransporter(user, pass)

  const mailOptions = {
    from: `"Central Perk Cafe" <${user}>`,
    to: toEmail,
    subject: 'A device failed to verify on your Central Perk Cafe account',
    text: `Hello,\n\nA device that knew your password tried to sign into your Central Perk Cafe account, but entered the wrong verification code.\n\nWas this you? Review this sign-in: ${confirmLink}\n\nWarm regards,\nCentral Perk Cafe Team`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; background-color: #f5f0e8; border: 1px solid #e4d9c9; border-radius: 12px; padding: 32px; color: #2e241d;">
        <h2 style="color: #316c52; margin-top: 0; font-size: 24px;">Central Perk Cafe</h2>
        <p style="font-size: 15px; line-height: 1.5; color: #5a4f47;">A device that knew your password just tried to sign into your account, but entered the wrong verification code.</p>
        <p style="font-size: 15px; line-height: 1.5; color: #2e241d; font-weight: 700;">Was this you?</p>
        ${renderConfirmButton(confirmLink)}
        <p style="font-size: 13px; color: #8a7e75; margin-top: 24px; border-top: 1px solid #e4d9c9; padding-top: 16px;">
          Review this sign-in and tell us Yes or No. If it wasn't you, we'll take you straight to setting a new password.
        </p>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
  await logSentEmail(mailboxName)

  return { success: true, mailboxUsed: mailboxName }
}

/**
 * Sent once a new device successfully passes verification and gets
 * marked trusted -- the standard "new sign-in" alert.
 */
export async function sendNewDeviceLoginEmail(toEmail, confirmLink) {
  const { mailboxName, user, pass } = await selectActiveMailbox()

  if (!user || !pass) {
    throw new Error(
      `Mailbox credentials for ${mailboxName} are missing. Please configure MAILBOX_A_EMAIL and MAILBOX_A_APP_PASSWORD in .env.local`
    )
  }

  const transporter = createTransporter(user, pass)

  const mailOptions = {
    from: `"Central Perk Cafe" <${user}>`,
    to: toEmail,
    subject: 'New device signed into your Central Perk Cafe account',
    text: `Hello,\n\nA new device just signed into your Central Perk Cafe account.\n\nWas this you? Review this sign-in: ${confirmLink}\n\nWarm regards,\nCentral Perk Cafe Team`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; background-color: #f5f0e8; border: 1px solid #e4d9c9; border-radius: 12px; padding: 32px; color: #2e241d;">
        <h2 style="color: #316c52; margin-top: 0; font-size: 24px;">Central Perk Cafe</h2>
        <p style="font-size: 15px; line-height: 1.5; color: #5a4f47;">A new device just signed into your account.</p>
        <p style="font-size: 15px; line-height: 1.5; color: #2e241d; font-weight: 700;">Was this you?</p>
        ${renderConfirmButton(confirmLink)}
        <p style="font-size: 13px; color: #8a7e75; margin-top: 24px; border-top: 1px solid #e4d9c9; padding-top: 16px;">
          Review this sign-in and tell us Yes or No. If it wasn't you, we'll take you straight to setting a new password.
        </p>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
  await logSentEmail(mailboxName)

  return { success: true, mailboxUsed: mailboxName }
}
