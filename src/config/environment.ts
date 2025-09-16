import dotenv from 'dotenv';

dotenv.config();

const parseNumber = (value: string | undefined, defaultValue: number): number => {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};


const config = {
  PORT: parseNumber(process.env.PORT, 3000),
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  RATE_LIMIT_MAX: parseNumber(process.env.RATE_LIMIT_MAX, 100),
  RATE_LIMIT_TIME_WINDOW: process.env.RATE_LIMIT_TIME_WINDOW || '1 minute',
} as const;

export default config;