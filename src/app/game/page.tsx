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
  const names = ['ブロンズ・コイン (Bronze Coin)','ブロンズ・コイン (Bronze Coin)','ブロンズ・コイン (Bronze Coin)','ハーブ (Herb)','ハーブ (Herb)','ハーブ (Herb)','森のリス (Forest Squirrel)','森のリス (Forest Squirrel)','森のリス (Forest Squirrel)','ショートソード (Short Sword)','ショートソード (Short Sword)','星のかけら (Stardust)','星のかけら (Stardust)'];
  return names.map(name => allSymbols.find(s => s.name === name)).filter(s => s !== undefined) as SymbolData[];
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
      if (frame >= totalFrames) { setCurrentValue(targetValue); clearInterval(timer); }
      else { setCurrentValue(newValue); }
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
  const [activeDebuffs, setActiveDebuffs] = useState<{ type: string, duration: number, value?: number }[]>([]);

  const initializeGameState = useCallback(() => {
    setMedals(100); setSpinCount(0); setCurrentDeck(getInitialDeck());
    setBoardSymbols(Array(9).fill(null)); setSpinCost(10); setLineMessage("");
    setGameMessage("Game Started! Good luck!"); setHighlightedLine(null); setIsGameOver(false);
    setIsSymbolAcquisitionPhase(false); setSymbolChoices([]); setIsDeckEditModalOpen(false);
    setSymbolDeleteTickets(0); setAcquiredRelics([]); setIsRelicSelectionPhase(false);
    setRelicChoices([]); setNextCostIncreaseIn(5); setCurrentEnemy(null); setEnemyHP(0);
    setNextEnemyIn(10); setActiveDebuffs([]);
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
          let adjacentMetalSymbols = 0;
          const { row, col } = { row: Math.floor(index / 3), col: index % 3 };
          for (let rO=-1; rO<=1; rO++) { for (let cO=-1; cO<=1; cO++) {
            if (rO===0 && cO===0) continue; const nR=row+rO; const nC=col+cO;
            if (nR>=0 && nR<3 && nC>=0 && nC<3) { const nS=currentBoard[nR*3+nC]; if (nS && nS.attribute==="Metal") adjacentMetalSymbols++; }
          }}
          if (adjacentMetalSymbols > 0) { const gain = adjacentMetalSymbols * 3; totalMedalsFromAB += gain; abMessages.push(`${symbol.name.split(' ')[0]}: +${gain}`);}
        }
      }
    });
    return { gainedMedals: totalMedalsFromAB, message: abMessages.join(' | ') };
  };

  const checkLinesAndApplyRelics = (currentBoard: (SymbolData | null)[], currentAcquiredRelics: RelicData[]): { gainedMedals: number, message: string, formedLinesIndices: number[][] } => {
    let totalMedalsFromLines = 0; const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    // eslint-disable-next-line prefer-const
    let formedLineDetails: string[] = [];
    // eslint-disable-next-line prefer-const
    let formedLinesIndicesArray: number[][] = [];
    lines.forEach(lineIndices => {
      const s = lineIndices.map(i => currentBoard[i]); const lineSyms = s.filter(sym => sym !== null) as SymbolData[];
      if (lineSyms.length === 3 && lineSyms[0].attribute === lineSyms[1].attribute && lineSyms[0].attribute === lineSyms[2].attribute) {
        let lineWinBM = 0; let lineD = `${lineSyms[0].attribute} Line: `;
        lineSyms.forEach(sl => { if (sl.effectSystem==='BM') { const bG=parseBmEffect(sl.effectText); const gWR=applyRelicToSymbolBM(sl,bG,currentAcquiredRelics); if (gWR>0) { lineWinBM+=gWR; lineD+=` ${sl.name.split(' ')[0]}(+${gWR}) `;}}});
        let finalLineWin = lineWinBM;
        lineSyms.forEach(sl => { if (sl.effectSystem==='LB') {
          if (sl.name==="ベル (Bell)" && lineSyms.filter(ls => ls.name==="ベル (Bell)").length===3 && lineWinBM > 0) { finalLineWin = Math.floor(finalLineWin*1.5)+1; lineD+=` [Bell x1.5+1] `;}
          else if (sl.name==="チェリー (Cherry)") { const cC=lineSyms.filter(ls=>ls.name==="チェリー (Cherry)").length; const cB=cC===1?3:cC===2?8:cC>=3?20:0; if(cB>0){finalLineWin+=cB; lineD+=` [Cherry+${cB}] `;}} // cB is const
        }});
        if (finalLineWin > 0) { totalMedalsFromLines += finalLineWin; formedLineDetails.push(`${lineD.trim()} -> Total +${finalLineWin}`); formedLinesIndicesArray.push([...lineIndices]);}
      }
    });
    const msg = formedLineDetails.join(' | ') || (totalMedalsFromLines > 0 ? `Total +${totalMedalsFromLines} medals!` : "No lines or no medal effects.");
    return { gainedMedals: totalMedalsFromLines, message: msg, formedLinesIndices: formedLinesIndicesArray };
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
      const eIdx = Math.floor(Math.random()*allEnemies.length); const newE = allEnemies[eIdx]; setCurrentEnemy(newE);
      const bHp = (spinCost*8)+(currentSpinCountForCheck*2); setEnemyHP(Math.max(50,Math.floor(bHp*newE.hpMultiplier)));
      setNextEnemyIn(10); setGameMessage(`Enemy Appeared: ${newE.name}!`);
    }
  };

  const startSymbolAcquisition = () => {
    const rand = Math.random()*100; const rarity: SymbolRarity = rand<5?'Rare':rand<30?'Uncommon':'Common';
    let sChoicesData = allSymbols.filter(s=>s.rarity===rarity);
    if(sChoicesData.length<3 && rarity !== 'Common') sChoicesData=sChoicesData.concat(allSymbols.filter(s=>s.rarity==='Common')).filter((v,i,a)=>a.findIndex(t=>(t.no===v.no))===i);
    if(sChoicesData.length===0){setIsSymbolAcquisitionPhase(false);handleTurnResolution(spinCount);return;}
    const finalChoicesArr: SymbolData[]=[]; const pIS=new Set<number>(); let attS=0;
    while(finalChoicesArr.length<Math.min(3,sChoicesData.length) && attS<sChoicesData.length*3){
      const rIS=Math.floor(Math.random()*sChoicesData.length); if(!pIS.has(rIS)){finalChoicesArr.push(sChoicesData[rIS]);pIS.add(rIS);} attS++;
    }
    if(finalChoicesArr.length===0 && sChoicesData.length>0)finalChoicesArr.push(sChoicesData[0]);
    setSymbolChoices(finalChoicesArr.filter(Boolean)); setIsSymbolAcquisitionPhase(true);
  };
  const handleSymbolSelected = (s: SymbolData) => {setCurrentDeck(p=>[...p,s]); setIsSymbolAcquisitionPhase(false); setSymbolChoices([]); handleTurnResolution(spinCount);};
  const handleSymbolSkipped = () => {setIsSymbolAcquisitionPhase(false); setSymbolChoices([]); handleTurnResolution(spinCount);};
  const handleRelicSelected = (r: RelicData) => {setAcquiredRelics(p=>[...p,r]); setIsRelicSelectionPhase(false); setRelicChoices([]); resolveEnemyEncounter(spinCount);};
  const handleDeleteSymbol = (idx: number) => {if(symbolDeleteTickets>0){setCurrentDeck(p=>p.filter((_,i)=>i!==idx));setSymbolDeleteTickets(p=>p-1);setGameMessage("Symbol removed.");}};

  const dealDamageToEnemy = (dmg: number) => {
    if(!currentEnemy)return; const newH=Math.max(0,enemyHP-dmg); setEnemyHP(newH);
    if(newH<=0){setGameMessage(`Defeated ${currentEnemy.name}! +1 Ticket!`);setCurrentEnemy(null);setEnemyHP(0);setSymbolDeleteTickets(p=>p+1);}
  };
  const applyEnemyDebuff = (board: (SymbolData | null)[]): (SymbolData | null)[] => {
    if (!currentEnemy || isGameOver) return board;
    const newBoard = [...board];
    let debuffMsg = "";
    if (currentEnemy.name === "スロット・ゴブリン (Slot Goblin)") {
      const cursedMask = allSymbols.find(s => s.name === "呪いの仮面 (Cursed Mask)");
      if (cursedMask && newBoard.some(s=>s!==null)) { let rIdx = -1, att = 0; while(att<20){ const tIdx=Math.floor(Math.random()*9); if(newBoard[tIdx]!==null){rIdx=tIdx;break;} att++;}
        if (rIdx !== -1 && newBoard[rIdx]) { debuffMsg = `${currentEnemy.name} changed ${newBoard[rIdx]!.name.split(' ')[0]} to Cursed Mask!`; newBoard[rIdx] = cursedMask; }
      }
    } else if (currentEnemy.name === "コスト・インフレーター (Cost Inflater)" && !activeDebuffs.find(d => d.type === `CostIncrease-${currentEnemy!.name}`)) {
        setActiveDebuffs(p => [...p, { type: `CostIncrease-${currentEnemy!.name}`, duration: 3, value: 0.1 }]); debuffMsg = `${currentEnemy.name} increases spin cost!`;
    }
    if (debuffMsg) setGameMessage(p => p ? `${p} | ${debuffMsg}` : debuffMsg);
    return newBoard;
  };

  const handleSpin = () => {
    if (isGameOver || medals < spinCost || currentDeck.length === 0 || isSymbolAcquisitionPhase || isRelicSelectionPhase || isDeckEditModalOpen) return;
    setHighlightedLine(null); setMedals(prev => prev - spinCost);
    const nextSpinCount = spinCount + 1; setSpinCount(nextSpinCount);
    setLineMessage(""); setGameMessage("");
    if (nextCostIncreaseIn > 0) setNextCostIncreaseIn(prev => prev - 1);
    if (nextEnemyIn > 0 && currentEnemy === null) setNextEnemyIn(prev => prev - 1);

    const costIncDebuff = activeDebuffs.find(d => d.type.startsWith("CostIncrease"));
    if (costIncDebuff) { setGameMessage(p => `${p ? p + " | " : ""}Spin cost modified by debuff!`); }
    setActiveDebuffs(pDebuffs => pDebuffs.map(d => ({ ...d, duration: d.duration - 1 })).filter(d => d.duration > 0));

    // eslint-disable-next-line prefer-const
    let cBoardSymbolsDraft: SymbolData[] = [];
    for (let i=0; i<9; i++) { cBoardSymbolsDraft.push(currentDeck[Math.floor(Math.random()*currentDeck.length)]); }
    
    const finalBoard = applyEnemyDebuff(cBoardSymbolsDraft as (SymbolData | null)[]);
    setBoardSymbols(finalBoard);

    const { gainedMedals: abG, message: abM } = applyAdjacentBonuses(finalBoard);
    let totalG = 0; let combinedM = "";
    if (abG > 0) { setMedals(p => p + abG); totalG += abG; combinedM += abM; }

    const { gainedMedals: lineG, message: linesM, formedLinesIndices: fLIdx } = checkLinesAndApplyRelics(finalBoard, acquiredRelics);
    if (lineG > 0) { setMedals(p => p + lineG); totalG += lineG; 
      if (fLIdx.length > 0) { setHighlightedLine(fLIdx[0]); setTimeout(() => setHighlightedLine(null), 800); }
    }
    if (linesM !== "No lines or no medal effects." && linesM !== "") { combinedM += (combinedM ? " | " : "") + linesM; }
    setLineMessage(combinedM || "No bonuses or lines.");

    if (currentEnemy && totalG > 0) { dealDamageToEnemy(totalG); }
    if (!isGameOver) startSymbolAcquisition();
  };
  
  useEffect(() => {
    if (!isGameOver && (medals < spinCost || currentDeck.length === 0) && spinCount > 0) {
        setGameMessage(medals < spinCost ? "Not enough medals! GAME OVER!" : "Deck is empty! GAME OVER!");
        setIsGameOver(true);
    }
  }, [medals, spinCost, currentDeck, spinCount, isGameOver]);

  const handleRestartGame = () => { window.location.href = '/'; };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-2 md:p-4 selection:bg-yellow-500 selection:text-black">
      <header className="w-full max-w-4xl mb-4">
        <div className="grid grid-cols-3 md:grid-cols-4 gap-1 md:gap-2 p-2 md:p-3 bg-gray-800 rounded-lg shadow-lg text-xs md:text-sm">
          <div className="text-center">Medals: <AnimatedNumber targetValue={medals} /></div>
          <div className="text-center">Cost: <span className="font-bold text-red-400">{spinCost}</span></div>
          <div className="text-center">Spins: <span className="font-bold text-lg">{spinCount}</span></div>
          <div className="text-center md:col-span-1 col-span-1">Deck: <span className="font-bold">{currentDeck.length}</span></div>
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
      <main className="w-full max-w-xs sm:max-w-sm md:max-w-md mb-4">
        <div className="grid grid-cols-3 gap-1 md:gap-2 p-1 md:p-2 bg-gray-700 rounded-lg shadow-inner">
          {boardSymbols.map((symbol, i) => (
            <div key={i} className={`transition-all duration-200 ease-in-out transform ${ highlightedLine && highlightedLine.includes(i) ? 'ring-4 ring-yellow-400 scale-105 z-10 shadow-lg' : 'ring-transparent' }`}>
              <SymbolDisplay symbol={symbol} />
            </div>
          ))}
        </div>
        {lineMessage && !isGameOver && <div className="mt-2 p-2 bg-gray-800 rounded text-center text-xs md:text-sm text-yellow-300 shadow">{lineMessage}</div>}
        {gameMessage && !isGameOver && <div className="mt-1 p-2 bg-indigo-700 rounded text-center text-xs md:text-sm text-indigo-100 shadow">{gameMessage}</div>}
      </main>
      <footer className="w-full max-w-xs sm:max-w-sm md:max-w-md">
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