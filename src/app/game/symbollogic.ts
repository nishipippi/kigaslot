// src/app/game/symbollogic.ts
import type { SymbolData, RelicData, SymbolRarity } from '@/types/kigaslot'; // SymbolRarity を追加

// Utility Type for board symbols
export type BoardSymbol = SymbolData | null;

// --- Helper Functions for Board Analysis ---

export interface BoardPosition {
  r: number; 
  c: number; 
}

export const getBoardPosition = (index: number): BoardPosition => {
  if (index < 0 || index > 8) {
    console.error(`Invalid index: ${index}. Must be between 0 and 8.`);
    return { r: -1, c: -1 }; 
  }
  return { r: Math.floor(index / 3), c: index % 3 };
};

export const getIndexFromBoardPosition = (pos: BoardPosition): number => {
  if (pos.r < 0 || pos.r > 2 || pos.c < 0 || pos.c > 2) {
    console.error(`Invalid position: {r: ${pos.r}, c: ${pos.c}}. Row and column must be between 0 and 2.`);
    return -1; 
  }
  return pos.r * 3 + pos.c;
};

export const getAdjacentSymbolInfo = (
  board: BoardSymbol[],
  index: number
): { symbol: BoardSymbol; position: BoardPosition; index: number }[] => {
  const { r, c } = getBoardPosition(index);
  if (r === -1) return []; 
  const adjacent: { symbol: BoardSymbol; position: BoardPosition; index: number }[] = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
    for (let colOffset = -1; colOffset <= 1; colOffset++) {
      if (rowOffset === 0 && colOffset === 0) continue; 

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

export const parseBaseMedalValue = (effectText: string): number => {
  // BM形式: "このシンボル1つにつきメダルを +X 獲得"
  const bmMatch = effectText.match(/このシンボル1つにつきメダルを\s*\+(\d+)\s*獲得/);
  if (bmMatch && bmMatch[1]) return parseInt(bmMatch[1], 10);

  // SS/LB等の固定メダル形式: "ライン成立時メダル +X" or "メダル +X"
  const fixedMedalMatch = effectText.match(/(?:ライン成立時)?メダル\s*\+(\d+)/);
  if (fixedMedalMatch && fixedMedalMatch[1]) return parseInt(fixedMedalMatch[1], 10);
  
  // RG盤面滞在時などの形式: "(+Xメダル)"
  const onBoardMatch = effectText.match(/\(\+(\d+)メダル\)/);
  if (onBoardMatch && onBoardMatch[1]) return parseInt(onBoardMatch[1], 10);
  
  // AB効果で自身がメダルを獲得する場合: "自身のメダル獲得量を +X する"
  const selfGainMatch = effectText.match(/自身のメダル獲得量を\s*\+(\d+)\s*する/);
  if (selfGainMatch && selfGainMatch[1]) return parseInt(selfGainMatch[1], 10);

  return 0;
};

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
  // Future properties for more complex AB effects
  // e.g., totalSpinMedalModifier: number; boardTransformations: BoardSymbol[]
}

export const applyAdjacentBonusesLogic = (
  currentBoard: BoardSymbol[],
  // spinContext might be needed for effects interacting with total spin win, deck, etc.
): AdjacentBonusResult => {
  let totalMedalsFromAB = 0;
  const abMessages: string[] = [];

  currentBoard.forEach((symbol, index) => {
    if (!symbol || symbol.effectSystem !== 'AB') return;

    const adjacentSymbolsInfo = getAdjacentSymbolInfo(currentBoard, index);

    if (symbol.name === "磁鉄鉱 (Lodestone)") {
      const metalNeighbors = adjacentSymbolsInfo.filter(
        adj => adj.symbol && adj.symbol.attribute === "Metal"
      );
      if (metalNeighbors.length > 0) {
        const gain = metalNeighbors.length * 3;
        totalMedalsFromAB += gain;
        abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}`);
      }
    } else if (symbol.name === "蜜蜂 (Honeybee)") {
      const plantNeighbors = adjacentSymbolsInfo.filter(
        adj => adj.symbol && adj.symbol.attribute === "Plant"
      );
      if (plantNeighbors.length > 0) {
        const gain = plantNeighbors.length * 5;
        totalMedalsFromAB += gain;
        abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}(Plants)`);
      }
      // "隣接植物2つ以上で次スピンまで盤面に残る可能性" はRG的要素なので次回以降
    } else if (symbol.name === "武器庫の鍵 (Armory Key)") {
      const weaponNeighbors = adjacentSymbolsInfo.filter(
        adj => adj.symbol && adj.symbol.attribute === "Weapon"
      );
      if (weaponNeighbors.length > 0) {
        const gain = parseBaseMedalValue(symbol.effectText); // "自身のメダル獲得量を +5 する"
        if (gain > 0) {
            totalMedalsFromAB += gain;
            abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}(WeaponAdj)`);
        }
      }
    } else if (symbol.name === "共鳴クリスタル (Resonance Crystal)") {
      let gainFromResonance = 0;
      adjacentSymbolsInfo.forEach(adj => {
        if (adj.symbol && adj.symbol.name === symbol.name) { // 同じシンボルが隣接
          switch(adj.symbol.rarity as SymbolRarity) { // Use SymbolRarity type
            case "Common": gainFromResonance += 2; break;
            case "Uncommon": gainFromResonance += 4; break;
            case "Rare": gainFromResonance += 7; break;
          }
        }
      });
      if (gainFromResonance > 0) {
        totalMedalsFromAB += gainFromResonance;
        abMessages.push(`${symbol.name.split(' ')[0]}:+${gainFromResonance}(Resonance)`);
      }
    } else if (symbol.name === "魔法陣の欠片 (Magic Circle Fragment)") {
        const gain = parseBaseMedalValue(symbol.effectText); // "メダル+1"
        if (gain > 0) { // このシンボル自体からのメダル獲得
            totalMedalsFromAB += gain;
            abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}`);
        }
        // "デッキの回転速度が僅かに上昇" は次回以降
    }
    // --- Implement other AB symbol effects below as per phased implementation ---
    // e.g., 金属の鎖, 絡みつく蔦, 栄養豊富な土壌, カメレオンの鱗, 砥石
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
  // Future fields for more complex results
  // e.g., itemsAwarded: string[]; spinModifiers: object; nextSpinEffects: object[];
}

const PAYLINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6],           // Diagonals
];

export const checkLinesAndApplyEffects = (
  currentBoard: BoardSymbol[],
  currentAcquiredRelics: RelicData[],
  currentDeck: SymbolData[] // For effects like 大漁旗
  // spinContext might include spinCount, etc. for more complex effects
): LineCheckResult => {
  let totalMedalsFromLines = 0;
  const formedLineDetails: string[] = [];
  const formedLineIndicesArray: number[][] = [];
  const bombsToExplodeThisSpin: { index: number; symbol: SymbolData }[] = [];
  // let itemsGainedThisSpin: string[] = []; // For Four-Leaf Clover, Treasure Chest

  PAYLINES.forEach(lineIndices => {
    const symbolsOnLine = lineIndices.map(i => currentBoard[i]);
    const validSymbolsOnLine = symbolsOnLine.filter(s => s !== null) as SymbolData[];

    if (validSymbolsOnLine.length < 3) return;

    const wildCount = validSymbolsOnLine.filter(sym => sym.name === "ワイルド (Wild)").length;
    const nonWildSymbols = validSymbolsOnLine.filter(sym => sym.name !== "ワイルド (Wild)");

    let effectiveAttribute: SymbolData['attribute'] | null = null;
    if (nonWildSymbols.length === 3 && nonWildSymbols.every(s => s.attribute === nonWildSymbols[0].attribute)) {
      effectiveAttribute = nonWildSymbols[0].attribute;
    } else if (nonWildSymbols.length === 2 && wildCount === 1 && nonWildSymbols[0].attribute === nonWildSymbols[1].attribute) {
      effectiveAttribute = nonWildSymbols[0].attribute;
    } else if (nonWildSymbols.length === 1 && wildCount === 2) {
      effectiveAttribute = nonWildSymbols[0].attribute;
    } else if (wildCount === 3) {
      effectiveAttribute = "Mystic"; // Or define a special "All Wild" behavior
    }

    if (effectiveAttribute) { 
      let currentLineBaseMedal = 0;
      let lineMsg = `${effectiveAttribute} Line (W:${wildCount}): `;

      validSymbolsOnLine.forEach(s => {
        let singleSymbolGain = 0;
        if (s.name === "ワイルド (Wild)") {
          lineMsg += ` Wild `;
        } else if (s.effectSystem === 'BM' || 
                   ['ボム (Bomb)', 'ギア (Gear)', '幸運の招き猫 (Lucky Cat)', '狩人の狼 (Hunter Wolf)', 'サンベリー (Sunberry)'].includes(s.name) || // SS with base value
                   s.name === "血塗られたダガー (Bloodied Dagger)" || s.name === "呪いの仮面 (Cursed Mask)") { // RG with line value
          
          singleSymbolGain = parseBaseMedalValue(s.effectText);

          // Specific BM adjustments based on board state
          if (s.name === "森のリス (Forest Squirrel)") {
            singleSymbolGain = countSymbolsOnBoard(currentBoard, cs => cs.attribute === "Plant") > 0 ? 4 : 3;
          } else if (s.name === "星のかけら (Stardust)") {
            singleSymbolGain = countSymbolsOnBoard(currentBoard, cs => cs.attribute === "Mystic") > 0 ? 5 : 3;
          }
          
          singleSymbolGain = applyRelicToSymbolBM(s, singleSymbolGain, currentAcquiredRelics);

          // Handle Cursed Mask negative value
          if (s.name === "呪いの仮面 (Cursed Mask)" && s.effectText.includes("メダル -")) {
             const curseMatch = s.effectText.match(/メダル\s*-(\d+)/);
             if (curseMatch && curseMatch[1]) {
                singleSymbolGain = -parseInt(curseMatch[1], 10);
             }
          }
          
          currentLineBaseMedal += singleSymbolGain; // Add (or subtract for curse)
          if (singleSymbolGain !== 0) {
            lineMsg += ` ${s.name.split(' ')[0]}(${singleSymbolGain > 0 ? '+' : ''}${singleSymbolGain}) `;
          }
        }
      });
      
      let finalLineWin = currentLineBaseMedal;

      // LB effects & multi-symbol BM-like bonuses
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
            // BARの基礎メダルはBM計算で+5されていると仮定、純粋BARなら追加+45、混合ならそのまま
            const barBonus = isPureBarLine ? 50 : (parseBaseMedalValue(s.effectText) || 5);
            // If parseBaseMedalValue handles the "混ざるとメダル+5" part, we might not need to add it again.
            // Let's assume BAR's base medal effect (e.g., +5 if mixed) is handled in the BM section,
            // and "BARシンボルのみでラインが成立した場合、メダル +50" means total 50.
            if (isPureBarLine) {
                const baseBarValue = parseBaseMedalValue(validSymbolsOnLine.find(sym => sym.name === "BAR (BAR)")!.effectText.split('。')[1] || ""); // attempt to get "+5"
                const additionalForPure = 50 - (baseBarValue * 3); // Assuming base is 5 per BAR if mixed.
                finalLineWin += Math.max(0, additionalForPure - (finalLineWin - baseBarValue*3)); // Ensure total is 50. Simpler: finalLineWin = 50;
                lineMsg += `[PureBAR->50]`;
                finalLineWin = 50; // Simplest way to enforce the total
            } else {
                // Mixed BAR line: each BAR contributes +5 via BM parse. No extra LB needed if that's the case.
                // If BAR's effectText is "BARシンボルのみでラインが成立した場合、メダル +50。他のシンボルと混ざるとメダル +5。"
                // then a mixed BAR gives +5 from itself.
                const mixedBarValue = parseBaseMedalValue(s.effectText.split('。')[1] || ""); // "他のシンボルと混ざるとメダル +5"
                if (!isPureBarLine && mixedBarValue > 0) {
                  // This might double-count if BM already includes it. Refine BAR logic.
                  // For now, assume BM parse gave 0 for BAR, and LB gives the value.
                  // finalLineWin += mixedBarValue;
                  // lineMsg += `[MixedBAR+${mixedBarValue}]`;
                }
            }
          }
          // --- Implement other LB symbol effects (phased) ---
          // e.g., 四つ葉のクローバー, 大漁旗, 幸運の招き猫 (LB part), バックラー, リスピン・アロー, 運命のタロット, 宝箱
        }
      });

      // BM multi-symbol line bonuses
      if (validSymbolsOnLine.filter(sym => sym.name === "小魚 (Small Fish)").length === 3) {
          const numFish = validSymbolsOnLine.filter(sym => sym.name === "小魚 (Small Fish)").length;
          const baseFishValue = parseBaseMedalValue(validSymbolsOnLine.find(f => f.name === "小魚 (Small Fish)")!.effectText);
          // The base medals are already counted. Add the *additional* +10 for 3.
          // If effectText is "このシンボル1つにつきメダルを +2 獲得。3つ揃うとメダル +10。"
          // then 3 fish already gave 2*3=6. So, additional is 10. Total would be 16.
          // If "3つ揃うとメダル +10" means total is 10, then subtract base: 10 - (baseFishValue*3)
          const additionalBonus = 10; // Assuming the +10 is *additional*
          finalLineWin += additionalBonus; 
          lineMsg += `[3xFish+${additionalBonus}]`;
      }
      if (validSymbolsOnLine.filter(sym => sym.name === "木の実 (Nut)").length === 3) {
          const additionalBonus = 5; // Assuming "+5" is additional
          finalLineWin += additionalBonus; 
          lineMsg += `[3xNut+${additionalBonus}]`;
      }

      // SS effects that modify line win or have other on-line effects
      validSymbolsOnLine.forEach((s, idxInLine) => {
        if (s.effectSystem === 'SS') {
          if (s.name === "ワイルド (Wild)" && wildCount > 0 && finalLineWin > 0) {
            const wildMultiplierMatch = s.effectText.match(/獲得メダルが\s*([\d.]+)\s*倍/);
            if (wildMultiplierMatch && wildMultiplierMatch[1]) {
              const multiplier = parseFloat(wildMultiplierMatch[1]);
              finalLineWin = Math.floor(finalLineWin * multiplier);
              lineMsg += `[Wild x${multiplier}]`;
            }
          } else if (s.name === "ギア (Gear)") {
            // Base +5 for Gear is already in BM calculation
            const metalSymbolsOnBoard = countSymbolsOnBoard(currentBoard, cs => cs.attribute === "Metal");
            const gearBonusPerMetal = 2; 
            const gearBoardBonus = metalSymbolsOnBoard * gearBonusPerMetal;
            if (gearBoardBonus > 0) { 
                finalLineWin += gearBoardBonus; 
                lineMsg += ` [GearBoard+${gearBoardBonus}]`; 
            }
          } else if (s.name === "ボム (Bomb)") {
            const boardIndexOfBomb = lineIndices[idxInLine];
            if (!bombsToExplodeThisSpin.find(b => b.index === boardIndexOfBomb)) {
              bombsToExplodeThisSpin.push({ index: boardIndexOfBomb, symbol: s });
              // Bomb's base +5 is added in BM part.
            }
          }
          // --- Implement other SS symbol effects (phased) ---
          // e.g., サンベリー, 狩人の狼, フェニックス (after RG)
        }
      });

      if (finalLineWin > 0) { // Only count positive wins after all calculations
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
    // itemsAwarded: itemsGainedThisSpin,
  };
};

// --- Bomb Explosion Logic ---
export interface BombExplosionResult {
  gainedMedals: number;
  newBoard: BoardSymbol[]; 
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
    if (!boardAfterExplosions[bombInfo.index] || boardAfterExplosions[bombInfo.index]?.name !== "ボム (Bomb)") {
        return; 
    }

    const { r: bombR, c: bombC } = getBoardPosition(bombInfo.index);
    explosionEventMessages.push(`${bombInfo.symbol.name.split(' ')[0]}@(${bombR},${bombC}) explodes!`);
    
    let symbolsDestroyedByThisBomb = 0;
    const adjacentToBomb = getAdjacentSymbolInfo(boardAfterExplosions, bombInfo.index);
    
    adjacentToBomb.forEach(adj => {
      if (adj.symbol && adj.symbol.name !== "ボム (Bomb)") { 
        totalExplosionMedals += 6; 
        symbolsDestroyedByThisBomb++;
        boardAfterExplosions[adj.index] = null;
      }
    });

    if (symbolsDestroyedByThisBomb > 0) {
      explosionEventMessages.push(`  Destroyed ${symbolsDestroyedByThisBomb}, +${symbolsDestroyedByThisBomb * 6}.`);
    }
    boardAfterExplosions[bombInfo.index] = null;
  });

  return {
    gainedMedals: totalExplosionMedals,
    newBoard: boardAfterExplosions,
    message: explosionEventMessages.join(" "),
  };
};

// RG Logic Placeholder...