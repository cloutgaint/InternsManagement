import nodemailer from "nodemailer";

let transport = null;
function mailer() {
  if (!process.env.SMTP_HOST) return null;
  transport ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transport;
}

export const mailConfigured = () => !!process.env.SMTP_HOST;

// Mail is best-effort: workflow state never depends on delivery, so callers see {sent:false} and continue.
export async function sendMail({ to, subject, text, attachments }) {
  const client = mailer();
  if (!client || !to) return { sent: false };
  try {
    await client.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, attachments });
    return { sent: true };
  } catch (error) {
    console.error("Mail delivery failed:", error.message);
    return { sent: false, error: "Mail delivery failed" };
  }
}
