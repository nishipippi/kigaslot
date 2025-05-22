// src/app/game/symbollogic.ts
import type { SymbolData, RelicData } from '@/types/kigaslot';

// Utility Type for board symbols
export type BoardSymbol = SymbolData | null;

// --- Helper Functions for Board Analysis ---

/**
 * Represents a position on the 3x3 game board.
 */
export interface BoardPosition {
  r: number; // row (0-2)
  c: number; // column (0-2)
}

/**
 * Converts a flat array index (0-8) to a BoardPosition {r, c}.
 */
export const getBoardPosition = (index: number): BoardPosition => {
  if (index < 0 || index > 8) {
    // It's better to handle errors or return a defined error state
    // For simplicity here, we'll assume valid inputs in game logic
    console.error(`Invalid index: ${index}. Must be between 0 and 8.`);
    return { r: -1, c: -1 }; // Indicate error
  }
  return { r: Math.floor(index / 3), c: index % 3 };
};

/**
 * Converts a BoardPosition {r, c} to a flat array index (0-8).
 */
export const getIndexFromBoardPosition = (pos: BoardPosition): number => {
  if (pos.r < 0 || pos.r > 2 || pos.c < 0 || pos.c > 2) {
    console.error(`Invalid position: {r: ${pos.r}, c: ${pos.c}}. Row and column must be between 0 and 2.`);
    return -1; // Indicate error
  }
  return pos.r * 3 + pos.c;
};

/**
 * Gets all up to 8 adjacent symbols' information for a given index on the board.
 */
export const getAdjacentSymbolInfo = (
  board: BoardSymbol[],
  index: number
): { symbol: BoardSymbol; position: BoardPosition; index: number }[] => {
  const { r, c } = getBoardPosition(index);
  if (r === -1) return []; // Invalid index from getBoardPosition
  const adjacent: { symbol: BoardSymbol; position: BoardPosition; index: number }[] = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
    for (let colOffset = -1; colOffset <= 1; colOffset++) {
      if (rowOffset === 0 && colOffset === 0) continue; // Skip the center symbol itself

      const neighborRow = r + rowOffset;
      const neighborCol = c + colOffset;

      if (neighborRow >= 0 && neighborRow < 3 && neighborCol >= 0 && neighborCol < 3) {
        const neighborIndex = getIndexFromBoardPosition({ r: neighborRow, c: neighborCol });
        adjacent.push({
          symbol: board[neighborIndex],
          position: { r: neighborRow, c: neighborCol },
          index: neighborIndex,
        });
      }
    }
  }
  return adjacent;
};

/**
 * Counts symbols on the board that satisfy a given predicate.
 */
export const countSymbolsOnBoard = (
  board: BoardSymbol[],
  predicate: (symbol: SymbolData) => boolean
): number => {
  return board.reduce((count, currentSymbol) => {
    if (currentSymbol && predicate(currentSymbol)) {
      return count + 1;
    }
    return count;
  }, 0);
};

/**
 * Retrieves all symbols from the board that satisfy an optional predicate.
 */
export const getSymbolsFromBoard = (
    board: BoardSymbol[],
    predicate?: (symbol: SymbolData) => boolean
): SymbolData[] => {
    const filteredSymbols: SymbolData[] = [];
    board.forEach(s => {
        if (s && (predicate ? predicate(s) : true)) {
            filteredSymbols.push(s);
        }
    });
    return filteredSymbols;
};

/**
 * Parses the base medal gain from a BM (Base Medal) or initial SS effect string.
 */
export const parseBaseMedalValue = (effectText: string): number => {
  const bmMatch = effectText.match(/このシンボル1つにつきメダルを\s*\+(\d+)\s*獲得/);
  if (bmMatch && bmMatch[1]) return parseInt(bmMatch[1], 10);

  const ssFixedMatch = effectText.match(/ライン成立時メダル\s*\+(\d+)/);
  if (ssFixedMatch && ssFixedMatch[1]) return parseInt(ssFixedMatch[1], 10);
  
  // For "フェニックスの卵" which has a different format when on board (not line)
  const onBoardMatch = effectText.match(/\(\+(\d+)メダル\)/);
  if (onBoardMatch && onBoardMatch[1]) return parseInt(onBoardMatch[1], 10);

  return 0;
};

/**
 * Applies relic effects to a symbol's base medal gain.
 */
export const applyRelicToSymbolBM = (
  symbol: SymbolData,
  baseGain: number,
  currentAcquiredRelics: RelicData[]
): number => {
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

// --- Adjacent Bonus (AB) Logic ---
export interface AdjacentBonusResult {
  gainedMedals: number;
  message: string;
  // Future: modifiedSymbols, boardChanges, totalMedalModifier, etc.
  // For effects like "金属の鎖" or "絡みつく蔦" that modify total spin win,
  // we might need a different return structure or pass a context object to modify.
}

export const applyAdjacentBonusesLogic = (
  currentBoard: BoardSymbol[],
  // spinContext: { spinCount: number, currentDeck: SymbolData[], currentTotalMedalGain: number } // For complex ABs
): AdjacentBonusResult => {
  let totalMedalsFromAB = 0;
  const abMessages: string[] = [];

  currentBoard.forEach((symbol, index) => {
    if (!symbol || symbol.effectSystem !== 'AB') return;

    if (symbol.name === "磁鉄鉱 (Lodestone)") {
      const adjacentSymbolsInfo = getAdjacentSymbolInfo(currentBoard, index);
      const metalNeighbors = adjacentSymbolsInfo.filter(
        adj => adj.symbol && adj.symbol.attribute === "Metal"
      );
      if (metalNeighbors.length > 0) {
        const gain = metalNeighbors.length * 3;
        totalMedalsFromAB += gain;
        abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}`);
      }
    }
    // --- Implement other AB symbol effects below ---
    // e.g., 金属の鎖, 絡みつく蔦, 栄養豊富な土壌, 蜜蜂, カメレオンの鱗, 砥石, 武器庫の鍵, 共鳴クリスタル, 魔法陣の欠片
    // Note: Some AB effects might need to modify symbol properties for the current spin (e.g., Whetstone, Chameleon)
    // or affect the total spin result, requiring more complex handling than just returning medals.
  });

  return {
    gainedMedals: totalMedalsFromAB,
    message: abMessages.join(' | '),
  };
};


// --- Line Check, Line Bonus (LB), Special Spin (SS) Logic ---
export interface LineCheckResult {
  gainedMedals: number;
  message: string;
  formedLinesIndices: number[][];
  bombsToExplode: { index: number; symbol: SymbolData }[];
  // Future fields: itemsGained, boardTransformations, spinModifiers, etc.
}

const PAYLINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6],           // Diagonals
];

export const checkLinesAndApplyEffects = (
  currentBoard: BoardSymbol[],
  currentAcquiredRelics: RelicData[]
  // spinContext: { spinCount: number, currentDeck: SymbolData[] } // For complex LB/SS
): LineCheckResult => {
  let totalMedalsFromLines = 0;
  const formedLineDetails: string[] = [];
  const formedLineIndicesArray: number[][] = [];
  const bombsToExplodeThisSpin: { index: number; symbol: SymbolData }[] = [];

  PAYLINES.forEach(lineIndices => {
    const symbolsOnLine = lineIndices.map(i => currentBoard[i]);
    const validSymbolsOnLine = symbolsOnLine.filter(s => s !== null) as SymbolData[];

    if (validSymbolsOnLine.length < 3) return;

    const wildCount = validSymbolsOnLine.filter(sym => sym.name === "ワイルド (Wild)").length;
    const nonWildSymbols = validSymbolsOnLine.filter(sym => sym.name !== "ワイルド (Wild)");

    let effectiveAttribute: SymbolData['attribute'] | null = null;
    // Determine effective attribute for the line (considering Wilds)
    if (nonWildSymbols.length === 3 && nonWildSymbols.every(s => s.attribute === nonWildSymbols[0].attribute)) {
      effectiveAttribute = nonWildSymbols[0].attribute;
    } else if (nonWildSymbols.length === 2 && wildCount === 1 && nonWildSymbols[0].attribute === nonWildSymbols[1].attribute) {
      effectiveAttribute = nonWildSymbols[0].attribute;
    } else if (nonWildSymbols.length === 1 && wildCount === 2) {
      effectiveAttribute = nonWildSymbols[0].attribute;
    } else if (wildCount === 3) {
      effectiveAttribute = "Mystic"; // Or a special "All Wild" payout attribute
    }
    // TODO: Consider Chameleon Scale's dynamic attribute here if it's on the line.

    if (effectiveAttribute) { // A line is formed
      let currentLineBaseMedal = 0;
      let lineMsg = `${effectiveAttribute} Line (W:${wildCount}): `;

      // 1. Calculate Base Medal (BM) from symbols on the line & some SS base values
      validSymbolsOnLine.forEach(s => {
        let singleSymbolGain = 0;
        if (s.name === "ワイルド (Wild)") {
          lineMsg += ` Wild `;
        } else if (s.effectSystem === 'BM' || s.name === "ボム (Bomb)" || s.name === "ギア (Gear)" || s.name === "幸運の招き猫 (Lucky Cat)" || s.name === "狩人の狼 (Hunter Wolf)" || s.name === "サンベリー (Sunberry)") { // Include SS symbols with base line value
          singleSymbolGain = parseBaseMedalValue(s.effectText);

          // Specific BM adjustments
          if (s.name === "森のリス (Forest Squirrel)") {
            singleSymbolGain = countSymbolsOnBoard(currentBoard, cs => cs.attribute === "Plant") > 0 ? 4 : 3;
          }
          // Relic adjustments
          singleSymbolGain = applyRelicToSymbolBM(s, singleSymbolGain, currentAcquiredRelics);
          if (singleSymbolGain > 0) {
            currentLineBaseMedal += singleSymbolGain;
            lineMsg += ` ${s.name.split(' ')[0]}(+${singleSymbolGain}) `;
          }
        }
      });
      
      let finalLineWin = currentLineBaseMedal;

      // 2. Apply Line Bonus (LB) effects & specific multi-symbol BM bonuses
      validSymbolsOnLine.forEach(s => {
        if (s.effectSystem === 'LB') {
          if (s.name === "ベル (Bell)" && validSymbolsOnLine.filter(ls => ls.name === "ベル (Bell)").length === 3 && currentLineBaseMedal > 0) {
            finalLineWin = Math.floor(finalLineWin * 1.5) + 1;
            lineMsg += `[Bell x1.5+1]`;
          } else if (s.name === "チェリー (Cherry)") {
            const cherryCount = validSymbolsOnLine.filter(ls => ls.name === "チェリー (Cherry)").length;
            const cherryBonus = cherryCount === 1 ? 3 : cherryCount === 2 ? 8 : cherryCount >= 3 ? 20 : 0;
            if (cherryBonus > 0) { finalLineWin += cherryBonus; lineMsg += `[Cherry+${cherryBonus}]`; }
          } else if (s.name === "BAR (BAR)") {
            const isPureBarLine = validSymbolsOnLine.every(ls => ls.name === "BAR (BAR)");
            const barBonus = isPureBarLine ? 50 : 5;
            finalLineWin += barBonus;
            lineMsg += `[${isPureBarLine ? 'PureBAR' : 'MixedBAR'}+${barBonus}]`;
          }
          // --- Implement other LB symbol effects ---
          // e.g., 四つ葉のクローバー, 大漁旗, 幸運の招き猫 (LB part), バックラー, リスピン・アロー, 運命のタロット, 宝箱
        }
      });
      // BM multi-symbol bonuses (treated like LBs for calculation convenience)
      if (validSymbolsOnLine.filter(sym => sym.name === "小魚 (Small Fish)").length === 3) {
          finalLineWin += 10; lineMsg += `[3xFish+10]`;
      }
      if (validSymbolsOnLine.filter(sym => sym.name === "木の実 (Nut)").length === 3) {
          finalLineWin += 5; lineMsg += `[3xNut+5]`;
      }

      // 3. Apply Special Spin (SS) effects that modify line win or have other on-line effects
      validSymbolsOnLine.forEach((s, idxInLine) => {
        if (s.effectSystem === 'SS') {
          if (s.name === "ワイルド (Wild)" && wildCount > 0 && finalLineWin > 0) {
            const wildMultiplierMatch = s.effectText.match(/獲得メダルが\s*([\d.]+)\s*倍/);
            if (wildMultiplierMatch && wildMultiplierMatch[1]) {
              const multiplier = parseFloat(wildMultiplierMatch[1]);
              finalLineWin = Math.floor(finalLineWin * multiplier); // Apply to current subtotal
              lineMsg += `[Wild x${multiplier}]`;
            }
          } else if (s.name === "ギア (Gear)") {
            const metalSymbolsOnBoard = countSymbolsOnBoard(currentBoard, cs => cs.attribute === "Metal");
            const gearBonus = metalSymbolsOnBoard * 2;
            if (gearBonus > 0) { finalLineWin += gearBonus; lineMsg += ` [GearBoard+${gearBonus}]`; }
          } else if (s.name === "ボム (Bomb)") {
            const boardIndexOfBomb = lineIndices[idxInLine];
            if (!bombsToExplodeThisSpin.find(b => b.index === boardIndexOfBomb)) {
              bombsToExplodeThisSpin.push({ index: boardIndexOfBomb, symbol: s });
              // Bomb's base +5 is already added in BM part.
            }
          }
          // --- Implement other SS symbol effects (on-line part) ---
          // e.g., サンベリー, 狩人の狼, フェニックス (after RG)
        }
      });

      if (finalLineWin > 0) {
        totalMedalsFromLines += finalLineWin;
        formedLineDetails.push(`${lineMsg.trim()}->+${finalLineWin}`);
        formedLineIndicesArray.push([...lineIndices]);
      }
    }
  });

  const resultMessage = formedLineDetails.join(' | ') || (totalMedalsFromLines > 0 ? `Total+${totalMedalsFromLines}!` : "No lines/effects.");
  return {
    gainedMedals: totalMedalsFromLines,
    message: resultMessage,
    formedLinesIndices: formedLineIndicesArray,
    bombsToExplode: bombsToExplodeThisSpin,
  };
};

// --- Bomb Explosion Logic ---
export interface BombExplosionResult {
  gainedMedals: number;
  newBoard: BoardSymbol[]; // Board after explosions
  message: string;
}

export const handleBombExplosionsLogic = (
  bombsToExplode: { index: number; symbol: SymbolData }[],
  currentBoard: BoardSymbol[]
): BombExplosionResult => {
  if (bombsToExplode.length === 0) {
    return { gainedMedals: 0, newBoard: [...currentBoard], message: "" };
  }

  let totalExplosionMedals = 0;
  let boardAfterExplosions = [...currentBoard];
  const explosionEventMessages: string[] = [];

  bombsToExplode.forEach(bombInfo => {
    // Check if the bomb still exists (it might have been destroyed by another bomb in the same spin if multiple bombs are on one line)
    if (!boardAfterExplosions[bombInfo.index] || boardAfterExplosions[bombInfo.index]?.name !== "ボム (Bomb)") {
        return; 
    }

    const { r: bombR, c: bombC } = getBoardPosition(bombInfo.index);
    explosionEventMessages.push(`${bombInfo.symbol.name.split(' ')[0]}@(${bombR},${bombC}) explodes!`);
    
    let symbolsDestroyedByThisBomb = 0;
    const adjacentToBomb = getAdjacentSymbolInfo(boardAfterExplosions, bombInfo.index);
    
    adjacentToBomb.forEach(adj => {
      if (adj.symbol && adj.symbol.name !== "ボム (Bomb)") { // Bombs don't destroy other bombs
        totalExplosionMedals += 6; // As per Bomb's effectText
        symbolsDestroyedByThisBomb++;
        boardAfterExplosions[adj.index] = null;
      }
    });

    if (symbolsDestroyedByThisBomb > 0) {
      explosionEventMessages.push(`  Destroyed ${symbolsDestroyedByThisBomb}, +${symbolsDestroyedByThisBomb * 6}.`);
    }
    // The bomb itself is consumed
    boardAfterExplosions[bombInfo.index] = null;
  });

  return {
    gainedMedals: totalExplosionMedals,
    newBoard: boardAfterExplosions,
    message: explosionEventMessages.join(" "),
  };
};

// --- Rarity Growth / Evolving Symbol (RG) Logic Placeholder ---
// RG symbols require state tracking across spins (e.g., counters, time on board).
// The current game architecture (board reset every spin) makes this challenging.
// A more persistent board state or individual symbol state tracking would be needed.
// For now, RG effects are largely unhandled by this separated logic.
/*
export interface RGProcessingOutput {
  newBoardState: BoardSymbol[];
  deckModifications: { add?: SymbolData[], removeByName?: string[] };
  messages: string[];
  extraMedals?: number;
}
export const processRGSymbols = (
    board: BoardSymbol[],
    // symbolStates: Map<number, any>, // Map from board index to symbol state
    // spinCount: number,
    // currentDeck: SymbolData[],
): RGProcessingOutput => {
    // 1. Iterate through board symbols.
    // 2. If an RG symbol, check its state and trigger conditions.
    //    - Increment counters (e.g., Rusted Lump line participations).
    //    - Increment turns on board (e.g., Growing Seed, Phoenix Egg).
    // 3. If condition met:
    //    - Transform symbol (e.g., Rusted Lump -> Polished Steel).
    //    - Add/remove from deck (e.g., Bloodied Dagger adds Curse, Rusted Lump removed).
    //    - Generate messages.
    // 4. Return new board state, deck changes, messages, medals.
    console.log("RG Symbol processing would occur here if state management was in place.");
    return { newBoardState: [...board], deckModifications: {}, messages: [] };
};
*/