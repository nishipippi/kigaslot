// src/app/game/symbollogic.ts
import type { SymbolData, RelicData, SymbolRarity } from '@/types/kigaslot';

// Utility Type for board symbols
export type BoardSymbol = SymbolData | null;

// Extended symbol type for dynamic in-spin state
export interface DynamicSymbol extends SymbolData {
  dynamicAttribute?: SymbolData['attribute']; // For Chameleon Scale
  dynamicBonusBM?: number; // For Whetstone
  isChameleonTriggeredForLine?: boolean; // For Chameleon's +1 medal on line
}
export type DynamicBoardSymbol = DynamicSymbol | null;


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
  board: DynamicBoardSymbol[], 
  index: number
): { symbol: DynamicBoardSymbol; position: BoardPosition; index: number }[] => {
  const { r, c } = getBoardPosition(index);
  if (r === -1) return []; 
  const adjacent: { symbol: DynamicBoardSymbol; position: BoardPosition; index: number }[] = [];

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
  board: DynamicBoardSymbol[], 
  predicate: (symbol: DynamicSymbol) => boolean 
): number => {
  return board.reduce((count, currentSymbol) => {
    if (currentSymbol && predicate(currentSymbol)) {
      return count + 1;
    }
    return count;
  }, 0);
};

export const getSymbolsFromBoard = (
    board: DynamicBoardSymbol[], 
    predicate?: (symbol: DynamicSymbol) => boolean 
): DynamicSymbol[] => {
    const filteredSymbols: DynamicSymbol[] = [];
    board.forEach(s => {
        if (s && (predicate ? predicate(s) : true)) {
            filteredSymbols.push(s);
        }
    });
    return filteredSymbols;
};

export const parseBaseMedalValue = (effectText: string): number => {
  const bmMatch = effectText.match(/このシンボル1つにつきメダルを\s*\+(\d+)\s*獲得/);
  if (bmMatch && bmMatch[1]) return parseInt(bmMatch[1], 10);

  const fixedMedalMatch = effectText.match(/(?:ライン成立時)?メダル\s*\+(\d+)/);
  if (fixedMedalMatch && fixedMedalMatch[1]) return parseInt(fixedMedalMatch[1], 10);
  
  const onBoardMatch = effectText.match(/\(\+(\d+)メダル\)/);
  if (onBoardMatch && onBoardMatch[1]) return parseInt(onBoardMatch[1], 10);
  
  const selfGainMatch = effectText.match(/自身のメダル獲得量を\s*\+(\d+)\s*する/);
  if (selfGainMatch && selfGainMatch[1]) return parseInt(selfGainMatch[1], 10);

  return 0;
};

export const applyRelicToSymbolBM = (
  symbol: DynamicSymbol, 
  baseGain: number,
  currentAcquiredRelics: RelicData[]
): number => {
  let modifiedGain = baseGain;
  currentAcquiredRelics.forEach(relic => {
    if (relic.name === "鍛冶神の金床 (Anvil of the Forge God)" && (symbol.dynamicAttribute || symbol.attribute) === "Metal") modifiedGain += 2;
    else if (relic.name === "百獣の王の紋章 (Crest of the Beast King)" && (symbol.dynamicAttribute || symbol.attribute) === "Animal") modifiedGain += 2;
    else if (relic.name === "伝説の剣聖の鞘 (Sheath of the Legendary Swordmaster)" && (symbol.dynamicAttribute || symbol.attribute) === "Weapon") modifiedGain += 2;
    else if (relic.name === "星詠みの水晶球 (Crystal Ball of Stargazing)" && (symbol.dynamicAttribute || symbol.attribute) === "Mystic") modifiedGain += 2;
    else if (relic.name === "生命の泉の雫 (Droplet of the Life Spring)" && (symbol.dynamicAttribute || symbol.attribute) === "Plant") modifiedGain += 2;
  });
  return modifiedGain;
};

// --- Adjacent Bonus (AB) Logic ---
export interface AdjacentBonusResult {
  gainedMedals: number; 
  message: string;
  boardMutations?: { index: number; changes: Partial<DynamicSymbol> }[]; 
  totalSpinMedalFlatBonus?: number; 
  totalSpinMedalMultiplier?: number; 
}

export const applyAdjacentBonusesLogic = (
  initialBoard: BoardSymbol[], 
): AdjacentBonusResult => {
  let totalMedalsFromAB = 0;
  const abMessages: string[] = [];
  const mutations: { index: number; changes: Partial<DynamicSymbol> }[] = [];
  let spinFlatBonus = 0;
  let spinMultiplier = 1.0; // Start with 1.0 for multiplier

  const workingBoard: DynamicBoardSymbol[] = initialBoard.map(s => s ? { ...s } : null);

  // Phase 1: Effects that change symbol properties for the spin (Chameleon, Whetstone)
  workingBoard.forEach((symbol, index) => {
    if (!symbol || symbol.effectSystem !== 'AB') return;

    const adjacentSymbolsInfo = getAdjacentSymbolInfo(workingBoard, index);

    if (symbol.name === "カメレオンの鱗 (Chameleon Scale)") {
      const attributeCounts: Record<string, number> = {};
      adjacentSymbolsInfo.forEach(adj => {
        if (adj.symbol) {
          const attr = adj.symbol.dynamicAttribute || adj.symbol.attribute; 
          attributeCounts[attr] = (attributeCounts[attr] || 0) + 1;
        }
      });
      let maxCount = 0;
      let dominantAttribute: SymbolData['attribute'] | null = null;
      for (const attr in attributeCounts) {
        if (attributeCounts[attr] > maxCount) {
          maxCount = attributeCounts[attr];
          dominantAttribute = attr as SymbolData['attribute'];
        }
      }
      if (dominantAttribute) {
        // Ensure mutation target exists and is the chameleon itself
        if (workingBoard[index]?.name === "カメレオンの鱗 (Chameleon Scale)") {
             mutations.push({ index, changes: { dynamicAttribute: dominantAttribute } });
             if (!abMessages.includes(`${symbol.name.split(' ')[0]} mimics ${dominantAttribute}!`)) {
                abMessages.push(`${symbol.name.split(' ')[0]} mimics ${dominantAttribute}!`);
             }
        }
      }
    } else if (symbol.name === "砥石 (Whetstone)") {
      adjacentSymbolsInfo.forEach(adj => {
        if (adj.symbol && adj.symbol.attribute === "Weapon") {
          const currentBonus = adj.symbol.dynamicBonusBM || 0;
          // Ensure mutation target exists
          if (workingBoard[adj.index]) {
            mutations.push({ 
              index: adj.index, 
              changes: { dynamicBonusBM: currentBonus + 2 } 
            });
            if (!abMessages.some(m => m.startsWith(`${adj.symbol!.name.split(' ')[0]} sharpened`))) {
               abMessages.push(`${adj.symbol!.name.split(' ')[0]} sharpened (+2 BM)`);
            }
          }
        }
      });
    }
  });

  // Phase 2: Immediate medal gains (Lodestone, Honeybee (part 1), etc.)
  workingBoard.forEach((symbol, index) => {
    if (!symbol || symbol.effectSystem !== 'AB') return;
    const adjacentSymbolsInfo = getAdjacentSymbolInfo(workingBoard, index); 

    if (symbol.name === "磁鉄鉱 (Lodestone)") {
      const metalNeighbors = adjacentSymbolsInfo.filter(
        adj => adj.symbol && (adj.symbol.dynamicAttribute || adj.symbol.attribute) === "Metal"
      );
      if (metalNeighbors.length > 0) {
        const gain = metalNeighbors.length * 3;
        totalMedalsFromAB += gain;
        abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}`);
      }
    } else if (symbol.name === "蜜蜂 (Honeybee)") {
      const plantNeighbors = adjacentSymbolsInfo.filter(
        adj => adj.symbol && (adj.symbol.dynamicAttribute || adj.symbol.attribute) === "Plant"
      );
      if (plantNeighbors.length > 0) {
        const gain = plantNeighbors.length * 5;
        totalMedalsFromAB += gain;
        abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}(Plants)`);
      }
    } else if (symbol.name === "武器庫の鍵 (Armory Key)") {
      const weaponNeighbors = adjacentSymbolsInfo.filter(
        adj => adj.symbol && (adj.symbol.dynamicAttribute || adj.symbol.attribute) === "Weapon"
      );
      if (weaponNeighbors.length > 0) {
        const gain = parseBaseMedalValue(symbol.effectText); 
        if (gain > 0) {
            totalMedalsFromAB += gain;
            abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}(WeaponAdj)`);
        }
      }
    } else if (symbol.name === "共鳴クリスタル (Resonance Crystal)") {
      let gainFromResonance = 0;
      adjacentSymbolsInfo.forEach(adj => {
        if (adj.symbol && adj.symbol.name === symbol.name) { 
          switch(adj.symbol.rarity as SymbolRarity) { 
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
        const gain = parseBaseMedalValue(symbol.effectText); 
        if (gain > 0) { 
            totalMedalsFromAB += gain;
            abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}`);
        }
    }
  });


  // Phase 3: Total spin medal modifiers (Chain Link, Entangling Vine)
  workingBoard.forEach((symbol, index) => {
    if (!symbol || symbol.effectSystem !== 'AB') return;

    if (symbol.name === "金属の鎖 (Chain Link)") {
        const distinctAdjacentChains = getAdjacentSymbolInfo(workingBoard, index)
            .filter(adj => adj.symbol?.name === "金属の鎖 (Chain Link)").length;
        const chainBonus = Math.min(3, distinctAdjacentChains) * 2; // Max +6 from this one chain link based on its neighbors
        if (chainBonus > 0) {
            spinFlatBonus += chainBonus; 
            if (!abMessages.some(m => m.startsWith(`${symbol.name.split(' ')[0]} linked`))) { // Avoid spamming if multiple links
                 abMessages.push(`${symbol.name.split(' ')[0]} linked for +${chainBonus} to total.`);
            }
        }
    } else if (symbol.name === "絡みつく蔦 (Entangling Vine)") {
      const plantNeighbors = getAdjacentSymbolInfo(workingBoard, index)
        .filter(adj => adj.symbol && (adj.symbol.dynamicAttribute || adj.symbol.attribute) === "Plant");
      const percentageBonus = Math.min(10, plantNeighbors.length * 2); 
      if (percentageBonus > 0) {
        spinMultiplier *= (1 + percentageBonus / 100);
        if (!abMessages.some(m => m.startsWith(`${symbol.name.split(' ')[0]} entangles`))) {
            abMessages.push(`${symbol.name.split(' ')[0]} entangles for +${percentageBonus}% to total.`);
        }
      }
    }
  });


  return {
    gainedMedals: totalMedalsFromAB,
    message: abMessages.join(' | '),
    boardMutations: mutations.length > 0 ? mutations : undefined,
    totalSpinMedalFlatBonus: spinFlatBonus > 0 ? spinFlatBonus : undefined,
    totalSpinMedalMultiplier: spinMultiplier > 1 ? spinMultiplier : undefined,
  };
};


// --- Line Check, Line Bonus (LB), Special Spin (SS) Logic ---
export interface LineCheckResult {
  gainedMedals: number;
  message: string;
  formedLinesIndices: number[][];
  bombsToExplode: { index: number; symbol: SymbolData }[]; 
  itemsAwarded?: { type: string; name: string; data?: any }[];
  newSymbolsOnBoardPostEffect?: { index: number; symbolData: SymbolData }[];
  nextSpinCostModifier?: number; 
  symbolsToRemoveFromBoard?: number[];
  debuffsPreventedThisSpin?: boolean; 
}

const PAYLINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], 
  [0, 3, 6], [1, 4, 7], [2, 5, 8], 
  [0, 4, 8], [2, 4, 6],          
];

export const getRandomCoinSymbol = (availableSymbols: SymbolData[]): SymbolData | null => {
    const coinSymbols = availableSymbols.filter(s => s.name.includes("Coin") && s.attribute === "Metal");
    if (coinSymbols.length === 0) return null;
    return coinSymbols[Math.floor(Math.random() * coinSymbols.length)];
};

export const checkLinesAndApplyEffects = (
  boardAfterABMutations: DynamicBoardSymbol[], 
  currentAcquiredRelics: RelicData[],
  currentDeck: SymbolData[],
  allGameSymbols: SymbolData[],
  activeDebuffsFromEnemy: { type: string, duration: number, value?: number, originEnemy?: string }[] 
): LineCheckResult => {
  let totalMedalsFromLines = 0;
  const formedLineDetails: string[] = [];
  const formedLineIndicesArray: number[][] = [];
  const bombsToExplodeThisSpin: { index: number; symbol: SymbolData }[] = [];
  const itemsAwardedThisSpin: { type: string; name: string; data?: any }[] = [];
  const newSymbolsGenerated: { index: number; symbolData: SymbolData }[] = [];
  let costModifierForNextSpin: number | undefined = undefined;
  const symbolsToBeRemoved: number[] = [];
  let bucklerPreventsDebuff = false;

  const isAnySunberryOnFormedLineThisSpin = PAYLINES.some(lineIdxs => {
      const lineSyms = lineIdxs.map(i => boardAfterABMutations[i]);
      // A more robust check for "formed line" for Sunberry activation:
      let lineIsFormed = false;
      if (lineSyms.filter(s => s !== null).length === 3) {
          const wilds = lineSyms.filter(s => s?.name === "ワイルド (Wild)").length;
          const nonWilds = lineSyms.filter(s => s !== null && s.name !== "ワイルド (Wild)") as DynamicSymbol[];
          if (nonWilds.length === 3 && nonWilds.every(s => (s.dynamicAttribute || s.attribute) === (nonWilds[0].dynamicAttribute || nonWilds[0].attribute))) lineIsFormed = true;
          else if (nonWilds.length === 2 && wilds === 1 && (nonWilds[0].dynamicAttribute || nonWilds[0].attribute) === (nonWilds[1].dynamicAttribute || nonWilds[1].attribute)) lineIsFormed = true;
          else if (nonWilds.length === 1 && wilds === 2) lineIsFormed = true;
          else if (wilds === 3) lineIsFormed = true;
      }
      return lineIsFormed && lineSyms.some(s => s?.name === "サンベリー (Sunberry)");
  });


  PAYLINES.forEach((lineIndices) => {
    const symbolsOnLine = lineIndices.map(i => boardAfterABMutations[i]);
    const dynamicSymbolsOnLine: DynamicBoardSymbol[] = symbolsOnLine.map(s => s ? {...s} : null);
    const validSymbolsOnLine = dynamicSymbolsOnLine.filter(s => s !== null) as DynamicSymbol[];

    if (validSymbolsOnLine.length < 3) return;

    const wildCount = validSymbolsOnLine.filter(sym => sym.name === "ワイルド (Wild)").length;
    const nonWildSymbols = validSymbolsOnLine.filter(sym => sym.name !== "ワイルド (Wild)");
    
    let effectiveAttribute: SymbolData['attribute'] | null = null;
    if (nonWildSymbols.length === 3 && nonWildSymbols.every(s => (s.dynamicAttribute || s.attribute) === (nonWildSymbols[0].dynamicAttribute || nonWildSymbols[0].attribute))) {
      effectiveAttribute = (nonWildSymbols[0].dynamicAttribute || nonWildSymbols[0].attribute);
    } else if (nonWildSymbols.length === 2 && wildCount === 1 && (nonWildSymbols[0].dynamicAttribute || nonWildSymbols[0].attribute) === (nonWildSymbols[1].dynamicAttribute || nonWildSymbols[1].attribute)) {
      effectiveAttribute = (nonWildSymbols[0].dynamicAttribute || nonWildSymbols[0].attribute);
    } else if (nonWildSymbols.length === 1 && wildCount === 2) {
      effectiveAttribute = (nonWildSymbols[0].dynamicAttribute || nonWildSymbols[0].attribute);
    } else if (wildCount === 3) {
      effectiveAttribute = "Mystic"; 
    }

    if (effectiveAttribute) { 
      let currentLineBaseMedal = 0;
      let lineMsg = `${effectiveAttribute} Line (W:${wildCount}): `;
      let isChameleonInThisLineAndActive = false;

      validSymbolsOnLine.forEach(s => {
        let singleSymbolGain = 0;
        const baseBM = parseBaseMedalValue(s.effectText) + (s.dynamicBonusBM || 0);

        if (s.name === "ワイルド (Wild)") {
          lineMsg += ` Wild `;
        } else if (s.name === "カメレオンの鱗 (Chameleon Scale)" && s.dynamicAttribute && effectiveAttribute === s.dynamicAttribute) {
            // Chameleon contributes to forming the line with its dynamicAttribute
            s.isChameleonTriggeredForLine = true; 
            isChameleonInThisLineAndActive = true; // Mark for +1 medal if line wins
            lineMsg += ` ${s.name.split(' ')[0]}(${s.dynamicAttribute}) `;
            // Chameleon itself might not have a BM, or it could be 0.
            // Its +1 is added after calculating the line's BM total.
        }
        else if (s.effectSystem === 'BM' || 
                   ['ボム (Bomb)', 'ギア (Gear)', '幸運の招き猫 (Lucky Cat)', '狩人の狼 (Hunter Wolf)', 'サンベリー (Sunberry)'].includes(s.name) ||
                   s.name === "血塗られたダガー (Bloodied Dagger)" || s.name === "呪いの仮面 (Cursed Mask)") {
          
          singleSymbolGain = baseBM; 

          if (s.name === "森のリス (Forest Squirrel)") {
            singleSymbolGain = countSymbolsOnBoard(boardAfterABMutations, cs => (cs.dynamicAttribute || cs.attribute) === "Plant") > 0 ? 4 : 3;
          } else if (s.name === "星のかけら (Stardust)") {
            singleSymbolGain = countSymbolsOnBoard(boardAfterABMutations, cs => (cs.dynamicAttribute || cs.attribute) === "Mystic") > 0 ? 5 : 3;
          }
          
          if ((s.dynamicAttribute || s.attribute) === "Plant" && s.name !== "サンベリー (Sunberry)" && isAnySunberryOnFormedLineThisSpin) {
              singleSymbolGain +=3;
          }
          singleSymbolGain = applyRelicToSymbolBM(s, singleSymbolGain, currentAcquiredRelics);
          if (s.name === "呪いの仮面 (Cursed Mask)") {
             const curseMatch = s.effectText.match(/メダル\s*-(\d+)/);
             if (curseMatch && curseMatch[1]) {
                singleSymbolGain = -parseInt(curseMatch[1], 10);
             }
          }
          
          currentLineBaseMedal += singleSymbolGain;
          if (singleSymbolGain !== 0) {
            lineMsg += ` ${s.name.split(' ')[0]}(${singleSymbolGain >= 0 ? '+' : ''}${singleSymbolGain}) `;
          }
        }
      });
      
      let finalLineWin = currentLineBaseMedal;
      if (isChameleonInThisLineAndActive) {
          finalLineWin += 1;
          lineMsg += `[Chameleon+1]`;
      }

      validSymbolsOnLine.forEach((s, symbolIdxOnLine) => {
        const boardIndexOfSymbol = lineIndices[symbolIdxOnLine];
        if (s.effectSystem === 'LB') {
          if (s.name === "バックラー (Buckler)") {
             if (activeDebuffsFromEnemy.length > 0 || boardAfterABMutations.some(bs => bs?.name === "呪いの仮面 (Cursed Mask)")) {
                 bucklerPreventsDebuff = true; // Mark that Buckler *could* prevent a debuff
                 lineMsg += `[Buckler Protected!]`;
             }
             finalLineWin += parseBaseMedalValue(s.effectText); // Buckler's own +2
          }
          else if (s.name === "ベル (Bell)" && validSymbolsOnLine.filter(ls => ls.name === "ベル (Bell)").length === 3 && currentLineBaseMedal > 0) { /*...*/ }
          else if (s.name === "チェリー (Cherry)") { /*...*/ }
          else if (s.name === "BAR (BAR)") { /*...*/ }
          else if (s.name === "四つ葉のクローバー (Four-Leaf Clover)" && validSymbolsOnLine.filter(ls => ls.name === s.name).length === 3) { /*...*/ }
          else if (s.name === "大漁旗 (Big Catch Flag)" && validSymbolsOnLine.filter(ls => ls.name === s.name).length === 3) { /*...*/ }
          else if (s.name === "幸運の招き猫 (Lucky Cat)") { /*...*/ }
          else if (s.name === "宝箱 (Treasure Chest)") { /*...*/ }
        }
      });

      if (validSymbolsOnLine.filter(sym => sym.name === "小魚 (Small Fish)").length === 3) { /*...*/ }
      if (validSymbolsOnLine.filter(sym => sym.name === "木の実 (Nut)").length === 3) { /*...*/ }
      if (validSymbolsOnLine.filter(sym => sym.name === "木の盾 (Wooden Shield)").length === 3) { /*...*/ }

      validSymbolsOnLine.forEach((s, idxInLine) => {
        if (s.effectSystem === 'SS') {
          if (s.name === "ワイルド (Wild)") { /*...*/ }
          else if (s.name === "ギア (Gear)") { /*...*/ }
          else if (s.name === "ボム (Bomb)") { /*...*/ }
          else if (s.name === "サンベリー (Sunberry)") { /*...*/ }
          else if (s.name === "狩人の狼 (Hunter Wolf)") { /*...*/ }
        }
      });
      
      // Rich Soil (after all other calculations for this specific line)
      let soilBoostAppliedToThisLine = false;
      lineIndices.forEach(symbolPosOnBoard => {
          const soilNeighbors = getAdjacentSymbolInfo(boardAfterABMutations, symbolPosOnBoard);
          soilNeighbors.forEach(adjSoilInfo => {
              if (adjSoilInfo.symbol?.name === "栄養豊富な土壌 (Rich Soil)") {
                  const mainSymbol = boardAfterABMutations[symbolPosOnBoard];
                  if (mainSymbol && (mainSymbol.dynamicAttribute || mainSymbol.attribute) === "Plant" && 
                      validSymbolsOnLine.find(vSym => vSym.no === mainSymbol.no && getIndexFromBoardPosition(getBoardPosition(symbolPosOnBoard)) === symbolPosOnBoard ) // Ensure it's the one on this line
                  ) {
                      if (!soilBoostAppliedToThisLine) { // Apply only once per line from any Rich Soil
                        finalLineWin += 3;
                        if (!lineMsg.includes("[SoilBoost]")) lineMsg += `[SoilBoost+3]`;
                        soilBoostAppliedToThisLine = true;
                      }
                  }
              }
          });
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
    itemsAwarded: itemsAwardedThisSpin.length > 0 ? itemsAwardedThisSpin : undefined,
    newSymbolsOnBoardPostEffect: newSymbolsGenerated.length > 0 ? newSymbolsGenerated : undefined,
    nextSpinCostModifier: costModifierForNextSpin,
    symbolsToRemoveFromBoard: symbolsToBeRemoved.length > 0 ? symbolsToBeRemoved : undefined,
    debuffsPreventedThisSpin: bucklerPreventsDebuff || undefined,
  };
};

export interface BombExplosionResult {
  gainedMedals: number;
  newBoard: DynamicBoardSymbol[]; 
  message: string;
}

export const handleBombExplosionsLogic = (
  bombsToExplode: { index: number; symbol: SymbolData }[],
  currentBoard: DynamicBoardSymbol[] 
): BombExplosionResult => { 
  if (bombsToExplode.length === 0) {
    return { gainedMedals: 0, newBoard: [...currentBoard], message: "" };
  }
  let totalExplosionMedals = 0;
  let boardAfterExplosions: DynamicBoardSymbol[] = [...currentBoard]; 
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