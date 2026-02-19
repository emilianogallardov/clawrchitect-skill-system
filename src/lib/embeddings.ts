import OpenAI from 'openai'

let _openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  })
  return response.data[0].embedding
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = []
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100)
    const response = await getOpenAI().embeddings.create({
      model: 'text-embedding-3-small',
      input: batch.map(t => t.slice(0, 8000)),
    })
    results.push(...response.data.map(d => d.embedding))
  }
  return results
}
