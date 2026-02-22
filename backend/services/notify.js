const nodemailer = require('nodemailer');
const twilio = require('twilio');

const EMAIL_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS || 20000);

function buildGmailTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
    connectionTimeout: EMAIL_TIMEOUT_MS,
    greetingTimeout: EMAIL_TIMEOUT_MS,
    socketTimeout: EMAIL_TIMEOUT_MS,
    // Prefer IPv4 route for hosts where IPv6 SMTP routing is unreliable.
    family: 4,
    pool: true,
  });
}

const transporter = buildGmailTransporter();

if (transporter) {
  transporter.verify()
    .then(() => {
      console.log('Gmail transporter verified successfully.');
    })
    .catch((error) => {
      console.error('Gmail transporter verification failed:', error.message);
    });
}

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
    console.log(`OTP email sent successfully to ${toEmail} (MessageID: ${result.messageId})`);
    return true;
  } catch (error) {
    const normalizedMessage = /timeout|timed out|ETIMEDOUT|ECONNECTION/i.test(error.message)
      ? 'Connection timeout while contacting Gmail SMTP.'
      : error.message;

    console.error(`Error sending OTP email to ${toEmail}:`, normalizedMessage);
    throw new Error(normalizedMessage);
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
