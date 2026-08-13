import { analyzeRiskWithGemini, ApiError } from '../server/cargoAi.js'
export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ message: 'POST 요청만 허용됩니다.' })
  try { return response.status(200).json(await analyzeRiskWithGemini(request.body ?? {})) }
  catch (error) { console.error('[analyze-cargo-risk]', error); return response.status(error instanceof ApiError ? error.statusCode : 500).json({ message: error instanceof Error ? error.message : '혼적 분석 중 오류가 발생했습니다.' }) }
}
