// backend/routes/verify.js
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");

const otpStore = {}; // { "email:abc@gmail.com": { code, expiresAt } }

// Generate random 6-digit OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Nodemailer transporter (Mailtrap / Gmail)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify transporter connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Connection Failed:', error.message);
  } else {
    console.log('✅ SMTP Connection Verified - Ready to send emails');
  }
});

// 🔹 Send OTP
router.post("/send-otp", async (req, res) => {
  try {
    const { channel, value } = req.body;
    if (!channel || !value) {
      return res.status(400).json({ error: "Channel and value are required" });
    }

    const otp = generateOtp();
    const key = `${channel}:${value}`;
    otpStore[key] = { code: otp, expiresAt: Date.now() + 5 * 60 * 1000 };

    // Only log OTP in development mode for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔐 OTP generated for ${channel}:${value} (Development mode only)`);
    }

    if (channel === "email") {
      try {
        const result = await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.SMTP_USER,
          to: value,
          subject: "Your OTP Code",
          text: `Your verification code is ${otp}. It expires in 5 minutes.`,
        });
        console.log(`✅ Email sent to ${value} (MessageID: ${result.messageId})`);
        return res.json({ success: true, message: "OTP sent to your email" });
      } catch (emailError) {
        console.error(`❌ Email failed for ${value}:`, emailError.message);
        return res.status(500).json({ error: "Failed to send email. Check SMTP configuration." });
      }
    }

    if (channel === "phone") {
      // Later integrate SMS (Twilio, etc.)
      return res.json({
        success: true,
        message: "OTP sent to your phone (check backend console)",
      });
    }

    res.status(400).json({ error: "Unsupported channel" });
  } catch (err) {
    console.error("❌ Error sending OTP:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// 🔹 Verify OTP
router.post("/verify-otp", (req, res) => {
  const { channel, value, code } = req.body;
  if (!channel || !value || !code) {
    return res
      .status(400)
      .json({ error: "Channel, value, and code are required" });
  }

  const key = `${channel}:${value}`;
  const record = otpStore[key];

  if (!record) return res.status(400).json({ error: "No OTP found for this value" });
  if (Date.now() > record.expiresAt)
    return res.status(400).json({ error: "OTP expired" });
  if (record.code !== code)
    return res.status(400).json({ error: "Invalid OTP" });

  // OTP valid → delete from store
  delete otpStore[key];
  res.json({ success: true, message: `${channel} verified successfully` });
});

module.exports = router;
