const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ["email", "phone"], required: true },
    value: { type: String, required: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    consumed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// TTL index (auto delete expired OTPs)
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.Otp || mongoose.model("Otp", otpSchema);
