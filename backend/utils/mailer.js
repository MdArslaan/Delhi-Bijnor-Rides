const nodemailer = require('nodemailer');

const EMAIL_TIMEOUT_MS = parseInt(process.env.EMAIL_TIMEOUT_MS || '15000', 10);

let _transporter = null;

const getTransporter = () => {
  if (!_transporter) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error('EMAIL_USER and EMAIL_PASS must be set in environment variables');
    }
    _transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS.replace(/\s/g, ''),
      },
      tls: { rejectUnauthorized: false },
      connectionTimeout: EMAIL_TIMEOUT_MS,
      greetingTimeout: EMAIL_TIMEOUT_MS,
      socketTimeout: EMAIL_TIMEOUT_MS,
    });
  }
  return _transporter;
};

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);

/**
 * Send an OTP email (with timeout so API never hangs on Render SMTP).
 */
const sendOtpEmail = async (to, otp, purpose = 'verify') => {
  const isLogin = purpose === 'login';
  const subject = isLogin
    ? 'Your Delhi-Bijnor Rides Login OTP'
    : 'Verify your Delhi-Bijnor Rides Account';

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8">
    <style>
      body{font-family:Arial,sans-serif;background:#050505;color:#fff;margin:0;padding:20px}
      .wrap{max-width:480px;margin:0 auto;background:#0d0d14;border-radius:16px;border:1px solid rgba(0,240,255,0.25);overflow:hidden}
      .hdr{background:#0d0d14;padding:28px 32px 20px;text-align:center;border-bottom:1px solid rgba(0,240,255,0.15)}
      .logo{font-size:20px;font-weight:800;color:#fff}.logo b{color:#00f0ff}
      .bdy{padding:32px;text-align:center}
      .otp-box{background:rgba(0,240,255,0.06);border:2px solid rgba(0,240,255,0.4);border-radius:12px;padding:20px 40px;display:inline-block;margin-bottom:24px}
      .otp{font-size:44px;font-weight:900;letter-spacing:14px;color:#00f0ff;font-family:'Courier New',monospace}
    </style></head>
    <body><div class="wrap">
      <div class="hdr"><div class="logo">Delhi-Bijnor <b>Rides</b></div></div>
      <div class="bdy">
        <h2>${isLogin ? 'Confirm Your Login' : 'Verify Your Email'}</h2>
        <div class="otp-box"><div class="otp">${otp}</div></div>
        <p>Valid for 10 minutes. Do not share.</p>
      </div>
    </div></body></html>
  `;

  const sendPromise = getTransporter().sendMail({
    from: `"Delhi-Bijnor Rides" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });

  const info = await withTimeout(sendPromise, EMAIL_TIMEOUT_MS, 'Email send');
  console.log(`OTP email sent to ${to} — messageId: ${info.messageId}`);
  return info;
};

module.exports = { sendOtpEmail };
