// src/app/game/gameManager.ts
import type {
  SymbolData,
  RelicData,
  EnemyData,
  InstanceSymbolData,
  DeckSymbol,
  DynamicBoardSymbol,
  DynamicSymbol,
  PersistingSymbolInfo,
  RespinState,
  NextSpinEffects,
  RustedLumpProgress,
  Debuff,
  BoardSymbolBase, // For setBoardSymbols
} from '@/types/kigaslot';
import {
  applyAdjacentBonusesLogic,
  checkLinesAndApplyEffects,
  handleBombExplosionsLogic,
  // getBoardPosition, getIndexFromBoardPosition, // Not directly used here but available
} from './symbollogic';
import { symbols as allGameSymbols } from '@/data/symbols'; // Changed from allSymbols
import { v4 as uuidv4 } from 'uuid'; // For generating new instanceIds

// Helper to find symbol data by 'no'
const findSymbolDataByNo = (no: number): SymbolData | undefined => {
  return allGameSymbols.find(s => s.no === no);
};

export interface GameState {
  medals: number;
  spinCost: number;
  currentDeck: DeckSymbol[];
  currentRareSymbolBonus: number;
  oneTimeSpinCostModifier: number;
  spinCount: number;
  nextCostIncreaseIn: number;
  nextEnemyIn: number;
  currentEnemy: EnemyData | null;
  enemyHP: number;
  acquiredRelics: RelicData[];
  activeDebuffs: Debuff[];
  persistingSymbols: PersistingSymbolInfo[];
  isGameOver: boolean;
  isSymbolAcquisitionPhase: boolean;
  isRelicSelectionPhase: boolean;
  isDeckEditModalOpen: boolean;

  // New states
  respinState: RespinState | null;
  nextSpinEffects: NextSpinEffects;
  rustedLumpProgress: RustedLumpProgress;
  // boardSymbols is needed for respin logic to know what was on board
  boardSymbols: BoardSymbolBase[]; // The actual symbols on board (InstanceSymbolData | null)[]
}

export interface GameStateSetters {
  setMedals: React.Dispatch<React.SetStateAction<number>>;
  setSpinCount: React.Dispatch<React.SetStateAction<number>>;
  setBoardSymbols: React.Dispatch<React.SetStateAction<BoardSymbolBase[]>>;
  setLineMessage: React.Dispatch<React.SetStateAction<string>>;
  setGameMessage: React.Dispatch<React.SetStateAction<string>>;
  setHighlightedLine: React.Dispatch<React.SetStateAction<number[] | null>>;
  setNextCostIncreaseIn: React.Dispatch<React.SetStateAction<number>>;
  setNextEnemyIn: React.Dispatch<React.SetStateAction<number>>;
  setCurrentEnemy: React.Dispatch<React.SetStateAction<EnemyData | null>>;
  setEnemyHP: React.Dispatch<React.SetStateAction<number>>;
  setActiveDebuffs: React.Dispatch<React.SetStateAction<Debuff[]>>;
  setPersistingSymbols: React.Dispatch<React.SetStateAction<PersistingSymbolInfo[]>>;
  setOneTimeSpinCostModifier: React.Dispatch<React.SetStateAction<number>>;
  setCurrentRareSymbolBonus: React.Dispatch<React.SetStateAction<number>>;
  startSymbolAcquisitionPhase: (rareBonus: number) => void;
  startRelicSelectionPhase: () => void;
  triggerGameOver: (message: string) => void;
  setCurrentDeck: React.Dispatch<React.SetStateAction<DeckSymbol[]>>;
  setSymbolDeleteTickets: React.Dispatch<React.SetStateAction<number>>;

  // New setters
  setRespinState: React.Dispatch<React.SetStateAction<RespinState | null>>;
  setNextSpinEffects: React.Dispatch<React.SetStateAction<NextSpinEffects>>;
  setRustedLumpProgress: React.Dispatch<React.SetStateAction<RustedLumpProgress>>;
}


export const processSpin = (
  gameState: GameState,
  setters: GameStateSetters,
  playSound: (soundName: string) => void,
  applyEnemyDebuffsAndGetInfo: () => {
      debuffMessages: string[],
      debuffsAppliedThisTurn: Debuff[]
  },
  handleEnemyDefeat: (enemyName: string) => void,
  triggerTurnResolution: (spinCount: number) => void,
) => {
  const currentActualSpinCost = Math.max(1, Math.round(gameState.spinCost * gameState.oneTimeSpinCostModifier));

  // --- Respin Pre-check ---
  if (gameState.respinState && gameState.respinState.active) {
    playSound('respin');
    setters.setHighlightedLine(null);
    setters.setLineMessage(""); // Clear previous line message
    setters.setGameMessage("Respinning!");

    const boardForRespin: InstanceSymbolData[] = Array(9).fill(null) as unknown as InstanceSymbolData[];
    const respinType = gameState.respinState.type;
    const columnsToRespin = gameState.respinState.columnsToRespin || [];

    // Populate non-respinning symbols from the current board state (passed in gameState.boardSymbols)
    const currentBoardSnapshot = [...gameState.boardSymbols];

    for (let i = 0; i < 9; i++) {
        const c = i % 3; // Column index
        let shouldPopulateNew = false;
        if (respinType === 'phoenix_all_columns') {
            shouldPopulateNew = true;
        } else if (respinType === 'arrow_column' && columnsToRespin.includes(c)) {
            shouldPopulateNew = true;
        }

        if (shouldPopulateNew) {
            // For respinning slots, check if a persisting symbol (non-growth) should stay
            const persistingSymbolInSlot = gameState.persistingSymbols.find(ps => ps.index === i && !ps.isGrowthSymbol);
            if (persistingSymbolInSlot) {
                boardForRespin[i] = persistingSymbolInSlot.symbol;
            } else if (gameState.currentDeck.length > 0) {
                boardForRespin[i] = gameState.currentDeck[Math.floor(Math.random() * gameState.currentDeck.length)];
            } else {
                boardForRespin[i] = null as unknown as InstanceSymbolData;
            }
        } else {
            // Keep existing symbol if not part of respin columns
            boardForRespin[i] = currentBoardSnapshot[i] as InstanceSymbolData;
        }
    }
    // Ensure any persisting symbols (especially non-growth ones) are correctly placed if they weren't handled above
    gameState.persistingSymbols.forEach(ps => {
        if (ps.duration >= 0 && !ps.isGrowthSymbol) { // Non-growth symbols always persist through respins if duration allows
            boardForRespin[ps.index] = ps.symbol;
        }
    });


    // --- Continue with AB, Line Check, etc. for respin ---
    let totalGainedThisRespin = 0;
    let combinedEffectMessageRespin = "Respin Results: ";

    const abResultRespin = applyAdjacentBonusesLogic(boardForRespin.map(s => s ? {...s} : null));
    if (abResultRespin.gainedMedals > 0) {
      setters.setMedals(p => p + abResultRespin.gainedMedals);
      totalGainedThisRespin += abResultRespin.gainedMedals;
      combinedEffectMessageRespin = (combinedEffectMessageRespin ? combinedEffectMessageRespin + " | " : "") + abResultRespin.message;
      playSound('medal');
    }
    // Respins usually don't affect rare bonus or add new persisting symbols from AB, but can be added if desired.

    const dynamicBoardForLinesRespin: DynamicBoardSymbol[] = boardForRespin.map(s => s ? { ...s } as DynamicSymbol : null);
    if (abResultRespin.boardMutations) {
      abResultRespin.boardMutations.forEach(mutation => {
        if (dynamicBoardForLinesRespin[mutation.index]) {
          const targetSymbol = dynamicBoardForLinesRespin[mutation.index];
          if (targetSymbol) {
            dynamicBoardForLinesRespin[mutation.index] = { ...targetSymbol, ...mutation.changes };
          }
        }
      });
    }

    // No enemy debuff application during respin usually.
    const lineCheckResultsRespin = checkLinesAndApplyEffects(
        dynamicBoardForLinesRespin, gameState.acquiredRelics, gameState.currentDeck,
        gameState.activeDebuffs, // Pass current debuffs, but they might not apply new ones
        gameState.persistingSymbols // Pass current persisting symbols for checks like Rich Soil
    );

    // Avoid recursive respins
    if (lineCheckResultsRespin.requestRespin) {
        console.warn("Respin triggered another respin request. Ignoring to prevent loop.");
        lineCheckResultsRespin.requestRespin = undefined;
    }
    // Process medals and messages from respin line check
    if (lineCheckResultsRespin.gainedMedals > 0) {
        setters.setMedals(p => p + lineCheckResultsRespin.gainedMedals);
        totalGainedThisRespin += lineCheckResultsRespin.gainedMedals;
        playSound('lineWin');
        if (lineCheckResultsRespin.formedLinesIndices && lineCheckResultsRespin.formedLinesIndices.length > 0) {
            setters.setHighlightedLine(lineCheckResultsRespin.formedLinesIndices[0]);
            setTimeout(() => setters.setHighlightedLine(null), 800);
        }
    }
// 'undefined' の可能性をチェック
    if (typeof lineCheckResultsRespin.additionalMedalsFromRG === 'number') {
        setters.setMedals(p => p + lineCheckResultsRespin.additionalMedalsFromRG!); // '!'でnull/undefinedでないことを伝えるか、再度チェック
        totalGainedThisRespin += lineCheckResultsRespin.additionalMedalsFromRG!;
    }
    // または、より安全なのは
    // const rgMedals = lineCheckResultsRespin.additionalMedalsFromRG;
    // if (rgMedals) { // これで number かつ 0 でない場合に true
    //     setters.setMedals(p => p + rgMedals);
    //     totalGainedThisRespin += rgMedals;
    // }
    if (lineCheckResultsRespin.message && lineCheckResultsRespin.message !== "No lines/effects.") {
        combinedEffectMessageRespin = (combinedEffectMessageRespin ? combinedEffectMessageRespin + " | " : "") + lineCheckResultsRespin.message;
    }
    // Bombs from respin
    let boardAfterRespinBombs = dynamicBoardForLinesRespin;
    if (lineCheckResultsRespin.bombsToExplode && lineCheckResultsRespin.bombsToExplode.length > 0) {
        playSound('bomb');
        const bombRes = handleBombExplosionsLogic(lineCheckResultsRespin.bombsToExplode, dynamicBoardForLinesRespin);
        if (bombRes.gainedMedals > 0) { setters.setMedals(p => p + bombRes.gainedMedals); totalGainedThisRespin += bombRes.gainedMedals; playSound('medal');}
        boardAfterRespinBombs = bombRes.newBoard;
        if (bombRes.message) { combinedEffectMessageRespin = (combinedEffectMessageRespin ? combinedEffectMessageRespin + " | " : "") + bombRes.message;}
    }
    // Other effects from respin (items, deck changes) are usually limited or disabled. Implement if needed.


    setters.setBoardSymbols(boardAfterRespinBombs.map(s => s ? { ...s } : null));
    setters.setLineMessage(combinedEffectMessageRespin.trim().replace(/^ \| /, ''));
    setters.setRespinState(null); // End respin state
    // After respin, usually don't trigger full turn resolution (cost increase, enemy spawn etc.)
    // but may need to check for game over if medals ran out.
    if (gameState.medals <= 0 && !gameState.isGameOver) { // Check if respin bankrupted player
        setters.triggerGameOver("Not enough medals after respin! GAME OVER!");
    }
    return;
  }
  // --- End of Respin Pre-check ---


  // --- Normal Spin Logic ---
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
    // oneTimeSpinCostModifier is reset after this spin, at the end or after line check.
  }

  const nextSpinCount = gameState.spinCount + 1;
  setters.setSpinCount(nextSpinCount);
  setters.setLineMessage(""); // Clear previous line message
  setters.setGameMessage(""); // Clear general game message for this spin's events

  // === Persisting Symbols & Growth Pre-spin Update ===
  const currentPersistingSymbolsList = [...gameState.persistingSymbols];
  const boardSymbolsFromPersistence: (InstanceSymbolData | null)[] = Array(9).fill(null);
  const nextTurnPersistingSymbolsList: PersistingSymbolInfo[] = [];
  let messagesFromGrowthAndPersistence: string[] = [];

  currentPersistingSymbolsList.forEach(ps => {
    let currentSymbolInPersistence = { ...ps.symbol };
    let newDuration = ps.duration - 1;
    let transformedThisTurn = false;

    // Apply passive medal generation (e.g., 花咲く大樹)
    const symbolDef = findSymbolDataByNo(currentSymbolInPersistence.no); // Get current definition
    if (symbolDef?.generatesMedalOnBoard && symbolDef.generatesMedalOnBoard > 0) {
        setters.setMedals(prev => prev + symbolDef.generatesMedalOnBoard!);
        messagesFromGrowthAndPersistence.push(`${symbolDef.name.split(' ')[0]} generated +${symbolDef.generatesMedalOnBoard} medals!`);
    }

    if (ps.isGrowthSymbol && newDuration < 0) { // Growth duration completed (was 0, now -1)
      const growthDefinition = symbolDef?.transformToSymbolNo ? findSymbolDataByNo(symbolDef.transformToSymbolNo) : null;
      if (growthDefinition) {
        currentSymbolInPersistence = { ...growthDefinition, instanceId: ps.symbol.instanceId }; // Keep instanceId
        messagesFromGrowthAndPersistence.push(`${symbolDef!.name.split(' ')[0]} transformed into ${currentSymbolInPersistence.name.split(' ')[0]}!`);
        playSound('transform');
        transformedThisTurn = true;
        // Transformed symbol does not auto-persist unless its new form has persisting properties or an effect makes it persist.
        // If it needs to persist (e.g. 花咲く大樹 to keep generating medals), its new SymbolData should have a 'growthTurns' or similar property,
        // or a line effect should add it to newPersistingSymbolsFromLineEffect.
        // For now, newDuration remains < 0, so it won't be added to nextTurnPersistingSymbolsList unless explicitly re-added.
      } else {
         newDuration = -1; // Transformation failed or not defined, remove from persistence.
      }
    }

    if (newDuration >= 0) {
        nextTurnPersistingSymbolsList.push({ ...ps, symbol: currentSymbolInPersistence, duration: newDuration });
        boardSymbolsFromPersistence[ps.index] = currentSymbolInPersistence;
    } else if (transformedThisTurn) {
        // If it transformed, it should be on the board for this spin's line checks
        boardSymbolsFromPersistence[ps.index] = currentSymbolInPersistence;
    }
  });
  // Note: setters.setPersistingSymbols is called later, after AB and Line effects might add more.

  if (messagesFromGrowthAndPersistence.length > 0) {
      spinEventMessage = (spinEventMessage ? spinEventMessage + " | " : "") + messagesFromGrowthAndPersistence.join(" | ");
  }


  // === Initial Board Symbol Placement ===
  const initialBoardSymbols: InstanceSymbolData[] = Array(9).fill(null) as unknown as InstanceSymbolData[];
  const occupiedIndices = new Set<number>();

  boardSymbolsFromPersistence.forEach((s, idx) => {
      if (s) {
          initialBoardSymbols[idx] = s;
          occupiedIndices.add(idx);
      }
  });

  // Apply nextSpinEffects (Wild Transformation)
  let wildTransformAppliedCount = 0;
  const availableSlotsForWild: number[] = [];
  for (let i = 0; i < 9; i++) { if (!occupiedIndices.has(i)) availableSlotsForWild.push(i); }

  if (gameState.nextSpinEffects.transformToWildCount > 0 && availableSlotsForWild.length > 0) {
    const wildSymbolDataDef = findSymbolDataByNo(44); // Assuming Wild is No.44
    if (wildSymbolDataDef) {
      for (let i = 0; i < gameState.nextSpinEffects.transformToWildCount && availableSlotsForWild.length > 0; i++) {
        const randIdxChoice = Math.floor(Math.random() * availableSlotsForWild.length);
        const slotToWild = availableSlotsForWild.splice(randIdxChoice, 1)[0];
        initialBoardSymbols[slotToWild] = { ...wildSymbolDataDef, instanceId: `wild_${uuidv4()}` };
        occupiedIndices.add(slotToWild);
        wildTransformAppliedCount++;
      }
      if (wildTransformAppliedCount > 0) {
        spinEventMessage = (spinEventMessage ? spinEventMessage + " | " : "") + `${wildTransformAppliedCount} symbol(s) transformed to Wild!`;
      }
    }
  }
  // Reset nextSpinEffects. Symbol preview is already reset in page.tsx or should be reset here.
  // Wild count is reset after this spin.
  setters.setNextSpinEffects({ transformToWildCount: 0, symbolPreview: null });


  for (let i = 0; i < 9; i++) {
    if (!occupiedIndices.has(i)) {
      if (gameState.currentDeck.length > 0) {
        initialBoardSymbols[i] = gameState.currentDeck[Math.floor(Math.random() * gameState.currentDeck.length)];
      } else {
        initialBoardSymbols[i] = null as unknown as InstanceSymbolData; // Or handle empty deck scenario
      }
    }
  }
  // At this point, initialBoardSymbols is fully populated for this spin.
  // Update the board state for UI and for respin logic if a respin is triggered this turn.
  setters.setBoardSymbols(initialBoardSymbols.map(s => s ? {...s} : null));


  // === Main Spin Processing (AB, Lines, Bombs) ===
  let totalGainedThisSpin = 0;
  let combinedEffectMessage = spinEventMessage; // Start with messages from persistence/wilds

  const abResult = applyAdjacentBonusesLogic(initialBoardSymbols.map(s => s ? {...s} : null));
  if (abResult.gainedMedals > 0) {
    setters.setMedals(p => p + abResult.gainedMedals);
    totalGainedThisSpin += abResult.gainedMedals;
    combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + abResult.message;
    playSound('medal');
  }
  if (abResult.rareSymbolAppearanceModifier) {
    setters.setCurrentRareSymbolBonus(prev => Math.min(5, prev + abResult.rareSymbolAppearanceModifier!)); // Assuming a cap
    combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + `Rare chance up by ${abResult.rareSymbolAppearanceModifier}%!`;
  }
  // Handle symbolsToPersist from AB result by adding to nextTurnPersistingSymbolsList
  if (abResult.symbolsToPersist) {
    abResult.symbolsToPersist.forEach(newPInfo => {
        const baseSymbol = findSymbolDataByNo(newPInfo.symbol.no);
        if (baseSymbol) {
            const existingIndex = nextTurnPersistingSymbolsList.findIndex(p => p.index === newPInfo.index);
            if (existingIndex !== -1) nextTurnPersistingSymbolsList.splice(existingIndex, 1); // Replace if existing at same spot
            nextTurnPersistingSymbolsList.push({
                index: newPInfo.index,
                symbol: { ...baseSymbol, instanceId: uuidv4() }, // New instance for new persistence
                duration: newPInfo.duration,
                isGrowthSymbol: !!baseSymbol.growthTurns || !!baseSymbol.transformToSymbolNo,
            });
        }
    });
  }


  const dynamicBoardForLines: DynamicBoardSymbol[] = initialBoardSymbols.map(s => s ? { ...s } as DynamicSymbol : null);
  if (abResult.boardMutations) {
    abResult.boardMutations.forEach(mutation => {
      if (dynamicBoardForLines[mutation.index]) {
        const targetSymbol = dynamicBoardForLines[mutation.index];
        if (targetSymbol) {
          dynamicBoardForLines[mutation.index] = { ...targetSymbol, ...mutation.changes };
        }
      }
    });
  }

  let enemyDebuffsPreventedByBuckler = false;
  let debuffsToApplyFromEnemyThisTurn: Debuff[] = [];
  let updatedActiveDebuffs = gameState.activeDebuffs.map(d => ({ ...d, duration: d.duration - 1 })).filter(d => d.duration >= 0);


  if (gameState.currentEnemy) {
      const debuffApplicationInfo = applyEnemyDebuffsAndGetInfo();
      debuffsToApplyFromEnemyThisTurn = debuffApplicationInfo.debuffsAppliedThisTurn;
      debuffApplicationInfo.debuffMessages.forEach(msg => combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + msg);

      let preCheckBucklerActive = false;
      // Simplified Buckler check: if any Buckler on line, it might prevent enemy debuffs.
      // The line check itself will confirm if Buckler's line formed.
      // For Slot Goblin, the transformation happens before line check.
      const tempLineCheckForBuckler = checkLinesAndApplyEffects(dynamicBoardForLines, gameState.acquiredRelics, gameState.currentDeck, updatedActiveDebuffs, nextTurnPersistingSymbolsList);
      if (tempLineCheckForBuckler.debuffsPreventedThisSpin) {
          preCheckBucklerActive = true;
      }

      if (!preCheckBucklerActive && gameState.currentEnemy.name === "スロット・ゴブリン (Slot Goblin)") {
          const cursedMaskDef = findSymbolDataByNo(45); // Cursed Mask No
          if (cursedMaskDef && dynamicBoardForLines.some(s => s !== null)) {
              let rIdx = -1, attempts = 0;
              while (attempts < 20) {
                  const tempIdx = Math.floor(Math.random() * 9);
                  if (dynamicBoardForLines[tempIdx] !== null) { rIdx = tempIdx; break; }
                  attempts++;
              }
              if (rIdx !== -1 && dynamicBoardForLines[rIdx]) {
                  combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + `Goblin changed ${dynamicBoardForLines[rIdx]!.name.split(' ')[0]} to Cursed Mask!`;
                  dynamicBoardForLines[rIdx] = { ...cursedMaskDef, instanceId: `goblin_curse_${uuidv4()}` } as DynamicSymbol;
              }
          }
      } else if (preCheckBucklerActive && gameState.currentEnemy.name === "スロット・ゴブリン (Slot Goblin)") {
          combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + "Buckler prevents Goblin's trick!";
          enemyDebuffsPreventedByBuckler = true;
          // Assuming Slot Goblin effect is a specific type to filter out
          debuffsToApplyFromEnemyThisTurn = debuffsToApplyFromEnemyThisTurn.filter(d => d.type !== "SlotGoblinTransformationDebuff");
      }
  }
  updatedActiveDebuffs = [...updatedActiveDebuffs, ...debuffsToApplyFromEnemyThisTurn];
  setters.setActiveDebuffs(updatedActiveDebuffs);


  const lineCheckResults = checkLinesAndApplyEffects(
    dynamicBoardForLines,
    gameState.acquiredRelics,
    gameState.currentDeck,
    // allGameSymbols is imported now
    updatedActiveDebuffs,
    nextTurnPersistingSymbolsList // Pass the current state of persisting symbols
  );

  if (lineCheckResults.debuffsPreventedThisSpin && !enemyDebuffsPreventedByBuckler) {
      combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + "Buckler's protection active!";
      // If Buckler prevented general debuffs, filter them from `updatedActiveDebuffs`
      // This requires debuffs to have a specific marker or type if Buckler only prevents certain ones.
      // For simplicity, if Buckler is active, assume all negative debuffs applied THIS TURN are nullified.
      // This is a complex area depending on how specific debuff prevention should be.
  }

  if (lineCheckResults.gainedMedals > 0) { setters.setMedals(p => p + lineCheckResults.gainedMedals); totalGainedThisSpin += lineCheckResults.gainedMedals; playSound('lineWin'); if (lineCheckResults.formedLinesIndices && lineCheckResults.formedLinesIndices.length > 0) { setters.setHighlightedLine(lineCheckResults.formedLinesIndices[0]); setTimeout(() => setters.setHighlightedLine(null), 800); }}
// 'undefined' の可能性をチェック
  if (typeof lineCheckResults.additionalMedalsFromRG === 'number') {
    setters.setMedals(p => p + lineCheckResults.additionalMedalsFromRG!);
    totalGainedThisSpin += lineCheckResults.additionalMedalsFromRG!;
  }
  // または
  // const rgMedalsFromLine = lineCheckResults.additionalMedalsFromRG;
  // if (rgMedalsFromLine) {
  //   setters.setMedals(p => p + rgMedalsFromLine);
  //   totalGainedThisSpin += rgMedalsFromLine;
  // }
  if (lineCheckResults.message && lineCheckResults.message !== "No lines/effects.") { combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + lineCheckResults.message; }

  // Deck modifications from line effects
  let tempDeck = [...gameState.currentDeck];
  let deckChanged = false;
  if (lineCheckResults.symbolsToAddToDeck) {
    lineCheckResults.symbolsToAddToDeck.forEach(symbolBase => {
        const existingCurses = tempDeck.filter(s => s.name === "呪いの仮面 (Cursed Mask)").length;
        if (symbolBase.name === "呪いの仮面 (Cursed Mask)") {
            if (existingCurses < 3) { // Max 3 curses from daggers
                tempDeck.push({ ...symbolBase, instanceId: uuidv4() });
                combinedEffectMessage += ` | Curse Mask added to deck!`; deckChanged = true;
            }
        } else {
            tempDeck.push({ ...symbolBase, instanceId: uuidv4() });
            combinedEffectMessage += ` | ${symbolBase.name.split(' ')[0]} added to deck!`; deckChanged = true;
        }
    });
  }
  if (lineCheckResults.symbolsToRemoveFromDeckByName) {
    lineCheckResults.symbolsToRemoveFromDeckByName.forEach(nameToRemove => {
        const initialLength = tempDeck.length;
        tempDeck = tempDeck.filter(s => s.name !== nameToRemove);
        if (tempDeck.length < initialLength) {
            combinedEffectMessage += ` | ${nameToRemove} removed from deck!`; deckChanged = true;
            // If removing Rusted Lump by name, also clean up its progress
            if (nameToRemove === "錆びる鉄塊 (Rusted Lump)") {
                const newProgress = { ...gameState.rustedLumpProgress };
                let progressChanged = false;
                Object.keys(newProgress).forEach(instanceId => {
                    // This logic is tricky: if removed by name, all instances are gone from deck.
                    // We'd need to find which specific instance was removed if not all.
                    // For now, if "Rusted Lump" is removed by name, clear all its progress.
                    // This might need refinement if a specific instance is targeted for removal.
                    delete newProgress[instanceId];
                    progressChanged = true;
                });
                if(progressChanged) setters.setRustedLumpProgress(newProgress);
            }
        }
    });
  }


  // Process Rusted Lump counters
  if (lineCheckResults.incrementRustedLumpCounter) {
    const newProgress = { ...gameState.rustedLumpProgress };
    const steelSymbolDef = findSymbolDataByNo(1001); // "研磨された鋼"

    lineCheckResults.incrementRustedLumpCounter.forEach(instanceId => {
      const lumpInDeck = tempDeck.find(s => s.instanceId === instanceId);
      if (!lumpInDeck || lumpInDeck.no !== 9) return; // Ensure it's still a Rusted Lump in deck

      newProgress[instanceId] = {
        count: (newProgress[instanceId]?.count || 0) + 1,
      };

      if (newProgress[instanceId].count >= 3 && steelSymbolDef) {
        tempDeck = tempDeck.filter(s => s.instanceId !== instanceId); // Remove Rusted Lump
        tempDeck.push({ ...steelSymbolDef, instanceId: uuidv4() }); // Add Polished Steel
        delete newProgress[instanceId]; // Remove from progress tracking
        deckChanged = true;
        combinedEffectMessage += ` | ${lumpInDeck.name.split(' ')[0]} transformed to ${steelSymbolDef.name.split(' ')[0]} in deck!`;
        playSound('transform');
      }
    });
    setters.setRustedLumpProgress(newProgress);
  }
  if (deckChanged) setters.setCurrentDeck(tempDeck);


  // Board state modifications from line effects
  let boardStateAfterLines: DynamicBoardSymbol[] = [...dynamicBoardForLines];
  if (lineCheckResults.symbolsToRemoveFromBoard) {
    lineCheckResults.symbolsToRemoveFromBoard.forEach(index => {
      if (boardStateAfterLines[index]) {
        combinedEffectMessage += ` | ${boardStateAfterLines[index]!.name.split(' ')[0]} hunted & removed!`;
        boardStateAfterLines[index] = null;
      }
    });
  }
  if (lineCheckResults.newSymbolsOnBoardPostEffect) {
    lineCheckResults.newSymbolsOnBoardPostEffect.forEach(effect => {
      const newSymbolDef = findSymbolDataByNo(effect.symbolData.no);
      if (newSymbolDef) {
        boardStateAfterLines[effect.index] = { ...newSymbolDef, instanceId: uuidv4() } as DynamicSymbol;
        combinedEffectMessage += ` | ${newSymbolDef.name.split(' ')[0]} appears on board!`;
      }
    });
  }

  // Bombs
  let boardStateAfterBombs: DynamicBoardSymbol[] = [...boardStateAfterLines];
  if (lineCheckResults.bombsToExplode && lineCheckResults.bombsToExplode.length > 0) {
    playSound('bomb');
    const bombRes = handleBombExplosionsLogic(lineCheckResults.bombsToExplode, boardStateAfterLines );
    if (bombRes.gainedMedals > 0) { setters.setMedals(p => p + bombRes.gainedMedals); totalGainedThisSpin += bombRes.gainedMedals; playSound('medal');}
    boardStateAfterBombs = bombRes.newBoard;
    if (bombRes.message) { combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + bombRes.message;}
  }

  // Apply total spin bonuses from AB
  let finalTotalGainedThisSpin = totalGainedThisSpin;
  if (abResult.totalSpinMedalFlatBonus) {
    finalTotalGainedThisSpin += abResult.totalSpinMedalFlatBonus;
    // Medal setter was already called for AB direct gains, flat bonus should add to that.
    setters.setMedals(p => p + abResult.totalSpinMedalFlatBonus!);
    combinedEffectMessage += ` | Chain Link Total: +${abResult.totalSpinMedalFlatBonus}`;
  }
  if (abResult.totalSpinMedalMultiplier && abResult.totalSpinMedalMultiplier > 1) {
    // Multiplier applies to medals gained *after* flat bonuses or *before*?
    // Assuming it applies to the sum of (AB direct + Line Medals).
    const baseForMultiplier = totalGainedThisSpin; // Or (totalGainedThisSpin - abResult.totalSpinMedalFlatBonus) if flat bonus is separate.
    const multipliedGain = Math.floor(baseForMultiplier * abResult.totalSpinMedalMultiplier) - baseForMultiplier;
    if (multipliedGain > 0) {
        setters.setMedals(p => p + multipliedGain);
        finalTotalGainedThisSpin += multipliedGain;
    }
    combinedEffectMessage += ` | Entangling Vine Total: x${abResult.totalSpinMedalMultiplier.toFixed(2)}`;
  }
  // totalGainedThisSpin = finalTotalGainedThisSpin; // For enemy damage calculation

  // Update board symbols displayed to user
  setters.setBoardSymbols(boardStateAfterBombs.map(s => s ? { ...s } : null));
  setters.setLineMessage(combinedEffectMessage.trim().replace(/^ \| /, '') || "No bonuses or lines.");

  // Update persisting symbols for next turn (combining existing, AB-added, Line-added)
  // nextTurnPersistingSymbolsList already has existing decremented ones and AB-added ones.
  // Now add from Line Effects.
  if (lineCheckResults.newPersistingSymbolsFromLineEffect) {
      lineCheckResults.newPersistingSymbolsFromLineEffect.forEach(newP => {
        const existingIdx = nextTurnPersistingSymbolsList.findIndex(elp => elp.index === newP.index);
        if (existingIdx !== -1) nextTurnPersistingSymbolsList.splice(existingIdx, 1); // Replace
        nextTurnPersistingSymbolsList.push(newP);
      });
  }
  setters.setPersistingSymbols(nextTurnPersistingSymbolsList);


  // Handle items awarded
  if (lineCheckResults.itemsAwarded && lineCheckResults.itemsAwarded.length > 0) {
    lineCheckResults.itemsAwarded.forEach(item => {
      if (item.type === "RelicFragment") {
        setters.setGameMessage(prev => `${prev ? prev + " | " : ""}Gained a Relic Fragment!`);
        // Actual relic fragment gain logic would be here (e.g., incrementing a counter)
      }
    });
  }

  // Handle one-time spin cost modifier from Wooden Shield
  if (lineCheckResults.nextSpinCostModifier) {
    setters.setOneTimeSpinCostModifier(lineCheckResults.nextSpinCostModifier);
  } else {
    setters.setOneTimeSpinCostModifier(1); // Reset if not applied this turn
  }


  // Enemy HP update
  if (gameState.currentEnemy && finalTotalGainedThisSpin > 0) { // Use finalTotalGainedThisSpin
    const newEnemyHPVal = Math.max(0, gameState.enemyHP - finalTotalGainedThisSpin);
    setters.setEnemyHP(newEnemyHPVal);
    if (newEnemyHPVal <= 0) {
        handleEnemyDefeat(gameState.currentEnemy.name);
    }
  }

  // Handle Respin Request from Line Check
  if (lineCheckResults.requestRespin && !gameState.respinState?.active) {
    setters.setRespinState({ ...lineCheckResults.requestRespin, active: true });
    // The respin itself will be handled at the very start of the next call to processSpin.
  }

  // Handle Next Spin Effects from Line Check
  if (lineCheckResults.transformToWildOnNextSpinCount) {
    setters.setNextSpinEffects(prev => ({
      ...prev, // Keep existing preview if any
      transformToWildCount: prev.transformToWildCount + lineCheckResults.transformToWildOnNextSpinCount!,
    }));
  }
  if (lineCheckResults.previewSymbolsForNextSpin) {
    setters.setNextSpinEffects(prev => ({
      ...prev, // Keep existing wild count if any
      symbolPreview: lineCheckResults.previewSymbolsForNextSpin!,
    }));
  }


  // Decrement counters for cost increase and enemy spawn
  if (gameState.nextCostIncreaseIn > 0) setters.setNextCostIncreaseIn(prev => prev - 1);
  else if (gameState.nextCostIncreaseIn === 0) { /* Cost increase logic is in page.tsx's handleTurnResolution */ }

  if (gameState.nextEnemyIn > 0 && gameState.currentEnemy === null) setters.setNextEnemyIn(prev => prev - 1);
  else if (gameState.nextEnemyIn === 0 && gameState.currentEnemy === null) { /* Enemy spawn is in page.tsx's handleTurnResolution */ }


  // Trigger end-of-turn resolution (symbol/relic acquisition, new enemy, cost increase)
  // Only if not currently in a respin sequence that's about to start.
  if (!gameState.isGameOver && !(gameState.respinState && gameState.respinState.active)) {
    triggerTurnResolution(nextSpinCount);
  } else if (gameState.isGameOver) {
    // If game over happened during the spin (e.g. medals < 0 after line effects)
    // ensure it's properly handled.
  }
};