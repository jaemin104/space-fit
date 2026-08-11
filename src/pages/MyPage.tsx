import { useState } from 'react'
import { Chevron, Toggle } from '../components/AppChrome'
import { useAppData } from '../context/useAppData'
import './pages.css'

type Editor = 'vehicle' | 'areas' | 'destination' | null

function MyPage() {
  const data = useAppData()
  const [editor, setEditor] = useState<Editor>(null)
  const [draft, setDraft] = useState('')
  const open = (kind: Exclude<Editor, null>, value: string) => { setDraft(value); setEditor(kind) }
  const save = () => {
    if (editor === 'vehicle') data.setVehicle(draft.trim() || data.vehicle.name, data.vehicle.maxVolume)
    if (editor === 'areas') data.setPreferredAreas(draft.split(',').map((v) => v.trim()).filter(Boolean))
    if (editor === 'destination') data.setReturnDestination(draft.trim() || data.driver.returnDestination)
    setEditor(null)
  }
  return <div className="screen my-screen">
    <header className="plain-title"><h1>MY</h1></header>
    <section className="profile-card"><div className="avatar">김</div><div><strong>{data.driver.name} 기사님</strong><span>{data.vehicle.name} · {data.driver.returnDestination} 복귀</span></div><Chevron/></section>
    <section className="settings-section"><h2>차량·운송 설정</h2><div className="settings-list">
      <button type="button" onClick={() => open('vehicle', data.vehicle.name)}><div><strong>차량·적재 정보</strong><span>{data.vehicle.name} · 적재용적 {data.vehicle.maxVolume}m³</span></div><Chevron/></button>
      <button type="button" onClick={() => open('areas', data.driver.preferredAreas.join(', '))}><div><strong>선호 지역</strong><span>{data.driver.preferredAreas.join(' · ')}</span></div><Chevron/></button>
      <button type="button" onClick={() => open('destination', data.driver.returnDestination)}><div><strong>복귀 목적지</strong><span>{data.driver.returnDestination}</span></div><Chevron/></button>
    </div></section>
    <section className="settings-section notification-settings"><h2>알림·권한</h2><div className="settings-list">
      <div className="setting-row"><div><strong>신규 추천 오더 알림</strong><span>복귀 경로에 맞는 오더가 뜨면 알려드려요</span></div><Toggle checked={data.notifications.order} onChange={(v)=>data.setNotification('order',v)} label="신규 추천 오더 알림"/></div>
      <div className="setting-row"><div><strong>정산 알림</strong><span>정산 상태가 바뀌면 알려드려요</span></div><Toggle checked={data.notifications.settlement} onChange={(v)=>data.setNotification('settlement',v)} label="정산 알림"/></div>
      <div className="setting-row"><div><strong>위치 권한</strong><span>항상 허용 중</span></div><Toggle checked label="위치 권한"/></div>
    </div></section>
    <button className="logout" type="button">로그아웃</button>
    {editor && <div className="editor-backdrop" role="presentation" onMouseDown={() => setEditor(null)}><div className="editor-sheet" role="dialog" aria-modal="true" onMouseDown={(e)=>e.stopPropagation()}><h3>{editor==='vehicle'?'차량 정보':editor==='areas'?'선호 지역':'복귀 목적지'} 수정</h3><p>{editor==='areas'?'지역을 쉼표로 구분해 입력하세요.':'변경할 내용을 입력하세요.'}</p><input autoFocus value={draft} onChange={(e)=>setDraft(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&save()}/><div><button type="button" onClick={()=>setEditor(null)}>취소</button><button type="button" onClick={save}>저장</button></div></div></div>}
  </div>
}
export default MyPage
