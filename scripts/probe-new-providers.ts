const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const H = { "User-Agent": UA, Accept: "*/*" };
const execFile = (await import("node:child_process")).execFile;
const run = (cmd: string, args: string[]) => new Promise<string>((res, rej) => execFile(cmd, args, { maxBuffer: 32 * 1024 * 1024, timeout: 30000 }, (e: any, out: any, err: any) => e ? rej(new Error(String(err || e.message).slice(0, 150))) : res(String(out))));

// A. EPORNER — try older/most-popular videos for hash
try {
  const r = await fetch("https://www.eporner.com/api/v2/video/search/?query=pmv&per_page=5&order=top-weekly&gay=0&sm=0&format=json", { headers: H });
  const j: any = await r.json();
  console.log("EPORNER top-weekly:", r.status, "n:", j.videos?.length);
  for (const v of (j.videos ?? []).slice(0, 3)) {
    const page = await fetch(v.url, { headers: H });
    const html = await page.text();
    // look for any hash-like assignment
    const hashes = [...html.matchAll(/([0-9a-f]{32})/g)].map(m => m[1]);
    const hashVar = html.match(/hash\s*[:=]\s*["']([0-9a-f]{32})["']/)?.[1];
    const conf = html.match(/conf\s*[:=]\s*["']([0-9a-f]{32})["']/)?.[1] ?? html.match(/["']conf["']\s*:\s*["']([0-9a-f]{32})["']/)?.[1];
    console.log(`  ${v.id} (${v.length_min}): page ${page.status} ${html.length}b | hashVar:${hashVar} | conf:${conf} | unique32hex:${[...new Set(hashes)].length}`);
    const hv = hashVar ?? conf;
    if (hv) {
      const parts = hv.match(/(.{8})(.{8})(.{8})(.{8})/);
      const c = [parts![1], parts![2], parts![3], parts![4]].map(x => parseInt(x, 16).toString(36)).join("");
      const xhr = await fetch(`https://www.eporner.com/xhr/video/${v.id}?hash=${c}&device=generic&domain=www.eporner.com`, { headers: H });
      const xj: any = await xhr.json();
      console.log(`    xhr: ${xhr.status} | sources.mp4[0]:`, JSON.stringify(xj.sources?.mp4)?.slice(0, 200));
      console.log(`    sources.hls:`, JSON.stringify(xj.sources?.hls)?.slice(0, 150));
      break;
    }
  }
} catch (e) { console.log("EPORNER ERR:", String(e).slice(0, 200)); }

// B. XVIDEOS — inspect actual link format
try {
  const r = await fetch("https://www.xvideos.com/?k=jav", { headers: { ...H, Accept: "text/html" } });
  const html = await r.text();
  const allVideoRefs = [...new Set([...html.matchAll(/((?:https:\/\/www\.xvideos\.com)?\/video[.\-][a-z0-9_]+\/?[^"'\s<)]*)/gi)].map(m => m[1]))].slice(0, 5);
  console.log("\nXVIDEOS refs:", allVideoRefs);
  if (allVideoRefs[0]) {
    const u = allVideoRefs[0].startsWith("http") ? allVideoRefs[0] : `https://www.xvideos.com${allVideoRefs[0]}`;
    const p = await fetch(u, { headers: { ...H, Accept: "text/html" } });
    const ph = await p.text();
    console.log("  page:", p.status, ph.length, "b |", ph.match(/<title>([^<]+)/)?.[1]?.slice(0, 70));
    for (const fn of ["setVideoUrlHigh", "setVideoUrlLow", "setVideoHLS", "setVideoUrlAlternate"]) {
      const m = ph.match(new RegExp(fn + "\\('(https://[^']+)'\\)"));
      if (m) console.log(`  ${fn}:`, m[1].slice(0, 110));
    }
    console.log("  html5player:", ph.match(/html5player\.setVideoTitle\('([^']*)'\)/)?.[1]?.slice(0, 70));
    console.log("  thumb:", ph.match(/setThumbUrl169\('([^']+)'\)/)?.[1]?.slice(0, 100));
  }
} catch (e) { console.log("XVIDEOS ERR:", String(e).slice(0, 200)); }

// C. HANIME + JAVDB via curl transport
try {
  const out = await run("curl", ["-sS", "-o", "/dev/null", "-w", "%{http_code} %{size_download}", "-A", UA, "--max-time", "20", "https://hanime1.me/"]);
  console.log("\nHANIME curl:", out);
  const out2 = await run("curl", ["-sS", "-o", "/dev/null", "-w", "%{http_code} %{size_download}", "-A", UA, "--max-time", "20", "https://javdb.com/search?q=SSIS-700&f=all"]);
  console.log("JAVDB curl:", out2);
  const out3 = await run("curl", ["-sS", "-o", "/dev/null", "-w", "%{http_code} %{size_download}", "-A", UA, "--max-time", "20", "https://rule34video.com/"]);
  console.log("RULE34VIDEO curl:", out3);
} catch (e) { console.log("CURL ERR:", String(e).slice(0, 200)); }
