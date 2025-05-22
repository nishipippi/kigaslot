// src/app/game/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SymbolData, SymbolRarity, RelicData, EnemyData } from '@/types/kigaslot';
import type { BoardSymbol } from './symbollogic'; 
import { symbols as allSymbolsData } from '@/data/symbols'; 
import { relics as allRelicsData } from '@/data/relics';   
import { enemies as allEnemiesData } from '@/data/enemies'; 

import { processSpin, type GameState, type GameStateSetters } from './gameManager'; 

import SymbolDisplay from '@/components/game/SymbolDisplay';
import SymbolAcquisitionModal from '@/components/game/SymbolAcquisitionModal';
import DeckEditModal from '@/components/game/DeckEditModal';
import RelicSelectionModal from '@/components/game/RelicSelectionModal';
import GameOverModal from '@/components/game/GameOverModal';

const getInitialDeck = (): SymbolData[] => {
  const commonSymbols = allSymbolsData.filter(symbol => symbol.rarity === 'Common');
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

const playSound = (soundName: string) => {
  console.log(`Playing sound: ${soundName}`);
};


export default function GamePage() {
  const [medals, setMedals] = useState(100);
  const [spinCount, setSpinCount] = useState(0);
  const [currentDeck, setCurrentDeck] = useState<SymbolData[]>(getInitialDeck());
  const [boardSymbols, setBoardSymbols] = useState<BoardSymbol[]>(Array(9).fill(null));
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
  const [oneTimeSpinCostModifier, setOneTimeSpinCostModifier] = useState<number>(1);

  const [persistingSymbols, setPersistingSymbols] = useState<{ index: number, symbol: SymbolData, duration: number }[]>([]);
  const [currentRareSymbolBonus, setCurrentRareSymbolBonus] = useState<number>(0);


  const initializeGameState = useCallback(() => {
    setMedals(100); setSpinCount(0); setCurrentDeck(getInitialDeck());
    setBoardSymbols(Array(9).fill(null)); setSpinCost(10); setLineMessage("");
    setGameMessage("Game Started! Good luck!"); setHighlightedLine(null); setIsGameOver(false);
    setIsSymbolAcquisitionPhase(false); setSymbolChoices([]); setIsDeckEditModalOpen(false);
    setSymbolDeleteTickets(0); setAcquiredRelics([]); setIsRelicSelectionPhase(false);
    setRelicChoices([]); setNextCostIncreaseIn(5); setCurrentEnemy(null); setEnemyHP(0);
    setNextEnemyIn(10); setActiveDebuffs([]); setShowWarningTelop(false);
    setOneTimeSpinCostModifier(1);
    setPersistingSymbols([]);
    setCurrentRareSymbolBonus(0);
  }, []);
  useEffect(() => { initializeGameState(); }, [initializeGameState]);

  const calculateNewSpinCost = (currentSpinCountForCalc: number, baseCost: number): number => {
    const coefficientA = 0.3; if (currentSpinCountForCalc <= 0) return baseCost;
    const cost = baseCost + Math.floor(Math.pow(currentSpinCountForCalc, 1.2) * coefficientA);
    return Math.max(baseCost, Math.round(cost / 5) * 5);
  };
  
  const applyEnemyDebuffsAndGetInfoForManager = useCallback((): { debuffMessages: string[], debuffsAppliedThisTurn: typeof activeDebuffs } => {
    const debuffsAppliedThisTurn: typeof activeDebuffs = []; 
    if (!currentEnemy || isGameOver) return { debuffMessages: [], debuffsAppliedThisTurn };
    
    const messages: string[] = [];
    if (currentEnemy.name === "コスト・インフレーター (Cost Inflater)") {
      const existingDebuff = activeDebuffs.find(d => d.type === "CostIncrease" && d.originEnemy === currentEnemy.name);
      const newDebuffEntry = { type: "CostIncrease" as const, duration: 3, value: 0.1, originEnemy: currentEnemy.name };
      if (!existingDebuff) {
        debuffsAppliedThisTurn.push(newDebuffEntry);
        messages.push(`${currentEnemy.name} inflates spin cost for 3 turns!`);
      } else if (existingDebuff.duration > 0) {
        messages.push(`Spin cost increased by ${currentEnemy.name}! (${existingDebuff.duration} turns left)`);
      }
    }
    return { debuffMessages: messages, debuffsAppliedThisTurn };
  }, [currentEnemy, isGameOver, activeDebuffs]);

  const handleEnemyDefeatForManager = useCallback((enemyName: string) => {
    setGameMessage(prev => (prev ? prev + " | " : "") + `Defeated ${enemyName}! +1 Ticket!`);
    setCurrentEnemy(null);
    setEnemyHP(0);
    setSymbolDeleteTickets(p => p + 1);
    setActiveDebuffs(prevDebuffs => prevDebuffs.filter(d => d.originEnemy !== enemyName));
  }, []);

  const resolveNewEnemyEncounterForManager = useCallback((currentSpinCountForCheck: number): boolean => {
    if (currentSpinCountForCheck > 0 && currentSpinCountForCheck % 10 === 0 && !currentEnemy) {
        const enemyIdx = Math.floor(Math.random()*allEnemiesData.length); 
        const newE = allEnemiesData[enemyIdx]; 
        setCurrentEnemy(newE);
        const bHp = (spinCost*8)+(currentSpinCountForCheck*2); 
        setEnemyHP(Math.max(50,Math.floor(bHp*newE.hpMultiplier)));
        setNextEnemyIn(10); 
        setGameMessage(prev => (prev ? prev + " | " : "") + `Enemy Appeared: ${newE.name}!`); 
        setShowWarningTelop(true);
        setTimeout(() => setShowWarningTelop(false), 2500);
        return false; 
    }
    return true; 
  }, [currentEnemy, spinCost]);

  const triggerGameOverHandler = useCallback((message: string) => {
    setGameMessage(message);
    setIsGameOver(true);
  }, []);

  const startSymbolAcquisition = useCallback((rareBonusPercentage: number = 0) => { 
      const choicesArr: SymbolData[] = []; const numChoices = 3;
      const baseProbs = { common: 70, uncommon: 25, rare: 5 };
      const probIncreaseFactor = 0.1; 
      const spinBasedRareIncrease = Math.min(20, spinCount * 0.03 * probIncreaseFactor * 100); 
      const spinBasedUncommonIncrease = Math.min(30, spinCount * 0.07 * probIncreaseFactor * 100); 
      
      let actualRareProb = baseProbs.rare + spinBasedRareIncrease + rareBonusPercentage; 
      let actualUncommonProb = baseProbs.uncommon + spinBasedUncommonIncrease;
      
      const totalAllocatedToRareUncommonVal = actualRareProb + actualUncommonProb; 
      if (totalAllocatedToRareUncommonVal > 90) { 
          const excess = totalAllocatedToRareUncommonVal - 90;
          if (actualRareProb + actualUncommonProb > 0) {
              const rareReduction = (actualRareProb / totalAllocatedToRareUncommonVal) * excess;
              const uncommonReduction = (actualUncommonProb / totalAllocatedToRareUncommonVal) * excess;
              actualRareProb -= rareReduction;
              actualUncommonProb -= uncommonReduction;
          }
      }
      actualRareProb = Math.max(0, Math.min(100, actualRareProb)); 
      actualUncommonProb = Math.max(0, Math.min(100 - actualRareProb, actualUncommonProb));
      const actualCommonProbVal = Math.max(0, 100 - actualRareProb - actualUncommonProb); 

      console.log(`Rarity Probs (Bonus: ${rareBonusPercentage}%): C:${actualCommonProbVal.toFixed(2)}% U:${actualUncommonProb.toFixed(2)}% R:${actualRareProb.toFixed(2)}% (Spin: ${spinCount})`);
      for (let i=0; i<numChoices; i++) {
        const rand = Math.random()*100;
        let rarity: SymbolRarity;
        if (rand < actualRareProb) rarity = 'Rare';
        else if (rand < actualRareProb + actualUncommonProb) rarity = 'Uncommon';
        else rarity = 'Common';
        
        let availableSyms = allSymbolsData.filter(s=>s.rarity===rarity); 
        if(availableSyms.length===0){ if(rarity!=='Common'){availableSyms=allSymbolsData.filter(s=>s.rarity==='Common');} } 
        if(availableSyms.length===0){ continue; }
        choicesArr.push(availableSyms[Math.floor(Math.random()*availableSyms.length)]);
      }
      if (choicesArr.length > 0) { setSymbolChoices(choicesArr.filter(Boolean)); setIsSymbolAcquisitionPhase(true); }
      else { setIsSymbolAcquisitionPhase(false); setGameMessage(prev => (prev ? prev + " | " : "") + "No symbols to choose this time.");}
  }, [spinCount]); 

  const handleTurnResolution = useCallback((currentSpinCountForCheck: number) => {
    let currentGeneralMessage = ""; 
    let proceedToSymbolOrEnemy = true;

    if (currentSpinCountForCheck > 0 && currentSpinCountForCheck % 5 === 0) {
        const newC = calculateNewSpinCost(currentSpinCountForCheck, 10);
        setSpinCost(Math.max(1, Math.round(newC * oneTimeSpinCostModifier)));
        setOneTimeSpinCostModifier(1); 
        setNextCostIncreaseIn(5);

        const choicesR: RelicData[] = []; 
        const unacquiredR = allRelicsData.filter(r => !acquiredRelics.find(ar => ar.no === r.no)); 
        const pIR = new Set<number>(); const numToPickR = Math.min(3,unacquiredR.length); let attR = 0;
        while (choicesR.length < numToPickR && pIR.size < unacquiredR.length && attR < allRelicsData.length * 2) { 
            const rIR = Math.floor(Math.random()*unacquiredR.length); 
            if (!pIR.has(rIR)) { choicesR.push(unacquiredR[rIR]); pIR.add(rIR); } 
            attR++;
        }
        if (choicesR.length > 0) {
            setRelicChoices(choicesR); setIsRelicSelectionPhase(true);
            proceedToSymbolOrEnemy = false; 
        } else {
            currentGeneralMessage += (currentGeneralMessage ? " | " : "") + (unacquiredR.length === 0 ? "All relics acquired!" : "No new relics for now.");
        }
    }

    if (proceedToSymbolOrEnemy) {
        resolveNewEnemyEncounterForManager(currentSpinCountForCheck); 
        startSymbolAcquisition(currentRareSymbolBonus); 
    }
    setCurrentRareSymbolBonus(0); 
    if (currentGeneralMessage) setGameMessage(prev => (prev ? prev + " | " : "") + currentGeneralMessage);
  }, [oneTimeSpinCostModifier, acquiredRelics, currentRareSymbolBonus, resolveNewEnemyEncounterForManager, startSymbolAcquisition]); 


  const handleSymbolSelected = (s: SymbolData) => {setCurrentDeck(p=>[...p,s]); setIsSymbolAcquisitionPhase(false); setSymbolChoices([]); };
  const handleSymbolSkipped = () => {setIsSymbolAcquisitionPhase(false); setSymbolChoices([]); };
  const handleRelicSelected = (r: RelicData) => {setAcquiredRelics(p=>[...p,r]); setIsRelicSelectionPhase(false); setRelicChoices([]); resolveNewEnemyEncounterForManager(spinCount); startSymbolAcquisition(currentRareSymbolBonus);};
  const handleDeleteSymbol = (idx: number) => {if(symbolDeleteTickets>0){setCurrentDeck(p=>p.filter((_,i)=>i!==idx));setSymbolDeleteTickets(p=>p-1);setGameMessage("Symbol removed.");}};
  

  const handleSpin = () => {
    const gameState: GameState = {
      medals, spinCost, currentDeck, currentRareSymbolBonus, oneTimeSpinCostModifier,
      spinCount, nextCostIncreaseIn, nextEnemyIn, currentEnemy, enemyHP,
      acquiredRelics, activeDebuffs, persistingSymbols,
      isGameOver, isSymbolAcquisitionPhase, isRelicSelectionPhase, isDeckEditModalOpen,
    };

    const setters: GameStateSetters = {
      setMedals, setSpinCount, setBoardSymbols, setLineMessage, setGameMessage,
      setHighlightedLine, setNextCostIncreaseIn, setNextEnemyIn, setCurrentEnemy,
      setEnemyHP, setActiveDebuffs, setPersistingSymbols, setOneTimeSpinCostModifier,
      setCurrentRareSymbolBonus,
      startSymbolAcquisitionPhase: startSymbolAcquisition, 
      triggerGameOver: triggerGameOverHandler,
      setCurrentDeck,
      setSymbolDeleteTickets,
      startRelicSelectionPhase: () => setIsRelicSelectionPhase(true), 
    };

    processSpin(
        gameState, 
        setters, 
        playSound,
        applyEnemyDebuffsAndGetInfoForManager,
        handleEnemyDefeatForManager,
        resolveNewEnemyEncounterForManager,
        handleTurnResolution 
    );
  };
  
  useEffect(() => {
    const currentActualCost = Math.max(1, Math.round(spinCost * oneTimeSpinCostModifier));
    if (!isGameOver && spinCount > 0 && (medals < currentActualCost || currentDeck.length === 0) ) {
        if (medals < currentActualCost) { setGameMessage("Not enough medals! GAME OVER!"); setIsGameOver(true); }
        else if (currentDeck.length === 0) { setGameMessage("Deck is empty! GAME OVER!"); setIsGameOver(true); }
    }
  }, [medals, spinCost, currentDeck, spinCount, isGameOver, oneTimeSpinCostModifier]);

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
          <div className="text-center">Cost: <span className="font-bold text-red-400">{Math.max(1, Math.round(spinCost * oneTimeSpinCostModifier))}</span></div>
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
          <button 
            onClick={() => { playSound('click'); handleSpin(); }} 
            disabled={isGameOver || isSymbolAcquisitionPhase || isRelicSelectionPhase || isDeckEditModalOpen || currentDeck.length === 0 || medals < Math.max(1, Math.round(spinCost * oneTimeSpinCostModifier))}
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