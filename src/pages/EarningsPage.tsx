import { useState } from 'react'
import { useAppData } from '../context/useAppData'
import type { TripCategory } from '../context/appDataContext'
import './pages.css'

const categories: ('전체' | TripCategory)[] = ['전체', '일반', '특수', '장거리']
const chart = [{m:'7월',v:58},{m:'8월',v:73},{m:'9월',v:45},{m:'10월',v:88},{m:'11월',v:62},{m:'12월',v:95},{m:'1월',v:131}]

function EarningsPage() {
  const { trips, grossEarnings, expenses } = useAppData()
  const [category, setCategory] = useState<(typeof categories)[number]>('전체')
  const visible = category === '전체' ? trips : trips.filter((trip) => trip.category === category)
  return <div className="screen earnings-screen">
    <header className="plain-title"><h1>이용 내역</h1></header>
    <section className="earnings-hero"><span className="year-pill">2024년 1월 총 수익</span><div>{(grossEarnings-expenses).toLocaleString()}<small>원</small></div><div className="earnings-stats"><div><span>기본 운송</span><strong>{grossEarnings.toLocaleString()}원</strong></div><div><span>운행 경비</span><strong>{expenses.toLocaleString()}원</strong></div><div><span>횟수</span><strong>{trips.length}회</strong></div></div></section>
    <section className="transaction-section"><div className="section-heading"><h2>거래 내역</h2><span>{visible.length}건</span></div><div className="filter-row">{categories.map((item) => <button type="button" key={item} className={category===item?'active':''} onClick={() => setCategory(item)}>{item==='전체'?'전체 내역':`${item} 운송`}</button>)}</div>
      <div className="transaction-list">{visible.map((trip) => <article key={trip.id}><span className="truck-icon">▰</span><div className="trip-copy"><strong>{trip.from} → {trip.to}</strong><div><span>{trip.date}</span><em className={`cat-${trip.category}`}>{trip.category}</em></div></div><strong className="trip-price">{trip.price.toLocaleString()}원</strong></article>)}</div>
    </section>
    <section className="chart-section"><div className="section-heading"><h2>월별 운송 수익</h2><span>최근 7개월</span></div><div className="chart"><div className="y-labels"><span>100만</span><span>75만</span><span>50만</span><span>25만</span></div><div className="bars">{chart.map((item) => <div className="bar-item" key={item.m}><div className={`bar ${item.m==='1월'?'current':''}`} style={{height:`${Math.round(item.v/131*108)}px`}}>{item.m==='1월'&&<b>131만</b>}</div><span>{item.m}</span></div>)}</div></div></section>
  </div>
}
export default EarningsPage
