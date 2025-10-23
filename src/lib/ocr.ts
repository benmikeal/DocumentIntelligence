import ZAI from 'z-ai-web-dev-sdk'

export interface OCRResult {
  text: string
  metadata: {
    pageNumber: number
    confidence: number
    sections: string[]
  }
}

export class OCRService {
  private zai: any

  constructor() {
    this.initializeZAI()
  }

  private async initializeZAI() {
    try {
      this.zai = await ZAI.create()
    } catch (error) {
      console.error('Failed to initialize ZAI:', error)
      throw error
    }
  }

  async processPDF(pdfBuffer: Buffer): Promise<OCRResult[]> {
    try {
      // Convert PDF to images (simplified - in real implementation would use pdf-poppler or similar)
      const images = await this.convertPDFToImages(pdfBuffer)
      
      const results: OCRResult[] = []
      
      for (let i = 0; i < images.length; i++) {
        const imageBase64 = images[i]
        const result = await this.processImage(imageBase64, i + 1)
        results.push(result)
      }

      return results
    } catch (error) {
      console.error('PDF processing failed:', error)
      throw error
    }
  }

  private async processImage(imageBase64: string, pageNumber: number): Promise<OCRResult> {
    try {
      const prompt = `Extract and structure the text from this document page. 
      Requirements:
      1. Preserve the document structure and formatting
      2. Identify and mark section headers with # ## ### markdown
      3. Extract tables and format them as markdown tables
      4. Maintain the reading order and flow
      5. Return the result as clean, structured markdown
      
      Focus on accuracy and completeness of the text extraction.`

      const completion = await this.zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are an expert OCR system specializing in document text extraction and structuring.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
      })

      const extractedText = completion.choices[0]?.message?.content || ''
      
      // Identify sections from the extracted text
      const sections = this.extractSections(extractedText)
      
      return {
        text: extractedText,
        metadata: {
          pageNumber,
          confidence: 0.95, // Mock confidence score
          sections
        }
      }
    } catch (error) {
      console.error(`Failed to process page ${pageNumber}:`, error)
      throw error
    }
  }

  private extractSections(text: string): string[] {
    const sections: string[] = []
    const lines = text.split('\n')
    
    for (const line of lines) {
      // Match markdown headers
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
      if (headerMatch) {
        sections.push(headerMatch[2].trim())
      }
    }
    
    return sections
  }

  private async convertPDFToImages(pdfBuffer: Buffer): Promise<string[]> {
    // Mock implementation - in real scenario would use pdf-poppler or similar
    // For now, return a single mock image
    const mockImageBase64 = pdfBuffer.toString('base64').substring(0, 1000)
    
    // Simulate multiple pages
    const pageCount = Math.floor(Math.random() * 5) + 1
    return Array(pageCount).fill(mockImageBase64)
  }

  async processDocumentWithRetry(pdfBuffer: Buffer, maxRetries: number = 3): Promise<OCRResult[]> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.processPDF(pdfBuffer)
      } catch (error) {
        lastError = error as Error
        console.warn(`OCR attempt ${attempt} failed:`, error)
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    throw lastError || new Error('OCR processing failed after all retries')
  }
}