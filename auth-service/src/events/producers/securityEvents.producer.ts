import { producer } from '../../config/kafka';
import logger from '../../config/logger';

export const publishSecurityEvent = async ({ userId, event }: { userId: string, event: 'PASSWORD_CHANGED' | 'LOGOUT_ALL' }) => {
    try {
        // Shared producer is connected during app init in app.ts
        await producer.send({
            topic: 'user-security-updates',
            messages: [
                {
                    key: userId,
                    value: JSON.stringify({ userId, event, timestamp: new Date().toISOString() }),
                },
            ],
        });
        logger.info(`Security event [${event}] published for user: ${userId}`);
    } catch (err) {
        logger.error('Failed to publish security event', err);
    }
};
