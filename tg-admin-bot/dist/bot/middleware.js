"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
const authMiddleware = async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) {
        logger_1.logger.warn('Received update without user ID');
        return;
    }
    if (!config_1.env.ALLOWED_USER_IDS.includes(userId)) {
        logger_1.logger.warn({ userId }, 'Unauthorized access attempt');
        try {
            await ctx.reply('⛔ Unauthorized. You are not allowed to use this bot.');
        }
        catch (e) {
            // ignore
        }
        return;
    }
    return next();
};
exports.authMiddleware = authMiddleware;
// codded by https://github.com/dominatos
