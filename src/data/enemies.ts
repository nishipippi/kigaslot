// src/data/enemies.ts
import type { EnemyData } from "@/types/kigaslot";

export const enemies: EnemyData[] = [
  {
    no: 1,
    name: "スロット・ゴブリン (Slot Goblin)",
    hpMultiplier: 0.8,
    debuffEffectText: "【シンボル強奪】 スピン開始時、ランダムなシンボル1つが「呪いの仮面」(神秘RG)に変化する。（1ターンのみ）",
    flavorText: "スロットの裏に潜む小狡い小鬼。価値あるものをガラクタに変えてしまう。",
  },
  // ... 他の敵データ ...
];