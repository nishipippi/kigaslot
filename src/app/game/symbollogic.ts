// src/app/game/symbollogic.ts
import type {
  SymbolData,
  RelicData,
  InstanceSymbolData,
  DynamicSymbol as CoreDynamicSymbol, // types/kigaslot.ts からインポート
  Debuff,
  ItemAward,
  PersistingSymbolInfo, // 追加
} from '@/types/kigaslot';

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
  board: DynamicBoardSymbol[], // DynamicBoardSymbol を使用
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
  board: DynamicBoardSymbol[], // DynamicBoardSymbol を使用
  predicate: (symbol: DynamicSymbol) => boolean // DynamicSymbol を使用
): number => {
  return board.reduce((count, currentSymbol) => {
    if (currentSymbol && predicate(currentSymbol)) {
      return count + 1;
    }
    return count;
  }, 0);
};

export const getSymbolsFromBoard = (
    board: DynamicBoardSymbol[], // DynamicBoardSymbol を使用
    predicate?: (symbol: DynamicSymbol) => boolean // DynamicSymbol を使用
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

  // For negative medal values (e.g., Cursed Mask, Rusted Lump)
  const negativeMedalMatch = effectText.match(/メダル\s*-(\d+)/);
  if (negativeMedalMatch && negativeMedalMatch[1]) return -parseInt(negativeMedalMatch[1], 10);


  return 0;
};

export const applyRelicToSymbolBM = (
  symbol: DynamicSymbol, // DynamicSymbol を使用
  baseGain: number,
  currentAcquiredRelics: RelicData[]
): number => {
  let modifiedGain = baseGain;
  currentAcquiredRelics.forEach(relic => {
    const attributeToCheck = symbol.dynamicAttribute || symbol.attribute;
    if (relic.name === "鍛冶神の金床 (Anvil of the Forge God)" && attributeToCheck === "Metal") modifiedGain += 2;
    else if (relic.name === "百獣の王の紋章 (Crest of the Beast King)" && attributeToCheck === "Animal") modifiedGain += 2;
    else if (relic.name === "伝説の剣聖の鞘 (Sheath of the Legendary Swordmaster)" && attributeToCheck === "Weapon") modifiedGain += 2;
    else if (relic.name === "星詠みの水晶球 (Crystal Ball of Stargazing)" && attributeToCheck === "Mystic") modifiedGain += 2;
    else if (relic.name === "生命の泉の雫 (Droplet of the Life Spring)" && attributeToCheck === "Plant") modifiedGain += 2;
  });
  return modifiedGain;
};

// --- Adjacent Bonus (AB) Logic ---
export interface AdjacentBonusResult {
  gainedMedals: number;
  message: string;
  boardMutations?: { index: number; changes: Partial<DynamicSymbol> }[]; // Partial<DynamicSymbol>
  totalSpinMedalFlatBonus?: number;
  totalSpinMedalMultiplier?: number;
  rareSymbolAppearanceModifier?: number;
  // symbolsToPersist の型を PersistingSymbolInfo の一部に合わせる (ただし duration は AB 効果で決定)
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
  initialBoard: BoardSymbol[], // BoardSymbol (InstanceSymbolData | null) を使用
): AdjacentBonusResult => {
  let totalMedalsFromAB = 0;
  const abMessages: string[] = [];
  const mutations: { index: number; changes: Partial<DynamicSymbol> }[] = [];
  let spinFlatBonus = 0;
  let spinMultiplierTotalRate = 0;
  let rareModifier = 0;
  const persistSymbolsOutput: AdjacentBonusResult['symbolsToPersist'] = [];

  // initialBoard is BoardSymbol[], map to DynamicBoardSymbol[] for internal processing
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
        // Ensure the symbol at workingBoard[index] is not null before trying to access its properties
        const currentSymbolAtIndex = workingBoard[index];
        if (currentSymbolAtIndex) {
            mutations.push({ index, changes: { dynamicAttribute: dominantAttribute } });
            // Apply mutation immediately to workingBoard for subsequent AB checks in this function
            workingBoard[index] = { ...currentSymbolAtIndex, dynamicAttribute: dominantAttribute };
            if (!abMessages.includes(`${symbol.name.split(' ')[0]} mimics ${dominantAttribute}!`)) {
               abMessages.push(`${symbol.name.split(' ')[0]} mimics ${dominantAttribute}!`);
            }
        }
      }
    } else if (symbol.name === "砥石 (Whetstone)") {
      adjacentSymbolsInfo.forEach(adj => {
        if (adj.symbol && adj.symbol.attribute === "Weapon" && workingBoard[adj.index]) {
          const targetSymbol = workingBoard[adj.index]!; // Already checked it exists
          const currentBonus = targetSymbol.dynamicBonusBM || 0;
          const newBonus = currentBonus + 2;
          mutations.push({ index: adj.index, changes: { dynamicBonusBM: newBonus } });
          // Apply mutation immediately
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
        if (plantNeighbors.length >= 2) { // Persist condition
            const baseSymbolData = allGameSymbols.find(s => s.no === symbol.no); // Find base SymbolData
            if(baseSymbolData){
                persistSymbolsOutput.push({ index, symbol: baseSymbolData, duration: 1 }); // Persist for 1 more spin
                abMessages.push(`${symbol.name.split(' ')[0]} will stay!`);
            }
        }
      }
    } else if (symbol.name === "武器庫の鍵 (Armory Key)") {
      if (adjacentSymbolsInfo.some(adj => adj.symbol && (adj.symbol.dynamicAttribute || adj.symbol.attribute) === "Weapon")) {
        const gain = parseBaseMedalValue(symbol.effectText); // Effect text gives +5 if condition met
        if (gain > 0) { totalMedalsFromAB += gain; abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}(WeaponAdj)`);}
      }
    } else if (symbol.name === "共鳴クリスタル (Resonance Crystal)") {
      let gain = 0;
      adjacentSymbolsInfo.forEach(adj => {
        if (adj.symbol?.name === symbol.name) { // Only same symbol name
          switch(adj.symbol.rarity) {
            case "Common": gain += 2; break;
            case "Uncommon": gain += 4; break;
            case "Rare": gain += 7; break;
          }
        }
      });
      if (gain > 0) { totalMedalsFromAB += gain; abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}(Resonance)`);}
    } else if (symbol.name === "魔法陣の欠片 (Magic Circle Fragment)") {
        const gain = parseBaseMedalValue(symbol.effectText); // Should be +1 from text
        if (gain > 0) { totalMedalsFromAB += gain; abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}`);}
        const mysticNeighbors = adjacentSymbolsInfo.filter(adj => adj.symbol && (adj.symbol.dynamicAttribute || adj.symbol.attribute) === "Mystic").length;
        if (mysticNeighbors > 0) {
            rareModifier += mysticNeighbors * 1; // Assuming 1% per mystic neighbor
            abMessages.push(`${symbol.name.split(' ')[0]} boosts Rare% by ${mysticNeighbors}%`);
        }
    } else if (symbol.name === "栄養豊富な土壌 (Rich Soil)") {
        // This effect is applied during line check, not directly here for medals.
        // No medals from Rich Soil itself, it boosts adjacent plant lines.
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
            const linkSymbol = workingBoard[linkIndexInGroup]; // This is DynamicSymbol
            if (linkSymbol && linkSymbol.name === "金属の鎖 (Chain Link)") {
                const distinctNeighbors = getAdjacentSymbolInfo(workingBoard, linkIndexInGroup)
                    .filter(adj => adj.symbol?.name === "金属の鎖 (Chain Link)").length;
                // Effect: "+2 per adjacent chain link, max 3 links counted" means max +6 from one link.
                // If 1 neighbor: +2. If 2 neighbors: +4. If 3+ neighbors: +6.
                groupChainBonus += Math.min(3, distinctNeighbors) * 2;
                processedChainLinksForBonusCalc.add(linkIndexInGroup);
            }
        });
        if (groupChainBonus > 0) {
            spinFlatBonus += groupChainBonus; // This is a flat bonus to the spin's total.
            abMessages.push(`Chain Link group: +${groupChainBonus} to total spin medals.`);
        }
    } else if (symbol.name === "絡みつく蔦 (Entangling Vine)") {
      const plantNeighbors = getAdjacentSymbolInfo(workingBoard, index)
        .filter(adj => adj.symbol && (adj.symbol.dynamicAttribute || adj.symbol.attribute) === "Plant");
      const percentageBonusFromThisVine = plantNeighbors.length * 2; // 2% per plant
      if (percentageBonusFromThisVine > 0) {
        spinMultiplierTotalRate += percentageBonusFromThisVine; // Accumulate percentage points
        abMessages.push(`${symbol.name.split(' ')[0]} adds ${percentageBonusFromThisVine}% to multiplier rate.`);
      }
    }
  });

  let finalSpinMultiplier = 1.0;
  if (spinMultiplierTotalRate > 0) {
      // Effect text: "上限+10%"
      finalSpinMultiplier = 1 + (Math.min(10, spinMultiplierTotalRate) / 100);
  }

  return {
    gainedMedals: totalMedalsFromAB,
    message: abMessages.join(' | '),
    boardMutations: mutations.length > 0 ? mutations : undefined,
    totalSpinMedalFlatBonus: spinFlatBonus > 0 ? spinFlatBonus : undefined,
    totalSpinMedalMultiplier: finalSpinMultiplier > 1 ? finalSpinMultiplier : undefined,
    rareSymbolAppearanceModifier: rareModifier > 0 ? Math.min(5, rareModifier) : undefined, // Cap rare modifier if necessary
    symbolsToPersist: persistSymbolsOutput.length > 0 ? persistSymbolsOutput : undefined,
  };
};

// LineCheckResult の拡張
export interface LineCheckResult {
  gainedMedals: number;
  message: string;
  formedLinesIndices: number[][];
  bombsToExplode: { index: number; symbol: InstanceSymbolData }[]; // symbolの型
  itemsAwarded?: ItemAward[];
  newSymbolsOnBoardPostEffect?: { index: number; symbolData: SymbolData }[];
  nextSpinCostModifier?: number;
  symbolsToRemoveFromBoard?: number[]; // 対象はindex
  debuffsPreventedThisSpin?: boolean;
  symbolsToAddToDeck?: SymbolData[];
  symbolsToRemoveFromDeckByName?: string[];
  additionalMedalsFromRG?: number;

  // === 新しい効果結果 ===
  incrementRustedLumpCounter?: string[]; // instanceId の配列
  requestRespin?: { type: 'phoenix_all_columns' | 'arrow_column'; columnsToRespin?: number[]; triggeredBySymbolInstanceId?: string };
  transformToWildOnNextSpinCount?: number;
  previewSymbolsForNextSpin?: SymbolData[];
  // ライン効果で盤面に残る/変化するシンボル
  newPersistingSymbolsFromLineEffect?: PersistingSymbolInfo[];
}

const PAYLINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

// Helper to get full SymbolData, as allGameSymbols is not directly available here
// This should ideally be passed in or accessed via a shared module if stateful.
// For now, we assume allGameSymbols is available in the scope where checkLinesAndApplyEffects is called.
// Let's import it if it's from a data file.
import { symbols as allGameSymbols } from '@/data/symbols';

export const getRandomCoinSymbol = (availableSymbols: SymbolData[]): SymbolData | null => {
    const coinSymbols = availableSymbols.filter(s => s.name.includes("Coin") && s.attribute === "Metal");
    if (coinSymbols.length === 0) return null;
    return coinSymbols[Math.floor(Math.random() * coinSymbols.length)];
};

export const checkLinesAndApplyEffects = (
  boardAfterABMutations: DynamicBoardSymbol[], // DynamicBoardSymbol (DynamicSymbol | null)
  currentAcquiredRelics: RelicData[],
  currentDeck: InstanceSymbolData[], // InstanceSymbolData[]
  // allGameSymbols: SymbolData[], // Pass allGameSymbols if not globally available
  activeDebuffsFromEnemy: Debuff[],
  currentPersistingSymbolsOnBoard: PersistingSymbolInfo[] // For checking Rich Soil, etc.
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

  // New results
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
          const nonWilds = lineSyms.filter(s => s !== null && s.name !== "ワイルド (Wild)") as DynamicSymbol[]; // Cast to DynamicSymbol
          if (nonWilds.length === 3 && nonWilds.every(s => (s.dynamicAttribute || s.attribute) === (nonWilds[0].dynamicAttribute || nonWilds[0].attribute))) lineIsFormed = true;
          else if (nonWilds.length === 2 && wilds === 1 && (nonWilds[0].dynamicAttribute || nonWilds[0].attribute) === (nonWilds[1].dynamicAttribute || nonWilds[1].attribute)) lineIsFormed = true;
          else if (nonWilds.length === 1 && wilds === 2 && nonWilds[0]) {
            lineIsFormed = true;
          }
          else if (wilds === 3) lineIsFormed = true;
      }
      return lineIsFormed && lineSyms.some(s => s?.name === "サンベリー (Sunberry)");
  });


  PAYLINES.forEach((lineIndices) => {
    const symbolsOnLine = lineIndices.map(i => boardAfterABMutations[i]);
    // DynamicSymbol is already InstanceSymbolData extended with dynamic props
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
      effectiveAttribute = "Mystic"; // Or any other default attribute for all wilds
    }

    if (effectiveAttribute) {
      let currentLineBaseMedal = 0;
      let lineMsg = `${effectiveAttribute} Line (W:${wildCount}): `;
      let isChameleonInThisLineAndActive = false;

      validSymbolsOnLine.forEach(s => { // s is DynamicSymbol
        let singleSymbolGain = 0;
        const baseBMFromText = parseBaseMedalValue(s.effectText);
        singleSymbolGain = baseBMFromText + (s.dynamicBonusBM || 0); // dynamicBonusBM from Whetstone

        if (s.name === "ワイルド (Wild)") { lineMsg += ` Wild `; }
        else if (s.name === "カメレオンの鱗 (Chameleon Scale)" && s.dynamicAttribute && effectiveAttribute === s.dynamicAttribute) {
            s.isChameleonTriggeredForLine = true; // Mark on the symbol if needed for other logic
            isChameleonInThisLineAndActive = true;
            lineMsg += ` ${s.name.split(' ')[0]}(${s.dynamicAttribute}) `;
            // Chameleon line effect: +1 medal is mentioned in its text. Apply this to finalLineWin.
        }
        else if (s.effectSystem === 'BM' || s.effectSystem === 'RG' || // RG symbols can have BM components
                   ['ボム (Bomb)', 'ギア (Gear)', '幸運の招き猫 (Lucky Cat)', '狩人の狼 (Hunter Wolf)', 'サンベリー (Sunberry)'].includes(s.name) || // SS with BM part
                   s.name === "血塗られたダガー (Bloodied Dagger)" || s.name === "呪いの仮面 (Cursed Mask)") {

          if (s.name === "森のリス (Forest Squirrel)") { singleSymbolGain = countSymbolsOnBoard(boardAfterABMutations, cs => (cs.dynamicAttribute || cs.attribute) === "Plant") > 0 ? 4 : 3; }
          else if (s.name === "星のかけら (Stardust)") { singleSymbolGain = countSymbolsOnBoard(boardAfterABMutations, cs => (cs.dynamicAttribute || cs.attribute) === "Mystic") > 0 ? 5 : 3; }
          // Sunberry's SS effect (boost other plants) is applied outside this direct BM calculation, or needs pre-calculation
          if ((s.dynamicAttribute || s.attribute) === "Plant" && s.name !== "サンベリー (Sunberry)" && isAnySunberryOnFormedLineThisSpin) {
            singleSymbolGain +=3; // Sunberry on line boosts other plants
          }
          singleSymbolGain = applyRelicToSymbolBM(s, singleSymbolGain, currentAcquiredRelics);

          // Rusted Lump specific handling for counter
          if (s.name === "錆びる鉄塊 (Rusted Lump)" && s.instanceId) {
            if (!rustedLumpCountersToIncrement.includes(s.instanceId)) {
                rustedLumpCountersToIncrement.push(s.instanceId);
            }
          }
          // Bloodied Dagger adds Cursed Mask to deck (handled later)

          currentLineBaseMedal += singleSymbolGain;
          if (singleSymbolGain !== 0 || baseBMFromText !== 0) { lineMsg += ` ${s.name.split(' ')[0]}(${singleSymbolGain >= 0 ? '+' : ''}${singleSymbolGain}) `; }
        }
      });

      let finalLineWin = currentLineBaseMedal;
      if (isChameleonInThisLineAndActive) { finalLineWin += 1; lineMsg += `[Chameleon+1]`; } // Chameleon's +1 medal for line

      validSymbolsOnLine.forEach((s, symbolIdxOnLine) => { // s is DynamicSymbol
        const boardIndexOfSymbol = lineIndices[symbolIdxOnLine];
        if (s.effectSystem === 'LB') {
          if (s.name === "バックラー (Buckler)") {
             const hasNegativeEffects = activeDebuffsFromEnemy.length > 0 ||
                                    boardAfterABMutations.some(bs => bs?.name === "呪いの仮面 (Cursed Mask)") ||
                                    boardAfterABMutations.some(bs => bs?.name === "錆びる鉄塊 (Rusted Lump)"); // Rusted Lump is also a negative
             if (hasNegativeEffects) { bucklerPreventsDebuff = true; lineMsg += `[Buckler Protects!]`; }
             // Buckler's own medal gain
             finalLineWin += parseBaseMedalValue(s.effectText); // Should be +2 from its text
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
            // else if (s.name === "BAR (BAR)") { finalLineWin += 5; } // BAR mixed with others already handled by BM logic parseBaseMedalValue
          }
          else if (s.name === "四つ葉のクローバー (Four-Leaf Clover)" && validSymbolsOnLine.filter(ls => ls.name === s.name).length === 3) {
            finalLineWin += 30; // Base medal from 3 clovers
            if(Math.random() < 0.15){ itemsAwardedThisSpin.push({type:"RelicFragment", name:"レリックの欠片"}); lineMsg += `[Clover:Relic!]`;}
          }
          else if (s.name === "大漁旗 (Big Catch Flag)" && validSymbolsOnLine.filter(ls => ls.name === s.name).length === 3) {
            const animalBonus = currentDeck.filter(ds=>ds.attribute==="Animal").length * 3;
            if(animalBonus > 0){ finalLineWin += animalBonus; lineMsg += `[FlagBonus+${animalBonus}]`;}
          }
          else if (s.name === "幸運の招き猫 (Lucky Cat)") {
            // Base +5 is already in currentLineBaseMedal via parseBaseMedalValue
            const r=Math.random();
            if(r < 0.15){ finalLineWin += 25; lineMsg += `[LuckyCat:+25!]`; }
            else if(r < 0.30){
              const cS = getRandomCoinSymbol(allGameSymbols);
              if(cS){ newSymbolsGenerated.push({index: boardIndexOfSymbol, symbolData: cS}); lineMsg += `[LuckyCat:CoinGen!]`; }
            }
          }
          else if (s.name === "宝箱 (Treasure Chest)") {
            // Base +5 is already in currentLineBaseMedal
            if(Math.random() < 0.3){
              if(Math.random() < 0.5){ itemsAwardedThisSpin.push({type:"RelicFragment",name:"レリックの欠片"}); lineMsg += `[Chest:Relic!]`; }
              else { const m = Math.floor(Math.random()*21)+10; finalLineWin += m; lineMsg += `[Chest:+${m}!]`; }
            }
          }
          else if (s.name === "リスピン・アロー (Respin Arrow)") {
            // Base +5 is already in currentLineBaseMedal
            if (Math.random() < 0.5 && !respinRequest) {
              const column = getBoardPosition(boardIndexOfSymbol).c;
              if (column !== -1) {
                respinRequest = { type: 'arrow_column', columnsToRespin: [column], triggeredBySymbolInstanceId: s.instanceId };
                lineMsg += `[Arrow Respin Col ${column + 1}!]`;
              }
            }
          }
          else if (s.name === "運命のタロット (Tarot of Fate)" && validSymbolsOnLine.filter(ls => ls.name === s.name).length === 3) {
            // Base +10 is already in currentLineBaseMedal
            if (!symbolPreview) {
              const preview: SymbolData[] = [];
              const deckCopy = [...currentDeck];
              for (let i = 0; i < 3 && deckCopy.length > 0; i++) {
                const randIdx = Math.floor(Math.random() * deckCopy.length);
                const { instanceId, ...baseSymbolData } = deckCopy.splice(randIdx, 1)[0];
                preview.push(baseSymbolData as SymbolData);
              }
              if (preview.length > 0) { symbolPreview = preview; lineMsg += `[Tarot Preview!]`; }
            }
          }
        }
      });

      // RG symbol effects that trigger on line formation
      if (validSymbolsOnLine.some(s => s.name === "血塗られたダガー (Bloodied Dagger)") && finalLineWin > 0) {
          const curseMaskSymbolData = allGameSymbols.find(gs => gs.name === "呪いの仮面 (Cursed Mask)");
          if (curseMaskSymbolData) { symbolsToAddToDeckThisSpin.push(curseMaskSymbolData); lineMsg += `[Dagger adds Curse!]`; }
      }
      if (validSymbolsOnLine.length === 3 && validSymbolsOnLine.every(s => s.name === "呪いの仮面 (Cursed Mask)")) {
          symbolsToRemoveFromDeckThisSpin.push("呪いの仮面 (Cursed Mask)");
          rgMedalBonus += 30; lineMsg += `[3xCurseMasks Vanished!+30]`;
      }
      // Rusted Lump counter already handled.

      // Specific 3-of-a-kind bonuses for common BM symbols
      if (validSymbolsOnLine.filter(sym => sym.name === "小魚 (Small Fish)").length === 3) { finalLineWin+=10; lineMsg+=`[3xFish+10]`;}
      if (validSymbolsOnLine.filter(sym => sym.name === "木の実 (Nut)").length === 3) { finalLineWin+=5; lineMsg+=`[3xNut+5]`;}
      if (validSymbolsOnLine.filter(sym => sym.name === "木の盾 (Wooden Shield)").length === 3) { costModifierForNextSpin=0.9; lineMsg+=`[Shield:CostRedux!]`;}
      if (validSymbolsOnLine.filter(sym => sym.name === "囁きの石 (Whispering Stone)").length === 3) {
        // Base +7 per symbol already handled by BM
        if (Math.random() < 0.7) { // Example probability
            wildTransformCount += 1;
            lineMsg += `[Whisper: Wild Next!]`;
        }
      }


      // SS (Special Spin) symbol effects
      validSymbolsOnLine.forEach((s, idxInLine) => { // s is DynamicSymbol
        if (s.effectSystem === 'SS') {
          if (s.name === "ワイルド (Wild)" && wildCount > 0 && finalLineWin > 0) {
            const m = s.effectText.match(/獲得メダルが\s*([\d.]+)\s*倍/);
            if(m){ finalLineWin = Math.floor(finalLineWin * parseFloat(m[1])); lineMsg += `[Wild x${m[1]}]`; }
          }
          else if (s.name === "ギア (Gear)") {
            // Base +5 from effectText already in currentLineBaseMedal
            const metalOnBoard = countSymbolsOnBoard(boardAfterABMutations, cs => (cs.dynamicAttribute || cs.attribute) === "Metal");
            const gearBonus = metalOnBoard * 2;
            if(gearBonus > 0){ finalLineWin += gearBonus; lineMsg += ` [GearBoard+${gearBonus}]`; }
          }
          else if (s.name === "ボム (Bomb)") {
            // Base +5 from effectText already in currentLineBaseMedal
            // Bomb explosion is handled after line checks based on bombsToExplodeThisSpin
            const boardIndexOfBomb = lineIndices[idxInLine];
            if(!bombsToExplodeThisSpin.find(b => b.index === boardIndexOfBomb)){
                // Ensure we pass InstanceSymbolData
                const bombInstance = boardAfterABMutations[boardIndexOfBomb];
                if (bombInstance) { // Should always be true if it's in validSymbolsOnLine
                    bombsToExplodeThisSpin.push({ index: boardIndexOfBomb, symbol: bombInstance });
                }
            }
          }
          else if (s.name === "狩人の狼 (Hunter Wolf)") {
            // Base +10 from effectText already in currentLineBaseMedal
            let huntedValue = 0, huntedBoardIndex = -1, lowestMedalValue = Infinity;
            boardAfterABMutations.forEach((bs, bIdx) => {
              if(bs && ((bs.dynamicAttribute || bs.attribute) === "Animal" || (bs.dynamicAttribute || bs.attribute) === "Plant") &&
                 bs.name !== "狩人の狼 (Hunter Wolf)" && !symbolsToBeRemoved.includes(bIdx) &&
                 !validSymbolsOnLine.find(vsol => vsol.instanceId === bs.instanceId) // Don't hunt self or other symbols on the same winning line
              ){
                const value = parseBaseMedalValue(bs.effectText);
                if(value < lowestMedalValue){ lowestMedalValue = value; huntedBoardIndex = bIdx; }
                else if(value === lowestMedalValue && Math.random() < 0.5) { huntedBoardIndex = bIdx; } // Tie-breaking
              }
            });
            if(huntedBoardIndex !== -1 && boardAfterABMutations[huntedBoardIndex]){
              const huntedSymbol = boardAfterABMutations[huntedBoardIndex]!;
              huntedValue = parseBaseMedalValue(huntedSymbol.effectText) * 3;
              finalLineWin += huntedValue;
              symbolsToBeRemoved.push(huntedBoardIndex);
              lineMsg += `[WolfHunts(${huntedSymbol.name.split(' ')[0]}):+${huntedValue}]`;
            }
          }
          else if (s.name === "サンベリー (Sunberry)") {
            // Base +8 is already in currentLineBaseMedal
            // Its effect "盤面にある他の植物属性シンボル全ての基礎メダル獲得量を +3 する"
            // was handled by `isAnySunberryOnFormedLineThisSpin` check earlier for other plants.
            // No additional effect here unless specified.
          }
          else if (s.name === "不死鳥フェニックス (Phoenix)") { // Transformed Phoenix
             // Base +30 is already in currentLineBaseMedal
             if (!respinRequest) {
                respinRequest = { type: 'phoenix_all_columns', triggeredBySymbolInstanceId: s.instanceId };
                lineMsg += `[Phoenix Respins All!]`;
            }
          }
        }
      });

      // Rich Soil (Adjacent Plant Boost) - applied per symbol on the line
      let soilBoostAppliedToThisLineOverall = false;
      validSymbolsOnLine.forEach((symbolOnLine, idxOnLine) => {
          const boardIndexOfSymbolOnLine = lineIndices[idxOnLine];
          if ((symbolOnLine.dynamicAttribute || symbolOnLine.attribute) === "Plant") {
              const adjacentToThisPlant = getAdjacentSymbolInfo(boardAfterABMutations, boardIndexOfSymbolOnLine);
              if (adjacentToThisPlant.some(adj => adj.symbol?.name === "栄養豊富な土壌 (Rich Soil)")) {
                  if (!soilBoostAppliedToThisLineOverall) {
                      finalLineWin += 3; // Add +3 once per line affected by any Rich Soil
                      lineMsg += `[SoilBoost+3]`;
                      soilBoostAppliedToThisLineOverall = true;
                  }
              }
          }
      });


      if (finalLineWin > 0 || (finalLineWin === 0 && currentLineBaseMedal !== 0)) { // Allow lines that break even or are negative if they have effects
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
    // New results
    incrementRustedLumpCounter: rustedLumpCountersToIncrement.length > 0 ? rustedLumpCountersToIncrement : undefined,
    requestRespin: respinRequest,
    transformToWildOnNextSpinCount: wildTransformCount > 0 ? wildTransformCount : undefined,
    previewSymbolsForNextSpin: symbolPreview,
    newPersistingSymbolsFromLineEffect: newPersistingFromLines.length > 0 ? newPersistingFromLines : undefined,
  };
};

export interface BombExplosionResult {
  gainedMedals: number;
  newBoard: DynamicBoardSymbol[]; // Return DynamicBoardSymbol[]
  message: string;
}

export const handleBombExplosionsLogic = (
  bombsToExplode: { index: number; symbol: InstanceSymbolData }[], // Symbol is InstanceSymbolData
  currentBoard: DynamicBoardSymbol[] // Takes DynamicBoardSymbol[]
): BombExplosionResult => {
  if (bombsToExplode.length === 0) {
    return { gainedMedals: 0, newBoard: [...currentBoard], message: "" };
  }
  let totalExplosionMedals = 0;
  const boardAfterExplosions: DynamicBoardSymbol[] = [...currentBoard];
  const explosionEventMessages: string[] = [];

  bombsToExplode.forEach(bombInfo => {
    // Ensure the symbol at the bomb's index is still the bomb (it might have been destroyed by another bomb)
    if (!boardAfterExplosions[bombInfo.index] || boardAfterExplosions[bombInfo.index]?.no !== bombInfo.symbol.no) {
        return;
    }
    const { r: bombR, c: bombC } = getBoardPosition(bombInfo.index);
    explosionEventMessages.push(`${bombInfo.symbol.name.split(' ')[0]}@(${bombR},${bombC}) explodes!`);
    let symbolsDestroyedByThisBomb = 0;

    getAdjacentSymbolInfo(boardAfterExplosions, bombInfo.index).forEach(adj => {
      // Do not destroy other bombs with this bomb, let them explode on their own turn/trigger if they also formed a line.
      // Or, define chain reaction rules if desired. For now, bomb doesn't destroy another bomb.
      if (adj.symbol && adj.symbol.name !== "ボム (Bomb)") {
        totalExplosionMedals += 6;
        symbolsDestroyedByThisBomb++;
        boardAfterExplosions[adj.index] = null;
      }
    });
    if (symbolsDestroyedByThisBomb > 0) {
      explosionEventMessages.push(`  Destroyed ${symbolsDestroyedByThisBomb}, +${symbolsDestroyedByThisBomb * 6}.`);
    }
    boardAfterExplosions[bombInfo.index] = null; // Bomb itself is also removed
  });

  return {
    gainedMedals: totalExplosionMedals,
    newBoard: boardAfterExplosions,
    message: explosionEventMessages.join(" "),
  };
};