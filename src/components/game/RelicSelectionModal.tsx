// src/components/game/RelicSelectionModal.tsx
import type { RelicData } from '@/types/kigaslot';

interface RelicSelectionModalProps {
  isOpen: boolean;
  choices: RelicData[];
  onSelect: (relic: RelicData) => void;
}
export default function RelicSelectionModal({
  isOpen,
  choices,
  onSelect,
}: RelicSelectionModalProps) {
  if (!isOpen || choices.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-3xl">
        <h2 className="text-2xl font-bold mb-6 text-center text-yellow-400">
          レリックを選択
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {choices.map((relic, index) => (
            <div
              key={index}
              className="bg-gray-700 p-4 rounded-lg flex flex-col items-center justify-between shadow hover:bg-gray-600 transition-colors cursor-pointer"
              onClick={() => onSelect(relic)}
            >
              <h3 className="text-md font-semibold mb-2 text-center">{relic.name}</h3>
              <p className="text-xs text-gray-300 mb-3 text-center h-20 overflow-y-auto p-1 border border-gray-600 rounded">
                {relic.effectText}
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); onSelect(relic); }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors mt-auto"
              >
                選択
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}