// src/types/kigaslot.ts

export type SymbolAttribute = "Metal" | "Plant" | "Animal" | "Weapon" | "Mystic";
export type SymbolRarity = "Common" | "Uncommon" | "Rare";
// PE (Passive Effect on board) を追加
export type SymbolEffectSystem = "BM" | "LB" | "AB" | "SS" | "RG" | "PE";

export interface SymbolData {
  no: number;
  name: string;
  attribute: SymbolAttribute;
  rarity: SymbolRarity;
  effectSystem: SymbolEffectSystem;
  effectText: string; // 効果の具体的な説明
  flavorText: string;
  // 必要に応じて画像パスなども追加
  // iconPath?: string;

  // RG系シンボルの変化先や特殊効果を定義する場合 (New)
  transformToSymbolNo?: number; // 変化先のシンボルNo
  growthTurns?: number;         // 成長に必要なターン数 (盤面でのスピン数)
  generatesMedalOnBoard?: number; // 盤上にある場合に毎ターンスターメダル生成量 (例:花咲く大樹)
}

export interface RelicData {
  no: number;
  name: string;
  targetAttributeOrEffect?: SymbolAttribute | string; // 効果対象の属性や特定の効果など
  effectText: string;
  flavorText: string;
  // iconPath?: string;
}

export interface EnemyData {
  no: number;
  name: string;
  hpMultiplier: number; // HP係数
  debuffEffectText: string; // 妨害効果の説明
  flavorText: string;
  // imagePath?: string;
}

// --- Added/Modified for new features ---

// デッキや盤面で個々のシンボルインスタンスを追跡するための拡張 (New)
export interface InstanceSymbolData extends SymbolData {
  instanceId: string; // 各シンボルインスタンスのユニークID
}

// page.tsx や gameManager.ts で使う Deck と Board のシンボル型 (Modified)
export type DeckSymbol = InstanceSymbolData;
export type BoardSymbolBase = InstanceSymbolData | null; // symbollogic.ts で使われる基本形

// Extended symbol type for dynamic in-spin state (Modified)
export interface DynamicSymbol extends InstanceSymbolData {
  dynamicAttribute?: SymbolData['attribute'];
  dynamicBonusBM?: number;
  isChameleonTriggeredForLine?: boolean;
  // currentGrowthTurns?: number; // 育つ種や卵の現在の成長ターン。persistingSymbolInfo.durationで管理
}
export type DynamicBoardSymbol = DynamicSymbol | null;


// Type for items awarded during line checks (From previous ESLint fix)
export interface ItemAward {
  type: string;
  name: string;
  data?: unknown;
}

// Type for active debuffs from an enemy (From previous ESLint fix)
export interface Debuff {
  type: string;
  duration: number;
  value?: number;
  originEnemy?: string;
}

// PersistingSymbol の情報 (Modified)
export interface PersistingSymbolInfo {
  index: number;
  symbol: InstanceSymbolData; // 変更: InstanceSymbolData を使用
  duration: number; // 残存ターン数 or 成長完了までのターン数 or RGカウンタ
  isGrowthSymbol?: boolean; // これが成長系シンボルか (盤面での成長を管理)
  // rgCounter?: number; // RustedLumpのようなデッキ内RGシンボルのカウントは別途管理
}

// Respin State (New)
export interface RespinState {
  active: boolean;
  type: 'phoenix_all_columns' | 'arrow_column';
  columnsToRespin?: number[]; // arrow_column の場合
  triggeredBySymbolInstanceId?: string; // どのシンボルがトリガーしたかの記録（オプション）
}

// Next Spin Effects (New)
export interface NextSpinEffects {
  transformToWildCount: number;
  symbolPreview: SymbolData[] | null; // 通常のSymbolDataで良い（インスタンスではないため）
}

// Rusted Lump Progress in Deck (New)
export interface RustedLumpProgress {
  [instanceId: string]: { // デッキ内の錆びる鉄塊のinstanceIdをキー
    count: number; // ライン成立に関わった回数
    // symbolOriginalNo: number; // 元の錆びる鉄塊のNo (instanceIdで元シンボルは特定可能)
  };
}

// ゲームの状態に関する型も将来的にここに追加できます (既存コメント)
// export interface PlayerState {
//   medals: number;
//   spinCount: number;
//   deck: DeckSymbol[]; // 変更: DeckSymbol[]
//   relics: RelicData[];
//   // ...
// }