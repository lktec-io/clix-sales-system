import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { pool } from '../config/db.js';

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

export function passwordResetEmail(resetUrl) {
  return {
    subject: 'Reset your Clix Sales System password',
    template: 'password-reset',
    html: `
      <p>You requested a password reset for your Clix Sales System account.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a>. This link expires in 30 minutes.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
  };
}
