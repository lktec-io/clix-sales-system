import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { pool } from '../config/db.js';
import { t } from '../i18n/index.js';

let transporter = null;

function getTransporter() {
  if (!env.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, password: env.smtp.password } : undefined,
    });
  }
  return transporter;
}

async function logEmail({ to, subject, template, status, errorMessage }) {
  try {
    await pool.query(
      'INSERT INTO email_logs (to_email, subject, template, status, error_message) VALUES (?, ?, ?, ?, ?)',
      [to, subject, template || null, status, errorMessage || null],
    );
  } catch (err) {
    logger.error('Failed to write email_logs row', { message: err.message });
  }
}

// Never throws — callers must not let email delivery failures break the request
// (e.g. forgot-password must always return a generic success response).
export async function sendMail({ to, subject, html, template }) {
  const client = getTransporter();

  if (!client) {
    logger.warn('SMTP not configured — email not sent', { to, subject });
    await logEmail({ to, subject, template, status: 'failed', errorMessage: 'SMTP not configured' });
    return { sent: false };
  }

  try {
    await client.sendMail({ from: env.smtp.from, to, subject, html });
    await logEmail({ to, subject, template, status: 'sent' });
    return { sent: true };
  } catch (err) {
    logger.error('Email send failed', { to, subject, message: err.message });
    await logEmail({ to, subject, template, status: 'failed', errorMessage: err.message });
    return { sent: false };
  }
}

export function passwordResetEmail(resetUrl, locale = 'en') {
  return {
    subject: t(locale, 'email.passwordResetSubject'),
    template: 'password-reset',
    html: `
      <p>${t(locale, 'email.passwordResetIntro')}</p>
      <p><a href="${resetUrl}">${t(locale, 'email.passwordResetLink')}</a>. ${t(locale, 'email.passwordResetExpiry')}</p>
      <p>${t(locale, 'email.passwordResetIgnore')}</p>
    `,
  };
}
