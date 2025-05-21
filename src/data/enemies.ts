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
  {
    no: 2,
    name: "ライン・ジャマー (Line Jammer)",
    hpMultiplier: 1.0,
    debuffEffectText: "【ライン妨害】 次の1スピンで、最もメダル獲得効率の良いライン（事前に計算可能なら）が無効化されるか、獲得メダルが半減する。",
    flavorText: "特定のラインを狙って妨害電波を出す厄介な機械。狙い澄ました一撃を邪魔する。",
  },
  {
    no: 3,
    name: "コスト・インフレーター (Cost Inflater)",
    hpMultiplier: 0.9,
    debuffEffectText: "【コスト増大】 次の3スピンの間、スピンコストが現在のコストの 10% 追加で増加する。",
    flavorText: "メダルの価値を一時的に下げる悪魔。じわじわとプレイヤーの首を絞める。",
  },
  {
    no: 4,
    name: "シンボル・イーター (Symbol Eater)",
    hpMultiplier: 1.2,
    debuffEffectText: "【シンボル捕食】 スピン終了時、盤面にある最もレアリティの高いシンボル1つをランダムに破壊（消滅させ、効果も発動しない）。",
    flavorText: "シンボルの魔力を喰らう怪物。大事に育てたシンボルほど狙われやすい。",
  },
  {
    no: 5,
    name: "ミラー・メイジ (Mirror Mage)",
    hpMultiplier: 1.1,
    debuffEffectText: "【効果反転】 次の1スピンで、1つのランダムな金属属性または植物属性シンボルの効果が反転する（例：メダル+5が-5になる、など）。",
    flavorText: "あらゆるものを鏡写しにする魔術師。プラスの効果がマイナスに変わることも。",
  },
  {
    no: 6,
    name: "スティール・スライム (Steal Slime)",
    hpMultiplier: 0.7,
    debuffEffectText: "【メダル吸収】 スピンで獲得したメダル量の 15% を吸収し、自身のHPを回復する。（HPが最大の場合は吸収しない）",
    flavorText: "触れたものからエネルギーを吸い取るスライム。倒すのが遅れると厄介。",
  },
  {
    no: 7,
    name: "ロック・ゴーレム (Lock Golem)",
    hpMultiplier: 1.3,
    debuffEffectText: "【リールロック】 スピン開始時、ランダムな1つのリール（縦1列）が1スピンの間固定され、回転しなくなる。",
    flavorText: "硬い岩でできた巨人。スロットのリールを物理的に止めてしまう。",
  },
  {
    no: 8,
    name: "カオス・スプライト (Chaos Sprite)",
    hpMultiplier: 1.0,
    debuffEffectText: "【属性シャッフル】 スピン開始時、盤面にある全てのシンボルの属性が、1スピンの間だけランダムな別の属性に一時的に変更される。",
    flavorText: "いたずら好きな精霊。シンボルの属性をめちゃくちゃにし、戦略を狂わせる。",
  },
  {
    no: 9,
    name: "サイレンス・オーラ (Silence Aura)",
    hpMultiplier: 1.1,
    debuffEffectText: "【効果封印】 次の1スピンで、全てのSS (シナジー/特殊効果) 系統のシンボルが効果を発揮しなくなる。",
    flavorText: "特殊な力を封じるオーラを放つ存在。コンボの起点を潰される。",
  },
  {
    no: 10,
    name: "ダルネス・クラウド (Dullness Cloud)",
    hpMultiplier: 0.9,
    debuffEffectText: "【レアリティ低下】 次の1スピンで盤面に出現するシンボルが、一時的に1段階低いレアリティとして扱われる（例：レア→アンコモン、アンコモン→コモン）。コモンは変化なし。",
    flavorText: "やる気を削ぐ霧。輝かしいシンボルも、その中では色褪せて見える。",
  },
  {
    no: 11,
    name: "タイム・ワープ・イリュージョニスト (Time Warp Illusionist)",
    hpMultiplier: 1.0,
    debuffEffectText: "【スピン回数強奪】 この敵を倒すのに3スピン以上かかった場合、スコア（総スピン回数）から1引かれる。",
    flavorText: "時間を操る幻術師。手間取ると、貴重なスピン回数を奪われてしまう。",
  },
  {
    no: 12,
    name: "デッキ・シフター (Deck Shuffler)",
    hpMultiplier: 0.8,
    debuffEffectText: "【強制ドロー】 次のシンボル獲得フェイズで提示される3つのシンボルが、全てコモンレアリティの「ブロンズ・コイン」「ハーブ」「森のリス」の中からランダムに選ばれる。",
    flavorText: "デッキの構成を意図せず変更させる気まぐれな存在。戦略的なシンボル獲得を妨害する。",
  },
];