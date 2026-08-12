import { useEffect, useRef, useState } from 'react'
import { extractOrderPreferences, type OrderPreferences } from '../utils/fetchCargoAi'

type SpeechRecognitionResultEvent = Event & { results: ArrayLike<{ 0: { transcript: string } }> }
type SpeechRecognitionErrorEvent = Event & { error: string }
type SpeechRecognitionInstance = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

function getSpeechRecognition() {
  const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}

function parseLocalPreferences(text: string): OrderPreferences {
  const hour = text.match(/(\d+(?:\.\d+)?)\s*시간/)
  const minute = text.match(/(\d+)\s*분/)
  const distance = text.match(/(\d+(?:\.\d+)?)\s*(?:km|킬로)/i)
  const manwon = text.match(/(\d+(?:\.\d+)?)\s*만\s*원/)
  const won = text.match(/(\d[\d,]*)\s*원/)
  const maxMinutes = hour ? Math.round(Number(hour[1]) * 60) : minute ? Number(minute[1]) : null
  const maxDistanceKm = distance ? Number(distance[1]) : null
  const minPrice = manwon ? Math.round(Number(manwon[1]) * 10000) : won ? Number(won[1].replaceAll(',', '')) : null
  const parts = [maxMinutes !== null ? `${maxMinutes}분 이내` : '', maxDistanceKm !== null ? `${maxDistanceKm}km 이내` : '', minPrice !== null ? `${minPrice.toLocaleString()}원 이상` : ''].filter(Boolean)
  return { maxMinutes, maxDistanceKm, minPrice, summary: parts.join(' · ') || text.trim() }
}

export default function VoiceOrderPreferences({ onComplete }: { onComplete: (preferences: OrderPreferences, transcript: string) => void }) {
  const [transcript, setTranscript] = useState('')
  const [listening, setListening] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  useEffect(() => () => recognitionRef.current?.stop(), [])

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const Recognition = getSpeechRecognition()
    if (!Recognition) {
      setError('이 브라우저는 음성 인식을 지원하지 않아요. 아래 입력창을 이용해 주세요.')
      return
    }
    const recognition = new Recognition()
    recognition.lang = 'ko-KR'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0].transcript).join(' ')
      setTranscript(text)
      setError('')
    }
    recognition.onerror = (event) => {
      setListening(false)
      setError(event.error === 'not-allowed' ? '마이크 권한을 허용해 주세요.' : '음성을 인식하지 못했어요. 다시 말해 주세요.')
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setListening(true)
    setError('')
    recognition.start()
  }

  const submit = async () => {
    if (!transcript.trim()) {
      setError('원하는 운행 조건을 말하거나 입력해 주세요.')
      return
    }
    setAnalyzing(true)
    setError('')
    try {
      const result = await extractOrderPreferences(transcript)
      onComplete(result.preferences, transcript.trim())
    } catch (requestError) {
      const fallback = parseLocalPreferences(transcript)
      if (fallback.maxMinutes !== null || fallback.maxDistanceKm !== null || fallback.minPrice !== null) {
        onComplete(fallback, transcript.trim())
      } else {
        setError(requestError instanceof Error ? requestError.message : '운행 조건을 분석하지 못했어요.')
      }
    } finally {
      setAnalyzing(false)
    }
  }

  return <div className="voice-order-screen">
    <style>{voiceStyles}</style>
    <header><span className="voice-ai-mark">AI</span><small>맞춤 오더 찾기</small></header>
    <main>
      <div className={`voice-orb${listening ? ' listening' : ''}`}><span>{listening ? '•••' : '✦'}</span></div>
      <h1>기사님, 오늘은 어떤<br/>오더를 조합해볼까요?</h1>
      <p>원하는 운행 시간, 거리, 단가를 말해보세요.</p>
      <button className={`microphone-button${listening ? ' listening' : ''}`} type="button" onClick={toggleListening} aria-label={listening ? '음성 인식 중지' : '음성으로 조건 말하기'}><span /></button>
      <strong className="listening-label">{listening ? '듣고 있어요…' : '마이크를 눌러 말해보세요'}</strong>
      <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="예: 2시간 안에, 30km 이내로, 7만원 이상 받고 싶어요" aria-label="운행 조건"/>
      {error && <div className="voice-error">{error}</div>}
      <div className="voice-examples"><span>이렇게 말해보세요</span><button type="button" onClick={() => setTranscript('2시간 안에 30km 이내로 운행하고 7만원 이상 받고 싶어요')}>“2시간 · 30km · 7만원 이상”</button></div>
    </main>
    <button className="voice-submit" type="button" disabled={analyzing || !transcript.trim()} onClick={submit}>{analyzing ? 'Gemini가 조건을 분석하고 있어요…' : '조건에 맞는 추천 조합 보기'}</button>
  </div>
}

const voiceStyles = `
.voice-order-screen{min-height:100%;padding:22px 22px 26px;background:linear-gradient(180deg,#fffdf4 0%,#fff 55%,#fff8ce 100%);display:flex;flex-direction:column;color:#1a1600}.voice-order-screen header{display:flex;align-items:center;gap:8px}.voice-ai-mark{display:grid;place-items:center;width:31px;height:31px;border-radius:10px;background:#fee500;font-size:11px;font-weight:900}.voice-order-screen header small{font-size:13px;font-weight:700;color:#7b6f3b}.voice-order-screen main{flex:1;display:flex;align-items:center;flex-direction:column;padding-top:45px;text-align:center}.voice-orb{width:92px;height:92px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#fff8a3,#fee500 63%,#d7c000);box-shadow:0 14px 34px rgba(191,168,0,.24)}.voice-orb span{font-size:28px;color:#574d00}.voice-orb.listening{animation:voice-pulse 1s ease-in-out infinite alternate}.voice-order-screen h1{margin:25px 0 10px;font-size:25px;line-height:1.38}.voice-order-screen main>p{margin:0;color:#8e8150;font-size:14px}.microphone-button{width:74px;height:74px;margin-top:30px;border:0;border-radius:50%;background:#1a1600;color:white;box-shadow:0 10px 24px rgba(26,22,0,.2);cursor:pointer}.microphone-button span{position:relative;display:inline-block;width:20px;height:29px;border:3px solid white;border-radius:13px}.microphone-button span:after{position:absolute;content:"";left:50%;bottom:-10px;width:25px;height:15px;border-bottom:3px solid white;border-radius:0 0 15px 15px;transform:translateX(-50%)}.microphone-button.listening{background:#f04444;animation:voice-pulse .8s ease-in-out infinite alternate}.listening-label{margin-top:11px;font-size:12px;color:#7b6f3b}.voice-order-screen textarea{width:100%;height:74px;margin-top:20px;resize:none;border:1px solid #eee5b8;border-radius:14px;background:white;padding:13px;font-size:13px;line-height:1.5;outline-color:#fee500}.voice-error{width:100%;margin-top:8px;color:#d44932;font-size:11px;text-align:left}.voice-examples{width:100%;display:flex;align-items:flex-start;flex-direction:column;gap:7px;margin-top:15px}.voice-examples span{font-size:11px;color:#9a9060}.voice-examples button{border:0;border-radius:999px;background:#fff3c0;padding:8px 12px;color:#5a5020;font-size:11px}.voice-submit{position:sticky;bottom:0;z-index:2;width:100%;border:0;border-radius:13px;background:#fee500;padding:15px;font-weight:800;box-shadow:0 -10px 24px rgba(255,253,244,.92);cursor:pointer}.voice-submit:disabled{opacity:.48;cursor:default}@keyframes voice-pulse{to{transform:scale(1.08);box-shadow:0 0 0 12px rgba(254,229,0,.13)}}`
