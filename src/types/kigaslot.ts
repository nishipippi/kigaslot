// src/types/kigaslot.ts

export type SymbolAttribute = "Metal" | "Plant" | "Animal" | "Weapon" | "Mystic";
export type SymbolRarity = "Common" | "Uncommon" | "Rare";
export type SymbolEffectSystem = "BM" | "LB" | "AB" | "SS" | "RG";

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

// ゲームの状態に関する型も将来的にここに追加できます
// export interface PlayerState {
//   medals: number;
//   spinCount: number;
//   deck: SymbolData[];
//   relics: RelicData[];
//   // ...
// }