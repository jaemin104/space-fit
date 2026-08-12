const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite'

export async function recommendWithGemini({ orders, operation, candidates }, apiKey = process.env.GEMINI_API_KEY) {
  if (!apiKey) throw new ApiError(503, 'GEMINI_API_KEY가 설정되지 않았습니다.')
  if (!Array.isArray(orders) || !operation?.vehicle || !Array.isArray(candidates)) throw new ApiError(400, '오더, 차량 정보, 후보 조합을 확인해 주세요.')
  const prompt = `당신은 한국 화물차의 공차율을 줄이는 복귀편 배차 전문가입니다.
목표는 현재 위치에서 복귀 목적지로 이동하는 동안 차량의 남은 중량과 부피를 넘지 않으면서 수익이 높고 추가 이동거리가 짧은 화물 조합을 고르는 것입니다.
규칙: 제공된 candidate만 선택하고 ID나 계산값을 만들지 마세요. 우선순위는 총 단가 35%, 짧은 추가거리 30%, 부피 적재율 15%, 중량 적재율 15%, 혼적 안전성 5%입니다. score가 높을수록 우선합니다. 최대 3개를 추천하세요. 시연과 안전 비교를 위해 금지 조합은 제외하되, 유리 액자가 포함된 high 위험의 운송 가능한 후보를 1개 포함하고 경고를 명확히 작성하세요. JSON 외 텍스트를 출력하지 마세요.
입력: ${JSON.stringify({ operation, orders, candidates })}
출력: {"recommendations":[{"orderIds":["order-001"],"title":"이번 복귀편 추천 조합","reason":"추천 이유","risk":{"level":"low|medium|high|prohibited","compatible":true,"reason":"혼적 판단 이유","warnings":["주의사항"]}}]}
위험 기준: 의류+의류는 낮음, 의류+유리 액자는 파손 가능성으로 높음, 식품+세제·화학제품은 금지입니다.`
  const result = await generateJson(prompt, apiKey)
  const candidateKeys = new Set(candidates.map((candidate) => [...candidate.orderIds].sort().join('|')))
  const recommendations = Array.isArray(result.recommendations) ? result.recommendations.filter((item) => candidateKeys.has(Array.isArray(item.orderIds) ? [...item.orderIds].sort().join('|') : '') && isRisk(item.risk)).slice(0, 3) : []
  if (!recommendations.length) throw new ApiError(502, 'Gemini가 유효한 추천 조합을 반환하지 않았습니다.')
  return { recommendations }
}

export async function analyzeRiskWithGemini({ orders, loadingOrderIds }, apiKey = process.env.GEMINI_API_KEY) {
  if (!apiKey) throw new ApiError(503, 'GEMINI_API_KEY가 설정되지 않았습니다.')
  if (!Array.isArray(orders) || !orders.length || !Array.isArray(loadingOrderIds)) throw new ApiError(400, '분석할 화물과 적재 순서를 확인해 주세요.')
  const prompt = `당신은 화물차 혼적 안전 검수 전문가입니다. 아래 화물을 loadingOrderIds 순서대로 적재할 때 파손, 압착, 오염, 냄새, 습기 위험을 판단하세요.
의류끼리는 낮은 위험입니다. 의류와 유리 액자는 높은 위험이며 유리는 마지막에 싣고 최상단에 고정해야 합니다. 식품과 세제·화학제품은 혼적 금지입니다. 화물 데이터에 근거하고 JSON 외 텍스트를 출력하지 마세요.
입력: ${JSON.stringify({ orders, loadingOrderIds })}
출력: {"risk":{"level":"low|medium|high|prohibited","compatible":true,"reason":"판단 이유","warnings":["구체적인 적재 주의사항"]}}`
  const result = await generateJson(prompt, apiKey)
  if (!isRisk(result.risk)) throw new ApiError(502, 'Gemini가 유효한 혼적 판단을 반환하지 않았습니다.')
  return { risk: result.risk }
}

export async function extractOrderPreferencesWithGemini({ transcript }, apiKey = process.env.GEMINI_API_KEY) {
  if (!apiKey) throw new ApiError(503, 'GEMINI_API_KEY가 설정되지 않았습니다.')
  if (typeof transcript !== 'string' || !transcript.trim()) throw new ApiError(400, '분석할 음성 문장을 입력해 주세요.')
  const prompt = `당신은 화물 운송 기사의 자연어 운행 조건을 숫자로 정리하는 도우미입니다.
문장에서 총 운행 시간 상한(분), 추가 운행 거리 상한(km), 희망 최소 총 운임(원)을 추출하세요.
"2시간"은 120분, "7만원"은 70000원입니다. 말하지 않은 조건은 null로 반환하세요. 추측하거나 없는 숫자를 만들지 마세요.
입력: ${JSON.stringify(transcript.trim())}
출력 JSON: {"preferences":{"maxMinutes":120,"maxDistanceKm":30,"minPrice":70000,"summary":"2시간 이내 · 30km 이내 · 70,000원 이상"}}`
  const result = await generateJson(prompt, apiKey)
  const preferences = result.preferences
  if (!preferences || !isNullableNumber(preferences.maxMinutes) || !isNullableNumber(preferences.maxDistanceKm) || !isNullableNumber(preferences.minPrice) || typeof preferences.summary !== 'string') throw new ApiError(502, 'Gemini가 운행 조건을 올바르게 반환하지 않았습니다.')
  return { preferences }
}

async function generateJson(prompt, apiKey) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }), signal: AbortSignal.timeout(20_000) })
  const body = await response.json()
  if (!response.ok) throw new ApiError(response.status, body.error?.message ?? 'Gemini API 요청에 실패했습니다.')
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('')
  if (!text) throw new ApiError(502, 'Gemini 응답이 비어 있습니다.')
  try { return JSON.parse(text) } catch { throw new ApiError(502, 'Gemini JSON 응답을 해석하지 못했습니다.') }
}

function isRisk(risk) { return risk && ['low', 'medium', 'high', 'prohibited'].includes(risk.level) && typeof risk.compatible === 'boolean' && typeof risk.reason === 'string' && Array.isArray(risk.warnings) }
function isNullableNumber(value) { return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0) }
export class ApiError extends Error { constructor(statusCode, message) { super(message); this.statusCode = statusCode } }
