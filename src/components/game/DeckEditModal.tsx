// src/components/game/DeckEditModal.tsx
import type { SymbolData } from '@/types/kigaslot';

interface DeckEditModalProps {
  isOpen: boolean;
  deck: SymbolData[];
  tickets: number;
  onClose: () => void;
  onDeleteSymbol: (symbolIndex: number) => void; // シンボル削除用のコールバック
}

export default function DeckEditModal({
  isOpen,
  deck,
  tickets,
  onClose,
  onDeleteSymbol, // 受け取る
}: DeckEditModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col transform transition-all duration-300 ease-in-out scale-100">
        <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-3">
          <h2 className="text-2xl font-bold text-yellow-400">デッキ編集</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl leading-none"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="mb-4 text-gray-300">
          シンボル削除チケット: <span className={`font-bold ${tickets > 0 ? 'text-green-400' : 'text-red-400'}`}>{tickets}</span> 枚
        </div>

        <div className="flex-grow overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 bg-gray-850 p-2 rounded">
          {deck.length === 0 ? (
            <p className="text-gray-500 text-center py-10">デッキは空です。</p>
          ) : (
            <ul className="space-y-2">
              {deck.map((symbol, index) => (
                <li
                  key={`${symbol.name}-${index}`} // よりユニークなキー (同じシンボルが複数ある場合のため)
                  className="bg-gray-700 p-3 rounded shadow flex justify-between items-center hover:bg-gray-600 transition-colors"
                >
                  <div className="flex-grow">
                    <p className="font-semibold text-white">{symbol.name}</p>
                    <p className="text-xs text-gray-400">
                      {symbol.rarity} / {symbol.attribute} / Effect: {symbol.effectSystem}
                    </p>
                  </div>
                  {tickets > 0 && (
                    <button
                      onClick={() => {
                        if (window.confirm(`「${symbol.name}」をデッキから削除しますか？\n(チケットを1枚消費します)`)) {
                          onDeleteSymbol(index);
                        }
                      }}
                      className="ml-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded transition-colors disabled:opacity-50"
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

        <div className="mt-6 pt-4 border-t border-gray-700 text-center">
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-8 rounded transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}