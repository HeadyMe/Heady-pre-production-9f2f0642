import { Request, Response, NextFunction } from 'express';

/**
 * Data Loss Prevention (DLP) & Prompt Extraction Defense
 * 
 * Analyzes API prompt variance submitted by admin accounts.
 * Blocks automated probing attacks designed to steal AI logic.
 */

interface PromptHistory {
    timestamp: number;
    promptSignature: string;
}

// In-memory or Redis-backed map of user activity
const userPromptHistory: Map<string, PromptHistory[]> = new Map();

// Extraction Defense Configuration
const MAX_SIMILAR_PROMPTS_PER_MIN = 10;

function calculateVariance(current: string, history: PromptHistory[]): number {
    // A sophisticated mathematical variance calculation would happen here.
    // We'll use a simplistic metric for demonstration.
    let similarityScore = 0;
    for (const record of history) {
        if (current.includes(record.promptSignature) || record.promptSignature.includes(current)) {
            similarityScore += 1;
        }
    }
    return similarityScore / (history.length || 1);
}

export const dlpExtractionDefense = (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id || req.ip;
    const prompt = req.body?.prompt;

    if (prompt && typeof prompt === 'string') {
        const now = Date.now();
        const userHistory = userPromptHistory.get(userId) || [];

        // Clean up old history (older than 1 minute)
        const recentHistory = userHistory.filter(h => now - h.timestamp < 60000);

        const variance = calculateVariance(prompt, recentHistory);

        // If prompts are too similar and too frequent, flag as extraction attempt
        if (recentHistory.length >= MAX_SIMILAR_PROMPTS_PER_MIN && variance > 0.8) {
            console.warn(`[SECURITY ALERT] Possible model extraction attack detected from User/IP: ${userId}`);

            // Silently shadow-ban the user by returning generic/degraded outputs
            // or inserting an invisible cryptographic watermark.
            res.locals.isShadowBanned = true;
            res.locals.watermark = "HEADY_CRYPTO_WATERMARK_V1_" + userId;

            // We can let them proceed but their output will be watermarked/degraded
        }

        recentHistory.push({ timestamp: now, promptSignature: prompt.substring(0, 50) });
        userPromptHistory.set(userId, recentHistory);
    }

    next();
};
