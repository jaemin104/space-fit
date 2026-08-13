import { useState } from 'react'
import { useAppData } from '../context/useAppData'
import type { TripCategory } from '../context/appDataContext'
import './pages.css'

const categories: ('전체' | TripCategory)[] = ['전체', '일반', '특수', '장거리']
const previousChart = [{m:'2월',v:58},{m:'3월',v:73},{m:'4월',v:45},{m:'5월',v:88},{m:'6월',v:62},{m:'7월',v:95}]

function EarningsPage() {
  const { trips, grossEarnings, expenses } = useAppData()
  const [category, setCategory] = useState<(typeof categories)[number]>('전체')
  const visible = category === '전체' ? trips : trips.filter((trip) => trip.category === category)
  const currentMonth = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(new Date())
  const currentMonthShort = new Intl.DateTimeFormat('ko-KR', { month: 'numeric' }).format(new Date())
  const currentEarningsManwon = Math.round(grossEarnings / 10000)
  const chart = [...previousChart, { m: currentMonthShort, v: currentEarningsManwon }]
  const chartMaximum = Math.max(100, ...chart.map((item) => item.v))
  return <div className="screen earnings-screen">
    <header className="plain-title"><h1>이용 내역</h1></header>
    <section className="earnings-hero"><span className="year-pill">{currentMonth} 총 수익</span><div>{(grossEarnings-expenses).toLocaleString()}<small>원</small></div><div className="earnings-stats"><div><span>기본 운송</span><strong>{grossEarnings.toLocaleString()}원</strong></div><div><span>운행 경비</span><strong>{expenses.toLocaleString()}원</strong></div><div><span>횟수</span><strong>{trips.length}회</strong></div></div></section>
    <section className="transaction-section"><div className="section-heading"><h2>거래 내역</h2><span>{visible.length}건</span></div><div className="filter-row">{categories.map((item) => <button type="button" key={item} className={category===item?'active':''} onClick={() => setCategory(item)}>{item==='전체'?'전체 내역':`${item} 운송`}</button>)}</div>
      <div className="transaction-list">{visible.map((trip) => <article key={trip.id}><span className="truck-icon">▰</span><div className="trip-copy"><strong>{trip.route}</strong><div><span>{trip.date}</span><em className={`cat-${trip.category}`}>{trip.category}</em></div></div><strong className="trip-price">{trip.price.toLocaleString()}원</strong></article>)}</div>
    </section>
    <section className="chart-section"><div className="section-heading"><h2>월별 운송 수익</h2><span>최근 7개월</span></div><div className="chart"><div className="y-labels"><span>100만</span><span>75만</span><span>50만</span><span>25만</span></div><div className="bars">{chart.map((item) => <div className="bar-item" key={item.m}><div className={`bar ${item.m===currentMonthShort?'current':''}`} style={{height:`${Math.round(item.v/chartMaximum*108)}px`}}>{item.m===currentMonthShort&&<b>{currentEarningsManwon}만</b>}</div><span>{item.m}</span></div>)}</div></div></section>
  </div>
}
export default EarningsPage
