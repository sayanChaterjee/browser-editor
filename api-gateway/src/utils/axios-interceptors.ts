import axios from 'axios';
import { getCorrelationId } from '@ceditor/common';
import logger from '../config/logger';

/**
 * Setup Axios interceptors to automatically inject correlation ID
 * from AsyncLocalStorage context into all outgoing requests
 */
export function setupAxiosInterceptors() {
    // Request interceptor - auto-inject correlation ID
    axios.interceptors.request.use(
        (config) => {
            const correlationId = getCorrelationId();

            if (correlationId && config.headers) {
                config.headers['x-correlation-id'] = correlationId;
            }

            // Auto-inject internal gateway secret for microservice communication
            const internalSecret = process.env.INTERNAL_GATEWAY_SECRET;
            if (internalSecret && config.headers) {
                config.headers['x-internal-secret'] = internalSecret;
            }

            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );

    // Response interceptor - log errors with correlation ID
    axios.interceptors.response.use(
        (response) => response,
        (error) => {
            const correlationId = getCorrelationId();
            logger.error(`Axios request failed${correlationId ? ` [CID: ${correlationId}]` : ''}:`, {
                url: error.config?.url,
                method: error.config?.method,
                status: error.response?.status,
                message: error.message,
            });
            return Promise.reject(error);
        }
    );

    logger.info('Axios interceptors initialized - correlation ID will auto-propagate');
}
