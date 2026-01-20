import { Queue } from 'bullmq'
import Redis from 'ioredis'

/**
 * AI Grading Queue Configuration
 * 
 * Required environment variables:
 * - REDIS_URL: Redis connection string (e.g., redis://localhost:6379)
 * 
 * If REDIS_URL is not set, falls back to localhost:6379
 */

let connection: Redis | null = null

try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

    connection = new Redis(redisUrl, {
        maxRetriesPerRequest: null, // Required for BullMQ
        retryStrategy: (times) => {
            if (times > 3) {
                console.error('[Queue] Redis connection failed after 3 retries')
                return null // Stop retrying
            }
            const delay = Math.min(times * 50, 2000)
            return delay
        }
    })

    connection.on('error', (error) => {
        console.error('[Queue] Redis connection error:', error.message)
    })

    connection.on('connect', () => {
        console.log('[Queue] Redis connected successfully')
    })

} catch (error) {
    console.error('[Queue] Failed to initialize Redis connection:', error)
}

/**
 * AI Grading Queue
 * 
 * Used to enqueue AI grading jobs for student answers.
 * Jobs should include: { attemptId, questionId, answerId }
 */
export const aiGradingQueue = connection
    ? new Queue('ai-grading', {
        connection,
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000
            },
            removeOnComplete: {
                age: 3600, // Keep completed jobs for 1 hour
                count: 100
            },
            removeOnFail: {
                age: 7 * 24 * 3600, // Keep failed jobs for 7 days
                count: 1000
            }
        }
    })
    : null

if (!aiGradingQueue) {
    console.warn('[Queue] AI grading queue not initialized due to Redis connection failure')
}

/**
 * Export Queue
 *
 * Used to queue PDF/CSV export jobs for large datasets.
 * Jobs include: { examId, classIds?, type: 'pdf' | 'csv' }
 */
export const exportQueue = connection
    ? new Queue('export', {
        connection,
        defaultJobOptions: {
            attempts: 2,
            backoff: {
                type: 'fixed',
                delay: 5000
            },
            removeOnComplete: {
                age: 3600, // Keep completed jobs for 1 hour
                count: 50
            },
            removeOnFail: {
                age: 24 * 3600, // Keep failed jobs for 24 hours
                count: 100
            }
        }
    })
    : null

if (!exportQueue) {
    console.warn('[Queue] Export queue not initialized due to Redis connection failure')
}

/**
 * Gracefully close the queue and Redis connection
 */
export async function closeQueue() {
    if (aiGradingQueue) {
        await aiGradingQueue.close()
    }
    if (exportQueue) {
        await exportQueue.close()
    }
    if (connection) {
        await connection.quit()
    }
}
