// src/components/game/SymbolAcquisitionModal.tsx
import type { SymbolData } from '@/types/kigaslot';
import SymbolDisplay from './SymbolDisplay'; // 既存のSymbolDisplayを流用しても良い

interface SymbolAcquisitionModalProps {
  isOpen: boolean;
  choices: SymbolData[];
  onSelect: (symbol: SymbolData) => void;
  onSkip: () => void;
}

export default function SymbolAcquisitionModal({
  isOpen,
  choices,
  onSelect,
  onSkip,
}: SymbolAcquisitionModalProps) {
  if (!isOpen || choices.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-3xl">
        <h2 className="text-2xl font-bold mb-6 text-center text-yellow-400">
          新しいシンボルを獲得！
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {choices.map((symbol, index) => (
            <div
              key={index}
              className="bg-gray-700 p-4 rounded-lg flex flex-col items-center justify-between shadow"
            >
              {/* SymbolDisplay を使うか、ここで直接表示 */}
              <div className="w-24 h-24 mb-2"> {/* サイズ調整のためSymbolDisplayを直接使わず仮の表示 */}
                <SymbolDisplay symbol={symbol} />
              </div>
              <h3 className="text-md font-semibold mb-1 text-center">{symbol.name}</h3>
              <p className="text-xs text-gray-400 mb-1">
                {symbol.rarity} / {symbol.attribute}
              </p>
              <p className="text-xs text-gray-300 mb-3 text-center h-16 overflow-y-auto p-1 border border-gray-600 rounded">
                {symbol.effectText}
              </p>
              <button
                onClick={() => onSelect(symbol)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors"
              >
                選択
              </button>
            </div>
          ))}
        </div>
        <div className="text-center">
          <button
            onClick={onSkip}
            className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded transition-colors"
          >
            スキップ
          </button>
        </div>
      </div>
    </div>
  );
}