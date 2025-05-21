// src/components/game/DeckEditModal.tsx
import type { SymbolData, SymbolAttribute } from '@/types/kigaslot';

interface DeckEditModalProps {
  isOpen: boolean;
  deck: SymbolData[];
  tickets: number;
  onClose: () => void;
  onDeleteSymbol: (symbolIndex: number) => void;
}

// 属性に応じたTailwind CSSのクラスを返すヘルパー関数
const getAttributeColorClass = (attribute: SymbolAttribute): string => {
  switch (attribute) {
    case 'Metal':
      return 'border-slate-500 hover:bg-slate-700';
    case 'Plant':
      return 'border-green-500 hover:bg-green-700';
    case 'Animal':
      return 'border-yellow-500 hover:bg-yellow-700';
    case 'Weapon':
      return 'border-red-500 hover:bg-red-700';
    case 'Mystic':
      return 'border-purple-500 hover:bg-purple-700';
    default:
      return 'border-gray-600 hover:bg-gray-600';
  }
};

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
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl sm:text-3xl leading-none"
            aria-label="Close modal"
          >
            ×
          </button>
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
                  className={`bg-gray-700 p-2 sm:p-3 rounded shadow flex flex-col sm:flex-row justify-between items-start sm:items-center border-l-4 transition-colors duration-150 ${getAttributeColorClass(symbol.attribute)}`}
                >
                  <div className="flex-grow mb-2 sm:mb-0 w-full sm:w-auto"> {/* w-full sm:w-auto を追加 */}
                    <p className="font-semibold text-white text-sm sm:text-base">{symbol.name}</p>
                    <p className="text-xs text-gray-400">
                      {symbol.rarity} / <span className={`font-medium ${
                        symbol.attribute === 'Metal' ? 'text-slate-300' :
                        symbol.attribute === 'Plant' ? 'text-green-300' :
                        symbol.attribute === 'Animal' ? 'text-yellow-300' :
                        symbol.attribute === 'Weapon' ? 'text-red-300' :
                        symbol.attribute === 'Mystic' ? 'text-purple-300' :
                        'text-gray-300'
                      }`}>{symbol.attribute}</span> / {symbol.effectSystem}
                    </p>
                    {/* シンボル効果テキスト表示 */}
                    <p className="mt-1 text-xs text-gray-200 bg-gray-750 p-1.5 rounded leading-snug max-h-20 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-750"> {/* max-h と overflow */}
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
                      className="ml-0 sm:ml-4 mt-2 sm:mt-0 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded transition-colors self-start sm:self-center flex-shrink-0" // flex-shrink-0 を追加
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
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-8 rounded transition-colors text-sm sm:text-base"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}