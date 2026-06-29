const { Resend } = require('resend');

// Lazily initialise so missing env var is caught at send-time, not startup
let _resend = null;
const getResend = () => {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set in environment variables');
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
};

/**
 * Send an OTP email via Resend.
 * Works on Render, Vercel, and every cloud host — no SMTP ports needed.
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
      p{color:#aaa;font-size:14px;line-height:1.6}
    </style></head>
    <body><div class="wrap">
      <div class="hdr"><div class="logo">Delhi-Bijnor <b>Rides</b></div></div>
      <div class="bdy">
        <h2 style="color:#fff">${isLogin ? 'Confirm Your Login' : 'Verify Your Email'}</h2>
        <div class="otp-box"><div class="otp">${otp}</div></div>
        <p>Valid for 10 minutes. Do not share this code with anyone.</p>
      </div>
    </div></body></html>
  `;

  const fromAddress = process.env.RESEND_FROM_EMAIL || 'Delhi-Bijnor Rides <onboarding@resend.dev>';

  const { data, error } = await getResend().emails.send({
    from: fromAddress,
    to,
    subject,
    html,
  });

  if (error) {
    console.error('❌ Resend email error:', error);
    throw new Error(error.message || 'Failed to send email via Resend');
  }

  console.log(`✅ OTP email sent to ${to} — id: ${data.id}`);
  return data;
};

module.exports = { sendOtpEmail };
