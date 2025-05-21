// src/app/game/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SymbolData, SymbolRarity, RelicData, EnemyData } from '@/types/kigaslot';
import { symbols as allSymbols } from '@/data/symbols';
import { relics as allRelics } from '@/data/relics';
import { enemies as allEnemies } from '@/data/enemies';

import SymbolDisplay from '@/components/game/SymbolDisplay';
import SymbolAcquisitionModal from '@/components/game/SymbolAcquisitionModal';
import DeckEditModal from '@/components/game/DeckEditModal';
import RelicSelectionModal from '@/components/game/RelicSelectionModal';
import GameOverModal from '@/components/game/GameOverModal';

// 初期デッキ定義
const getInitialDeck = (): SymbolData[] => {
  const commonSymbols = allSymbols.filter(symbol => symbol.rarity === 'Common');
  const initialDeck: SymbolData[] = [];
  const deckSize = 15;
  if (commonSymbols.length === 0) {
    console.error("No common symbols found to create an initial deck!");
    return [];
  }
  for (let i = 0; i < deckSize; i++) {
    const randomIndex = Math.floor(Math.random() * commonSymbols.length);
    initialDeck.push(commonSymbols[randomIndex]);
  }
  return initialDeck;
};

// BMシンボル効果パース
const parseBmEffect = (effectText: string): number => {
  const match = effectText.match(/このシンボル1つにつきメダルを\s*\+(\d+)\s*獲得/);
  return match && match[1] ? parseInt(match[1], 10) : 0;
};

// レリック効果適用 (BMシンボルへ)
const applyRelicToSymbolBM = (symbol: SymbolData, baseGain: number, currentAcquiredRelics: RelicData[]): number => {
  let modifiedGain = baseGain;
  currentAcquiredRelics.forEach(relic => {
    if (relic.name === "鍛冶神の金床 (Anvil of the Forge God)" && symbol.attribute === "Metal") modifiedGain += 2;
    else if (relic.name === "百獣の王の紋章 (Crest of the Beast King)" && symbol.attribute === "Animal") modifiedGain += 2;
    else if (relic.name === "伝説の剣聖の鞘 (Sheath of the Legendary Swordmaster)" && symbol.attribute === "Weapon") modifiedGain += 2;
    else if (relic.name === "星詠みの水晶球 (Crystal Ball of Stargazing)" && symbol.attribute === "Mystic") modifiedGain += 2;
    else if (relic.name === "生命の泉の雫 (Droplet of the Life Spring)" && symbol.attribute === "Plant") modifiedGain += 2;
  });
  return modifiedGain;
};

// メダル表示用アニメーションコンポーネント
const AnimatedNumber = ({ targetValue }: { targetValue: number }) => {
  const [currentValue, setCurrentValue] = useState(targetValue);
  useEffect(() => {
    if (currentValue === targetValue) return;
    const animationDuration = 300; const framesPerSecond = 30;
    const totalFrames = (animationDuration / 1000) * framesPerSecond;
    const increment = (targetValue - currentValue) / totalFrames;
    let frame = 0;
    const timer = setInterval(() => {
      frame++; const newValue = Math.round(currentValue + increment * frame);
      if ((increment > 0 && newValue >= targetValue) || (increment < 0 && newValue <= targetValue) || frame >= totalFrames) {
        setCurrentValue(targetValue); clearInterval(timer);
      } else { setCurrentValue(newValue); }
    }, 1000 / framesPerSecond);
    return () => clearInterval(timer);
  }, [targetValue, currentValue]);
  return <span className="font-bold text-yellow-400 text-md tabular-nums">{currentValue}</span>;
};

export default function GamePage() {
  const [medals, setMedals] = useState(100);
  const [spinCount, setSpinCount] = useState(0);
  const [currentDeck, setCurrentDeck] = useState<SymbolData[]>(getInitialDeck());
  const [boardSymbols, setBoardSymbols] = useState<(SymbolData | null)[]>(Array(9).fill(null));
  const [spinCost, setSpinCost] = useState(10);
  const [lineMessage, setLineMessage] = useState<string>("");
  const [gameMessage, setGameMessage] = useState<string>("");
  const [highlightedLine, setHighlightedLine] = useState<number[] | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isSymbolAcquisitionPhase, setIsSymbolAcquisitionPhase] = useState(false);
  const [symbolChoices, setSymbolChoices] = useState<SymbolData[]>([]);
  const [isDeckEditModalOpen, setIsDeckEditModalOpen] = useState(false);
  const [symbolDeleteTickets, setSymbolDeleteTickets] = useState(0);
  const [acquiredRelics, setAcquiredRelics] = useState<RelicData[]>([]);
  const [isRelicSelectionPhase, setIsRelicSelectionPhase] = useState(false);
  const [relicChoices, setRelicChoices] = useState<RelicData[]>([]);
  const [nextCostIncreaseIn, setNextCostIncreaseIn] = useState(5);
  const [currentEnemy, setCurrentEnemy] = useState<EnemyData | null>(null);
  const [enemyHP, setEnemyHP] = useState(0);
  const [nextEnemyIn, setNextEnemyIn] = useState(10);
  const [activeDebuffs, setActiveDebuffs] = useState<{ type: string, duration: number, value?: number, originEnemy?: string }[]>([]);
  const [showWarningTelop, setShowWarningTelop] = useState(false);

  const initializeGameState = useCallback(() => {
    setMedals(100); setSpinCount(0); setCurrentDeck(getInitialDeck());
    setBoardSymbols(Array(9).fill(null)); setSpinCost(10); setLineMessage("");
    setGameMessage("Game Started! Good luck!"); setHighlightedLine(null); setIsGameOver(false);
    setIsSymbolAcquisitionPhase(false); setSymbolChoices([]); setIsDeckEditModalOpen(false);
    setSymbolDeleteTickets(0); setAcquiredRelics([]); setIsRelicSelectionPhase(false);
    setRelicChoices([]); setNextCostIncreaseIn(5); setCurrentEnemy(null); setEnemyHP(0);
    setNextEnemyIn(10); setActiveDebuffs([]); setShowWarningTelop(false);
  }, []);
  useEffect(() => { initializeGameState(); }, [initializeGameState]);

  const calculateNewSpinCost = (currentSpinCountForCalc: number, baseCost: number): number => {
    const coefficientA = 0.3; if (currentSpinCountForCalc <= 0) return baseCost;
    const cost = baseCost + Math.floor(Math.pow(currentSpinCountForCalc, 1.2) * coefficientA);
    return Math.max(baseCost, Math.round(cost / 5) * 5);
  };

  const applyAdjacentBonuses = (currentBoard: (SymbolData | null)[]): { gainedMedals: number, message: string } => {
    let totalMedalsFromAB = 0;
    // eslint-disable-next-line prefer-const
    let abMessages: string[] = [];
    currentBoard.forEach((symbol, index) => {
      if (symbol && symbol.effectSystem === 'AB') {
        if (symbol.name === "磁鉄鉱 (Lodestone)") {
          let adjMetal = 0; const {r,c}={r:Math.floor(index/3),c:index%3};
          for(let ro=-1;ro<=1;ro++){for(let co=-1;co<=1;co++){if(ro===0&&co===0)continue; const nr=r+ro;const nc=c+co;
          if(nr>=0&&nr<3&&nc>=0&&nc<3){const ns=currentBoard[nr*3+nc];if(ns&&ns.attribute==="Metal")adjMetal++;}}}
          if(adjMetal>0){const gain=adjMetal*3;totalMedalsFromAB+=gain;abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}`);}
        }
      }
    });
    return { gainedMedals: totalMedalsFromAB, message: abMessages.join(' | ') };
  };

  const checkLinesAndApplyRelics = (currentBoard: (SymbolData | null)[], currentAcquiredRelics: RelicData[]): { gainedMedals: number, message: string, formedLinesIndices: number[][] } => {
    let totalMedals = 0; const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    // eslint-disable-next-line prefer-const
    let formedDetails: string[] = [];
    // eslint-disable-next-line prefer-const
    let formedIndicesArr: number[][] = [];
    lines.forEach(lineIdx => {
      const s = lineIdx.map(i=>currentBoard[i]); const lineSyms = s.filter(sym=>sym!==null) as SymbolData[];
      if(lineSyms.length===3&&lineSyms[0].attribute===lineSyms[1].attribute&&lineSyms[0].attribute===lineSyms[2].attribute){
        let lineWinBM=0; let lineD=`${lineSyms[0].attribute} Line: `;
        lineSyms.forEach(sl=>{if(sl.effectSystem==='BM'){const bG=parseBmEffect(sl.effectText); const gWR=applyRelicToSymbolBM(sl,bG,currentAcquiredRelics); if(gWR>0){lineWinBM+=gWR;lineD+=` ${sl.name.split(' ')[0]}(+${gWR}) `;}}});
        let finalWin=lineWinBM;
        lineSyms.forEach(sl=>{if(sl.effectSystem==='LB'){
          if(sl.name==="ベル (Bell)"&&lineSyms.filter(ls=>ls.name==="ベル (Bell)").length===3&&lineWinBM>0){finalWin=Math.floor(finalWin*1.5)+1;lineD+=`[Bell x1.5+1]`;}
          else if(sl.name==="チェリー (Cherry)"){const cC=lineSyms.filter(ls=>ls.name==="チェリー (Cherry)").length; const cB=cC===1?3:cC===2?8:cC>=3?20:0; if(cB>0){finalWin+=cB;lineD+=`[Cherry+${cB}]`;}}
        }});
        if(finalWin>0){totalMedals+=finalWin; formedDetails.push(`${lineD.trim()}->+${finalWin}`); formedIndicesArr.push([...lineIdx]);}
      }
    });
    const msg = formedDetails.join(' | ')||(totalMedals>0?`Total+${totalMedals}!`:"No lines/effects.");
    return {gainedMedals:totalMedals, message:msg, formedLinesIndices:formedIndicesArr};
  };

  const handleTurnResolution = (currentSpinCountForCheck: number) => {
    setGameMessage(""); let proceed = true;
    if (currentSpinCountForCheck > 0 && currentSpinCountForCheck % 5 === 0) {
      const newC = calculateNewSpinCost(currentSpinCountForCheck, 10); setSpinCost(newC); setNextCostIncreaseIn(5);
      const choicesR: RelicData[] = []; const unacquiredR = allRelics.filter(r => !acquiredRelics.find(ar => ar.no === r.no));
      const pIR = new Set<number>(); const numToPickR = Math.min(3,unacquiredR.length); let attR = 0;
      while (choicesR.length < numToPickR && pIR.size < unacquiredR.length && attR < allRelics.length * 2) {
        const rIR = Math.floor(Math.random()*unacquiredR.length); if (!pIR.has(rIR)) { choicesR.push(unacquiredR[rIR]); pIR.add(rIR); } attR++;
      }
      if (choicesR.length > 0) { setRelicChoices(choicesR); setIsRelicSelectionPhase(true); proceed = false; }
      else { setGameMessage(unacquiredR.length === 0 ? "All relics acquired!" : "No new relics."); }
    }
    if (proceed) { resolveEnemyEncounter(currentSpinCountForCheck); }
  };

  const resolveEnemyEncounter = (currentSpinCountForCheck: number) => {
    if (currentSpinCountForCheck>0 && currentSpinCountForCheck%10===0 && !currentEnemy) {
        const enemyIdx = Math.floor(Math.random()*allEnemies.length); const newE = allEnemies[enemyIdx]; setCurrentEnemy(newE);
        const bHp = (spinCost*8)+(currentSpinCountForCheck*2); setEnemyHP(Math.max(50,Math.floor(bHp*newE.hpMultiplier)));
        setNextEnemyIn(10); setGameMessage(`Enemy Appeared: ${newE.name}!`); setShowWarningTelop(true);
        setTimeout(() => setShowWarningTelop(false), 2500);
    }
  };

  const startSymbolAcquisition = () => {
    const choicesArr: SymbolData[] = []; const numChoices = 3;
    for (let i=0; i<numChoices; i++) {
      const rand = Math.random()*100; const rarity: SymbolRarity = rand<5?'Rare':rand<30?'Uncommon':'Common'; // const に変更
      let availableSyms = allSymbols.filter(s=>s.rarity===rarity);
      if(availableSyms.length===0){if(rarity!=='Common'){console.warn(`No ${rarity} symbols, fallback to Common.`); availableSyms=allSymbols.filter(s=>s.rarity==='Common');}
      if(availableSyms.length===0){console.error("No Common symbols!");continue;}}
      choicesArr.push(availableSyms[Math.floor(Math.random()*availableSyms.length)]);
    }
    if (choicesArr.length > 0) { setSymbolChoices(choicesArr.filter(Boolean)); setIsSymbolAcquisitionPhase(true); }
    else { setIsSymbolAcquisitionPhase(false); setGameMessage("No symbols to choose."); handleTurnResolution(spinCount); }
  };
  const handleSymbolSelected = (s: SymbolData) => {setCurrentDeck(p=>[...p,s]); setIsSymbolAcquisitionPhase(false); setSymbolChoices([]); handleTurnResolution(spinCount);};
  const handleSymbolSkipped = () => {setIsSymbolAcquisitionPhase(false); setSymbolChoices([]); handleTurnResolution(spinCount);};
  const handleRelicSelected = (r: RelicData) => {setAcquiredRelics(p=>[...p,r]); setIsRelicSelectionPhase(false); setRelicChoices([]); resolveEnemyEncounter(spinCount);};
  const handleDeleteSymbol = (idx: number) => {if(symbolDeleteTickets>0){setCurrentDeck(p=>p.filter((_,i)=>i!==idx));setSymbolDeleteTickets(p=>p-1);setGameMessage("Symbol removed.");}};

  const dealDamageToEnemy = (dmg: number) => {
    if(!currentEnemy)return; const newH=Math.max(0,enemyHP-dmg); setEnemyHP(newH);
    if(newH<=0){setGameMessage(`Defeated ${currentEnemy.name}! +1 Ticket!`);setCurrentEnemy(null);setEnemyHP(0);setSymbolDeleteTickets(p=>p+1); setActiveDebuffs(prev => prev.filter(d => d.originEnemy !== currentEnemy.name));}
  };
  
  const applyInstantDebuffsAndSetPersistentFlags = (): { boardMutated: boolean, costMultiplierFromDebuff: number, debuffMessages: string[] } => {
    if (!currentEnemy || isGameOver) return { boardMutated: false, costMultiplierFromDebuff: 1, debuffMessages: [] };
    
    const boardChanged = false; // const に変更
    let costMultiplier = 1;
    const messages: string[] = [];

    if (currentEnemy.name === "コスト・インフレーター (Cost Inflater)") {
      const existingDebuff = activeDebuffs.find(d => d.type === "CostIncrease" && d.originEnemy === currentEnemy.name);
      if (!existingDebuff) {
        setActiveDebuffs(prev => [...prev, { type: "CostIncrease", duration: 3, value: 0.1, originEnemy: currentEnemy.name }]);
        messages.push(`${currentEnemy.name} inflates spin cost for 3 turns!`);
        costMultiplier = 1.1;
      } else if (existingDebuff.duration > 0) {
        costMultiplier = 1 + (existingDebuff.value || 0);
        messages.push(`Spin cost increased by ${currentEnemy.name}! (${existingDebuff.duration} turns left)`);
      }
    }
    return { boardMutated: boardChanged, costMultiplierFromDebuff: costMultiplier, debuffMessages: messages };
  };

  const handleSpin = () => {
    const debuffCostMultiplier = 1; // const に変更 (現状のロジックでは再代入なし)
    // eslint-disable-next-line prefer-const
    let initialDebuffMessages: string[] = [];
    if (currentEnemy && !isGameOver) {
      const debuffResult = applyInstantDebuffsAndSetPersistentFlags();
      // debuffCostMultiplier = debuffResult.costMultiplierFromDebuff; // コメントアウトされているため、上の const でOK
      initialDebuffMessages.push(...debuffResult.debuffMessages);
    }

    const finalSpinCost = Math.round(spinCost * debuffCostMultiplier);

    if (isGameOver || medals < finalSpinCost || currentDeck.length === 0 || isSymbolAcquisitionPhase || isRelicSelectionPhase || isDeckEditModalOpen) return;
    
    setHighlightedLine(null);
    setMedals(prev => prev - finalSpinCost);
    const nextSpinCount = spinCount + 1; setSpinCount(nextSpinCount);
    setLineMessage(""); 
    setGameMessage(initialDebuffMessages.join(" | "));

    if (nextCostIncreaseIn > 0) setNextCostIncreaseIn(prev => prev - 1);
    if (nextEnemyIn > 0 && currentEnemy === null) setNextEnemyIn(prev => prev - 1);

    setActiveDebuffs(pDebuffs => pDebuffs.map(d => ({ ...d, duration: d.duration - 1 })).filter(d => d.duration > 0));

    // eslint-disable-next-line prefer-const
    let cBoardSymbolsDraft: SymbolData[] = [];
    for (let i=0; i<9; i++) { cBoardSymbolsDraft.push(currentDeck[Math.floor(Math.random()*currentDeck.length)]); }
    
    const finalBoard = cBoardSymbolsDraft as (SymbolData | null)[]; // const に変更 (スロットゴブリン効果はfinalBoardを直接変更しないように修正が必要)
    // eslint-disable-next-line prefer-const
    let boardAfterEnemyEffects = [...finalBoard]; // コピーを作成
    if (currentEnemy && currentEnemy.name === "スロット・ゴブリン (Slot Goblin)" && !isGameOver) {
        const cursedMask = allSymbols.find(s => s.name === "呪いの仮面 (Cursed Mask)");
        if (cursedMask && boardAfterEnemyEffects.some(s=>s!==null)) { let rIdx = -1, att = 0; while(att<20){ const tIdx=Math.floor(Math.random()*9); if(boardAfterEnemyEffects[tIdx]!==null){rIdx=tIdx;break;} att++;}
            if (rIdx !== -1 && boardAfterEnemyEffects[rIdx]) { 
                setGameMessage(prev => `${prev ? prev + " | " : ""}Goblin changed ${boardAfterEnemyEffects[rIdx]!.name.split(' ')[0]} to Cursed Mask!`); 
                boardAfterEnemyEffects[rIdx] = cursedMask; 
            }
        }
    }
    setBoardSymbols(boardAfterEnemyEffects);

    const { gainedMedals: abG, message: abM } = applyAdjacentBonuses(boardAfterEnemyEffects);
    let totalG = 0; 
    let currentLocalGameMessage = gameMessage; // 既存のゲームメッセージをバッファ
    if (abG > 0) { setMedals(p => p + abG); totalG += abG; currentLocalGameMessage = (currentLocalGameMessage ? currentLocalGameMessage + " | " : "") + abM; }

    const { gainedMedals: lineG, message: linesM, formedLinesIndices: fLIdx } = checkLinesAndApplyRelics(boardAfterEnemyEffects, acquiredRelics);
    if (lineG > 0) { setMedals(p => p + lineG); totalG += lineG; 
      if (fLIdx.length > 0) { setHighlightedLine(fLIdx[0]); setTimeout(() => setHighlightedLine(null), 800); }
    }
    setLineMessage(linesM !== "No lines or no medal effects." && linesM !== "" ? linesM : "No bonuses or lines.");
    setGameMessage(currentLocalGameMessage);


    if (currentEnemy && totalG > 0) { dealDamageToEnemy(totalG); }
    if (!isGameOver) startSymbolAcquisition();
  };
  
  useEffect(() => {
    if (!isGameOver && (medals < spinCost || (currentDeck.length === 0 && spinCount > 0 ) ) && spinCount > 0 ) {
        const reason = medals < spinCost ? "Not enough medals!" : "Deck is empty!";
        setGameMessage(`${reason} GAME OVER!`);
        setIsGameOver(true);
    }
  }, [medals, spinCost, currentDeck, spinCount, isGameOver]);

  const handleRestartGame = () => { window.location.href = '/'; };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gray-900 text-white p-2 md:p-4 selection:bg-yellow-500 selection:text-black overflow-y-auto relative">
      {showWarningTelop && (
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-red-600 text-white text-4xl sm:text-6xl font-bold p-4 sm:p-8 rounded-lg shadow-2xl animate-pulse border-4 border-red-400">
          Warning!!
        </div>
      )}
      <header className="w-full max-w-4xl mb-4">
        <div className="grid grid-cols-3 md:grid-cols-4 gap-1 md:gap-2 p-2 md:p-3 bg-gray-800 rounded-lg shadow-lg text-xs md:text-sm">
          <div className="text-center">Medals: <AnimatedNumber targetValue={medals} /></div>
          <div className="text-center">Cost: <span className="font-bold text-red-400">{spinCost}</span></div>
          <div className="text-center">Spins: <span className="font-bold text-lg">{spinCount}</span></div>
          <div className="text-center sm:col-span-1 col-span-3 sm:border-none border-t border-gray-700 pt-1 sm:pt-0">Deck: <span className="font-bold">{currentDeck.length}</span></div>
          <div className="text-center">CostUp: <span className="font-bold">{nextCostIncreaseIn === 0 ? 'Now!' : nextCostIncreaseIn}</span></div>
          <div className="text-center">EnemyIn: <span className="font-bold">{nextEnemyIn === 0 && !currentEnemy ? 'Now!' : (currentEnemy ? '-' : nextEnemyIn)}</span></div>
          <div className="text-center">Tickets: <span className="font-bold text-green-400">{symbolDeleteTickets}</span></div>
        </div>
        {currentEnemy && !isGameOver && (
          <div className="mt-2 p-2 md:p-3 bg-red-800 bg-opacity-70 rounded-lg text-center shadow-md">
            <h3 className="text-md md:text-lg font-bold text-red-300">{currentEnemy.name}</h3>
            <p className="text-sm md:text-md text-red-100">HP: <span className="font-semibold">{enemyHP}</span></p>
            <p className="text-xs text-red-200 mt-1 italic">Effect: {currentEnemy.debuffEffectText}</p>
          </div>
        )}
      </header>
      <main className="w-full max-w-xs sm:max-w-sm md:max-w-md mb-4 flex-shrink-0">
        <div className="grid grid-cols-3 gap-1 md:gap-2 p-1 md:p-2 bg-gray-700 rounded-lg shadow-inner">
          {boardSymbols.map((symbol, i) => (
            <div key={i} className={`transition-all duration-200 ease-in-out transform ${ highlightedLine && highlightedLine.includes(i) ? 'ring-4 ring-yellow-400 scale-105 z-10 shadow-lg' : 'ring-transparent' }`}>
              <SymbolDisplay symbol={symbol} />
            </div>
          ))}
        </div>
        {gameMessage && !isGameOver && <div className="mt-1 p-2 bg-indigo-700 rounded text-center text-xs md:text-sm text-indigo-100 shadow">{gameMessage}</div>}
        {lineMessage && !isGameOver && <div className="mt-2 p-2 bg-gray-800 rounded text-center text-xs md:text-sm text-yellow-300 shadow">{lineMessage}</div>}
      </main>
      <footer className="w-full max-w-xs sm:max-w-sm md:max-w-md mt-auto pb-2">
        <div className="flex justify-around items-center p-2 md:p-4 bg-gray-800 rounded-lg shadow-lg">
          <button onClick={handleSpin} disabled={isGameOver || isSymbolAcquisitionPhase || isRelicSelectionPhase || isDeckEditModalOpen || medals < spinCost || currentDeck.length === 0}
            className="px-6 md:px-10 py-3 md:py-4 bg-green-600 hover:bg-green-700 text-white text-lg md:text-xl font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 active:bg-green-800">
            SPIN!
          </button>
          <button onClick={() => setIsDeckEditModalOpen(true)} disabled={isGameOver || isSymbolAcquisitionPhase || isRelicSelectionPhase || isDeckEditModalOpen}
            className="px-4 md:px-8 py-3 md:py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg md:text-xl font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 active:bg-blue-800">
            DECK
          </button>
        </div>
      </footer>
      <SymbolAcquisitionModal isOpen={isSymbolAcquisitionPhase} choices={symbolChoices} onSelect={handleSymbolSelected} onSkip={handleSymbolSkipped} />
      <DeckEditModal isOpen={isDeckEditModalOpen} deck={currentDeck} tickets={symbolDeleteTickets} onClose={() => setIsDeckEditModalOpen(false)} onDeleteSymbol={handleDeleteSymbol} />
      <RelicSelectionModal isOpen={isRelicSelectionPhase} choices={relicChoices} onSelect={handleRelicSelected} />
      <GameOverModal isOpen={isGameOver} score={spinCount} onRestart={handleRestartGame} />
    </div>
  );
}