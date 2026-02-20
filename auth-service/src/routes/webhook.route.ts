import express from 'express';
import logger from '../config/logger';
import { publishUserRegistered } from '../events/producers/userRegistered.producer';

const router = express.Router();

/**
 * Webhook to handle post-registration events
 * This endpoint will be called after better-auth creates a user
 */
router.post('/webhooks/user-registered', async (req, res) => {
    try {
        const { user } = req.body;

        if (!user || !user.id) {
            return res.status(400).json({ error: 'Invalid user data' });
        }

        logger.info(`Webhook received for new user: ${user.name || user.id}`);

        // Publish Kafka event for user registration
        await publishUserRegistered({
            key: user.id,
            value: {
                id: user.id,
                name: user.name,
                createdAt: user.createdAt || new Date(),
            },
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        logger.error('Failed to process user registration webhook:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export { router as webhookRouter };
