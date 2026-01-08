// Queue Status Handler
// Manages the processing queue and notifies Discord of status changes

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATUS_FILE = path.join(__dirname, '../../prompts/queue-status.json');

// Status constants
export const QueueStatus = {
    IDLE: 'idle',
    PROCESSING: 'processing',
    ERROR: 'error'
};

/**
 * Read current queue status
 */
export function getQueueStatus() {
    try {
        if (fs.existsSync(STATUS_FILE)) {
            const data = fs.readFileSync(STATUS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading queue status:', error);
    }
    return { status: QueueStatus.IDLE, queue: [], currentPrompt: null };
}

/**
 * Update queue status
 */
export function setQueueStatus(status, currentPrompt = null, error = null) {
    try {
        const data = {
            status,
            currentPrompt,
            queue: getQueueStatus().queue || [],
            lastUpdated: new Date().toISOString(),
            lastError: error
        };
        fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 4));
        return true;
    } catch (error) {
        console.error('Error writing queue status:', error);
        return false;
    }
}

/**
 * Add prompt to queue
 */
export function addToQueue(promptInfo) {
    try {
        const status = getQueueStatus();
        status.queue.push({
            ...promptInfo,
            addedAt: new Date().toISOString()
        });
        fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 4));
        return status.queue.length;
    } catch (error) {
        console.error('Error adding to queue:', error);
        return -1;
    }
}

/**
 * Get next item from queue
 */
export function getNextFromQueue() {
    try {
        const status = getQueueStatus();
        if (status.queue.length > 0) {
            const next = status.queue.shift();
            status.status = QueueStatus.PROCESSING;
            status.currentPrompt = next;
            status.lastUpdated = new Date().toISOString();
            fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 4));
            return next;
        }
    } catch (error) {
        console.error('Error getting from queue:', error);
    }
    return null;
}

/**
 * Mark current processing as complete
 */
export function markComplete() {
    return setQueueStatus(QueueStatus.IDLE, null, null);
}

/**
 * Mark current processing as failed
 */
export function markError(errorMessage) {
    return setQueueStatus(QueueStatus.ERROR, null, errorMessage);
}

/**
 * Check if queue is busy
 */
export function isBusy() {
    const status = getQueueStatus();
    return status.status === QueueStatus.PROCESSING;
}

/**
 * Get queue position for display
 */
export function getQueuePosition() {
    const status = getQueueStatus();
    return {
        isBusy: status.status === QueueStatus.PROCESSING,
        queueLength: status.queue?.length || 0,
        currentPrompt: status.currentPrompt?.title || null
    };
}
