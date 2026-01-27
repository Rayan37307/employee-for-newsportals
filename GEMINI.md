# Project Overview

This is a Next.js application for automated news extraction from Bangladesh Guardian and social media card generation. It features a Canva-like design editor, automated content processing, and multi-platform publishing capabilities.

The project is built with a modern stack including Next.js 16, React 19, TypeScript, and Tailwind CSS. It uses PostgreSQL for the database with Prisma as the ORM. For image processing, it uses `puppeteer` and `playwright`. Authentication is handled by NextAuth.js.

## Building and Running

### Prerequisites

- Node.js 18+
- PostgreSQL database
- pnpm (recommended)

### Installation

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```

2.  **Set up environment variables:**
    Copy `.env.example` to `.env.local` and configure the following variables:
    ```env
    DATABASE_URL="postgresql://username:password@localhost:5432/newsagent"
    NEXTAUTH_URL="http://localhost:3000"
    NEXTAUTH_SECRET="your-secret-key"
    ```

3.  **Set up the database:**
    ```bash
    npx prisma migrate dev
    npx prisma generate
    ```

### Running the Application

-   **Development:**
    ```bash
    pnpm dev
    ```

-   **Production Build:**
    ```bash
    pnpm build
    ```

-   **Start Production Server:**
    ```bash
    pnpm start
    ```

### Testing

The project includes a few test scripts that can be run with `node`:

```bash
node test-card.js
node test-direct.ts
node test-extraction.ts
```

## Development Conventions

-   **Linting:** The project uses ESLint for code quality. Run the linter with `pnpm lint`.
-   **Database:** Database schema changes are managed with Prisma Migrate.
-   **Styling:** The project uses Tailwind CSS for styling.
-   **Authentication:** Authentication is handled by NextAuth.js.
-   **Image Generation:** The backend uses `fabric.js` and `node-canvas` for image generation.
