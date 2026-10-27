import nodemailer from 'nodemailer';
import env from '../config/env.js';
import logger from '../config/logger.js';

let transporter = null;

function isConfigured() {
  return Boolean(env.smtp.host);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

// Returns { success, failureReason } and never throws — same contract as
// smsProvider.sendSms, so callers can fall back to another channel or
// record the outcome instead of aborting the request.
async function sendEmail({ to, subject, text }) {
  if (!isConfigured()) {
    logger.warn('SMTP is not configured — email not actually sent', { to });
    return { success: false, failureReason: 'Email provider not configured' };
  }
  try {
    await getTransporter().sendMail({ from: env.smtp.from, to, subject, text });
    return { success: true };
  } catch (err) {
    logger.error('Email send failed', { to, message: err.message });
    return { success: false, failureReason: err.message };
  }
}

export default { isConfigured, sendEmail };
