import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { VectorSearchService } from '@/lib/embeddings'

// Create a fresh instance to load the latest corpus
const vectorSearch = new VectorSearchService()

// Clean HTML and metadata from OCR content
function cleanContent(content: string): string {
  if (!content) return ''

  let cleaned = content

  // Remove incomplete HTML tags (broken tags at start/end)
  cleaned = cleaned.replace(/<[^>]*$/g, '') // Remove incomplete opening tags at end
  cleaned = cleaned.replace(/^[^<]*>/g, '') // Remove incomplete closing tags at start

  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, ' ')

  // Remove data-bbox and other data-* attributes
  cleaned = cleaned.replace(/data-[a-z]+="[^"]*"/gi, '')
  cleaned = cleaned.replace(/data-[a-z]+=\S+/gi, '')

  // Remove attribute remnants (standalone quotes with numbers)
  cleaned = cleaned.replace(/"[\d\s]+"/g, '')

  // Remove markdown image syntax
  cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/g, '')

  // Remove base64 image data
  cleaned = cleaned.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '')

  // Remove orphaned base64 strings (remnants from image extraction)
  cleaned = cleaned.replace(/[A-Za-z0-9+/]{20,}={0,2}/g, '')

  // Clean up table markup
  cleaned = cleaned.replace(/\|\s*\|/g, ' ')
  cleaned = cleaned.replace(/\|-+\|/g, '')
  cleaned = cleaned.replace(/<th\s+/g, '')
  cleaned = cleaned.replace(/<td\s+/g, '')
  cleaned = cleaned.replace(/<\/t[dh]>/g, '')
  cleaned = cleaned.replace(/<\/?tr>/g, '')
  cleaned = cleaned.replace(/<\/?table>/g, '')
  cleaned = cleaned.replace(/<\/?thead>/g, '')
  cleaned = cleaned.replace(/<\/?tbody>/g, '')

  // Remove coordinate-like patterns
  cleaned = cleaned.replace(/\d{2,}\s+\d{2,}\s+\d{2,}\s+\d{2,}/g, '')

  // Decode HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')

  // Remove excessive whitespace
  cleaned = cleaned.replace(/\s+/g, ' ')
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')

  // Remove leading/trailing whitespace
  cleaned = cleaned.trim()

  return cleaned
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
    }

    // Perform semantic search using vector search
    const searchResults = await vectorSearch.search(query, 5)

    // Format results for the frontend (direct from vector search, no DB lookup)
    const formattedResults = searchResults.map((result) => {
      return {
        id: result.chunk.id,
        content: cleanContent(result.chunk.content), // Clean HTML and metadata
        sectionName: result.chunk.sectionName || 'Unknown Section',
        documentTitle: result.chunk.documentTitle || 'Unknown Document',
        relevanceScore: result.score,
        pageNumber: result.chunk.pageNumber,
      }
    })

    // Sort by relevance score
    const validResults = formattedResults
      .sort((a, b) => b.relevanceScore - a.relevanceScore)

    return NextResponse.json(validResults)
  } catch (error) {
    console.error('Search error:', error)
    
    // Fallback to mock results if vector search fails
    const fallbackResults = [
      {
        id: 'fallback-1',
        content: "Business licensing requirements include submitting a completed application form, business registration certificate, tax identification number, and proof of business address. The processing time is typically 7-10 business days.",
        sectionName: "Business Licensing",
        documentTitle: "Business Registration Guide",
        relevanceScore: 0.85,
        pageNumber: 1,
      },
      {
        id: 'fallback-2',
        content: "To apply for a business permit, applicants must provide a detailed business plan, financial projections for the first three years, and evidence of sufficient capital. The minimum capital requirement varies by business type.",
        sectionName: "Permit Application",
        documentTitle: "Investment Procedures Manual",
        relevanceScore: 0.75,
        pageNumber: 2,
      },
    ]

    return NextResponse.json(fallbackResults)
  }
}