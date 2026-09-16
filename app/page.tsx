import Link from "next/link";

/**
 * Category picker shell.
 * Visuals live in /public/ui/hub/hub.css — replace that CSS (and this markup classes) for the real UI.
 * Do not move game logic here; Category 1/2 run from /public/logic + /public/ui/category*.
 */
export default function Page() {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;600;700&display=swap"
        rel="stylesheet"
      />
      <link href="/ui/hub/hub.css" rel="stylesheet" />
      <main className="hub">
        <div className="hub-inner">
          <p className="hub-brand">Checktrail</p>
          <h1 className="hub-title">Pick a category</h1>
          <p className="hub-sub">
            Hosts choose the game first, then create a room. Friends who get your
            invite link join that room directly.
          </p>

          <div className="hub-grid">
            <Link href="/game.html?host=1" className="hub-card hub-card--c1">
              <span className="hub-card-eyebrow">Category 1</span>
              <span className="hub-card-name">Anon Wheel</span>
              <span className="hub-card-desc">
                Secret questions, spinning wheel, rapid-fire finale
              </span>
            </Link>

            <Link href="/category2.html?host=1" className="hub-card hub-card--c2">
              <span className="hub-card-eyebrow">Category 2</span>
              <span className="hub-card-name">Mirror Vote</span>
              <span className="hub-card-desc">
                Shuffled “most likely” votes, charts, and your trait portrait
              </span>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
