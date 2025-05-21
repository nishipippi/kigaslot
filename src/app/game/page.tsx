// src/app/game/page.tsx
'use client';

import { useState, useEffect } from 'react';
import type { SymbolData } from '@/types/kigaslot';
import { symbols as allSymbols } from '@/data/symbols'; // 全シンボルデータをインポート
import SymbolDisplay from '@/components/game/SymbolDisplay'; // シンボル表示コンポーネント

// 初期デッキを定義するヘルパー関数
const getInitialDeck = (): SymbolData[] => {
  const initialDeckSymbolNames = [
    // 要件定義書に基づき、仮の初期デッキを設定。
    // 例: 各属性のコモンBMシンボルをいくつか。
    'ブロンズ・コイン (Bronze Coin)',
    'ブロンズ・コイン (Bronze Coin)',
    'ブロンズ・コイン (Bronze Coin)',
    'ハーブ (Herb)',
    'ハーブ (Herb)',
    'ハーブ (Herb)',
    '森のリス (Forest Squirrel)',
    '森のリス (Forest Squirrel)',
    '森のリス (Forest Squirrel)',
    'ショートソード (Short Sword)',
    'ショートソード (Short Sword)',
    '星のかけら (Stardust)',
    '星のかけら (Stardust)',
  ];
  return initialDeckSymbolNames
    .map(name => allSymbols.find(s => s.name === name))
    .filter(s => s !== undefined) as SymbolData[]; // filter out undefined if a name is not found
};


export default function GamePage() {
  const [medals, setMedals] = useState(100); // 初期メダル
  const [spinCount, setSpinCount] = useState(0); // 現在のスピン回数（スコア）
  const [currentDeck, setCurrentDeck] = useState<SymbolData[]>(getInitialDeck()); // 現在のデッキ
  const [boardSymbols, setBoardSymbols] = useState<(SymbolData | null)[]>(Array(9).fill(null)); // 3x3盤面のシンボル
  const [spinCost, setSpinCost] = useState(10); // スピンコスト
  const [lineMessage, setLineMessage] = useState<string>(""); // ライン成立やメッセージ表示用

  // ライン成立判定とメダル獲得処理
  const checkLines = (currentBoard: (SymbolData | null)[]) => {
    let totalMedalsFromLines = 0;
    const lines = [
      // Horizontal
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      // Vertical
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      // Diagonal
      [0, 4, 8], [2, 4, 6],
    ];

    let formedLineMessages: string[] = [];

    lines.forEach(lineIndices => {
      const s1 = currentBoard[lineIndices[0]];
      const s2 = currentBoard[lineIndices[1]];
      const s3 = currentBoard[lineIndices[2]];

      // シンボルが存在し、かつ全て同じ属性であるかを確認
      if (s1 && s2 && s3 && s1.attribute === s2.attribute && s1.attribute === s3.attribute) {
        const lineWinAmount = 10; // フェーズAでは仮の固定メダル
        totalMedalsFromLines += lineWinAmount;
        formedLineMessages.push(`${s1.attribute} Line! (+${lineWinAmount})`);
        console.log(`Line formed: ${s1.attribute} at indices ${lineIndices.join(',')}, +${lineWinAmount} medals`);
      }
    });

    if (totalMedalsFromLines > 0) {
      setMedals(prevMedals => prevMedals + totalMedalsFromLines);
      setLineMessage(formedLineMessages.join(' | ') || `Total +${totalMedalsFromLines} medals from lines!`);
    } else {
      setLineMessage("No lines formed this spin.");
    }
  };

  // スピン実行処理
  const handleSpin = () => {
    if (medals < spinCost) {
      // 将来的にはモーダルなどで表示
      alert("メダルが足りません！ゲームオーバーです。(仮)");
      // ここでゲームオーバー処理を呼び出すか、状態を更新
      return;
    }

    // 1. コスト消費とスピンカウント増加
    setMedals(prevMedals => prevMedals - spinCost);
    setSpinCount(prevSpinCount => prevSpinCount + 1);
    setLineMessage(""); // 前回のラインメッセージをクリア

    // 2. デッキからランダムに9つのシンボルを選択して盤面に配置
    const newBoardSymbols: SymbolData[] = [];
    if (currentDeck.length > 0) {
      for (let i = 0; i < 9; i++) {
        // デッキからランダムに1枚引く（重複あり、デッキは消費しないイメージ）
        const randomIndex = Math.floor(Math.random() * currentDeck.length);
        newBoardSymbols.push(currentDeck[randomIndex]);
      }
    } else {
      // デッキが空の場合のフォールバック（通常は発生しないようにゲームデザインでカバー）
      console.warn("Deck is empty. Cannot draw symbols for the board.");
      setBoardSymbols(Array(9).fill(null)); // 盤面を空にする
      setLineMessage("Deck is empty!");
      return;
    }
    setBoardSymbols(newBoardSymbols);

    // 3. ライン成立判定を実行 (盤面更新後に行うため、useEffectを使うか、同期的に処理する)
    // 今回は handleSpin 内で同期的に checkLines を呼び出します。
    // 非同期な状態更新が絡む場合、useEffectで boardSymbols の変更を監視して checkLines を呼び出す方が堅牢です。
    // ただし、今回はシンプルにするため直接呼び出します。
    checkLines(newBoardSymbols); // newBoardSymbols を渡して判定

    // 4. シンボル獲得フェーズやコストアップ/レリック獲得フェーズのトリガー (フェーズB以降)
    // triggerSymbolAcquisition();
    // triggerCostIncreaseAndRelic();
  };


  // UIレンダリング
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 selection:bg-yellow-500 selection:text-black">
      <header className="w-full max-w-3xl mb-8">
        <div className="flex justify-between items-center p-4 bg-gray-800 rounded-lg shadow-lg">
          <div>Medals: <span className="font-bold text-yellow-400 text-lg">{medals}</span></div>
          <div>Spin Cost: <span className="font-bold text-red-400 text-lg">{spinCost}</span></div>
          <div>Spins: <span className="font-bold text-xl">{spinCount}</span></div>
        </div>
      </header>

      <main className="w-full max-w-md mb-8">
        <div className="grid grid-cols-3 gap-2 p-2 bg-gray-700 rounded-lg shadow-inner">
          {boardSymbols.map((symbol, i) => (
            <SymbolDisplay key={i} symbol={symbol} />
          ))}
        </div>
        {lineMessage && (
          <div className="mt-4 p-2 bg-gray-800 rounded text-center text-sm text-yellow-300 shadow">
            {lineMessage}
          </div>
        )}
      </main>

      <footer className="w-full max-w-3xl">
        <div className="flex justify-around items-center p-4 bg-gray-800 rounded-lg shadow-lg">
          <button
            onClick={handleSpin}
            className="px-10 py-4 bg-green-600 hover:bg-green-700 text-white text-xl font-semibold rounded-lg shadow-md transition-all duration-150 ease-in-out active:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={medals < spinCost || currentDeck.length === 0} // メダル不足またはデッキが空ならスピン不可
          >
            SPIN!
          </button>
          <button
            onClick={() => alert("Deck Edit - Coming Soon!")} // 仮のアラート
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold rounded-lg shadow-md transition-all duration-150 ease-in-out active:bg-blue-800"
          >
            DECK EDIT
          </button>
        </div>
      </footer>
    </div>
  );
}