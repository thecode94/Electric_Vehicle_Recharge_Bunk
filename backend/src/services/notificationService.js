const nodemailer = require('nodemailer');
const logger = require('../config/logger');
async function sendEmail(to, subject, text, html) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.info('Mock email', { to, subject, text });
    return { mock: true };
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  const info = await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, text, html });
  logger.info('Email sent', { messageId: info.messageId, to });
  return info;
}
module.exports = { sendEmail };
