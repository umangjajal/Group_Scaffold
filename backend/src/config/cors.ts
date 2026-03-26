const DEFAULT_ORIGINS = ['http://localhost:5173'];

function normalizeOrigin(origin: string) {
  return origin.replace(/\/$/, '');
}

export function parseAllowedOrigins() {
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

function isVercelPreview(origin: string) {
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
}

export function createCorsOriginValidator() {
  const allowedOrigins = parseAllowedOrigins();

  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = normalizeOrigin(origin);
    const isAllowed =
      allowedOrigins.includes(normalizedOrigin) || isVercelPreview(normalizedOrigin);

    if (isAllowed) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} not allowed by CORS`));
  };
}
