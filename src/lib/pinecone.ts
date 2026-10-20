/**
 * Pinecone Vector Database Integration & Embedding Engine
 * Embeds job descriptions and candidate profiles for cosine similarity matching
 */

import { Pinecone } from '@pinecone-database/pinecone';

let pineconeClient: Pinecone | null = null;

function getPineconeClient(): Pinecone | null {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey || !apiKey.trim()) return null;

  if (!pineconeClient) {
    try {
      pineconeClient = new Pinecone({ apiKey });
    } catch (err) {
      console.warn('Failed to initialize Pinecone client:', err);
      return null;
    }
  }
  return pineconeClient;
}

/**
 * Computes cosine similarity between two numeric vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return Math.max(0, Math.min(1, dotProduct / denominator));
}

// Fast memory cache for text embeddings
const embeddingCache = new Map<string, number[]>();

/**
 * Generates an embedding vector using Pinecone Inference API or resilient term-frequency vector
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const cacheKey = text.length > 300 ? text.slice(0, 300) : text;
  const cached = embeddingCache.get(cacheKey);
  if (cached) return cached;

  const pc = getPineconeClient();

  if (pc) {
    try {
      // Use Pinecone Inference Embedding Model if key is active
      const embeddings = await pc.inference.embed({
        model: 'multilingual-e5-large',
        inputs: [text.slice(0, 1000)],
        parameters: { inputType: 'passage', truncate: 'END' },
      });

      if (embeddings && embeddings.data && embeddings.data[0] && Array.isArray((embeddings.data[0] as any).values)) {
        const vec = (embeddings.data[0] as any).values;
        embeddingCache.set(cacheKey, vec);
        return vec;
      }
    } catch (err) {
      console.warn('Pinecone inference embedding failed, using resilient vector model:', err);
    }
  }

  // High-dimensional semantic token frequency embedding (128-dim hash vector)
  const vec = generateTermVector(text);
  embeddingCache.set(cacheKey, vec);
  return vec;
}

/**
 * Generates deterministic normalized 128-dimensional term embedding for resilient local vector math
 */
function generateTermVector(text: string, dimensions = 128): number[] {
  const vector = new Array(dimensions).fill(0);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9#+.]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (words.length === 0) return vector;

  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % dimensions;
    vector[index] += 1;
  }

  // Normalize vector to unit length
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) {
    sumSq += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < dimensions; i++) {
    vector[i] = vector[i] / norm;
  }

  return vector;
}

/**
 * Computes base cosine similarity between candidate profile and a job description
 */
export async function computeJobCosineScore(
  candidateSummary: string,
  jdText: string
): Promise<number> {
  const [candidateVector, jdVector] = await Promise.all([
    getEmbedding(candidateSummary),
    getEmbedding(jdText),
  ]);

  return cosineSimilarity(candidateVector, jdVector);
}
