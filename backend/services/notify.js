const nodemailer = require('nodemailer');
const twilio = require('twilio');

const EMAIL_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS || 10000);

function boolFromEnv(value, defaultValue = false) {
  if (typeof value === 'undefined') return defaultValue;
  return String(value).toLowerCase() === 'true';
}

function getEmailProviderOrder() {
  const provider = String(process.env.EMAIL_PROVIDER || 'auto').trim().toLowerCase();
  const fallback = String(process.env.EMAIL_PROVIDER_FALLBACK || '').trim().toLowerCase();

  const order = [];

  if (provider === 'smtp' || provider === 'gmail') {
    order.push('smtp');
  } else if (provider === 'resend') {
    order.push('resend');
  } else {
    // auto mode: prefer HTTPS provider when configured, then SMTP.
    if (process.env.RESEND_API_KEY) order.push('resend');
    order.push('smtp');
  }

  if (fallback && !order.includes(fallback) && ['smtp', 'resend'].includes(fallback)) {
    order.push(fallback);
  }

  return order;
}

function buildEmailTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    return null;
  }

  const service = process.env.EMAIL_SERVICE || 'gmail';
  const host = process.env.EMAIL_HOST || (service.toLowerCase() === 'gmail' ? 'smtp.gmail.com' : undefined);
  const port = Number(process.env.EMAIL_PORT || 587);
  const secure = boolFromEnv(process.env.EMAIL_SECURE, port === 465);

  const transportOptions = {
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
    connectionTimeout: EMAIL_TIMEOUT_MS,
    greetingTimeout: EMAIL_TIMEOUT_MS,
    socketTimeout: EMAIL_TIMEOUT_MS,
    // Render can prefer IPv6 route paths that fail for some SMTP endpoints.
    family: 4,
    pool: true,
  };

  if (host) {
    transportOptions.host = host;
    transportOptions.port = port;
    transportOptions.secure = secure;
    transportOptions.requireTLS = !secure;
    transportOptions.tls = {
      servername: host,
      minVersion: 'TLSv1.2',
    };
  } else {
    transportOptions.service = service;
  }

  return nodemailer.createTransport(transportOptions);
}

const transporter = buildEmailTransporter();

function buildOtpEmailPayload(toEmail, otpCode) {
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'onboarding@resend.dev';
  return {
    from,
    to: toEmail,
    subject: 'Your OTP for Realtime Group App',
    html: `<p>Your One-Time Password (OTP) is: <strong>${otpCode}</strong></p><p>This code is valid for 10 minutes.</p>`,
  };
}

async function sendViaSmtp(payload) {
  if (!transporter) {
    throw new Error('SMTP is not configured. Set EMAIL_USER and EMAIL_APP_PASSWORD.');
  }

  const result = await transporter.sendMail(payload);
  return { provider: 'smtp', messageId: result.messageId };
}

async function sendViaResend(payload) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Resend is not configured. Set RESEND_API_KEY.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: payload.from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
      signal: controller.signal,
    });

    const bodyText = await response.text();
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (_) {
      body = { raw: bodyText };
    }

    if (!response.ok) {
      const details = body?.message || body?.error || bodyText || `HTTP ${response.status}`;
      throw new Error(`Resend API ${response.status}: ${details}`);
    }

    return { provider: 'resend', messageId: body?.id || 'unknown' };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Resend API timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendEmailOtp(toEmail, otpCode) {
  const payload = buildOtpEmailPayload(toEmail, otpCode);
  const providerOrder = getEmailProviderOrder();
  const failures = [];

  for (const provider of providerOrder) {
    try {
      const result = provider === 'resend'
        ? await sendViaResend(payload)
        : await sendViaSmtp(payload);

      console.log(
        `OTP email sent successfully to ${toEmail} via ${result.provider} (MessageID: ${result.messageId})`
      );
      return true;
    } catch (error) {
      failures.push(`${provider}: ${error.message}`);
      console.error(`Error sending OTP email to ${toEmail} via ${provider}:`, error.message);
    }
  }

  throw new Error(failures.join(' | ') || 'No email provider succeeded.');
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
