const DEFAULT_ORIGINS = ['http://localhost:5173'];

function normalizeOrigin(origin) {
  return origin.replace(/\/$/, '');
}

function parseAllowedOrigins() {
  const configuredOrigins = process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '';

  const origins = configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin);

  if (origins.length === 0) {
    return DEFAULT_ORIGINS;
  }

  return origins;
}

function isVercelPreview(origin) {
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
}

function createCorsOriginValidator() {
  const allowedOrigins = parseAllowedOrigins();

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = normalizeOrigin(origin);
    const isAllowed = allowedOrigins.includes(normalizedOrigin) || isVercelPreview(normalizedOrigin);

    if (isAllowed) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} not allowed by CORS`));
  };
}

module.exports = {
  createCorsOriginValidator,
  parseAllowedOrigins,
};
