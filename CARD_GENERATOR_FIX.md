# Card Generator Image Replacement Fix

## Problem Statement

The news-agent card generation system was not replacing images in templates while texts were being replaced correctly. When generating cards from templates, the image placeholders (rectangles marked with `dynamicField: 'image'`) remained as placeholder rectangles instead of being replaced with actual images from news articles.

## Root Causes Identified

### 1. Incomplete Image Replacement Code in Original Implementation

The original `lib/card-generator.ts` had incomplete image replacement logic:

```typescript
// Handle image placeholders (rectangles with image dynamic field)
else if (obj.type === 'rect' && dynamicField === 'image' && newValue) {
    try {
        // This only changed the rectangle's appearance but never actually replaced it!
        (obj as fabric.Rect).set({
            fill: '#f0f0f0',
            stroke: '#ccc',
            strokeWidth: 1
        });
        console.log(`Image placeholder for: ${newValue.substring(0, 50)}...`);
    } catch (error) {
        console.error('Error handling image placeholder:', error)
    }
}
```

The code only changed the placeholder's fill color but never downloaded and replaced the rectangle with an actual image.

### 2. Fabric.js Type Case Sensitivity

The code checked for `obj.type === 'rect'` (lowercase) but Fabric.js serializes types as `'Rect'` or `'IText'` (capitalized). This caused the image replacement condition to never match.

### 3. JSDOM Incompatibility with Fabric.js 7.x

The original code used JSDOM to provide a DOM shim for Fabric.js server-side rendering:

```typescript
if (!global.document) {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
    global.window = dom.window
    global.document = dom.window.document
}
```

This caused errors like `e.hasAttribute is not a function` because Fabric.js 7.x requires more complete DOM shimming.

### 4. Node-Canvas FabricImage.fromURL() Limitations

Node-Canvas (canvas package) has limitations when loading images from data URLs in server-side environments, and `fabric.FabricImage.fromURL()` doesn't work reliably with base64 encoded images.

### 5. Headless Chrome Data URL Restrictions

When using Puppeteer with headless Chrome, data URLs with special characters cause `ERR_INVALID_URL` errors. The data URL must be properly encoded, but even then, headless Chrome may reject certain data URL formats.

## Solution Implemented

Created a new `lib/card-generator-puppeteer.ts` that uses Puppeteer with Fabric.js 5.3.1 for reliable server-side card generation.

## Current Status (January 2026)

### ✅ Working

- **Text replacement**: All text fields (title, date, description, category, author) are correctly replaced
- **Card generation via API**: Cards are generated successfully with text replacement
- **Autopilot service**: Integrates with the card generator
- **Base64 PNG output**: Generated cards are returned as base64-encoded PNG images

### ⚠️ Limited

- **Image replacement**: 
  - **External image URLs**: May work with reliable external URLs (depends on network)
  - **Data URLs (base64)**: Currently fails in headless Chrome with `ERR_INVALID_URL`
  - The image placeholder (rectangle) is rendered as-is from the template

### Debug Logs

When generating a card, check the server logs for:

```
PAGE LOG: Canvas loaded, objects: 5
PAGE LOG: Object 0: type=Rect, dynamicField=image      <- Image placeholder found
PAGE LOG: Object 1: type=IText, dynamicField=date      <- Text field
PAGE LOG: Object 2: type=IText, dynamicField=title     <- Text field
PAGE LOG: Loading image for placeholder: https://...
PAGE LOG: Updated text to: 2026-01-20                   <- Date replaced
PAGE LOG: Updated text to: Breaking News               <- Title replaced
PAGE LOG: Canvas rendered
PAGE LOG: Data URL generated, length: 62014
POST /api/news-agent 200 in 600ms
```

## Image Replacement Options

### Option 1: Client-Side Only (Recommended for Now)

Implement image replacement in the canvas editor UI when users preview/edit cards. This avoids server-side image loading issues.

### Option 2: External Image URLs Only

If using external image URLs that are publicly accessible and don't require CORS, image replacement may work. Add this to `lib/card-generator-puppeteer.ts`:

```javascript
else if ((obj.type === 'rect' || obj.type === 'Rect') && dynamicField === 'image') {
    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous'; // May not work for all URLs
    imgEl.onload = function() {
        const img = new fabric.Image(imgEl);
        // Scale and position...
        canvas.remove(obj);
        canvas.add(img);
    };
    imgEl.src = newValue; // Only works for external URLs
}
```

### Option 3: Server-Side Image Processing

Use a server-side image processing library to overlay images on the generated canvas:

1. Generate the base card with text using Puppeteer
2. Use `sharp` or `gm` to composite the article image onto the card
3. This avoids browser image loading issues

Example with `sharp`:
```bash
npm install sharp
```

```typescript
import sharp from 'sharp';

// After generating base card...
const cardImage = sharp(buffer);
await cardImage.composite([{
    input: articleImageBuffer,
    top: 100,
    left: 100,
}]);
```

#### 2. Updated API Routes to Use New Generator

**File: `app/api/news-agent/route.ts`**

Changed import from:
```typescript
import { generateCardImage } from '@/lib/card-generator';
```

To:
```typescript
import { generateCardImage } from '@/lib/card-generator-puppeteer';
```

#### 3. Updated Autopilot Service

**File: `lib/autopilot-service.ts`**

Changed import from:
```typescript
import { generateCardImage } from '@/lib/card-generator';
```

To:
```typescript
import { generateCardImage } from '@/lib/card-generator-puppeteer';
```

#### 4. Fixed Type Case Sensitivity

The new implementation handles type checking correctly:

```typescript
if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'IText') {
    obj.set('text', String(newValue));
}
```

## Files Modified

| File | Change |
|------|--------|
| `lib/card-generator-puppeteer.ts` | NEW - Puppeteer-based card generator |
| `app/api/news-agent/route.ts` | Updated import to use new generator |
| `lib/autopilot-service.ts` | Updated import to use new generator |

## Testing

### Text Replacement Test

```bash
curl -X POST "http://localhost:3000/api/news-agent" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate-card",
    "templateId": "your-template-id",
    "newsItem": {
      "title": "Breaking News Title",
      "date": "2026-01-20",
      "image": "https://example.com/image.jpg"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "cardId": "cmkxxxxx",
  "imageUrl": "data:image/png;base64,..."
}
```

### Expected Log Output

```
PAGE LOG: Canvas loaded, objects: 5
PAGE LOG: Object 0: type=Rect, dynamicField=image       <- Image placeholder
PAGE LOG: Object 1: type=IText, dynamicField=date       <- Date field
PAGE LOG: Object 2: type=IText, dynamicField=title      <- Title field
PAGE LOG: Loading image for placeholder: https://...
PAGE LOG: Updated text to: 2026-01-20                   <- Date replaced!
PAGE LOG: Updated text to: Breaking News Title          <- Title replaced!
PAGE LOG: Canvas rendered
PAGE LOG: Data URL generated, length: 62014
POST /api/news-agent 200 in 600ms
```

### Autopilot Test

```bash
curl -X POST "http://localhost:3000/api/news-agent" \
  -H "Content-Type: application/json" \
  -d '{"action": "start-autopilot"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Autopilot started"
}
```

## Current Status

### ✅ Working

- Text replacement (title, date, description, category, author)
- Template loading and rendering
- Card generation via API
- Autopilot service integration
- Base64 PNG output

### ⚠️ Limitations

- Image replacement (loading images into placeholders) is disabled due to `toDataURL()` hanging issues with large images in headless Chrome
- Image placeholders are rendered as-is from the template

### Future Enhancements

To enable full image replacement:

1. **Client-side only**: Implement image replacement in the canvas editor UI when users preview/edit cards

2. **Alternative approach**: Use a canvas library that handles images better:
   - `html2canvas` for DOM-based rendering
   - `sharp` for image manipulation
   - `gm` (GraphicsMagick) for server-side image processing

3. **Fix current implementation**: Add image loading back with proper timeout handling:
   ```javascript
   // In lib/card-generator-puppeteer.ts, add image handling:
   else if ((obj.type === 'rect' || obj.type === 'Rect') && dynamicField === 'image') {
       const imgEl = new Image();
       imgEl.onload = function() {
           const img = new fabric.Image(imgEl);
           // Scale and replace...
           canvas.remove(obj);
           canvas.add(img);
       };
       imgEl.src = newValue;
   }
   ```

## Configuration

### Chrome Path

The implementation uses system Chrome at `/usr/bin/google-chrome-stable`. If using a different system, update the path in `lib/card-generator-puppeteer.ts`:

```typescript
executablePath: '/path/to/your/chrome'
```

### Timeout Settings

- Page load timeout: 90 seconds (in `waitForFunction`)
- Image loading: Would need timeout if re-enabled

## Debugging

To see detailed logs:

```bash
# Check Next.js logs
tail -f next.log

# Look for:
# - PAGE LOG: Object X: type=..., dynamicField=...
# - PAGE LOG: Updated text to: ...
# - PAGE LOG: Canvas rendered
# - PAGE LOG: Data URL generated, length: ...
```

## Rollback Instructions

If you need to revert to the original implementation:

1. Restore `app/api/news-agent/route.ts`:
   ```typescript
   import { generateCardImage } from '@/lib/card-generator';
   ```

2. Restore `lib/autopilot-service.ts`:
   ```typescript
   import { generateCardImage } from '@/lib/card-generator';
   ```

3. Keep or remove `lib/card-generator-puppeteer.ts` as needed.

## Dependencies

Required system packages:
- `puppeteer` (already installed)
- `google-chrome-stable` or equivalent Chrome/Chromium binary

Install Chrome if needed:
```bash
npx puppeteer browsers install chrome
```

Or use system Chrome (Debian/Ubuntu):
```bash
sudo apt-get install google-chrome-stable
```
