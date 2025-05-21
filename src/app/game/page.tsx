// src/app/game/page.tsx
'use client'; // ゲームロジックや状態管理のためクライアントコンポーネントにする可能性が高い

import { useState, useEffect } from 'react';
// import { symbols, relics, enemies } from '@/data'; // 将来的に使用

export default function GamePage() {
  const [medals, setMedals] = useState(100); // 初期メダル（仮）
  const [spinCount, setSpinCount] = useState(0);

  // ここにゲームのコアロジックを実装していきます

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <header className="w-full max-w-3xl mb-8">
        <div className="flex justify-between items-center p-4 bg-gray-800 rounded-lg shadow">
          <div>Medals: <span className="font-bold text-yellow-400">{medals}</span></div>
          <div>Spin Cost: <span className="font-bold text-red-400">10</span></div> {/* 仮 */}
          <div>Spins: <span className="font-bold">{spinCount}</span></div>
        </div>
      </header>

      <main className="w-full max-w-md mb-8">
        {/* 3x3 スロット盤面 */}
        <div className="grid grid-cols-3 gap-2 p-2 bg-gray-700 rounded-lg shadow-inner">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-gray-600 rounded flex items-center justify-center text-2xl font-bold"
            >
              ? {/* シンボル表示場所 */}
            </div>
          ))}
        </div>
      </main>

      <footer className="w-full max-w-3xl">
        <div className="flex justify-around items-center p-4 bg-gray-800 rounded-lg shadow">
          <button
            onClick={() => {
              // スピン処理 (仮)
              if (medals >= 10) {
                setMedals(medals - 10);
                setSpinCount(spinCount + 1);
                alert("Spin!");
              } else {
                alert("Not enough medals!");
              }
            }}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white text-xl font-semibold rounded-lg shadow-md"
          >
            SPIN
          </button>
          <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold rounded-lg shadow-md">
            DECK EDIT
          </button>
        </div>
        {/* シンボル獲得やレリック選択のUIもここに追加 */}
      </footer>
    </div>
  );
}