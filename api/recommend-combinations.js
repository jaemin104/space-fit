import { ApiError, recommendWithGemini } from '../server/cargoAi.js'
export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ message: 'POST 요청만 허용됩니다.' })
  try { return response.status(200).json(await recommendWithGemini(request.body ?? {})) }
  catch (error) { console.error('[recommend-combinations]', error); return response.status(error instanceof ApiError ? error.statusCode : 500).json({ message: error instanceof Error ? error.message : '조합 분석 중 오류가 발생했습니다.' }) }
}
