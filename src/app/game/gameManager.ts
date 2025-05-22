// src/app/game/gameManager.ts
import type { SymbolData, RelicData, EnemyData } from '@/types/kigaslot';
import type { BoardSymbol } from './symbollogic'; // Assuming BoardSymbol is defined in symbollogic.ts
import {
  applyAdjacentBonusesLogic,
  checkLinesAndApplyEffects,
  handleBombExplosionsLogic,
} from './symbollogic';
import { symbols as allSymbols } from '@/data/symbols'; // For Slot Goblin, etc.

// Type for state values needed by game manager
export interface GameState {
  medals: number;
  spinCost: number;
  currentDeck: SymbolData[];
  currentRareSymbolBonus: number;
  oneTimeSpinCostModifier: number;
  spinCount: number;
  nextCostIncreaseIn: number;
  nextEnemyIn: number;
  currentEnemy: EnemyData | null;
  enemyHP: number;
  acquiredRelics: RelicData[];
  activeDebuffs: { type: string, duration: number, value?: number, originEnemy?: string }[];
  persistingSymbols: { index: number, symbol: SymbolData, duration: number }[];
  isGameOver: boolean;
  isSymbolAcquisitionPhase: boolean;
  isRelicSelectionPhase: boolean;
  isDeckEditModalOpen: boolean;
}

// Type for state setters (callbacks) to update page.tsx state
export interface GameStateSetters {
  setMedals: React.Dispatch<React.SetStateAction<number>>;
  setSpinCount: React.Dispatch<React.SetStateAction<number>>;
  setBoardSymbols: React.Dispatch<React.SetStateAction<BoardSymbol[]>>;
  setLineMessage: React.Dispatch<React.SetStateAction<string>>;
  setGameMessage: React.Dispatch<React.SetStateAction<string>>; // For general messages
  setHighlightedLine: React.Dispatch<React.SetStateAction<number[] | null>>;
  setNextCostIncreaseIn: React.Dispatch<React.SetStateAction<number>>;
  setNextEnemyIn: React.Dispatch<React.SetStateAction<number>>;
  setCurrentEnemy: React.Dispatch<React.SetStateAction<EnemyData | null>>;
  setEnemyHP: React.Dispatch<React.SetStateAction<number>>;
  setActiveDebuffs: React.Dispatch<React.SetStateAction<{ type: string, duration: number, value?: number, originEnemy?: string }[]>>;
  setPersistingSymbols: React.Dispatch<React.SetStateAction<{ index: number, symbol: SymbolData, duration: number }[]>>;
  setOneTimeSpinCostModifier: React.Dispatch<React.SetStateAction<number>>;
  setCurrentRareSymbolBonus: React.Dispatch<React.SetStateAction<number>>; // If AB logic updates it directly
  // Callbacks for triggering next phases
  startSymbolAcquisitionPhase: (rareBonus: number) => void;
  startRelicSelectionPhase: () => void; // This might be part of handleTurnResolution
  triggerGameOver: (message: string) => void;
  // For deck changes
  setCurrentDeck: React.Dispatch<React.SetStateAction<SymbolData[]>>;
  setSymbolDeleteTickets: React.Dispatch<React.SetStateAction<number>>; // If enemy defeated
}

// This function will be moved from page.tsx or its logic incorporated
// For now, assume it's available or passed if needed by handleSpin's resolution part
// const handleTurnResolution = (spinCount: number, /* other args */ ) => { /* ... */ };


// Main spin logic
export const processSpin = (
  gameState: GameState,
  setters: GameStateSetters,
  playSound: (soundName: string) => void,
  // Functions that might be specific to page.tsx but needed by game logic
  applyEnemyDebuffsAndGetInfo: () => { // Placeholder for applyInstantDebuffsAndSetPersistentFlags
      debuffMessages: string[],
      debuffsAppliedThisTurn: GameState['activeDebuffs']
  },
  handleEnemyDefeat: (enemyName: string) => void, // Placeholder
  resolveNewEnemyEncounter: (spinCount: number) => boolean, // Placeholder for resolveEnemyEncounter
  triggerTurnResolution: (spinCount: number) => void, // Placeholder for handleTurnResolution
) => {
  const currentActualSpinCost = Math.max(1, Math.round(gameState.spinCost * gameState.oneTimeSpinCostModifier));
  // Early exit if spin cannot be performed
  if (gameState.isGameOver || gameState.medals < currentActualSpinCost || gameState.currentDeck.length === 0 || 
      gameState.isSymbolAcquisitionPhase || gameState.isRelicSelectionPhase || gameState.isDeckEditModalOpen) {
    return;
  }

  playSound('spin');
  setters.setHighlightedLine(null);
  setters.setMedals(prev => prev - currentActualSpinCost);

  let spinEventMessage = "";
  if (gameState.oneTimeSpinCostModifier !== 1) {
    spinEventMessage += (spinEventMessage ? " | " : "") + "Shield reduced cost!";
    setters.setOneTimeSpinCostModifier(1);
  }

  const nextSpinCount = gameState.spinCount + 1;
  setters.setSpinCount(nextSpinCount);
  setters.setLineMessage("");
  setters.setGameMessage(""); // Clear general game messages for this spin's events

  // Manage persisting symbols
  const nextPersistingSymbolsForThisSpin = gameState.persistingSymbols
    .map(ps => ({ ...ps, duration: ps.duration - 1 }))
    .filter(ps => ps.duration >= 0);

  // Update activeDebuffs duration (those already active before this spin)
  let updatedActiveDebuffs = gameState.activeDebuffs.map(d => ({ ...d, duration: d.duration - 1 })).filter(d => d.duration > 0);
  // Debuffs from current enemy this turn will be added later

  // Board Generation
  let initialBoardSymbols: BoardSymbol[] = Array(9).fill(null);
  const occupiedIndices = new Set<number>();
  nextPersistingSymbolsForThisSpin.forEach(ps => {
    if (ps.duration >= 0) {
      initialBoardSymbols[ps.index] = ps.symbol;
      occupiedIndices.add(ps.index);
    }
  });
  for (let i = 0; i < 9; i++) {
    if (!occupiedIndices.has(i)) {
      if (gameState.currentDeck.length > 0) {
        initialBoardSymbols[i] = gameState.currentDeck[Math.floor(Math.random() * gameState.currentDeck.length)];
      } else {
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
    setters.setMedals(p => p + abResult.gainedMedals);
    totalGainedThisSpin += abResult.gainedMedals;
    combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + abResult.message;
    playSound('medal');
  }
  if (abResult.rareSymbolAppearanceModifier) {
    setters.setCurrentRareSymbolBonus(prev => Math.min(5, prev + abResult.rareSymbolAppearanceModifier!));
    combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + `Rare chance up by ${abResult.rareSymbolAppearanceModifier}%!`;
  }
  
  let newPersistingSymbolsFromAB: GameState['persistingSymbols'] = [];
  if (abResult.symbolsToPersist) {
    newPersistingSymbolsFromAB = abResult.symbolsToPersist;
  }

  let dynamicBoardForLines: any[] = boardForProcessing.map(s => s ? { ...s } : null);
  if (abResult.boardMutations) {
    abResult.boardMutations.forEach(mutation => {
      if (dynamicBoardForLines[mutation.index]) {
        dynamicBoardForLines[mutation.index] = { ...dynamicBoardForLines[mutation.index], ...mutation.changes };
      }
    });
  }

  // --- Phase 1: Enemy Debuff Application ---
  let enemyDebuffsPreventedByBuckler = false;
  let debuffsToApplyFromEnemyThisTurn: GameState['activeDebuffs'] = [];

  if (gameState.currentEnemy) {
      const debuffApplicationInfo = applyEnemyDebuffsAndGetInfo(); // Call the passed-in function
      debuffsToApplyFromEnemyThisTurn = debuffApplicationInfo.debuffsAppliedThisTurn;
      debuffApplicationInfo.debuffMessages.forEach(msg => combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + msg);

      // Pre-check for Buckler to prevent Slot Goblin board change
      let preCheckBucklerActive = false;
      if (gameState.currentEnemy.name === "スロット・ゴブリン (Slot Goblin)") {
          const tempLineCheck = checkLinesAndApplyEffects(dynamicBoardForLines, gameState.acquiredRelics, gameState.currentDeck, allSymbols, debuffsToApplyFromEnemyThisTurn);
          if (tempLineCheck.debuffsPreventedThisSpin) {
              preCheckBucklerActive = true;
          }
      }

      if (!preCheckBucklerActive && gameState.currentEnemy.name === "スロット・ゴブリン (Slot Goblin)") {
          const cursedMask = allSymbols.find(s => s.name === "呪いの仮面 (Cursed Mask)");
          if (cursedMask && dynamicBoardForLines.some(s => s !== null)) {
              let rIdx = -1, att = 0;
              while (att < 20) { const tIdx = Math.floor(Math.random() * 9); if (dynamicBoardForLines[tIdx] !== null) { rIdx = tIdx; break; } att++; }
              if (rIdx !== -1 && dynamicBoardForLines[rIdx]) {
                  combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + `Goblin changed ${dynamicBoardForLines[rIdx]!.name.split(' ')[0]} to Cursed Mask!`;
                  dynamicBoardForLines[rIdx] = cursedMask;
              }
          }
      } else if (preCheckBucklerActive && gameState.currentEnemy.name === "スロット・ゴブリン (Slot Goblin)") {
          combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + "Buckler prevents Goblin's trick!";
          enemyDebuffsPreventedByBuckler = true;
          // Filter out the SlotGoblinCurse if it was in debuffsToApplyFromEnemyThisTurn
          debuffsToApplyFromEnemyThisTurn = debuffsToApplyFromEnemyThisTurn.filter(d => d.type !== "SlotGoblinCurse");
      }
  }
  // Add newly applied (and not prevented) enemy debuffs to the active list
  updatedActiveDebuffs = [...updatedActiveDebuffs, ...debuffsToApplyFromEnemyThisTurn];
  setters.setActiveDebuffs(updatedActiveDebuffs);


  // --- Phase 2: Line Checks & Line-based Effects ---
  const lineCheckResults = checkLinesAndApplyEffects(
    dynamicBoardForLines,
    gameState.acquiredRelics,
    gameState.currentDeck,
    allSymbols,
    updatedActiveDebuffs // Pass the most current debuff list
  );

  // Destructure results
  let { gainedMedals: lineGainedMedals, message: linesMessage, formedLinesIndices, bombsToExplode,
        itemsAwarded, newSymbolsOnBoardPostEffect, nextSpinCostModifier, symbolsToRemoveFromBoard, 
        debuffsPreventedThisSpin, symbolsToAddToDeck, symbolsToRemoveFromDeckByName, additionalMedalsFromRG
      } = lineCheckResults;

  if (debuffsPreventedThisSpin && !enemyDebuffsPreventedByBuckler) {
      combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + "Buckler's protection active!";
      // Further logic to undo other debuffs if necessary
  }
  
  if (lineGainedMedals > 0) { setters.setMedals(p => p + lineGainedMedals); totalGainedThisSpin += lineGainedMedals; playSound('lineWin'); if (formedLinesIndices && formedLinesIndices.length > 0) { setters.setHighlightedLine(formedLinesIndices[0]); setTimeout(() => setters.setHighlightedLine(null), 800); }}
  if (additionalMedalsFromRG) { setters.setMedals(p => p + additionalMedalsFromRG); totalGainedThisSpin += additionalMedalsFromRG; }
  if (linesMessage && linesMessage !== "No lines or no medal effects." && linesMessage !== "No lines/effects.") { combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + linesMessage; }

  // Deck modifications
  let tempDeck = [...gameState.currentDeck];
  let deckChanged = false;
  if (symbolsToAddToDeck) {
    symbolsToAddToDeck.forEach(symbolToAdd => {
        const existingCurses = tempDeck.filter(s => s.name === "呪いの仮面 (Cursed Mask)").length;
        if (symbolToAdd.name === "呪いの仮面 (Cursed Mask)") {
            if (existingCurses < 3) { tempDeck.push(symbolToAdd); combinedEffectMessage += ` | Curse Mask added!`; deckChanged = true; }
        } else { tempDeck.push(symbolToAdd); deckChanged = true; /* Potentially add message for other additions */ }
    });
  }
  if (symbolsToRemoveFromDeckByName) {
    symbolsToRemoveFromDeckByName.forEach(nameToRemove => {
        const initialLength = tempDeck.length;
        tempDeck = tempDeck.filter(s => s.name !== nameToRemove);
        if (tempDeck.length < initialLength) { combinedEffectMessage += ` | ${nameToRemove} removed from deck!`; deckChanged = true;}
    });
  }
  if (deckChanged) setters.setCurrentDeck(tempDeck);


  let boardStateAfterLines = [...dynamicBoardForLines];
  if (symbolsToRemoveFromBoard) { symbolsToRemoveFromBoard.forEach(index => { if (boardStateAfterLines[index]) { combinedEffectMessage += ` | ${boardStateAfterLines[index]!.name.split(' ')[0]} hunted!`; boardStateAfterLines[index] = null; }});}
  if (newSymbolsOnBoardPostEffect) { newSymbolsOnBoardPostEffect.forEach(effect => { boardStateAfterLines[effect.index] = effect.symbolData; combinedEffectMessage += ` | ${effect.symbolData.name.split(' ')[0]} appears!`; });}
  
  // --- Phase 3: Bomb Explosions ---
  let boardStateAfterBombs = [...boardStateAfterLines];
  if (bombsToExplode && bombsToExplode.length > 0) {
    playSound('bomb');
    const bombRes = handleBombExplosionsLogic(bombsToExplode, boardStateAfterLines );
    if (bombRes.gainedMedals > 0) { setters.setMedals(p => p + bombRes.gainedMedals); totalGainedThisSpin += bombRes.gainedMedals; playSound('medal');}
    boardStateAfterBombs = bombRes.newBoard; 
    if (bombRes.message) { combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + bombRes.message;}
  }
  
  // --- Phase 4: Apply total spin medal modifiers from AB ---
  let finalTotalGainedThisSpin = totalGainedThisSpin;
  if (abResult.totalSpinMedalFlatBonus) { finalTotalGainedThisSpin += abResult.totalSpinMedalFlatBonus; combinedEffectMessage += ` | Chain Total: +${abResult.totalSpinMedalFlatBonus}`; }
  if (abResult.totalSpinMedalMultiplier && abResult.totalSpinMedalMultiplier > 1) { finalTotalGainedThisSpin = Math.floor(finalTotalGainedThisSpin * abResult.totalSpinMedalMultiplier); combinedEffectMessage += ` | Vine Total: x${abResult.totalSpinMedalMultiplier.toFixed(2)}`;}
  totalGainedThisSpin = finalTotalGainedThisSpin;


  // Finalize board for display (strip dynamic properties)
  setters.setBoardSymbols(boardStateAfterBombs.map(s => s ? { no: s.no, name: s.name, attribute: s.attribute, rarity: s.rarity, effectSystem: s.effectSystem, effectText: s.effectText, flavorText: s.flavorText } : null)); 
  setters.setLineMessage(combinedEffectMessage.trim().replace(/^ \| /, '') || "No bonuses or lines.");
  
  // Update persisting symbols state for the *next* spin based on this spin's AB results
  const finalPersistingForNextSpin = nextPersistingSymbolsForThisSpin.filter(ps => ps.duration > 0); 
  newPersistingSymbolsFromAB.forEach(newP => {
      const existingIdx = finalPersistingForNextSpin.findIndex(p => p.index === newP.index);
      if (existingIdx !== -1) finalPersistingForNextSpin.splice(existingIdx, 1); 
      finalPersistingForNextSpin.push(newP);
  });
  setters.setPersistingSymbols(finalPersistingForNextSpin);

  // Handle items awarded
  if (itemsAwarded && itemsAwarded.length > 0) { itemsAwarded.forEach(item => { if (item.type === "RelicFragment") { setters.setGameMessage(prev => `${prev ? prev + " | " : ""}Gained a Relic Fragment!`); }});}
  // Set one-time cost modifier for the *next* spin if applicable
  if (nextSpinCostModifier) { setters.setOneTimeSpinCostModifier(nextSpinCostModifier); }

  // Deal damage to enemy
  if (gameState.currentEnemy && totalGainedThisSpin > 0) { 
    // This needs access to setEnemyHP, setCurrentEnemy, setSymbolDeleteTickets
    let newEnemyHP = gameState.enemyHP - totalGainedThisSpin;
    setters.setEnemyHP(Math.max(0, newEnemyHP));
    if (newEnemyHP <= 0) {
        handleEnemyDefeat(gameState.currentEnemy.name); // Call the passed-in defeat handler
    }
  }
  
  // Update cost increase and enemy encounter timers
  if (gameState.nextCostIncreaseIn > 0) setters.setNextCostIncreaseIn(prev => prev - 1);
  if (gameState.nextEnemyIn > 0 && gameState.currentEnemy === null) setters.setNextEnemyIn(prev => prev - 1);


  // End of spin resolution: trigger turn resolution which handles relic/symbol acquisition/enemy
  if (!gameState.isGameOver) {
    triggerTurnResolution(nextSpinCount);
  }
};