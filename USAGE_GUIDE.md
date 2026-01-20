# Bangladesh Guardian News API & Card Generator

## Quick Start

### 1. Fetch Latest Articles
```bash
# Get new articles (auto-saves to database)
curl http://localhost:3000/api/bangladesh-guardian

# Get all posted links
curl -X POST http://localhost:3000/api/bangladesh-guardian
```

### 2. Generate Cards
```bash
# List all cards
curl http://localhost:3000/api/cards

# Create a card (via UI or API)
POST /api/cards
{
  "article": { ... },
  "templateId": "template-id"
}
```

## Web Interface

Navigate to `/dashboard` to:
- Fetch latest news from Bangladesh Guardian
- View posted articles history
- Quick link to card generator

Navigate to `/cards` to:
- Select an article and template
- Generate news cards
- View and download generated cards

## Workflow

### Step 1: Fetch News
1. Go to Dashboard: http://localhost:3000/dashboard
2. Click "Check Now" to fetch latest articles
3. Articles are auto-saved to database (no duplicates)

### Step 2: Create Template (if needed)
1. Go to Canvas: http://localhost:3000/canvas
2. Create a new template with dynamic fields:
   - `title` - for article title
   - `date` - for publication date
   - `subtitle` - for description
   - `image` - for article image

### Step 3: Generate Cards
1. Go to Cards: http://localhost:3000/cards
2. Select an article from the dropdown
3. Select a template
4. Click "Generate Card"
5. Download the generated PNG

### Step 4: View All Cards
- In `/cards` page, switch to "View Cards" tab
- See all generated cards with preview
- Download any card

## API Reference

### GET /api/bangladesh-guardian
Fetch new articles (only those not in database).

**Response:**
```json
{
  "success": true,
  "message": "Posted 4 new article(s)",
  "count": 4,
  "articles": [...]
}
```

### POST /api/bangladesh-guardian
Get all posted article links.

**Response:**
```json
{
  "success": true,
  "count": 10,
  "links": [...]
}
```

### GET /api/cards
List all generated cards.

**Response:**
```json
{
  "success": true,
  "count": 5,
  "cards": [...]
}
```

### POST /api/cards
Generate a new card.

**Request:**
```json
{
  "article": {
    "id": "...",
    "title": "Article Title",
    "sanitizedTitle": "Article Title",
    "link": "https://...",
    "image": "https://...",
    "content": "Full content...",
    "description": "Short description...",
    "author": "Author Name",
    "publishedAt": "2026-01-20",
    "category": "National"
  },
  "templateId": "template-id"
}
```

**Response:**
```json
{
  "success": true,
  "card": {
    "id": "...",
    "imageUrl": "data:image/png;base64,...",
    "status": "GENERATED",
    "createdAt": "2026-01-20T..."
  }
}
```

## Features

- **Auto-deduplication**: Articles already in database are skipped
- **Content sanitization**: Sensitive words masked (kill → Ki*ll, gaza → Ga*za)
- **Image extraction**: Main image fetched from each article
- **Template support**: Dynamic field mapping (title, date, subtitle, image)
- **PNG download**: Generated cards downloadable as PNG files

## Database Tables

- `posted_links` - Tracks fetched articles
- `news_cards` - Stores generated cards
- `templates` - Stores canvas templates

## Troubleshooting

### No articles found
- Check internet connection to bangladeshguardian.com
- Site may be blocking requests

### Card generation fails
- Ensure template has dynamic fields set
- Check template has canvasData saved

### Images not appearing
- Some articles may not have images
- Check image URL is accessible
