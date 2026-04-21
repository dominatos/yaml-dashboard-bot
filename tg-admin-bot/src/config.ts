import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

dotenv.config();

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  ALLOWED_USER_IDS: z.string().min(1, "ALLOWED_USER_IDS is required")
    .transform(str => str.split(',').map(id => id.trim()))
    .refine(
      tokens => tokens.every(token => /^\d+$/.test(token)),
      { message: "ALLOWED_USER_IDS must be a comma-separated list of numeric Telegram IDs" }
    )
    .transform(tokens => tokens.map(id => parseInt(id, 10))),
  CONF_PATH: z.string().default(path.resolve(process.cwd(), '../conf.yml')),
  LOG_LEVEL: z.string().default('info'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;

// codded by https://github.com/dominatos
