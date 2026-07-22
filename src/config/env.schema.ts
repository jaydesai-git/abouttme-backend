import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  R2_ENDPOINT: z.url('R2_ENDPOINT must be a valid URL'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET_NAME: z.string().min(1, 'R2_BUCKET_NAME is required'),
  ZEPTO_MAIL_API_KEY: z.string().min(1, 'ZEPTO_MAIL_API_KEY is required'),
  ZEPTO_MAIL_FROM: z
    .email('ZEPTO_MAIL_FROM must be a valid email')
    .default('noreply@colourscube.com'),
  ZEPTO_MAIL_FROM_NAME: z.string().min(1).default('noreply'),
  ZEPTO_MAIL_URL: z
    .url('ZEPTO_MAIL_URL must be a valid URL')
    .default('https://api.zeptomail.in/v1.1/email'),
});

export type Env = z.infer<typeof envSchema>;
