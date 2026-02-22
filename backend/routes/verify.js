const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Otp = require("../models/Otp");
const User = require("../models/User");
const { sendEmailOtp, sendSmsOtp } = require("../services/notify");
const { toUserResponse } = require("../utils/userResponse");

const OTP_DELIVERY_TIMEOUT_MS = Number(process.env.OTP_DELIVERY_TIMEOUT_MS || 30000);

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
    }),
  ]);
}

router.post("/send-otp", auth, async (req, res) => {
  try {
    const { channel, value } = req.body;

    if (!channel || !value) {
      return res.status(400).json({ error: "Channel and value are required" });
    }

    if (!["email", "phone"].includes(channel)) {
      return res.status(400).json({ error: "Unsupported channel" });
    }

    const normalizedValue = String(value).trim();

    if (channel === "email" && req.user.email !== normalizedValue) {
      return res.status(403).json({ error: "You can only verify your registered email." });
    }

    if (channel === "phone" && req.user.phone !== normalizedValue) {
      return res.status(403).json({ error: "You can only verify your registered phone." });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    if (channel === "email") {
      await withTimeout(sendEmailOtp(normalizedValue, otp), OTP_DELIVERY_TIMEOUT_MS, "Email OTP delivery");
    } else {
      await withTimeout(sendSmsOtp(normalizedValue, otp), OTP_DELIVERY_TIMEOUT_MS, "SMS OTP delivery");
    }

    await Otp.create({
      channel,
      value: normalizedValue,
      code: otp,
      expiresAt,
      consumed: false,
    });

    const message = channel === "email" ? "OTP sent to your email" : "OTP sent to your phone";
    return res.json({ success: true, message });
  } catch (error) {
    console.error("❌ Error sending OTP:", error.message);
    const statusCode = error.message.includes("timeout") ? 504 : 500;
    return res.status(statusCode).json({ error: `Failed to send OTP: ${error.message}` });
  }
});

router.post("/verify-otp", auth, async (req, res) => {
  const { channel, value, code } = req.body;

  if (!channel || !value || !code) {
    return res.status(400).json({ error: "Channel, value, and code are required" });
  }

  try {
    const normalizedValue = String(value).trim();

    const otpRecord = await Otp.findOne({
      channel,
      value: normalizedValue,
      code: String(code).trim(),
      consumed: false,
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({ error: "OTP expired" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (channel === "email" && user.email === normalizedValue) {
      user.emailVerified = true;
    }

    if (channel === "phone" && user.phone === normalizedValue) {
      user.phoneVerified = true;
    }

    await user.save();

    otpRecord.consumed = true;
    await otpRecord.save();

    return res.json({
      success: true,
      message: `${channel} verified successfully`,
      user: toUserResponse(user),
    });
  } catch (error) {
    console.error("❌ Error verifying OTP:", error.message);
    return res.status(500).json({ error: "Failed to verify OTP" });
  }
});

module.exports = router;
