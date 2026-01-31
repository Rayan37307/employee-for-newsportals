# News Agent - Agent Guidelines

## Build, Lint & Test Commands

```bash
# Development
pnpm dev              # Start Next.js dev server on http://localhost:3000

# Build & Production
pnpm build            # Build production bundle
pnpm start            # Start production server

# Linting & Type Checking
pnpm lint             # Run ESLint (based on next/core-web-vitals + typescript)

# Database
npx prisma generate   # Generate Prisma client
npx prisma migrate dev # Run database migrations
pnpm db:push          # Push schema changes without migration
pnpm db:studio        # Open Prisma Studio (database GUI)

# Testing (Manual scripts)
node test-card.js          # Test card generation
node test-direct.ts        # Test direct extraction
node test-extraction.ts    # Test content extraction
```

## Project Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js v4
- **UI**: Radix UI primitives with custom shadcn/ui components
- **Styling**: Tailwind CSS v4, clsx, tailwind-merge
- **State**: Zustand, React Query (@tanstack/react-query)
- **Validation**: Zod schemas
- **Image Processing**: Puppeteer, Canvas, Fabric.js, Sharp, Konva

## Code Style Guidelines

### Imports

```typescript
// Use path aliases for internal modules
import prisma from '@/lib/db'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Type imports for types only
import type { ReactNode } from 'react'
import type { User } from '@prisma/client'

// Named imports preferred
import { useState, useEffect } from 'react'

// React components
import * as React from 'react'  // For UI components extending React attributes
```

### Component Patterns

```typescript
// Client components - must include 'use client' at top
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function MyComponent({ prop }: { prop: string }) {
  // Client-side hooks and event handlers
  return <div>{prop}</div>
}

// Server components - default (no 'use client' needed)
import prisma from '@/lib/db'

export default async function ServerComponent() {
  const data = await prisma.user.findMany()
  return <div>{data.length} users</div>
}

// UI components with variants (shadcn/ui pattern)
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const variants = cva('base-classes', {
  variants: {
    variant: { default: '', destructive: '' }
  }
})

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof variants> {}

const MyButton = React.forwardRef<HTMLButtonElement, Props>(
  ({ className, variant, ...props }, ref) => {
    return <button className={cn(variants({ variant, className }))} ref={ref} {...props} />
  }
)
MyButton.displayName = 'MyButton'
```

### API Routes (App Router)

```typescript
import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

// GET /api/resource
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50

    const data = await prisma.model.findMany({ take: limit })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching data:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}

// POST /api/resource
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.requiredField) {
      return NextResponse.json({ error: 'Field is required' }, { status: 400 })
    }

    const created = await prisma.model.create({ data: body })
    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    console.error('Error creating data:', error)
    return NextResponse.json({ error: 'Failed to create data' }, { status: 500 })
  }
}
```

### Database Patterns

```typescript
import prisma from '@/lib/db'

// Singleton pattern (already defined in lib/db.ts)
// Always import from @/lib/db, don't create new PrismaClient instances

// Queries with error handling
export async function getNewsCards(limit = 50) {
  try {
    return await prisma.newsCard.findMany({
      where: { status: 'GENERATED' },
      include: {
        template: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })
  } catch (error) {
    console.error('Database query failed:', error)
    throw error
  }
}

// Use Prisma enums defined in schema.prisma
// UserRole: USER, ADMIN
// CardStatus: DRAFT, GENERATED, POSTED, FAILED, QUEUED
// PostStatus: QUEUED, POSTING, POSTED, FAILED
// AutopilotStatus: RUNNING, COMPLETED, FAILED, CANCELLED
// TemplateCategory: BREAKING_NEWS, ANALYSIS, OPINION, PHOTO_STORY, INFOGRAPHIC, QUOTE, CUSTOM
// SocialPlatform: FACEBOOK, TWITTER, LINKEDIN, INSTAGRAM
```

### Validation with Zod

```typescript
import { z } from 'zod'
import { postSchema } from '@/lib/validation'

// Define schemas in lib/validation.ts
export const postSchema = z.object({
  content: z.string().min(1).max(5000),
  socialAccountId: z.string().cuid(),
  scheduledFor: z.string().datetime().optional()
})

// Use in API routes
const result = postSchema.safeParse(body)
if (!result.success) {
  return NextResponse.json({ error: 'Validation failed', issues: result.error.issues }, { status: 400 })
}
```

### Naming Conventions

- **Files**: kebab-case (`news-card-generator.ts`, `api/cards/route.ts`)
- **Components**: PascalCase (`NewsCard.tsx`, `DashboardLayout.tsx`)
- **Functions**: camelCase (`fetchNews`, `generateCard`)
- **Constants**: SCREAMING_SNAKE_CASE (`BASE_URL`, `API_ENDPOINTS`)
- **Interfaces/Types**: PascalCase (`NewsItem`, `User`, `PostOptions`)
- **Enums**: PascalCase with SCREAMING_SNAKE_CASE values (Prisma pattern)
- **Database Tables**: snake_case (Prisma @@map, e.g., `news_cards`)
- **API Routes**: lowercase with hyphens (`/api/bangladesh-guardian`)

### Error Handling

```typescript
// API routes - return NextResponse with appropriate status
try {
  // operation
} catch (error) {
  console.error('Context-specific error:', error)
  return NextResponse.json({ error: 'User-friendly message' }, { status: 500 })
}

// Client components - use try/catch with alert/toast
const handleSubmit = async () => {
  try {
    const res = await fetch('/api/resource', { method: 'POST', body: JSON.stringify(data) })
    if (!res.ok) throw new Error('Request failed')
    // handle success
  } catch (error) {
    console.error('Submit error:', error)
    // show toast notification
  }
}

// Database queries - log and rethrow
try {
  return await prisma.model.create({ data })
} catch (error) {
  console.error('Database error:', error)
  throw new Error('Failed to save record')
}
```

### Styling & Classes

```typescript
// Use cn() utility for merging Tailwind classes
import { cn } from '@/lib/utils'

<div className={cn('base-classes', isActive && 'active-classes', className)}>

// Tailwind v4 patterns (no @apply in utility classes)
// Use component variants with CVA for complex styling

// Color palette from shadcn/ui:
// - primary, secondary, accent, muted, background, foreground
// - destructive, border, input, ring
```

### Sensitive Content Handling

```typescript
import { sanitizeText } from '@/lib/bangladesh-guardian-agent'

// Always sanitize user-facing text
const sanitizedTitle = sanitizeText(article.title)

// Sensitive words are masked with asterisks
// Example: "kill" -> "Ki*ll", "gaza" -> "Ga*za"
```

### Authentication

```typescript
// Server-side auth check in API routes
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // proceed with authenticated request
}

// Client-side auth check
'use client'
import { useSession } from 'next-auth/react'

const { data: session, status } = useSession()
if (status === 'unauthenticated') {
  // redirect or show login
}
```

### Environment Variables

- Never commit `.env` files (in .gitignore)
- Required: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- Optional: Social media API keys, Google OAuth, Email services
- Access via `process.env.VARIABLE_NAME`
- Type-check with process.env assertions in lib files if needed

### Performance Best Practices

- Use React Query for data fetching and caching
- Lazy load heavy components with `import()`
- Use `loading.tsx` and `error.tsx` for route loading/error states
- Optimize images with Next.js Image component
- Use Prisma select/include to limit returned fields
- Implement pagination for large datasets
