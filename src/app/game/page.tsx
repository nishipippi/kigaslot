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

// 初期デッキ定義 (コモンからランダム15枚)
const getInitialDeck = (): SymbolData[] => {
  const commonSymbols = allSymbols.filter(symbol => symbol.rarity === 'Common');
  const initialDeck: SymbolData[] = [];
  const deckSize = 15;
  if (commonSymbols.length === 0) { console.error("No common symbols found!"); return []; }
  for (let i = 0; i < deckSize; i++) {
    initialDeck.push(commonSymbols[Math.floor(Math.random() * commonSymbols.length)]);
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
    let totalMedalsFromAB = 0; let abMessages: string[] = [];
    currentBoard.forEach((symbol, index) => {
      if (symbol && symbol.effectSystem === 'AB') {
        if (symbol.name === "磁鉄鉱 (Lodestone)") {
          let adjMetal = 0; const {row,col}={row:Math.floor(index/3),col:index%3};
          for(let rO=-1;rO<=1;rO++){for(let cO=-1;cO<=1;cO++){if(rO===0&&cO===0)continue;const nR=row+rO;const nC=col+cO;
          if(nR>=0&&nR<3&&nC>=0&&nC<3){const nS=currentBoard[nR*3+nC];if(nS&&nS.attribute==="Metal")adjMetal++;}}}
          if(adjMetal>0){const gain=adjMetal*3;totalMedalsFromAB+=gain;abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}`);}
        }
      }
    });
    return { gainedMedals: totalMedalsFromAB, message: abMessages.join(' | ') };
  };

  const checkLinesAndApplyRelics = (currentBoard: (SymbolData | null)[], currentAcquiredRelics: RelicData[]): { gainedMedals: number, message: string, formedLinesIndices: number[][] } => {
    let totalMedals = 0; const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let lineDetails: string[] = []; let lineIndicesArray: number[][] = [];
    lines.forEach(indices => {
      const s = indices.map(i=>currentBoard[i]); const lineSyms = s.filter(sym=>sym!==null) as SymbolData[];
      if (lineSyms.length===3 && lineSyms[0].attribute===lineSyms[1].attribute && lineSyms[0].attribute===lineSyms[2].attribute) {
        let lineWinBM=0; let lineD=`${lineSyms[0].attribute} Line: `;
        lineSyms.forEach(sl=>{if(sl.effectSystem==='BM'){const bG=parseBmEffect(sl.effectText);const gWR=applyRelicToSymbolBM(sl,bG,currentAcquiredRelics);if(gWR>0){lineWinBM+=gWR;lineD+=` ${sl.name.split(' ')[0]}(+${gWR}) `;}}});
        let finalWin=lineWinBM;
        lineSyms.forEach(sl=>{if(sl.effectSystem==='LB'){
          if(sl.name==="ベル (Bell)"&&lineSyms.filter(ls=>ls.name==="ベル (Bell)").length===3&&lineWinBM>0){finalWin=Math.floor(finalWin*1.5)+1;lineD+=`[Bell x1.5+1]`;}
          else if(sl.name==="チェリー (Cherry)"){const cC=lineSyms.filter(ls=>ls.name==="チェリー (Cherry)").length;const cB=cC===1?3:cC===2?8:cC>=3?20:0;if(cB>0){finalWin+=cB;lineD+=`[Cherry+${cB}]`;}}
        }});
        if(finalWin>0){totalMedals+=finalWin;lineDetails.push(`${lineD.trim()}->Total+${finalWin}`);lineIndicesArray.push([...indices]);}
      }
    });
    const msg = lineDetails.join(' | ')||(totalMedals>0?`Total+${totalMedals}medals!`:"No lines or no medal effects.");
    return {gainedMedals:totalMedals, message:msg, formedLinesIndices:lineIndicesArray};
  };

  const handleTurnResolution = (currentSpinCountForCheck: number) => {
    setGameMessage(""); let proceed=true;
    if(currentSpinCountForCheck>0 && currentSpinCountForCheck%5===0){
      const newC=calculateNewSpinCost(currentSpinCountForCheck,10);setSpinCost(newC);setNextCostIncreaseIn(5);
      const choicesR:RelicData[]=[];const unacquiredR=allRelics.filter(r=>!acquiredRelics.find(ar=>ar.no===r.no));
      const pIR=new Set<number>();const numToPickR=Math.min(3,unacquiredR.length);let attR=0;
      while(choicesR.length<numToPickR && pIR.size<unacquiredR.length && attR<allRelics.length*2){
        const rIR=Math.floor(Math.random()*unacquiredR.length);if(!pIR.has(rIR)){choicesR.push(unacquiredR[rIR]);pIR.add(rIR);}attR++;
      }
      if(choicesR.length>0){setRelicChoices(choicesR);setIsRelicSelectionPhase(true);proceed=false;}
      else{setGameMessage(unacquiredR.length===0?"All relics acquired!":"No new relics.");}
    }
    if(proceed){resolveEnemyEncounter(currentSpinCountForCheck);}
  };

  const resolveEnemyEncounter = (currentSpinCountForCheck: number) => {
    if(currentSpinCountForCheck>0 && currentSpinCountForCheck%10===0 && !currentEnemy){
      const eIdx=Math.floor(Math.random()*allEnemies.length);const newE=allEnemies[eIdx];setCurrentEnemy(newE);
      const bHp=(spinCost*8)+(currentSpinCountForCheck*2);setEnemyHP(Math.max(50,Math.floor(bHp*newE.hpMultiplier)));
      setNextEnemyIn(10); setGameMessage(`Enemy Appeared: ${newE.name}!`);
      setShowWarningTelop(true); setTimeout(()=>setShowWarningTelop(false),2500);
    }
  };

  const startSymbolAcquisition = () => {
    const choicesArr: SymbolData[] = []; const numChoices = 3;
    for (let i=0; i<numChoices; i++) {
      const rand = Math.random()*100; let selectedRarity:SymbolRarity = rand<5?'Rare':rand<30?'Uncommon':'Common';
      let availableSyms = allSymbols.filter(s=>s.rarity===selectedRarity);
      if(availableSyms.length===0){
        if(selectedRarity!=='Common'){console.warn(`No ${selectedRarity} symbols, fallback to Common.`);availableSyms=allSymbols.filter(s=>s.rarity==='Common');}
        if(availableSyms.length===0){console.error("No Common symbols either!"); continue;}
      }
      choicesArr.push(availableSyms[Math.floor(Math.random()*availableSyms.length)]);
    }
    if(choicesArr.length>0){setSymbolChoices(choicesArr.filter(Boolean));setIsSymbolAcquisitionPhase(true);}
    else{setIsSymbolAcquisitionPhase(false);setGameMessage("No symbols to choose.");handleTurnResolution(spinCount);}
  };
  const handleSymbolSelected=(s:SymbolData)=>{setCurrentDeck(p=>[...p,s]);setIsSymbolAcquisitionPhase(false);setSymbolChoices([]);handleTurnResolution(spinCount);};
  const handleSymbolSkipped=()=>{setIsSymbolAcquisitionPhase(false);setSymbolChoices([]);handleTurnResolution(spinCount);};
  const handleRelicSelected=(r:RelicData)=>{setAcquiredRelics(p=>[...p,r]);setIsRelicSelectionPhase(false);setRelicChoices([]);resolveEnemyEncounter(spinCount);};
  const handleDeleteSymbol=(idx:number)=>{if(symbolDeleteTickets>0){setCurrentDeck(p=>p.filter((_,i)=>i!==idx));setSymbolDeleteTickets(p=>p-1);setGameMessage("Symbol removed.");}};

  const dealDamageToEnemy=(dmg:number)=>{if(!currentEnemy)return;const newH=Math.max(0,enemyHP-dmg);setEnemyHP(newH);if(newH<=0){setGameMessage(`Defeated ${currentEnemy.name}!+1 Ticket!`);setCurrentEnemy(null);setEnemyHP(0);setSymbolDeleteTickets(p=>p+1);}};
  
  // 敵のデバフ効果を管理・適用 (毎スピン開始時)
  const applyAndManageEnemyDebuffs = (currentBoardBeforeDebuff: (SymbolData | null)[]): { modifiedBoard: (SymbolData | null)[], actualSpinCostModifier: number, messages: string[] } => {
    if (!currentEnemy || isGameOver) return { modifiedBoard: currentBoardBeforeDebuff, actualSpinCostModifier: 1, messages: [] };

    let newBoard = [...currentBoardBeforeDebuff];
    let costModForThisSpin = 1;
    const debuffMessagesThisTurn: string[] = [];

    // スロット・ゴブリン: 毎ターン1シンボルを「呪いの仮面」に変化
    if (currentEnemy.name === "スロット・ゴブリン (Slot Goblin)") {
      const cursedMask = allSymbols.find(s => s.name === "呪いの仮面 (Cursed Mask)");
      if (cursedMask) {
        const validIndices = newBoard.map((s, i) => s ? i : -1).filter(i => i !== -1); // nullでないマスのインデックス
        if (validIndices.length > 0) {
          const randomIndexToChange = validIndices[Math.floor(Math.random() * validIndices.length)];
          if (newBoard[randomIndexToChange]) { // 念のため
            debuffMessagesThisTurn.push(`${currentEnemy.name} changed ${newBoard[randomIndexToChange]!.name.split(' ')[0]} to Cursed Mask!`);
            newBoard[randomIndexToChange] = cursedMask;
          }
        }
      }
    }

    // コスト・インフレーター: スピンコスト増 (持続効果)
    const costInflaterDebuff = activeDebuffs.find(d => d.type === `CostIncrease-${currentEnemy.name}`);
    if (currentEnemy.name === "コスト・インフレーター (Cost Inflater)") {
      if (!costInflaterDebuff) { // この敵によるデバフがまだ発動していない場合 (または期間終了後再発動)
        setActiveDebuffs(prev => [...prev.filter(d => d.type !== `CostIncrease-${currentEnemy!.name}`), { type: `CostIncrease-${currentEnemy!.name}`, duration: 3, value: 0.1 }]);
        debuffMessagesThisTurn.push(`${currentEnemy.name} increases spin cost for 3 spins!`);
        costModForThisSpin = 1.1; // このスピンから即時適用
      } else if (costInflaterDebuff.duration > 0) {
        costModForThisSpin = 1 + (costInflaterDebuff.value || 0);
        debuffMessagesThisTurn.push(`Spin cost increased by ${currentEnemy.name}! (${costInflaterDebuff.duration} spins left)`);
      }
    }
    // 他の敵の毎ターン発動するデバフ効果をここに追加

    return { modifiedBoard: newBoard, actualSpinCostModifier: costModForThisSpin, messages: debuffMessagesThisTurn };
  };

  const handleSpin = () => {
    let costForThisSpin = spinCost;
    let debuffMsgsForSpinStart: string[] = [];

    if (currentEnemy && !isGameOver) {
      const debuffResult = applyAndManageEnemyDebuffs(boardSymbols); // boardSymbolsは前のターンの最終状態
      // 注意: applyAndManageEnemyDebuffs内でboardSymbolsを変更する場合、その変更は次のレンダリングまで反映されない。
      // 盤面変更デバフは、新しいシンボルを引く前に適用するか、引いた後に適用するかで挙動が変わる。
      // ここでは「スピン開始時」なので、新しいシンボルを引く前の盤面に対して効果があるものは少ない。
      // スロットゴブリンのような「盤面上のシンボルを変化させる」効果は、新しいシンボルが配置された後の方が自然。
      // 今回は、コスト変更デバフのみをここで考慮し、盤面変更は新しいシンボル配置後に行う。
      
      // コスト変更デバフの適用 (仮)
      const costIncreaseDebuff = activeDebuffs.find(d => d.type.startsWith("CostIncrease") && d.duration > 0);
      if (costIncreaseDebuff) {
          costForThisSpin = Math.round(spinCost * (1 + (costIncreaseDebuff.value || 0)));
          debuffMsgsForSpinStart.push(`Spin cost modified to ${costForThisSpin} by debuff!`);
      }
    }

    if (isGameOver || medals < costForThisSpin || currentDeck.length === 0 || isSymbolAcquisitionPhase || isRelicSelectionPhase || isDeckEditModalOpen) return;
    
    setHighlightedLine(null);
    setMedals(prev => prev - costForThisSpin); // デバフ考慮後のコストで消費
    const nextSpinCount = spinCount + 1; setSpinCount(nextSpinCount);
    setLineMessage(""); 
    setGameMessage(debuffMsgsForSpinStart.join(" | ")); // スピン開始時のデバフメッセージ

    if (nextCostIncreaseIn > 0) setNextCostIncreaseIn(prev => prev - 1);
    if (nextEnemyIn > 0 && currentEnemy === null) setNextEnemyIn(prev => prev - 1);

    setActiveDebuffs(pDebuffs => pDebuffs.map(d => ({ ...d, duration: d.duration - 1 })).filter(d => d.duration > 0));

    let cBoardSymbolsDraft: SymbolData[] = [];
    for (let i=0; i<9; i++) { cBoardSymbolsDraft.push(currentDeck[Math.floor(Math.random()*currentDeck.length)]); }
    
    // 敵の妨害効果 (盤面変更系 - スロットゴブリンなど、新しいシンボル配置後に適用)
    let finalBoardAfterDebuff = cBoardSymbolsDraft as (SymbolData | null)[];
    if (currentEnemy && !isGameOver) {
        // スロットゴブリンのような「盤面上のシンボルを変化させる」効果をここで適用
        if (currentEnemy.name === "スロット・ゴブリン (Slot Goblin)") {
            const cursedMask = allSymbols.find(s => s.name === "呪いの仮面 (Cursed Mask)");
            if (cursedMask) {
                const validIndices = finalBoardAfterDebuff.map((s, i) => s ? i : -1).filter(i => i !== -1);
                if (validIndices.length > 0) {
                    const rIdxToChange = validIndices[Math.floor(Math.random() * validIndices.length)];
                    if (finalBoardAfterDebuff[rIdxToChange]) {
                        setGameMessage(prev => `${prev ? prev + " | " : ""}Goblin changed ${finalBoardAfterDebuff[rIdxToChange]!.name.split(' ')[0]} to Cursed Mask!`);
                        finalBoardAfterDebuff[rIdxToChange] = cursedMask;
                    }
                }
            }
        }
        // 他の「新しい盤面に対して発動する」デバフがあればここ
    }
    setBoardSymbols(finalBoardAfterDebuff);

    const { gainedMedals: abG, message: abM } = applyAdjacentBonuses(finalBoardAfterDebuff);
    let totalG = 0; let combinedM = gameMessage;
    if (abG > 0) { setMedals(p => p + abG); totalG += abG; combinedM += (combinedM && abM ? " | " : "") + abM; }

    const { gainedMedals: lineG, message: linesM, formedLinesIndices: fLIdx } = checkLinesAndApplyRelics(finalBoardAfterDebuff, acquiredRelics);
    if (lineG > 0) { setMedals(p => p + lineG); totalG += lineG; 
      if (fLIdx.length > 0) { setHighlightedLine(fLIdx[0]); setTimeout(() => setHighlightedLine(null), 800); }
    }
    if (linesM !== "No lines or no medal effects." && linesM !== "") { combinedM += (combinedM && linesM ? " | " : "") + linesM; }
    
    const finalLineMessage = combinedM.replace(gameMessage, "").trim().replace(/^\|\s*/, "");
    setLineMessage(finalLineMessage || "No bonuses or lines.");
    // gameMessage はデバフメッセージが既に入っているので、そのままか、必要なら追記

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
    // 親要素で高さを画面いっぱいにし、Flexboxで中央揃えとスペース確保
    <div className="flex flex-col items-center justify-between min-h-screen bg-gray-900 text-white p-2 sm:p-4 selection:bg-yellow-500 selection:text-black overflow-hidden"> {/* overflow-hidden を追加 */}

      {/* ヘッダー: 画面上部に配置 */}
      <header id="game-header" className="w-full max-w-2xl mb-auto pt-2"> {/* mb-auto でメインコンテンツを押し下げる */}
        <div className="grid grid-cols-3 md:grid-cols-4 gap-1 md:gap-2 p-2 md:p-3 bg-gray-800 rounded-lg shadow-lg text-xs sm:text-sm">
          {/* ... (ヘッダー内容は既存のまま) ... */}
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
            {/* ... (敵情報内容は既存のまま) ... */}
            <h3 className="text-md md:text-lg font-bold text-red-300">{currentEnemy.name}</h3>
            <p className="text-sm md:text-md text-red-100">HP: <span className="font-semibold">{enemyHP}</span></p>
            <p className="text-xs text-red-200 mt-1 italic">Effect: {currentEnemy.debuffEffectText}</p>
          </div>
        )}
      </header>

      {/* メインコンテンツ (スロット盤面): 中央に配置し、可能な限り大きく */}
      {/* このコンテナがスロット盤面とメッセージを含む */}
      <main className="flex flex-col items-center justify-center w-full px-2 my-auto"> {/* my-auto で垂直方向の中央寄せを試みる */}
        {/* スロット盤面コンテナ: アスペクト比を1:1に保ち、親の幅に合わせる */}
        <div
          className="w-full max-w-[calc(100vh-220px)] sm:max-w-md md:max-w-lg lg:max-w-xl aspect-square mx-auto" // 高さを基準にするか幅を基準にするかで調整
          // style={{ maxWidth: `${boardSize}px`, maxHeight: `${boardSize}px` }} // JSでサイズ計算する場合
        >
          <div className="grid grid-cols-3 gap-1 md:gap-2 p-1 md:p-2 bg-gray-700 rounded-lg shadow-inner w-full h-full">
            {boardSymbols.map((symbol, i) => (
              <div key={i} className={`transition-all duration-200 ease-in-out transform ${ highlightedLine && highlightedLine.includes(i) ? 'ring-4 ring-yellow-400 scale-105 z-10 shadow-lg' : 'ring-transparent' } w-full h-full`}>
                <SymbolDisplay symbol={symbol} /> {/* SymbolDisplayが親のサイズに追従するようにする */}
              </div>
            ))}
          </div>
        </div>
        {/* メッセージエリアはスロット盤面の下に配置 */}
        <div className="w-full max-w-xs sm:max-w-sm md:max-w-md mt-2">
            {lineMessage && !isGameOver && <div className="p-1.5 text-xs bg-gray-800 rounded text-center text-yellow-300 shadow sm:p-2 sm:text-sm">{lineMessage}</div>}
            {gameMessage && !isGameOver && <div className="mt-1 p-1.5 text-xs bg-indigo-700 rounded text-center text-indigo-100 shadow sm:p-2 sm:text-sm">{gameMessage}</div>}
        </div>
      </main>

      {/* フッター: 画面下部に配置 */}
      <footer id="game-footer" className="w-full max-w-md mt-auto pb-2 sm:pb-4"> {/* mt-auto でメインコンテンツを押し上げる */}
        <div className="flex justify-around items-center p-2 md:p-4 bg-gray-800 rounded-lg shadow-lg">
          {/* ... (フッターボタン内容は既存のまま) ... */}
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

      {/* モーダル類は画面全体を覆うので、この階層でOK */}
      <SymbolAcquisitionModal isOpen={isSymbolAcquisitionPhase} choices={symbolChoices} onSelect={handleSymbolSelected} onSkip={handleSymbolSkipped} />
      {/* ... (他のモーダル) ... */}
      <DeckEditModal isOpen={isDeckEditModalOpen} deck={currentDeck} tickets={symbolDeleteTickets} onClose={() => setIsDeckEditModalOpen(false)} onDeleteSymbol={handleDeleteSymbol} />
      <RelicSelectionModal isOpen={isRelicSelectionPhase} choices={relicChoices} onSelect={handleRelicSelected} />
      <GameOverModal isOpen={isGameOver} score={spinCount} onRestart={handleRestartGame} />

       {/* Warning Telop (fixedなので場所は影響なし) */}
       {showWarningTelop && (
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-red-600 text-white text-4xl sm:text-6xl font-bold p-4 sm:p-8 rounded-lg shadow-2xl animate-pulse border-4 border-red-400">
          Warning!!
        </div>
      )}
    </div>
  );
}