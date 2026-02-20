// backend/services/notify.js
const nodemailer = require('nodemailer');
const twilio = require('twilio'); // Only if you installed twilio

// --- Email Configuration (using Nodemailer) ---
// Configure your SMTP transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: false, // Use 'true' if your SMTP uses SSL/TLS (usually port 465)
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
});

// Verify transporter connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Connection Failed:', error.message);
  } else {
    console.log('✅ SMTP Connection Verified - Ready to send emails');
  }
});

async function sendEmailOtp(toEmail, otpCode) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM,
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

// --- SMS Configuration (using Twilio) ---
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

async function sendSmsOtp(toPhoneNumber, otpCode) {
    try {
        await twilioClient.messages.create({
            body: `Your OTP for Realtime Group App is: ${otpCode}. This code is valid for 10 minutes.`,
            from: process.env.TWILIO_FROM, // Your Twilio phone number
            to: toPhoneNumber,
        });
        console.log(`OTP SMS sent to ${toPhoneNumber}`);
    } catch (error) {
        console.error(`Error sending OTP SMS to ${toPhoneNumber}:`, error);
        // In a real app, you might want to throw an error or log it more robustly
    }
}

module.exports = {
    sendEmailOtp,
    sendSmsOtp,
};