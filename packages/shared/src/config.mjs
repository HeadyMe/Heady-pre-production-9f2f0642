import path from 'node:path';

export function parseOrigins(raw) {
  if (!raw) return ['http://localhost:3400', 'http://127.0.0.1:3400'];
  return raw.split(',').map((value) => value.trim()).filter(Boolean);
}

export function resolveDataDir(env = process.env) {
  const configured = env.HEADY_DATA_DIR || './data';
  return path.resolve(process.cwd(), configured);
}

export function getConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3400),
    nodeEnv: env.NODE_ENV || 'development',
    jwtSecret: env.JWT_SECRET || 'change-this-in-production',
    origins: parseOrigins(env.CORS_ORIGINS),
    databaseUrl: env.DATABASE_URL || '',
    dataDir: resolveDataDir(env),
    autoPromoteFirstUser: String(env.HEADY_OWNER_AUTO_PROMOTE_FIRST_USER || 'true') !== 'false'
  };
}
