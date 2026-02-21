const nodemailer = require('nodemailer');
const twilio = require('twilio');

function buildEmailTransporter() {
  const appPasswordUser = process.env.EMAIL_USER || process.env.SMTP_USER;
  const appPassword = process.env.EMAIL_APP_PASSWORD || process.env.SMTP_PASS;

  // App-password flow (recommended for Gmail)
  if (appPasswordUser && appPassword) {
    return nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: appPasswordUser,
        pass: appPassword,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  }

  // Fallback to explicit SMTP if configured
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: String(process.env.SMTP_PORT) === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
}

const transporter = buildEmailTransporter();

transporter.verify((error) => {
  if (error) {
    console.error('❌ Email transport connection failed:', error.message);
  } else {
    console.log('✅ Email transport verified - Ready to send emails');
  }
});

async function sendEmailOtp(toEmail, otpCode) {
  try {
    const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || process.env.SMTP_USER;

    if (!from) {
      throw new Error('Email sender not configured. Set EMAIL_FROM or EMAIL_USER.');
    }

    const mailOptions = {
      from,
      to: toEmail,
      subject: 'Your OTP for Realtime Group App',
      html: `<p>Your One-Time Password (OTP) is: <strong>${otpCode}</strong></p><p>This code is valid for 10 minutes.</p>`,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent successfully to ${toEmail} (MessageID: ${result.messageId})`);
    return true;
  } catch (error) {
    console.error(`❌ Error sending OTP email to ${toEmail}:`, error.message);
    throw error;
  }
}

const twilioSid = process.env.TWILIO_SID;
const twilioToken = process.env.TWILIO_TOKEN;
const twilioClient = twilioSid && twilioToken ? twilio(twilioSid, twilioToken) : null;

async function sendSmsOtp(toPhoneNumber, otpCode) {
  try {
    if (!twilioClient) {
      throw new Error('Twilio is not configured. Set TWILIO_SID and TWILIO_TOKEN.');
    }

    await twilioClient.messages.create({
      body: `Your OTP for Realtime Group App is: ${otpCode}. This code is valid for 10 minutes.`,
      from: process.env.TWILIO_FROM,
      to: toPhoneNumber,
    });

    console.log(`OTP SMS sent to ${toPhoneNumber}`);
  } catch (error) {
    console.error(`Error sending OTP SMS to ${toPhoneNumber}:`, error.message);
    throw error;
  }
}

module.exports = {
  sendEmailOtp,
  sendSmsOtp,
};
