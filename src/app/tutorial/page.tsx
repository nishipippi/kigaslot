// src/app/tutorial/page.tsx
import Link from 'next/link';

export default function TutorialPage() {
  const sectionTitleStyle = "text-2xl font-bold text-yellow-400 mb-3 mt-6";
  const paragraphStyle = "text-gray-300 mb-3 leading-relaxed";
  const listItemStyle = "text-gray-300 mb-1 ml-4 list-disc";
  const codeStyle = "bg-gray-700 px-1 rounded text-orange-300 font-mono text-sm";

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-8 selection:bg-yellow-500 selection:text-black">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-yellow-500">KigaSlot - Tutorial</h1>
        <p className="text-gray-400 mt-2">ゲームの遊び方を学びましょう！</p>
      </header>

      <main className="max-w-3xl mx-auto bg-gray-800 p-6 rounded-lg shadow-xl">
        <section>
          <h2 className={sectionTitleStyle}>1. ゲームの目的</h2>
          <p className={paragraphStyle}>
            「KigaSlot」は、スロットを回してメダルを獲得し、より多くのスピン回数を目指すデッキ構築型ローグライクゲームです。
            スピンに必要なメダルがなくなるとゲームオーバーです。目標はハイスコア（総スピン回数）を更新すること！
          </p>
        </section>

        <section>
          <h2 className={sectionTitleStyle}>2. 基本的な流れ</h2>
          <ol className="list-decimal list-inside text-gray-300 space-y-2">
            <li>メダルを消費して3x3のスロットをスピンします。</li>
            <li>盤面に揃ったラインに応じてメダルを獲得します。</li>
            <li>スピン終了後、新しい「シンボル」を1つ獲得し、デッキに加えるか選択します。</li>
            <li>5スピンごとにスピンコストが増加し、「レリック」を1つ獲得します。</li>
            <li>10スピンごとに「敵」が出現し、戦闘になります。</li>
          </ol>
        </section>

        <section>
          <h2 className={sectionTitleStyle}>3. スロットとシンボル</h2>
          <p className={paragraphStyle}>
            スロット盤面は3x3のマスで構成されます。スピンすると、あなたの「シンボルデッキ」からランダムにシンボルが選ばれて盤面に表示されます。
          </p>
          <h3 className="text-xl font-semibold text-yellow-300 mb-2 mt-4">シンボルの属性とレアリティ</h3>
          <p className={paragraphStyle}>
            シンボルには以下の5つの「属性」と3つの「レアリティ」があります。
          </p>
          <ul className="mb-3">
            <li className={listItemStyle}><strong>属性:</strong> 金属, 植物, 動物, 武器, 神秘</li>
            <li className={listItemStyle}><strong>レアリティ:</strong> コモン (Common), アンコモン (Uncommon), レア (Rare)</li>
          </ul>
          <h3 className="text-xl font-semibold text-yellow-300 mb-2 mt-4">ライン成立とメダル獲得</h3>
          <p className={paragraphStyle}>
            同じ<strong className="text-orange-300">属性</strong>のシンボルが縦・横・斜めに3つ揃うとライン成立となり、メダルを獲得できます。
            （シンボル自体が同じである必要はありません）。
            獲得メダル量は、ラインを構成するシンボルの効果 (<code className={codeStyle}>BM</code>系など) や、所持しているレリックの効果によって変化します。
          </p>
          {/* ここにスロット盤面の図や、ライン成立例の図を入れると分かりやすい */}
        </section>

        <section>
          <h2 className={sectionTitleStyle}>4. シンボルデッキ構築</h2>
          <p className={paragraphStyle}>
            毎スピン終了後、3つの新しいシンボルが提示され、その中から1つを選んで自分のデッキに加えることができます。
            スキップしてデッキ枚数を増やさない戦略も可能です。シンボルには様々な効果があり、デッキの組み合わせが重要になります。
          </p>
          <p className={paragraphStyle}>
            シンボルには強化システムはありません。強力なシンボルを獲得したり、不要なシンボルを削除したりしてデッキを最適化しましょう。
          </p>
        </section>

        <section>
          <h2 className={sectionTitleStyle}>5. スピンコストとレリック</h2>
          <p className={paragraphStyle}>
            スロットは5スピンごとに、回すのに必要なメダル（スピンコスト）が増加します。
            スピンコストが増加するタイミングで、複数の「レリック」の中から1つを選んで獲得できます。
            レリックは永続的なパッシブ効果を持ち、ゲームプレイを有利に進めるのに役立ちます。
          </p>
        </section>

        <section>
          <h2 className={sectionTitleStyle}>6. 敵との戦闘</h2>
          <p className={paragraphStyle}>
            10スピンごとに「敵」が出現します。敵はHPを持ち、毎スピン開始時に妨害効果を発動してきます。
          </p>
          <ul className="mb-3">
            <li className={listItemStyle}><strong>敵へのダメージ:</strong> スピンで獲得したメダル量がそのまま敵へのダメージになります。</li>
            <li className={listItemStyle}><strong>敵の撃破:</strong> 敵のHPを0にすると撃破成功です。</li>
            <li className={listItemStyle}><strong>撃破報酬:</strong> 敵を倒すと、デッキから不要なシンボルを1枚削除できる「シンボル削除チケット」を獲得できます。</li>
          </ul>
        </section>
        
        <section>
          <h2 className={sectionTitleStyle}>7. デッキ編集</h2>
          <p className={paragraphStyle}>
            「DECK EDIT」ボタンからデッキ編集画面を開けます。
            ここでは現在のデッキ内容を確認したり、「シンボル削除チケット」を使って不要なシンボルをデッキから取り除くことができます。
            デッキ圧縮は強力な戦略の一つです。
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
        <p>© KigaSlot. Enjoy the game!</p>
      </footer>
    </div>
  );
}