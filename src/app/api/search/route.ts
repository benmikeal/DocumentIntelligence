/**
 * Search API - Gemini File Search Integration
 *
 * Performs semantic search using Google Gemini's File Search capability
 * Returns results with automatic citations and source attribution
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { geminiFileSearch } from '@/lib/gemini-file-search';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    if (query.trim().length < 3) {
      return NextResponse.json(
        { error: 'Query must be at least 3 characters' },
        { status: 400 }
      );
    }

    console.log(`🔍 [Search] Query: "${query}"`);

    // Search ALL files in Gemini File Search (no database needed!)
    // Gemini File Search will search across all uploaded files automatically
    console.log(`📚 [Search] Searching across all Gemini files`);

    // Perform Gemini File Search without specifying files = search all files
    const geminiResults = await geminiFileSearch.search(query, undefined, 5);

    console.log(`✅ [Search] Found ${geminiResults.length} results`);

    // Format results for frontend
    const formattedResults = geminiResults.map((result, index) => {
      // Use citation source document as the title
      const sourceDoc = result.citations[0]?.sourceDocument || 'Kenya Government Documents';

      return {
        id: `result-${index}`,
        content: result.content,
        relevanceScore: result.relevanceScore,
        citations: result.citations.map((citation) => ({
          sourceDocument: citation.sourceDocument,
          pageNumber: citation.pageNumber,
          excerpt: citation.excerpt,
        })),
        documentTitle: sourceDoc,
        sectionName: 'AI-Generated Answer with Citations',
      };
    });

    // Return results
    return NextResponse.json({
      query,
      results: formattedResults,
      totalResults: formattedResults.length,
      searchTime: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ [Search] Search error:', error);

    // Check if it's a Gemini API error
    if (error instanceof Error) {
      console.error(`   Error message: ${error.message}`);

      // Provide helpful error messages
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'API configuration error. Please check server logs.' },
          { status: 500 }
        );
      }

      if (error.message.includes('quota') || error.message.includes('limit')) {
        return NextResponse.json(
          { error: 'API quota exceeded. Please try again later.' },
          { status: 429 }
        );
      }
    }

    // Generic error response
    return NextResponse.json(
      { error: 'Search failed. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for search statistics
 */
export async function GET() {
  try {
    const totalDocuments = await db.document.count();
    const indexedDocuments = await db.document.count({
      where: {
        geminiFileName: { not: null },
      },
    });

    const geminiStats = await geminiFileSearch.getStats();

    return NextResponse.json({
      statistics: {
        totalDocuments,
        indexedDocuments,
        geminiFiles: geminiStats.totalFiles,
        totalSizeMB: geminiStats.totalSizeMB.toFixed(2),
        filesByType: geminiStats.filesByType,
      },
    });
  } catch (error) {
    console.error('❌ [Search] Failed to get statistics:', error);

    return NextResponse.json(
      { error: 'Failed to retrieve statistics' },
      { status: 500 }
    );
  }
}
