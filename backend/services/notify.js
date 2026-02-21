const nodemailer = require('nodemailer');
const twilio = require('twilio');

function buildEmailTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    return null;
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
  });
}

const transporter = buildEmailTransporter();

async function sendEmailOtp(toEmail, otpCode) {
  try {
    if (!transporter) {
      throw new Error('Email is not configured. Set EMAIL_USER and EMAIL_APP_PASSWORD.');
    }

    const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
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
const twilioToken = process.env.TWILIO_TOKEN || process.env.TWILIO_AUTH;
const twilioClient = twilioSid && twilioToken ? twilio(twilioSid, twilioToken) : null;

async function sendSmsOtp(toPhoneNumber, otpCode) {
  try {
    if (!twilioClient) {
      throw new Error('Twilio is not configured. Set TWILIO_SID and TWILIO_TOKEN (or TWILIO_AUTH).');
    }

    await twilioClient.messages.create({
      body: `Your OTP for Realtime Group App is: ${otpCode}. This code is valid for 10 minutes.`,
      from: process.env.TWILIO_FROM || process.env.TWILIO_PHONE,
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
