'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
type Result = Record<string, any>;

export default function CasinoPracticePage() {
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [roulette,setRoulette]=useState<Result|null>(null);
  const [slots,setSlots]=useState<Result|null>(null);
  const [baccarat,setBaccarat]=useState<Result|null>(null);
  const [blackjack,setBlackjack]=useState<Result|null>(null);
  const [roundId,setRoundId]=useState('');

  const post=async(path:string,body:Record<string,unknown>={},key:string) => {
    setBusy(key);setError('');
    try {
      const response=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.message||'Game request failed');
      if(key==='roulette')setRoulette(data.outcome);
      if(key==='slots')setSlots(data.outcome);
      if(key==='baccarat')setBaccarat(data.outcome);
      if(key==='blackjack'){setBlackjack(data.outcome);if(data.roundReference)setRoundId(data.roundReference);}
      return data;
    } catch(e){setError(e instanceof Error?e.message:'Game request failed');return null;}
    finally{setBusy('');}
  };

  const panel='rounded-3xl border border-white/10 bg-[#111b2c] p-5 shadow-xl';
  const action='rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950 disabled:opacity-50';
  const sub='text-sm text-slate-400';
  return <main className="min-h-screen bg-[#070c16] px-4 py-10 text-white sm:px-8">
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">VELT Casino · Practice</p>
      <h1 className="mt-2 text-4xl font-black sm:text-5xl">Classic casino games</h1>
      <p className="mt-3 max-w-3xl text-slate-400">Server-authoritative practice versions of Roulette, Slots, Baccarat and Blackjack. Outcomes are generated and recorded by the backend. No wallet, stake or prize is connected.</p>
      {error&&<p role="alert" className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section className={panel}>
          <div className="flex items-center justify-between"><h2 className="text-2xl font-black">European Roulette</h2><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">2.70% edge</span></div>
          <p className={sub+" mt-2"}>Single-zero wheel · 0–36 · red, black, even, odd, low, high or straight number</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {['red','black','even','odd','low','high'].map(v=><button key={v} disabled={!!busy} onClick={()=>post('/casino-practice/roulette/play',{betType:v},'roulette')} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-3 font-bold capitalize hover:border-cyan-300">{v}</button>)}
          </div>
          <div className="mt-3 flex gap-2"><input id="roulette-number" type="number" min="0" max="36" defaultValue="17" className="w-24 rounded-xl border border-white/10 bg-slate-900 px-3 py-3"/><button disabled={!!busy} onClick={()=>{const n=Number((document.getElementById('roulette-number') as HTMLInputElement).value);post('/casino-practice/roulette/play',{betType:'straight',selection:n},'roulette')}} className={action}>Straight bet</button></div>
          {roulette&&<div className="mt-5 rounded-2xl bg-slate-950 p-4"><div className="text-4xl font-black">{roulette.number} <span className="text-lg capitalize text-slate-400">{roulette.color}</span></div><p className="mt-1 text-sm">{roulette.result==='win'?'Practice win':'Practice loss'} · {roulette.betType}</p></div>}
        </section>

        <section className={panel}>
          <div className="flex items-center justify-between"><h2 className="text-2xl font-black">VELT 3-Reel Slots</h2><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">97.01% RTP</span></div>
          <p className={sub+" mt-2"}>Weighted reels · triple matches pay · deterministic paytable versioned on the server</p>
          <button disabled={!!busy} onClick={()=>post('/casino-practice/slots/spin',{},'slots')} className={action+" mt-5 w-full"}>{busy==='slots'?'Spinning…':'SPIN'}</button>
          {slots&&<div className="mt-5 grid grid-cols-3 gap-2">{slots.symbols?.map((s:string,i:number)=><div key={i} className="flex h-24 items-center justify-center rounded-2xl border border-cyan-300/20 bg-slate-950 text-center text-xl font-black">{s}</div>)}</div>}
          {slots&&<p className="mt-3 text-sm">{slots.result==='win'?'Triple match!':'No match'} · {slots.payoutMultiplier}x gross practice payout</p>}
        </section>

        <section className={panel}>
          <div className="flex items-center justify-between"><h2 className="text-2xl font-black">Baccarat</h2><span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200">Punto Banco</span></div>
          <p className={sub+" mt-2"}>Standard third-card rules · Player, Banker and Tie outcomes</p>
          <button disabled={!!busy} onClick={()=>post('/casino-practice/baccarat/deal',{},'baccarat')} className={action+" mt-5"}>Deal hand</button>
          {baccarat&&<div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-slate-950 p-4"><p className="text-xs uppercase text-slate-500">Player · {baccarat.playerTotal}</p><p className="mt-2 text-lg font-black">{baccarat.player?.join('  ')}</p></div><div className="rounded-2xl bg-slate-950 p-4"><p className="text-xs uppercase text-slate-500">Banker · {baccarat.bankerTotal}</p><p className="mt-2 text-lg font-black">{baccarat.banker?.join('  ')}</p></div><p className="col-span-2 text-lg font-black capitalize text-cyan-200">{baccarat.winner} wins</p></div>}
        </section>

        <section className={panel}>
          <div className="flex items-center justify-between"><h2 className="text-2xl font-black">Blackjack</h2><span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200">6-deck shoe</span></div>
          <p className={sub+" mt-2"}>Dealer stands on soft 17 · Hit or stand · Server-held shoe and dealer hole card</p>
          <div className="mt-5 flex flex-wrap gap-2"><button disabled={!!busy} onClick={()=>post('/casino-practice/blackjack/start',{},'blackjack')} className={action}>New hand</button><button disabled={!roundId||!!busy||blackjack?.result} onClick={()=>post('/casino-practice/blackjack/'+roundId+'/hit',{},'blackjack')} className="rounded-xl border border-white/15 px-5 py-3 font-bold disabled:opacity-40">Hit</button><button disabled={!roundId||!!busy||blackjack?.result} onClick={()=>post('/casino-practice/blackjack/'+roundId+'/stand',{},'blackjack')} className="rounded-xl border border-white/15 px-5 py-3 font-bold disabled:opacity-40">Stand</button></div>
          {blackjack&&<div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-slate-950 p-4"><p className="text-xs uppercase text-slate-500">Player · {blackjack.playerTotal}</p><p className="mt-2 text-lg font-black">{blackjack.player?.join('  ')}</p></div><div className="rounded-2xl bg-slate-950 p-4"><p className="text-xs uppercase text-slate-500">Dealer · {blackjack.dealerTotal??'?'}</p><p className="mt-2 text-lg font-black">{blackjack.dealer?.join('  ')}</p></div>{blackjack.result&&<p className="col-span-2 text-lg font-black uppercase text-cyan-200">{blackjack.result}</p>}</div>}
        </section>
      </div>
      <p className="mt-7 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-xs leading-6 text-amber-100/80">Practice mode only. No monetary value, wallet settlement or cash prizes. The displayed theoretical returns describe the published practice math and are not independent game certification. Real-money versions remain disabled until provider sandbox tests, accredited game certification and jurisdiction-specific authorisation are complete.</p>
    </div>
  </main>;
}
