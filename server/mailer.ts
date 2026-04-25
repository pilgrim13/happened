import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type MailerConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string | null;
  from: string;
};

export function getMailerConfig(env: NodeJS.ProcessEnv = process.env): MailerConfig | null {
  const host = env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number.parseInt(env.SMTP_PORT ?? '1025', 10);
  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 1025,
    secure: env.SMTP_SECURE === '1',
    user: env.SMTP_USER?.trim() || null,
    pass: env.SMTP_PASS ?? null,
    from: env.SMTP_FROM?.trim() || 'happened <no-reply@happened.local>',
  };
}

export type Mailer = {
  config: MailerConfig;
  sendVerificationEmail(to: string, token: string, link: string): Promise<{ messageId: string }>;
  sendPasswordResetEmail(to: string, link: string): Promise<{ messageId: string }>;
  verifyMailerConnection(): Promise<{ ok: boolean; message: string }>;
};

export function createMailer(config: MailerConfig): Mailer {
  const transporter: Transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    // MailHog accepts no-auth; only attach creds if both provided.
    auth: config.user && config.pass != null ? { user: config.user, pass: config.pass } : undefined,
  });

  async function send(to: string, subject: string, text: string, html: string) {
    const info = await transporter.sendMail({ from: config.from, to, subject, text, html });
    return { messageId: info.messageId };
  }

  return {
    config,
    async sendVerificationEmail(to, token, link) {
      const subject = 'Verify your happened account';
      const text = `Welcome to happened.\n\nVerification token: ${token}\nClick to verify: ${link}\n`;
      const html = `<p>Welcome to <strong>happened</strong>.</p><p>Verification token: <code>${token}</code></p><p><a href="${link}">Click here to verify</a></p>`;
      return send(to, subject, text, html);
    },
    async sendPasswordResetEmail(to, link) {
      const subject = 'Reset your happened password';
      const text = `Reset your password: ${link}\n\nIf you did not request this, ignore this email.`;
      const html = `<p>Reset your password: <a href="${link}">${link}</a></p><p>If you did not request this, ignore this email.</p>`;
      return send(to, subject, text, html);
    },
    async verifyMailerConnection() {
      try {
        await transporter.verify();
        return { ok: true, message: `SMTP reachable at ${config.host}:${config.port}` };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'SMTP verify failed' };
      }
    },
  };
}
