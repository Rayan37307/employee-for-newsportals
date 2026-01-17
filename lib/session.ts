import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth"

export async function getCurrentUser() {
    const session = await getServerSession(authOptions)
    
    console.log('Session exists:', !!session)
    if (session?.user) {
        console.log('Session user:', JSON.stringify(session.user))
    }

    // If no session or no email, return null
    if (!session?.user?.email) {
        console.log('No session or email found')
        return null
    }

    try {
        const prisma = (await import('@/lib/db')).default

        // Try to find user by email first
        let user = await prisma.user.findUnique({
            where: { email: session.user.email },
        })

        console.log('User found by email:', !!user)

        // If not found by email, try by ID
        if (!user && session.user.id) {
            user = await prisma.user.findUnique({
                where: { id: session.user.id },
            })
            console.log('User found by ID:', !!user)
        }

        // If still not found and we have OAuth data, create user
        if (!user && (session.user.image || session.user.name || session.user.email)) {
            console.log('Creating new user from session')
            try {
                user = await prisma.user.create({
                    data: {
                        email: session.user.email!,
                        name: session.user.name,
                        image: session.user.image,
                        role: 'USER',
                    }
                })
                console.log('User created successfully:', user.id)
            } catch (createError) {
                console.error('Error creating user:', createError)
            }
        }

        if (!user) {
            console.log('User not found and could not be created')
            return null
        }

        return user
    } catch (error) {
        console.error('Error in getCurrentUser:', error)
        return null
    }
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
