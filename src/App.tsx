import { useState } from 'react'
import AppDataProvider from './context/AppDataProvider'
import { BottomNav, StatusBar, type TabId } from './components/AppChrome'
import HomePage from './pages/HomePage'
import EarningsPage from './pages/EarningsPage'
import MyPage from './pages/MyPage'
import OrderPage from './pages/OrderPage'
import coverTruck from './assets/cover-truck.png'
import './App.css'

function App() {
  const [started, setStarted] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [myDetailOpen, setMyDetailOpen] = useState(false)
  return <AppDataProvider><div className="phone-stage"><div className={`phone-shell ${!started ? 'cover-shell' : ''}`}>{!started ? <section className="app-cover"><div className="cover-brand"><img className="cover-truck" src={coverTruck} alt="화물 트럭"/><h1>Space-Fit</h1></div><button type="button" onClick={() => setStarted(true)}>시작하기</button></section> : <><StatusBar/><main className="page-content">
    {activeTab === 'home' && <HomePage onNavigate={setActiveTab}/>}
    {activeTab === 'order' && <OrderPage onBackToHome={() => setActiveTab('home')}/>}
    {activeTab === 'earnings' && <EarningsPage/>}
    {activeTab === 'my' && <MyPage onDetailChange={setMyDetailOpen}/>}
  </main>{activeTab !== 'order' && !myDetailOpen && <BottomNav active={activeTab} onChange={(tab) => { setMyDetailOpen(false); setActiveTab(tab) }}/>}</>}</div></div></AppDataProvider>
}

export default App
