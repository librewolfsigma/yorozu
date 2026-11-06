(() => {
  const gs = (el, p) => el ? getComputedStyle(el).getPropertyValue(p).trim() : null;
  const rgb2hex = (v) => {
    if (!v) return null;
    let m = v.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    if (!m) return v;
    const h = (n) => Number(n).toString(16).padStart(2, '0');
    return '#' + h(m[1]) + h(m[2]) + h(m[3]) + (m[4] && m[4] !== '1' ? h(Math.round(Number(m[4]) * 255)) : '');
  };
  const pick = (el) => el ? {
    tag: el.tagName.toLowerCase(),
    cls: (typeof el.className === 'string' ? el.className : '').slice(0, 60),
    text: (el.textContent || '').trim().slice(0, 24),
    bg: rgb2hex(gs(el, 'background-color')), color: rgb2hex(gs(el, 'color')),
    radius: gs(el, 'border-radius'), shadow: (gs(el, 'box-shadow') || '').slice(0, 90),
    border: (gs(el, 'border-top-width') + ' ' + gs(el, 'border-top-style') + ' ' + rgb2hex(gs(el, 'border-top-color'))),
    font: (gs(el, 'font-family') || '').split(',')[0], fw: gs(el, 'font-weight'), fs: gs(el, 'font-size'),
    pad: gs(el, 'padding'), gap: gs(el, 'gap'), h: Math.round(el.getBoundingClientRect().height)
  } : null;

  const out = { meta: {}, samples: {}, layout: {} };
  const r = document.documentElement;
  out.meta = { dir: r.getAttribute('dir'), theme: r.getAttribute('data-theme'), url: location.href, title: document.title, vw: innerWidth, vh: innerHeight };

  const hdr = document.querySelector('header') || document.querySelector('nav');
  out.samples.header = pick(hdr);
  if (hdr) { out.samples.header.pos = gs(hdr, 'position'); out.samples.header.backdrop = gs(hdr, 'backdrop-filter'); }
  out.samples.navLinks = [...document.querySelectorAll('header nav a, header a[class*=nav], .topnav a, nav[aria-label] a')].slice(0, 14).map(pick);
  out.samples.activeNav = [...document.querySelectorAll('[aria-current], .active, .is-active, [class*=active]')].slice(0, 6).map(pick);

  out.samples.cta = [...document.querySelectorAll('a, button')].filter(e => /بیا تو|ورود|همه/.test(e.textContent || '')).slice(0, 6).map(pick);

  out.samples.tabs = [...document.querySelectorAll('[role=tab]')].slice(0, 4).map(pick);
  out.samples.selectedTab = pick(document.querySelector('[role=tab][aria-selected=true]'));

  const cardA = document.querySelectorAll('a[href*="/title"], a[href*="/anime"], a[href*="/media"]');
  out.cardCount = cardA.length;
  out.samples.card = pick(cardA[0]);
  if (cardA[0]) {
    const img = cardA[0].querySelector('img');
    out.samples.cardImg = pick(img);
    if (img) { out.samples.cardImgSize = [Math.round(img.getBoundingClientRect().width), Math.round(img.getBoundingClientRect().height)]; out.samples.cardImgRadius = gs(img, 'border-radius'); }
  }

  out.layout.gridInfo = [...document.querySelectorAll('main [class*=grid], main [class*=row], main section')].slice(0, 10).map(el => {
    const cs = getComputedStyle(el);
    return { cls: (el.className || '').toString().slice(0, 40), display: cs.display, cols: cs.gridTemplateColumns.slice(0, 90), gap: cs.gap, pad: cs.padding };
  });

  const main = document.querySelector('main') || document.body;
  out.layout.mainWidth = Math.round(main.getBoundingClientRect().width);
  out.layout.mainMax = gs(main, 'max-width');
  out.layout.mainPad = gs(main, 'padding');

  out.samples.h1 = pick(document.querySelector('h1'));
  out.samples.h2 = [...document.querySelectorAll('h2')].slice(0, 3).map(pick);

  const foot = document.querySelector('footer');
  out.samples.footer = pick(foot);
  if (foot) { out.samples.footer.bg = rgb2hex(gs(foot, 'background-color')); out.samples.footer.border = rgb2hex(gs(foot, 'border-top-color')); }
  out.layout.scrollbarWidth = innerWidth - document.documentElement.clientWidth;

  return JSON.stringify(out, null, 1);
})()
