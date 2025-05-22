// src/app/game/gameManager.ts
import type { SymbolData, RelicData, EnemyData } from '@/types/kigaslot';
import type { BoardSymbol, DynamicBoardSymbol, DynamicSymbol } from './symbollogic';
import {
  applyAdjacentBonusesLogic,
  checkLinesAndApplyEffects,
  handleBombExplosionsLogic,
} from './symbollogic';
import { symbols as allSymbols } from '@/data/symbols'; 

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

export interface GameStateSetters {
  setMedals: React.Dispatch<React.SetStateAction<number>>;
  setSpinCount: React.Dispatch<React.SetStateAction<number>>;
  setBoardSymbols: React.Dispatch<React.SetStateAction<BoardSymbol[]>>;
  setLineMessage: React.Dispatch<React.SetStateAction<string>>;
  setGameMessage: React.Dispatch<React.SetStateAction<string>>; 
  setHighlightedLine: React.Dispatch<React.SetStateAction<number[] | null>>;
  setNextCostIncreaseIn: React.Dispatch<React.SetStateAction<number>>;
  setNextEnemyIn: React.Dispatch<React.SetStateAction<number>>;
  setCurrentEnemy: React.Dispatch<React.SetStateAction<EnemyData | null>>;
  setEnemyHP: React.Dispatch<React.SetStateAction<number>>;
  setActiveDebuffs: React.Dispatch<React.SetStateAction<{ type: string, duration: number, value?: number, originEnemy?: string }[]>>;
  setPersistingSymbols: React.Dispatch<React.SetStateAction<{ index: number, symbol: SymbolData, duration: number }[]>>;
  setOneTimeSpinCostModifier: React.Dispatch<React.SetStateAction<number>>;
  setCurrentRareSymbolBonus: React.Dispatch<React.SetStateAction<number>>; 
  startSymbolAcquisitionPhase: (rareBonus: number) => void;
  startRelicSelectionPhase: () => void; 
  triggerGameOver: (message: string) => void;
  setCurrentDeck: React.Dispatch<React.SetStateAction<SymbolData[]>>;
  setSymbolDeleteTickets: React.Dispatch<React.SetStateAction<number>>; 
}


export const processSpin = (
  gameState: GameState,
  setters: GameStateSetters,
  playSound: (soundName: string) => void,
  applyEnemyDebuffsAndGetInfo: () => { 
      debuffMessages: string[],
      debuffsAppliedThisTurn: GameState['activeDebuffs']
  },
  handleEnemyDefeat: (enemyName: string) => void, 
  resolveNewEnemyEncounter: (spinCount: number) => boolean, // Removed as it's part of triggerTurnResolution
  triggerTurnResolution: (spinCount: number) => void, 
) => {
  const currentActualSpinCost = Math.max(1, Math.round(gameState.spinCost * gameState.oneTimeSpinCostModifier));
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
  setters.setGameMessage(""); 

  const nextPersistingSymbolsForThisSpin = gameState.persistingSymbols
    .map(ps => ({ ...ps, duration: ps.duration - 1 }))
    .filter(ps => ps.duration >= 0);

  let updatedActiveDebuffs = gameState.activeDebuffs.map(d => ({ ...d, duration: d.duration - 1 })).filter(d => d.duration > 0);

  const initialBoardSymbols: BoardSymbol[] = Array(9).fill(null);
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

  const boardForProcessing: BoardSymbol[] = [...initialBoardSymbols];
  let totalGainedThisSpin = 0;
  let combinedEffectMessage = spinEventMessage;

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
  
  const newPersistingSymbolsFromAB: GameState['persistingSymbols'] = abResult.symbolsToPersist || [];

  const dynamicBoardForLines: DynamicBoardSymbol[] = boardForProcessing.map(s => s ? {...s} as DynamicSymbol : null);
  if (abResult.boardMutations) {
    abResult.boardMutations.forEach(mutation => {
      if (dynamicBoardForLines[mutation.index]) {
        // Apply changes. Ensure the target is not null and properties exist.
        const targetSymbol = dynamicBoardForLines[mutation.index];
        if(targetSymbol){
            dynamicBoardForLines[mutation.index] = { ...targetSymbol, ...mutation.changes };
        }
      }
    });
  }
  
  let enemyDebuffsPreventedByBuckler = false;
  let debuffsToApplyFromEnemyThisTurn: GameState['activeDebuffs'] = [];

  if (gameState.currentEnemy) {
      const debuffApplicationInfo = applyEnemyDebuffsAndGetInfo();
      debuffsToApplyFromEnemyThisTurn = debuffApplicationInfo.debuffsAppliedThisTurn;
      debuffApplicationInfo.debuffMessages.forEach(msg => combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + msg);

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
          debuffsToApplyFromEnemyThisTurn = debuffsToApplyFromEnemyThisTurn.filter(d => d.type !== "SlotGoblinCurse");
      }
  }
  updatedActiveDebuffs = [...updatedActiveDebuffs, ...debuffsToApplyFromEnemyThisTurn];
  setters.setActiveDebuffs(updatedActiveDebuffs);

  const lineCheckResults = checkLinesAndApplyEffects(
    dynamicBoardForLines,
    gameState.acquiredRelics,
    gameState.currentDeck,
    allSymbols,
    updatedActiveDebuffs 
  );

  const { 
      gainedMedals: lineGainedMedalsVal, // Renamed to avoid conflict with const rule
      message: linesMessageVal, 
      formedLinesIndices: formedLinesIndicesVal, 
      bombsToExplode: bombsToExplodeVal,
      itemsAwarded: itemsAwardedVal, 
      newSymbolsOnBoardPostEffect: newSymbolsOnBoardPostEffectVal, 
      nextSpinCostModifier: nextSpinCostModifierVal, 
      symbolsToRemoveFromBoard: symbolsToRemoveFromBoardVal, 
      debuffsPreventedThisSpin: debuffsPreventedThisSpinVal, 
      symbolsToAddToDeck: symbolsToAddToDeckVal, 
      symbolsToRemoveFromDeckByName: symbolsToRemoveFromDeckByNameVal, 
      additionalMedalsFromRG: additionalMedalsFromRGVal
  } = lineCheckResults; 

  if (debuffsPreventedThisSpinVal && !enemyDebuffsPreventedByBuckler) {
      combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + "Buckler's protection active!";
  }
  
  if (lineGainedMedalsVal > 0) { setters.setMedals(p => p + lineGainedMedalsVal); totalGainedThisSpin += lineGainedMedalsVal; playSound('lineWin'); if (formedLinesIndicesVal && formedLinesIndicesVal.length > 0) { setters.setHighlightedLine(formedLinesIndicesVal[0]); setTimeout(() => setters.setHighlightedLine(null), 800); }}
  if (additionalMedalsFromRGVal) { setters.setMedals(p => p + additionalMedalsFromRGVal); totalGainedThisSpin += additionalMedalsFromRGVal; }
  if (linesMessageVal && linesMessageVal !== "No lines or no medal effects." && linesMessageVal !== "No lines/effects.") { combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + linesMessageVal; }

  let tempDeck = [...gameState.currentDeck];
  let deckChanged = false;
  if (symbolsToAddToDeckVal) { 
    symbolsToAddToDeckVal.forEach(symbolToAdd => {
        const existingCurses = tempDeck.filter(s => s.name === "呪いの仮面 (Cursed Mask)").length;
        if (symbolToAdd.name === "呪いの仮面 (Cursed Mask)") {
            if (existingCurses < 3) { tempDeck.push(symbolToAdd); combinedEffectMessage += ` | Curse Mask added!`; deckChanged = true; }
        } else { tempDeck.push(symbolToAdd); deckChanged = true; }
    });
  }
  if (symbolsToRemoveFromDeckByNameVal) { 
    symbolsToRemoveFromDeckByNameVal.forEach(nameToRemove => {
        const initialLength = tempDeck.length;
        tempDeck = tempDeck.filter(s => s.name !== nameToRemove);
        if (tempDeck.length < initialLength) { combinedEffectMessage += ` | ${nameToRemove} removed from deck!`; deckChanged = true;}
    });
  }
  if (deckChanged) setters.setCurrentDeck(tempDeck);


  const boardStateAfterLines: DynamicBoardSymbol[] = [...dynamicBoardForLines]; 
  if (symbolsToRemoveFromBoardVal) { symbolsToRemoveFromBoardVal.forEach(index => { if (boardStateAfterLines[index]) { combinedEffectMessage += ` | ${boardStateAfterLines[index]!.name.split(' ')[0]} hunted!`; boardStateAfterLines[index] = null; }});}
  if (newSymbolsOnBoardPostEffectVal) { newSymbolsOnBoardPostEffectVal.forEach(effect => { boardStateAfterLines[effect.index] = effect.symbolData; combinedEffectMessage += ` | ${effect.symbolData.name.split(' ')[0]} appears!`; });}
  
  let boardStateAfterBombs: DynamicBoardSymbol[] = [...boardStateAfterLines];
  if (bombsToExplodeVal && bombsToExplodeVal.length > 0) {
    playSound('bomb');
    const bombRes = handleBombExplosionsLogic(bombsToExplodeVal, boardStateAfterLines );
    if (bombRes.gainedMedals > 0) { setters.setMedals(p => p + bombRes.gainedMedals); totalGainedThisSpin += bombRes.gainedMedals; playSound('medal');}
    boardStateAfterBombs = bombRes.newBoard; 
    if (bombRes.message) { combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + bombRes.message;}
  }
  
  let finalTotalGainedThisSpin = totalGainedThisSpin;
  if (abResult.totalSpinMedalFlatBonus) { finalTotalGainedThisSpin += abResult.totalSpinMedalFlatBonus; combinedEffectMessage += ` | Chain Total: +${abResult.totalSpinMedalFlatBonus}`; }
  if (abResult.totalSpinMedalMultiplier && abResult.totalSpinMedalMultiplier > 1) { finalTotalGainedThisSpin = Math.floor(finalTotalGainedThisSpin * abResult.totalSpinMedalMultiplier); combinedEffectMessage += ` | Vine Total: x${abResult.totalSpinMedalMultiplier.toFixed(2)}`;}
  totalGainedThisSpin = finalTotalGainedThisSpin;

  setters.setBoardSymbols(boardStateAfterBombs.map(s => s ? { no: s.no, name: s.name, attribute: s.attribute, rarity: s.rarity, effectSystem: s.effectSystem, effectText: s.effectText, flavorText: s.flavorText } : null)); 
  setters.setLineMessage(combinedEffectMessage.trim().replace(/^ \| /, '') || "No bonuses or lines.");
  
  const finalPersistingForNextSpin = nextPersistingSymbolsForThisSpin.filter(ps => ps.duration > 0); 
  newPersistingSymbolsFromAB.forEach(newP => {
      const existingIdx = finalPersistingForNextSpin.findIndex(p => p.index === newP.index);
      if (existingIdx !== -1) finalPersistingForNextSpin.splice(existingIdx, 1); 
      finalPersistingForNextSpin.push(newP);
  });
  setters.setPersistingSymbols(finalPersistingForNextSpin);

  if (itemsAwardedVal && itemsAwardedVal.length > 0) { itemsAwardedVal.forEach(item => { if (item.type === "RelicFragment") { setters.setGameMessage(prev => `${prev ? prev + " | " : ""}Gained a Relic Fragment!`); }});}
  if (nextSpinCostModifierVal) { setters.setOneTimeSpinCostModifier(nextSpinCostModifierVal); }

  if (gameState.currentEnemy && totalGainedThisSpin > 0) { 
    const newEnemyHPVal = gameState.enemyHP - totalGainedThisSpin; 
    setters.setEnemyHP(Math.max(0, newEnemyHPVal));
    if (newEnemyHPVal <= 0) {
        handleEnemyDefeat(gameState.currentEnemy.name); 
    }
  }
  
  if (gameState.nextCostIncreaseIn > 0) setters.setNextCostIncreaseIn(prev => prev - 1);
  if (gameState.nextEnemyIn > 0 && gameState.currentEnemy === null) setters.setNextEnemyIn(prev => prev - 1);

  if (!gameState.isGameOver) {
    triggerTurnResolution(nextSpinCount);
  }
};