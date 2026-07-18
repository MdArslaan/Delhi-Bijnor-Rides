/**
 * Send an OTP email via Brevo HTTP API.
 * This bypasses Render's SMTP port 587 blocking by using standard HTTPS (port 443).
 */
const sendOtpEmail = async (to, otp, purpose = 'verify') => {
  const isLogin = purpose === 'login';

  if (!process.env.BREVO_SMTP_KEY) {
    throw new Error('BREVO_SMTP_KEY must be set in environment variables');
  }

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
        <h2 style="color:#fff;margin-bottom:24px">${isLogin ? 'Confirm Your Login' : 'Verify Your Email'}</h2>
        <div class="otp-box"><div class="otp">${otp}</div></div>
        <p>Valid for 10 minutes.<br>Do not share this code with anyone.</p>
      </div>
    </div></body></html>
  `;

  const fromName  = 'Delhi-Bijnor Rides';
  const fromEmail = process.env.BREVO_FROM_EMAIL || process.env.BREVO_SMTP_USER || 'noreply@delhibijnorrides.com';

  const payload = {
    sender: {
      name: fromName,
      email: fromEmail
    },
    to: [
      { email: to }
    ],
    subject: subject,
    htmlContent: html
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_SMTP_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Brevo API Error:', errorData);
      throw new Error(`Brevo API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ OTP email sent to ${to} — messageId: ${data.messageId}`);
    return data;
  } catch (error) {
    console.error('❌ Failed to send OTP email via Brevo HTTP API:', error.message);
    throw error;
  }
};

module.exports = { sendOtpEmail };
