const nodemailer = require('nodemailer');

// Create transporter lazily so env vars are definitely loaded
let _transporter = null;
const getTransporter = () => {
  if (!_transporter) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error('EMAIL_USER and EMAIL_PASS must be set in .env');
    }
    // Gmail App Password — spaces in the 16-char key are stripped
    _transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS.replace(/\s/g, ''), // strip any spaces
      },
      tls: { rejectUnauthorized: false },
    });
  }
  return _transporter;
};

/**
 * Send an OTP email.
 * @param {string} to      - recipient email
 * @param {string} otp     - 6-digit OTP
 * @param {string} purpose - 'verify' | 'login'
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
      .tag{display:inline-block;background:rgba(0,240,255,0.1);border:1px solid rgba(0,240,255,0.3);color:#00f0ff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;padding:4px 14px;border-radius:100px;margin-bottom:20px}
      h2{color:#fff;font-size:22px;margin:0 0 10px;font-weight:700}
      p{color:#9ca3af;font-size:14px;line-height:1.7;margin:0 0 24px}
      .otp-box{background:rgba(0,240,255,0.06);border:2px solid rgba(0,240,255,0.4);border-radius:12px;padding:20px 40px;display:inline-block;margin-bottom:24px}
      .otp{font-size:44px;font-weight:900;letter-spacing:14px;color:#00f0ff;font-family:'Courier New',monospace}
      .exp{color:#6b7280;font-size:13px;margin:0}
      .ftr{background:#080810;padding:18px 32px;text-align:center;border-top:1px solid rgba(255,255,255,0.05)}
      .ftr p{color:#4b5563;font-size:12px;margin:0}
    </style></head>
    <body><div class="wrap">
      <div class="hdr"><div class="logo">Delhi-Bijnor <b>Rides</b></div></div>
      <div class="bdy">
        <div class="tag">${isLogin ? 'Login OTP' : 'Email Verification'}</div>
        <h2>${isLogin ? 'Confirm Your Login' : 'Verify Your Email'}</h2>
        <p>${isLogin
          ? 'Use the OTP below to complete your login. This code is valid for 10 minutes.'
          : 'Enter this OTP to verify your email address and activate your account.'
        }</p>
        <div class="otp-box"><div class="otp">${otp}</div></div>
        <p class="exp">⏱ Expires in <strong style="color:#e5e7eb">10 minutes</strong>. Do not share with anyone.</p>
      </div>
      <div class="ftr">
        <p>Delhi-Bijnor Rides &mdash; Safe, Fast, Reliable</p>
        <p style="margin-top:6px">If you didn't request this, you can ignore this email.</p>
      </div>
    </div></body></html>
  `;

  const info = await getTransporter().sendMail({
    from: `"Delhi-Bijnor Rides" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });

  console.log(`OTP email sent to ${to} — messageId: ${info.messageId}`);
  return info;
};

module.exports = { sendOtpEmail };
