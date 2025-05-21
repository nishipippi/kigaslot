// src/components/game/SymbolAcquisitionModal.tsx
import type { SymbolData } from '@/types/kigaslot';
import SymbolDisplay from './SymbolDisplay';

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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4 transition-opacity duration-300 ease-in-out">
      <div className="bg-gray-800 p-3 py-4 sm:p-6 rounded-lg shadow-xl w-full max-w-xs sm:max-w-sm md:max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 ease-in-out scale-100">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4 text-center text-yellow-400 flex-shrink-0">
          新しいシンボルを獲得！
        </h2>

        {/* シンボル選択エリア */}
        <div className={`grid gap-2 sm:gap-3 mb-3 sm:mb-4 flex-grow overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 ${
            choices.length === 1 ? 'grid-cols-1 place-items-center' : 
            choices.length === 2 ? 'grid-cols-2' : 
            'grid-cols-1 md:grid-cols-3' // 3つ以上ならPCでは3列、スマホでは1列
        }`}>
          {choices.map((symbol, index) => (
            <div
              key={index}
              className="bg-gray-700 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-between shadow-md h-full max-w-xs mx-auto w-full" // カードの最大幅と中央寄せ
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 mb-1 sm:mb-2">
                <SymbolDisplay symbol={symbol} />
              </div>
              <h3 className="text-xs sm:text-sm md:text-md font-semibold mb-1 text-center text-white leading-tight">
                {symbol.name}
              </h3>
              <p className="text-xxs sm:text-xs text-gray-400 mb-1">
                {symbol.rarity} / {symbol.attribute}
              </p>
              <p className="text-xxs sm:text-xs text-gray-300 mb-2 sm:mb-3 text-center h-16 sm:h-20 md:h-24 overflow-y-auto p-1 border border-gray-600 rounded w-full scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-700 leading-snug">
                {symbol.effectText}
              </p>
              <button
                onClick={() => onSelect(symbol)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 sm:py-2 px-3 sm:px-4 rounded transition-colors text-xs sm:text-sm md:text-base"
              >
                選択
              </button>
            </div>
          ))}
        </div>

        {/* スキップボタンエリア */}
        <div className="text-center mt-auto pt-3 sm:pt-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={onSkip}
            className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded transition-colors text-sm sm:text-base"
          >
            スキップ
          </button>
        </div>
      </div>
    </div>
  );
}