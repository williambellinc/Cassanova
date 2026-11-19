'use client';

import { useEffect, useRef, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

type Round = { roundReference: string; outcome: { crashAt: number; cashoutAt: number | null; result: 'cashed_out' | 'bust' }; notice: string };

export default function VeltCrashPage() {
  const [target, setTarget] = useState(2);
  const [round, setRound] = useState<Round | null>(null);
  const [display, setDisplay] = useState(1);
  const [phase, setPhase] = useState<'ready' | 'requesting' | 'flying' | 'crashed' | 'cashed'>('ready');
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const launch = async () => {
    if (timer.current) clearInterval(timer.current);
    setError(''); setRound(null); setDisplay(1); setPhase('requesting');
    try {
      const response = await fetch(`${API}/originals/crash/demo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cashoutAt: target }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to start practice flight');
      const result = payload as Round;
      setRound(result); setPhase('flying');
      const end = result.outcome.crashAt;
      const reached = result.outcome.result === 'cashed_out';
      const finishAt = reached ? target : end;
      let current = 1;
      timer.current = setInterval(() => {
        current = Math.min(finishAt, current + Math.max(0.015, current * 0.035));
        setDisplay(Number(current.toFixed(2)));
        if (current >= finishAt) {
          if (timer.current) clearInterval(timer.current);
          setPhase(reached ? 'cashed' : 'crashed');
        }
      }, 45);
    } catch (err) {
      setPhase('ready');
      setError(err instanceof Error ? err.message : 'Practice game unavailable');
    }
  };

  return (
    <main className="min-h-screen bg-[#070c16] px-4 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">VELT Originals · Practice</p>
        <h1 className="mt-2 text-4xl font-black sm:text-5xl">Crash</h1>
        <p className="mt-3 max-w-2xl text-slate-400">Aviator-style rising multiplier. The server commits the crash point before the animation; the browser only visualises the already-determined practice outcome.</p>
        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-[#101a2c] p-5 sm:p-8">
          <div className="relative flex min-h-[330px] items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/10 bg-[radial-gradient(ellipse_at_bottom,#123d55_0%,#07111f_70%)]">
            <div className="absolute inset-x-0 bottom-10 h-px bg-cyan-200/20" />
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.18) 1px,transparent 1px)', backgroundSize: '36px 36px' }} />
            <div className="relative z-10 text-center">
              <div className={`text-6xl font-black tabular-nums sm:text-8xl ${phase === 'crashed' ? 'text-rose-400' : phase === 'cashed' ? 'text-emerald-300' : 'text-cyan-200'}`}>{display.toFixed(2)}x</div>
              <p className="mt-3 text-sm font-bold uppercase tracking-[0.25em] text-slate-400">{phase === 'ready' ? 'Ready for take-off' : phase === 'requesting' ? 'Generating server outcome…' : phase === 'flying' ? 'In flight' : phase === 'cashed' ? 'Target reached' : 'Crashed'}</p>
              <div className="mt-6 text-5xl" style={{ transform: `translateY(${phase === 'flying' ? -Math.min(90, (display - 1) * 22) : 0}px) rotate(-12deg)`, transition: 'transform 80ms linear' }}>✈</div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-center gap-4">
            <label className="text-xs text-slate-400">Auto cash-out target
              <select value={target} onChange={e => setTarget(Number(e.target.value))} disabled={phase === 'requesting' || phase === 'flying'} className="mt-2 block rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-lg font-bold text-white">
                {[1.25,1.5,2,3,5,10,25,50,100].map(n => <option key={n} value={n}>{n.toFixed(2)}x</option>)}
              </select>
            </label>
            <button onClick={launch} disabled={phase === 'requesting' || phase === 'flying'} className="rounded-xl bg-cyan-300 px-8 py-3.5 font-black text-slate-950 disabled:opacity-50">{phase === 'flying' ? 'Flying…' : 'Start flight'}</button>
          </div>
          {round && phase !== 'flying' && <div className="mt-6 rounded-xl bg-slate-950/70 p-4 text-center"><p className={`text-lg font-black ${round.outcome.result === 'cashed_out' ? 'text-emerald-300' : 'text-rose-300'}`}>{round.outcome.result === 'cashed_out' ? `Practice cash-out at ${round.outcome.cashoutAt}x` : `Crashed at ${round.outcome.crashAt.toFixed(2)}x`}</p><p className="mt-1 break-all text-xs text-slate-500">Round {round.roundReference}</p></div>}
          {error && <p role="alert" className="mt-4 text-center text-sm text-rose-300">{error}</p>}
        </section>
        <p className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-xs leading-6 text-amber-100/80">Practice only. No stake, cash-out, prize or wallet credit. The flight animation is illustrative; the server has already determined the result. Real-money use requires jurisdiction-specific authorization and independently certified game mathematics.</p>
      </div>
    </main>
  );
}
