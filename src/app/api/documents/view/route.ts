import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

// Clean HTML and metadata from OCR content
function cleanContent(content: string): string {
  if (!content) return ''

  let cleaned = content

  // Remove incomplete HTML tags (broken tags at start/end)
  cleaned = cleaned.replace(/<[^>]*$/g, '')
  cleaned = cleaned.replace(/^[^<]*>/g, '')

  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, ' ')

  // Remove data-bbox and other data-* attributes
  cleaned = cleaned.replace(/data-[a-z]+="[^"]*"/gi, '')
  cleaned = cleaned.replace(/data-[a-z]+=\S+/gi, '')

  // Remove attribute remnants
  cleaned = cleaned.replace(/"[\d\s]+"/g, '')

  // Remove markdown image syntax
  cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/g, '')

  // Remove base64 image data
  cleaned = cleaned.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '')

  // Remove orphaned base64 strings
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

  return cleaned.trim()
}

export async function POST(request: NextRequest) {
  try {
    const { documentTitle, documentId } = await request.json()

    if (!documentTitle) {
      return NextResponse.json({ error: 'Document title required' }, { status: 400 })
    }

    // Load the corpus
    const corpusPath = path.join(process.cwd(), 'data', 'kenya_gov_corpus.json')

    if (!fs.existsSync(corpusPath)) {
      return NextResponse.json({ error: 'Corpus not found' }, { status: 404 })
    }

    const rawData = fs.readFileSync(corpusPath, 'utf-8')
    const corpus = JSON.parse(rawData)

    // Find all chunks for this document
    const documentChunks = corpus.chunks.filter((chunk: any) =>
      chunk.documentTitle === documentTitle ||
      (documentId && chunk.id.startsWith(documentId))
    )

    if (documentChunks.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Sort chunks by index to maintain document order
    documentChunks.sort((a: any, b: any) => a.chunkIndex - b.chunkIndex)

    // Concatenate all chunks into a single document
    // Remove overlap by taking unique content
    const fullContent = documentChunks
      .map((chunk: any) => cleanContent(chunk.content))
      .join('\n\n')

    return NextResponse.json({
      content: fullContent,
      metadata: {
        documentTitle,
        totalChunks: documentChunks.length,
        documentId: documentChunks[0].documentId
      }
    })

  } catch (error) {
    console.error('Document view error:', error)
    return NextResponse.json({ error: 'Failed to load document' }, { status: 500 })
  }
}
