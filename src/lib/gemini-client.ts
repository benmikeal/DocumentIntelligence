/**
 * Gemini API Client Wrapper
 *
 * Provides a centralized interface for interacting with Google's Gemini API
 * Handles authentication, error handling, and common configurations
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Validate API key presence
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error(
    'GEMINI_API_KEY is not set. Please add it to your .env.local file.\n' +
    'Get your API key from: https://ai.google.dev'
  );
}

// Initialize Gemini client
export const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Get a generative model instance
 * @param modelName - Model name (default: gemini-2.5-flash)
 */
export function getModel(modelName: string = 'gemini-2.5-flash') {
  return genAI.getGenerativeModel({ model: modelName });
}

/**
 * Available Gemini models for File Search
 */
export const GEMINI_MODELS = {
  FLASH: 'gemini-2.5-flash',     // Fast, cost-effective
  PRO: 'gemini-2.5-pro',         // More capable, higher quality
} as const;

/**
 * Gemini API configuration
 */
export const GEMINI_CONFIG = {
  // File Search limits
  MAX_FILE_SIZE_MB: 100,
  MAX_FREE_STORAGE_GB: 1,

  // Recommended limits per store
  RECOMMENDED_STORE_SIZE_GB: 20,

  // Search configuration
  DEFAULT_TOP_K: 5,
  MAX_TOP_K: 20,

  // Chunking configuration (optional - Gemini auto-chunks by default)
  DEFAULT_CHUNK_SIZE: 200,      // tokens per chunk
  DEFAULT_OVERLAP_TOKENS: 20,   // overlap between chunks
} as const;

/**
 * Error handler for Gemini API calls
 */
export class GeminiAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'GeminiAPIError';
  }
}

/**
 * Wrapper for safe API calls with error handling
 */
export async function safeGeminiCall<T>(
  operation: () => Promise<T>,
  errorContext: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`[Gemini API Error] ${errorContext}:`, error);

    if (error instanceof Error) {
      throw new GeminiAPIError(
        `${errorContext}: ${error.message}`,
        undefined,
        error
      );
    }

    throw new GeminiAPIError(
      `${errorContext}: Unknown error occurred`,
      undefined,
      error
    );
  }
}

/**
 * Validate Gemini API key format
 */
export function validateAPIKey(apiKey: string): boolean {
  // Google API keys typically start with "AIza" and are 39 characters
  return /^AIza[0-9A-Za-z-_]{35}$/.test(apiKey);
}

/**
 * Test Gemini API connectivity
 */
export async function testConnection(): Promise<boolean> {
  try {
    const model = getModel(GEMINI_MODELS.FLASH);
    const result = await model.generateContent('Hello');
    const response = await result.response;
    const text = response.text();

    console.log('[Gemini] ✅ API connection successful!');
    console.log('[Gemini] Test response:', text.substring(0, 50) + '...');

    return true;
  } catch (error) {
    console.error('[Gemini] ❌ API connection failed:', error);
    return false;
  }
}

// Validate API key on module load
if (!validateAPIKey(GEMINI_API_KEY)) {
  console.warn(
    '[Gemini] ⚠️  API key format appears invalid. ' +
    'Expected format: AIza followed by 35 alphanumeric characters.'
  );
}

console.log('[Gemini] 🚀 Client initialized successfully');
