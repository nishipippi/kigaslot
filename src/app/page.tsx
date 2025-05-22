// src/app/page.tsx (抜粋)
import Link from 'next/link';

export default function TitlePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-800 text-white p-8">
      <div className="text-center space-y-8">
        <h1 className="text-6xl font-bold tracking-tight text-yellow-400">
          KigaSlot
        </h1>
        <p className="text-xl text-gray-300">
          運命を紡ぐ錬金術スロット
        </p>
        <div className="space-y-4 flex flex-col items-center"> {/* 中央寄せのため flex-col items-center を追加 */}
          <Link href="/game" className="w-full max-w-xs">
            <button className="w-full px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-2xl font-semibold rounded-lg shadow-md transition-colors duration-150">
              START GAME
            </button>
          </Link>
          <Link href="/tutorial" className="w-full max-w-xs"> {/* チュートリアルボタン追加 */}
            <button className="w-full px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold rounded-lg shadow-md transition-colors duration-150">
              TUTORIAL
            </button>
          </Link>
          {/* <button className="w-full max-w-xs px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white text-xl font-semibold rounded-lg shadow-md transition-colors duration-150">
            OPTION
          </button> */}
        </div>
      </div>
      {/* ... footer ... */}
    </main>
  );
}