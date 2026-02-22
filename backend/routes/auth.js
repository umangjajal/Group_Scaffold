const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Otp = require("../models/Otp");
const { sendEmailOtp } = require("../services/notify");
const auth = require("../middleware/auth");
const { toUserResponse } = require("../utils/userResponse");

function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function looksRealName(name) {
  if (!name || name.length < 3) return false;
  if (/\d{2,}/.test(name)) return false;
  if (/[^\p{L}\s.'-]/u.test(name)) return false;
  return true;
}

function normalizePhone(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  return raw.replace(/[\s().-]/g, "");
}

function isValidPhone(phone) {
  if (!phone) return true;
  return /^\+?[1-9]\d{7,14}$/.test(phone);
}

const generateTokens = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
    plan: user.plan,
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  return { accessToken, refreshToken };
};

router.post("/register", async (req, res) => {
  const { password, name, gender } = req.body;
  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : "";
  const phone = req.body.phone ? String(req.body.phone).trim() : "";

  if (!name || !looksRealName(name)) {
    return res.status(400).json({ error: "Invalid name." });
  }
  if (!email && !phone) {
    return res.status(400).json({ error: "Email or phone is required." });
  }
  if (!password) {
    return res.status(400).json({ error: "Password is required." });
  }

  try {
    const duplicateChecks = [];
    if (email) duplicateChecks.push({ email });
    if (phone) duplicateChecks.push({ phone });

    const existingUser = duplicateChecks.length > 0
      ? await User.findOne({ $or: duplicateChecks })
      : null;

    if (existingUser) {
      return res.status(409).json({ error: "User already exists with this email/phone." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({
      email: email || undefined,
      phone: phone || undefined,
      passwordHash,
      name,
      gender: ["male", "female", "other"].includes(gender) ? gender : "other",
      nameVerified: looksRealName(name),
    });
    await newUser.save();
    const { accessToken, refreshToken } = generateTokens(newUser);
    return res.status(201).json({
      message: "User registered successfully.",
      user: {
        ...toUserResponse(newUser),
        nameVerified: newUser.nameVerified,
        avatarUrl: newUser.avatarUrl,
        status: newUser.status,
        createdAt: newUser.createdAt,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ error: "Server error." });
  }
});

router.post("/login", async (req, res) => {
  const password = req.body.password;
  const identifierInput = req.body.identifier || req.body.email || req.body.phone;
  const identifier = identifierInput ? String(identifierInput).trim() : "";

  if (!identifier || !password) {
    return res
      .status(400)
      .json({ error: "Identifier (email/phone) and password are required." });
  }

  try {
    const normalizedEmail = identifier.toLowerCase();
    const user = await User.findOne({
      $or: [{ email: normalizedEmail }, { phone: identifier }],
    });

    if (!user) return res.status(400).json({ error: "Invalid credentials." });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials." });

    const { accessToken, refreshToken } = generateTokens(user);
    return res.json({
      user: toUserResponse(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Server error." });
  }
});

router.post("/refresh", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Refresh token required." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: "User not found." });

    const { accessToken, refreshToken } = generateTokens(user);
    return res.json({ accessToken, refreshToken });
  } catch (error) {
    console.error("Token refresh error:", error.message);
    return res.status(401).json({ error: "Invalid refresh token." });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.json(user);
  } catch (error) {
    console.error("Get /me error:", error);
    return res.status(500).json({ error: "Server error." });
  }
});

router.put("/me", auth, async (req, res) => {
  const { name, avatarUrl, phone, gender } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    if (typeof name === "string" && name.trim()) {
      const nextName = name.trim();
      if (!looksRealName(nextName)) {
        return res.status(400).json({ error: "Invalid name." });
      }
      user.name = nextName;
      user.nameVerified = looksRealName(nextName);
    }

    if (typeof avatarUrl === "string") user.avatarUrl = avatarUrl;

    if (typeof phone !== "undefined") {
      const normalizedPhone = normalizePhone(phone);

      if (!isValidPhone(normalizedPhone)) {
        return res.status(400).json({
          error: "Invalid phone number. Use 8-15 digits, optional leading +.",
        });
      }

      if (normalizedPhone !== String(user.phone || "")) {
        if (normalizedPhone) {
          const existingUser = await User.findOne({
            phone: normalizedPhone,
            _id: { $ne: user._id },
          });
          if (existingUser) {
            return res.status(409).json({ error: "Phone number is already in use." });
          }
          user.phone = normalizedPhone;
        } else {
          user.phone = undefined;
        }
        user.phoneVerified = false;
      }
    }

    if (["male", "female", "other"].includes(gender)) user.gender = gender;

    await user.save();
    const { accessToken, refreshToken } = generateTokens(user);

    return res.json({
      message: "Profile updated.",
      user: toUserResponse(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Update /me error:", error);
    if (error?.code === 11000 && error?.keyPattern?.phone) {
      return res.status(409).json({ error: "Phone number is already in use." });
    }
    return res.status(500).json({ error: "Server error." });
  }
});

router.post("/forgot-password/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "No account found with this email." });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.create({ channel: "email", value: email, code, expiresAt, consumed: false });
    await sendEmailOtp(email, code);

    return res.json({ message: "OTP sent to your registered email." });
  } catch (error) {
    console.error("Forgot password send OTP error:", error.message);
    return res.status(500).json({ error: "Failed to send OTP." });
  }
});

router.post("/forgot-password/reset", async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: "Email, OTP code, and new password are required." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "No account found with this email." });
    }

    const otpRecord = await Otp.findOne({ channel: "email", value: email, code, consumed: false }).sort({ createdAt: -1 });
    if (!otpRecord) {
      return res.status(400).json({ error: "Invalid OTP." });
    }
    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({ error: "OTP expired." });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    otpRecord.consumed = true;
    await otpRecord.save();

    return res.json({ message: "Password reset successful." });
  } catch (error) {
    console.error("Forgot password reset error:", error.message);
    return res.status(500).json({ error: "Failed to reset password." });
  }
});

module.exports = router;
