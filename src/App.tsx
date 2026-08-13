import { useState } from 'react'
import AppDataProvider from './context/AppDataProvider'
import { BottomNav, StatusBar, type TabId } from './components/AppChrome'
import HomePage from './pages/HomePage'
import EarningsPage from './pages/EarningsPage'
import MyPage from './pages/MyPage'
import OrderPage from './pages/OrderPage'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  return <AppDataProvider><div className="phone-stage"><div className="phone-shell"><StatusBar/><main className="page-content">
    {activeTab === 'home' && <HomePage onNavigate={setActiveTab}/>}
    {activeTab === 'order' && <OrderPage/>}
    {activeTab === 'earnings' && <EarningsPage/>}
    {activeTab === 'my' && <MyPage/>}
  </main>{activeTab !== 'order' && <BottomNav active={activeTab} onChange={setActiveTab}/>}</div></div></AppDataProvider>
}

export default App
