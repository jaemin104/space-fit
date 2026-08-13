import { useState } from 'react'
import './App.css'
import HomePage from './pages/HomePage'
import OrderPage from './pages/OrderPage'
import EarningsPage from './pages/EarningsPage'
import MyPage from './pages/MyPage'

type TabId = 'home' | 'order' | 'earnings' | 'my'

const TABS: { id: TabId; label: string }[] = [
  { id: 'home', label: '홈' },
  { id: 'order', label: '오더' },
  { id: 'earnings', label: '수익' },
  { id: 'my', label: '마이' },
]

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home')

  return (
    <div className="app-shell">
      <main className="page-content">
        {activeTab === 'home' && <HomePage />}
        {activeTab === 'order' && <OrderPage />}
        {activeTab === 'earnings' && <EarningsPage />}
        {activeTab === 'my' && <MyPage />}
      </main>
      <nav className="bottom-nav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`nav-button${activeTab === tab.id ? ' active' : ''}`}
            aria-pressed={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App
