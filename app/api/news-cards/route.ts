import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/session';

export async function GET() {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || 'dev-user-id'; // Fallback for development

    // Fetch news cards with related template information
    const newsCards = await prisma.newsCard.findMany({
      where: {
        // In a real implementation, we'd filter by user
        // For development, we'll return all cards
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // Limit to last 50 cards
    });

    return NextResponse.json(newsCards);
  } catch (error) {
    console.error('Error fetching news cards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news cards' },
      { status: 500 }
    );
  }
}