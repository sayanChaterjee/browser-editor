import logger from '../../config/logger';
import { USER_TOPICS } from '../../constants';
import { producer } from '../../config/kafka';

export const publishUserRegistered = async (data: any) => {
  const topic = USER_TOPICS.USER_REGISTERED;

  logger.info(
    `publishing message to topic: ${topic} with message: ${JSON.stringify(data)}`,
  );

  try {
    await producer.send({
      topic,
      messages: [
        {
          key: data.key,
          value: JSON.stringify(data.value),
        },
      ],
    });
  } catch (err) {
    logger.error(`Failed to publish to topic ${topic}:`, err);
    throw err;
  }
};