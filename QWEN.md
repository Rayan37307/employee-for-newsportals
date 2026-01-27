# Bangladesh Guardian News Card Generator

## Project Overview

This is a Next.js application for automated news extraction from Bangladesh Guardian and social media card generation. It features a Canva-like design editor, automated content processing, and multi-platform publishing capabilities. The application is built with a modern stack including Next.js 16, React 19, TypeScript, and Tailwind CSS, with PostgreSQL for the database using Prisma as the ORM.

### Key Features
- **Bangladesh Guardian Integration**: Automated news extraction from Bangladesh Guardian's latest news page
- **Visual Card Editor**: Canva-like canvas editor with drag-and-drop functionality
- **Dynamic Templates**: Create reusable templates with dynamic field mapping
- **Multi-Platform Publishing**: Publish to Facebook, Twitter, LinkedIn, and Instagram
- **Auto-Pilot Mode**: Fully automated content generation and publishing
- **Content Validation**: Built-in sensitive content filtering and sanitization

### Core Technologies
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with multiple providers
- **UI Components**: Radix UI with custom styling
- **Image Processing**: Canvas, Fabric.js, Sharp, Puppeteer
- **Content Extraction**: Specialized Bangladesh Guardian scraper with Cheerio

## Building and Running

### Prerequisites
- Node.js 18+
- PostgreSQL database
- pnpm (recommended) or npm/yarn

### Installation
1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
```

Configure the following variables:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/newsagent"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Social Media APIs (optional)
FACEBOOK_APP_ID="your-facebook-app-id"
FACEBOOK_APP_SECRET="your-facebook-app-secret"
TWITTER_API_KEY="your-twitter-api-key"
TWITTER_API_SECRET="your-twitter-api-secret"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

3. Set up the database:
```bash
npx prisma migrate dev
npx prisma generate
```

### Running the Application
- **Development:**
```bash
pnpm dev
```

- **Production Build:**
```bash
pnpm build
```

- **Start Production Server:**
```bash
pnpm start
```

### Testing
The project includes test scripts that can be run with `node`:
```bash
node test-card.js
node test-direct.ts
node test-extraction.ts
```

## Development Conventions

- **Linting**: The project uses ESLint for code quality. Run the linter with `pnpm lint`.
- **Database**: Database schema changes are managed with Prisma Migrate.
- **Styling**: The project uses Tailwind CSS for styling.
- **Authentication**: Authentication is handled by NextAuth.js.
- **Image Generation**: The backend uses `fabric.js` and `node-canvas` for image generation.
- **Content Sanitization**: Sensitive words are automatically masked (e.g., kill → Ki*ll, gaza → Ga*za).

## Project Structure

```
├── app/                   # Next.js app router pages
│   ├── api/              # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── bangladesh-guardian/ # Bangladesh Guardian endpoints
│   │   ├── cards/        # Card generation
│   │   ├── social/       # Social media publishing
│   │   └── autopilot/    # Automation endpoints
│   ├── canvas/           # Design editor interface
│   ├── dashboard/        # Main dashboard
│   ├── sources/          # Bangladesh Guardian source status
│   └── settings/         # Application settings
├── components/           # React components
│   ├── auth/            # Authentication components
│   ├── ui/              # Reusable UI components
│   └── canvas-editor.tsx # Main design editor
├── lib/                  # Utility libraries
│   ├── auth.ts          # Authentication configuration
│   ├── db.ts            # Database connection
│   ├── bangladesh-guardian-agent.ts # Bangladesh Guardian scraper
│   └── *.ts             # Various service modules
├── prisma/              # Database schema and migrations
├── public/              # Static assets
└── types/               # TypeScript type definitions
```

## Core Functionality

### Bangladesh Guardian Agent
Located in `lib/bangladesh-guardian-agent.ts`, this module handles:
- Fetching the latest news from Bangladesh Guardian's `/latest/` page
- Using Puppeteer for dynamic content rendering
- Content sanitization to mask sensitive words
- Extracting article titles, descriptions, images, and dates

### Card Generation
The application supports:
- Template-based card creation with dynamic fields
- Canvas-based editor for designing templates
- Automated card generation from news articles
- PNG image export functionality

### Authentication & Authorization
- Protected routes include `/dashboard`, `/canvas`, `/templates`, `/sources`, `/history`, `/analytics`
- NextAuth.js handles authentication with JWT tokens
- Middleware enforces authentication for protected routes

## API Endpoints

### Bangladesh Guardian News
- `GET /api/bangladesh-guardian` - Fetch latest news
- `POST /api/bangladesh-guardian` - Get all posted article links

### Card Generation
- `GET /api/cards` - List generated cards
- `POST /api/cards` - Generate new card

### Social Media
- `GET /api/social/accounts` - Connected accounts
- `POST /api/social/publish` - Publish content
- `GET /api/social/metrics` - Performance metrics

### Automation
- `GET /api/autopilot/status` - Auto-pilot status
- `POST /api/autopilot/run` - Trigger auto-pilot
- `PUT /api/autopilot/settings` - Update settings

## Database Schema

Main entities include:
- **Users & Authentication**: User management with role-based access
- **Templates**: Canvas-based design templates with dynamic fields
- **News Cards**: Generated cards with Bangladesh Guardian article data
- **Social Accounts**: Connected social media platforms
- **Posts**: Scheduled and published content with metrics
- **Autopilot Settings**: Automation configurations

## Security Features

- **Content Sanitization**: Automatic masking of sensitive words
- **Input Validation**: Zod-based schema validation
- **Authentication**: Secure session management
- **CORS Protection**: Cross-origin request handling
- **Rate Limiting**: API endpoint protection
- **SQL Injection Prevention**: Prisma ORM protection

## Performance Optimization

- **Optimized Images**: Sharp-based image processing
- **Caching**: React Query for data caching
- **Database Indexing**: Optimized database queries
- **Lazy Loading**: Component-level code splitting
- **CDN Ready**: Static asset optimization