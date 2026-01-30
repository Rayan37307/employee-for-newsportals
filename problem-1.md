# Text Positioning Issue: Preview vs Download Discrepancy

## Problem Statement
The text positioning in generated cards appears correctly in the preview but is shifted downward (appears lower than expected) when the card is downloaded. This creates an inconsistent user experience where the preview doesn't match the final downloaded image.

## Current State
- **Preview**: Text appears in correct position using browser-based Fabric.js rendering
- **Download**: Text appears shifted downward in the Puppeteer-generated image
- Both use the same template and data, but render differently

## Root Cause Analysis

### 1. Different Rendering Environments
- **Preview Environment**: Browser-based Fabric.js rendering
- **Download Environment**: Headless Chrome via Puppeteer
- Different engines may interpret text positioning differently

### 2. Text Baseline Handling
- Browser vs Puppeteer may handle text baselines differently
- `originX` and `originY` settings in Fabric.js may render inconsistently
- Font rendering varies between headless and non-headless environments

### 3. Timing Issues in Puppeteer
- Canvas may not be fully rendered when image is captured
- Text elements may still be repositioning when screenshot is taken
- Multiple render cycles needed for proper layout settling

### 4. Coordinate System Differences
- Subtle differences in how coordinates are calculated between environments
- The `top` positioning may be interpreted differently in Puppeteer vs browser

## Current Attempts to Fix
- Enhanced text positioning algorithm with baseline calculations
- Added multiple render calls for layout settling
- Improved Puppeteer launch options for consistent rendering
- Added additional delays for proper layout settling

## Why Issue Persists
- Fundamental difference in rendering environments between browser and Puppeteer remains
- Font loading and rendering timing still differs between environments
- Text positioning calculations may still need fine-tuning for Puppeteer specifically

## Recommended Solutions
1. Add environment-specific positioning offsets
2. Implement more sophisticated text baseline detection
3. Ensure font loading consistency between environments
4. Add more sophisticated rendering completion detection
5. Consider using the same rendering engine for both preview and download