import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

export async function GET() {
  try {
    // Load the corpus metadata
    const corpusPath = path.join(process.cwd(), 'data', 'kenya_gov_corpus.json')

    if (!fs.existsSync(corpusPath)) {
      // Return default stats if corpus doesn't exist yet
      return NextResponse.json({
        totalDocuments: 0,
        totalChunks: 0,
        embeddingDimension: 384,
        processedDocs: 0,
      })
    }

    const rawData = fs.readFileSync(corpusPath, 'utf-8')
    const corpus = JSON.parse(rawData)

    // Extract statistics from corpus
    const stats = {
      totalDocuments: corpus.metadata?.totalDocuments || corpus.documents?.length || 0,
      totalChunks: corpus.metadata?.totalChunks || corpus.chunks?.length || 0,
      embeddingDimension: corpus.metadata?.embeddingDimension || 384,
      processedDocs: corpus.documents?.length || 0,
      embeddingModel: corpus.metadata?.embeddingModel || 'all-MiniLM-L6-v2',
      createdAt: corpus.metadata?.createdAt || null,
      chunkSize: corpus.metadata?.chunkSize || 1000,
      chunkOverlap: corpus.metadata?.chunkOverlap || 200,
    }

    return NextResponse.json(stats)

  } catch (error) {
    console.error('Corpus stats error:', error)
    // Return default stats on error
    return NextResponse.json({
      totalDocuments: 0,
      totalChunks: 0,
      embeddingDimension: 384,
      processedDocs: 0,
    })
  }
}
