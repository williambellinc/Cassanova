import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import GameRound from '../models/GameRound';
import { createFairRoundRandom } from '../games/fair-rng';

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const SLOT_SYMBOLS = ['Crown','Star','Bell','Cherry','Lemon'];
const SLOT_WEIGHTS = [1,2,3,4,5];
const SLOT_PAYOUTS: Record<string,number> = { Crown:223, Star:68, Bell:25, Cherry:13, Lemon:8 };

export const playRoulettePractice = async (req: Request, res: Response) => {
  const betType = String(req.body?.betType || '');
  const selection = req.body?.selection;
  const valid = ['red','black','even','odd','low','high','straight'].includes(betType);
  if (!valid || (betType === 'straight' && (!Number.isInteger(selection) || selection < 0 || selection > 36))) return res.status(400).json({ message:'Invalid roulette selection' });
  const rng = createFairRoundRandom();
  const number = rng.integer(0,37);
  const color = number === 0 ? 'green' : RED.has(number) ? 'red' : 'black';
  const won = betType === 'straight' ? number === selection
    : betType === 'red' || betType === 'black' ? color === betType
    : betType === 'even' ? number !== 0 && number % 2 === 0
    : betType === 'odd' ? number !== 0 && number % 2 === 1
    : betType === 'low' ? number >= 1 && number <= 18
    : number >= 19 && number <= 36;
  const multiplier = betType === 'straight' ? 36 : 2;
  const round = await GameRound.create({ roundReference:randomUUID(),gameCode:'velt-roulette',mode:'demo',
    outcome:{number,color,betType,selection:selection ?? null,result:won?'win':'loss',grossMultiplier:won?multiplier:0},
    algorithmVersion:'velt-european-roulette-37-v1',fairness:rng.fairness });
  return res.status(201).json({roundReference:round.roundReference,outcome:round.outcome,theoreticalRtp:36/37,notice:'Practice only. Single-zero European roulette; no stake or prize.'});
};

export const playSlotsPractice = async (_req: Request, res: Response) => {
  const rng = createFairRoundRandom();
  const reels = SLOT_WEIGHTS.map(weight => Array.from({length:weight},()=>SLOT_SYMBOLS[SLOT_WEIGHTS.indexOf(weight)]));
  const symbols = Array.from({length:3},()=> {
    const reel = reels.flat();
    return reel[rng.integer(0,reel.length)];
  });
  const payout = symbols.every(s=>s===symbols[0]) ? SLOT_PAYOUTS[symbols[0]] : 0;
  const round = await GameRound.create({roundReference:randomUUID(),gameCode:'velt-slots-3reel',mode:'demo',
    outcome:{symbols,payoutMultiplier:payout,result:payout?'win':'loss'},
    algorithmVersion:'velt-slots-weighted-triples-97pct-v1',fairness:rng.fairness});
  return res.status(201).json({roundReference:round.roundReference,outcome:round.outcome,theoreticalRtp:0.9700740740740741,notice:'Practice only. Three independent weighted reels; triple matches only.'});
};

const cardValue = (rank: string) => rank === 'A' ? 1 : ['10','J','Q','K'].includes(rank) ? 0 : Number(rank);
const handTotal = (cards: string[]) => cards.reduce((sum,card)=>sum+cardValue(card),0)%10;
const drawBaccaratCard = (rng: ReturnType<typeof createFairRoundRandom>) => {
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  return ranks[rng.integer(0,ranks.length)];
};
export const playBaccaratPractice = async (_req: Request, res: Response) => {
  const rng=createFairRoundRandom();
  const player=[drawBaccaratCard(rng),drawBaccaratCard(rng)];
  const banker=[drawBaccaratCard(rng),drawBaccaratCard(rng)];
  let p=handTotal(player), b=handTotal(banker);
  if(p<8 && b<8) {
    let playerThird: string | null = null;
    if(p<=5) { playerThird=drawBaccaratCard(rng); player.push(playerThird); p=handTotal(player); }
    let bankerDraw=false;
    if(playerThird===null) bankerDraw=b<=5;
    else {
      const v=cardValue(playerThird);
      bankerDraw=b<=2 || (b===3&&v!==0) || (b===4&&v>=2&&v<=7) || (b===5&&v>=4&&v<=7) || (b===6&&(v===6||v===7));
    }
    if(bankerDraw) { banker.push(drawBaccaratCard(rng)); b=handTotal(banker); }
  }
  const winner=p>b?'player':b>p?'banker':'tie';
  const round=await GameRound.create({roundReference:randomUUID(),gameCode:'velt-baccarat',mode:'demo',
    outcome:{player,banker,playerTotal:p,bankerTotal:b,winner,bankerGrossMultiplier:winner==='banker'?1.95:winner==='tie'?8:0,playerGrossMultiplier:winner==='player'?2:winner==='tie'?8:0},
    algorithmVersion:'velt-baccarat-punto-banco-8deck-rules-v1',fairness:rng.fairness});
  return res.status(201).json({roundReference:round.roundReference,outcome:round.outcome,notice:'Practice only. Standard Punto Banco drawing rules; no stake or prize.'});
};

const shuffledDeck = (rng: ReturnType<typeof createFairRoundRandom>) => {
  const deck = Array.from({length:6},()=>['A','2','3','4','5','6','7','8','9','10','J','Q','K'].flatMap(rank=>['S','H','D','C'].map(suit=>rank+suit))).flat();
  for(let i=deck.length-1;i>0;i--){const j=rng.integer(0,i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
  return deck;
};
const blackjackValue = (card: string) => { const rank=card.slice(0,-1); return rank==='A'?11:['K','Q','J'].includes(rank)?10:Number(rank); };
const blackjackTotal = (cards: string[]) => { let total=cards.reduce((s,c)=>s+blackjackValue(c),0),aces=cards.filter(c=>c.startsWith('A')).length; while(total>21&&aces>0){total-=10;aces--;} return total; };
const blackjackResult = (player: string[], dealer: string[]) => {
  const p=blackjackTotal(player),d=blackjackTotal(dealer);
  if(p>21)return 'bust'; if(d>21)return 'win'; if(p>d)return 'win'; if(p<d)return 'loss'; return 'push';
};
export const startBlackjackPractice = async (_req: Request,res: Response) => {
  const rng=createFairRoundRandom(),deck=shuffledDeck(rng);
  const player=[deck.pop()!,deck.pop()!],dealer=[deck.pop()!,deck.pop()!];
  const state={deck,player,dealer,status:'active'};
  const natural=blackjackTotal(player)===21;
  if(natural) state.status='complete';
  const outcome=natural?{result:blackjackTotal(dealer)===21?'push':'blackjack',player,dealer:[dealer[0],'??'],playerTotal:21,dealerUpcard:dealer[0]}:{status:'active',player,dealer:[dealer[0],'??'],playerTotal:blackjackTotal(player),dealerUpcard:dealer[0]};
  const round=await GameRound.create({roundReference:randomUUID(),gameCode:'velt-blackjack',mode:'demo',outcome,state,algorithmVersion:'velt-blackjack-6deck-s17-v1',fairness:rng.fairness});
  return res.status(201).json({roundReference:round.roundReference,outcome:round.outcome,notice:'Practice only. Dealer stands on soft 17; no stake or prize.'});
};
export const hitBlackjackPractice = async (req: Request,res: Response) => {
  const round=await GameRound.findOne({roundReference:req.params.roundReference,gameCode:'velt-blackjack',mode:'demo'});
  if(!round?.state)return res.status(404).json({message:'Blackjack practice round not found'});
  const state=round.state as any;if(state.status!=='active')return res.status(409).json({message:'Blackjack round is complete'});
  const card=state.deck.pop();if(!card)return res.status(409).json({message:'Practice shoe is exhausted'});
  state.player.push(card);const total=blackjackTotal(state.player);
  if(total>21){state.status='complete';round.outcome={result:'bust',player:state.player,dealer:[state.dealer[0],'??'],playerTotal:total};}
  else round.outcome={status:'active',player:state.player,dealer:[state.dealer[0],'??'],playerTotal:total};
  round.markModified('state');round.markModified('outcome');await round.save();
  return res.json({roundReference:round.roundReference,outcome:round.outcome});
};
export const standBlackjackPractice = async (req: Request,res: Response) => {
  const round=await GameRound.findOne({roundReference:req.params.roundReference,gameCode:'velt-blackjack',mode:'demo'});
  if(!round?.state)return res.status(404).json({message:'Blackjack practice round not found'});
  const state=round.state as any;if(state.status!=='active')return res.status(409).json({message:'Blackjack round is complete'});
  while(blackjackTotal(state.dealer)<17){const card=state.deck.pop();if(!card)break;state.dealer.push(card);}
  state.status='complete';const result=blackjackResult(state.player,state.dealer);
  round.outcome={result,player:state.player,dealer:state.dealer,playerTotal:blackjackTotal(state.player),dealerTotal:blackjackTotal(state.dealer)};
  round.markModified('state');round.markModified('outcome');await round.save();
  return res.json({roundReference:round.roundReference,outcome:round.outcome,notice:'Practice result only.'});
};
