import { NextRequest, NextResponse } from 'next/server';
import { generateCardImage } from '@/lib/card-generator';
import prisma from '@/lib/db';
import { getLatestNews, fetchArticleImage, sanitizeText } from '@/lib/bangladesh-guardian-agent';
import { autopilotService } from '@/lib/autopilot-service';

// In-memory storage for tracking posted links (in production, use database)
const postedLinks = new Set<string>();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'fetch-news':
        const news = await getLatestNews();
        return NextResponse.json({ success: true, news });

      case 'autopilot-status':
        return NextResponse.json({
          success: true,
          isRunning: autopilotService.isAutopilotRunning()
        });

      default:
        return NextResponse.json({
          error: 'Invalid action. Use ?action=fetch-news or ?action=autopilot-status'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in news agent API:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'start-autopilot':
        try {
          await autopilotService.startAutopilot();
          return NextResponse.json({ success: true, message: 'Autopilot started' });
        } catch (error) {
          console.error('Error starting autopilot:', error);
          return NextResponse.json({ success: false, error: 'Failed to start autopilot' }, { status: 500 });
        }

      case 'stop-autopilot':
        try {
          await autopilotService.stopAutopilot();
          return NextResponse.json({ success: true, message: 'Autopilot stopped' });
        } catch (error) {
          console.error('Error stopping autopilot:', error);
          return NextResponse.json({ success: false, error: 'Failed to stop autopilot' }, { status: 500 });
        }

      case 'generate-card':
        const { templateId, newsItem } = body;

        if (!templateId || !newsItem) {
          return NextResponse.json({ error: 'Missing templateId or newsItem' }, { status: 400 });
        }

        // Get the template
        const template = await prisma.template.findUnique({
          where: { id: templateId }
        });

        if (!template) {
          return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        // Find the data mapping for this template
        const mapping = await prisma.dataMapping.findFirst({
          where: { templateId }
        });

        let mappedData: Record<string, any> = {};

        if (mapping) {
          // Use the mapping to transform the news item
          for (const [templateField, sourceField] of Object.entries(mapping.sourceFields)) {
            if (sourceField && newsItem[sourceField as keyof typeof newsItem]) {
              mappedData[templateField] = newsItem[sourceField as keyof typeof newsItem];
            } else {
              // Use fallback or default values
              if (templateField === 'date') {
                mappedData[templateField] = newsItem.date || new Date().toISOString().split('T')[0];
              } else if (templateField === 'title') {
                mappedData[templateField] = newsItem.title || 'Untitled';
              } else if (templateField === 'image') {
                mappedData[templateField] = newsItem.image || '';
              } else {
                mappedData[templateField] = newsItem[sourceField as keyof typeof newsItem] || '';
              }
            }
          }
        } else {
          // Fallback mapping if no specific mapping exists
          mappedData = {
            title: newsItem.title,
            date: newsItem.date || new Date().toISOString().split('T')[0],
            subtitle: newsItem.description || '',
            image: newsItem.image || '',
          };
        }

        // Generate the card image
        const cardBuffer = await generateCardImage({
          template,
          mapping: mappedData,
          newsItem
        });

        // Save the generated card to the database
        const newsCard = await prisma.newsCard.create({
          data: {
            imageUrl: `data:image/png;base64,${cardBuffer.toString('base64')}`, // Store as base64
            status: 'GENERATED',
            sourceData: newsItem,
            templateId: template.id,
            dataMappingId: mapping?.id || null,
          }
        });

        return NextResponse.json({
          success: true,
          cardId: newsCard.id,
          imageUrl: newsCard.imageUrl
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in news agent API:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: (error as Error).message },
      { status: 500 }
    );
  }
}