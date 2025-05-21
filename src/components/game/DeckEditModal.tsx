// src/components/game/DeckEditModal.tsx
import type { SymbolData, SymbolAttribute } from '@/types/kigaslot';
import { getRarityCardStyle, getRarityTextColorClass, getAttributeBorderColorClass, getAttributeTextColorClass } from '@/utils/styleHelpers'; // styleHelpersをインポート

interface DeckEditModalProps {
  isOpen: boolean;
  deck: SymbolData[];
  tickets: number;
  onClose: () => void;
  onDeleteSymbol: (symbolIndex: number) => void;
}

export default function DeckEditModal({
  isOpen,
  deck,
  tickets,
  onClose,
  onDeleteSymbol,
}: DeckEditModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4 transition-opacity duration-300 ease-in-out">
      <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl w-full max-w-xl md:max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col transform transition-all duration-300 ease-in-out scale-100">
        <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-3">
          <h2 className="text-xl sm:text-2xl font-bold text-yellow-400">デッキ編集</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl sm:text-3xl leading-none" aria-label="Close modal">×</button>
        </div>

        <div className="mb-3 sm:mb-4 text-gray-300 text-sm sm:text-base">
          シンボル削除チケット: <span className={`font-bold ${tickets > 0 ? 'text-green-400' : 'text-red-400'}`}>{tickets}</span> 枚
        </div>

        <div className="flex-grow overflow-y-auto pr-1 sm:pr-2 space-y-1.5 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 bg-gray-850 p-1.5 sm:p-2 rounded">
          {deck.length === 0 ? (
            <p className="text-gray-500 text-center py-10">デッキは空です。</p>
          ) : (
            <ul className="space-y-1.5">
              {deck.map((symbol, index) => (
                <li
                  key={`${symbol.no}-${index}`}
                  className={`p-2 sm:p-3 rounded shadow flex flex-col sm:flex-row justify-between items-start sm:items-center border-l-4 ${getAttributeBorderColorClass(symbol.attribute)} ${getRarityCardStyle(symbol.rarity)}`}
                >
                  <div className="flex-grow mb-2 sm:mb-0">
                    <p className="font-semibold text-white text-sm sm:text-base">{symbol.name}</p>
                    <p className={`text-xs font-bold ${getRarityTextColorClass(symbol.rarity)}`}>
                      {symbol.rarity} / <span className={getAttributeTextColorClass(symbol.attribute)}>{symbol.attribute}</span> / {symbol.effectSystem}
                    </p>
                    <p className="mt-1 text-xs text-gray-200 bg-gray-750 p-1.5 rounded leading-snug">
                      効果: {symbol.effectText}
                    </p>
                  </div>
                  {tickets > 0 && (
                    <button
                      onClick={() => {
                        if (window.confirm(`「${symbol.name}」をデッキから削除しますか？\n(チケットを1枚消費します)`)) {
                          onDeleteSymbol(index);
                        }
                      }}
                      className="ml-0 sm:ml-4 mt-2 sm:mt-0 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded transition-colors self-start sm:self-center"
                      title="シンボルを削除 (チケット消費)"
                    >
                      削除
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-700 text-center">
          <button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-8 rounded transition-colors text-sm sm:text-base">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}