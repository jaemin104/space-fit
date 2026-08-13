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
    <header><span>오늘의 운행 목표</span></header>
    <main>
      <h1>오늘의 목표 거리, 운임, 운행 시간을<br/>말하거나 직접 입력해 주세요.</h1>
      <button className={`microphone-button${listening ? ' listening' : ''}`} type="button" onClick={toggleListening} aria-label={listening ? '음성 인식 중지' : '음성으로 운행 목표 입력'}><span /></button>
      <strong className="listening-label">{listening ? '듣고 있어요…' : '마이크를 눌러 말해 주세요'}</strong>
      <label htmlFor="order-goal">텍스트로 입력하기</label>
      <textarea id="order-goal" value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="예: 오늘 8시간 운행하고 30만원 벌고 싶어요" aria-label="텍스트로 입력하기"/>
      {error && <div className="voice-error">{error}</div>}
    </main>
    <button className="voice-submit" type="button" disabled={analyzing || !transcript.trim()} onClick={submit}>{analyzing ? '분석 중…' : 'AI로 조합 찾기'}</button>
  </div>
}

const voiceStyles = `
.voice-order-screen{min-height:100%;padding:0 24px 26px;background:#fff;display:flex;flex-direction:column;color:#1a1600}.voice-order-screen header{height:58px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid #f3f0e3;font-size:18px;font-weight:800}.voice-order-screen main{flex:1;display:flex;align-items:center;flex-direction:column;padding-top:46px;text-align:center}.voice-order-screen h1{margin:0 0 36px;font-size:18px;line-height:1.55}.microphone-button{width:96px;height:96px;border:0;border-radius:50%;background:#fee500;color:#1a1600;box-shadow:0 10px 24px rgba(191,168,0,.22);cursor:pointer}.microphone-button span{position:relative;display:inline-block;width:22px;height:31px;border:3px solid currentColor;border-radius:13px}.microphone-button span:after{position:absolute;content:"";left:50%;bottom:-11px;width:28px;height:16px;border-bottom:3px solid currentColor;border-radius:0 0 15px 15px;transform:translateX(-50%)}.microphone-button.listening{background:#f04444;color:#fff;animation:voice-pulse .8s ease-in-out infinite alternate}.listening-label{margin:18px 0 42px;font-size:13px;color:#8d8157}.voice-order-screen label{width:100%;margin-bottom:9px;text-align:left;font-size:13px;font-weight:700}.voice-order-screen textarea{width:100%;height:92px;resize:none;border:1px solid #e7e1c8;border-radius:12px;background:#fff;padding:14px;font-size:13px;line-height:1.5;outline-color:#fee500}.voice-error{width:100%;margin-top:8px;color:#d44932;font-size:11px;text-align:left}.voice-submit{position:sticky;bottom:0;z-index:2;width:100%;border:0;border-radius:12px;background:#fee500;padding:16px;font-size:15px;font-weight:800;cursor:pointer}.voice-submit:disabled{opacity:.48;cursor:default}@keyframes voice-pulse{to{transform:scale(1.06);box-shadow:0 0 0 12px rgba(254,229,0,.13)}}`
