import type { ReactNode } from 'react'

export type TabId = 'home' | 'order' | 'earnings' | 'my'

const iconPaths: Record<TabId, ReactNode> = {
  home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></>,
  order: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  earnings: <><path d="M5 3v18M19 3v18"/><path d="M5 6h14M5 18h14"/><path d="M9 10h6M9 14h4"/></>,
  my: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
}

export function AppIcon({ name, size = 24 }: { name: TabId; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>
}

export function StatusBar() {
  return <div className="status-bar"><span>9:41</span><div className="status-icons"><span className="signal">▮▮▮</span><span>⌁</span><span className="battery">▰</span></div></div>
}

const tabs: { id: TabId; label: string }[] = [
  { id: 'earnings', label: '수익' },
  { id: 'home', label: '홈' },
  { id: 'my', label: 'MY' },
]

export function BottomNav({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return <nav className="bottom-nav" aria-label="주요 메뉴">{tabs.map((tab) => <button key={tab.id} type="button" className={active === tab.id ? 'active' : ''} onClick={() => onChange(tab.id)}><AppIcon name={tab.id}/><span>{tab.label}</span></button>)}</nav>
}

export function BellIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
}

export function Chevron() { return <span className="chevron" aria-hidden="true">›</span> }

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange?: (value: boolean) => void; label: string }) {
  return <button className={`toggle ${checked ? 'on' : ''}`} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange?.(!checked)}><span /></button>
}
