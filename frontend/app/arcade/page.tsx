'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Mode = 'snake' | 'solitaire';
type Difficulty = 'easy' | 'hard' | 'expert';
type Point = { x: number; y: number };
type Suit = '♠' | '♥' | '♦' | '♣';
type Card = { id: string; suit: Suit; rank: number; faceUp: boolean };
type Pile = Card[];

const SIZE = 18;
const SPEED: Record<Difficulty, number> = { easy: 170, hard: 105, expert: 65 };
const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const rankText = (rank: number) => rank === 1 ? 'A' : rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : String(rank);
const red = (suit: Suit) => suit === '♥' || suit === '♦';
const shuffled = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
const makeDeck = (): Card[] => shuffled(SUITS.flatMap(suit => Array.from({ length: 13 }, (_, i) => ({
  id: `${suit}-${i + 1}`, suit, rank: i + 1, faceUp: false,
}))));
const sameColor = (a: Suit, b: Suit) => red(a) === red(b);

export default function VeltArcadePage() {
  const [mode, setMode] = useState<Mode>('snake');
  const [difficulty, setDifficulty] = useState<Difficulty>('hard');
  const [snake, setSnake] = useState<Point[]>([{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }]);
  const [food, setFood] = useState<Point>({ x: 12, y: 9 });
  const [snakeState, setSnakeState] = useState<'ready' | 'running' | 'over'>('ready');
  const [score, setScore] = useState(0);
  const directionRef = useRef(direction);
  const [stock, setStock] = useState<Card[]>([]);
  const [waste, setWaste] = useState<Card[]>([]);
  const [tableau, setTableau] = useState<Pile[]>([]);
  const [foundations, setFoundations] = useState<Pile[]>([[], [], [], []]);
  const [drawCount, setDrawCount] = useState<1 | 3>(1);
  const [selected, setSelected] = useState<{ pile: number; index: number } | null>(null);
  const [solitaireMoves, setSolitaireMoves] = useState(0);
  const [solitaireMessage, setSolitaireMessage] = useState('Build descending alternating-colour sequences; move Aces to foundations.');

  const resetSnake = useCallback(() => {
    setSnake([{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }]);
    setFood({ x: 12, y: 9 }); directionRef.current = { x: 1, y: 0 };
    setScore(0); setSnakeState('ready');
  }, []);

  const stepSnake = useCallback(() => {
    setSnake(current => {
      const d = directionRef.current;
      const head = { x: current[0].x + d.x, y: current[0].y + d.y };
      const eating = head.x === food.x && head.y === food.y;
      const body = eating ? current : current.slice(0, -1);
      if (head.x < 0 || head.x >= SIZE || head.y < 0 || head.y >= SIZE || body.some(p => p.x === head.x && p.y === head.y)) {
        setSnakeState('over'); return current;
      }
      const next = [head, ...current.slice(0, eating ? current.length : -1)];
      if (eating) {
        setScore(s => s + 10);
        const free: Point[] = [];
        for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (!next.some(p => p.x === x && p.y === y)) free.push({ x, y });
        if (free.length) setFood(free[Math.floor(Math.random() * free.length)]);
      }
      return next;
    });
  }, [food]);

  useEffect(() => {
    if (mode !== 'snake' || snakeState !== 'running') return;
    const timer = window.setInterval(stepSnake, SPEED[difficulty]);
    return () => window.clearInterval(timer);
  }, [mode, snakeState, difficulty, stepSnake]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const keys: Record<string, Point> = {
        ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
      };
      const next = keys[event.key];
      if (!next || mode !== 'snake') return;
      event.preventDefault();
      const current = directionRef.current;
      if (next.x !== -current.x || next.y !== -current.y) {
        directionRef.current = next;
        if (snakeState === 'ready') setSnakeState('running');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, snakeState]);

  const newSolitaire = useCallback((draw: 1 | 3 = drawCount) => {
    const deck = makeDeck();
    const piles: Pile[] = Array.from({ length: 7 }, () => []);
    let cursor = 0;
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck[cursor++];
        piles[col].push({ ...card, faceUp: row === col });
      }
    }
    setStock(deck.slice(cursor)); setWaste([]); setTableau(piles); setFoundations([[], [], [], []]);
    setSelected(null); setSolitaireMoves(0); setSolitaireMessage(draw === 1 ? 'Draw-one mode: classic difficulty.' : 'Draw-three mode: advanced difficulty.');
  }, [drawCount]);

  useEffect(() => { newSolitaire(1); }, [newSolitaire]);

  const drawStock = () => {
    if (stock.length) {
      const count = Math.min(drawCount, stock.length);
      const drawn = stock.slice(-count).reverse().map(c => ({ ...c, faceUp: true }));
      setStock(s => s.slice(0, -count)); setWaste(w => [...w, ...drawn]); setSelected(null); setSolitaireMoves(m => m + 1);
    } else if (waste.length) {
      setStock(waste.slice().reverse().map(c => ({ ...c, faceUp: false })));
      setWaste([]); setSelected(null); setSolitaireMoves(m => m + 1);
    }
  };

  const selectedCards = () => {
    if (!selected) return [];
    if (selected.pile === -1) return waste.length ? [waste[waste.length - 1]] : [];
    return tableau[selected.pile]?.slice(selected.index) || [];
  };

  const moveToTableau = (destination: number) => {
    if (!selected) return;
    const moving = selectedCards();
    if (!moving.length) return;
    const target = tableau[destination];
    const first = moving[0];
    const top = target[target.length - 1];
    const valid = top ? (top.rank === first.rank + 1 && !sameColor(top.suit, first.suit)) : first.rank === 13;
    if (!valid || (selected.pile === destination)) return;
    const next = tableau.map(p => [...p]);
    if (selected.pile === -1) setWaste(w => w.slice(0, -1));
    else {
      next[selected.pile] = next[selected.pile].slice(0, selected.index);
      const oldTop = next[selected.pile][next[selected.pile].length - 1];
      if (oldTop) oldTop.faceUp = true;
    }
    next[destination] = [...next[destination], ...moving];
    setTableau(next); setSelected(null); setSolitaireMoves(m => m + 1);
    setSolitaireMessage('Good move. Keep alternating colours and descending ranks.');
  };

  const moveToFoundation = () => {
    if (!selected) return;
    const moving = selectedCards();
    if (moving.length !== 1) return;
    const card = moving[0];
    const index = SUITS.indexOf(card.suit);
    const foundation = foundations[index];
    const valid = foundation.length ? card.rank === foundation[foundation.length - 1].rank + 1 : card.rank === 1;
    if (!valid) return;
    const next = foundations.map(p => [...p]);
    next[index].push(card);
    setFoundations(next);
    if (selected.pile === -1) setWaste(w => w.slice(0, -1));
    else {
      const piles = tableau.map(p => [...p]);
      piles[selected.pile] = piles[selected.pile].slice(0, selected.index);
      const oldTop = piles[selected.pile][piles[selected.pile].length - 1];
      if (oldTop) oldTop.faceUp = true;
      setTableau(piles);
    }
    setSelected(null); setSolitaireMoves(m => m + 1);
    if (next.every(p => p.length === 13)) setSolitaireMessage('Victory! All 52 cards are home.');
  };

  const clickTableauCard = (pile: number, index: number) => {
    const card = tableau[pile][index];
    if (!card.faceUp) return;
    if (selected) {
      if (selected.pile === pile && selected.index === index) setSelected(null);
      else moveToTableau(pile);
    } else setSelected({ pile, index });
  };

  const clickWaste = () => {
    if (!waste.length) return;
    if (selected) setSelected(null);
    else setSelected({ pile: -1, index: waste.length - 1 });
  };

  const cardFace = (card: Card, small = false) => (
    <div className={`flex h-full w-full flex-col justify-between rounded-lg border p-1.5 text-left shadow-md ${card.faceUp ? 'border-slate-300 bg-white text-slate-900' : 'border-emerald-700 bg-emerald-900 text-emerald-100'} ${card.faceUp && red(card.suit) ? 'text-rose-600' : ''} ${small ? 'text-xs' : 'text-sm'}`}>
      {card.faceUp ? <><span className="font-black">{rankText(card.rank)}{card.suit}</span><span className="self-center text-2xl">{card.suit}</span></> : <span className="text-center text-xl">✦</span>}
    </div>
  );

  return (
    <main className="min-h-screen bg-[#080d18] px-4 py-9 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">VELT Arcade</p><h1 className="mt-2 text-4xl font-black sm:text-5xl">Play for the challenge.</h1><p className="mt-2 text-sm text-slate-400">Original, free-to-play arcade games. No wagers, deposits or prizes.</p></div>
          <div className="flex gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
            <button onClick={() => setMode('snake')} className={`rounded-lg px-4 py-2 text-sm font-bold ${mode === 'snake' ? 'bg-cyan-300 text-slate-950' : 'text-slate-300'}`}>Snake</button>
            <button onClick={() => setMode('solitaire')} className={`rounded-lg px-4 py-2 text-sm font-bold ${mode === 'solitaire' ? 'bg-cyan-300 text-slate-950' : 'text-slate-300'}`}>Solitaire</button>
          </div>
        </div>

        {mode === 'snake' && <section className="mt-7 grid gap-5 lg:grid-cols-[1fr_260px]">
          <div className="rounded-3xl border border-white/10 bg-[#111a2b] p-4 sm:p-6">
            <div className="mx-auto grid aspect-square w-full max-w-[540px] grid-cols-18 gap-[2px] rounded-xl bg-slate-950 p-2" style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}>
              {Array.from({ length: SIZE * SIZE }, (_, i) => {
                const point = { x: i % SIZE, y: Math.floor(i / SIZE) };
                const bodyIndex = snake.findIndex(p => p.x === point.x && p.y === point.y);
                const isFood = food.x === point.x && food.y === point.y;
                return <div key={i} className={`aspect-square rounded-[3px] ${bodyIndex === 0 ? 'bg-cyan-200 shadow-[0_0_10px_#67e8f9]' : bodyIndex > 0 ? 'bg-cyan-500' : isFood ? 'bg-rose-400 shadow-[0_0_10px_#fb7185]' : 'bg-slate-800/70'}`} />;
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-400">Use arrow keys or WASD. Swipe controls work on touch keyboards via the buttons below.</p><p className="font-bold">Score <span className="text-cyan-300">{score}</span></p></div>
            <div className="mt-4 flex justify-center gap-2 md:hidden">
              <button onClick={() => { directionRef.current = { x: 0, y: -1 }; setSnakeState('running'); }} className="rounded-lg bg-slate-800 px-4 py-3">↑</button>
              <button onClick={() => { directionRef.current = { x: -1, y: 0 }; setSnakeState('running'); }} className="rounded-lg bg-slate-800 px-4 py-3">←</button>
              <button onClick={() => { directionRef.current = { x: 0, y: 1 }; setSnakeState('running'); }} className="rounded-lg bg-slate-800 px-4 py-3">↓</button>
              <button onClick={() => { directionRef.current = { x: 1, y: 0 }; setSnakeState('running'); }} className="rounded-lg bg-slate-800 px-4 py-3">→</button>
            </div>
          </div>
          <aside className="rounded-3xl border border-white/10 bg-[#111a2b] p-5">
            <h2 className="text-xl font-black">Snake challenge</h2>
            <label className="mt-5 block text-xs text-slate-400">Difficulty</label>
            <select value={difficulty} onChange={e => { setDifficulty(e.target.value as Difficulty); resetSnake(); }} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-white"><option value="easy">Easy · relaxed</option><option value="hard">Hard · fast</option><option value="expert">Expert · extreme</option></select>
            <div className="mt-5 rounded-xl bg-slate-950 p-4"><p className="text-xs uppercase tracking-widest text-slate-500">Game status</p><p className="mt-1 text-lg font-bold">{snakeState === 'ready' ? 'Ready' : snakeState === 'running' ? 'In progress' : 'Game over'}</p><p className="mt-1 text-sm text-slate-400">Speed: {SPEED[difficulty]}ms per move</p></div>
            <button onClick={() => snakeState === 'over' ? resetSnake() : setSnakeState(s => s === 'running' ? 'ready' : 'running')} className="mt-5 w-full rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950">{snakeState === 'running' ? 'Pause' : snakeState === 'over' ? 'Play again' : 'Start'}</button>
            <button onClick={resetSnake} className="mt-2 w-full rounded-xl border border-white/15 px-4 py-3 font-bold">New game</button>
            <p className="mt-5 text-xs leading-5 text-slate-500">Avoid the walls and your own tail. Each fruit adds ten points and one segment. Expert mode is deliberately unforgiving.</p>
          </aside>
        </section>}

        {mode === 'solitaire' && <section className="mt-7 rounded-3xl border border-white/10 bg-[#0e352c] p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-2xl font-black">Klondike Solitaire</h2><p className="mt-1 text-sm text-emerald-100/70">Select a face-up card or sequence, then select a destination pile.</p></div>
            <div className="flex items-center gap-2"><select value={drawCount} onChange={e => setDrawCount(Number(e.target.value) as 1 | 3)} className="rounded-lg bg-emerald-950 px-3 py-2 text-sm"><option value={1}>Draw 1 · Standard</option><option value={3}>Draw 3 · Expert</option></select><button onClick={() => newSolitaire(drawCount)} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">New deal</button></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 sm:gap-5">
            <button onClick={drawStock} className="h-24 w-16 rounded-lg border border-white/30 bg-emerald-900 p-1 text-center text-xs">{stock.length ? <span className="flex h-full items-center justify-center rounded border border-emerald-600 text-2xl">✦</span> : '↻'}<span className="block text-[10px]">Stock {stock.length}</span></button>
            <button onClick={clickWaste} className="h-24 w-16 rounded-lg border border-white/20 bg-emerald-950 p-1">{waste.length ? cardFace(waste[waste.length - 1]) : <span className="flex h-full items-center justify-center text-xs text-emerald-100/50">Waste</span>}</button>
            <div className="flex-1" />
            {foundations.map((pile, i) => <button key={i} onClick={moveToFoundation} className="h-24 w-16 rounded-lg border border-white/30 bg-emerald-950 p-1">{pile.length ? cardFace(pile[pile.length - 1]) : <span className="flex h-full items-center justify-center text-2xl text-emerald-100/40">{SUITS[i]}</span>}</button>)}
          </div>
          <div className="mt-8 grid grid-cols-7 gap-2 sm:gap-3">
            {tableau.map((pile, p) => <div key={p} onClick={() => { if (!pile.length && selected) moveToTableau(p); }} className="min-h-48 rounded-lg border border-white/15 bg-emerald-950/40 p-1">
              {pile.map((card, i) => <button key={card.id} onClick={() => clickTableauCard(p, i)} className={`relative block h-20 w-full rounded-lg text-left ${selected?.pile === p && selected.index <= i ? 'ring-2 ring-cyan-300' : ''} ${i ? '-mt-12' : ''}`} style={{ zIndex: i + 1 }}>{cardFace(card, true)}</button>)}
              {!pile.length && <span className="flex h-20 items-center justify-center text-emerald-100/30">K</span>}
            </div>)}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-emerald-50/80">Moves: {solitaireMoves} · Cards home: {foundations.reduce((n,p) => n + p.length, 0)}/52</p><button onClick={moveToFoundation} disabled={!selected} className="rounded-lg border border-cyan-200/40 px-3 py-2 text-xs font-bold disabled:opacity-40">Move selected to foundation</button></div>
          <p className="mt-3 rounded-xl bg-emerald-950/70 p-3 text-xs text-emerald-100/80">{solitaireMessage}</p>
        </section>}

        <p className="mt-6 text-center text-xs text-slate-500">VELT Arcade is free-to-play. No money is staked, no prizes are paid and arcade scores do not affect casino wallets.</p>
      </div>
    </main>
  );
}
