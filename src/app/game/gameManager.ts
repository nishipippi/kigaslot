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

    // === Apply On-Board Medal Generation for specific symbols (like Coins) during Respin ===
    let onBoardMedalGenerationMessageRespin = "";
    let medalsFromOnBoardGenerationRespin = 0;
    boardForRespin.forEach(symbol => {
      if (symbol) {
        let gain = 0;
        switch (symbol.no) {
          case 1: gain = 2; break; // Bronze Coin
          case 2: gain = 4; break; // Silver Coin
          case 3: gain = 6; break; // Gold Coin
        }
        if (gain > 0) {
          medalsFromOnBoardGenerationRespin += gain;
          if (onBoardMedalGenerationMessageRespin) onBoardMedalGenerationMessageRespin += " | ";
          onBoardMedalGenerationMessageRespin += `${symbol.name.split(' ')[0]} +${gain}`;
        }
      }
    });
    if (medalsFromOnBoardGenerationRespin > 0) {
      setters.setMedals(p => p + medalsFromOnBoardGenerationRespin);
      playSound('medal'); 
    }
    // Prepend to combinedEffectMessageRespin
    let combinedEffectMessageRespin = medalsFromOnBoardGenerationRespin > 0 ? onBoardMedalGenerationMessageRespin : "Respin Results: ";


    // --- Continue with AB, Line Check, etc. for respin ---
    const abResultRespin = applyAdjacentBonusesLogic(boardForRespin.map(s => s ? {...s} : null), gameState.acquiredRelics);
    if (abResultRespin.gainedMedals > 0) {
      setters.setMedals(p => p + abResultRespin.gainedMedals);
      combinedEffectMessageRespin = (combinedEffectMessageRespin ? combinedEffectMessageRespin + " | " : "") + abResultRespin.message;
      playSound('medal');
    }

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

    const lineCheckResultsRespin = checkLinesAndApplyEffects(
        dynamicBoardForLinesRespin, gameState.acquiredRelics, gameState.currentDeck,
        gameState.activeDebuffs 
    );

    // ---- START NEW LOGIC for respinMultiplier ----
    let actualRespinGainedMedals = lineCheckResultsRespin.gainedMedals;
    // @ts-expect-error respinMultiplier might not be on type yet
    const multiplier = gameState.respinState.respinMultiplier; 

    if (multiplier && multiplier > 0 && actualRespinGainedMedals > 0) {
        const originalMedals = actualRespinGainedMedals;
        actualRespinGainedMedals = Math.floor(actualRespinGainedMedals * multiplier);
        if (actualRespinGainedMedals > originalMedals) {
            combinedEffectMessageRespin += ` (Arrow x${multiplier.toFixed(1)})`;
        }
    }
    // ---- END NEW LOGIC for respinMultiplier ----

    if (lineCheckResultsRespin.requestRespin) {
        console.warn("Respin triggered another respin request. Ignoring to prevent loop.");
        lineCheckResultsRespin.requestRespin = undefined;
    }
    if (actualRespinGainedMedals > 0) { // Use actualRespinGainedMedals
        setters.setMedals(p => p + actualRespinGainedMedals); // Use the potentially modified value
        playSound('lineWin');
        if (lineCheckResultsRespin.formedLinesIndices && lineCheckResultsRespin.formedLinesIndices.length > 0) {
            setters.setHighlightedLine(lineCheckResultsRespin.formedLinesIndices[0]);
            setTimeout(() => setters.setHighlightedLine(null), 800);
        }
    }

    if (typeof lineCheckResultsRespin.additionalMedalsFromRG === 'number') {
        setters.setMedals(p => p + lineCheckResultsRespin.additionalMedalsFromRG!);
    }

    if (lineCheckResultsRespin.message && lineCheckResultsRespin.message !== "No lines/effects.") {
        combinedEffectMessageRespin = (combinedEffectMessageRespin ? combinedEffectMessageRespin + " | " : "") + lineCheckResultsRespin.message;
    }
    let boardAfterRespinBombs = dynamicBoardForLinesRespin;
    if (lineCheckResultsRespin.bombsToExplode && lineCheckResultsRespin.bombsToExplode.length > 0) {
        playSound('bomb');
        const bombRes = handleBombExplosionsLogic(lineCheckResultsRespin.bombsToExplode, dynamicBoardForLinesRespin);
        if (bombRes.gainedMedals > 0) { setters.setMedals(p => p + bombRes.gainedMedals); playSound('medal');}
        boardAfterRespinBombs = bombRes.newBoard;
        if (bombRes.message) { combinedEffectMessageRespin = (combinedEffectMessageRespin ? combinedEffectMessageRespin + " | " : "") + bombRes.message;}
    }

    setters.setBoardSymbols(boardAfterRespinBombs.map(s => s ? { ...s } : null));
    setters.setLineMessage(combinedEffectMessageRespin.trim().replace(/^Respin Results:  \| /, 'Respin Results: ').replace(/^ \| /, ''));
    
    // === Cost Modifier Logic for NEXT spin (after respin) ===
    let nextSpinCostModRespin = 1.0;
    if (lineCheckResultsRespin.nextSpinCostModifier) { // e.g., Wooden Shield from respin
        nextSpinCostModRespin = lineCheckResultsRespin.nextSpinCostModifier;
    }

    if (gameState.acquiredRelics.some(r => r.name === "群れの結束 (Pack Unity)")) { // Relic No. 9
        const animalCountRespin = boardAfterRespinBombs.filter(s => s && s.attribute === "Animal").length;
        if (animalCountRespin >= 3) {
            const modBeforePackUnity = nextSpinCostModRespin;
            let modAfterPackUnity = modBeforePackUnity * 0.95;

            // Pack Unity's cap: it won't reduce the modifier below 0.8 if it was >0.8 before its application.
            if (modBeforePackUnity > 0.8 && modAfterPackUnity < 0.8) {
                modAfterPackUnity = 0.8;
            }
            // If modBeforePackUnity was already <= 0.8, Pack Unity doesn't provide further reduction.
            if (modBeforePackUnity <= 0.8) {
                 modAfterPackUnity = modBeforePackUnity;
            }

            if (modAfterPackUnity < modBeforePackUnity) {
                nextSpinCostModRespin = modAfterPackUnity;
                setters.setGameMessage(prev => (prev ? prev + " | " : "") + `Pack Unity: Next cost x${nextSpinCostModRespin.toFixed(2)}! (After Respin)`);
            }
        }
    }
    setters.setOneTimeSpinCostModifier(nextSpinCostModRespin);
    // === End Cost Modifier Logic (after respin) ===

    setters.setRespinState(null); // End respin state

    if (gameState.medals <= 0 && !gameState.isGameOver) { 
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
  }

  const nextSpinCount = gameState.spinCount + 1;
  setters.setSpinCount(nextSpinCount);
  setters.setLineMessage(""); 
  setters.setGameMessage(""); 

  // === Persisting Symbols & Growth Pre-spin Update ===
  const currentPersistingSymbolsList = [...gameState.persistingSymbols];
  const boardSymbolsFromPersistence: (InstanceSymbolData | null)[] = Array(9).fill(null);
  const nextTurnPersistingSymbolsList: PersistingSymbolInfo[] = [];
  const messagesFromGrowthAndPersistence: string[] = [];

  currentPersistingSymbolsList.forEach(ps => {
    let currentSymbolInPersistence = { ...ps.symbol };
    let newDuration = ps.duration - 1;
    let transformedThisTurn = false;

    const symbolDef = findSymbolDataByNo(currentSymbolInPersistence.no); 
    if (symbolDef?.generatesMedalOnBoard && symbolDef.generatesMedalOnBoard > 0) {
        setters.setMedals(prev => prev + symbolDef.generatesMedalOnBoard!);
        messagesFromGrowthAndPersistence.push(`${symbolDef.name.split(' ')[0]} generated +${symbolDef.generatesMedalOnBoard} medals!`);
    }

    if (ps.isGrowthSymbol && newDuration < 0) { 
      const growthDefinition = symbolDef?.transformToSymbolNo ? findSymbolDataByNo(symbolDef.transformToSymbolNo) : null;
      if (growthDefinition) {
        currentSymbolInPersistence = { ...growthDefinition, instanceId: ps.symbol.instanceId }; 
        messagesFromGrowthAndPersistence.push(`${symbolDef!.name.split(' ')[0]} transformed into ${currentSymbolInPersistence.name.split(' ')[0]}!`);
        playSound('transform');
        transformedThisTurn = true;
      } else {
         newDuration = -1; 
      }
    }

    if (newDuration >= 0) {
        nextTurnPersistingSymbolsList.push({ ...ps, symbol: currentSymbolInPersistence, duration: newDuration });
        boardSymbolsFromPersistence[ps.index] = currentSymbolInPersistence;
    } else if (transformedThisTurn) {
        boardSymbolsFromPersistence[ps.index] = currentSymbolInPersistence;
    }
  });

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

  // === START RELIC INTEGRATION FOR MAGNETIC CORE & WILD GEM ===

  // Wild Gem Logic (places first, as it's rarer and more impactful)
  if (gameState.acquiredRelics.find(r => r.no === 15) && gameState.currentDeck.some(s => s.no === 44)) { // Relic No. 15, Symbol No. 44 (Wild)
      if (Math.random() < 0.05) { // 5% chance
          const wildSymbolDef = findSymbolDataByNo(44);
          if (wildSymbolDef) {
              const emptySlotsForWildGem = [];
              for(let i=0; i<9; i++) { if(!occupiedIndices.has(i)) emptySlotsForWildGem.push(i); }
              if (emptySlotsForWildGem.length > 0) {
                  const targetSlot = emptySlotsForWildGem[Math.floor(Math.random() * emptySlotsForWildGem.length)];
                  initialBoardSymbols[targetSlot] = { ...wildSymbolDef, instanceId: `wildgem_${uuidv4()}` };
                  occupiedIndices.add(targetSlot);
                  spinEventMessage = (spinEventMessage ? spinEventMessage + " | " : "") + "Wild Gem places a Wild!";
                  playSound('relic'); // Generic relic activation sound
              }
          }
      }
  }

  // Magnetic Core Logic
  if (gameState.acquiredRelics.find(r => r.no === 2)) { // Relic No. 2
      if (Math.random() < 0.1) { // 10% chance
          const emptySlotsForCore = [];
          for(let i=0; i<9; i++) { if(!occupiedIndices.has(i)) emptySlotsForCore.push(i); }

          if (emptySlotsForCore.length > 0) {
              const targetSlot = emptySlotsForCore[Math.floor(Math.random() * emptySlotsForCore.length)];
              const coinNos = [1, 2, 3]; // Bronze, Silver, Gold Coin
              const randomCoinNo = coinNos[Math.floor(Math.random() * coinNos.length)];
              const coinSymbolDef = findSymbolDataByNo(randomCoinNo);
              if (coinSymbolDef) {
                  initialBoardSymbols[targetSlot] = { ...coinSymbolDef, instanceId: `corecoin_${uuidv4()}` };
                  occupiedIndices.add(targetSlot);
                  spinEventMessage = (spinEventMessage ? spinEventMessage + " | " : "") + `Magnetic Core generates ${coinSymbolDef.name.split(' ')[0]}!`;
                  playSound('relic'); // Generic relic activation sound
              }
          }
      }
  }
  // === END RELIC INTEGRATION ===

  // Apply nextSpinEffects (Wild Transformation)
  let wildTransformAppliedCount = 0;
  const availableSlotsForWild: number[] = [];
  for (let i = 0; i < 9; i++) { if (!occupiedIndices.has(i)) availableSlotsForWild.push(i); }

  if (gameState.nextSpinEffects.transformToWildCount > 0 && availableSlotsForWild.length > 0) {
    const wildSymbolDataDef = findSymbolDataByNo(44); 
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
  setters.setNextSpinEffects({ transformToWildCount: 0, symbolPreview: null });


  for (let i = 0; i < 9; i++) {
    if (!occupiedIndices.has(i)) {
      if (gameState.currentDeck.length > 0) {
        initialBoardSymbols[i] = gameState.currentDeck[Math.floor(Math.random() * gameState.currentDeck.length)];
      } else {
        initialBoardSymbols[i] = null as unknown as InstanceSymbolData; 
      }
    }
  }
  // At this point, initialBoardSymbols is fully populated for the normal spin.

  // === Apply On-Board Medal Generation for specific symbols (like Coins) ===
  let onBoardMedalGenerationMessage = "";
  let medalsFromOnBoardGeneration = 0;
  initialBoardSymbols.forEach(symbol => {
    if (symbol) {
      let gain = 0;
      switch (symbol.no) {
        case 1: // Bronze Coin
          gain = 2;
          break;
        case 2: // Silver Coin
          gain = 5;
          break;
        case 3: // Gold Coin
          gain = 12;
          break;
      }
      if (gain > 0) {
        medalsFromOnBoardGeneration += gain;
        if (onBoardMedalGenerationMessage) onBoardMedalGenerationMessage += " | ";
        onBoardMedalGenerationMessage += `${symbol.name.split(' ')[0]} +${gain}`;
      }
    }
  });

  if (medalsFromOnBoardGeneration > 0) {
    setters.setMedals(p => p + medalsFromOnBoardGeneration);
    playSound('medal'); // Or a specific sound for coin collection
    if (spinEventMessage) spinEventMessage += " | ";
    spinEventMessage += onBoardMedalGenerationMessage;
  }
  // End of On-Board Medal Generation for Coins

  setters.setBoardSymbols(initialBoardSymbols.map(s => s ? {...s} : null));


  // === Main Spin Processing (AB, Lines, Bombs) ===
  let totalGainedThisSpin = 0;
  let combinedEffectMessage = spinEventMessage; 

  const abResult = applyAdjacentBonusesLogic(initialBoardSymbols.map(s => s ? {...s} : null), gameState.acquiredRelics); // Pass relics
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
  if (abResult.symbolsToPersist) {
    abResult.symbolsToPersist.forEach(newPInfo => {
        const baseSymbol = findSymbolDataByNo(newPInfo.symbol.no);
        if (baseSymbol) {
            const existingIndex = nextTurnPersistingSymbolsList.findIndex(p => p.index === newPInfo.index);
            if (existingIndex !== -1) nextTurnPersistingSymbolsList.splice(existingIndex, 1); 
            nextTurnPersistingSymbolsList.push({
                index: newPInfo.index,
                symbol: { ...baseSymbol, instanceId: uuidv4() }, 
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
      const tempLineCheckForBuckler = checkLinesAndApplyEffects(dynamicBoardForLines, gameState.acquiredRelics, gameState.currentDeck, updatedActiveDebuffs );
      if (tempLineCheckForBuckler.debuffsPreventedThisSpin) {
          preCheckBucklerActive = true;
      }

      if (!preCheckBucklerActive && gameState.currentEnemy.name === "スロット・ゴブリン (Slot Goblin)") {
          const cursedMaskDef = findSymbolDataByNo(45); 
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
          debuffsToApplyFromEnemyThisTurn = debuffsToApplyFromEnemyThisTurn.filter(d => d.type !== "SlotGoblinTransformationDebuff");
      }
  }
  updatedActiveDebuffs = [...updatedActiveDebuffs, ...debuffsToApplyFromEnemyThisTurn];
  setters.setActiveDebuffs(updatedActiveDebuffs);


  const lineCheckResults = checkLinesAndApplyEffects(
    dynamicBoardForLines,
    gameState.acquiredRelics,
    gameState.currentDeck,
    updatedActiveDebuffs
  );

  if (lineCheckResults.debuffsPreventedThisSpin && !enemyDebuffsPreventedByBuckler) {
      combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + "Buckler's protection active!";
  }

  if (lineCheckResults.gainedMedals > 0) { setters.setMedals(p => p + lineCheckResults.gainedMedals); totalGainedThisSpin += lineCheckResults.gainedMedals; playSound('lineWin'); if (lineCheckResults.formedLinesIndices && lineCheckResults.formedLinesIndices.length > 0) { setters.setHighlightedLine(lineCheckResults.formedLinesIndices[0]); setTimeout(() => setters.setHighlightedLine(null), 800); }}

  if (typeof lineCheckResults.additionalMedalsFromRG === 'number') {
    setters.setMedals(p => p + lineCheckResults.additionalMedalsFromRG!);
    totalGainedThisSpin += lineCheckResults.additionalMedalsFromRG!;
  }

  if (lineCheckResults.message && lineCheckResults.message !== "No lines/effects.") { combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + lineCheckResults.message; }

  // Deck modifications from line effects
  let tempDeck = [...gameState.currentDeck];
  let deckChanged = false;
  if (lineCheckResults.symbolsToAddToDeck) {
    lineCheckResults.symbolsToAddToDeck.forEach(symbolBase => {
        const existingCurses = tempDeck.filter(s => s.name === "呪いの仮面 (Cursed Mask)").length;
        if (symbolBase.name === "呪いの仮面 (Cursed Mask)") {
            if (existingCurses < 3) { 
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
            if (nameToRemove === "錆びる鉄塊 (Rusted Lump)") {
                const newProgress = { ...gameState.rustedLumpProgress };
                let progressChanged = false;
                Object.keys(newProgress).forEach(instanceId => {
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
    const steelSymbolDef = findSymbolDataByNo(1001); 

    lineCheckResults.incrementRustedLumpCounter.forEach(instanceId => {
      const lumpInDeck = tempDeck.find(s => s.instanceId === instanceId);
      if (!lumpInDeck || lumpInDeck.no !== 9) return; 

      newProgress[instanceId] = {
        count: (newProgress[instanceId]?.count || 0) + 1,
      };

      if (newProgress[instanceId].count >= 3 && steelSymbolDef) {
        tempDeck = tempDeck.filter(s => s.instanceId !== instanceId); 
        tempDeck.push({ ...steelSymbolDef, instanceId: uuidv4() }); 
        delete newProgress[instanceId]; 
        deckChanged = true;
        combinedEffectMessage += ` | ${lumpInDeck.name.split(' ')[0]} transformed to ${steelSymbolDef.name.split(' ')[0]} in deck!`;
        playSound('transform');
      }
    });
    setters.setRustedLumpProgress(newProgress);
  }
  if (deckChanged) setters.setCurrentDeck(tempDeck);


  // Board state modifications from line effects
  const boardStateAfterLines: DynamicBoardSymbol[] = [...dynamicBoardForLines];
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
    setters.setMedals(p => p + abResult.totalSpinMedalFlatBonus!);
    combinedEffectMessage += ` | Chain Link Total: +${abResult.totalSpinMedalFlatBonus}`;
  }
  if (abResult.totalSpinMedalMultiplier && abResult.totalSpinMedalMultiplier > 1) {
    const baseForMultiplier = totalGainedThisSpin; 
    const multipliedGain = Math.floor(baseForMultiplier * abResult.totalSpinMedalMultiplier) - baseForMultiplier;
    if (multipliedGain > 0) {
        setters.setMedals(p => p + multipliedGain);
        finalTotalGainedThisSpin += multipliedGain;
    }
    combinedEffectMessage += ` | Entangling Vine Total: x${abResult.totalSpinMedalMultiplier.toFixed(2)}`;
  }

  setters.setBoardSymbols(boardStateAfterBombs.map(s => s ? { ...s } : null)); // Update board *before* setting line message
  setters.setLineMessage(combinedEffectMessage.trim().replace(/^ \| /, '') || "No bonuses or lines.");

  if (lineCheckResults.newPersistingSymbolsFromLineEffect) {
      lineCheckResults.newPersistingSymbolsFromLineEffect.forEach(newP => {
        const existingIdx = nextTurnPersistingSymbolsList.findIndex(elp => elp.index === newP.index);
        if (existingIdx !== -1) nextTurnPersistingSymbolsList.splice(existingIdx, 1); 
        nextTurnPersistingSymbolsList.push(newP);
      });
  }
  setters.setPersistingSymbols(nextTurnPersistingSymbolsList);


  // Handle items awarded
  if (lineCheckResults.itemsAwarded && lineCheckResults.itemsAwarded.length > 0) {
    lineCheckResults.itemsAwarded.forEach(item => {
      if (item.type === "RelicFragment") {
        setters.setGameMessage(prev => `${prev ? prev + " | " : ""}Gained a Relic Fragment!`);
      }
    });
  }

  // Handle one-time spin cost modifier (Wooden Shield, Pack Unity)
  let nextSpinModToSet = 1.0;
  const relevantLCR = (gameState.respinState?.active && gameState.respinState.triggeredBySymbolInstanceId) ? null : lineCheckResults; // Pack Unity applies after respin, not from respin's LCR

  if (relevantLCR && relevantLCR.nextSpinCostModifier) {
      nextSpinModToSet = relevantLCR.nextSpinCostModifier;
  }

  if (gameState.acquiredRelics.some(r => r.no === 9)) { // Relic No. 9: Pack Unity
      const finalBoardForPackUnity = (gameState.respinState?.active && !gameState.respinState.triggeredBySymbolInstanceId) 
          ? boardAfterRespinBombs // This case might need refinement if respins can't trigger PU
          : boardStateAfterBombs; // Normal spin path

      const animalSymbolCount = finalBoardForPackUnity.filter(s => s && s.attribute === "Animal").length;

      if (animalSymbolCount >= 3) {
          const currentBaseModifier = nextSpinModToSet; // What it would be from Shield or default 1.0
          let modifierWithPackUnityEffect = currentBaseModifier * 0.95;
          
          // Pack Unity's effect is capped such that it won't reduce the cost factor below 0.8 by its own action.
          // If currentBaseModifier is already low, Pack Unity might not add much or any reduction.
          // Example: if currentBaseModifier = 0.85, PackUnity makes it 0.85 * 0.95 = 0.8075. Max(0.8, 0.8075) = 0.8075
          // Example: if currentBaseModifier = 0.80, PackUnity makes it 0.80 * 0.95 = 0.76. Max(0.8, 0.76) = 0.8
          // This logic means Pack Unity aims for a 5% reduction of the current mod, but stops if that would take it below 0.8.
          modifierWithPackUnityEffect = Math.max(0.8, modifierWithPackUnityEffect);

          if (modifierWithPackUnityEffect < currentBaseModifier) {
              nextSpinModToSet = modifierWithPackUnityEffect;
              // Add a general game message, specific message formatting can be handled by the UI component
              setters.setGameMessage(prev => (prev ? prev + " | " : "") + `Pack Unity reduced next spin cost! (x${nextSpinModToSet.toFixed(2)})`);
          }
      }
  }
  setters.setOneTimeSpinCostModifier(nextSpinModToSet);
  // End Handle one-time spin cost modifier

  // Initialize new growth symbols that landed on board if not already persisting
  initialBoardSymbols.forEach((boardSymbol, index) => {
    if (boardSymbol) {
      const symbolDef = findSymbolDataByNo(boardSymbol.no);
      if (symbolDef && symbolDef.growthTurns && symbolDef.growthTurns > 0) {
        // Check if this index is already managed by an existing persisting symbol (e.g. from AB or Line effects)
        const alreadyPersisting = nextTurnPersistingSymbolsList.some(ps => ps.index === index);
        if (!alreadyPersisting) {
          let initialDuration = symbolDef.growthTurns;
          // Apply "Droplet of the Life Spring" (Relic No. 4) for "Growing Seed" (Symbol No. 18)
          if (symbolDef.no === 18 && gameState.acquiredRelics.some(r => r.no === 4)) {
            initialDuration = Math.max(1, symbolDef.growthTurns - 2);
             // Add a message if a seed's growth was accelerated
             if (initialDuration < symbolDef.growthTurns) {
                combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + 
                                      `${symbolDef.name} growth accelerated by Droplet!`;
             }
          }
          nextTurnPersistingSymbolsList.push({
            index,
            symbol: { ...boardSymbol }, // Use the instance on board
            duration: initialDuration,
            isGrowthSymbol: true,
          });
        }
      }
    }
  });
  // === End Initialize new growth symbols ===

  // Enemy HP update
  if (gameState.currentEnemy && finalTotalGainedThisSpin > 0) { 
    const newEnemyHPVal = Math.max(0, gameState.enemyHP - finalTotalGainedThisSpin);
    setters.setEnemyHP(newEnemyHPVal);
    if (newEnemyHPVal <= 0) {
        handleEnemyDefeat(gameState.currentEnemy.name);
    }
  }

  // Handle Respin Request from Line Check
  let respinWasRequested = false;
  // Use 'lineCheckResults' for normal spin, 'lineCheckResultsRespin' for respin effects
  const finalLCRForRespinRequest = (gameState.respinState?.active && gameState.respinState.triggeredBySymbolInstanceId && lineCheckResultsRespin) ? lineCheckResultsRespin : lineCheckResults;

  if (finalLCRForRespinRequest.requestRespin && !respinWasRequestedDuringThisCall) { // respinWasRequestedDuringThisCall to prevent loops if respin also requests respin
    setters.setRespinState({ ...finalLCRForRespinRequest.requestRespin, active: true });
    respinWasRequested = true; // This is for the outer logic to know a respin is now pending
    // If this is a respin itself, this path should ideally be blocked earlier (e.g. lineCheckResultsRespin.requestRespin = undefined)
  }
  
  // Handle Next Spin Effects from Line Check
  // Use 'lineCheckResults' for normal spin, 'lineCheckResultsRespin' for respin effects
  // const finalLCRForNextSpinEffects = (gameState.respinState?.active && gameState.respinState.triggeredBySymbolInstanceId && lineCheckResultsRespin) ? lineCheckResultsRespin : lineCheckResults;
  if (lineCheckResults.transformToWildOnNextSpinCount) {
    setters.setNextSpinEffects(prev => ({
      ...prev, 
      transformToWildCount: prev.transformToWildCount + lineCheckResults.transformToWildOnNextSpinCount!,
    }));
  }
  if (lineCheckResults.previewSymbolsForNextSpin) {
    setters.setNextSpinEffects(prev => ({
      ...prev, 
      symbolPreview: lineCheckResults.previewSymbolsForNextSpin!,
    }));
  }

  // Decrement counters and trigger turn resolution
  if (!gameState.isGameOver) {
    // If a respin was just requested by THIS spin (normal or respin), defer turn resolution.
    if (respinWasRequested) { 
        // Counters (nextCostIncreaseIn, nextEnemyIn) should not be decremented here.
        // They will be handled when the requested respin is processed or after it.
    } else if (gameState.respinState?.active && !gameState.respinState.triggeredBySymbolInstanceId) {
        // This is the respin path completing, it should not trigger another turn resolution.
        // Respin completion is handled by returning from the respin block.
        // The original spin that triggered it would have already handled its turn resolution or deferred it.
        // Resetting respinState is done at the end of the respin block.
    }
     else { // Normal spin path without a new respin request, or a respin that doesn't trigger another.
      if (gameState.nextCostIncreaseIn > 0) setters.setNextCostIncreaseIn(prev => prev - 1);
      if (gameState.nextEnemyIn > 0 && gameState.currentEnemy === null) setters.setNextEnemyIn(prev => prev - 1);
      triggerTurnResolution(nextSpinCount);
    }
  }
};