import { useEffect, useRef, useState, type ChangeEvent } from 'react'

export interface PhotoPickerProps {
  label: string
  onSelect: (file: File) => void
}

type Mode = 'choices' | 'camera'

function mapCameraError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return '카메라 권한이 차단됐습니다. 브라우저 설정에서 허용해 주세요.'
    if (error.name === 'NotFoundError') return '연결된 카메라를 찾지 못했습니다.'
    if (error.name === 'NotReadableError') return '다른 프로그램이 카메라를 사용 중인지 확인해 주세요.'
  }
  return '카메라를 열지 못했습니다.'
}

function PhotoPicker({ label, onSelect }: PhotoPickerProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('choices')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState('')
  const [sheetBottom, setSheetBottom] = useState(76)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!stream) return

    const video = videoRef.current
    if (video) {
      video.srcObject = stream
      void video.play()
    }

    return () => {
      stream.getTracks().forEach((track) => track.stop())
    }
  }, [stream])

  const closePicker = () => {
    setStream(null)
    setOpen(false)
    setMode('choices')
  }

  const openPicker = () => {
    setMode('choices')
    setCameraError('')
    const triggerTop = triggerRef.current?.getBoundingClientRect().top
    if (triggerTop !== undefined) {
      setSheetBottom(Math.max(76, window.innerHeight - triggerTop + 10))
    }
    setOpen(true)
  }

  const startCamera = async () => {
    setCameraError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('이 브라우저에서는 카메라를 사용할 수 없습니다.')
      return
    }
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      setMode('camera')
      setStream(cameraStream)
    } catch (error) {
      setCameraError(mapCameraError(error))
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('카메라 화면이 준비될 때까지 잠시 기다려 주세요.')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const context = canvas.getContext('2d')
    if (!context) return

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('촬영 이미지를 만들지 못했습니다.')
        return
      }

      const file = new File([blob], `cargo-${Date.now()}.jpg`, { type: 'image/jpeg' })
      onSelect(file)
      closePicker()
    }, 'image/jpeg', 0.9)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onSelect(file)
      closePicker()
    }
  }

  return (
    <>
      <button type="button" ref={triggerRef} className="photo-picker-trigger" onClick={openPicker}>
        {label}
      </button>

      {open && (
        <div className="camera-picker-overlay" role="dialog" aria-modal="true" aria-label="사진 첨부 방식 선택">
          {mode === 'choices' ? (
            <div
              className="camera-picker-sheet"
              style={{ bottom: `${sheetBottom}px`, maxHeight: `calc(100vh - ${sheetBottom + 16}px)` }}
            >
              <h2>사진을 어떻게 등록할까요?</h2>
              <p>기존 사진을 선택하거나 카메라로 바로 촬영할 수 있어요.</p>

              <label className="camera-picker-choice">
                <span className="camera-picker-choice-icon" aria-hidden="true">🖼️</span>
                <span className="camera-picker-choice-text">
                  <strong>기존 폴더 사진 선택</strong>
                  <span>노트북 또는 휴대폰에 저장된 사진</span>
                </span>
                <input type="file" accept="image/*" className="camera-picker-file-input" onChange={handleFileChange} />
              </label>

              <button type="button" className="camera-picker-choice" onClick={() => void startCamera()}>
                <span className="camera-picker-choice-icon" aria-hidden="true">⏺️</span>
                <span className="camera-picker-choice-text">
                  <strong>카메라 촬영</strong>
                  <span>웹캠 또는 휴대폰 카메라 사용</span>
                </span>
              </button>

              {cameraError && <div className="camera-picker-error">{cameraError}</div>}

              <button type="button" className="camera-picker-cancel" onClick={closePicker}>취소</button>
            </div>
          ) : (
            <div className="camera-picker-camera">
              <header>
                <span>화물 사진 촬영</span>
                <button type="button" onClick={closePicker} aria-label="카메라 닫기">×</button>
              </header>
              <div className="camera-picker-preview">
                <video ref={videoRef} autoPlay muted playsInline />
              </div>
              {cameraError && <div className="camera-picker-error">{cameraError}</div>}
              <button type="button" className="camera-picker-shutter" onClick={capturePhoto}>촬영하기</button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default PhotoPicker
