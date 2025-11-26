/**
 * AI Grading Queue Test Script
 * 
 * Tests the BullMQ queue infrastructure by adding a dummy job.
 * Gracefully handles Redis connection failures.
 */

import { aiGradingQueue, closeQueue } from '../lib/queue'

async function testQueue() {
    console.log('🧪 Testing AI Grading Queue...\n')

    if (!aiGradingQueue) {
        console.error('❌ Queue not initialized - Redis connection failed')
        console.log('💡 Make sure Redis is running and REDIS_URL is set correctly')
        console.log('   Example: REDIS_URL=redis://localhost:6379\n')
        process.exit(1)
    }

    try {
        // Add a test job
        const job = await aiGradingQueue.add('test-job', {
            type: 'test',
            timestamp: Date.now(),
            message: 'This is a test job to verify queue functionality'
        })

        console.log('✅ Successfully added test job to queue')
        console.log(`   Job ID: ${job.id}`)
        console.log(`   Queue: ${job.queueName}`)
        console.log(`   Data:`, job.data)
        console.log('\n🎉 Queue test passed!\n')

        // Get queue stats
        const jobCounts = await aiGradingQueue.getJobCounts()
        console.log('📊 Queue stats:')
        console.log(`   Waiting: ${jobCounts.waiting}`)
        console.log(`   Active: ${jobCounts.active}`)
        console.log(`   Completed: ${jobCounts.completed}`)
        console.log(`   Failed: ${jobCounts.failed}`)

    } catch (error) {
        console.error('❌ Failed to add job to queue:', error)
        process.exit(1)
    } finally {
        // Clean up
        console.log('\n🧹 Closing queue connection...')
        await closeQueue()
        console.log('✅ Queue closed\n')
    }
}

testQueue().catch((error) => {
    console.error('💥 Unexpected error:', error)
    process.exit(1)
})
