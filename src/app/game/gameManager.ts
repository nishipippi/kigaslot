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
} from './symbollogic';
import { symbols as allGameSymbols } from '@/data/symbols';
import { v4 as uuidv4 } from 'uuid';

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
  respinState: RespinState | null;
  nextSpinEffects: NextSpinEffects;
  rustedLumpProgress: RustedLumpProgress;
  boardSymbols: BoardSymbolBase[];
  packUnityDiscount: number;
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
  setRespinState: React.Dispatch<React.SetStateAction<RespinState | null>>;
  setNextSpinEffects: React.Dispatch<React.SetStateAction<NextSpinEffects>>;
  setRustedLumpProgress: React.Dispatch<React.SetStateAction<RustedLumpProgress>>;
  setPackUnityDiscount: React.Dispatch<React.SetStateAction<number>>;
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
  const currentActualSpinCost = Math.max(
    1,
    Math.round(gameState.spinCost * (1 - gameState.packUnityDiscount) * gameState.oneTimeSpinCostModifier)
  );

  const isRespinExecution = gameState.respinState && gameState.respinState.active;

  // --- Respin Pre-check ---
  if (isRespinExecution) {
    playSound('respin');
    setters.setHighlightedLine(null);
    setters.setLineMessage("");
    setters.setGameMessage("Respinning!");

    const boardForRespin: InstanceSymbolData[] = Array(9).fill(null) as unknown as InstanceSymbolData[];
    const respinType = gameState.respinState!.type; // gameState.respinState is checked by isRespinExecution
    const columnsToRespin = gameState.respinState!.columnsToRespin || [];

    const currentBoardSnapshot = [...gameState.boardSymbols];

    for (let i = 0; i < 9; i++) {
        const c = i % 3;
        let shouldPopulateNew = false;
        if (respinType === 'phoenix_all_columns') {
            shouldPopulateNew = true;
        } else if (respinType === 'arrow_column' && columnsToRespin.includes(c)) {
            shouldPopulateNew = true;
        }

        if (shouldPopulateNew) {
            const persistingSymbolInSlot = gameState.persistingSymbols.find(ps => ps.index === i && !ps.isGrowthSymbol);
            if (persistingSymbolInSlot) {
                boardForRespin[i] = persistingSymbolInSlot.symbol;
            } else if (gameState.currentDeck.length > 0) {
                boardForRespin[i] = gameState.currentDeck[Math.floor(Math.random() * gameState.currentDeck.length)];
            } else {
                boardForRespin[i] = null as unknown as InstanceSymbolData;
            }
        } else {
            boardForRespin[i] = currentBoardSnapshot[i] as InstanceSymbolData;
        }
    }
    gameState.persistingSymbols.forEach(ps => {
        if (ps.duration >= 0 && !ps.isGrowthSymbol) {
            boardForRespin[ps.index] = ps.symbol;
        }
    });

    let onBoardMedalGenerationMessageRespin = "";
    let medalsFromOnBoardGenerationRespin = 0;
    boardForRespin.forEach(symbol => {
      if (symbol) {
        let gain = 0;
        switch (symbol.no) {
          case 1: gain = 2; break;
          case 2: gain = 4; break; // Silver Coin value was 4 in provided code, not 5. Keeping 4.
          case 3: gain = 6; break; // Gold Coin value was 6, not 12. Keeping 6.
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
    let combinedEffectMessageRespin = medalsFromOnBoardGenerationRespin > 0 ? onBoardMedalGenerationMessageRespin : "Respin Results: ";

    const abResultRespin = applyAdjacentBonusesLogic(
        boardForRespin.map(s => s ? {...s} : null),
        gameState.acquiredRelics
    );
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
        dynamicBoardForLinesRespin,
        gameState.acquiredRelics,
        gameState.currentDeck,
        gameState.activeDebuffs // リスピン時は敵のデバフは再適用しない想定。必要なら修正。
    );

    if (lineCheckResultsRespin.requestRespin) {
        console.warn("Respin triggered another respin request. Ignoring to prevent loop.");
        lineCheckResultsRespin.requestRespin = undefined;
    }

    let totalMedalsFromRespinLines = lineCheckResultsRespin.gainedMedals;
    let trueAimFeatherBonus = 0;

    if (gameState.respinState!.type === 'arrow_column' &&
        gameState.acquiredRelics.some(r => r.no === 12) &&
        lineCheckResultsRespin.gainedMedals > 0 &&
        lineCheckResultsRespin.formedLinesIndices.length > 0) {
        const respunCols = gameState.respinState!.columnsToRespin || [];
        const lineIntersects = lineCheckResultsRespin.formedLinesIndices.some(line =>
            line.some(idx => respunCols.includes(idx % 3))
        );
        if (lineIntersects) {
            const originalMedals = lineCheckResultsRespin.gainedMedals;
            const multiplied = Math.floor(originalMedals * 1.2);
            trueAimFeatherBonus = multiplied - originalMedals;
            if (trueAimFeatherBonus > 0) {
                 combinedEffectMessageRespin = (combinedEffectMessageRespin ? combinedEffectMessageRespin + " | " : "") + `True-Aim Feather boosts respin line by +${trueAimFeatherBonus}!`;
            }
        }
    }
    totalMedalsFromRespinLines += trueAimFeatherBonus;

    if (totalMedalsFromRespinLines > 0) {
        setters.setMedals(p => p + totalMedalsFromRespinLines);
        playSound('lineWin');
        if (lineCheckResultsRespin.formedLinesIndices && lineCheckResultsRespin.formedLinesIndices.length > 0) {
            setters.setHighlightedLine(lineCheckResultsRespin.formedLinesIndices[0]);
            setTimeout(() => setters.setHighlightedLine(null), 800);
        }
    }

    if (typeof lineCheckResultsRespin.additionalMedalsFromRG === 'number' && lineCheckResultsRespin.additionalMedalsFromRG > 0) {
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
    setters.setRespinState(null); // End respin state HERE

    if (gameState.medals <= 0 && !gameState.isGameOver) {
        setters.triggerGameOver("Not enough medals after respin! GAME OVER!");
        return; // Game over, no further processing
    }
    // Respin finished, now proceed to turn resolution logic at the end of processSpin
  }
  // --- End of Respin Handling ---
  else { // --- Normal Spin Logic (if not a respin execution) ---
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
    if (gameState.packUnityDiscount > 0) {
      spinEventMessage += (spinEventMessage ? " | " : "") + `Pack Unity reduced cost by ${Math.round(gameState.packUnityDiscount * 100)}%!`;
    }

    setters.setSpinCount(prev => prev + 1); // Increment spin count for normal spin
    setters.setLineMessage("");
    setters.setGameMessage("");

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

    const initialBoardSymbols: InstanceSymbolData[] = Array(9).fill(null) as unknown as InstanceSymbolData[];
    const occupiedIndices = new Set<number>();

    boardSymbolsFromPersistence.forEach((s, idx) => {
        if (s) {
            initialBoardSymbols[idx] = s;
            occupiedIndices.add(idx);
        }
    });

    if (gameState.acquiredRelics.some(r => r.no === 2)) {
      const emptySlotsIndices: number[] = [];
      for (let i = 0; i < 9; i++) { if (!occupiedIndices.has(i)) emptySlotsIndices.push(i); }
      if (emptySlotsIndices.length > 0 && Math.random() < 0.05) {
        const targetSlotIndex = emptySlotsIndices[Math.floor(Math.random() * emptySlotsIndices.length)];
        const coinSymbolNos = [1, 2, 3];
        const randomCoinNo = coinSymbolNos[Math.floor(Math.random() * coinSymbolNos.length)];
        const coinSymbolData = findSymbolDataByNo(randomCoinNo);
        if (coinSymbolData) {
          initialBoardSymbols[targetSlotIndex] = { ...coinSymbolData, instanceId: `magnetic_${uuidv4()}` };
          occupiedIndices.add(targetSlotIndex);
          spinEventMessage = (spinEventMessage ? spinEventMessage + " | " : "") + `Magnetic Core generated a ${coinSymbolData.name.split(' ')[0]}!`;
          playSound('transform');
        }
      }
    }

    if (gameState.acquiredRelics.some(r => r.no === 15) &&
        gameState.currentDeck.some(deckSymbol => deckSymbol.no === 44)) {
      const emptySlotsForWildGem: number[] = [];
      for (let i = 0; i < 9; i++) { if (!occupiedIndices.has(i)) emptySlotsForWildGem.push(i); }
      if (emptySlotsForWildGem.length > 0 && Math.random() < 0.02) {
        const targetSlotIndex = emptySlotsForWildGem[Math.floor(Math.random() * emptySlotsForWildGem.length)];
        const wildSymbolData = findSymbolDataByNo(44);
        if (wildSymbolData) {
          initialBoardSymbols[targetSlotIndex] = { ...wildSymbolData, instanceId: `wildgem_${uuidv4()}` };
          occupiedIndices.add(targetSlotIndex);
          spinEventMessage = (spinEventMessage ? spinEventMessage + " | " : "") + `Wild Gem placed a Wild symbol!`;
          playSound('transform');
        }
      }
    }

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

    let onBoardMedalGenerationMessage = "";
    let medalsFromOnBoardGeneration = 0;
    initialBoardSymbols.forEach(symbol => {
      if (symbol) {
        let gain = 0;
        switch (symbol.no) {
          case 1: gain = 2; break;
          case 2: gain = 5; break; // Original value for Silver Coin in normal spin
          case 3: gain = 12; break;// Original value for Gold Coin in normal spin
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
      playSound('medal');
      if (spinEventMessage) spinEventMessage += " | ";
      spinEventMessage += onBoardMedalGenerationMessage;
    }

    setters.setBoardSymbols(initialBoardSymbols.map(s => s ? {...s} : null));

    let totalGainedThisSpin = 0;
    let combinedEffectMessage = spinEventMessage;

    const abResult = applyAdjacentBonusesLogic(
      initialBoardSymbols.map(s => s ? {...s} : null),
      gameState.acquiredRelics
    );
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
                  let progressChangedLocal = false; // Use a local variable to avoid conflicts
                  // Remove all entries for Rusted Lump, not just one by instanceId, if that's the intent
                  // Or, if it's instanceId specific, ensure lineCheckResults returns the correct instanceId
                  // Assuming a general removal for now if only name is provided:
                  Object.keys(newProgress).forEach(instanceId => {
                      // This logic needs refinement if symbolsToRemoveFromDeckByName is just a name.
                      // For now, assume it means removing ALL Rusted Lumps from progress.
                      // If specific instance, then lineCheckResults.symbolsToRemoveFromDeckByInstanceId would be better.
                      if (tempDeck.find(s => s.instanceId === instanceId && s.name === "錆びる鉄塊 (Rusted Lump)")) {
                          // This lump is still in deck, don't remove progress.
                      } else {
                          delete newProgress[instanceId];
                          progressChangedLocal = true;
                      }
                  });
                  if(progressChangedLocal) setters.setRustedLumpProgress(newProgress);
              }
          }
      });
    }

    if (lineCheckResults.incrementRustedLumpCounter) {
      const newProgress = { ...gameState.rustedLumpProgress };
      const steelSymbolDef = findSymbolDataByNo(1001);
      lineCheckResults.incrementRustedLumpCounter.forEach(instanceId => {
        const lumpInDeck = tempDeck.find(s => s.instanceId === instanceId);
        if (!lumpInDeck || lumpInDeck.no !== 9) return;
        newProgress[instanceId] = { count: (newProgress[instanceId]?.count || 0) + 1 };
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

    let boardStateAfterBombs: DynamicBoardSymbol[] = [...boardStateAfterLines];
    if (lineCheckResults.bombsToExplode && lineCheckResults.bombsToExplode.length > 0) {
      playSound('bomb');
      const bombRes = handleBombExplosionsLogic(lineCheckResults.bombsToExplode, boardStateAfterLines );
      if (bombRes.gainedMedals > 0) { setters.setMedals(p => p + bombRes.gainedMedals); totalGainedThisSpin += bombRes.gainedMedals; playSound('medal');}
      boardStateAfterBombs = bombRes.newBoard;
      if (bombRes.message) { combinedEffectMessage = (combinedEffectMessage ? combinedEffectMessage + " | " : "") + bombRes.message;}
    }

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

    setters.setBoardSymbols(boardStateAfterBombs.map(s => s ? { ...s } : null));
    setters.setLineMessage(combinedEffectMessage.trim().replace(/^ \| /, '') || "No bonuses or lines.");

    if (lineCheckResults.newPersistingSymbolsFromLineEffect) {
        lineCheckResults.newPersistingSymbolsFromLineEffect.forEach(newP => {
          const existingIdx = nextTurnPersistingSymbolsList.findIndex(elp => elp.index === newP.index);
          if (existingIdx !== -1) nextTurnPersistingSymbolsList.splice(existingIdx, 1);
          nextTurnPersistingSymbolsList.push(newP);
        });
    }
    setters.setPersistingSymbols(nextTurnPersistingSymbolsList);

    if (lineCheckResults.itemsAwarded && lineCheckResults.itemsAwarded.length > 0) {
      lineCheckResults.itemsAwarded.forEach(item => {
        if (item.type === "RelicFragment") {
          setters.setGameMessage(prev => `${prev ? prev + " | " : ""}Gained a Relic Fragment!`);
        }
      });
    }

    if (lineCheckResults.nextSpinCostModifier) {
      setters.setOneTimeSpinCostModifier(lineCheckResults.nextSpinCostModifier);
    } else {
      setters.setOneTimeSpinCostModifier(1);
    }

    if (gameState.currentEnemy && finalTotalGainedThisSpin > 0) {
      const newEnemyHPVal = Math.max(0, gameState.enemyHP - finalTotalGainedThisSpin);
      setters.setEnemyHP(newEnemyHPVal);
      if (newEnemyHPVal <= 0) {
          handleEnemyDefeat(gameState.currentEnemy.name);
      }
    }

    // Handle Respin Request from Line Check (for NORMAL spin leading to respin)
    if (lineCheckResults.requestRespin && !gameState.respinState?.active) {
      setters.setRespinState({ ...lineCheckResults.requestRespin, active: true });
      // If respin is requested, DO NOT proceed to turn resolution for THIS spin.
      // The turn resolution will happen after the respin is completed.
      return; // Exit processSpin early
    }

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

    let packUnityDiscountAppliedThisTurn = false;
    if (gameState.acquiredRelics.some(r => r.no === 9)) {
      let animalSymbolsOnBoardCount = 0;
      boardStateAfterBombs.forEach(symbol => {
        if (symbol && (symbol.dynamicAttribute || symbol.attribute) === "Animal") {
          animalSymbolsOnBoardCount++;
        }
      });
      if (animalSymbolsOnBoardCount >= 3) {
        setters.setPackUnityDiscount(prevDiscount => {
          const newDiscount = Math.min(0.20, prevDiscount + 0.05);
          if (newDiscount > prevDiscount && !isRespinExecution) { // Avoid double message if respin also had animals
            // Message is better handled at spin start or cost display
          }
          packUnityDiscountAppliedThisTurn = true;
          return newDiscount;
        });
      } else {
        if (gameState.packUnityDiscount > 0) {
          setters.setPackUnityDiscount(0);
           if(!isRespinExecution) setters.setGameMessage(prev => (prev ? prev + " | " : "") + `Pack Unity discount lost.`);
        }
      }
    }
    if (!packUnityDiscountAppliedThisTurn && !gameState.acquiredRelics.some(r => r.no === 9)) {
      if(gameState.packUnityDiscount > 0) setters.setPackUnityDiscount(0);
    }
  }
  // --- End of Normal Spin Logic ---


  // --- Turn Resolution Logic (Common for both normal spin completion and respin completion) ---
  // This block is reached if:
  // 1. It was a normal spin, and no respin was requested.
  // 2. It was a respin, and it just completed (respinState became null).
  if (!gameState.isGameOver) {
    // Only decrement counters and trigger resolution if not mid-respin OR if a respin just finished
    if (gameState.nextCostIncreaseIn > 0 && !isRespinExecution) setters.setNextCostIncreaseIn(prev => prev - 1);
    if (gameState.nextEnemyIn > 0 && gameState.currentEnemy === null && !isRespinExecution) setters.setNextEnemyIn(prev => prev - 1);

    // Always trigger turn resolution if a spin (normal or respin) has just concluded without starting another respin.
    // For normal spins, spinCount was already incremented.
    // For respins, spinCount reflects the spin that *triggered* the respin.
    // The `triggerTurnResolution` should use the `gameState.spinCount` which is up-to-date.
    triggerTurnResolution(gameState.spinCount);
  }
};