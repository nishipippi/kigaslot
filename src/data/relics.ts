// src/data/relics.ts
import type { RelicData } from "@/types/kigaslot";

export const relics: RelicData[] = [
  // 金属 (Metal) 属性強化レリック
  {
    no: 1,
    name: "鍛冶神の金床 (Anvil of the Forge God)",
    targetAttributeOrEffect: "Metal",
    effectText: "全ての金属属性シンボルの基礎メダル獲得量を永続的に +2 する。",
    flavorText: "伝説の鍛冶神が愛用した金床。触れる金属にさらなる価値を与える。",
  },
  {
    no: 2,
    name: "マグネティック・コア (Magnetic Core)",
    targetAttributeOrEffect: "Metal",
    effectText: "スピン開始時、盤面に空きマスがある場合、低確率でランダムな「コイン」系金属属性シンボル（ブロンズ、シルバー、ゴールド）を1つ生成する。",
    flavorText: "強力な磁場を発生させるコア。富を引き寄せ、スロット盤を満たす。",
  },
  {
    no: 3,
    name: "オートメーション・ギア (Automation Gear)",
    targetAttributeOrEffect: "Metal", // "ギア" or "金属の鎖" でも良いが、属性でまとめる
    effectText: "「ギア」(金属SS)または「金属の鎖」(金属AB)シンボルがライン成立に関わった場合、その効果が2倍になる。",
    flavorText: "自己増殖するかの如く連動する機構部品。一度動き出せば、その勢いは止まらない。",
  },
  // 植物 (Plant) 属性強化レリック
  {
    no: 4,
    name: "生命の泉の雫 (Droplet of the Life Spring)",
    targetAttributeOrEffect: "Plant",
    effectText: "全ての植物属性シンボルの基礎メダル獲得量を永続的に +2 する。さらに、「育つ種」(植物RG)の成長に必要なスピン回数を2回減らす。",
    flavorText: "あらゆる生命を育むという泉の雫。植物たちに力強い成長を促す。",
  },
  {
    no: 5,
    name: "共生の菌糸 (Symbiotic Mycelium)",
    targetAttributeOrEffect: "Plant", // "Animal" とのシナジー
    effectText: "植物属性シンボルが動物属性シンボルと隣接して盤面に停止した場合、両方のシンボルのそのスピンにおけるメダル獲得量が +3 される。",
    flavorText: "植物と動物、異なる種を結びつけ、互いに恩恵をもたらす見えざる絆。",
  },
  {
    no: 6,
    name: "豊穣の角笛 (Horn of Plenty)",
    targetAttributeOrEffect: "Plant", // "チェリー" or "四つ葉のクローバー"
    effectText: "「チェリー」(植物LB)または「四つ葉のクローバー」(植物LB)が3つ揃ってライン成立した際、追加でそのラインの獲得メダルと同量のメダルを得る。",
    flavorText: "吹けば作物が実り、花々が咲き乱れるという魔法の角笛。幸運が溢れ出す。",
  },
  // 動物 (Animal) 属性強化レリック
  {
    no: 7,
    name: "百獣の王の紋章 (Crest of the Beast King)",
    targetAttributeOrEffect: "Animal",
    effectText: "全ての動物属性シンボルの基礎メダル獲得量を永続的に +2 する。",
    flavorText: "全ての動物たちが従うという、伝説の王の紋章。その威光は動物たちを奮い立たせる。",
  },
  {
    no: 8,
    name: "狩人の直感 (Hunter's Instinct)",
    targetAttributeOrEffect: "Animal", // "狩人の狼"
    effectText: "「狩人の狼」(動物SS)が「狩り」を行う際、対象シンボルの基礎メダル価値を参照する倍率が3倍から4倍に上昇する。",
    flavorText: "獲物を見抜く鋭敏な五感。確実に仕留めるための、研ぎ澄まされた本能。",
  },
  {
    no: 9,
    name: "群れの結束 (Pack Unity)",
    targetAttributeOrEffect: "Animal",
    effectText: "スピン終了時に盤面にある動物属性シンボルが3つ以上の場合、次のスピンコストを 5% 軽減する。(最大20%まで)",
    flavorText: "仲間と共にいることで強まる絆。群れで行動することで、困難を乗り越える。",
  },
  // 武器 (Weapon) 属性強化レリック
  {
    no: 10,
    name: "伝説の剣聖の鞘 (Sheath of the Legendary Swordmaster)",
    targetAttributeOrEffect: "Weapon",
    effectText: "全ての武器属性シンボルの基礎メダル獲得量を永続的に +2 する。",
    flavorText: "数多の戦場を渡り歩いた剣聖の鞘。納められた武器に、歴戦の経験を宿す。",
  },
  {
    no: 11,
    name: "連撃のガントレット (Gauntlet of Flurry)",
    targetAttributeOrEffect: "Weapon",
    effectText: "武器属性シンボルがライン成立した際、そのラインに含まれる武器属性シンボル1つにつき、追加でメダル +1 を獲得する。",
    flavorText: "一撃では終わらせない。連続攻撃を可能にする魔法の篭手。",
  },
  {
    no: 12,
    name: "必中の矢羽 (True-Aim Feather)",
    targetAttributeOrEffect: "Weapon", // "リスピン・アロー"
    effectText: "「リスピン・アロー」(武器LB)の再スピン確率を100%にする。さらに、再スピンした列でラインが成立した場合、そのラインの獲得メダルが1.2倍になる。",
    flavorText: "狙った獲物は決して逃さない。風を読み、確実に的を射抜く魔法の矢羽。",
  },
  // 神秘 (Mystic) 属性強化レリック
  {
    no: 13,
    name: "星詠みの水晶球 (Crystal Ball of Stargazing)",
    targetAttributeOrEffect: "Mystic",
    effectText: "全ての神秘属性シンボルの基礎メダル獲得量を永続的に +2 する。",
    flavorText: "夜空の星々を通じて未来を読む者の水晶球。神秘の力を増幅させる。",
  },
  {
    no: 14,
    name: "禁断の魔導書 (Forbidden Grimoire)",
    targetAttributeOrEffect: "Mystic", // "呪いの仮面"
    effectText: "「呪いの仮面」(神秘RG)が3つ揃って消滅した際、追加でランダムなレアのシンボルを1つデッキに加える。",
    flavorText: "強大な知識と危険な呪文が記された書物。リスクを乗り越えた者には、相応の報酬が。",
  },
  {
    no: 15,
    name: "ワイルド・ジェム (Wild Gem)",
    targetAttributeOrEffect: "Mystic", // "ワイルド"
    effectText: "スピン開始時、デッキに「ワイルド」(神秘SS)シンボルが含まれている場合、ごく稀に盤面のスロット1つが最初から「ワイルド」として固定される。",
    flavorText: "あらゆる可能性を秘めた原石。時に、予期せぬ幸運を呼び込む。",
  },
];