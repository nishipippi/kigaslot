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

// --- 初期設定・ヘルパー関数 ---
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
const parseBmEffect = (effectText: string): number => {
  const match = effectText.match(/このシンボル1つにつきメダルを\s*\+(\d+)\s*獲得/);
  return match && match[1] ? parseInt(match[1], 10) : 0;
};
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

// サウンドプレースホルダー
const playSound = (soundName: string) => {
  console.log(`Playing sound: ${soundName}`);
  // 将来的にはここに実際の音声再生ロジック (例: Howler.js や HTMLAudioElement)
  // const audio = new Audio(`/sounds/${soundName}.mp3`); // public/sounds/ に配置
  // audio.play().catch(e => console.warn("Audio play failed:", e));
};


export default function GamePage() {
  // --- 状態定義 ---
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

  // --- 初期化 ---
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

  // --- コスト計算 ---
  const calculateNewSpinCost = (currentSpinCountForCalc: number, baseCost: number): number => {
    const coefficientA = 0.3; if (currentSpinCountForCalc <= 0) return baseCost;
    const cost = baseCost + Math.floor(Math.pow(currentSpinCountForCalc, 1.2) * coefficientA);
    return Math.max(baseCost, Math.round(cost / 5) * 5);
  };

  // --- AB効果 ---
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

  // --- ライン判定 (ワイルド、ボム対応) ---
  const checkLinesAndApplyRelics = (
    currentBoard: (SymbolData | null)[],
    currentAcquiredRelics: RelicData[]
  ): { gainedMedals: number; message: string; formedLinesIndices: number[][]; bombsToExplode: { index: number, symbol: SymbolData }[] } => {
    let totalMedals = 0; const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let formedDetails: string[] = [];
    let formedIndicesArr: number[][] = [];
    const bombsTriggeredOnLine: { index: number, symbol: SymbolData }[] = [];

    lines.forEach(lineIdx => {
      const s = lineIdx.map(i=>currentBoard[i]);
      let wildCount = s.filter(sym => sym?.name === "ワイルド (Wild)").length;
      const nonWildSymbols = s.filter(sym => sym !== null && sym.name !== "ワイルド (Wild)") as SymbolData[];

      let effectiveAttribute: SymbolData['attribute'] | null = null;
      if (nonWildSymbols.length === 3) { // ワイルドなし
        if (nonWildSymbols[0].attribute === nonWildSymbols[1].attribute && nonWildSymbols[0].attribute === nonWildSymbols[2].attribute) {
          effectiveAttribute = nonWildSymbols[0].attribute;
        }
      } else if (nonWildSymbols.length === 2 && wildCount === 1) { // ワイルド1枚
        if (nonWildSymbols[0].attribute === nonWildSymbols[1].attribute) {
          effectiveAttribute = nonWildSymbols[0].attribute;
        }
      } else if (nonWildSymbols.length === 1 && wildCount === 2) { // ワイルド2枚
        effectiveAttribute = nonWildSymbols[0].attribute; // 任意の属性として成立
      } else if (wildCount === 3) { // ワイルド3枚 (特別扱い、例えば高配当や特殊効果)
        // ここでは仮に最も価値の高いコモン属性(Mysticなど)として扱うか、専用の処理
        effectiveAttribute = "Mystic"; // 仮
      }
      
      const lineSymbols = s.filter(sym => sym !== null) as SymbolData[]; // 元のシンボルで効果計算

      if(effectiveAttribute && lineSymbols.length === 3){ // ライン成立
        let lineWinBM=0; let lineD=`${effectiveAttribute} Line (W:${wildCount}): `;
        lineSymbols.forEach(sl=>{
          if(sl.name === "ワイルド (Wild)") { // ワイルド自身のBM効果はないが、表示用
            lineD += ` Wild `;
          } else if(sl.effectSystem==='BM'){
            const bG=parseBmEffect(sl.effectText); const gWR=applyRelicToSymbolBM(sl,bG,currentAcquiredRelics); 
            if(gWR>0){lineWinBM+=gWR;lineD+=` ${sl.name.split(' ')[0]}(+${gWR}) `;}
          }
        });
        
        let finalWin=lineWinBM;
        // LB効果
        lineSymbols.forEach(sl=>{if(sl.effectSystem==='LB'){
          if(sl.name==="ベル (Bell)"&&lineSymbols.filter(ls=>ls.name==="ベル (Bell)").length===3&&lineWinBM>0){finalWin=Math.floor(finalWin*1.5)+1;lineD+=`[Bell x1.5+1]`;}
          else if(sl.name==="チェリー (Cherry)"){const cC=lineSymbols.filter(ls=>ls.name==="チェリー (Cherry)").length; const cB=cC===1?3:cC===2?8:cC>=3?20:0; if(cB>0){finalWin+=cB;lineD+=`[Cherry+${cB}]`;}}
        }});

        // ワイルド効果: 獲得メダル1.2倍
        if (wildCount > 0 && finalWin > 0) {
          finalWin = Math.floor(finalWin * 1.2);
          lineD += `[Wild x1.2]`;
        }

        // ボム効果トリガーの記録 (ライン成立時)
        lineSymbols.forEach((sl, idxInLine) => {
            if (sl.name === "ボム (Bomb)") {
                finalWin += 5; // ボムの基礎メダル
                lineD += ` [Bomb+5] `;
                // 盤面上のインデックスを取得
                const boardIndex = lineIdx[idxInLine];
                if (!bombsTriggeredOnLine.find(b => b.index === boardIndex)) { // 重複追加を防ぐ
                    bombsTriggeredOnLine.push({ index: boardIndex, symbol: sl });
                }
            }
        });

        if(finalWin>0){totalMedals+=finalWin; formedDetails.push(`${lineD.trim()}->+${finalWin}`); formedIndicesArr.push([...lineIdx]);}
      }
    });
    const msg = formedDetails.join(' | ')||(totalMedals>0?`Total+${totalMedals}!`:"No lines/effects.");
    return {gainedMedals:totalMedals, message:msg, formedLinesIndices:formedIndicesArr, bombsToExplode: bombsTriggeredOnLine };
  };

  // ボム爆発処理
  const handleBombExplosions = (
    bombs: { index: number, symbol: SymbolData }[],
    currentBoard: (SymbolData | null)[]
  ): { gainedMedals: number, newBoard: (SymbolData | null)[], message: string } => {
    if (bombs.length === 0) return { gainedMedals: 0, newBoard: currentBoard, message: "" };

    let explosionMedals = 0;
    let boardAfterExplosions = [...currentBoard];
    let explosionMessages: string[] = [];

    bombs.forEach(bombInfo => {
      const {r,c}={r:Math.floor(bombInfo.index/3),c:bombInfo.index%3}; // ボムの位置 (Corrected: c:bombInfo.index%3)
      let destroyedCount = 0;
      explosionMessages.push(`${bombInfo.symbol.name} at [${r},${c}] explodes!`);

      for(let ro=-1;ro<=1;ro++){for(let co=-1;co<=1;co++){
        if(ro===0&&co===0) continue; 

        const nr=r+ro; const nc=c+co;
        if(nr>=0&&nr<3&&nc>=0&&nc<3){
          const neighborIndex = nr*3+nc;
          if(boardAfterExplosions[neighborIndex] !== null && boardAfterExplosions[neighborIndex]?.name !== "ボム (Bomb)"){ 
            explosionMedals += 6; 
            destroyedCount++;
            boardAfterExplosions[neighborIndex] = null; 
          }
        }
      }}
      if (destroyedCount > 0) {
        explosionMessages.push(`  Destroyed ${destroyedCount} symbols, +${destroyedCount * 6} medals.`);
      }
    });

    bombs.forEach(bombInfo => {
        if (boardAfterExplosions[bombInfo.index]?.name === "ボム (Bomb)") {
             boardAfterExplosions[bombInfo.index] = null;
        }
    });

    return { gainedMedals: explosionMedals, newBoard: boardAfterExplosions, message: explosionMessages.join(" ") };
  };


  // --- ターン終了時の進行管理 ---
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

  // --- シンボル獲得関連 (レアリティ変動追加) ---
  const startSymbolAcquisition = () => {
    const choicesArr: SymbolData[] = []; const numChoices = 3;
    const baseProbs = { common: 70, uncommon: 25, rare: 5 };
    const probIncreaseFactor = 0.1; 
    const rareIncrease = Math.min(20, spinCount * 0.03 * probIncreaseFactor * 100); 
    const uncommonIncrease = Math.min(30, spinCount * 0.07 * probIncreaseFactor * 100); 

    let actualRareProb = baseProbs.rare + rareIncrease;
    let actualUncommonProb = baseProbs.uncommon + uncommonIncrease;
    let actualCommonProb = 100 - actualRareProb - actualUncommonProb;

    if (actualCommonProb < 10) { 
        actualCommonProb = 10;
        const excess = (actualRareProb + actualUncommonProb) - 90;
        if (excess > 0) { 
            actualRareProb -= excess / 2;
            actualUncommonProb -= excess / 2;
        }
    }
    actualRareProb = Math.max(0, actualRareProb);
    actualUncommonProb = Math.max(0, actualUncommonProb);
    
    console.log(`Rarity Probs: C:${actualCommonProb.toFixed(2)}% U:${actualUncommonProb.toFixed(2)}% R:${actualRareProb.toFixed(2)}% (Spin: ${spinCount})`);

    for (let i=0; i<numChoices; i++) {
      const rand = Math.random()*100;
      let rarity: SymbolRarity;
      if (rand < actualRareProb) rarity = 'Rare';
      else if (rand < actualRareProb + actualUncommonProb) rarity = 'Uncommon';
      else rarity = 'Common';
      
      let availableSyms = allSymbols.filter(s=>s.rarity===rarity);
      if(availableSyms.length===0){if(rarity!=='Common'){availableSyms=allSymbols.filter(s=>s.rarity==='Common');}
      if(availableSyms.length===0){continue;}}
      choicesArr.push(availableSyms[Math.floor(Math.random()*availableSyms.length)]);
    }
    if (choicesArr.length > 0) { setSymbolChoices(choicesArr.filter(Boolean)); setIsSymbolAcquisitionPhase(true); }
    else { setIsSymbolAcquisitionPhase(false); setGameMessage("No symbols to choose."); handleTurnResolution(spinCount); }
  };
  const handleSymbolSelected = (s: SymbolData) => {setCurrentDeck(p=>[...p,s]); setIsSymbolAcquisitionPhase(false); setSymbolChoices([]); handleTurnResolution(spinCount);};
  const handleSymbolSkipped = () => {setIsSymbolAcquisitionPhase(false); setSymbolChoices([]); handleTurnResolution(spinCount);};
  const handleRelicSelected = (r: RelicData) => {setAcquiredRelics(p=>[...p,r]); setIsRelicSelectionPhase(false); setRelicChoices([]); resolveEnemyEncounter(spinCount);};
  const handleDeleteSymbol = (idx: number) => {if(symbolDeleteTickets>0){setCurrentDeck(p=>p.filter((_,i)=>i!==idx));setSymbolDeleteTickets(p=>p-1);setGameMessage("Symbol removed.");}};

  // --- 敵戦闘関連 ---
  const dealDamageToEnemy = (dmg: number) => {
    if(!currentEnemy)return; const newH=Math.max(0,enemyHP-dmg); setEnemyHP(newH);
    if(newH<=0){setGameMessage(`Defeated ${currentEnemy.name}! +1 Ticket!`);setCurrentEnemy(null);setEnemyHP(0);setSymbolDeleteTickets(p=>p+1); setActiveDebuffs(prev => prev.filter(d => d.originEnemy !== currentEnemy.name));}
  };
  const applyInstantDebuffsAndSetPersistentFlags = (): { boardMutated: boolean, costMultiplierFromDebuff: number, debuffMessages: string[] } => {
    if (!currentEnemy || isGameOver) return { boardMutated: false, costMultiplierFromDebuff: 1, debuffMessages: [] };
    
    const boardChanged = false; 
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

  // --- スピン実行 (ボム処理追加) ---
  const handleSpin = () => {
    if (isGameOver || medals < spinCost || currentDeck.length === 0 || isSymbolAcquisitionPhase || isRelicSelectionPhase || isDeckEditModalOpen) return;
    
    playSound('spin'); 
    setHighlightedLine(null); 
    setMedals(prev => prev - spinCost);
    const nextSpinCount = spinCount + 1; setSpinCount(nextSpinCount);
    setLineMessage(""); 
    setGameMessage(""); // Clear game message for the current spin effects

    if (nextCostIncreaseIn > 0) setNextCostIncreaseIn(prev => prev - 1);
    if (nextEnemyIn > 0 && currentEnemy === null) setNextEnemyIn(prev => prev - 1);

    setActiveDebuffs(pDebuffs => pDebuffs.map(d => ({ ...d, duration: d.duration - 1 })).filter(d => d.duration > 0));

    let cBoardSymbolsDraft: SymbolData[] = [];
    for (let i=0; i<9; i++) { cBoardSymbolsDraft.push(currentDeck[Math.floor(Math.random()*currentDeck.length)]); }
    
    // Note: applyInstantDebuffsAndSetPersistentFlags is called here, but its messages are not explicitly handled
    // to setGameMessage based on the provided diff. If Cost Inflater messages are desired, this needs adjustment.
    let boardAfterEnemyDebuff = applyInstantDebuffsAndSetPersistentFlags().boardMutated 
        ? cBoardSymbolsDraft as (SymbolData | null)[] 
        : cBoardSymbolsDraft as (SymbolData | null)[];
    
    if (currentEnemy && currentEnemy.name === "スロット・ゴブリン (Slot Goblin)" && !isGameOver) {
        const cursedMask = allSymbols.find(s => s.name === "呪いの仮面 (Cursed Mask)");
        if (cursedMask && boardAfterEnemyDebuff.some(s=>s!==null)) { let rIdx = -1, att = 0; while(att<20){ const tIdx=Math.floor(Math.random()*9); if(boardAfterEnemyDebuff[tIdx]!==null){rIdx=tIdx;break;} att++;}
            if (rIdx !== -1 && boardAfterEnemyDebuff[rIdx]) { 
                setGameMessage(prev => `${prev ? prev + " | " : ""}Goblin changed ${boardAfterEnemyDebuff[rIdx]!.name.split(' ')[0]} to Cursed Mask!`); 
                boardAfterEnemyDebuff[rIdx] = cursedMask; 
            }
        }
    }

    const { gainedMedals: abG, message: abM } = applyAdjacentBonuses(boardAfterEnemyDebuff);
    let totalGainedThisSpin = 0; 
    let combinedMessage = "";
    if (abG > 0) { 
        setMedals(p => p + abG); 
        totalGainedThisSpin += abG; 
        combinedMessage += abM; 
        playSound('medal'); 
    }

    const { gainedMedals: lineG, message: linesM, formedLinesIndices: fLIdx, bombsToExplode } = checkLinesAndApplyRelics(boardAfterEnemyDebuff, acquiredRelics);
    let finalBoardForDisplay = [...boardAfterEnemyDebuff]; 

    if (lineG > 0) {
      setMedals(p => p + lineG); 
      totalGainedThisSpin += lineG; 
      playSound('lineWin');
      if (fLIdx.length > 0) { 
          setHighlightedLine(fLIdx[0]); 
          setTimeout(() => setHighlightedLine(null), 800); 
      }
    }
    if (linesM !== "No lines or no medal effects." && linesM !== "") { 
        combinedMessage += (combinedMessage ? " | " : "") + linesM; 
    }
    
    if (bombsToExplode.length > 0) {
      playSound('bomb');
      const { gainedMedals: bombMedals, newBoard: boardAfterBombs, message: bombMsg } = handleBombExplosions(bombsToExplode, finalBoardForDisplay);
      if (bombMedals > 0) {
        setMedals(p => p + bombMedals);
        totalGainedThisSpin += bombMedals;
        playSound('medal');
      }
      finalBoardForDisplay = boardAfterBombs; 
      if (bombMsg) {
          combinedMessage += (combinedMessage ? " | " : "") + bombMsg;
      }
    }
    
    setBoardSymbols(finalBoardForDisplay); 
    setLineMessage(combinedMessage || "No bonuses or lines.");

    if (currentEnemy && totalGainedThisSpin > 0) { 
        dealDamageToEnemy(totalGainedThisSpin); 
    }
    if (!isGameOver) {
      // gameMessage would have been set by Slot Goblin or by dealDamageToEnemy (if enemy defeated).
      // If not, it remains empty from the start of handleSpin.
      // handleTurnResolution (called by startSymbolAcquisition) can also set gameMessage.
      startSymbolAcquisition();
    }
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
          <button onClick={() => { playSound('click'); handleSpin(); }} disabled={isGameOver || isSymbolAcquisitionPhase || isRelicSelectionPhase || isDeckEditModalOpen || medals < spinCost || currentDeck.length === 0}
            className="px-6 md:px-10 py-3 md:py-4 bg-green-600 hover:bg-green-700 text-white text-lg md:text-xl font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 active:bg-green-800">
            SPIN!
          </button>
          <button onClick={() => { playSound('click'); setIsDeckEditModalOpen(true); }} disabled={isGameOver || isSymbolAcquisitionPhase || isRelicSelectionPhase || isDeckEditModalOpen}
            className="px-4 md:px-8 py-3 md:py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg md:text-xl font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 active:bg-blue-800">
            DECK
          </button>
        </div>
      </footer>
      <SymbolAcquisitionModal isOpen={isSymbolAcquisitionPhase} choices={symbolChoices} onSelect={(s) => { playSound('select'); handleSymbolSelected(s); }} onSkip={() => { playSound('skip'); handleSymbolSkipped(); }} />
      <DeckEditModal isOpen={isDeckEditModalOpen} deck={currentDeck} tickets={symbolDeleteTickets} onClose={() => { playSound('close'); setIsDeckEditModalOpen(false); }} onDeleteSymbol={(idx) => { playSound('delete'); handleDeleteSymbol(idx); }} />
      <RelicSelectionModal isOpen={isRelicSelectionPhase} choices={relicChoices} onSelect={(r) => { playSound('select'); handleRelicSelected(r); }} />
      <GameOverModal isOpen={isGameOver} score={spinCount} onRestart={() => { playSound('click'); handleRestartGame(); }} />
    </div>
  );
}