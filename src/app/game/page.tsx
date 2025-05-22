// src/app/game/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SymbolData, SymbolRarity, RelicData, EnemyData } from '@/types/kigaslot';
import type { BoardSymbol } from '@/app/game/symbollogic'; 
import { symbols as allSymbols } from '@/data/symbols';
import { relics as allRelics } from '@/data/relics';
import { enemies as allEnemies } from '@/data/enemies';

import {
  applyAdjacentBonusesLogic,
  checkLinesAndApplyEffects,
  handleBombExplosionsLogic,
} from './symbollogic';

import SymbolDisplay from '@/components/game/SymbolDisplay';
import SymbolAcquisitionModal from '@/components/game/SymbolAcquisitionModal';
import DeckEditModal from '@/components/game/DeckEditModal';
import RelicSelectionModal from '@/components/game/RelicSelectionModal';
import GameOverModal from '@/components/game/GameOverModal';

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

  const handleTurnResolution = (currentSpinCountForCheck: number) => {
    let currentGeneralMessage = ""; // Use this to build messages for this turn resolution
    let proceedToSymbolOrEnemy = true;

    if (currentSpinCountForCheck > 0 && currentSpinCountForCheck % 5 === 0) {
        const newC = calculateNewSpinCost(currentSpinCountForCheck, 10);
        setSpinCost(Math.max(1, Math.round(newC * oneTimeSpinCostModifier)));
        setOneTimeSpinCostModifier(1); // Reset modifier after applying
        setNextCostIncreaseIn(5);

        const choicesR: RelicData[] = []; 
        const unacquiredR = allRelics.filter(r => !acquiredRelics.find(ar => ar.no === r.no));
        const pIR = new Set<number>(); 
        const numToPickR = Math.min(3,unacquiredR.length); 
        let attR = 0;
        while (choicesR.length < numToPickR && pIR.size < unacquiredR.length && attR < allRelics.length * 2) {
            const rIR = Math.floor(Math.random()*unacquiredR.length); 
            if (!pIR.has(rIR)) { choicesR.push(unacquiredR[rIR]); pIR.add(rIR); } 
            attR++;
        }
        if (choicesR.length > 0) {
            setRelicChoices(choicesR); 
            setIsRelicSelectionPhase(true);
            proceedToSymbolOrEnemy = false; 
        } else {
            currentGeneralMessage += (currentGeneralMessage ? " | " : "") + (unacquiredR.length === 0 ? "All relics acquired!" : "No new relics for now.");
        }
    }

    if (proceedToSymbolOrEnemy) {
        const enemyAppeared = !resolveEnemyEncounter(currentSpinCountForCheck); // true if new enemy
        if (enemyAppeared) {
             // Enemy message is set by resolveEnemyEncounter
        }
        startSymbolAcquisition(currentRareSymbolBonus); 
    }
    setCurrentRareSymbolBonus(0); // Reset rare bonus after it's been used for this turn's acquisition
    if (currentGeneralMessage) setGameMessage(prev => (prev ? prev + " | " : "") + currentGeneralMessage);
  };
  
  const resolveEnemyEncounter = (currentSpinCountForCheck: number): boolean => { 
    if (currentSpinCountForCheck > 0 && currentSpinCountForCheck % 10 === 0 && !currentEnemy) {
        const enemyIdx = Math.floor(Math.random()*allEnemies.length); 
        const newE = allEnemies[enemyIdx]; 
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
  };

  const startSymbolAcquisition = (rareBonusPercentage: number = 0) => { 
    const choicesArr: SymbolData[] = []; const numChoices = 3;
    const baseProbs = { common: 70, uncommon: 25, rare: 5 };
    const probIncreaseFactor = 0.1; 
    const rareIncrease = Math.min(20, spinCount * 0.03 * probIncreaseFactor * 100); 
    const uncommonIncrease = Math.min(30, spinCount * 0.07 * probIncreaseFactor * 100); 
    
    let actualRareProb = baseProbs.rare + rareIncrease + rareBonusPercentage; 
    let actualUncommonProb = baseProbs.uncommon + uncommonIncrease;
    
    let totalAllocatedToRareUncommon = actualRareProb + actualUncommonProb;
    if (totalAllocatedToRareUncommon > 90) { 
        const excess = totalAllocatedToRareUncommon - 90;
        if (actualRareProb + actualUncommonProb > 0) { // Avoid division by zero
            const rareReduction = (actualRareProb / totalAllocatedToRareUncommon) * excess;
            const uncommonReduction = (actualUncommonProb / totalAllocatedToRareUncommon) * excess;
            actualRareProb -= rareReduction;
            actualUncommonProb -= uncommonReduction;
        } else { // if both somehow became 0 or negative before bonus
            actualRareProb = Math.max(0, actualRareProb);
            actualUncommonProb = Math.max(0, actualUncommonProb);
        }
    }
    actualRareProb = Math.max(0, Math.min(100, actualRareProb)); 
    actualUncommonProb = Math.max(0, Math.min(100 - actualRareProb, actualUncommonProb));
    let actualCommonProb = 100 - actualRareProb - actualUncommonProb;
    actualCommonProb = Math.max(0, actualCommonProb); 

    console.log(`Rarity Probs (Bonus: ${rareBonusPercentage}%): C:${actualCommonProb.toFixed(2)}% U:${actualUncommonProb.toFixed(2)}% R:${actualRareProb.toFixed(2)}% (Spin: ${spinCount})`);

    for (let i=0; i<numChoices; i++) {
      const rand = Math.random()*100;
      let rarity: SymbolRarity;
      if (rand < actualRareProb) rarity = 'Rare';
      else if (rand < actualRareProb + actualUncommonProb) rarity = 'Uncommon';
      else rarity = 'Common';
      
      let availableSyms = allSymbols.filter(s=>s.rarity===rarity);
      if(availableSyms.length===0){ if(rarity!=='Common'){availableSyms=allSymbols.filter(s=>s.rarity==='Common');} }
      if(availableSyms.length===0){ continue; }
      choicesArr.push(availableSyms[Math.floor(Math.random()*availableSyms.length)]);
    }

    if (choicesArr.length > 0) { setSymbolChoices(choicesArr.filter(Boolean)); setIsSymbolAcquisitionPhase(true); }
    else { 
        setIsSymbolAcquisitionPhase(false); 
        setGameMessage(prev => (prev ? prev + " | " : "") + "No symbols to choose this time.");
        // Since symbol acquisition is the typical end of a turn's resolution before next spin,
        // if it fails, and no relic phase, the turn effectively ends.
        // handleTurnResolution might have already set a game message if no relics.
    }
  };

  const handleSymbolSelected = (s: SymbolData) => {
    setCurrentDeck(p=>[...p,s]); 
    setIsSymbolAcquisitionPhase(false); 
    setSymbolChoices([]); 
    // Previously handleTurnResolution was here. Now it's called at the end of handleSpin more broadly
    // or when skipping relic selection. If symbol selection is the *very last* step of a turn cycle,
    // then no further calls needed here.
  };
  const handleSymbolSkipped = () => {
    setIsSymbolAcquisitionPhase(false); 
    setSymbolChoices([]); 
    // As above, if this is the last step.
  };
  const handleRelicSelected = (r: RelicData) => {
    setAcquiredRelics(p=>[...p,r]); 
    setIsRelicSelectionPhase(false); 
    setRelicChoices([]); 
    // After relic selection, proceed to enemy check then symbol acquisition
    const enemyAppeared = !resolveEnemyEncounter(spinCount);
    startSymbolAcquisition(currentRareSymbolBonus); 
  };
  const handleDeleteSymbol = (idx: number) => {if(symbolDeleteTickets>0){setCurrentDeck(p=>p.filter((_,i)=>i!==idx));setSymbolDeleteTickets(p=>p-1);setGameMessage("Symbol removed.");}};
  const dealDamageToEnemy = (dmg: number) => {if(!currentEnemy)return; const newH=Math.max(0,enemyHP-dmg); setEnemyHP(newH); if(newH<=0){setGameMessage(prev => (prev ? prev + " | " : "") +`Defeated ${currentEnemy.name}! +1 Ticket!`);setCurrentEnemy(null);setEnemyHP(0);setSymbolDeleteTickets(p=>p+1); setActiveDebuffs(prevDebuffs => prevDebuffs.filter(d => d.originEnemy !== currentEnemy.name));}};
  
  const applyInstantDebuffsAndSetPersistentFlags = (): { boardMutated: boolean, costMultiplierFromDebuff: number, debuffMessages: string[], debuffsApplied: typeof activeDebuffs } => {
    let debuffsAppliedThisTurn: typeof activeDebuffs = [];
    if (!currentEnemy || isGameOver) return { boardMutated: false, costMultiplierFromDebuff: 1, debuffMessages: [], debuffsApplied: debuffsAppliedThisTurn };
    
    const boardChanged = false; 
    let costMultiplier = 1;
    const messages: string[] = [];

    if (currentEnemy.name === "コスト・インフレーター (Cost Inflater)") {
      const existingDebuff = activeDebuffs.find(d => d.type === "CostIncrease" && d.originEnemy === currentEnemy.name);
      const newDebuffEntry = { type: "CostIncrease" as const, duration: 3, value: 0.1, originEnemy: currentEnemy.name };
      if (!existingDebuff) {
        // This state update should ideally happen after the spin, not during calculations.
        // For now, we'll collect what *would* be applied.
        debuffsAppliedThisTurn.push(newDebuffEntry);
        messages.push(`${currentEnemy.name} inflates spin cost for 3 turns!`);
        costMultiplier = 1.1;
      } else if (existingDebuff.duration > 0) {
        costMultiplier = 1 + (existingDebuff.value || 0);
        messages.push(`Spin cost increased by ${currentEnemy.name}! (${existingDebuff.duration} turns left)`);
      }
    }
    // Any other instant debuffs would be processed here.
    return { boardMutated: boardChanged, costMultiplierFromDebuff: costMultiplier, debuffMessages: messages, debuffsApplied: debuffsAppliedThisTurn };
  };

  const handleSpin = () => {
    const currentActualSpinCost = Math.max(1, Math.round(spinCost * oneTimeSpinCostModifier));
    if (isGameOver || medals < currentActualSpinCost || currentDeck.length === 0 || isSymbolAcquisitionPhase || isRelicSelectionPhase || isDeckEditModalOpen) return;
    
    playSound('spin'); 
    setHighlightedLine(null); 
    setMedals(prev => prev - currentActualSpinCost);
    
    let spinEventMessage = ""; // Messages specific to this spin's events (cost reduction, items etc.)
    if (oneTimeSpinCostModifier !== 1) {
        spinEventMessage += (spinEventMessage ? " | " : "") + "Shield reduced cost!";
        setOneTimeSpinCostModifier(1); 
    }

    const nextSpinCount = spinCount + 1; setSpinCount(nextSpinCount);
    setLineMessage(""); // For symbol line results
    setGameMessage("");   // For general game status updates after spin

    // Manage persisting symbols: decrement duration, use for current board, then update state
    const nextPersistingSymbolsForThisSpin = persistingSymbols
        .map(ps => ({ ...ps, duration: ps.duration - 1 }))
        .filter(ps => ps.duration >= 0); // Keep if duration is 0 for this spin, remove after

    // Update activeDebuffs duration
    let updatedActiveDebuffs = activeDebuffs.map(d => ({ ...d, duration: d.duration - 1 })).filter(d => d.duration > 0);
    // Debuffs from current enemy will be added after this if not prevented

    // Board Generation with persisting symbols
    let initialBoardSymbols: BoardSymbol[] = Array(9).fill(null);
    const occupiedIndices = new Set<number>();
    nextPersistingSymbolsForThisSpin.forEach(ps => {
        if (ps.duration >=0) { // Use if duration is 0 (last spin), will be removed after
             initialBoardSymbols[ps.index] = ps.symbol;
             occupiedIndices.add(ps.index);
        }
    });
    for (let i = 0; i < 9; i++) {
        if (!occupiedIndices.has(i)) {
            if (currentDeck.length > 0) {
                initialBoardSymbols[i] = currentDeck[Math.floor(Math.random() * currentDeck.length)];
            } else {
                // Should be caught by game over check, but as a safeguard
                initialBoardSymbols[i] = null; 
            }
        }
    }
    
    let boardForProcessing: BoardSymbol[] = [...initialBoardSymbols];
    let totalGainedThisSpin = 0; 
    let combinedEffectMessage = spinEventMessage; 

    // --- Phase 0: Adjacent Bonus ---
    const abResult = applyAdjacentBonusesLogic(boardForProcessing); 
    if (abResult.gainedMedals > 0) { 
        setMedals(p => p + abResult.gainedMedals); 
        totalGainedThisSpin += abResult.gainedMedals; 
        combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + abResult.message; 
        playSound('medal'); 
    }
    if (abResult.rareSymbolAppearanceModifier) {
        setCurrentRareSymbolBonus(prev => Math.min(5, prev + abResult.rareSymbolAppearanceModifier!)); 
        combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + `Rare chance up by ${abResult.rareSymbolAppearanceModifier}%!`;
    }
    
    let newPersistingSymbolsFromAB: typeof persistingSymbols = [];
    if (abResult.symbolsToPersist) {
        newPersistingSymbolsFromAB = abResult.symbolsToPersist;
        // This will be combined with existing persisting symbols *after* this spin.
    }


    let dynamicBoardForLines: any[] = boardForProcessing.map(s => s ? {...s} : null);
    if (abResult.boardMutations) { 
      abResult.boardMutations.forEach(mutation => {
        if (dynamicBoardForLines[mutation.index]) {
          dynamicBoardForLines[mutation.index] = { ...dynamicBoardForLines[mutation.index], ...mutation.changes };
        }
      });
    }
    
    // --- Phase 1: Enemy Debuff Application ---
    let enemyDebuffsPreventedByBuckler = false;
    let debuffsToApplyFromEnemy: typeof activeDebuffs = [];

    const debuffApplicationResult = applyInstantDebuffsAndSetPersistentFlags();
    debuffsToApplyFromEnemy = debuffApplicationResult.debuffsApplied; // Debuffs that *would* be applied
    
    // Pre-check for Buckler to prevent Slot Goblin board change
    // This is a temporary, simplified check. A full system would be more integrated.
    let preCheckBucklerActive = false;
    if (currentEnemy?.name === "スロット・ゴブリン (Slot Goblin)") {
        const tempLineCheck = checkLinesAndApplyEffects(dynamicBoardForLines, acquiredRelics, currentDeck, allSymbols, debuffsToApplyFromEnemy);
        if (tempLineCheck.debuffsPreventedThisSpin) {
            preCheckBucklerActive = true;
        }
    }

    if (currentEnemy && !preCheckBucklerActive) { // If Buckler isn't going to prevent it (specifically for board change)
        if (currentEnemy.name === "スロット・ゴブリン (Slot Goblin)" && !isGameOver) {
            const cursedMask = allSymbols.find(s => s.name === "呪いの仮面 (Cursed Mask)");
            if (cursedMask && dynamicBoardForLines.some(s=>s!==null)) { 
                let rIdx = -1, att = 0; 
                while(att<20){ const tIdx=Math.floor(Math.random()*9); if(dynamicBoardForLines[tIdx]!==null){rIdx=tIdx;break;} att++;}
                if (rIdx !== -1 && dynamicBoardForLines[rIdx]) { 
                    combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + `Goblin changed ${dynamicBoardForLines[rIdx]!.name.split(' ')[0]} to Cursed Mask!`; 
                    dynamicBoardForLines[rIdx] = cursedMask; 
                }
            }
        }
    } else if (currentEnemy && preCheckBucklerActive && currentEnemy.name === "スロット・ゴブリン (Slot Goblin)") {
        combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + "Buckler prevents Goblin's trick!";
        enemyDebuffsPreventedByBuckler = true; // Mark that a specific prevention happened
    }
    // Apply other (non-board changing) debuffs from enemy to activeDebuffs state
    updatedActiveDebuffs = [...updatedActiveDebuffs, ...debuffsToApplyFromEnemy.filter(d => d.type !== "SlotGoblinCurse" || !enemyDebuffsPreventedByBuckler)];
    setActiveDebuffs(updatedActiveDebuffs);
    debuffApplicationResult.debuffMessages.forEach(msg => combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + msg);


    // --- Phase 2: Line Checks & Line-based Effects ---
    const lineCheckResults = checkLinesAndApplyEffects(
        dynamicBoardForLines, 
        acquiredRelics,
        currentDeck,
        allSymbols,
        updatedActiveDebuffs // Pass the current state of debuffs for Buckler to check against
    );

    let { 
        gainedMedals: lineGainedMedals, message: linesMessage, formedLinesIndices, bombsToExplode,
        itemsAwarded, newSymbolsOnBoardPostEffect, nextSpinCostModifier, symbolsToRemoveFromBoard, 
        debuffsPreventedThisSpin, symbolsToAddToDeck, symbolsToRemoveFromDeckByName, additionalMedalsFromRG
    } = lineCheckResults;

    if (debuffsPreventedThisSpin && !enemyDebuffsPreventedByBuckler) { 
        combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + "Buckler's protection active!";
        // If Buckler prevents a debuff that was ALREADY APPLIED to activeDebuffs, we might need to remove it.
        // This part is complex. For now, message is the main outcome.
    }

    if (lineGainedMedals > 0) { setMedals(p => p + lineGainedMedals); totalGainedThisSpin += lineGainedMedals; playSound('lineWin'); if (formedLinesIndices && formedLinesIndices.length > 0) { setHighlightedLine(formedLinesIndices[0]); setTimeout(() => setHighlightedLine(null), 800); }}
    if (additionalMedalsFromRG) { setMedals(p => p + additionalMedalsFromRG); totalGainedThisSpin += additionalMedalsFromRG; }
    if (linesMessage && linesMessage !== "No lines or no medal effects." && linesMessage !== "No lines/effects.") { combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + linesMessage; }

    // Deck modifications
    let deckChanged = false;
    let tempDeck = [...currentDeck];
    if (symbolsToAddToDeck) {
        symbolsToAddToDeck.forEach(symbolToAdd => {
            const existingCurses = tempDeck.filter(s => s.name === "呪いの仮面 (Cursed Mask)").length;
            if (symbolToAdd.name === "呪いの仮面 (Cursed Mask)") {
                if (existingCurses < 3) { tempDeck.push(symbolToAdd); combinedEffectMessage += ` | Curse Mask added!`; deckChanged = true; }
            } else { tempDeck.push(symbolToAdd); deckChanged = true; }
        });
    }
    if (symbolsToRemoveFromDeckByName) {
        symbolsToRemoveFromDeckByName.forEach(nameToRemove => {
            const initialLength = tempDeck.length;
            tempDeck = tempDeck.filter(s => s.name !== nameToRemove);
            if (tempDeck.length < initialLength) { combinedEffectMessage += ` | ${nameToRemove} removed from deck!`; deckChanged = true;}
        });
    }
    if (deckChanged) setCurrentDeck(tempDeck);


    let boardStateAfterLines = [...dynamicBoardForLines];
    if (symbolsToRemoveFromBoard) { symbolsToRemoveFromBoard.forEach(index => { if (boardStateAfterLines[index]) { combinedEffectMessage += ` | ${boardStateAfterLines[index]!.name.split(' ')[0]} hunted!`; boardStateAfterLines[index] = null; }});}
    if (newSymbolsOnBoardPostEffect) { newSymbolsOnBoardPostEffect.forEach(effect => { boardStateAfterLines[effect.index] = effect.symbolData; combinedEffectMessage += ` | ${effect.symbolData.name.split(' ')[0]} appears!`; });}
    
    // --- Phase 3: Bomb Explosions ---
    let boardStateAfterBombs = [...boardStateAfterLines];
    if (bombsToExplode && bombsToExplode.length > 0) {
      playSound('bomb');
      const bombRes = handleBombExplosionsLogic(bombsToExplode, boardStateAfterLines );
      if (bombRes.gainedMedals > 0) { setMedals(p => p + bombRes.gainedMedals); totalGainedThisSpin += bombRes.gainedMedals; playSound('medal');}
      boardStateAfterBombs = bombRes.newBoard; 
      if (bombRes.message) { combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + bombRes.message;}
    }
    
    // --- Phase 4: Apply total spin medal modifiers from AB ---
    let finalTotalGainedThisSpin = totalGainedThisSpin;
    if (abResult.totalSpinMedalFlatBonus) { finalTotalGainedThisSpin += abResult.totalSpinMedalFlatBonus; combinedEffectMessage += ` | Chain Total: +${abResult.totalSpinMedalFlatBonus}`; }
    if (abResult.totalSpinMedalMultiplier && abResult.totalSpinMedalMultiplier > 1) { finalTotalGainedThisSpin = Math.floor(finalTotalGainedThisSpin * abResult.totalSpinMedalMultiplier); combinedEffectMessage += ` | Vine Total: x${abResult.totalSpinMedalMultiplier.toFixed(2)}`;}
    totalGainedThisSpin = finalTotalGainedThisSpin;


    setBoardSymbols(boardStateAfterBombs.map(s => s ? { no: s.no, name: s.name, attribute: s.attribute, rarity: s.rarity, effectSystem: s.effectSystem, effectText: s.effectText, flavorText: s.flavorText } : null)); 
    setLineMessage(combinedEffectMessage.trim().replace(/^ \| /, '') || "No bonuses or lines."); // Clean up leading separators
    
    // Update persisting symbols state for the *next* spin based on this spin's AB results
    const finalPersistingForNextSpin = nextPersistingSymbolsForThisSpin.filter(ps => ps.duration > 0); // Remove those that just expired
    newPersistingSymbolsFromAB.forEach(newP => {
        const existingIdx = finalPersistingForNextSpin.findIndex(p => p.index === newP.index);
        if (existingIdx !== -1) finalPersistingForNextSpin.splice(existingIdx, 1); // Replace if same spot
        finalPersistingForNextSpin.push(newP);
    });
    setPersistingSymbols(finalPersistingForNextSpin);


    if (itemsAwarded && itemsAwarded.length > 0) { itemsAwarded.forEach(item => { if (item.type === "RelicFragment") { setGameMessage(prev => `${prev ? prev + " | " : ""}Gained a Relic Fragment!`); }});}
    if (nextSpinCostModifier) { setOneTimeSpinCostModifier(nextSpinCostModifier); }

    if (currentEnemy && totalGainedThisSpin > 0) { dealDamageToEnemy(totalGainedThisSpin); }
    
    if (!isGameOver) {
        handleTurnResolution(nextSpinCount);
    }
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