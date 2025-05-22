// src/app/game/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  SymbolData,
  SymbolRarity,
  RelicData,
  EnemyData,
  InstanceSymbolData,
  DeckSymbol,
  BoardSymbolBase,
  PersistingSymbolInfo,
  RespinState,
  NextSpinEffects,
  RustedLumpProgress,
  Debuff,
} from '@/types/kigaslot';
import { symbols as allSymbolsData } from '@/data/symbols';
import { relics as allRelicsData } from '@/data/relics';
import { enemies as allEnemiesData } from '@/data/enemies';

import { processSpin, type GameState, type GameStateSetters } from './gameManager';

import SymbolDisplay from '@/components/game/SymbolDisplay';
import SymbolAcquisitionModal from '@/components/game/SymbolAcquisitionModal';
import DeckEditModal from '@/components/game/DeckEditModal';
import RelicSelectionModal from '@/components/game/RelicSelectionModal';
import GameOverModal from '@/components/game/GameOverModal';

const getInitialDeck = (): DeckSymbol[] => {
  const commonSymbols = allSymbolsData.filter(symbol => symbol.rarity === 'Common');
  const initialDeck: DeckSymbol[] = [];
  const deckSize = 15;
  if (commonSymbols.length === 0) {
    console.error("No common symbols found to create an initial deck!");
    return [];
  }
  for (let i = 0; i < deckSize; i++) {
    const randomIndex = Math.floor(Math.random() * commonSymbols.length);
    initialDeck.push({
      ...commonSymbols[randomIndex],
      instanceId: uuidv4(),
    });
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
  const [currentDeck, setCurrentDeck] = useState<DeckSymbol[]>(getInitialDeck());
  const [boardSymbols, setBoardSymbols] = useState<BoardSymbolBase[]>(Array(9).fill(null));
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
  const [activeDebuffs, setActiveDebuffs] = useState<Debuff[]>([]);
  const [showWarningTelop, setShowWarningTelop] = useState(false);
  const [oneTimeSpinCostModifier, setOneTimeSpinCostModifier] = useState<number>(1);
  const [currentRareSymbolBonus, setCurrentRareSymbolBonus] = useState<number>(0);

  const [persistingSymbols, setPersistingSymbols] = useState<PersistingSymbolInfo[]>([]);
  const [respinState, setRespinState] = useState<RespinState | null>(null);
  const [nextSpinEffects, setNextSpinEffects] = useState<NextSpinEffects>({ transformToWildCount: 0, symbolPreview: null });
  const [rustedLumpProgress, setRustedLumpProgress] = useState<RustedLumpProgress>({});
  const [pendingEnemyNotification, setPendingEnemyNotification] = useState<EnemyData | null>(null);


  const initializeGameState = useCallback(() => {
    setMedals(100); setSpinCount(0); setCurrentDeck(getInitialDeck());
    setBoardSymbols(Array(9).fill(null)); setSpinCost(10); setLineMessage("");
    setGameMessage("Game Started! Good luck!"); setHighlightedLine(null); setIsGameOver(false);
    setIsSymbolAcquisitionPhase(false); setSymbolChoices([]); setIsDeckEditModalOpen(false);
    setSymbolDeleteTickets(0); setAcquiredRelics([]); setIsRelicSelectionPhase(false);
    setRelicChoices([]); setNextCostIncreaseIn(5); setCurrentEnemy(null); setEnemyHP(0);
    setNextEnemyIn(10); setActiveDebuffs([]); setShowWarningTelop(false);
    setOneTimeSpinCostModifier(1); setCurrentRareSymbolBonus(0);
    setPersistingSymbols([]);
    setRespinState(null);
    setNextSpinEffects({ transformToWildCount: 0, symbolPreview: null });
    setRustedLumpProgress({});
    setPendingEnemyNotification(null);
  }, []);

  useEffect(() => {
    initializeGameState();
  }, [initializeGameState]);

  const calculateNewSpinCost = useCallback((currentSpinCountForCalc: number, baseCost: number): number => {
    const coefficientA = 0.3;
    if (currentSpinCountForCalc <= 0) return baseCost;
    const cost = baseCost + Math.floor(Math.pow(currentSpinCountForCalc, 1.2) * coefficientA);
    return Math.max(baseCost, Math.round(cost / 5) * 5);
  }, []);

  const applyEnemyDebuffsAndGetInfoForManager = useCallback((): { debuffMessages: string[], debuffsAppliedThisTurn: Debuff[] } => {
    const debuffsAppliedThisTurn: Debuff[] = [];
    if (!currentEnemy || isGameOver) return { debuffMessages: [], debuffsAppliedThisTurn };
    const messages: string[] = [];
    if (currentEnemy.name === "コスト・インフレーター (Cost Inflater)") {
      const existingDebuff = activeDebuffs.find(d => d.type === "CostIncrease" && d.originEnemy === currentEnemy.name);
      const newDebuffEntry: Debuff = { type: "CostIncrease", duration: 3, value: 0.1, originEnemy: currentEnemy.name };
      if (!existingDebuff) {
        debuffsAppliedThisTurn.push(newDebuffEntry);
        messages.push(`${currentEnemy.name} inflates spin cost for 3 turns!`);
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

  const triggerGameOverHandler = useCallback((message: string) => {
    if (!isGameOver) {
        setGameMessage(message);
        setIsGameOver(true);
        playSound('gameOver');
    }
  }, [isGameOver]);

  const startSymbolAcquisition = useCallback((rareBonus: number = 0) => {
      if (isGameOver || isSymbolAcquisitionPhase || isRelicSelectionPhase) return;
      const choicesArr: SymbolData[] = []; const numChoices = 3;
      const baseProbs = { common: 70, uncommon: 25, rare: 5 };
      const probIncreaseFactor = 0.1;
      const spinBasedRareIncrease = Math.min(20, spinCount * 0.03 * probIncreaseFactor * 100);
      const spinBasedUncommonIncrease = Math.min(30, spinCount * 0.07 * probIncreaseFactor * 100);
      let actualRareProb = baseProbs.rare + spinBasedRareIncrease + rareBonus;
      let actualUncommonProb = baseProbs.uncommon + spinBasedUncommonIncrease;
      const totalAllocatedToRareUncommonVal = actualRareProb + actualUncommonProb;
      if (totalAllocatedToRareUncommonVal > 90) {
          const excess = totalAllocatedToRareUncommonVal - 90;
          if (actualRareProb + actualUncommonProb > 0) {
              const rareReduction = (actualRareProb / (actualRareProb + actualUncommonProb)) * excess;
              const uncommonReduction = (actualUncommonProb / (actualRareProb + actualUncommonProb)) * excess;
              actualRareProb -= rareReduction;
              actualUncommonProb -= uncommonReduction;
          }
      }
      actualRareProb = Math.max(0, Math.min(100, actualRareProb));
      actualUncommonProb = Math.max(0, Math.min(100 - actualRareProb, actualUncommonProb));
      const actualCommonProbVal = Math.max(0, 100 - actualRareProb - actualUncommonProb);
      console.log(`Rarity Probs (Bonus: ${rareBonus}%): C:${actualCommonProbVal.toFixed(2)}% U:${actualUncommonProb.toFixed(2)}% R:${actualRareProb.toFixed(2)}% (Spin: ${spinCount})`);
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
  }, [spinCount, isGameOver, isSymbolAcquisitionPhase, isRelicSelectionPhase]);

  const processPendingNotifications = useCallback(() => {
    if (pendingEnemyNotification) {
        setGameMessage(prev => (prev ? prev + " | " : "") + `Enemy Appeared: ${pendingEnemyNotification.name}!`);
        setShowWarningTelop(true);
        setTimeout(() => setShowWarningTelop(false), 2500);
        setPendingEnemyNotification(null);
    }
  }, [pendingEnemyNotification /*, setGameMessage, setShowWarningTelop, setPendingEnemyNotification - these setters don't need to be deps */]);


  const handleTurnResolution = useCallback((currentSpinCountForCheck: number) => {
    if (isGameOver) return;
    let turnEndMessage = "";

    if (currentSpinCountForCheck > 0 && currentSpinCountForCheck % 5 === 0) {
        const newCalculatedCost = calculateNewSpinCost(currentSpinCountForCheck, 10);
        setSpinCost(Math.max(1, Math.round(newCalculatedCost * oneTimeSpinCostModifier)));
        setOneTimeSpinCostModifier(1);
        setNextCostIncreaseIn(5);
        turnEndMessage += (turnEndMessage ? " | " : "") + "Spin cost increased!";
    } else {
        setNextCostIncreaseIn(prev => Math.max(0, prev - 1));
    }

    let enemyShouldAppear = false;
    if (currentSpinCountForCheck > 0 && currentSpinCountForCheck % 10 === 0 && !currentEnemy) {
        enemyShouldAppear = true;
    }

    if (enemyShouldAppear) {
        const enemyIdx = Math.floor(Math.random() * allEnemiesData.length);
        const newE = allEnemiesData[enemyIdx];
        setCurrentEnemy(newE);
        const baseHp = (spinCost * 8) + (currentSpinCountForCheck * 2);
        setEnemyHP(Math.max(50, Math.floor(baseHp * newE.hpMultiplier)));
        setNextEnemyIn(10);
        setPendingEnemyNotification(newE); // Defer notification
    } else if (!currentEnemy) {
        setNextEnemyIn(prev => Math.max(0, prev - 1));
    }

    let shouldStartRelicPhase = false;
    if (currentSpinCountForCheck > 0 && currentSpinCountForCheck % 5 === 0) {
        const unacquiredR = allRelicsData.filter(r => !acquiredRelics.find(ar => ar.no === r.no));
        if (unacquiredR.length > 0) {
            shouldStartRelicPhase = true;
        } else {
            turnEndMessage += (turnEndMessage ? " | " : "") + "All relics acquired!";
        }
    }

    if (shouldStartRelicPhase) {
        const choicesR: RelicData[] = [];
        const unacquiredR = allRelicsData.filter(r => !acquiredRelics.find(ar => ar.no === r.no));
        const pickedIndicesR = new Set<number>();
        const numToPickR = Math.min(3, unacquiredR.length);
        let attemptsR = 0;
        while (choicesR.length < numToPickR && pickedIndicesR.size < unacquiredR.length && attemptsR < allRelicsData.length * 2) {
            const randomIdxR = Math.floor(Math.random() * unacquiredR.length);
            if (!pickedIndicesR.has(randomIdxR)) { choicesR.push(unacquiredR[randomIdxR]); pickedIndicesR.add(randomIdxR); }
            attemptsR++;
        }
        if (choicesR.length > 0) {
            setRelicChoices(choicesR);
            setIsRelicSelectionPhase(true);
        } else { // No relics to choose, but it was a relic turn
            processPendingNotifications(); // Check for pending enemy before symbol acquisition
            startSymbolAcquisition(currentRareSymbolBonus);
        }
    } else { // Not a relic phase
        processPendingNotifications(); // Check for pending enemy before symbol acquisition
        startSymbolAcquisition(currentRareSymbolBonus);
    }

    setCurrentRareSymbolBonus(0);
    if (turnEndMessage) {
        setGameMessage(prev => (prev ? prev + " | " : "") + turnEndMessage.trim());
    }
  }, [
    isGameOver, calculateNewSpinCost, oneTimeSpinCostModifier, acquiredRelics,
    currentEnemy, spinCost, startSymbolAcquisition, currentRareSymbolBonus, processPendingNotifications
    // setPendingEnemyNotification, setCurrentEnemy, setEnemyHP, setNextEnemyIn, setIsRelicSelectionPhase, setRelicChoices, setGameMessage
  ]);


  const handleSymbolSelected = (selectedSymbol: SymbolData) => {
    setCurrentDeck(prevDeck => [...prevDeck, { ...selectedSymbol, instanceId: uuidv4() }]);
    setIsSymbolAcquisitionPhase(false);
    setSymbolChoices([]);
    playSound('select');
    processPendingNotifications();
  };
  const handleSymbolSkipped = () => {
    setIsSymbolAcquisitionPhase(false);
    setSymbolChoices([]);
    playSound('skip');
    processPendingNotifications();
  };

  const handleRelicSelected = (selectedRelic: RelicData) => {
    setAcquiredRelics(prevRelics => [...prevRelics, selectedRelic]);
    setIsRelicSelectionPhase(false);
    setRelicChoices([]);
    playSound('select');
    processPendingNotifications();
    startSymbolAcquisition(currentRareSymbolBonus);
  };

  const handleDeleteSymbol = (symbolIndexInDeck: number) => {
    if(symbolDeleteTickets > 0){
      setCurrentDeck(prevDeck => prevDeck.filter((_, i) => i !== symbolIndexInDeck));
      setSymbolDeleteTickets(prevTickets => prevTickets - 1);
      setGameMessage("Symbol removed from deck.");
      playSound('delete');
    }
  };


  const handleSpin = () => {
    if (respinState?.active) {
        playSound('error'); setGameMessage("Respin in progress or queued!"); return;
    }
    if (isSymbolAcquisitionPhase || isRelicSelectionPhase || isDeckEditModalOpen) {
        playSound('error'); setGameMessage("Please complete current action first!"); return;
    }

    const gameState: GameState = {
      medals, spinCost, currentDeck, currentRareSymbolBonus, oneTimeSpinCostModifier,
      spinCount, nextCostIncreaseIn, nextEnemyIn, currentEnemy, enemyHP,
      acquiredRelics, activeDebuffs, persistingSymbols,
      isGameOver, isSymbolAcquisitionPhase, isRelicSelectionPhase, isDeckEditModalOpen,
      respinState, nextSpinEffects, rustedLumpProgress, boardSymbols,
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
      startRelicSelectionPhase: () => { if (!isGameOver) setIsRelicSelectionPhase(true); },
      setRespinState, setNextSpinEffects, setRustedLumpProgress,
    };
    processSpin(gameState, setters, playSound, applyEnemyDebuffsAndGetInfoForManager, handleEnemyDefeatForManager, handleTurnResolution);
  };

  useEffect(() => {
    const currentActualCost = Math.max(1, Math.round(spinCost * oneTimeSpinCostModifier));
    if (!isGameOver && spinCount > 0) {
        if (medals < currentActualCost) { triggerGameOverHandler("Not enough medals! GAME OVER!"); }
        else if (currentDeck.length === 0) { triggerGameOverHandler("Deck is empty! GAME OVER!"); }
    }
  }, [medals, spinCost, currentDeck.length, spinCount, isGameOver, oneTimeSpinCostModifier, triggerGameOverHandler]);

  const handleRestartGame = () => { window.location.reload(); };

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
          <div className="text-center">EnemyIn: <span className="font-bold">{nextEnemyIn === 0 && !currentEnemy && !pendingEnemyNotification ? 'Now!' : (currentEnemy || pendingEnemyNotification ? 'Active!' : nextEnemyIn)}</span></div>
          <div className="text-center">Tickets: <span className="font-bold text-green-400">{symbolDeleteTickets}</span></div>
          {currentRareSymbolBonus > 0 && !isSymbolAcquisitionPhase && !isRelicSelectionPhase && <div className="text-center md:col-span-1 text-purple-400">Rare+: {currentRareSymbolBonus.toFixed(0)}%</div>}
        </div>
        {currentEnemy && !isGameOver && (
          <div className="mt-2 p-2 md:p-3 bg-red-800 bg-opacity-70 rounded-lg text-center shadow-md">
            <h3 className="text-md md:text-lg font-bold text-red-300">{currentEnemy.name}</h3>
            <p className="text-sm md:text-md text-red-100">HP: <AnimatedNumber targetValue={enemyHP} /> </p>
            <p className="text-xs text-red-200 mt-1 italic">Effect: {currentEnemy.debuffEffectText}</p>
          </div>
        )}
        {activeDebuffs.length > 0 && !isGameOver && (
            <div className="mt-2 p-2 bg-purple-900 bg-opacity-70 rounded-lg text-xs text-purple-200 shadow">
                Active Debuffs: {activeDebuffs.map(d => `${d.type}${d.value ? `(${d.value})` : ''} - ${d.duration} turns left`).join(', ')}
            </div>
        )}
      </header>

      {nextSpinEffects.symbolPreview && nextSpinEffects.symbolPreview.length > 0 && !isGameOver && (
        <div className="my-2 p-2 bg-purple-700 rounded text-center text-xs md:text-sm text-purple-100 shadow">
          Next Spin Preview: {nextSpinEffects.symbolPreview.map(s => s.name.split(' ')[0]).join(', ')}
        </div>
      )}

      <main className="w-full max-w-xs sm:max-w-sm md:max-w-md mb-4 flex-shrink-0">
        <div className="grid grid-cols-3 gap-1 md:gap-2 p-1 md:p-2 bg-gray-700 rounded-lg shadow-inner">
          {boardSymbols.map((symbol, i) => (
            <div key={`${i}-${symbol?.instanceId || 'empty'}`} className={`transition-all duration-200 ease-in-out transform ${ highlightedLine && highlightedLine.includes(i) ? 'ring-4 ring-yellow-400 scale-105 z-10 shadow-lg' : 'ring-transparent' }`}>
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
            onClick={handleSpin}
            disabled={isGameOver || isSymbolAcquisitionPhase || isRelicSelectionPhase || isDeckEditModalOpen || currentDeck.length === 0 || medals < Math.max(1, Math.round(spinCost * oneTimeSpinCostModifier)) || (respinState?.active ?? false)}
            className="px-6 md:px-10 py-3 md:py-4 bg-green-600 hover:bg-green-700 text-white text-lg md:text-xl font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 active:bg-green-800">
            SPIN!
          </button>
          <button onClick={() => { playSound('click'); if (!isGameOver && !isDeckEditModalOpen) setIsDeckEditModalOpen(true); }} disabled={isGameOver || isSymbolAcquisitionPhase || isRelicSelectionPhase || isDeckEditModalOpen}
            className="px-4 md:px-8 py-3 md:py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg md:text-xl font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 active:bg-blue-800">
            DECK
          </button>
        </div>
      </footer>
      <SymbolAcquisitionModal isOpen={isSymbolAcquisitionPhase} choices={symbolChoices} onSelect={handleSymbolSelected} onSkip={handleSymbolSkipped} />
      <DeckEditModal isOpen={isDeckEditModalOpen} deck={currentDeck} tickets={symbolDeleteTickets} onClose={() => { playSound('close'); setIsDeckEditModalOpen(false); processPendingNotifications();}} onDeleteSymbol={handleDeleteSymbol} />
      <RelicSelectionModal isOpen={isRelicSelectionPhase} choices={relicChoices} onSelect={handleRelicSelected} />
      <GameOverModal isOpen={isGameOver} score={spinCount} onRestart={() => { playSound('click'); handleRestartGame(); }} />
    </div>
  );
}