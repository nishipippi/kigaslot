// src/components/game/SymbolDisplay.tsx
import type { SymbolData, SymbolAttribute } from '@/types/kigaslot';

interface SymbolDisplayProps {
  symbol: SymbolData | null;
}

const getAttributeColor = (attribute: SymbolAttribute | undefined): string => {
  if (!attribute) return 'bg-gray-500'; // シンボルなしの場合
  switch (attribute) {
    case 'Metal':
      return 'bg-slate-400';
    case 'Plant':
      return 'bg-green-500';
    case 'Animal':
      return 'bg-yellow-500';
    case 'Weapon':
      return 'bg-red-500';
    case 'Mystic':
      return 'bg-purple-500';
    default:
      return 'bg-gray-600';
  }
};

export default function SymbolDisplay({ symbol }: SymbolDisplayProps) {
  if (!symbol) {
    return (
      <div className="aspect-square bg-gray-600 rounded flex items-center justify-center text-2xl font-bold text-gray-400">
        ?
      </div>
    );
  }

  return (
    <div
      className={`aspect-square rounded flex flex-col items-center justify-center p-1 text-white shadow-md ${getAttributeColor(symbol.attribute)}`}
      title={`${symbol.name} (${symbol.rarity}) - ${symbol.effectText}`} // ホバーで詳細表示 (仮)
    >
      <div className="text-xs font-semibold break-words text-center leading-tight">
        {symbol.name.split(' ')[0]} {/* 名前の一部を表示 */}
      </div>
      <div className="text-xs mt-1 opacity-80">{symbol.attribute}</div>
    </div>
  );
}