import type { TabId } from '../components/AppChrome'
import { useAppData } from '../context/useAppData'
import './pages.css'

function HomePage({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const { driver, grossEarnings, expenses, trips } = useAppData()
  const net = grossEarnings - expenses
  const today = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('. ', '.').replace(/\.$/u, '')
  const todayCount = trips.filter((trip) => trip.date === today).length
  return <div className="screen home-screen">
    <header className="home-header"><span>안녕하세요</span><h1>{driver.name}님</h1></header>
    <section className="goal-card">
      <h2>오늘의 운행 목표</h2>
      <button type="button" onClick={() => onNavigate('order')}>시작하기</button>
    </section>
    <section className="summary-section">
      <div className="summary-head"><span>오늘 요약 · 완료 {todayCount}건</span></div>
      <div className="net-earning">{net.toLocaleString()}<small>원</small></div>
    </section>
    <section className="recent-section"><h2>최근 운송 내역</h2>{trips.map((trip) => <article key={trip.id}><div><strong>{trip.route}</strong><span>{trip.date} · {trip.category} 운송</span></div><div><strong>{trip.price.toLocaleString()}원</strong><span className="complete-badge">완료</span></div></article>)}</section>
  </div>
}
export default HomePage
