import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

dotenv.config();

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  ALLOWED_USER_IDS: z.string().min(1, "ALLOWED_USER_IDS is required")
    .transform((str) => str.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id))),
  CONF_PATH: z.string().default(path.resolve(process.cwd(), '../conf.yml')),
  LOG_LEVEL: z.string().default('info'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
