import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'

// GET /api/templates/[id] - Get single template
export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const template = await prisma.template.findUnique({
            where: { id: params.id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        })

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }

        return NextResponse.json(template)
    } catch (error) {
        console.error('Error fetching template:', error)
        return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
    }
}

// PATCH /api/templates/[id] - Update template
export async function PATCH(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const template = await prisma.template.findUnique({
            where: { id: params.id },
        })

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }

        if (template.userId !== user.id && user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const updatedTemplate = await prisma.template.update({
            where: { id: params.id },
            data: body,
        })

        return NextResponse.json(updatedTemplate)
    } catch (error) {
        console.error('Error updating template:', error)
        return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }
}

// DELETE /api/templates/[id] - Delete template
export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const template = await prisma.template.findUnique({
            where: { id: params.id },
        })

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }

        if (template.userId !== user.id && user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        if (template.isSystem) {
            return NextResponse.json({ error: 'Cannot delete system templates' }, { status: 403 })
        }

        await prisma.template.delete({
            where: { id: params.id },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting template:', error)
        return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
    }
}
