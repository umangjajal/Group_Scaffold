const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Otp = require("../models/Otp");
const { sendEmailOtp, sendSmsOtp } = require("../services/notify");
const auth = require("../middleware/auth");

// ✅ Validate names
function looksRealName(name) {
  if (!name || name.length < 3) return false;
  if (/\d{2,}/.test(name)) return false;
  if (/[^\p{L}\s.'-]/u.test(name)) return false;
  return true;
}

// ✅ Generate access + refresh tokens
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

// ================== REGISTER ==================
router.post("/register", async (req, res) => {
  const { email, phone, password, name } = req.body;
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
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(409).json({ error: "User already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({
      email,
      phone,
      passwordHash,
      name,
      nameVerified: looksRealName(name),
    });
    await newUser.save();

    // ✅ Send OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    if (email) {
      await Otp.create({ channel: "email", value: email, code, expiresAt });
      try {
        await sendEmailOtp(email, code);
      } catch (emailError) {
        console.error("⚠️ OTP email failed but user registered:", emailError.message);
      }
    } else if (phone) {
      await Otp.create({ channel: "phone", value: phone, code, expiresAt });
      try {
        await sendSmsOtp(phone, code);
      } catch (smsError) {
        console.error("⚠️ OTP SMS failed but user registered:", smsError.message);
      }
    }

    const { accessToken, refreshToken } = generateTokens(newUser);
    res.status(201).json({
      message: "User registered. Verify email/phone.",
      user: {
        id: newUser._id,
        email: newUser.email,
        phone: newUser.phone,
        name: newUser.name,
        role: newUser.role,
        plan: newUser.plan,
        emailVerified: newUser.emailVerified,
        phoneVerified: newUser.phoneVerified,
        nameVerified: newUser.nameVerified,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Server error." });
  }
});

// ================== LOGIN ==================
router.post("/login", async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res
      .status(400)
      .json({ error: "Identifier (email/phone) and password are required." });
  }

  try {
    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }],
    });
    if (!user) return res.status(400).json({ error: "Invalid credentials." });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials." });

    const { accessToken, refreshToken } = generateTokens(user);
    res.json({
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role,
        plan: user.plan,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error." });
  }
});

// ================== REFRESH TOKEN ==================
router.post("/refresh", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Refresh token required." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: "User not found." });

    const { accessToken, refreshToken } = generateTokens(user);
    res.json({ accessToken, refreshToken });
  } catch (error) {
    console.error("Token refresh error:", error.message);
    res.status(401).json({ error: "Invalid refresh token." });
  }
});

// ================== GET CURRENT USER ==================
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user);
  } catch (error) {
    console.error("Get /me error:", error);
    res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
