import { useState, type ReactNode } from 'react'
import { Chevron, Toggle } from '../components/AppChrome'
import { useAppData } from '../context/useAppData'
import './pages.css'

type Editor = 'vehicle' | 'areas' | 'destination' | null
type VehicleType = '카고' | '윙바디' | '탑차'

interface VehicleDraft {
  type: VehicleType
  tonnage: string
  maxWeight: string
  length: string
  width: string
  height: string
  doorWidth: string
  doorHeight: string
  minimumProfit: string
  detourKm: string
  detourMinutes: string
  avoidedCargo: string[]
  refrigerated: boolean
  valuables: boolean
  insured: boolean
}

const cargoTypes = ['도자기·유리제품', '일반 가전', '정밀 전자기기', '소형 가구부속']
const initialVehicle: VehicleDraft = { type: '카고', tonnage: '1', maxWeight: '1,000', length: '2.8', width: '1.6', height: '0', doorWidth: '1.5', doorHeight: '1.4', minimumProfit: '30,000', detourKm: '10', detourMinutes: '30', avoidedCargo: [], refrigerated: true, valuables: false, insured: false }

function MyPage({ onDetailChange }: { onDetailChange?: (open: boolean) => void }) {
  const data = useAppData()
  const [editor, setEditor] = useState<Editor>(null)
  const [draft, setDraft] = useState('')
  const [vehicleDraft, setVehicleDraft] = useState<VehicleDraft>(initialVehicle)
  const open = (kind: Exclude<Editor, null>, value: string) => { setDraft(value); setEditor(kind) }
  const save = () => {
    if (editor === 'areas') data.setPreferredAreas(draft.split(',').map((v) => v.trim()).filter(Boolean))
    if (editor === 'destination') data.setReturnDestination(draft.trim() || data.driver.returnDestination)
    setEditor(null)
  }
  const updateVehicle = <K extends keyof VehicleDraft>(key: K, value: VehicleDraft[K]) => setVehicleDraft((current) => ({ ...current, [key]: value }))
  const toggleCargo = (cargo: string) => updateVehicle('avoidedCargo', vehicleDraft.avoidedCargo.includes(cargo) ? vehicleDraft.avoidedCargo.filter((item) => item !== cargo) : [...vehicleDraft.avoidedCargo, cargo])
  const saveVehicle = () => {
    data.setVehicle(`${vehicleDraft.tonnage}톤 ${vehicleDraft.type}`, Number(vehicleDraft.length) * Number(vehicleDraft.width) * Number(vehicleDraft.height || 1.23))
    setEditor(null)
    onDetailChange?.(false)
  }
  if (editor === 'vehicle') return <div className="screen vehicle-editor-screen">
    <header className="vehicle-editor-header"><button type="button" aria-label="뒤로 가기" onClick={() => { setEditor(null); onDetailChange?.(false) }}>‹</button><h1>차량·적재 정보</h1></header>
    <div className="vehicle-form">
      <FieldGroup label="차종"><div className="vehicle-type-row">{(['카고','윙바디','탑차'] as VehicleType[]).map((type)=><button type="button" className={vehicleDraft.type===type?'selected':''} onClick={()=>updateVehicle('type',type)} key={type}>{type}</button>)}</div></FieldGroup>
      <FieldGroup label="차량 톤수"><UnitInput value={vehicleDraft.tonnage} unit="톤" onChange={(v)=>updateVehicle('tonnage',v)}/></FieldGroup>
      <FieldGroup label="최대 적재중량 (실제 허용값)"><UnitInput value={vehicleDraft.maxWeight} unit="kg" onChange={(v)=>updateVehicle('maxWeight',v)}/></FieldGroup>
      <FieldGroup label="적재함 규격"><div className="dimension-row"><MiniInput value={vehicleDraft.length} label="길이 m" onChange={(v)=>updateVehicle('length',v)}/><MiniInput value={vehicleDraft.width} label="폭 m" onChange={(v)=>updateVehicle('width',v)}/><MiniInput value={vehicleDraft.height} label="높이 m" onChange={(v)=>updateVehicle('height',v)}/></div></FieldGroup>
      <FieldGroup label="적재함 문 규격" hint="문보다 큰 화물은 자동으로 매칭에서 빠져요"><div className="dimension-row two"><MiniInput value={vehicleDraft.doorWidth} label="문 폭 m" onChange={(v)=>updateVehicle('doorWidth',v)}/><MiniInput value={vehicleDraft.doorHeight} label="문 높이 m" onChange={(v)=>updateVehicle('doorHeight',v)}/></div></FieldGroup>
      <FieldGroup label="최소 수락 순수익" hint="이 금액 이상의 오더만 추천해 드릴게요"><UnitInput value={vehicleDraft.minimumProfit} unit="원" onChange={(v)=>updateVehicle('minimumProfit',v)}/></FieldGroup>
      <FieldGroup label="최대 우회 허용" hint="기본값이에요. 오더 화면에서 언제든 조정할 수 있어요"><div className="detour-row"><UnitInput value={vehicleDraft.detourKm} unit="km" onChange={(v)=>updateVehicle('detourKm',v)}/><UnitInput value={vehicleDraft.detourMinutes} unit="분" onChange={(v)=>updateVehicle('detourMinutes',v)}/></div></FieldGroup>
      <FieldGroup label="피하고 싶은 화물 유형"><div className="cargo-chip-row">{cargoTypes.map((cargo)=><button type="button" className={vehicleDraft.avoidedCargo.includes(cargo)?'selected':''} onClick={()=>toggleCargo(cargo)} key={cargo}>{cargo}</button>)}</div></FieldGroup>
      <div className="vehicle-toggle-row"><div><strong>냉동·냉장 화물</strong><span>냉동·냉장이 필요한 화물도 추천받을게요</span></div><Toggle checked={vehicleDraft.refrigerated} onChange={(v)=>updateVehicle('refrigerated',v)} label="냉동 냉장 화물"/></div>
      <div className="vehicle-toggle-row"><div><strong>고가품 운송 가능</strong><span>적재물배상보험 가입 시에만 설정할 수 있어요</span></div><Toggle checked={vehicleDraft.valuables} onChange={(v)=>updateVehicle('valuables',v)} label="고가품 운송 가능"/></div>
      <button type="button" className="insurance-row" onClick={()=>updateVehicle('insured',!vehicleDraft.insured)}><span>적재물배상보험 등록</span><strong>{vehicleDraft.insured?'등록 완료':'등록하기'} ›</strong></button>
    </div>
    <div className="vehicle-save-bar"><button type="button" onClick={saveVehicle}>저장하기</button></div>
  </div>
  return <div className="screen my-screen">
    <header className="plain-title"><h1>MY</h1></header>
    <section className="profile-card"><div className="avatar">김</div><div><strong>{data.driver.name} 기사님</strong><span>{data.vehicle.name} · {data.driver.returnDestination} 복귀</span></div><Chevron/></section>
    <section className="settings-section"><h2>차량·운송 설정</h2><div className="settings-list">
      <button type="button" onClick={() => { setEditor('vehicle'); onDetailChange?.(true) }}><div><strong>차량·적재 정보</strong><span>{data.vehicle.name} · 적재용적 {data.vehicle.maxVolume.toFixed(1)}m³</span></div><Chevron/></button>
      <button type="button" onClick={() => open('areas', data.driver.preferredAreas.join(', '))}><div><strong>선호 지역</strong><span>{data.driver.preferredAreas.join(' · ')}</span></div><Chevron/></button>
      <button type="button" onClick={() => open('destination', data.driver.returnDestination)}><div><strong>복귀 목적지</strong><span>{data.driver.returnDestination}</span></div><Chevron/></button>
    </div></section>
    <section className="settings-section notification-settings"><h2>알림·권한</h2><div className="settings-list">
      <div className="setting-row"><div><strong>신규 추천 오더 알림</strong><span>복귀 경로에 맞는 오더가 뜨면 알려드려요</span></div><Toggle checked={data.notifications.order} onChange={(v)=>data.setNotification('order',v)} label="신규 추천 오더 알림"/></div>
      <div className="setting-row"><div><strong>정산 알림</strong><span>정산 상태가 바뀌면 알려드려요</span></div><Toggle checked={data.notifications.settlement} onChange={(v)=>data.setNotification('settlement',v)} label="정산 알림"/></div>
      <div className="setting-row"><div><strong>위치 권한</strong><span>항상 허용 중</span></div><Toggle checked label="위치 권한"/></div>
    </div></section>
    <button className="logout" type="button">로그아웃</button>
    {editor && <div className="editor-backdrop" role="presentation" onMouseDown={() => setEditor(null)}><div className="editor-sheet" role="dialog" aria-modal="true" onMouseDown={(e)=>e.stopPropagation()}><h3>{editor==='areas'?'선호 지역':'복귀 목적지'} 수정</h3><p>{editor==='areas'?'지역을 쉼표로 구분해 입력하세요.':'변경할 내용을 입력하세요.'}</p><input autoFocus value={draft} onChange={(e)=>setDraft(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&save()}/><div><button type="button" onClick={()=>setEditor(null)}>취소</button><button type="button" onClick={save}>저장</button></div></div></div>}
  </div>
}
export default MyPage

function FieldGroup({label,hint,children}:{label:string;hint?:string;children:ReactNode}) { return <section className="vehicle-field"><label>{label}</label>{hint&&<p>{hint}</p>}{children}</section> }
function UnitInput({value,unit,onChange}:{value:string;unit:string;onChange:(value:string)=>void}) { return <div className="unit-input"><input inputMode="decimal" value={value} onChange={(e)=>onChange(e.target.value)}/><span>{unit}</span></div> }
function MiniInput({value,label,onChange}:{value:string;label:string;onChange:(value:string)=>void}) { return <div className="mini-input"><input inputMode="decimal" value={value} onChange={(e)=>onChange(e.target.value)}/><span>{label}</span></div> }
