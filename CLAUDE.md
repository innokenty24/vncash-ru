# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static marketing site for **VNCash Vietnam** — a currency exchange service operating in Vietnam (Dananag, Nha Trang) for a Russian-speaking audience. Deployed at **https://vncash.ru** via GitHub Pages from the `main` branch of `innokenty24/vncash-ru`.

Three pages: the main one-pager (`index.html`) plus two city landing pages, `nhatrang/` and `danang/`.

No build step. No package manager. Just plain HTML/CSS/JS edited in place and pushed to GitHub.

## Local development

`python -m http.server 8090` from the repo root, then open `http://localhost:8090`. Port 8080 is often already in use (a leftover background process), so prefer 8090 — that matches `.claude/launch.json` for the Claude Preview tool.

`file://` won't work: the `fetch()` calls to `rates.json` and the Google Sheets CSV are blocked by CORS without an HTTP server.

## Deploy

`git push` to `main`. GitHub Pages rebuilds in ~1 minute. CDN cache on `vncash.ru` can mask the new version for several minutes — append `?v=…` or hard-reload to bypass.

Custom domain is set by the `CNAME` file (contents: `vncash.ru`). Do not delete it — GitHub Pages re-creates it from this file. DNS A/AAAA records and a `www` CNAME live at reg.ru.

## How rates flow into the page

`script.js` tries three sources in this order on every page load, then again every 5 minutes:

1. **Google Sheets CSV** — `SHEETS_CSV_URL` at the top of `script.js`. The sheet is "Published to the web" as CSV, two-column format (`code,rate` plus optional `note` and `updated` rows). This is the production source — edits from the phone via Google Sheets propagate in ~5 min.
2. **`rates.json`** — local fallback. Same shape as the parsed Sheets data.
3. **Hardcoded `RATES` object** — last-ditch defaults if both fetches fail.

The CSV parser tolerates BOM, Russian header names (`Валюта`, `Курс`, `Обновлено`), and number formats with spaces/commas. If you change the sheet's column layout, update `parseCSV()`.

## City pages (`nhatrang/`, `danang/`)

Each is a standalone `index.html` that reuses `/styles.css` and `/script.js` by **root-absolute** path — relative paths break one directory down. They exist because Yandex sends ~300 impressions/month on queries like «курс донга к рублю на сегодня в нячанге», which the generic homepage title converted at roughly zero.

`script.js` is shared verbatim and assumes certain elements exist: it grabs `amountFrom`, `currencyFrom`, `amountTo`, `calcRate` unguarded and sets `#year`. Any new page must include the calculator block and the footer year span, or the script throws and the rate table stays empty. `.rate__val[data-code]` elements are filled by `renderRates()`; `#ratesUpdated` and the burger menu are optional (guarded).

Each city page carries its own `FAQPage` JSON-LD. Same rule as the homepage: the `acceptedAnswer.text` must match the visible `<details>` answer, so edit both together.

## Calculator pricing logic

Two pricing knobs in `script.js`:

- `FEE_TIERS` — fixed VND fee subtracted from output for small amounts. Defined per-currency for RUB and USDT; CNY/USD use the RUB tier converted via current rates.
- `RATE_BONUS` — additive bonus to the rate for large amounts (e.g. RUB ≥ 100k → +2 ₫/RUB, USDT ≥ 1200 → +100 ₫/USDT).

The calculator never displays the exact fee — the messaging is intentionally vague ("на маленькие суммы действует фикс. комиссия — уточнить в Telegram"). Don't add the fee number back to the UI without checking with the owner; this was a deliberate decision.

## Layout gotchas that were painful to debug

- **`overflow-x: clip` on `body`, not `hidden`.** Setting `overflow-x: hidden` on `html`/`body` breaks `position: sticky` on the header in Chrome. Use `clip`. See top of `styles.css`.
- **Grid children need `min-width: 0`.** `.hero__grid > *` has `min-width: 0` so long text doesn't blow the grid wider than its container on mobile. Without it, `.hero h1` (with non-breaking spaces) forces the column to 600+ px on a 375 px viewport.
- **Mobile menu** is a fullscreen overlay `<nav>` toggled by adding `.nav--open` to `<html>`. The burger button itself has `z-index: 101` so it stays clickable above the `z-index: 100` overlay. When `.nav--open` is set, the burger's `<span>` bars turn white via a CSS rule — otherwise they're invisible on the dark overlay.
- **Two Telegram CTA buttons live in the DOM** (`.header__cta` and `.nav__cta`). Desktop shows only `.header__cta`; mobile hides it and shows `.nav__cta` inside the open menu. The CSS rule `.nav a.nav__cta { display: none }` needs the extra specificity because `.btn { display: inline-flex }` is defined later and would otherwise win.

## SEO / verification files — don't move or rename

- `robots.txt` and `sitemap.xml` are referenced in Yandex.Webmaster and Google Search Console. Keep `sitemap.xml` clean of anchor URLs (`#rates` etc.) — search engines ignore them and Search Console reports them as noise.
- `yandex_456166cab07e8e5e.html` — Yandex ownership proof. Deleting it disconnects the site from Yandex.Webmaster.
- The `<meta name="yandex-verification">` in `index.html` is a redundant second verification method for the same thing.
- Google verification is DNS-only (`sc-domain:vncash.ru` property, TXT record at reg.ru). There is deliberately no `google-site-verification` meta tag — an empty one used to sit in `index.html` and verified nothing. Don't re-add it.
- When adding a page: put it in `sitemap.xml`, link it from `index.html` (an orphan page won't get crawled), and request indexing in both consoles. In a Google `sc-domain:` property the sitemap field rejects a relative path — submit the full `https://vncash.ru/sitemap.xml`.
- The Google Search Console verification is a DNS TXT record at reg.ru, not a file in the repo.

## Structured data

`index.html` `<head>` ships a JSON-LD `@graph` with `Organization`, `WebSite`, `FAQPage`, and `FinancialService`. The `FAQPage` mainEntity must stay in sync with the visible `<details>` blocks in the FAQ section — if you change the wording of an answer in the HTML, also update the corresponding `acceptedAnswer.text` in the JSON-LD, otherwise Google may flag inconsistent structured data.

## Asset notes

- `favicon.svg` and `og-cover.svg` are hand-written SVGs. The OG cover is referenced by absolute URL (`https://vncash.ru/og-cover.svg`) in meta tags — relative URLs don't work for crawler previews.
- Logo wordmark "VNCash Vietnam" appears in three places: header (`index.html`), footer (`index.html`), and `og-cover.svg`. All three need to change together if rebranding.

## What lives outside this repo

- **DNS** at reg.ru: 4× A records (185.199.108–111.153) and `www` CNAME to `innokenty24.github.io`, plus a TXT record for Google Search Console.
- **Google Sheet** with live rates (URL in `script.js`). The sheet must stay "Published to web as CSV" — re-publishing changes the URL.
- **Notion project page** "Обмен валют Вьетнам" — the owner's source of truth for the business itself.
