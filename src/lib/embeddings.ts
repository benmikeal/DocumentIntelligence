import { DocumentChunk } from './chunking'
import * as fs from 'fs'
import * as path from 'path'

export interface EmbeddingResult {
  id: string
  chunkId: string
  vector: number[]
  dimension: number
}

export interface SearchResult {
  chunk: DocumentChunk
  score: number
  distance: number
}

export class EmbeddingService {
  private dimension: number = 384

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // For now, we'll use a mock embedding generation
      // In a real implementation, you would use a proper embedding model
      const mockEmbedding = await this.generateMockEmbedding(text)
      return mockEmbedding
    } catch (error) {
      console.error('Embedding generation failed:', error)
      throw error
    }
  }

  async generateEmbeddings(chunks: DocumentChunk[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = []

    for (const chunk of chunks) {
      try {
        const vector = await this.generateEmbedding(chunk.content)
        
        results.push({
          id: `${chunk.id}-embedding`,
          chunkId: chunk.id,
          vector,
          dimension: this.dimension
        })
      } catch (error) {
        console.error(`Failed to generate embedding for chunk ${chunk.id}:`, error)
        // Continue with other chunks
      }
    }

    return results
  }

  private async generateMockEmbedding(text: string): Promise<number[]> {
    // Generate a deterministic but pseudo-random embedding based on text
    // This simulates the behavior of a real embedding model
    const hash = this.simpleHash(text)
    const embedding: number[] = []
    
    for (let i = 0; i < this.dimension; i++) {
      // Create a pseudo-random but deterministic value
      const seed = hash + i
      const value = (Math.sin(seed) * 10000 - Math.floor(Math.sin(seed) * 10000)) / 10000
      embedding.push(value)
    }
    
    // Normalize the embedding
    return this.normalizeVector(embedding)
  }

  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
    return vector.map(val => val / magnitude)
  }
}

export class VectorSearchService {
  private embeddings: Map<string, { vector: number[]; chunk: DocumentChunk }> = new Map()
  private embeddingService: EmbeddingService

  constructor() {
    this.embeddingService = new EmbeddingService()
    // Load pre-computed Kenya Mining Handbook data
    this.loadPrecomputedData()
  }

  private loadPrecomputedData(): void {
    try {
      // Try to load full corpus first, fall back to single document
      const corpusPath = path.join(process.cwd(), 'data', 'kenya_gov_corpus.json')
      const singleDocPath = path.join(process.cwd(), 'data', 'kenya_mining_rag_data.json')

      let dataPath = corpusPath
      let data: any

      if (fs.existsSync(corpusPath)) {
        console.log(`[VectorSearch] Loading full government corpus from: ${corpusPath}`)
        const rawData = fs.readFileSync(corpusPath, 'utf-8')
        data = JSON.parse(rawData)
        console.log(`[VectorSearch] Found ${data.metadata?.totalDocuments || 0} documents with ${data.chunks?.length || 0} chunks`)
      } else if (fs.existsSync(singleDocPath)) {
        console.log(`[VectorSearch] Loading single document from: ${singleDocPath}`)
        const rawData = fs.readFileSync(singleDocPath, 'utf-8')
        data = JSON.parse(rawData)
        console.log(`[VectorSearch] Found ${data.chunks?.length || 0} chunks`)
      } else {
        console.log('[VectorSearch] No pre-computed data found - starting with empty index')
        return
      }

      // Load chunks
      if (!data.chunks || data.chunks.length === 0) {
        console.log('[VectorSearch] No chunks found in data file')
        return
      }

      for (const chunkData of data.chunks) {
        // Convert to DocumentChunk format
        const chunk: DocumentChunk = {
          id: chunkData.id,
          documentId: chunkData.documentId,
          documentTitle: chunkData.documentTitle,
          content: chunkData.content,
          sectionName: chunkData.sectionName,
          pageNumber: chunkData.pageNumber,
          chunkIndex: chunkData.chunkIndex,
          metadata: chunkData.metadata
        }

        // Store with pre-computed embedding
        this.embeddings.set(chunkData.id, {
          vector: chunkData.embedding,
          chunk
        })
      }

      console.log(`[VectorSearch] ✅ Successfully loaded ${this.embeddings.size} chunks`)
    } catch (error) {
      console.error('[VectorSearch] Failed to load pre-computed data:', error)
      // Continue without pre-computed data
    }
  }

  async indexChunks(chunks: DocumentChunk[]): Promise<void> {
    console.log(`Indexing ${chunks.length} chunks...`)
    
    const embeddingResults = await this.embeddingService.generateEmbeddings(chunks)
    
    for (const result of embeddingResults) {
      const chunk = chunks.find(c => c.id === result.chunkId)
      if (chunk) {
        this.embeddings.set(result.chunkId, {
          vector: result.vector,
          chunk
        })
      }
    }
    
    console.log(`Successfully indexed ${this.embeddings.size} chunks`)
  }

  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    if (this.embeddings.size === 0) {
      return []
    }

    try {
      // Generate embedding for the query
      const queryVector = await this.embeddingService.generateEmbedding(query)

      // Calculate similarity scores using cosine similarity
      const similarities: Array<{ chunkId: string; score: number; distance: number }> = []

      for (const [chunkId, data] of this.embeddings) {
        // Use cosine similarity instead of Euclidean distance
        const cosineSim = this.cosineSimilarity(queryVector, data.vector)
        // Convert to percentage (0-100)
        const score = Math.max(0, cosineSim) // Ensure no negative scores

        // Also calculate distance for compatibility
        const distance = this.calculateDistance(queryVector, data.vector)

        similarities.push({
          chunkId,
          score,
          distance
        })
      }

      // Sort by score (descending)
      similarities.sort((a, b) => b.score - a.score)

      // Log top scores for debugging
      console.log(`[Search] Query: "${query}"`)
      console.log(`[Search] Top 5 scores:`, similarities.slice(0, 5).map(s => ({
        id: s.chunkId.substring(0, 30),
        score: (s.score * 100).toFixed(1) + '%'
      })))

      // TEMPORARY: No threshold - return all results sorted by score
      // Issue: Mock embeddings for queries vs real embeddings (all-MiniLM-L6-v2) in corpus
      // This causes very low similarity scores. Need to implement real embeddings for queries.
      const topResults = similarities.slice(0, topK)

      console.log(`[Search] Returning top ${topResults.length} results (no threshold - showing actual scores)`)

      // Convert to SearchResult format
      return topResults.map(result => ({
        chunk: this.embeddings.get(result.chunkId)!.chunk,
        score: result.score,
        distance: result.distance
      }))

    } catch (error) {
      console.error('Search failed:', error)
      return []
    }
  }

  private calculateDistance(vec1: number[], vec2: number[]): number {
    // Euclidean distance (L2)
    let sum = 0
    for (let i = 0; i < vec1.length; i++) {
      const diff = vec1[i] - vec2[i]
      sum += diff * diff
    }
    return Math.sqrt(sum)
  }

  private distanceToSimilarity(distance: number): number {
    // Convert distance to similarity score (0-1)
    // Using inverse distance: score = 1 / (1 + distance)
    return 1 / (1 + distance)
  }

  // Alternative similarity metric: Cosine similarity
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i]
      norm1 += vec1[i] * vec1[i]
      norm2 += vec2[i] * vec2[i]
    }
    
    norm1 = Math.sqrt(norm1)
    norm2 = Math.sqrt(norm2)
    
    return dotProduct / (norm1 * norm2)
  }

  getIndexedCount(): number {
    return this.embeddings.size
  }

  clearIndex(): void {
    this.embeddings.clear()
  }

  // Method to add a single chunk to the index
  async addChunk(chunk: DocumentChunk): Promise<void> {
    const embedding = await this.embeddingService.generateEmbedding(chunk.content)
    this.embeddings.set(chunk.id, {
      vector: embedding,
      chunk
    })
  }

  // Method to remove a chunk from the index
  removeChunk(chunkId: string): boolean {
    return this.embeddings.delete(chunkId)
  }

  // Method to get statistics about the index
  getIndexStats(): {
    totalChunks: number
    averageChunkLength: number
    dimension: number
  } {
    const chunks = Array.from(this.embeddings.values())
    const totalLength = chunks.reduce((sum, data) => sum + data.chunk.content.length, 0)
    
    return {
      totalChunks: chunks.length,
      averageChunkLength: chunks.length > 0 ? totalLength / chunks.length : 0,
      dimension: chunks.length > 0 ? chunks[0].vector.length : 0
    }
  }
}