# 🇰🇪 Kenya Government Document Intelligence System

A modern semantic search application for Kenya government documents, powered by AI embeddings and vector search technology.

## ✨ Features

- **🔍 Semantic Search** - AI-powered search across 1,374 document chunks from 50+ Kenya government documents
- **📄 Document Viewing** - Built-in PDF viewer with text extraction
- **⬇️ PDF Downloads** - Direct download of source government documents
- **📊 Document Dashboard** - Browse and explore the document corpus
- **🎯 Smart Suggestions** - Example queries tailored to Kenya government content
- **⚡ Real-time Search** - Fast vector similarity search with relevance scoring

## 🗄️ Document Corpus

The system includes pre-processed documents covering:
- Kenya Mining Handbook and regulations
- Tax procedures and investment incentives
- Business registration and licensing
- Mining development strategies
- Environmental requirements
- And 45+ other government documents

**Total:** 1,374 chunks from 50 documents, indexed with 384-dimensional embeddings

## 🚀 Technology Stack

### Core Framework
- **⚡ Next.js 15** - React framework with App Router
- **📘 TypeScript 5** - Type-safe development
- **🎨 Tailwind CSS 4** - Modern UI styling

### Search & AI
- **🔮 Vector Embeddings** - all-MiniLM-L6-v2 model (384 dimensions)
- **🔍 Cosine Similarity** - Semantic search ranking
- **📚 Pre-computed Corpus** - Fast search without runtime embedding generation

### UI Components
- **🧩 shadcn/ui** - Accessible components built on Radix UI
- **🎯 Lucide React** - Beautiful icons
- **🌈 Framer Motion** - Smooth animations

### Database & Backend
- **🗄️ Prisma** - Type-safe ORM with SQLite
- **📁 File System** - Direct PDF serving
- **🔄 Socket.IO** - Real-time updates

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── search/              # Vector search endpoint
│   │   ├── documents/           # Document management
│   │   │   ├── list/           # Browse documents
│   │   │   ├── view/           # View document text
│   │   │   └── download/       # Download PDFs
│   │   └── corpus/             # Corpus statistics
│   ├── page.tsx                # Main search interface
│   └── layout.tsx              # App layout
├── components/
│   └── ui/                     # shadcn/ui components
├── lib/
│   ├── embeddings.ts           # Vector search service
│   ├── chunking.ts             # Document chunking
│   ├── db.ts                   # Database client
│   └── utils.ts                # Utilities
├── data/
│   └── kenya_gov_corpus.json   # Pre-computed embeddings
└── public/
    └── pdfs/                    # Government PDF files
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Setup database
npm run db:push

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run db:push      # Push Prisma schema to database
npm run db:generate  # Generate Prisma client
```

## 🔍 How It Works

### 1. Document Processing
Documents are processed offline using Python:
- PDFs extracted with Chandra OCR (Qwen2.5-VL-7B-Instruct model)
- Text chunked into 1000-character segments with 200-character overlap
- Embeddings generated using sentence-transformers (all-MiniLM-L6-v2)
- Stored in `kenya_gov_corpus.json` with pre-computed vectors

### 2. Search Flow
1. User enters a search query
2. Query embedding generated using all-MiniLM-L6-v2 model via @xenova/transformers
3. Cosine similarity calculated against all 1,374 document chunks
4. Results sorted by relevance score (typically 45-80% for relevant results)
5. Top 5 results displayed with document context

### 3. Vector Search
```typescript
// Cosine similarity for semantic matching
const cosineSimilarity = (vec1, vec2) => {
  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0)
  const norm1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0))
  const norm2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0))
  return dotProduct / (norm1 * norm2)
}
```

## 📊 Data Statistics

```json
{
  "totalDocuments": 50,
  "totalChunks": 1374,
  "embeddingDimension": 384,
  "embeddingModel": "all-MiniLM-L6-v2",
  "chunkSize": 1000,
  "chunkOverlap": 200
}
```

## 🔧 Roadmap

### Current Limitations
- Limited to pre-indexed documents only
- First search query takes longer while model loads (~5-10 seconds)

### Planned Improvements
- [ ] Add document upload and processing pipeline
- [ ] Implement relevance score thresholds for better filtering
- [ ] Add multi-language support
- [ ] Enhance document metadata extraction
- [ ] Add export functionality for search results
- [ ] Implement caching for faster subsequent searches

## 🤝 Contributing

This is a personal project showcasing semantic search for government documents. Feel free to fork and adapt for your own use cases.

## 📄 License

This project uses publicly available Kenya government documents. The codebase is available for educational and research purposes.

---

Built with modern web technologies for efficient government document search 🚀
