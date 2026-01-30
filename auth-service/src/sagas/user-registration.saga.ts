import { SagaCoordinator, SagaStep } from './saga-coordinator';
import axios from 'axios';
import logger from '../config/logger';
import { User } from '../models/user.model';

interface RegistrationData {
    userId: string;
    email: string;
    name?: string;
}

export class UserRegistrationSaga {
    constructor(private sagaCoordinator: SagaCoordinator) { }

    async execute(userId: string, email: string, name?: string): Promise<void> {
        const sagaId = `user-reg-${userId}-${Date.now()}`;
        const data: RegistrationData = { userId, email, name };

        const steps: SagaStep[] = [
            {
                name: 'create-user-profile',
                execute: async () => {
                    logger.info(`Creating user profile for ${userId}`);

                    try {
                        const response = await axios.post(
                            `${process.env.USER_SERVICE_URL || 'http://user-service:3002'}/profile`,
                            {
                                userId,
                                email,
                                name: name || email.split('@')[0],
                            },
                            {
                                headers: {
                                    'x-user-id': userId,
                                    'x-saga-id': sagaId,
                                },
                                timeout: 5000,
                            }
                        );

                        logger.info(`User profile created: ${response.data._id}`);
                        return { profileId: response.data._id };
                    } catch (error: any) {
                        logger.error('Failed to create user profile:', error.message);
                        throw new Error(`Profile creation failed: ${error.message}`);
                    }
                },
                compensate: async () => {
                    logger.info(`Compensating: Deleting user profile for ${userId}`);

                    try {
                        await axios.delete(
                            `${process.env.USER_SERVICE_URL || 'http://user-service:3002'}/profile/${userId}`,
                            {
                                headers: {
                                    'x-user-id': userId,
                                    'x-saga-id': sagaId,
                                },
                                timeout: 5000,
                            }
                        );
                        logger.info(`User profile deleted for ${userId}`);
                    } catch (error: any) {
                        logger.error(`Failed to delete user profile for ${userId}:`, error.message);
                    }
                },
            },
            {
                name: 'create-default-workspace',
                execute: async () => {
                    logger.info(`Creating default workspace for ${userId}`);

                    try {
                        const response = await axios.post(
                            `${process.env.CODE_SERVICE_URL || 'http://code-service:3003'}/save`,
                            {
                                name: 'My First Project',
                                html: '<!DOCTYPE html>\n<html>\n<head>\n  <title>My Project</title>\n</head>\n<body>\n  <h1>Welcome to your project</h1>\n  <p>Start coding here!</p>\n</body>\n</html>',
                                css: '/* Add your styles here */\nbody {\n  font-family: Arial, sans-serif;\n  margin: 20px;\n}',
                                js: '// Add your JavaScript here\nconsole.log("Hello World!");',
                            },
                            {
                                headers: {
                                    'x-user-id': userId,
                                    'x-saga-id': sagaId,
                                },
                                timeout: 5000,
                            }
                        );

                        logger.info(`Default workspace created: ${response.data._id}`);
                        return { workspaceId: response.data._id };
                    } catch (error: any) {
                        logger.error('Failed to create default workspace:', error.message);
                        throw new Error(`Workspace creation failed: ${error.message}`);
                    }
                },
                compensate: async () => {
                    logger.info(`Compensating: Deleting default workspace for ${userId}`);

                    try {
                        const projectsRes = await axios.get(
                            `${process.env.CODE_SERVICE_URL || 'http://code-service:3003'}/`,
                            {
                                headers: {
                                    'x-user-id': userId,
                                    'x-saga-id': sagaId,
                                },
                                timeout: 5000,
                            }
                        );

                        const defaultProject = projectsRes.data.find(
                            (p: any) => p.name === 'My First Project'
                        );

                        if (defaultProject) {
                            await axios.delete(
                                `${process.env.CODE_SERVICE_URL || 'http://code-service:3003'}/${defaultProject._id}`,
                                {
                                    headers: {
                                        'x-user-id': userId,
                                        'x-saga-id': sagaId,
                                    },
                                    timeout: 5000,
                                }
                            );
                            logger.info(`Default workspace deleted for ${userId}`);
                        }
                    } catch (error: any) {
                        logger.error(`Failed to delete workspace for ${userId}:`, error.message);
                    }
                },
            },
        ];

        try {
            const result = await this.sagaCoordinator.startSaga(sagaId, steps, data);
            logger.info(`User registration saga completed for ${userId}`, result);
        } catch (error) {
            logger.error(`User registration saga failed for ${userId}:`, error);
            throw error;
        }
    }
}
