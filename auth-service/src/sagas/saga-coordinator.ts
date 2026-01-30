import { Kafka, Producer } from 'kafkajs';
import logger from '../config/logger';

export enum SagaStatus {
    PENDING = 'PENDING',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    COMPENSATING = 'COMPENSATING',
    COMPENSATED = 'COMPENSATED',
}

export interface SagaStep {
    name: string;
    execute: () => Promise<any>;
    compensate: () => Promise<void>;
}

export interface SagaState {
    sagaId: string;
    status: SagaStatus;
    completedSteps: string[];
    error?: string;
    data?: any;
}

export class SagaCoordinator {
    private producer: Producer;
    private sagaState: Map<string, SagaState> = new Map();

    constructor(kafka: Kafka) {
        this.producer = kafka.producer();
    }

    async init(): Promise<void> {
        await this.producer.connect();
        logger.info('Saga coordinator initialized');
    }

    async startSaga(
        sagaId: string,
        steps: SagaStep[],
        initialData?: any
    ): Promise<SagaState> {
        const state: SagaState = {
            sagaId,
            status: SagaStatus.IN_PROGRESS,
            completedSteps: [],
            data: initialData,
        };

        this.sagaState.set(sagaId, state);
        logger.info(`Starting saga ${sagaId} with ${steps.length} steps`);

        try {
            for (const step of steps) {
                logger.info(`Executing step: ${step.name} for saga ${sagaId}`);

                const result = await step.execute();
                state.data = { ...state.data, ...result };
                state.completedSteps.push(step.name);

                await this.publishSagaEvent('step-completed', {
                    sagaId,
                    stepName: step.name,
                    data: state.data,
                });
            }

            state.status = SagaStatus.COMPLETED;
            await this.publishSagaEvent('saga-completed', { sagaId, data: state.data });
            logger.info(`Saga ${sagaId} completed successfully`);

            return state;
        } catch (error: any) {
            logger.error(`Saga ${sagaId} failed at step ${state.completedSteps.length + 1}:`, error);
            state.status = SagaStatus.FAILED;
            state.error = error.message;

            await this.compensate(sagaId, steps);
            throw error;
        }
    }

    private async compensate(sagaId: string, steps: SagaStep[]): Promise<void> {
        const state = this.sagaState.get(sagaId);
        if (!state) return;

        state.status = SagaStatus.COMPENSATING;
        logger.info(`Starting compensation for saga ${sagaId}`);

        const completedSteps = state.completedSteps;
        const stepsToCompensate = steps
            .filter(step => completedSteps.includes(step.name))
            .reverse();

        for (const step of stepsToCompensate) {
            try {
                logger.info(`Compensating step: ${step.name}`);
                await step.compensate();
                await this.publishSagaEvent('step-compensated', {
                    sagaId,
                    stepName: step.name,
                });
            } catch (error: any) {
                logger.error(`Failed to compensate step ${step.name}:`, error);
            }
        }

        state.status = SagaStatus.COMPENSATED;
        await this.publishSagaEvent('saga-compensated', { sagaId });
        logger.info(`Saga ${sagaId} compensated`);
    }

    private async publishSagaEvent(eventType: string, payload: any): Promise<void> {
        try {
            await this.producer.send({
                topic: 'saga-events',
                messages: [
                    {
                        key: payload.sagaId,
                        value: JSON.stringify({
                            eventType,
                            ...payload,
                            timestamp: new Date().toISOString(),
                        }),
                    },
                ],
            });
        } catch (error) {
            logger.error(`Failed to publish saga event ${eventType}:`, error);
        }
    }

    getSagaState(sagaId: string): SagaState | undefined {
        return this.sagaState.get(sagaId);
    }

    async shutdown(): Promise<void> {
        await this.producer.disconnect();
        logger.info('Saga coordinator shut down');
    }
}
