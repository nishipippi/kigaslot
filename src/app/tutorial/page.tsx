// src/app/tutorial/page.tsx
import Link from 'next/link';

// 実際のゲームから持ってきたシンボルデータの型 (簡略版でもOK)
interface MockSymbolData {
  name: string;
  attribute: string; // 'Metal', 'Plant', etc.
  rarity: string;   // 'Common', 'Uncommon', 'Rare'
  // iconPath?: string; // アイコン画像があれば
}

// シンボル表示の簡易コンポーネント (チュートリアル用)
const MockSymbolDisplay = ({ symbol }: { symbol: MockSymbolData | null }) => {
  const getAttributeColor = (attribute: string | undefined): string => {
    if (!attribute) return 'bg-gray-500';
    switch (attribute) {
      case 'Metal': return 'bg-slate-400';
      case 'Plant': return 'bg-green-500';
      case 'Animal': return 'bg-yellow-500';
      case 'Weapon': return 'bg-red-500';
      case 'Mystic': return 'bg-purple-500';
      default: return 'bg-gray-600';
    }
  };

  if (!symbol) {
    return (
      <div className="aspect-square bg-gray-600 rounded flex items-center justify-center text-xl font-bold text-gray-400">
        ?
      </div>
    );
  }
  return (
    <div
      className={`aspect-square rounded flex flex-col items-center justify-center p-1 text-white shadow-md ${getAttributeColor(symbol.attribute)}`}
    >
      <div className="text-xs font-semibold break-words text-center leading-tight">
        {symbol.name.split(' ')[0]}
      </div>
      <div className="text-xxs mt-0.5 opacity-80">{symbol.attribute}</div>
    </div>
  );
};


export default function TutorialPage() {
  const sectionTitleStyle = "text-2xl font-bold text-yellow-400 mb-3 mt-8";
  const subTitleStyle = "text-xl font-semibold text-yellow-300 mb-2 mt-6";
  const paragraphStyle = "text-gray-300 mb-3 leading-relaxed";
  // const listItemStyle = "text-gray-300 mb-1 ml-4 list-disc";
  const highlightStyle = "text-orange-300 font-semibold";
  const uiLabelStyle = "font-semibold text-sky-300"; // UI要素を指すテキストのスタイル

  // チュートリアル用の盤面シンボルデータ例
  const mockBoardSymbols: (MockSymbolData | null)[] = [
    { name: "ブロンズC", attribute: "Metal", rarity: "Common" },
    { name: "ハーブ", attribute: "Plant", rarity: "Common" },
    { name: "ブロンズC", attribute: "Metal", rarity: "Common" },
    { name: "森リス", attribute: "Animal", rarity: "Common" },
    { name: "磁鉄鉱", attribute: "Metal", rarity: "Common" }, // このラインが成立する想定
    { name: "ショートS", attribute: "Weapon", rarity: "Common" },
    { name: "星かけら", attribute: "Mystic", rarity: "Common" },
    { name: "木の実", attribute: "Plant", rarity: "Common" },
    { name: "ブロンズC", attribute: "Metal", rarity: "Common" },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-8 selection:bg-yellow-500 selection:text-black">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-yellow-500">KigaSlot - チュートリアル</h1>
      </header>

      <main className="max-w-4xl mx-auto bg-gray-800 p-6 rounded-lg shadow-xl">
        <p className={paragraphStyle}>
          ようこそ「KigaSlot」へ！このチュートリアルではゲームの基本的な遊び方を説明します。
        </p>

        {/* ゲーム画面の模倣と解説 */}
        <section>
          <h2 className={sectionTitleStyle}>ゲーム画面の見方</h2>
          <p className={paragraphStyle}>
            これがメインのゲーム画面です。各要素の役割を見ていきましょう。
          </p>

          {/* ヘッダー情報の模倣 */}
          <div className="my-6 p-4 bg-gray-700 rounded-lg shadow-md">
            <h3 className={subTitleStyle + " mt-0"}>ヘッダー情報エリア</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-sm">
              <div className="bg-gray-800 p-2 rounded">
                <span className={uiLabelStyle}>Medals:</span> <span className="text-yellow-400 font-bold">100</span><br/>
                <span className="text-xs text-gray-400">現在の所持メダルです。スピンに使います。</span>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <span className={uiLabelStyle}>Spin Cost:</span> <span className="text-red-400 font-bold">10</span><br/>
                <span className="text-xs text-gray-400">1回スピンするのに必要なメダル数。</span>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <span className={uiLabelStyle}>Spins:</span> <span className="font-bold">0</span><br/>
                <span className="text-xs text-gray-400">現在の総スピン回数。これがスコアになります。</span>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <span className={uiLabelStyle}>Deck:</span> <span className="font-bold">15</span><br/>
                <span className="text-xs text-gray-400">現在のデッキに入っているシンボルの総数。</span>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <span className={uiLabelStyle}>CostUp In:</span> <span className="font-bold">5</span><br/>
                <span className="text-xs text-gray-400">次のスピンコスト増加までの残りスピン数。</span>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <span className={uiLabelStyle}>Enemy In:</span> <span className="font-bold">10</span><br/>
                <span className="text-xs text-gray-400">次の敵出現までの残りスピン数。</span>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <span className={uiLabelStyle}>Tickets:</span> <span className="text-green-400 font-bold">0</span><br/>
                <span className="text-xs text-gray-400">シンボル削除チケットの所持数。</span>
              </div>
            </div>
             {/* 敵情報表示エリアの模倣 (最初は非表示でも良い) */}
            <div className="mt-3 p-2 bg-red-900 bg-opacity-50 rounded text-center hidden"> {/* hidden で最初は隠す */}
                <p className="font-bold text-red-300">敵の名前 HP: XX</p>
                <p className="text-xs text-red-200">敵の妨害効果の説明</p>
                <p className={paragraphStyle + " mt-1 text-xs text-gray-400"}>10スピンごとに敵が出現すると、ここに情報が表示されます。</p>
            </div>
          </div>

          {/* スロット盤面の模倣 */}
          <div className="my-6 p-4 bg-gray-700 rounded-lg shadow-md">
            <h3 className={subTitleStyle + " mt-0"}>スロット盤面エリア</h3>
            <p className={paragraphStyle}>
              中央の3x3の盤面に、あなたのデッキからシンボルが表示されます。
              同じ<strong className={highlightStyle}>属性</strong>のシンボルが縦・横・斜めに3つ揃うとライン成立です。
              下の例では、左上から右下にかけてのラインに「Metal」属性のシンボルが3つ揃っています (シンボル名は異なってもOK)。
            </p>
            <div className="w-full max-w-xs sm:max-w-sm mx-auto mb-4">
              <div className="grid grid-cols-3 gap-1 md:gap-2 p-1 md:p-2 bg-gray-600 rounded-lg shadow-inner">
                {mockBoardSymbols.map((symbol, i) => (
                   <div key={i} className={`transition-all duration-200 ease-in-out transform ${ (i === 0 || i === 4 || i === 8) ? 'ring-2 ring-yellow-300 scale-105' : '' }`}> {/* 例として斜めラインをハイライト */}
                    <MockSymbolDisplay symbol={symbol} />
                   </div>
                ))}
              </div>
            </div>
            <p className={paragraphStyle}>
              ラインが成立するとメダルを獲得できます。獲得量はライン上のシンボル効果やレリックによって変わります。
              この例では、<strong className={highlightStyle}>斜め右下がり</strong>の「Metal」ラインが成立しています。
            </p>
            <div className="mt-2 p-2 bg-gray-900 rounded text-center text-sm text-yellow-300">
              例: Metal Line: ブロンズC(+2) ブロンズC(+2) ブロンズC(+2) =＞ Total +6
            </div>
            <p className={paragraphStyle + " mt-2 text-xs text-gray-400"}>（実際のゲームでは、成立したラインや獲得メダルがここに表示されます）</p>
          </div>

          {/* フッターボタンの模倣 */}
          <div className="my-6 p-4 bg-gray-700 rounded-lg shadow-md">
            <h3 className={subTitleStyle + " mt-0"}>操作ボタンエリア</h3>
            <div className="flex justify-around items-center p-2 bg-gray-600 rounded-lg">
              <button className="px-6 md:px-10 py-3 md:py-4 bg-green-600 text-white text-lg md:text-xl font-semibold rounded-lg shadow-md opacity-70 cursor-not-allowed">
                SPIN!
              </button>
              <button className="px-4 md:px-8 py-3 md:py-4 bg-blue-600 text-white text-lg md:text-xl font-semibold rounded-lg shadow-md opacity-70 cursor-not-allowed">
                DECK
              </button>
            </div>
            <ul className="list-none mt-3 space-y-1">
                <li><strong className={uiLabelStyle}>SPIN! ボタン:</strong> これを押してスロットを回します。現在の<span className={uiLabelStyle}>Spin Cost</span>分のメダルが必要です。</li>
                <li><strong className={uiLabelStyle}>DECK ボタン:</strong> 現在のデッキ内容を確認したり、獲得した「シンボル削除チケット」を使って不要なシンボルを削除したりできます。</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className={sectionTitleStyle}>ゲームの流れと戦略のヒント</h2>
          <p className={paragraphStyle}>
            <strong className={highlightStyle}>1. シンボル獲得:</strong> 毎スピン後、提示される3つのシンボルから1つを選びデッキを強化します。デッキのテーマ（特定の属性を増やすなど）を意識すると良いでしょう。スキップも可能です。
          </p>
          <p className={paragraphStyle}>
            <strong className={highlightStyle}>2. レリック獲得:</strong> 5スピンごとに強力な永続効果を持つレリックを獲得できます。デッキ戦略に合ったレリックを選びましょう。
          </p>
          <p className={paragraphStyle}>
            <strong className={highlightStyle}>3. 敵との戦闘:</strong> 10スピンごとに出現する敵は厄介ですが、倒せばデッキ圧縮のチャンスです。獲得メダルでダメージを与えましょう。
          </p>
          <p className={paragraphStyle}>
            <strong className={highlightStyle}>4. デッキ圧縮:</strong> 「シンボル削除チケット」で初期の弱いシンボルや戦略に合わないシンボルを削除し、デッキの回転率と質を高めることが重要です。
          </p>
          <p className={paragraphStyle}>
            <strong className={highlightStyle}>5. スピンコスト管理:</strong> スピンコストはどんどん上がっていきます。メダル獲得効率を上げるデッキ構築と、時には大胆なスピンを続ける判断がハイスコアへの鍵です。
          </p>
        </section>

        <div className="mt-10 text-center">
          <Link href="/">
            <button className="bg-yellow-600 hover:bg-yellow-700 text-gray-900 font-bold py-3 px-8 rounded-lg text-lg transition-colors">
              ホームに戻る
            </button>
          </Link>
        </div>
      </main>

      <footer className="text-center text-gray-500 mt-12 pb-8">
        <p>© KigaSlot. Good luck, and have fun!</p>
      </footer>
    </div>
  );
}