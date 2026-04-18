"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    BOT_TOKEN: zod_1.z.string().min(1, "BOT_TOKEN is required"),
    ALLOWED_USER_IDS: zod_1.z.string().min(1, "ALLOWED_USER_IDS is required")
        .transform((str) => str.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id))),
    CONF_PATH: zod_1.z.string().default(path_1.default.resolve(process.cwd(), '../conf.yml')),
    LOG_LEVEL: zod_1.z.string().default('info'),
});
const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
    console.error("❌ Invalid environment variables:", parsedEnv.error.format());
    process.exit(1);
}
exports.env = parsedEnv.data;
// codded by https://github.com/dominatos
