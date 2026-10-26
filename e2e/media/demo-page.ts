/** A made-up shop page for the demo video: a header, panels on both sides, a footer. */
const TOMATO = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
  <rect width="320" height="200" rx="18" fill="#e9f7ef"/>
  <path d="M160 190 C150 140 170 110 160 60" stroke="#2f855a" stroke-width="8" fill="none"/>
  <path d="M160 110 C120 100 105 80 100 60 M160 90 C200 85 215 65 222 45" stroke="#38a169" stroke-width="6" fill="none"/>
  <circle cx="112" cy="128" r="30" fill="#e53e3e"/><circle cx="205" cy="120" r="34" fill="#c53030"/>
  <circle cx="160" cy="150" r="26" fill="#f56565"/></svg>`)}`

export const DEMO_PAGE = `<!doctype html>
<html lang="en"><head><title>Green Leaf Garden</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font: 18px/1.5 "Segoe UI", system-ui, sans-serif; color: #1a202c; background: #f7fafc;
    display: grid; grid-template: auto 1fr auto / 230px 1fr 260px; min-height: 100vh; }
  header { grid-column: 1 / 4; display: flex; align-items: center; gap: 20px; padding: 14px 28px;
    background: linear-gradient(90deg, #22543d, #2f855a); color: #fff; }
  header .logo { font-weight: 800; font-size: 24px; color: #fff; text-decoration: none; }
  header input { flex: 1; max-width: 420px; padding: 8px 14px; border-radius: 999px; border: 0; font: inherit; }
  header nav a { color: #e6fffa; margin-left: 16px; text-decoration: none; }
  nav.side { padding: 24px; background: #fff; border-right: 1px solid #e2e8f0; }
  nav.side h2, aside h2 { font-size: 15px; letter-spacing: .08em; text-transform: uppercase; color: #718096; margin: 0 0 12px; }
  nav.side a { display: block; padding: 8px 12px; margin-bottom: 6px; border-radius: 10px; color: #22543d;
    text-decoration: none; background: #f0fff4; }
  main { padding: 28px 40px 400px; }
  main h1 { margin: 0 0 12px; font-size: 38px; }
  main img { width: 420px; border-radius: 18px; display: block; margin-bottom: 16px; }
  main p { max-width: 560px; margin: 0 0 16px; }
  .buttons { display: flex; gap: 14px; margin-top: 8px; }
  button { font: 600 18px "Segoe UI", sans-serif; padding: 12px 22px; border-radius: 12px; border: 0; cursor: pointer; }
  #basket { background: #2f855a; color: #fff; } #buy { background: #dd6b20; color: #fff; }
  aside { padding: 24px; background: #fffaf0; border-left: 1px solid #feebc8; }
  aside a { display: block; color: #c05621; margin-bottom: 8px; }
  footer { grid-column: 1 / 4; padding: 16px 28px; background: #1a202c; color: #a0aec0; }
  footer a { color: #e2e8f0; margin-right: 18px; }
</style></head>
<body>
  <header><a class="logo" href="/">Green Leaf</a><input type="search" aria-label="Search the shop" placeholder="Search plants">
    <nav aria-label="Shop"><a href="/seeds">Seeds</a><a href="/tools">Tools</a><a href="/help">Help</a></nav></header>
  <nav class="side" aria-label="Categories"><h2>Categories</h2><a href="/herbs">Herbs</a><a href="/fruit">Fruit</a><a href="/flowers">Flowers</a></nav>
  <main>
    <h1>Cherry tomatoes</h1>
    <img src="${TOMATO}" alt="A tomato plant with ripe red tomatoes">
    <p id="about">Sweet, easy to grow, and happy in a sunny pot on a balcony.</p>
    <p>Water every morning, and pick them when they are bright red.</p>
    <div class="buttons">
      <button id="basket" onclick="document.getElementById('status').textContent='Added to your basket'">Add to basket</button>
      <button id="buy" onclick="document.getElementById('status').textContent='Order placed'">Buy now</button>
    </div>
    <div id="status" role="status"></div>
  </main>
  <aside><h2>Offers</h2><a href="/pots">Half price pots</a><a href="/soil">Free compost</a></aside>
  <footer><a href="/contact">Contact</a><a href="/privacy">Privacy</a></footer>
</body></html>`

/**
 * What only the video shows: a visible pointer, the caption bar and the title cards. All of
 * it is hidden from assistive technology and lets the pointer through, so iBrowse ignores it.
 */
export const OVERLAY = `
  const style = document.createElement('style')
  style.textContent = \`
    #demo-cursor { position: fixed; z-index: 99999; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%;
      border: 4px solid #f6e05e; background: rgba(246,224,94,.25); box-shadow: 0 0 0 3px rgba(26,32,44,.5); pointer-events: none;
      left: -100px; top: -100px; transition: left .02s linear, top .02s linear; }
    #demo-caption { position: fixed; z-index: 99998; left: 50%; bottom: 34px; transform: translateX(-50%); max-width: 1100px;
      display: none; align-items: flex-start; gap: 14px; padding: 16px 24px; border-radius: 18px; background: rgba(17,24,39,.92);
      color: #fff; font: 500 24px/1.35 "Segoe UI", sans-serif; box-shadow: 0 12px 40px rgba(0,0,0,.35); pointer-events: none; }
    #demo-caption .who { flex: none; font: 800 14px "Segoe UI", sans-serif; letter-spacing: .12em; text-transform: uppercase;
      padding: 6px 10px; border-radius: 999px; margin-top: 3px; }
    .who.ibrowse { background: linear-gradient(90deg,#7c3aed,#db2777); }
    .who.you { background: linear-gradient(90deg,#f97316,#eab308); color: #1a202c; }
    .who.key { background: linear-gradient(90deg,#0ea5e9,#22c55e); color: #062b16; }
    #demo-note { position: fixed; z-index: 99998; right: 14px; bottom: 8px; color: #718096; font: 13px "Segoe UI", sans-serif; pointer-events: none; }
    #demo-card { position: fixed; inset: 0; z-index: 100000; display: none; flex-direction: column; align-items: center; justify-content: center;
      background: radial-gradient(circle at 25% 20%, #7c3aed, transparent 55%), radial-gradient(circle at 80% 80%, #db2777, transparent 50%), #111827;
      color: #fff; font-family: "Segoe UI", sans-serif; text-align: center; pointer-events: none; }
    #demo-card .eyebrow { font: 800 18px "Segoe UI"; letter-spacing: .3em; text-transform: uppercase; color: #fbcfe8; }
    #demo-card h1 { font-size: 92px; margin: 10px 0; letter-spacing: -.02em; }
    #demo-card p { font-size: 30px; margin: 0; color: #e9d5ff; max-width: 900px; }\`
  document.head.append(style)
  for (const id of ['demo-cursor', 'demo-caption', 'demo-note', 'demo-card']) {
    const el = document.createElement('div')
    el.id = id
    el.setAttribute('aria-hidden', 'true')
    document.body.append(el)
  }
  document.getElementById('demo-note').textContent = 'Demo recording: voice commands are simulated, and both voices are synthesised.'
  addEventListener('mousemove', (e) => {
    const c = document.getElementById('demo-cursor')
    c.style.left = e.clientX + 'px'
    c.style.top = e.clientY + 'px'
  }, true)
`
