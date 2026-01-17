
import { z } from 'zod'

export const postSchema = z.object({
    content: z.string().min(1).max(5000),
    socialAccountId: z.string().cuid(),
    scheduledFor: z.string().datetime().optional()
})

export const newsSourceSchema = z.object({
    name: z.string().min(1),
    type: z.enum(['RSS', 'API', 'MANUAL']),
    config: z.record(z.any())
})

export const userProfileSchema = z.object({
    name: z.string().min(2).max(50),
    email: z.string().email().optional()
})
