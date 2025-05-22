// src/app/game/symbollogic.ts
import type {
  SymbolData,
  RelicData,
  InstanceSymbolData,
  DynamicSymbol as CoreDynamicSymbol, // types/kigaslot.ts からインポート
  Debuff,
  ItemAward,
  PersistingSymbolInfo,
} from '@/types/kigaslot';
import { symbols as allGameSymbols } from '@/data/symbols'; // For symbol lookups, relic effects etc.
import { v4 as uuidv4 } from 'uuid'; // For new persisting symbols if needed

// Utility Type for board symbols (InstanceSymbolDataをベースにする)
export type BoardSymbol = InstanceSymbolData | null;

// Extended symbol type for dynamic in-spin state
// DynamicSymbol は InstanceSymbolData を継承するように型定義側で修正済みとする
export type DynamicSymbol = CoreDynamicSymbol;
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

  const onBoardMatch = effectText.match(/\(\+(\d+)メダル\)/); // For AB symbols like Lodestone
  if (onBoardMatch && onBoardMatch[1]) return parseInt(onBoardMatch[1], 10);

  const selfGainMatch = effectText.match(/自身のメダル獲得量を\s*\+(\d+)\s*する/); // For Whetstone style effects
  if (selfGainMatch && selfGainMatch[1]) return parseInt(selfGainMatch[1], 10);

  const negativeMedalMatch = effectText.match(/メダル\s*-(\d+)/);
  if (negativeMedalMatch && negativeMedalMatch[1]) return -parseInt(negativeMedalMatch[1], 10);

  return 0;
};

export const applyRelicToSymbolBM = (
  symbol: DynamicSymbol,
  baseGain: number,
  currentAcquiredRelics: RelicData[],
  boardForContext?: DynamicBoardSymbol[], // Added for Symbiotic Mycelium
  symbolIndexOnBoard?: number        // Added for Symbiotic Mycelium
): number => {
  let modifiedGain = baseGain;
  currentAcquiredRelics.forEach(relic => {
    const attributeToCheck = symbol.dynamicAttribute || symbol.attribute;
    
    if (relic.no === 1 && attributeToCheck === "Metal") modifiedGain += 2; // Anvil of the Forge God
    else if (relic.no === 4 && attributeToCheck === "Plant") modifiedGain += 2; // Droplet of the Life Spring (BM part)
    else if (relic.no === 7 && attributeToCheck === "Animal") modifiedGain += 2; // Crest of the Beast King
    else if (relic.no === 10 && attributeToCheck === "Weapon") modifiedGain += 2; // Sheath of the Legendary Swordmaster
    else if (relic.no === 13 && attributeToCheck === "Mystic") modifiedGain += 2; // Crystal Ball of Stargazing

    // No. 5: Symbiotic Mycelium
    else if (relic.no === 5 && boardForContext && typeof symbolIndexOnBoard === 'number') {
      const symbolAttribute = symbol.dynamicAttribute || symbol.attribute;
      const adjacentSymbolsInfo = getAdjacentSymbolInfo(boardForContext, symbolIndexOnBoard);
      
      if (symbolAttribute === "Plant" && adjacentSymbolsInfo.some(adj => adj.symbol && (adj.symbol.dynamicAttribute || adj.symbol.attribute) === "Animal")) {
        modifiedGain += 3;
      } else if (symbolAttribute === "Animal" && adjacentSymbolsInfo.some(adj => adj.symbol && (adj.symbol.dynamicAttribute || adj.symbol.attribute) === "Plant")) {
        modifiedGain += 3;
      }
    }
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
  rareSymbolAppearanceModifier?: number;
  symbolsToPersist?: { index: number; symbol: SymbolData; duration: number }[];
}

const findConnectedChains = (board: DynamicBoardSymbol[], startIndex: number, visitedGlobal: Set<number>): Set<number> => {
    const component = new Set<number>();
    const queue: number[] = [startIndex];
    component.add(startIndex);
    visitedGlobal.add(startIndex);

    while (queue.length > 0) {
        const currentIndex = queue.shift()!;
        getAdjacentSymbolInfo(board, currentIndex).forEach(adj => {
            if (adj.symbol?.name === "金属の鎖 (Chain Link)" && !component.has(adj.index)) {
                component.add(adj.index);
                visitedGlobal.add(adj.index);
                queue.push(adj.index);
            }
        });
    }
    return component;
};


export const applyAdjacentBonusesLogic = (
  initialBoard: BoardSymbol[],
  currentAcquiredRelics: RelicData[] // Added for Automation Gear
): AdjacentBonusResult => {
  let totalMedalsFromAB = 0;
  const abMessages: string[] = [];
  const mutations: { index: number; changes: Partial<DynamicSymbol> }[] = [];
  let spinFlatBonus = 0;
  let spinMultiplierTotalRate = 0;
  let rareModifier = 0;
  const persistSymbolsOutput: AdjacentBonusResult['symbolsToPersist'] = [];

  const workingBoard: DynamicBoardSymbol[] = initialBoard.map(s => s ? { ...s } as DynamicSymbol : null);

  // First pass for mutations (e.g., Chameleon, Whetstone)
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
      if (dominantAttribute && workingBoard[index]?.name === "カメレオンの鱗 (Chameleon Scale)") {
        const currentSymbolAtIndex = workingBoard[index];
        if (currentSymbolAtIndex) {
            mutations.push({ index, changes: { dynamicAttribute: dominantAttribute } });
            workingBoard[index] = { ...currentSymbolAtIndex, dynamicAttribute: dominantAttribute };
            if (!abMessages.includes(`${symbol.name.split(' ')[0]} mimics ${dominantAttribute}!`)) {
               abMessages.push(`${symbol.name.split(' ')[0]} mimics ${dominantAttribute}!`);
            }
        }
      }
    } else if (symbol.name === "砥石 (Whetstone)") {
      adjacentSymbolsInfo.forEach(adj => {
        if (adj.symbol && adj.symbol.attribute === "Weapon" && workingBoard[adj.index]) {
          const targetSymbol = workingBoard[adj.index]!;
          const currentBonus = targetSymbol.dynamicBonusBM || 0;
          const newBonus = currentBonus + 2;
          mutations.push({ index: adj.index, changes: { dynamicBonusBM: newBonus } });
          workingBoard[adj.index] = { ...targetSymbol, dynamicBonusBM: newBonus };
          if (!abMessages.some(m => m.startsWith(`${targetSymbol.name.split(' ')[0]} sharpened`))) {
             abMessages.push(`${targetSymbol.name.split(' ')[0]} sharpened (+2 BM)`);
          }
        }
      });
    }
  });

  const visitedChainsGlobal = new Set<number>();

  // Second pass for medal gains and other AB effects, using the mutated board
  workingBoard.forEach((symbol, index) => {
    if (!symbol || symbol.effectSystem !== 'AB') return;
    const adjacentSymbolsInfo = getAdjacentSymbolInfo(workingBoard, index);

    if (symbol.name === "磁鉄鉱 (Lodestone)") {
      const metalNeighbors = adjacentSymbolsInfo.filter(adj => adj.symbol && (adj.symbol.dynamicAttribute || adj.symbol.attribute) === "Metal");
      if (metalNeighbors.length > 0) { totalMedalsFromAB += metalNeighbors.length * 3; abMessages.push(`${symbol.name.split(' ')[0]}:+${metalNeighbors.length * 3}`); }
    } else if (symbol.name === "蜜蜂 (Honeybee)") {
      const plantNeighbors = adjacentSymbolsInfo.filter(adj => adj.symbol && (adj.symbol.dynamicAttribute || adj.symbol.attribute) === "Plant");
      if (plantNeighbors.length > 0) {
        totalMedalsFromAB += plantNeighbors.length * 5; abMessages.push(`${symbol.name.split(' ')[0]}:+${plantNeighbors.length * 5}(Plants)`);
        if (plantNeighbors.length >= 2) {
            const baseSymbolData = allGameSymbols.find(s => s.no === symbol.no);
            if(baseSymbolData){
                persistSymbolsOutput.push({ index, symbol: baseSymbolData, duration: 1 });
                abMessages.push(`${symbol.name.split(' ')[0]} will stay!`);
            }
        }
      }
    } else if (symbol.name === "武器庫の鍵 (Armory Key)") {
      if (adjacentSymbolsInfo.some(adj => adj.symbol && (adj.symbol.dynamicAttribute || adj.symbol.attribute) === "Weapon")) {
        const gain = parseBaseMedalValue(symbol.effectText);
        if (gain > 0) { totalMedalsFromAB += gain; abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}(WeaponAdj)`);}
      }
    } else if (symbol.name === "共鳴クリスタル (Resonance Crystal)") {
      let gain = 0;
      adjacentSymbolsInfo.forEach(adj => {
        if (adj.symbol?.name === symbol.name) {
          switch(adj.symbol.rarity) {
            case "Common": gain += 2; break;
            case "Uncommon": gain += 4; break;
            case "Rare": gain += 7; break;
          }
        }
      });
      if (gain > 0) { totalMedalsFromAB += gain; abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}(Resonance)`);}
    } else if (symbol.name === "魔法陣の欠片 (Magic Circle Fragment)") {
        const gain = parseBaseMedalValue(symbol.effectText);
        if (gain > 0) { totalMedalsFromAB += gain; abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}`);}
        const mysticNeighbors = adjacentSymbolsInfo.filter(adj => adj.symbol && (adj.symbol.dynamicAttribute || adj.symbol.attribute) === "Mystic").length;
        if (mysticNeighbors > 0) {
            rareModifier += mysticNeighbors * 1;
            abMessages.push(`${symbol.name.split(' ')[0]} boosts Rare% by ${mysticNeighbors}%`);
        }
    }
  });

  const processedChainLinksForBonusCalc = new Set<number>();
  workingBoard.forEach((symbol, index) => {
    if (!symbol || symbol.effectSystem !== 'AB') return;

    if (symbol.name === "金属の鎖 (Chain Link)" && !visitedChainsGlobal.has(index)) {
        const chainGroup = findConnectedChains(workingBoard, index, visitedChainsGlobal);
        let groupChainBonus = 0;
        chainGroup.forEach(linkIndexInGroup => {
            if (processedChainLinksForBonusCalc.has(linkIndexInGroup)) return;
            const linkSymbol = workingBoard[linkIndexInGroup];
            if (linkSymbol && linkSymbol.name === "金属の鎖 (Chain Link)") {
                const distinctNeighbors = getAdjacentSymbolInfo(workingBoard, linkIndexInGroup)
                    .filter(adj => adj.symbol?.name === "金属の鎖 (Chain Link)").length;
                groupChainBonus += Math.min(3, distinctNeighbors) * 2;
                processedChainLinksForBonusCalc.add(linkIndexInGroup);
            }
        });
        if (groupChainBonus > 0) {
            spinFlatBonus += groupChainBonus;
            abMessages.push(`Chain Link group: +${groupChainBonus} to total spin medals.`);
        }
    } else if (symbol.name === "絡みつく蔦 (Entangling Vine)") {
      const plantNeighbors = getAdjacentSymbolInfo(workingBoard, index)
        .filter(adj => adj.symbol && (adj.symbol.dynamicAttribute || adj.symbol.attribute) === "Plant");
      const percentageBonusFromThisVine = plantNeighbors.length * 2;
      if (percentageBonusFromThisVine > 0) {
        spinMultiplierTotalRate += percentageBonusFromThisVine;
        abMessages.push(`${symbol.name.split(' ')[0]} adds ${percentageBonusFromThisVine}% to multiplier rate.`);
      }
    }
  });

  let finalSpinMultiplier = 1.0;
  if (spinMultiplierTotalRate > 0) {
      finalSpinMultiplier = 1 + (Math.min(10, spinMultiplierTotalRate) / 100);
  }

  // No.3: Automation Gear (for Chain Link)
  if (currentAcquiredRelics.some(r => r.no === 3) && spinFlatBonus > 0) {
    spinFlatBonus *= 2;
    abMessages.push(`Automation Gear doubles Chain Link bonus!`);
  }

  return {
    gainedMedals: totalMedalsFromAB,
    message: abMessages.join(' | '),
    boardMutations: mutations.length > 0 ? mutations : undefined,
    totalSpinMedalFlatBonus: spinFlatBonus > 0 ? spinFlatBonus : undefined,
    totalSpinMedalMultiplier: finalSpinMultiplier > 1 ? finalSpinMultiplier : undefined,
    rareSymbolAppearanceModifier: rareModifier > 0 ? Math.min(5, rareModifier) : undefined,
    symbolsToPersist: persistSymbolsOutput.length > 0 ? persistSymbolsOutput : undefined,
  };
};

export interface LineCheckResult {
  gainedMedals: number;
  message: string;
  formedLinesIndices: number[][];
  bombsToExplode: { index: number; symbol: InstanceSymbolData }[];
  itemsAwarded?: ItemAward[];
  newSymbolsOnBoardPostEffect?: { index: number; symbolData: SymbolData }[];
  nextSpinCostModifier?: number;
  symbolsToRemoveFromBoard?: number[];
  debuffsPreventedThisSpin?: boolean;
  symbolsToAddToDeck?: SymbolData[];
  symbolsToRemoveFromDeckByName?: string[];
  additionalMedalsFromRG?: number;
  incrementRustedLumpCounter?: string[];
  requestRespin?: { type: 'phoenix_all_columns' | 'arrow_column'; columnsToRespin?: number[]; triggeredBySymbolInstanceId?: string };
  transformToWildOnNextSpinCount?: number;
  previewSymbolsForNextSpin?: SymbolData[];
  newPersistingSymbolsFromLineEffect?: PersistingSymbolInfo[];
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
  currentDeck: InstanceSymbolData[],
  activeDebuffsFromEnemy: Debuff[]
): LineCheckResult => {
  let totalMedalsFromLines = 0;
  const formedLineDetails: string[] = [];
  const formedLineIndicesArray: number[][] = [];
  const bombsToExplodeThisSpin: { index: number; symbol: InstanceSymbolData }[] = [];
  const itemsAwardedThisSpin: ItemAward[] = [];
  const newSymbolsGenerated: { index: number; symbolData: SymbolData }[] = [];
  let costModifierForNextSpin: number | undefined = undefined;
  const symbolsToBeRemoved: number[] = [];
  let bucklerPreventsDebuff = false;
  const symbolsToAddToDeckThisSpin: SymbolData[] = [];
  const symbolsToRemoveFromDeckThisSpin: string[] = [];
  let rgMedalBonus = 0;
  const rustedLumpCountersToIncrement: string[] = [];
  let respinRequest: LineCheckResult['requestRespin'] | undefined = undefined;
  let wildTransformCount = 0;
  let symbolPreview: SymbolData[] | undefined = undefined;
  const newPersistingFromLines: PersistingSymbolInfo[] = [];

  const isAnySunberryOnFormedLineThisSpin = PAYLINES.some(lineIdxs => {
      const lineSyms = lineIdxs.map(i => boardAfterABMutations[i]);
      let lineIsFormed = false;
      if (lineSyms.filter(s => s !== null).length === 3) {
          const wilds = lineSyms.filter(s => s?.name === "ワイルド (Wild)").length;
          const nonWilds = lineSyms.filter(s => s !== null && s.name !== "ワイルド (Wild)") as DynamicSymbol[];
          if (nonWilds.length === 3 && nonWilds.every(s => (s.dynamicAttribute || s.attribute) === (nonWilds[0].dynamicAttribute || nonWilds[0].attribute))) lineIsFormed = true;
          else if (nonWilds.length === 2 && wilds === 1 && (nonWilds[0].dynamicAttribute || nonWilds[0].attribute) === (nonWilds[1].dynamicAttribute || nonWilds[1].attribute)) lineIsFormed = true;
          else if (nonWilds.length === 1 && wilds === 2 && nonWilds[0]) lineIsFormed = true;
          else if (wilds === 3) lineIsFormed = true;
      }
      return lineIsFormed && lineSyms.some(s => s?.name === "サンベリー (Sunberry)");
  });

  PAYLINES.forEach((lineIndices) => {
    const symbolsOnLine = lineIndices.map(i => boardAfterABMutations[i]);
    const validSymbolsOnLine = symbolsOnLine.filter(s => s !== null) as DynamicSymbol[];

    if (validSymbolsOnLine.length < 3) return;

    const wildCount = validSymbolsOnLine.filter(sym => sym.name === "ワイルド (Wild)").length;
    const nonWildSymbols = validSymbolsOnLine.filter(sym => sym.name !== "ワイルド (Wild)");

    let effectiveAttribute: SymbolData['attribute'] | null = null;
    if (nonWildSymbols.length === 3 && nonWildSymbols.every(s => (s.dynamicAttribute || s.attribute) === (nonWildSymbols[0].dynamicAttribute || nonWildSymbols[0].attribute))) {
      effectiveAttribute = (nonWildSymbols[0].dynamicAttribute || nonWildSymbols[0].attribute);
    } else if (nonWildSymbols.length === 2 && wildCount === 1 && (nonWildSymbols[0].dynamicAttribute || nonWildSymbols[0].attribute) === (nonWildSymbols[1].dynamicAttribute || nonWildSymbols[1].attribute)) {
      effectiveAttribute = (nonWildSymbols[0].dynamicAttribute || nonWildSymbols[0].attribute);
    } else if (nonWildSymbols.length === 1 && wildCount === 2 && nonWildSymbols[0]) {
      effectiveAttribute = (nonWildSymbols[0].dynamicAttribute || nonWildSymbols[0].attribute);
    } else if (wildCount === 3) {
      effectiveAttribute = "Mystic";
    }

    if (effectiveAttribute) {
      let currentLineBaseMedal = 0;
      let lineMsg = `${effectiveAttribute} Line (W:${wildCount}): `;
      let isChameleonInThisLineAndActive = false;

      validSymbolsOnLine.forEach((s, symbolIdxOnLine) => {
        let singleSymbolGain = 0;
        const baseBMFromText = parseBaseMedalValue(s.effectText);
        singleSymbolGain = baseBMFromText + (s.dynamicBonusBM || 0);

        const boardIndexOfSymbol = lineIndices[symbolIdxOnLine]; // For Symbiotic Mycelium context

        if (s.name === "ワイルド (Wild)") { lineMsg += ` Wild `; }
        else if (s.name === "カメレオンの鱗 (Chameleon Scale)" && s.dynamicAttribute && effectiveAttribute === s.dynamicAttribute) {
            s.isChameleonTriggeredForLine = true;
            isChameleonInThisLineAndActive = true;
            lineMsg += ` ${s.name.split(' ')[0]}(${s.dynamicAttribute}) `;
        }
        else if (s.effectSystem === 'BM' || s.effectSystem === 'RG' ||
                   ['ボム (Bomb)', 'ギア (Gear)', '幸運の招き猫 (Lucky Cat)', '狩人の狼 (Hunter Wolf)', 'サンベリー (Sunberry)'].includes(s.name) ||
                   s.name === "血塗られたダガー (Bloodied Dagger)" || s.name === "呪いの仮面 (Cursed Mask)") {

          if (s.name === "森のリス (Forest Squirrel)") { singleSymbolGain = countSymbolsOnBoard(boardAfterABMutations, cs => (cs.dynamicAttribute || cs.attribute) === "Plant") > 0 ? 4 : 3; }
          else if (s.name === "星のかけら (Stardust)") { singleSymbolGain = countSymbolsOnBoard(boardAfterABMutations, cs => (cs.dynamicAttribute || cs.attribute) === "Mystic") > 0 ? 5 : 3; }
          
          if ((s.dynamicAttribute || s.attribute) === "Plant" && s.name !== "サンベリー (Sunberry)" && isAnySunberryOnFormedLineThisSpin) {
            singleSymbolGain +=3;
          }
          singleSymbolGain = applyRelicToSymbolBM(s, singleSymbolGain, currentAcquiredRelics, boardAfterABMutations, boardIndexOfSymbol);

          if (s.name === "錆びる鉄塊 (Rusted Lump)" && s.instanceId) {
            if (!rustedLumpCountersToIncrement.includes(s.instanceId)) {
                rustedLumpCountersToIncrement.push(s.instanceId);
            }
          }
          currentLineBaseMedal += singleSymbolGain;
          if (singleSymbolGain !== 0 || baseBMFromText !== 0) { lineMsg += ` ${s.name.split(' ')[0]}(${singleSymbolGain >= 0 ? '+' : ''}${singleSymbolGain}) `; }
        }
      });

      let finalLineWin = currentLineBaseMedal;
      if (isChameleonInThisLineAndActive) { finalLineWin += 1; lineMsg += `[Chameleon+1]`; }

      validSymbolsOnLine.forEach((s, symbolIdxOnLine) => {
        const boardIndexOfSymbol = lineIndices[symbolIdxOnLine];
        if (s.effectSystem === 'LB') {
          if (s.name === "バックラー (Buckler)") {
             const hasNegativeEffects = activeDebuffsFromEnemy.length > 0 ||
                                    boardAfterABMutations.some(bs => bs?.name === "呪いの仮面 (Cursed Mask)") ||
                                    boardAfterABMutations.some(bs => bs?.name === "錆びる鉄塊 (Rusted Lump)");
             if (hasNegativeEffects) { bucklerPreventsDebuff = true; lineMsg += `[Buckler Protects!]`; }
             finalLineWin += parseBaseMedalValue(s.effectText);
          }
          else if (s.name === "ベル (Bell)" && validSymbolsOnLine.filter(ls => ls.name === "ベル (Bell)").length === 3 && currentLineBaseMedal > 0) {
            finalLineWin = Math.floor(finalLineWin * 1.5) + 1; lineMsg += `[Bell x1.5+1]`;
          }
          else if (s.name === "チェリー (Cherry)") {
            const cherryCount = validSymbolsOnLine.filter(ls=>ls.name==="チェリー (Cherry)").length;
            const bonus = cherryCount === 1 ? 3 : cherryCount === 2 ? 8 : cherryCount >= 3 ? 20 : 0;
            if(bonus > 0){ finalLineWin += bonus; lineMsg += `[Cherry+${bonus}]`; }
          }
          else if (s.name === "BAR (BAR)") {
            if(validSymbolsOnLine.every(ls=>ls.name==="BAR (BAR)")) { finalLineWin = 50; lineMsg += `[PureBAR->50]`; }
          }
          else if (s.name === "四つ葉のクローバー (Four-Leaf Clover)" && validSymbolsOnLine.filter(ls => ls.name === s.name).length === 3) {
            finalLineWin += 30;
            if(Math.random() < 0.15){ itemsAwardedThisSpin.push({type:"RelicFragment", name:"レリックの欠片"}); lineMsg += `[Clover:Relic!]`;}
          }
          else if (s.name === "大漁旗 (Big Catch Flag)" && validSymbolsOnLine.filter(ls => ls.name === s.name).length === 3) {
            const animalBonus = currentDeck.filter(ds=>ds.attribute==="Animal").length * 3;
            if(animalBonus > 0){ finalLineWin += animalBonus; lineMsg += `[FlagBonus+${animalBonus}]`;}
          }
          else if (s.name === "幸運の招き猫 (Lucky Cat)") {
            const r=Math.random();
            if(r < 0.15){ finalLineWin += 25; lineMsg += `[LuckyCat:+25!]`; }
            else if(r < 0.30){
              const cS = getRandomCoinSymbol(allGameSymbols);
              if(cS){ newSymbolsGenerated.push({index: boardIndexOfSymbol, symbolData: cS}); lineMsg += `[LuckyCat:CoinGen!]`; }
            }
          }
          else if (s.name === "宝箱 (Treasure Chest)") {
            if(Math.random() < 0.3){
              if(Math.random() < 0.5){ itemsAwardedThisSpin.push({type:"RelicFragment",name:"レリックの欠片"}); lineMsg += `[Chest:Relic!]`; }
              else { const m = Math.floor(Math.random()*21)+10; finalLineWin += m; lineMsg += `[Chest:+${m}!]`; }
            }
          }
          else if (s.name === "リスピン・アロー (Respin Arrow)") {
            let respinChance = 0.5;
            if (currentAcquiredRelics.some(r => r.no === 12)) { // True-Aim Feather Part 1
              respinChance = 1.0;
            }
            if (Math.random() < respinChance && !respinRequest) {
              const column = getBoardPosition(boardIndexOfSymbol).c;
              if (column !== -1) {
                respinRequest = { type: 'arrow_column', columnsToRespin: [column], triggeredBySymbolInstanceId: s.instanceId };
                lineMsg += `[Arrow Respin Col ${column + 1}!` + (respinChance === 1.0 ? " (True-Aim!)" : "") + "]";
              }
            }
          }
          else if (s.name === "運命のタロット (Tarot of Fate)" && validSymbolsOnLine.filter(ls => ls.name === s.name).length === 3) {
            if (!symbolPreview) {
              const preview: SymbolData[] = [];
              const deckCopy = [...currentDeck];
              for (let i = 0; i < 3 && deckCopy.length > 0; i++) {
                const randIdx = Math.floor(Math.random() * deckCopy.length);
                const { instanceId: _instanceId, ...baseSymbolData } = deckCopy.splice(randIdx, 1)[0];
                preview.push(baseSymbolData as SymbolData);
              }
              if (preview.length > 0) { symbolPreview = preview; lineMsg += `[Tarot Preview!]`; }
            }
          }
        }
      });
      
      // No. 6: Horn of Plenty
      if (currentAcquiredRelics.some(r => r.no === 6)) {
        const isPureCherryLine = validSymbolsOnLine.length === 3 && validSymbolsOnLine.every(sym => sym.name === "チェリー (Cherry)");
        const isPureCloverLine = validSymbolsOnLine.length === 3 && validSymbolsOnLine.every(sym => sym.name === "四つ葉のクローバー (Four-Leaf Clover)");
        if ((isPureCherryLine || isPureCloverLine) && finalLineWin > 0) {
          const originalLineWinForHorn = finalLineWin; // Store before doubling
          finalLineWin += originalLineWinForHorn; // Add same amount
          lineMsg += ` [Horn+${originalLineWinForHorn}!]`;
        }
      }

      if (validSymbolsOnLine.some(s => s.name === "血塗られたダガー (Bloodied Dagger)") && finalLineWin > 0) {
          const curseMaskSymbolData = allGameSymbols.find(gs => gs.name === "呪いの仮面 (Cursed Mask)");
          if (curseMaskSymbolData) { symbolsToAddToDeckThisSpin.push(curseMaskSymbolData); lineMsg += `[Dagger adds Curse!]`; }
      }
      if (validSymbolsOnLine.length === 3 && validSymbolsOnLine.every(s => s.name === "呪いの仮面 (Cursed Mask)")) {
          symbolsToRemoveFromDeckThisSpin.push("呪いの仮面 (Cursed Mask)");
          rgMedalBonus += 30; lineMsg += `[3xCurseMasks Vanished!+30]`;
          // No. 14: Forbidden Grimoire
          if (currentAcquiredRelics.some(r => r.no === 14)) {
            const rareSymbols = allGameSymbols.filter(gs => gs.rarity === 'Rare' && gs.name !== "呪いの仮面 (Cursed Mask)");
            if (rareSymbols.length > 0) {
              const randomRareSymbol = rareSymbols[Math.floor(Math.random() * rareSymbols.length)];
              symbolsToAddToDeckThisSpin.push(randomRareSymbol);
              lineMsg += ` [Grimoire adds ${randomRareSymbol.name.split(' ')[0]} to deck!]`;
            }
          }
      }

      if (validSymbolsOnLine.filter(sym => sym.name === "小魚 (Small Fish)").length === 3) { finalLineWin+=10; lineMsg+=`[3xFish+10]`;}
      if (validSymbolsOnLine.filter(sym => sym.name === "木の実 (Nut)").length === 3) { finalLineWin+=5; lineMsg+=`[3xNut+5]`;}
      if (validSymbolsOnLine.filter(sym => sym.name === "木の盾 (Wooden Shield)").length === 3) { costModifierForNextSpin=0.9; lineMsg+=`[Shield:CostRedux!]`;}
      if (validSymbolsOnLine.filter(sym => sym.name === "囁きの石 (Whispering Stone)").length === 3) {
        if (Math.random() < 0.7) {
            wildTransformCount += 1;
            lineMsg += `[Whisper: Wild Next!]`;
        }
      }

      // No. 4: Droplet of the Life Spring (Growing Seed part)
      // This requires "Growing Seed" symbol to be defined and its persistence logic.
      // Example: if a line effect creates a "Growing Seed" to persist:
      // const seedSymbolData = allGameSymbols.find(s => s.name === "育つ種 (Growing Seed)");
      // if (seedSymbolData && seedSymbolData.growthTurns /* and some condition to add seed */) {
      //   let initialDuration = seedSymbolData.growthTurns;
      //   if (currentAcquiredRelics.some(r => r.no === 4)) {
      //     initialDuration = Math.max(1, initialDuration - 2);
      //   }
      //   newPersistingFromLines.push({
      //     index: /* target board index */,
      //     symbol: { ...seedSymbolData, instanceId: uuidv4() },
      //     duration: initialDuration,
      //     isGrowthSymbol: true,
      //   });
      //   lineMsg += ` [Seed planted (grows in ${initialDuration})!]`;
      // }


      validSymbolsOnLine.forEach((s, idxInLine) => {
        if (s.effectSystem === 'SS') {
          if (s.name === "ワイルド (Wild)" && wildCount > 0 && finalLineWin > 0) {
            const m = s.effectText.match(/獲得メダルが\s*([\d.]+)\s*倍/);
            if(m){ finalLineWin = Math.floor(finalLineWin * parseFloat(m[1])); lineMsg += `[Wild x${m[1]}]`; }
          }
          else if (s.name === "ギア (Gear)") {
            const boardIndexOfSymbol = lineIndices[idxInLine]; // For context
            let gearBaseMedalGain = parseBaseMedalValue(s.effectText);
            gearBaseMedalGain = applyRelicToSymbolBM(s, gearBaseMedalGain, currentAcquiredRelics, boardAfterABMutations, boardIndexOfSymbol);
            
            const metalOnBoard = countSymbolsOnBoard(boardAfterABMutations, cs => (cs.dynamicAttribute || cs.attribute) === "Metal");
            let gearSpecialBonus = metalOnBoard * 4;
            let currentGearContribution = gearBaseMedalGain + gearSpecialBonus;

            // No. 3: Automation Gear (for Gear)
            if (currentAcquiredRelics.some(r => r.no === 3)) {
              currentGearContribution *= 2;
              lineMsg += ` [AutoGear x2!]`;
            }
            finalLineWin += currentGearContribution - parseBaseMedalValue(s.effectText); // Subtract original BM to avoid double counting, add full new contribution
            // The lineMsg for gear's own BM was already added. Add bonus part.
            if(gearSpecialBonus > 0) lineMsg += ` [GearBoard+${gearSpecialBonus}]`;
          }
          else if (s.name === "ボム (Bomb)") {
            const boardIndexOfBomb = lineIndices[idxInLine];
            if(!bombsToExplodeThisSpin.find(b => b.index === boardIndexOfBomb)){
                const bombInstance = boardAfterABMutations[boardIndexOfBomb];
                if (bombInstance) {
                    bombsToExplodeThisSpin.push({ index: boardIndexOfBomb, symbol: bombInstance });
                }
            }
          }
          else if (s.name === "狩人の狼 (Hunter Wolf)") {
            let huntedValue = 0, huntedBoardIndex = -1, lowestMedalValue = Infinity;
            boardAfterABMutations.forEach((bs, bIdx) => {
              if(bs && ((bs.dynamicAttribute || bs.attribute) === "Animal" || (bs.dynamicAttribute || bs.attribute) === "Plant") &&
                 bs.name !== "狩人の狼 (Hunter Wolf)" && !symbolsToBeRemoved.includes(bIdx) &&
                 !validSymbolsOnLine.find(vsol => vsol.instanceId === bs.instanceId)
              ){
                const value = parseBaseMedalValue(bs.effectText);
                if(value < lowestMedalValue){ lowestMedalValue = value; huntedBoardIndex = bIdx; }
                else if(value === lowestMedalValue && Math.random() < 0.5) { huntedBoardIndex = bIdx; }
              }
            });
            if(huntedBoardIndex !== -1 && boardAfterABMutations[huntedBoardIndex]){
              const huntedSymbol = boardAfterABMutations[huntedBoardIndex]!;
              let huntMultiplier = 3;
              if (currentAcquiredRelics.some(r => r.no === 8)) { // No. 8: Hunter's Instinct
                huntMultiplier = 4;
              }
              const valueFromHuntedSymbol = parseBaseMedalValue(huntedSymbol.effectText);
              huntedValue = valueFromHuntedSymbol * huntMultiplier;
              finalLineWin += huntedValue;
              symbolsToBeRemoved.push(huntedBoardIndex);
              lineMsg += `[WolfHunts(${huntedSymbol.name.split(' ')[0]} x${huntMultiplier}):+${huntedValue}]`;
            }
          }
          else if (s.name === "サンベリー (Sunberry)") { /* Effect handled by isAnySunberryOnFormedLineThisSpin */ }
          else if (s.name === "不死鳥フェニックス (Phoenix)") {
             if (!respinRequest) {
                respinRequest = { type: 'phoenix_all_columns', triggeredBySymbolInstanceId: s.instanceId };
                lineMsg += `[Phoenix Respins All!]`;
            }
          }
        }
      });

      // No. 11: Gauntlet of Flurry
      if (effectiveAttribute === "Weapon" && currentAcquiredRelics.some(r => r.no === 11)) {
        let actualWeaponSymbolsInLine = 0;
        validSymbolsOnLine.forEach(sym => {
          if (sym.attribute === "Weapon" || (sym.dynamicAttribute === "Weapon" && sym.name === "カメレオンの鱗 (Chameleon Scale)")) { 
            actualWeaponSymbolsInLine++;
          }
        });
        if (actualWeaponSymbolsInLine > 0) {
          const flurryBonus = actualWeaponSymbolsInLine * 1;
          finalLineWin += flurryBonus;
          lineMsg += ` [Flurry+${flurryBonus}]`;
        }
      }

      let soilBoostAppliedToThisLineOverall = false;
      validSymbolsOnLine.forEach((symbolOnLine, idxOnLine) => {
          const boardIndexOfSymbolOnLine = lineIndices[idxOnLine];
          if ((symbolOnLine.dynamicAttribute || symbolOnLine.attribute) === "Plant") {
              const adjacentToThisPlant = getAdjacentSymbolInfo(boardAfterABMutations, boardIndexOfSymbolOnLine);
              if (adjacentToThisPlant.some(adj => adj.symbol?.name === "栄養豊富な土壌 (Rich Soil)")) {
                  if (!soilBoostAppliedToThisLineOverall) {
                      finalLineWin += 3;
                      lineMsg += `[SoilBoost+3]`;
                      soilBoostAppliedToThisLineOverall = true;
                  }
              }
          }
      });

      if (finalLineWin > 0 || (finalLineWin === 0 && currentLineBaseMedal !== 0)) {
        totalMedalsFromLines += finalLineWin;
        formedLineDetails.push(`${lineMsg.trim()}->${finalLineWin >= 0 ? '+' : ''}${finalLineWin}`);
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
    symbolsToAddToDeck: symbolsToAddToDeckThisSpin.length > 0 ? symbolsToAddToDeckThisSpin : undefined,
    symbolsToRemoveFromDeckByName: symbolsToRemoveFromDeckThisSpin.length > 0 ? symbolsToRemoveFromDeckThisSpin : undefined,
    additionalMedalsFromRG: rgMedalBonus > 0 ? rgMedalBonus : undefined,
    incrementRustedLumpCounter: rustedLumpCountersToIncrement.length > 0 ? rustedLumpCountersToIncrement : undefined,
    requestRespin: respinRequest,
    transformToWildOnNextSpinCount: wildTransformCount > 0 ? wildTransformCount : undefined,
    previewSymbolsForNextSpin: symbolPreview,
    newPersistingSymbolsFromLineEffect: newPersistingFromLines.length > 0 ? newPersistingFromLines : undefined,
  };
};

export interface BombExplosionResult {
  gainedMedals: number;
  newBoard: DynamicBoardSymbol[];
  message: string;
}

export const handleBombExplosionsLogic = (
  bombsToExplode: { index: number; symbol: InstanceSymbolData }[],
  currentBoard: DynamicBoardSymbol[]
): BombExplosionResult => {
  if (bombsToExplode.length === 0) {
    return { gainedMedals: 0, newBoard: [...currentBoard], message: "" };
  }
  let totalExplosionMedals = 0;
  const boardAfterExplosions: DynamicBoardSymbol[] = [...currentBoard];
  const explosionEventMessages: string[] = [];

  bombsToExplode.forEach(bombInfo => {
    if (!boardAfterExplosions[bombInfo.index] || boardAfterExplosions[bombInfo.index]?.no !== bombInfo.symbol.no) {
        return;
    }
    const { r: bombR, c: bombC } = getBoardPosition(bombInfo.index);
    explosionEventMessages.push(`${bombInfo.symbol.name.split(' ')[0]}@(${bombR},${bombC}) explodes!`);
    let symbolsDestroyedByThisBomb = 0;

    getAdjacentSymbolInfo(boardAfterExplosions, bombInfo.index).forEach(adj => {
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