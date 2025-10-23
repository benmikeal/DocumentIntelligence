import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename

    if (!filename || !filename.endsWith('.pdf')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    // Path to the PDFs directory
    const pdfsDir = '/Users/bm/Kenya_Government_Docs'
    const filePath = path.join(pdfsDir, filename)

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`[Download] File not found: ${filePath}`)
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Read the PDF file
    const pdfBuffer = fs.readFileSync(filePath)

    // Return the PDF with appropriate headers
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })

  } catch (error) {
    console.error('[Download] Error:', error)
    return NextResponse.json({ error: 'Failed to download document' }, { status: 500 })
  }
}
