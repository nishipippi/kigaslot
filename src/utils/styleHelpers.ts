// src/utils/styleHelpers.ts
import type { SymbolRarity, SymbolAttribute } from '@/types/kigaslot'; // プロジェクトの型定義ファイルをインポート

/**
 * シンボルのレアリティに基づいてカード全体の背景色と枠線のスタイルクラスを返します。
 * @param rarity シンボルのレアリティ
 * @returns Tailwind CSSのクラス文字列
 */
export const getRarityCardStyle = (rarity: SymbolRarity): string => {
  switch (rarity) {
    case 'Common':
      return 'bg-gray-700 hover:bg-gray-650 border-gray-600';
    case 'Uncommon':
      // 少し明るい緑系の背景と、目立つ枠線、影
      return 'bg-green-800 hover:bg-green-700 border-green-500 shadow-lg shadow-green-500/30';
    case 'Rare':
      // より鮮やかな青系の背景と、さらに目立つ枠線、強い影
      return 'bg-blue-800 hover:bg-blue-700 border-blue-500 shadow-xl shadow-blue-500/40';
    // 必要に応じて他のレアリティ（Epic, Legendaryなど）も追加
    // case 'Epic':
    //   return 'bg-purple-800 hover:bg-purple-700 border-purple-500 shadow-xl shadow-purple-500/50';
    default:
      return 'bg-gray-700 hover:bg-gray-650 border-gray-600';
  }
};

/**
 * シンボルのレアリティに基づいてテキストの色スタイルクラスを返します。
 * @param rarity シンボルのレアリティ
 * @returns Tailwind CSSのクラス文字列
 */
export const getRarityTextColorClass = (rarity: SymbolRarity): string => {
  switch (rarity) {
    case 'Common':
      return 'text-gray-300'; // やや控えめな色
    case 'Uncommon':
      return 'text-green-300'; // 緑系の明るい色
    case 'Rare':
      return 'text-blue-300';   // 青系の明るい色
    // case 'Epic':
    //   return 'text-purple-300';
    default:
      return 'text-gray-400'; // デフォルトはやや暗めのグレー
  }
};

/**
 * シンボルの属性に基づいてアイコンやアクセント部分の背景色スタイルクラスを返します。
 * (SymbolDisplay.tsxで使われているものと類似)
 * @param attribute シンボルの属性
 * @returns Tailwind CSSのクラス文字列
 */
export const getAttributeBgColorClass = (attribute: SymbolAttribute | undefined): string => {
  if (!attribute) return 'bg-gray-500';
  switch (attribute) {
    case 'Metal':
      return 'bg-slate-500 hover:bg-slate-400';
    case 'Plant':
      return 'bg-green-600 hover:bg-green-500';
    case 'Animal':
      return 'bg-yellow-500 hover:bg-yellow-400';
    case 'Weapon':
      return 'bg-red-600 hover:bg-red-500';
    case 'Mystic':
      return 'bg-purple-600 hover:bg-purple-500';
    default:
      return 'bg-gray-600 hover:bg-gray-500';
  }
};

/**
 * シンボルの属性に基づいてテキストの色スタイルクラスを返します。
 * @param attribute シンボルの属性
 * @returns Tailwind CSSのクラス文字列
 */
export const getAttributeTextColorClass = (attribute: SymbolAttribute | undefined): string => {
    if (!attribute) return 'text-gray-400';
    switch (attribute) {
      case 'Metal':
        return 'text-slate-300';
      case 'Plant':
        return 'text-green-300';
      case 'Animal':
        return 'text-yellow-300';
      case 'Weapon':
        return 'text-red-300';
      case 'Mystic':
        return 'text-purple-300';
      default:
        return 'text-gray-300';
    }
  };

/**
 * シンボルの属性に基づいて枠線の色スタイルクラスを返します。
 * (DeckEditModalで使われているものと類似)
 * @param attribute シンボルの属性
 * @returns Tailwind CSSのクラス文字列
 */
export const getAttributeBorderColorClass = (attribute: SymbolAttribute): string => {
    switch (attribute) {
      case 'Metal':
        return 'border-slate-500';
      case 'Plant':
        return 'border-green-500';
      case 'Animal':
        return 'border-yellow-500';
      case 'Weapon':
        return 'border-red-500';
      case 'Mystic':
        return 'border-purple-500';
      default:
        return 'border-gray-600';
    }
  };

// 他にも共通で使えそうなスタイルヘルパーがあればここに追加
// 例: ボタンの共通スタイル、入力フィールドのスタイルなど