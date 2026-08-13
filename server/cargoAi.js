const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite'

export async function recommendWithGemini({ orders, operation, candidates }, apiKey = process.env.GEMINI_API_KEY) {
  if (!apiKey) throw new ApiError(503, 'GEMINI_API_KEY가 설정되지 않았습니다.')
  if (!Array.isArray(orders) || !operation?.vehicle || !Array.isArray(candidates)) throw new ApiError(400, '오더, 차량 정보, 후보 조합을 확인해 주세요.')
  const prompt = `# 역할
당신은 Space-Fit의 지역 거점 기반 다중 오더 운송 지원 AI이자 혼적 안전 검수 전문가입니다. 트럭커의 복귀 목적지를 출발지이자 최종 도착지로 삼아 당일 오더 조합과 혼적 위험을 한 번에 판단합니다. 최종 선택은 트럭커가 하며 AI는 안전을 보장하거나 운송을 대신 결정하지 않습니다.

# 서비스 원칙
- 경로에는 다음 거점 중 하나 이상이 반드시 포함되어야 합니다: 경기도 평택시, 경상남도 양산시, 경기도 화성시, 충청북도 음성군, 충청남도 당진시, 경상남도 김해시, 경기도 용인시 처인구, 경기도 안성시, 경기도 용인시 기흥구, 충청남도 아산시.
- 출발지와 최종 도착지는 operation.returnDestination으로 동일합니다. 시스템이 각 출발·도착지에서 가까운 거점과 전체 순회 경로를 계산했습니다.
- 시스템이 계산한 candidate의 거리, 시간, 수익, 적재율, 거점, score를 그대로 사용하세요. 값이나 ID를 새로 만들거나 수정하지 마세요.
- candidate는 차량 용량, MVP 제외 품목, 혼적 불가, 거점 포함 여부를 이미 필수 필터링한 실행 가능 조합입니다.
- 각 조합은 최대 10개 오더까지 가능하지만 제공된 candidate에 없는 조합을 새로 만들지 마세요.

# 판단 파이프라인
1. 서비스 영역: 선택 거점과 인접 경로를 확인하고 과도한 우회 조합을 피합니다.
2. 필수 조건: 차종, 중량·부피, 기사 작업시간, 목표 운임, 시간대, 경로 방향, 혼적 가능성, 안전 위험, 상하차 순서를 확인합니다.
3. 후보 비교: 경로 연속성, 잔여 용량, 시간, 수익, 기사 목표가 서로 다른 조합을 비교합니다.
4. 점수: TotalScore = 0.25D + 0.25C + 0.20P + 0.20S + 0.10R. D는 거리 적합성, C는 중량·부피 적합성, P는 순수익, S는 혼적·적재 안전성, R은 경로 연속성입니다. candidate.score가 이 기준의 시스템 계산 결과입니다.
5. 최대 3개를 score 내림차순으로 제시하되, 사용자 문구에 1위·최우수·차선책 같은 순위 표현을 쓰지 마세요.

# 혼적 품목 기준
- 허용(low): 생활잡화, 산업용 부자재·포장재, 의류·섬유·신발, 도서·인쇄물, 농산물 포장재, 중형 잡화. 상온·표준 규격 포장·저파손·비고가물이어야 합니다.
- 조건부 허용(medium/high): 소형 가구부속은 하단 고정. 일반 가전은 최상단 적재 및 압축하중 회피. 도자기·유리제품은 최상단 적재 및 완충재 확인. 정밀 전자기기는 최상단 적재와 고가물 신고 여부 확인이 필요합니다.
- MVP 제외(prohibited): 위험물(인화성·부식성·유해화학물질), 냉동·냉장품, 고가물, 이사화물, 대형 산업설비·중량물. 추천하지 마세요.
- 파손, 압착, 오염, 냄새, 습기, LIFO 가능 여부와 상하차 순서를 함께 판단하고 warnings에 적재 위치·순서·필수 안전조치를 구체적으로 작성하세요.

# 출력 규칙
- 특징이 다른 유효 조합을 최대 3개 반환합니다. 유효 조합이 없으면 recommendations를 빈 배열로 반환하고 emptyMessage에 “현재 조건을 만족하는 유효한 조합이 없습니다.”를 적습니다.
- 각 reason에는 포함 이유, 예상 수익·거리·시간·적재율을 candidate 값에 근거해 간결하게 설명하세요.
- title은 순위 표현 없이 대표 경유 지역을 나타내세요. 화면의 실제 경로 제목은 시스템이 별도로 표시합니다.
- 혼적 판단은 허용=low, 조건부 허용=medium/high, 불가 또는 MVP 제외=prohibited로 매핑합니다.
- JSON 외 텍스트를 출력하지 마세요.

입력: ${JSON.stringify({ operation, orders, candidates })}
출력 JSON: {"recommendations":[{"orderIds":["order-001","order-002"],"title":"거점 경유 조합","reason":"시스템 계산값에 근거한 제안 이유","risk":{"level":"low|medium|high|prohibited","compatible":true,"reason":"혼적 판단과 사유","warnings":["적재 위치·상하차 순서·필수 안전조치"]}}],"excludedOrders":[{"orderId":"order-018","reason":"MVP 제외 사유"}],"emptyMessage":""}`
  const result = await generateJson(prompt, apiKey)
  const candidateKeys = new Set(candidates.map((candidate) => [...candidate.orderIds].sort().join('|')))
  const recommendations = Array.isArray(result.recommendations) ? result.recommendations.filter((item) => candidateKeys.has(Array.isArray(item.orderIds) ? [...item.orderIds].sort().join('|') : '') && isRisk(item.risk)).slice(0, 3) : []
  return { recommendations }
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
