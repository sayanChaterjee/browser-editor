import axios from 'axios';
import { getCorrelationId } from '@ceditor/common';
import logger from '../config/logger';

/**
 * A dedicated Axios instance for internal microservice communication.
 * It automatically attaches:
 * 1. The shared internal gateway secret for security.
 * 2. The correlation ID for distributed tracing.
 */
const internalClient = axios.create();

internalClient.interceptors.request.use(
    (config) => {
        // 1. Attach Internal Security Secret
        const internalSecret = process.env.INTERNAL_GATEWAY_SECRET;
        if (internalSecret && config.headers) {
            config.headers['x-internal-secret'] = internalSecret;
        }

        // 2. Attach Correlation ID
        const correlationId = getCorrelationId();
        if (correlationId && config.headers) {
            config.headers['x-correlation-id'] = correlationId;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

internalClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const correlationId = getCorrelationId();
        logger.error(`Internal Axios request failed${correlationId ? ` [CID: ${correlationId}]` : ''}:`, {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            message: error.message,
        });
        return Promise.reject(error);
    }
);

export default internalClient;
