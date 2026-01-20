# Quick Setup Guide

Follow these steps to get your Bangladesh Guardian news agent running:

## Step 1: Add News Source
Go to http://localhost:3000/sources and add:
- Name: "Bangladesh Guardian"
- Type: "AUTO" (Auto-discovery)
- URL: "https://www.bangladeshguardian.com/latest"

## Step 2: Create a Template
Go to http://localhost:3000/canvas and create a template with:
- Text element for Title → assign to "title" dynamic field
- Text element for Date → assign to "date" dynamic field
- Text element for Subtitle → assign to "subtitle" dynamic field
- Rectangle for image → assign to "image" dynamic field
- Save the template

## Step 3: Create Data Mapping
Go to http://localhost:3000/admin/data-mapping and create a mapping between your source and template.

## Step 4: Start Autopilot
Go to http://localhost:3000/dashboard and toggle autopilot ON.

## Step 5: View Cards
Check http://localhost:3000/history to see generated news cards.

That's it! Your system will now automatically fetch news from Bangladesh Guardian and generate cards.