import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth"

export async function getCurrentUser() {
    const session = await getServerSession(authOptions)
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
