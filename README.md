# Bangladesh Guardian News Card Generator

A focused Next.js application for automated news extraction from Bangladesh Guardian and social media card generation. Features a Canva-like design editor, automated content processing, and multi-platform publishing capabilities.

## 🚀 Features

### Core Functionality
- **Bangladesh Guardian Integration**: Automated news extraction from Bangladesh Guardian's latest news page
- **Visual Card Editor**: Canva-like canvas editor with drag-and-drop functionality
- **Dynamic Templates**: Create reusable templates with dynamic field mapping
- **Multi-Platform Publishing**: Publish to Facebook, Twitter, LinkedIn, and Instagram
- **Auto-Pilot Mode**: Fully automated content generation and publishing
- **Content Validation**: Built-in sensitive content filtering and sanitization

### Technical Highlights
- **Modern Stack**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with multiple providers
- **UI Components**: Radix UI with custom styling
- **Image Processing**: Canvas, Fabric.js, Sharp, Puppeteer
- **Content Extraction**: Specialized Bangladesh Guardian scraper with Cheerio

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL database
- pnpm (recommended) or npm/yarn

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd news-agent
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Set up environment variables**
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

4. **Set up the database**
```bash
npx prisma migrate dev
npx prisma generate
```

5. **Start the development server**
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🏗️ Architecture

### Database Schema

The application uses PostgreSQL with the following main entities:

- **Users & Authentication**: User management with role-based access
- **Templates**: Canvas-based design templates with dynamic fields
- **News Cards**: Generated cards with Bangladesh Guardian article data
- **Social Accounts**: Connected social media platforms
- **Posts**: Scheduled and published content with metrics
- **Autopilot Settings**: Automation configurations

### Key Components

#### Frontend Structure
```
app/
├── api/                     # API routes
│   ├── auth/               # Authentication endpoints
│   ├── bangladesh-guardian/# Bangladesh Guardian endpoints
│   ├── cards/              # Card generation
│   ├── social/             # Social media publishing
│   └── autopilot/          # Automation endpoints
├── canvas/                 # Design editor interface
├── dashboard/              # Main dashboard
├── sources/                # Bangladesh Guardian source status
└── settings/               # Application settings
```

#### Core Libraries
- **Canvas Editor**: Custom Fabric.js-based editor with dynamic field support
- **Bangladesh Guardian Agent**: Specialized scraper for Bangladesh Guardian
- **Card Generation**: Puppeteer-based image generation
- **Social Publishing**: Platform-specific publishing APIs
- **Content Validation**: Sensitive content filtering and quality checks

## 📖 Usage Guide

### Quick Start (5-minute setup)

1. **Create a Template**
   - Go to `/canvas`
   - Design a card with dynamic fields:
     - Title text → `title` field
     - Date text → `date` field
     - Subtitle text → `subtitle` field
     - Image rectangle → `image` field
   - Save the template

2. **Fetch News**
   - Go to `/sources`
   - Click "Fetch News" to get latest articles from Bangladesh Guardian
   - View the status and last fetch time

3. **Generate Cards**
   - Go to `/cards`
   - Select an article from the dropdown
   - Select a template
   - Click "Generate Card"
   - Download the generated PNG

4. **Enable Auto-Pilot**
   - Go to `/dashboard`
   - Toggle auto-pilot to ON
   - Set checking interval (default: 15 minutes)

5. **Monitor Results**
   - Check `/history` for generated cards
   - View `/analytics` for performance metrics

### Advanced Features

#### Template Design
- **Dynamic Fields**: Map template elements to news data
  - `title`, `date`, `description`, `category`, `author`, `image`
- **Custom Fonts**: Upload and manage custom fonts
- **Responsive Design**: Templates adapt to different platform requirements

#### Bangladesh Guardian Integration
- **Web Scraping**: Intelligent content extraction from Bangladesh Guardian
- **Content Sanitization**: Automatic masking of sensitive words
- **Image Extraction**: Main image fetched from each article
- **Deduplication**: Prevents processing of duplicate articles

#### Social Media Integration
- **Facebook**: Page publishing with image support
- **Twitter**: Tweet publishing with media attachments
- **LinkedIn**: Article and post publishing
- **Instagram**: Image and story publishing

#### Automation
- **Scheduled Posting**: Time-based publishing with queue management
- **Content Filtering**: Sensitive word filtering and quality checks
- **Error Handling**: Retry logic and failure notifications
- **Performance Tracking**: Engagement metrics and analytics

## 🔧 Configuration

### Environment Variables

#### Required
- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_URL`: Application URL
- `NEXTAUTH_SECRET`: Authentication secret

#### Optional (Social Media)
- `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`: Facebook API credentials
- `TWITTER_API_KEY`, `TWITTER_API_SECRET`: Twitter API credentials
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth credentials

#### Optional (Features)
- `RESEND_API_KEY`: Email notifications
- `UPLOADTHING_SECRET`: File upload handling
- `CRON_SECRET`: Cron job security

### Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database (optional)
npx prisma db seed
```

## 🐳 Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t news-agent .
docker run -p 3000:3000 news-agent
```

## 📊 API Reference

### Authentication
```typescript
POST /api/auth/signin
POST /api/auth/signout
GET  /api/auth/session
```

### Bangladesh Guardian News
```typescript
GET    /api/bangladesh-guardian    # Fetch latest news
POST   /api/bangladesh-guardian    # Process and generate cards
```

### Card Generation
```typescript
GET    /api/cards            # List generated cards
POST   /api/cards            # Generate new card
GET    /api/cards/[id]       # Get card details
DELETE /api/cards/[id]       # Delete card
```

### Social Media
```typescript
GET    /api/social/accounts  # Connected accounts
POST   /api/social/publish   # Publish content
GET    /api/social/metrics   # Performance metrics
```

### Automation
```typescript
GET    /api/autopilot/status # Auto-pilot status
POST   /api/autopilot/run    # Trigger auto-pilot
PUT    /api/autopilot/settings # Update settings
```

## 🧪 Development

### Scripts
```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm db:push      # Push database schema
pnpm db:studio    # Open Prisma Studio
```

### Testing
```bash
# Run test scripts
node test-card.js          # Test card generation
node test-direct.ts        # Test direct extraction
node test-extraction.ts    # Test content extraction
```

### Project Structure
```
├── app/                   # Next.js app router
├── components/            # React components
│   ├── auth/             # Authentication components
│   ├── ui/               # Reusable UI components
│   └── canvas-editor.tsx # Main design editor
├── lib/                   # Utility libraries
│   ├── auth.ts           # Authentication configuration
│   ├── db.ts             # Database connection
│   ├── bangladesh-guardian-agent.ts # Bangladesh Guardian scraper
│   └── *.ts              # Various service modules
├── prisma/               # Database schema and migrations
├── public/               # Static assets
└── types/                # TypeScript type definitions
```

## 🔒 Security Features

- **Content Sanitization**: Automatic masking of sensitive words
- **Input Validation**: Zod-based schema validation
- **Authentication**: Secure session management
- **CORS Protection**: Cross-origin request handling
- **Rate Limiting**: API endpoint protection
- **SQL Injection Prevention**: Prisma ORM protection

## 🚀 Performance

- **Optimized Images**: Sharp-based image processing
- **Caching**: React Query for data caching
- **Database Indexing**: Optimized database queries
- **Lazy Loading**: Component-level code splitting
- **CDN Ready**: Static asset optimization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the [USAGE_GUIDE.md](./USAGE_GUIDE.md) for detailed instructions
- Review the [QUICK_SETUP.md](./QUICK_SETUP.md) for rapid deployment
- Open an issue for bug reports and feature requests

## 🗺️ Roadmap

- [ ] Additional social media platforms (TikTok, Pinterest)
- [ ] AI-powered content generation
- [ ] Advanced analytics dashboard
- [ ] Mobile app companion
- [ ] White-label customization
- [ ] Multi-language support
- [ ] Team collaboration features
