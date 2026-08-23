import nodemailer from "nodemailer";

type Invitation = {
  betId: string;
  condition: string;
  creatorLabel: string;
  deadline: Date;
  recipient: string;
  wager: string;
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#039;",
}[character]!));

function invitationUrl(betId: string) {
  const configured = process.env.APP_ORIGIN || (process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:3000");
  const origin = new URL(configured);
  if (!["http:", "https:"].includes(origin.protocol) || origin.pathname !== "/") throw new Error("APP_ORIGIN must be an HTTP(S) origin without a path");
  return new URL(`/bets/${betId}`, origin).toString();
}

function content(invitation: Invitation) {
  const url = invitationUrl(invitation.betId);
  const due = new Intl.DateTimeFormat("en", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(invitation.deadline);
  const subject = `${invitation.creatorLabel} invited you to a Stakeout bet`;
  const text = `${invitation.creatorLabel} created a bet with you.\n\n${invitation.condition}\nAt stake: ${invitation.wager}\nDue: ${due} UTC\n\nOpen your private bet: ${url}\n\nIf you do not have an account yet, Stakeout will ask you to sign in with a passwordless email code before showing the bet. If you were not expecting this invitation, ignore this email.`;
  const html = `<main style="font-family:Arial,sans-serif;line-height:1.5;color:#15221d"><p style="font-size:12px;font-weight:700;letter-spacing:.12em">STAKEOUT</p><h1>You have a new bet.</h1><p><strong>${escapeHtml(invitation.creatorLabel)}</strong> created a bet with you.</p><div style="padding:16px;background:#f7f5ee;border-radius:10px"><p><strong>${escapeHtml(invitation.condition)}</strong></p><p>At stake: ${escapeHtml(invitation.wager)}</p><p>Due: ${escapeHtml(due)} UTC</p></div><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 16px;background:#15221d;color:white;text-decoration:none;border-radius:8px">Open your private bet</a></p><p>If you do not have an account yet, Stakeout will ask you to sign in with a passwordless email code before showing the bet.</p><p style="color:#66716b">If you were not expecting this invitation, ignore this email.</p></main>`;
  return { html, subject, text, url };
}

async function sendWithResend(invitation: Invitation) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_EMAIL_FROM;
  if (!apiKey || !from) throw new Error("RESEND_API_KEY and INVITE_EMAIL_FROM are required for invitation delivery");
  const message = content(invitation);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [invitation.recipient],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(process.env.INVITE_EMAIL_REPLY_TO ? { reply_to: process.env.INVITE_EMAIL_REPLY_TO } : {}),
    }),
  });
  if (!response.ok) throw new Error(`Resend rejected the invitation with status ${response.status}`);
}

async function sendWithMailpit(invitation: Invitation) {
  const message = content(invitation);
  const transporter = nodemailer.createTransport({
    host: process.env.MAILPIT_SMTP_HOST || "127.0.0.1",
    port: Number(process.env.MAILPIT_SMTP_PORT || 54325),
    secure: false,
  });
  await transporter.sendMail({
    from: process.env.INVITE_EMAIL_FROM || "Stakeout <invites@stakeout.local>",
    to: invitation.recipient,
    subject: message.subject,
    text: message.text,
    html: message.html,
    ...(process.env.INVITE_EMAIL_REPLY_TO ? { replyTo: process.env.INVITE_EMAIL_REPLY_TO } : {}),
  });
}

export async function sendBetInvitation(invitation: Invitation) {
  const provider = process.env.INVITE_EMAIL_PROVIDER || (process.env.NODE_ENV === "production" ? "resend" : "mailpit");
  if (provider === "mailpit") return sendWithMailpit(invitation);
  if (provider === "resend") return sendWithResend(invitation);
  throw new Error("INVITE_EMAIL_PROVIDER must be mailpit or resend");
}
