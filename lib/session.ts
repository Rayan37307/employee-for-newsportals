import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth"

export async function getCurrentUser() {
    const session = await getServerSession(authOptions)

    // Development fallback
    if (process.env.NODE_ENV === 'development' && !session) {
        const prisma = (await import('@/lib/db')).default
        // Try to finding existing dev user, or return basic object matching User type
        const user = await prisma.user.findUnique({ where: { id: 'dev-user-id' } })
        if (user) return user
    }

    return session?.user
}

export async function requireAuth() {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
        throw new Error("Unauthorized")
    }

    return session.user
}

export async function requireAdmin() {
    const user = await requireAuth()

    if (user.role !== "ADMIN") {
        throw new Error("Forbidden: Admin access required")
    }

    return user
}
