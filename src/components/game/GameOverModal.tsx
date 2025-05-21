// src/components/game/GameOverModal.tsx
// import Link from 'next/link'; // Linkコンポーネントを使用する場合は必要

interface GameOverModalProps {
  isOpen: boolean;
  score: number;
  onRestart: () => void;
}

export default function GameOverModal({ isOpen, score, onRestart }: GameOverModalProps) { // ここをチェック！
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl text-center w-full max-w-md">
        <h2 className="text-4xl font-bold mb-6 text-red-500">GAME OVER</h2>
        <p className="text-xl text-white mb-2">Your Score:</p>
        <p className="text-5xl font-bold text-yellow-400 mb-8">{score}</p>
        <button
          onClick={onRestart}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors"
        >
          Return to Title
        </button>
      </div>
    </div>
  );
}