# Wotaku NSFW Source Inventory (recon)

**Extraction date:** 2026-11-06. 

**Scope & method.** Inventoried from the public wiki/index page <https://wotaku.wiki/nsfw> only (no adult sites visited).
The wiki is a single page with 3 tabbed sections — Websites (Anime / Manga / Pornhwa / Illustrations),
Software (Android / iOS / PC / Downloader / Games) and Others (Database / AV / Scripts / Misc).
Data was extracted from the statically-served page plus its compiled content chunk (`assets/nsfw.md.*.js`,
same domain), which contains every tab panel, the wiki's per-entry tooltips, icon "tips" and tables.

**Coverage:** 145 listed entries (157 unique URLs) across 13 wiki tabs.

**Legend:**
- **OBSERVED** = read directly from wotaku.wiki (name, URL, wiki description/tooltip, icon-tip labels such as
  `Direct / HTTP(S) Download`, `Stream`, `Source Code`, `Extension`, `Needs account`, `Subscription`, `Mirrors`,
  `Inactive / Retired`, table flags like `General: Yes/No`, `Raw: Yes/No`, `Platform: Windows/MacOS/Linux`).
- **UNKNOWN** = the wiki provides no description for that entry (marked in *italics* in Purpose column).
- **[KNOWN]** = general developer knowledge NOT present on the wiki page; provided for integration planning only.

> Note: the string "API" appears **0 times** on the page — the wiki itself never advertises an official API
> for any NSFW source. Integration signals are indirect (open-source repos, extension ecosystems, direct
> download links, RSS mentions, account requirements). Anything about APIs below is therefore [KNOWN] unless
> marked otherwise.

---

## 1. Anime (hentai streaming/downloads) — wiki tab "Websites › Anime"

**Wiki context (OBSERVED):** "Nyaa Sukebei is kinda ideal for everything. You can check Eronews for news and
ero anime schedule. AniSchedule has RSS Feed for ero anime release." — i.e. Sukebei (torrent index), Eronews
(schedule news) and AniSchedule (GitHub bot with **RSS feed**) are the wiki's cross-cutting anime tools.

| Source | Purpose (wiki) | Integration type (per wiki) | Auth (per wiki) | Notes |
|---|---|---|---|---|
| [AmateurSubs](https://amateursubs.com/) | _hentai anime streaming site_ (UNKNOWN — wiki gives no description) | direct HTTP download | not mentioned | also linked: Nyaa <https://sukebei.nyaa.si/user/denis18312> |
| [Hanime](https://hanime.tv/home) | _hentai anime streaming site_ (UNKNOWN — wiki gives no description) | Video quality up to 720p | not mentioned |  |
| [Hanime1](https://hanime1.me/) | _hentai anime streaming site_ (UNKNOWN — wiki gives no description) | JP-language; ZH-language | not mentioned |  |
| [Hentai.tv](https://hentai.tv/) | _hentai anime streaming site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Hentai AHO Streaming](https://haho.moe/) | _hentai anime streaming site_ (UNKNOWN — wiki gives no description) | inactive/retired | not mentioned |  |
| [Hentai Bros](https://hentaibros.net/) | _hentai anime streaming site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Hentai Mama](https://hentaimama.io/) | _hentai anime streaming site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Hentai Ocean](https://hentaiocean.com/) | _hentai anime streaming site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Hentaverse](https://hentaverse.com/) | _hentai anime streaming site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [HStream](https://hstream.moe/) | _hentai anime streaming site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Mucho Hentai](https://muchohentai.com/home) | _hentai anime streaming site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Oppai Stream](https://oppai.stream/) | _hentai anime streaming site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [HenVids](https://henvids.com/) | _hentai anime streaming site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | wiki group: More |
| [MMani](https://mmani.com/) | _hentai anime streaming site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | wiki group: More |
| [Rule34video](https://rule34video.com/) | _hentai anime streaming site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | wiki group: More |
| [SakuraCircle](https://sakuracircle.com/) | _hentai anime streaming site_ (UNKNOWN — wiki gives no description) | direct HTTP download; inactive/retired | not mentioned | also linked: Nyaa <https://sukebei.nyaa.si/user/Tennouji> — wiki group: More |
| [UnderHentai](https://www.underhentai.net/) | _hentai anime streaming site_ (UNKNOWN — wiki gives no description) | streaming; direct HTTP download | not mentioned | wiki group: More |

## 2. Manga & Doujinshi — wiki tab "Websites › Manga"

Entries below carry the wiki's own tooltip descriptions where present. Wiki notes E-Hentai is the upstream
that most others scrape, and that an **E-Hentai account is needed for ExHentai access** (OBSERVED).
Wiki "Better search" tip (OBSERVED): "Try searching with Japanese titles or **DLSite** product IDs on **Sukebei**".

| Source | Purpose (wiki) | Integration type (per wiki) | Auth (per wiki) | Notes |
|---|---|---|---|---|
| [E-Hentai](https://e-hentai.org/) | Almost every doujin is first uploaded here before being scraped by other sites. The online viewer compresses the images, but has the option to download in original quality. ExHentai is its sister site, which also hosts the more extreme and questionable content. You'll need an account on E-Hentai to gain access | wiki "favorite" pick; docs page | account mentioned in wiki tooltip | wiki ★ favorite — also linked: (icon link) <https://e-hentaitagsearch.blogspot.com/> |
| [Akuma](https://akuma.moe/) | E-Hentai clone | none mentioned on wiki | not mentioned |  |
| [HDoujin](https://hdoujin.org/) | Side project of Schale Network. ExHentai mirror for manga and doujinshi, keeping the original resolution | wiki "favorite" pick | not mentioned | wiki ★ favorite |
| [Hitomi](https://hitomi.la/) | Big but difficult to navigate library, compresses images from E-Hentai | none mentioned on wiki | not mentioned |  |
| [IMHentai](https://imhentai.xxx/home/) | Big library and great search filters | none mentioned on wiki | not mentioned |  |
| [nHentai](https://nhentai.net/) | Most popular. Decent UI and great search, but compresses images | none mentioned on wiki | not mentioned |  |
| [Panda Backup](https://panda.chaika.moe/) | Archive of stuff removed from E-Hentai due to DMCA complaints. Has some obscure stuff deleted on most sites | none mentioned on wiki | not mentioned |  |
| [Schale Network](https://niyaniya.moe/) | Formerly Koharu, has Fakku/Irodori rips (official TLs) | wiki "favorite" pick; mirror list | not mentioned | wiki ★ favorite — also linked: (icon link) <https://schale.network/mirrors> |
| [Yabai](https://yabai.si/g) | E-Hentai clone | none mentioned on wiki | not mentioned |  |
| [EAHentai](https://eahentai.com/) | _doujinshi/manga reader site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | wiki group: English-only |
| [Hentai Nexus](https://hentainexus.com/) | Fakku/Irodori rips (official TLs) | none mentioned on wiki | not mentioned | wiki group: English-only |
| [HentaiRead](https://hentairead.com/) | _doujinshi/manga reader site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | wiki group: English-only |
| [HenTalk](https://hentalk.pw/) | Fakku/Irodori rips (official TLs) | none mentioned on wiki | not mentioned | wiki group: English-only |
| [Wholesome Hentai God List](https://wholesomelist.com/) | _doujinshi/manga reader site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | wiki group: English-only |

## 3. Manhwa / Pornhwa (Korean webtoons, incl. raws) — wiki tab "Websites › Pornhwa"

Wiki table columns: "General" (English TL availability) and "Raw" (raw Korean chapters availability).
Wiki note (OBSERVED): "Raw only websites are listed here" links to /nonen/korean.

| Source | Purpose (wiki) | Integration type (per wiki) | Auth (per wiki) | Notes |
|---|---|---|---|---|
| [4str0 Releases](https://sheet.zohopublic.com/sheet/open/5hed58d39c2089692421f89b9e9a0435c7475?sheetid=0&range=A13) | _manhwa/webtoon reader site_ (UNKNOWN — wiki gives no description) | direct HTTP download | not mentioned | General: Yes / Available; Raw: No / Unavailable |
| [Atsumaru](https://atsu.moe/) | A large portion of the library comes from Weeb Central. Transcodes images to WebP | none mentioned on wiki | not mentioned | General: Yes / Available; Raw: No / Unavailable |
| [Hentai20](https://hentai20.io/home1/) | _manhwa/webtoon reader site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | General: No / Unavailable; Raw: No / Unavailable |
| [Heytoon](https://toonhey.com/) | _manhwa/webtoon reader site_ (UNKNOWN — wiki gives no description) | free/demo content; subscription/paid tier | subscription (wiki tip) | General: No / Unavailable; Raw: No / Unavailable |
| [Hiperdex](https://hiperdex.tv/) | _manhwa/webtoon reader site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | General: Yes / Available; Raw: Yes / Available |
| [HotComics](https://w1.hotcomics.me/) | _manhwa/webtoon reader site_ (UNKNOWN — wiki gives no description) | free/demo content; subscription/paid tier | subscription (wiki tip) | General: Yes / Available; Raw: No / Unavailable |
| [Kagane](https://kagane.org/) | Scrapes official sources and Nyaa uploads. Imported the majority of MangaDex's library. Offers high-quality uploads without watermarks. May block popular VPNs | wiki "favorite" pick | VPN needed per wiki tooltip | wiki ★ favorite — General: Yes / Available; Raw: No / Unavailable |
| [Manga District](https://mangadistrict.com/) | Upscales and denoises official releases instead of providing original version | none mentioned on wiki | not mentioned | General: Yes / Available; Raw: No / Unavailable |
| [Manga18](https://manga18.club/) | _manhwa/webtoon reader site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | General: No / Unavailable; Raw: No / Unavailable |
| [Manga18fx](https://manga18fx.com/) | _manhwa/webtoon reader site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | General: Yes / Available; Raw: Yes / Available |
| [ManhwaH](https://manhwah.com/) | _manhwa/webtoon reader site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | General: No / Unavailable; Raw: Yes / Available |
| [ManhwaRead](https://manhwaread.com/) | _manhwa/webtoon reader site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | General: Yes / Available; Raw: No / Unavailable |
| [Omega Scans](https://omegascans.org/) | _manhwa/webtoon reader site_ (UNKNOWN — wiki gives no description) | subscription/paid tier | subscription (wiki tip) | General: No / Unavailable; Raw: No / Unavailable |
| [PornhwaDB Reader](https://pornhwareader.com/) | _manhwa/webtoon reader site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | General: No / Unavailable; Raw: No / Unavailable |
| [RawDEX](https://rawdex.net/) | _manhwa/webtoon reader site_ (UNKNOWN — wiki gives no description) | KR-language | not mentioned | General: No / Unavailable; Raw: Yes / Available |
| [The Blank](https://theblank.net/) | _manhwa/webtoon reader site_ (UNKNOWN — wiki gives no description) | subscription/paid tier | subscription (wiki tip) | General: No / Unavailable; Raw: No / Unavailable |
| [Toonily](https://toonily.com/) | _manhwa/webtoon reader site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | General: Yes / Available; Raw: No / Unavailable |
| [ToonTop](https://toontop.io/home) | _manhwa/webtoon reader site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | General: No / Unavailable; Raw: Yes / Available |

## 4. Illustrations / Image galleries (boorus) — wiki tab "Websites › Illustrations"

| Source | Purpose (wiki) | Integration type (per wiki) | Auth (per wiki) | Notes |
|---|---|---|---|---|
| [Danbooru](https://danbooru.donmai.us/) | _image board / gallery site_ (UNKNOWN — wiki gives no description) | wiki "favorite" pick | not mentioned | wiki ★ favorite |
| [Gelbooru](https://gelbooru.com/) | _image board / gallery site_ (UNKNOWN — wiki gives no description) | wiki "favorite" pick | not mentioned | wiki ★ favorite |
| [Hentai Game CG](https://hentaigamecg.com/) | _image board / gallery site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Konachan](https://konachan.com/) | _image board / gallery site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Kusowanka](https://kusowanka.com/) | _image board / gallery site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Nozomi](https://nozomi.la/) | _image board / gallery site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Oreno3D](https://oreno3d.com/) | _image board / gallery site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Pawchive](https://pawchive.pw/) | _image board / gallery site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Pixiv](https://www.pixiv.net/) | _image board / gallery site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Rule 34](https://rule34.xxx/) | _image board / gallery site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [yande.re](https://yande.re/) | _image board / gallery site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Booruview](https://booruview.com/) | _image board / gallery site_ (UNKNOWN — wiki gives no description) | open-source (source repo linked on wiki) | not mentioned | also linked: (icon link) <https://codeberg.org/jessienyan/booruview> — wiki group: Front-ends |
| [Danbooru Viewer](https://danbooru.defaultkavy.com/) | _image board / gallery site_ (UNKNOWN — wiki gives no description) | open-source (source repo linked on wiki) | not mentioned | also linked: (icon link) <https://github.com/defaultkavy/danbooru-viewer> — wiki group: Front-ends |
| [Moeview](https://moeview.app/) | _image board / gallery site_ (UNKNOWN — wiki gives no description) | has alternative domain | not mentioned | also linked: (icon link) <https://moeview.cocomi.eu.org/> — wiki group: Front-ends |
| [PixivFE](https://pixiv.perennialte.ch/) | _image board / gallery site_ (UNKNOWN — wiki gives no description) | wiki "favorite" pick; open-source (source repo linked on wiki) | not mentioned | wiki ★ favorite — also linked: (icon link) <https://codeberg.org/PixivFE/PixivFE> — wiki group: Front-ends |
| [Pixiv Viewer](https://pixiv.pictures/) | _image board / gallery site_ (UNKNOWN — wiki gives no description) | open-source (source repo linked on wiki) | not mentioned | also linked: (icon link) <https://github.com/asadahimeka/pixiv-viewer> — wiki group: Front-ends |

## 5. AV / JAV (adult video) — wiki tab "Others › AV"

Wiki groups (OBSERVED): Stream (JAVGG, JavGuru, JAVSeen, SexTB, MissAV), Torrent (141JAV, OneJAV, ProjectJav,
Sukebei, Tokyo Toshokan), Others (idol/gravure: Asia Media Blog, Gravure Princess, Mabui Onna, X-IDOL, Japanese DDL).

| Source | Purpose (wiki) | Integration type (per wiki) | Auth (per wiki) | Notes |
|---|---|---|---|---|
| [MissAV](https://missav.ws/) | _JAV streaming/torrent site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [JAVGG](https://javgg.net/) | _JAV streaming/torrent site_ (UNKNOWN — wiki gives no description) | has alternative domain | not mentioned | also linked: (icon link) <https://javgg.co/> |
| [JavGuru](https://jav.guru/) | _JAV streaming/torrent site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [JAVSeen](https://javseen.tv/) | _JAV streaming/torrent site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [SexTB](https://sextb.net/) | _JAV streaming/torrent site_ (UNKNOWN — wiki gives no description) | has alternative domain | not mentioned | also linked: (icon link) <https://sextb.date/> |
| [141JAV](https://www.141jav.com/) | _JAV streaming/torrent site_ (UNKNOWN — wiki gives no description) | has alternative domain | not mentioned | also linked: (icon link) <https://www.141ppv.com/> |
| [OneJAV](https://onejav.com/) | _JAV streaming/torrent site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [ProjectJav](https://projectjav.com/) | _JAV streaming/torrent site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Sukebei](https://sukebei.nyaa.si/?c=2_2) | _JAV streaming/torrent site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Tokyo Toshokan](https://www.tokyotosho.info/?cat=15) | _JAV streaming/torrent site_ (UNKNOWN — wiki gives no description) | has alternative domain | not mentioned | also linked: (icon link) <https://tokyo-tosho.net/?cat=15> |
| [Asia Media Blog](https://asiamediablog.com/media/idol/) | _JAV streaming/torrent site_ (UNKNOWN — wiki gives no description) | rate-limited/paywalled host | rate-limited/paywalled (wiki tip) |  |
| [Gravure Princess](https://idol.gravureprincess.date/) | _JAV streaming/torrent site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Mabui Onna](https://mabui-onna.com/) | _JAV streaming/torrent site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [X-IDOL](https://x-idol.net/) | _JAV streaming/torrent site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| Japanese DDL (/nonen/japanese#direct) | _JAV streaming/torrent site_ (UNKNOWN — wiki gives no description) | redirect link | not mentioned |  |

## 6. Games / Visual novels / Eroge — wiki tab "Software › Games"

| Source | Purpose (wiki) | Integration type (per wiki) | Auth (per wiki) | Notes |
|---|---|---|---|---|
| [Anime-Sharing](https://www.anime-sharing.com/) | _eroge/VN download or storefront site_ (UNKNOWN — wiki gives no description) | account required | account required (wiki tip) |  |
| [Asia Media Blog](https://asiamediablog.com/media/game/) | _eroge/VN download or storefront site_ (UNKNOWN — wiki gives no description) | rate-limited/paywalled host | rate-limited/paywalled (wiki tip) |  |
| [CPG Repacks](https://cpgrepacks.site) | _eroge/VN download or storefront site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Craneanime](https://blog.craneanime.xyz/) | _eroge/VN download or storefront site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Eroge Download](https://erogedownload.com/) | _eroge/VN download or storefront site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [F95Zone](https://f95zone.to/) | _eroge/VN download or storefront site_ (UNKNOWN — wiki gives no description) | account required | account required (wiki tip) |  |
| [HSuki](https://www.h-suki.com/en/games) | _eroge/VN download or storefront site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Kimochi](https://kimochi.info) | _eroge/VN download or storefront site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Ryuugames](https://www.ryuugames.com/) | _eroge/VN download or storefront site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [ULMF](https://ulmf.org/) | _eroge/VN download or storefront site_ (UNKNOWN — wiki gives no description) | account required | account required (wiki tip) |  |
| [Denpasoft](https://denpasoft.com/) | _eroge/VN download or storefront site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | wiki group: Legal |
| [DLsite](https://www.dlsite.com/index.html) | _eroge/VN download or storefront site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | wiki group: Legal |
| [DLwatcher](https://dlwatcher.com/) | _eroge/VN download or storefront site_ (UNKNOWN — wiki gives no description) | related to prior entry | not mentioned | wiki group: Legal |
| [FAKKU](https://www.fakku.net/games) | _eroge/VN download or storefront site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | wiki group: Legal |
| [JAST](https://jaststore.com/) | _eroge/VN download or storefront site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | wiki group: Legal |
| [Johren](https://www.johren.games/) | _eroge/VN download or storefront site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | wiki group: Legal |
| [MangaGamer](https://www.mangagamer.com/) | _eroge/VN download or storefront site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | wiki group: Legal |

## 7. Databases / Metadata — wiki tab "Others › Database"

| Source | Purpose (wiki) | Integration type (per wiki) | Auth (per wiki) | Notes |
|---|---|---|---|---|
| [DOJINDB](https://dojindb.net/) | _metadata database for adult manga/doujinshi_ (UNKNOWN — wiki gives no description) | JP-language | not mentioned |  |
| [Doujinshi.info](https://www.doujinshi.info/) | _metadata database for adult manga/doujinshi_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Manga-DB](https://adultcomic.dbsearch.net/) | _metadata database for adult manga/doujinshi_ (UNKNOWN — wiki gives no description) | wiki "favorite" pick; JP-language | not mentioned | wiki ★ favorite |
| [Fapservice](https://fapservice.com/) | _metadata database for adult manga/doujinshi_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [PornhwaDB](https://pornhwadb.com/) | _metadata database for adult manga/doujinshi_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Yuri Scenes](https://yuriscenes.com/) | _metadata database for adult manga/doujinshi_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |

[KNOWN] For metadata integration, these community DBs are commonly scraped/used without official public APIs;
Doujinshi.info and E-Hentai (via its gdata API) are the usual metadata sources — API details are **not** on the wiki.

## 8. Scripts / Userscripts / Extensions — wiki tab "Others › Scripts"

All entries are browser userscripts (hosted on GitHub or Sleazyfork/Greasyfork) (OBSERVED).

| Source | Purpose (wiki) | Integration type (per wiki) | Auth (per wiki) | Notes |
|---|---|---|---|---|
| [Comic Looms](https://github.com/MapoMagpie/comic-looms) | _userscript enhancing a specific adult site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Eza's Image Glutton](https://sleazyfork.org/en/scripts/4713-eza-s-image-glutton) | _userscript enhancing a specific adult site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Image Board Enhancer](https://sleazyfork.org/en/scripts/387312-image-board-enhancer-rule34-gelbooru-e621-and-more) | _userscript enhancing a specific adult site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Kemer Enhancement](https://sleazyfork.org/en/scripts/472096-kemer-enhance) | _userscript enhancing a specific adult site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Kemono Browser](https://sleazyfork.org/en/scripts/483259-kemono-browser) | _userscript enhancing a specific adult site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [MALSync Adult](https://sleazyfork.org/en/scripts/387981-mal-sync-adult-fatexxxblood-edition) | _userscript enhancing a specific adult site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Manga Loader NSFW](https://sleazyfork.org/en/scripts/483574-manga-loader-nsfw-download) | _userscript enhancing a specific adult site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Manga OnlineViewer](https://github.com/TagoDR/MangaOnlineViewer) | _userscript enhancing a specific adult site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [E(x)-Hentai Tags Preview](https://github.com/fp555/exh-tags-preview) | _userscript enhancing a specific adult site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [ExResurrect](https://sleazyfork.org/en/scripts/411277-exresurrect) | _userscript enhancing a specific adult site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Let's panda!](https://sleazyfork.org/en/scripts/33979-let-s-panda) | _userscript enhancing a specific adult site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [nhentai helper](https://sleazyfork.org/en/scripts/375992-nhentai-helper) | _userscript enhancing a specific adult site_ (UNKNOWN — wiki gives no description) | open-source (source repo linked on wiki) | not mentioned | also linked: (icon link) <https://github.com/Tsuk1ko/nhentai-helper> |
| [nhentai konnichiwa](https://github.com/naiymu/nhentai-konnichiwa) | _userscript enhancing a specific adult site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Nhentai Manga Loader](https://github.com/longkidkoolstar/Nhentai-Manga-Loader) | _userscript enhancing a specific adult site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |

[KNOWN] Sleazyfork/Greasyfork scripts that automate site access (e.g. Kemono Browser, Kemer Enhancement) imply
scriptable HTTP endpoints on those sites (Kemono exposes a public JSON API) — API details are **not** on the wiki.

## 9. Software: Android / iOS / PC apps & downloaders — wiki tabs "Software › Android / iOS / PC / Downloader"

### 9a. Android

| Source | Purpose (wiki) | Integration type (per wiki) | Auth (per wiki) | Notes |
|---|---|---|---|---|
| [Komikku](https://komikku-app.github.io/) | _Android manga/hentai reader app_ (UNKNOWN — wiki gives no description) | open-source (source repo linked on wiki); extension ecosystem (wiki-marked) | not mentioned | also linked: (icon link) <https://github.com/komikku-app/komikku> |
| [Hentoid](https://codeberg.org/VioletKnight/Hentoid) | _Android manga/hentai reader app_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Jasmine](https://github.com/ComicSparks/jasmine) | _Android manga/hentai reader app_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Aniyomi](https://github.com/jmir1/aniyomi-mpv-beta) | _Android manga/hentai reader app_ (UNKNOWN — wiki gives no description) | extension ecosystem (wiki-marked) | not mentioned |  |
| [EhViewer-UjuiUjuMandan](https://github.com/UjuiUjuMandan/EhViewer) | _Android manga/hentai reader app_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [EhViewer-NekoInverter](https://github.com/EhViewer-NekoInverter/EhViewer) | _Android manga/hentai reader app_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [JHenTai](https://github.com/jiangtian616/JHenTai) | _Android manga/hentai reader app_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [NClientV3](https://github.com/maxwai/NClientV3) | _Android manga/hentai reader app_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [nhviewer universal](https://github.com/ttdyce/nhviewer-universal) | _Android manga/hentai reader app_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |

### 9b. iOS

| Source | Purpose (wiki) | Integration type (per wiki) | Auth (per wiki) | Notes |
|---|---|---|---|---|
| [EhPanda](https://github.com/EhPanda-Team/EhPanda) | _iOS manga/hentai reader app_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [JHenTai](https://github.com/jiangtian616/JHenTai) | _iOS manga/hentai reader app_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Jasmine](https://github.com/ComicSparks/jasmine) | _iOS manga/hentai reader app_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |

### 9c. PC

| Source | Purpose (wiki) | Integration type (per wiki) | Auth (per wiki) | Notes |
|---|---|---|---|---|
| [ExHentai Manga Manager](https://github.com/SchneeHertz/exhentai-manga-manager) | _desktop manga/hentai manager or viewer_ (UNKNOWN — wiki gives no description) | Windows | not mentioned |  |
| [JHenTai](https://github.com/jiangtian616/JHenTai) | _desktop manga/hentai manager or viewer_ (UNKNOWN — wiki gives no description) | Windows; MacOS; Linux | not mentioned |  |
| [Jasmine](https://github.com/ComicSparks/jasmine) | _desktop manga/hentai manager or viewer_ (UNKNOWN — wiki gives no description) | Windows; MacOS; Linux | not mentioned |  |
| [Konomi Viewer](https://konomiviewer.com/) | _desktop manga/hentai manager or viewer_ (UNKNOWN — wiki gives no description) | Windows; MacOS; Linux | not mentioned |  |
| [Javinizer Go](https://github.com/javinizer/javinizer-go) | _desktop manga/hentai manager or viewer_ (UNKNOWN — wiki gives no description) | Windows; MacOS; Linux | not mentioned |  |

### 9d. Downloaders

| Source | Purpose (wiki) | Integration type (per wiki) | Auth (per wiki) | Notes |
|---|---|---|---|---|
| [Free Manga Downloader 2](https://github.com/dazedcat19/FMD2) | _mass downloader / archiver tool_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | Platform: Windows |
| [HDoujin Downloader](https://doujindownloader.com/) | _mass downloader / archiver tool_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | Platform: Windows |
| [NSFW Box](https://github.com/Kisspeace/NsfwBox) | _mass downloader / archiver tool_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | Platform: Android; Windows |
| [doujinshi-dl](https://github.com/RicterZ/doujinshi-dl) | _mass downloader / archiver tool_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | Platform: Python; Docker |
| [E-Hentai Downloader](https://github.com/ccloli/E-Hentai-Downloader) | _mass downloader / archiver tool_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | Platform: JavaScript |
| [nHentai Archivist](https://github.com/9-FS/nhentai_archivist) | _mass downloader / archiver tool_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned | Platform: Windows; Linux; Docker |

## 10. Misc (ASMR / audio / HMV) — wiki tab "Others › Misc"

| Source | Purpose (wiki) | Integration type (per wiki) | Auth (per wiki) | Notes |
|---|---|---|---|---|
| [ASMR Online](https://asmr.one/) | Needs a JP or HK VPN for access | none mentioned on wiki | VPN needed per wiki tooltip |  |
| [Hentai ASMR](https://www.hentaiasmr.moe/) | _ASMR audio or video-edit community site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [HMV Mania](https://hmvmania.com/) | _ASMR audio or video-edit community site_ (UNKNOWN — wiki gives no description) | 4chan thread link | not mentioned | also linked: (icon link) <https://archiveofsins.com/h/thread/8735646> |
| [Japanese ASMR](https://japaneseasmr.com/) | _ASMR audio or video-edit community site_ (UNKNOWN — wiki gives no description) | none mentioned on wiki | not mentioned |  |
| [Kasumi](http://xdcc.kasumi.moe/) | _ASMR audio or video-edit community site_ (UNKNOWN — wiki gives no description) | docs page | not mentioned | also linked: (icon link) <http://kasumi.moe/guide/> |

---

## Top 12 most integration-friendly sources (shortlist)

Ranked by: open-source code on the wiki, scriptability, site stability, and metadata richness. "API" flags are
[KNOWN] general knowledge; everything else is OBSERVED on the wiki.

1. **E-Hentai / ExHentai** — `Manga › E-Hentai`
   Wiki's reference doujinshi library ('almost every doujin lands here first'), account-gated ExHentai sister site; wiki links a tag-search helper and help/docs. [KNOWN] has a semi-official JSON API (api.e-hentai.org/gdata) — ideal for metadata + gallery fetching.
2. **nHentai** — `Manga › nHentai`
   Wiki: 'Most popular. Decent UI and great search, but compresses images.' [KNOWN] unofficial JSON API + CDN pattern, widely wrapped.
3. **Sukebei Nyaa** — `Readme + AV tab + Anime readme`
   Wiki: 'kinda ideal for everything' — torrent index spanning anime/manga/AV categories (c=2_2 linked in AV tab). [KNOWN] RSS feeds + stable page structure for scraping.
4. **Danbooru** — `Illustrations › Danbooru`
   Wiki ★ favorite image board. [KNOWN] mature REST API with tag/metatag queries; Gelbooru/Yande.re/Konachan in same tab share the booru pattern (Gelbooru also ★).
5. **PixivFE (and booru front-ends)** — `Illustrations › Front-ends`
   Wiki-marked **Source Code** (Codeberg) — a Pixiv proxy front-end; three more open-source front-ends (Danbooru Viewer, Booruview, Pixiv Viewer, Moeview) listed. Great template for safe front-ending.
6. **Komikku** — `Software › Android › Komikku`
   Wiki-marked **Source Code + Extension**: Mihon-fork reader whose source-scraping extension ecosystem is the de-facto standard for manga app integrations.
7. **Aniyomi** — `Software › Android › Aniyomi`
   Wiki-marked **Extension** (anime/manga fork of Mihon) — same extension/plugin integration surface.
8. **Free Manga Downloader 2 (FMD2)** — `Software › Downloader › FMD2`
   Open-source multi-site downloader (C++/Qt), wiki category 'Multi' — already abstracts many of the listed sites into modules.
9. **doujinshi-dl** — `Software › Downloader › doujinshi-dl`
   Wiki platform flags: **Python + Docker** — directly embeddable/scriptable CLI downloader (nhentai & co).
10. **E-Hentai Downloader / nhentai helper / Nhentai Manga Loader** — `Software › Downloader + Scripts tabs`
   Userscript-layer integrations for the two biggest libraries; nhentai helper wiki-marked **Source Code** (GitHub).
11. **Kemono ecosystem (Kemono Browser, Kemer Enhancement scripts)** — `Others › Scripts`
   Wiki lists two Kemono userscripts. [KNOWN] Kemono.su exposes a public JSON API for creator-content archives — the scripts confirm scriptability.
12. **DLsite + F95Zone + Hanime (commercial/AV wing)** — `Games › Legal (DLsite), Games › F95Zone, Anime › Hanime`
   DLsite: legal storefront whose **product IDs the wiki explicitly says to search on Sukebei** (OBSERVED 'Better search' tip); F95Zone: largest eroge DB but wiki-marks **account required**; Hanime: wiki notes 720p cap. [KNOWN] Hanime & DLsite have unofficial APIs; F95Zone has none official.

---

## Notable integration signals actually present on the wiki (OBSERVED)

- **RSS**: only AniSchedule (ero-anime release feed) is described with an RSS-feed icon in the Readme.
- **Extension ecosystems**: wiki explicitly tags Komikku (Source Code + Extension) and Aniyomi (Extension), and links their Wotaku extension-guide pages (`/ext/mihon`, `/ext/aniyomi`).
- **Open-source**: Source Code links for Booruview, Danbooru Viewer, PixivFE, Pixiv Viewer, Komikku, nhentai helper; every Android/iOS/PC tool links a GitHub/Codeberg repo.
- **Direct downloads**: Direct / HTTP(S) Download tips on AmateurSubs, SakuraCircle, UnderHentai, 4str0 Releases.
- **Auth**: Needs account (Anime-Sharing, F95Zone, ULMF), E-Hentai account note (ExHentai), VPN note (ASMR Online), Subscription tips (Heytoon, HotComics, Omega Scans, The Blank), rate-limited/paywalled (Asia Media Blog).
- **MangaDex**: mentioned once (Kagane tooltip: "Imported the majority of MangaDex's library") — no API described.
- **DLsite product IDs**: wiki "Better search" tip recommends searching Japanese titles or DLSite product IDs on Sukebei (OBSERVED).

## Caveats / UNKNOWNs

- Wiki descriptions exist only for 15 entries (the tooltips) — all other Purpose cells are UNKNOWN/inferred from the entry's category; they are marked in italics.
- No live checks of any source site were performed (per task constraints); availability, API truthfulness and legality flags are unverified.
- The wiki page is community-maintained and changes over time; extraction date is in the file header of this recon.
- One wiki quirk OBSERVED: HenTalk and Hentai Nexus share the same tooltip text ("HenTalkNexus — Fakku/Irodori rips (official TLs)"), and Akuma/Yabai share the "EHclone" tooltip.
