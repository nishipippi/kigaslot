// src/app/game/symbollogic.ts
import type { SymbolData, RelicData, SymbolRarity } from '@/types/kigaslot';

// Utility Type for board symbols
export type BoardSymbol = SymbolData | null;

// Extended symbol type for dynamic in-spin state
export interface DynamicSymbol extends SymbolData {
  dynamicAttribute?: SymbolData['attribute']; 
  dynamicBonusBM?: number; 
  isChameleonTriggeredForLine?: boolean; 
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
): AdjacentBonusResult => {
  let totalMedalsFromAB = 0;
  const abMessages: string[] = [];
  const mutations: { index: number; changes: Partial<DynamicSymbol> }[] = [];
  let spinFlatBonus = 0;
  let spinMultiplierTotalRate = 0; // Sum of % rates from vines
  let rareModifier = 0;
  const persistSymbols: { index: number; symbol: SymbolData; duration: number }[] = [];

  const workingBoard: DynamicBoardSymbol[] = initialBoard.map(s => s ? { ...s } : null);

  // Phase 1: Symbol property changes (Chameleon, Whetstone)
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
        mutations.push({ index, changes: { dynamicAttribute: dominantAttribute } });
        if (!abMessages.includes(`${symbol.name.split(' ')[0]} mimics ${dominantAttribute}!`)) {
           abMessages.push(`${symbol.name.split(' ')[0]} mimics ${dominantAttribute}!`);
        }
      }
    } else if (symbol.name === "砥石 (Whetstone)") {
      adjacentSymbolsInfo.forEach(adj => {
        if (adj.symbol && adj.symbol.attribute === "Weapon" && workingBoard[adj.index]) {
          const currentBonus = workingBoard[adj.index]!.dynamicBonusBM || 0;
          mutations.push({ index: adj.index, changes: { dynamicBonusBM: currentBonus + 2 } });
          if (!abMessages.some(m => m.startsWith(`${adj.symbol!.name.split(' ')[0]} sharpened`))) {
             abMessages.push(`${adj.symbol!.name.split(' ')[0]} sharpened (+2 BM)`);
          }
        }
      });
    }
  });

  // Apply mutations before Phase 2 if they affect Phase 2 logic significantly
  // For now, assume Phase 2 reads from the `workingBoard` which hasn't had these specific mutations applied to its direct references yet.
  // If needed, create a new board copy here: const boardAfterPhase1Mutations = workingBoard.map((s, i) => ... apply mutations[i]);
  // For simplicity, Phase 2 reads from original workingBoard for adjacencies, but mutations list is available.

  // Phase 2: Immediate medal gains & other AB effects
  const visitedChainsGlobal = new Set<number>(); 

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
            persistSymbols.push({ index, symbol, duration: 1 }); 
            abMessages.push(`${symbol.name.split(' ')[0]} will stay!`);
        }
      }
    } else if (symbol.name === "武器庫の鍵 (Armory Key)") {
      if (adjacentSymbolsInfo.some(adj => adj.symbol && (adj.symbol.dynamicAttribute || adj.symbol.attribute) === "Weapon")) {
        const gain = parseBaseMedalValue(symbol.effectText); 
        if (gain > 0) { totalMedalsFromAB += gain; abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}(WeaponAdj)`);}
      }
    } else if (symbol.name === "共鳴クリスタル (Resonance Crystal)") {
      let gain = 0; adjacentSymbolsInfo.forEach(adj => { if (adj.symbol?.name === symbol.name) { switch(adj.symbol.rarity) { case "Common": gain+=2; break; case "Uncommon": gain+=4; break; case "Rare": gain+=7; break;}}});
      if (gain > 0) { totalMedalsFromAB += gain; abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}(Resonance)`);}
    } else if (symbol.name === "魔法陣の欠片 (Magic Circle Fragment)") {
        const gain = parseBaseMedalValue(symbol.effectText); if (gain > 0) { totalMedalsFromAB += gain; abMessages.push(`${symbol.name.split(' ')[0]}:+${gain}`);}
        const mysticNeighbors = adjacentSymbolsInfo.filter(adj => adj.symbol && (adj.symbol.dynamicAttribute || adj.symbol.attribute) === "Mystic").length;
        if (mysticNeighbors > 0) { rareModifier += mysticNeighbors * 1; abMessages.push(`${symbol.name.split(' ')[0]} boosts Rare% by ${mysticNeighbors}%`);}
    }
  });

  // Phase 3: Total spin medal modifiers (Chain Link refined, Entangling Vine refined)
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
            abMessages.push(`Chain Link group: +${groupChainBonus} to total.`);
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
      finalSpinMultiplier = 1 + Math.min(10, spinMultiplierTotalRate) / 100; // Cap total rate at 10%
  }


  return {
    gainedMedals: totalMedalsFromAB,
    message: abMessages.join(' | '),
    boardMutations: mutations.length > 0 ? mutations : undefined,
    totalSpinMedalFlatBonus: spinFlatBonus > 0 ? spinFlatBonus : undefined,
    totalSpinMedalMultiplier: finalSpinMultiplier > 1 ? finalSpinMultiplier : undefined,
    rareSymbolAppearanceModifier: rareModifier > 0 ? Math.min(5, rareModifier) : undefined, 
    symbolsToPersist: persistSymbols.length > 0 ? persistSymbols : undefined,
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
  symbolsToAddToDeck?: SymbolData[];
  symbolsToRemoveFromDeckByName?: string[];
  additionalMedalsFromRG?: number; 
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
  const symbolsToAddToDeckThisSpin: SymbolData[] = [];
  const symbolsToRemoveFromDeckThisSpin: string[] = [];
  let rgMedalBonus = 0;

  const isAnySunberryOnFormedLineThisSpin = PAYLINES.some(lineIdxs => {
      const lineSyms = lineIdxs.map(i => boardAfterABMutations[i]);
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
    // Effective attribute calculation using dynamicAttribute if present
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

        if (s.name === "ワイルド (Wild)") { lineMsg += ` Wild `; }
        else if (s.name === "カメレオンの鱗 (Chameleon Scale)" && s.dynamicAttribute && effectiveAttribute === s.dynamicAttribute) {
            s.isChameleonTriggeredForLine = true; 
            isChameleonInThisLineAndActive = true; 
            lineMsg += ` ${s.name.split(' ')[0]}(${s.dynamicAttribute}) `;
        }
        else if (s.effectSystem === 'BM' || 
                   ['ボム (Bomb)', 'ギア (Gear)', '幸運の招き猫 (Lucky Cat)', '狩人の狼 (Hunter Wolf)', 'サンベリー (Sunberry)'].includes(s.name) ||
                   s.name === "血塗られたダガー (Bloodied Dagger)" || s.name === "呪いの仮面 (Cursed Mask)") {
          singleSymbolGain = baseBM; 
          if (s.name === "森のリス (Forest Squirrel)") { singleSymbolGain = countSymbolsOnBoard(boardAfterABMutations, cs => (cs.dynamicAttribute || cs.attribute) === "Plant") > 0 ? 4 : 3; }
          else if (s.name === "星のかけら (Stardust)") { singleSymbolGain = countSymbolsOnBoard(boardAfterABMutations, cs => (cs.dynamicAttribute || cs.attribute) === "Mystic") > 0 ? 5 : 3; }
          if ((s.dynamicAttribute || s.attribute) === "Plant" && s.name !== "サンベリー (Sunberry)" && isAnySunberryOnFormedLineThisSpin) { singleSymbolGain +=3; }
          singleSymbolGain = applyRelicToSymbolBM(s, singleSymbolGain, currentAcquiredRelics);
          if (s.name === "呪いの仮面 (Cursed Mask)") { const m = s.effectText.match(/メダル\s*-(\d+)/); if(m) singleSymbolGain = -parseInt(m[1],10); }
          currentLineBaseMedal += singleSymbolGain;
          if (singleSymbolGain !== 0) { lineMsg += ` ${s.name.split(' ')[0]}(${singleSymbolGain >= 0 ? '+' : ''}${singleSymbolGain}) `; }
        }
      });
      
      let finalLineWin = currentLineBaseMedal;
      if (isChameleonInThisLineAndActive) { finalLineWin += 1; lineMsg += `[Chameleon+1]`; }

      validSymbolsOnLine.forEach((s, symbolIdxOnLine) => {
        const boardIndexOfSymbol = lineIndices[symbolIdxOnLine];
        if (s.effectSystem === 'LB') {
          if (s.name === "バックラー (Buckler)") {
             const hasNegativeEffects = activeDebuffsFromEnemy.length > 0 || boardAfterABMutations.some(bs => bs?.name === "呪いの仮面 (Cursed Mask)") || boardAfterABMutations.some(bs => bs?.name === "錆びる鉄塊 (Rusted Lump)");
             if (hasNegativeEffects) { bucklerPreventsDebuff = true; lineMsg += `[Buckler Protects!]`; }
             finalLineWin += parseBaseMedalValue(s.effectText); 
          }
          else if (s.name === "ベル (Bell)" && validSymbolsOnLine.filter(ls => ls.name === "ベル (Bell)").length === 3 && currentLineBaseMedal > 0) { finalLineWin = Math.floor(finalLineWin * 1.5) + 1; lineMsg += `[Bell x1.5+1]`;}
          else if (s.name === "チェリー (Cherry)") { const c=validSymbolsOnLine.filter(ls=>ls.name==="チェリー (Cherry)").length; const b=c===1?3:c===2?8:c>=3?20:0; if(b>0){finalLineWin+=b;lineMsg+=`[Cherry+${b}]`;}}
          else if (s.name === "BAR (BAR)") { if(validSymbolsOnLine.every(ls=>ls.name==="BAR (BAR)")) {finalLineWin=50; lineMsg+=`[PureBAR->50]`;}}
          else if (s.name === "四つ葉のクローバー (Four-Leaf Clover)" && validSymbolsOnLine.filter(ls => ls.name === s.name).length === 3) { if(Math.random()<0.15){itemsAwardedThisSpin.push({type:"RelicFragment",name:"レリックの欠片"});lineMsg+=`[Clover:Relic!]`;}}
          else if (s.name === "大漁旗 (Big Catch Flag)" && validSymbolsOnLine.filter(ls => ls.name === s.name).length === 3) { const b=currentDeck.filter(ds=>ds.attribute==="Animal").length*3; if(b>0){finalLineWin+=b;lineMsg+=`[FlagBonus+${b}]`;}}
          else if (s.name === "幸運の招き猫 (Lucky Cat)") { const r=Math.random(); if(r<0.15){finalLineWin+=25;lineMsg+=`[LuckyCat:+25!]`;}else if(r<0.30){const cS=getRandomCoinSymbol(allGameSymbols); if(cS){newSymbolsGenerated.push({index:boardIndexOfSymbol,symbolData:cS});lineMsg+=`[LuckyCat:CoinGen!]`;}}}
          else if (s.name === "宝箱 (Treasure Chest)") { if(Math.random()<0.3){if(Math.random()<0.5){itemsAwardedThisSpin.push({type:"RelicFragment",name:"レリックの欠片"});lineMsg+=`[Chest:Relic!]`;}else{const m=Math.floor(Math.random()*21)+10;finalLineWin+=m;lineMsg+=`[Chest:+${m}!]`;}}}
        }
      });
      
      if (validSymbolsOnLine.some(s => s.name === "血塗られたダガー (Bloodied Dagger)") && finalLineWin > 0) {
          const curseMaskSymbol = allGameSymbols.find(gs => gs.name === "呪いの仮面 (Cursed Mask)");
          if (curseMaskSymbol) { symbolsToAddToDeckThisSpin.push(curseMaskSymbol); lineMsg += `[Dagger adds Curse!]`; }
      }
      if (validSymbolsOnLine.length === 3 && validSymbolsOnLine.every(s => s.name === "呪いの仮面 (Cursed Mask)")) {
          symbolsToRemoveFromDeckThisSpin.push("呪いの仮面 (Cursed Mask)"); 
          rgMedalBonus += 30; lineMsg += `[3xCurseMasks Vanished!+30]`;
      }

      if (validSymbolsOnLine.filter(sym => sym.name === "小魚 (Small Fish)").length === 3) { finalLineWin+=10; lineMsg+=`[3xFish+10]`;}
      if (validSymbolsOnLine.filter(sym => sym.name === "木の実 (Nut)").length === 3) { finalLineWin+=5; lineMsg+=`[3xNut+5]`;}
      if (validSymbolsOnLine.filter(sym => sym.name === "木の盾 (Wooden Shield)").length === 3) { costModifierForNextSpin=0.9; lineMsg+=`[Shield:CostRedux!]`;}

      validSymbolsOnLine.forEach((s, idxInLine) => {
        if (s.effectSystem === 'SS') {
          if (s.name === "ワイルド (Wild)" && wildCount > 0 && finalLineWin > 0) { const m=s.effectText.match(/獲得メダルが\s*([\d.]+)\s*倍/); if(m){finalLineWin=Math.floor(finalLineWin*parseFloat(m[1]));lineMsg+=`[Wild x${m[1]}]`;}}
          else if (s.name === "ギア (Gear)") { const b=countSymbolsOnBoard(boardAfterABMutations,cs=>(cs.dynamicAttribute||cs.attribute)==="Metal")*2; if(b>0){finalLineWin+=b;lineMsg+=` [GearBoard+${b}]`;}}
          else if (s.name === "ボム (Bomb)") { if(!bombsToExplodeThisSpin.find(b=>b.index===lineIndices[idxInLine])){bombsToExplodeThisSpin.push({index:lineIndices[idxInLine],symbol:s});}}
          // Sunberry's own BM is handled. Buff to others is handled in their BM calc.
          else if (s.name === "狩人の狼 (Hunter Wolf)") {
            let huntedVal=0, huntedIdx=-1, lowVal=Infinity;
            boardAfterABMutations.forEach((bs,bIdx)=>{if(bs&&((bs.dynamicAttribute||bs.attribute)==="Animal"||(bs.dynamicAttribute||bs.attribute)==="Plant")&&bs.name!=="狩人の狼 (Hunter Wolf)"&&!symbolsToBeRemoved.includes(bIdx)){const v=parseBaseMedalValue(bs.effectText);if(v<lowVal){lowVal=v;huntedIdx=bIdx;}else if(v===lowVal&&Math.random()<0.5)huntedIdx=bIdx;}});
            if(huntedIdx!==-1&&boardAfterABMutations[huntedIdx]){const hS=boardAfterABMutations[huntedIdx]!;huntedVal=parseBaseMedalValue(hS.effectText)*3;finalLineWin+=huntedVal;symbolsToBeRemoved.push(huntedIdx);lineMsg+=`[WolfHunts(${hS.name.split(' ')[0]}):+${huntedVal}]`;}
          }
        }
      });
      
      let soilBoostAppliedToThisLine = false;
      lineIndices.forEach(symbolPosOnBoard => {
          getAdjacentSymbolInfo(boardAfterABMutations, symbolPosOnBoard).forEach(adjSoilInfo => {
              if (adjSoilInfo.symbol?.name === "栄養豊富な土壌 (Rich Soil)") {
                  const mainSymbol = boardAfterABMutations[symbolPosOnBoard];
                  if (mainSymbol && (mainSymbol.dynamicAttribute || mainSymbol.attribute) === "Plant" && validSymbolsOnLine.find(vSym => vSym.no === mainSymbol.no && getIndexFromBoardPosition(getBoardPosition(symbolPosOnBoard)) === symbolPosOnBoard )) {
                      if (!soilBoostAppliedToThisLine) { finalLineWin += 3; if (!lineMsg.includes("[SoilBoost]")) lineMsg += `[SoilBoost+3]`; soilBoostAppliedToThisLine = true; }
                  }
              }
          });
      });

      if (finalLineWin > 0) { totalMedalsFromLines += finalLineWin; formedLineDetails.push(`${lineMsg.trim()}->+${finalLineWin}`); formedLineIndicesArray.push([...lineIndices]); }
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