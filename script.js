// ============================================================
// ИСТОЧНИК КУРСОВ
// ------------------------------------------------------------
// Вставьте сюда ссылку вашей Google-таблицы, опубликованной как CSV
// (File → Share → Publish to web → Entire document → CSV).
// Если оставить пустым — сайт будет читать локальный rates.json.
// ============================================================
const SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDCEbp-Cb8NYfJFrC6B-134NkB3-u4gsgl-7-JJ1flwVgRBGBZZkkhziX1sw6NygleBcr_r5GtMs6R/pub?gid=0&single=true&output=csv"

// Запасные курсы, если ни один источник не доступен.
let RATES = {
  RUB: 295,
  CNY: 3480,
  USDT: 25350,
  USD: 25400
};
let RATES_NOTE = "Финальный курс уточняйте в Telegram перед сделкой.";
let RATES_UPDATED = null;

const amountFrom = document.getElementById('amountFrom');
const currencyFrom = document.getElementById('currencyFrom');
const amountTo = document.getElementById('amountTo');
const calcRate = document.getElementById('calcRate');
const updatedEl = document.getElementById('ratesUpdated');

function formatVND(n) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n));
}

function renderRates() {
  document.querySelectorAll('.rate__val').forEach(el => {
    const code = el.dataset.code;
    if (RATES[code] != null) el.textContent = formatVND(RATES[code]);
  });
  if (updatedEl) {
    const dateStr = RATES_UPDATED
      ? new Date(RATES_UPDATED).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
      : new Date().toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });
    updatedEl.textContent = `Обновлено: ${dateStr}. ${RATES_NOTE}`;
  }
}

// Тиры фиксированной комиссии (в донгах).
// Если сумма меньше `max` — применяется соответствующая `fee`.
// Для CNY и USD используем пересчёт в RUB через курсы.
const FEE_TIERS = {
  RUB:  [ { max: 10000, fee: 120000 }, { max: 20000, fee: 80000 } ],
  USDT: [ { max: 200,   fee: 120000 }, { max: 350,   fee: 80000 } ],
};

// Бонус к курсу для крупных сумм (прибавляется к rate).
const RATE_BONUS = {
  RUB:  [ { min: 100000, bonus: 2 } ],
  USDT: [ { min: 1200,   bonus: 100 } ],
};

function getFee(code, amount) {
  let tiers = FEE_TIERS[code];
  let checkAmount = amount;
  if (!tiers) {
    tiers = FEE_TIERS.RUB;
    if (RATES[code] && RATES.RUB) checkAmount = amount * RATES[code] / RATES.RUB;
  }
  for (const t of tiers) {
    if (checkAmount < t.max) return t.fee;
  }
  return 0;
}

function getRateBonus(code, amount) {
  const tiers = RATE_BONUS[code];
  if (!tiers) return 0;
  let bonus = 0;
  for (const t of tiers) {
    if (amount >= t.min) bonus = t.bonus;
  }
  return bonus;
}

function recalc() {
  const amt = parseFloat(amountFrom.value) || 0;
  const code = currencyFrom.value;
  const baseRate = RATES[code];
  if (baseRate == null) return;
  const bonus = getRateBonus(code, amt);
  const rate = baseRate + bonus;
  const gross = amt * rate;
  const fee = getFee(code, amt);
  const net = Math.max(0, gross - fee);
  amountTo.value = formatVND(net) + ' ₫';

  if (fee > 0 && amt > 0) {
    calcRate.innerHTML = `Курс: 1 ${code} = ${formatVND(rate)} ₫ · <a href="https://t.me/vncash_danang" target="_blank" rel="noopener" style="color:#e11d48;text-decoration:underline">на маленькие суммы действует фикс. комиссия — уточнить в Telegram</a>`;
  } else if (bonus > 0) {
    calcRate.innerHTML = `Курс: 1 ${code} = ${formatVND(rate)} ₫ · <b style="color:#16a34a">улучшенный курс для крупной суммы 🎉</b>`;
  } else {
    calcRate.textContent = `Курс: 1 ${code} = ${formatVND(rate)} ₫ · без комиссии ✅`;
  }
}

// Парсер CSV из Google Sheets.
// Ожидаемый формат таблицы:
//   code,rate
//   RUB,295
//   CNY,3480
//   USDT,25350
//   USD,25400
//   note,Ваш текст          (необязательно)
//   updated,2026-04-24      (необязательно)
function parseCSV(text) {
  // убираем BOM, который Google иногда добавляет в начало файла
  text = text.replace(/^\uFEFF/, '');
  const lines = text.trim().split(/\r?\n/);
  const out = { rates: {} };
  for (let i = 0; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cells.length < 2) continue;
    const key = cells[0];
    const value = cells.slice(1).join(',').trim();
    if (!key) continue;
    const lowerKey = key.toLowerCase();
    // пропускаем заголовочные строки (любые нечисловые заголовки)
    if (lowerKey === 'code' || lowerKey === 'валюта' || lowerKey === 'currency') continue;
    if (lowerKey === 'note' || lowerKey === 'коммент' || lowerKey === 'комментарий') { out.note = value; continue; }
    if (lowerKey === 'updated' || lowerKey === 'обновлено' || lowerKey === 'дата') { out.updated = value; continue; }
    // число может быть с пробелами (1 000) или запятой (1,5)
    const n = parseFloat(value.replace(/\s+/g, '').replace(',', '.'));
    if (!isNaN(n)) out.rates[key.toUpperCase()] = n;
  }
  return out;
}

async function loadFromSheets() {
  if (!SHEETS_CSV_URL) return false;
  const url = `${SHEETS_CSV_URL}${SHEETS_CSV_URL.includes('?') ? '&' : '?'}_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('sheets fetch failed: HTTP ' + res.status);
  const text = await res.text();
  console.log('[rates] CSV получен:\n' + text);
  const data = parseCSV(text);
  console.log('[rates] распарсено:', data);
  if (!data.rates || !Object.keys(data.rates).length) {
    console.warn('[rates] в CSV не найдено ни одного курса — проверьте формат таблицы (две колонки: код валюты и число)');
    return false;
  }
  RATES = { ...RATES, ...data.rates };
  if (data.note) RATES_NOTE = data.note;
  if (data.updated) RATES_UPDATED = data.updated;
  return true;
}

async function loadFromJSON() {
  const res = await fetch(`rates.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('json fetch failed');
  const data = await res.json();
  if (data.rates) RATES = { ...RATES, ...data.rates };
  if (data.note) RATES_NOTE = data.note;
  if (data.updated) RATES_UPDATED = data.updated;
}

async function loadRates() {
  try {
    if (!(await loadFromSheets())) await loadFromJSON();
  } catch (e) {
    try { await loadFromJSON(); }
    catch (_) { console.warn('Курсы не загружены — использую значения по умолчанию'); }
  }
  renderRates();
  recalc();
}

amountFrom.addEventListener('input', recalc);
currencyFrom.addEventListener('change', recalc);
loadRates();
setInterval(loadRates, 5 * 60 * 1000); // перечитывать каждые 5 минут

document.getElementById('year').textContent = new Date().getFullYear();

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length > 1) {
      const el = document.querySelector(id);
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }
  });
});

document.querySelector('.burger')?.addEventListener('click', () => {
  document.querySelector('#contacts')?.scrollIntoView({ behavior: 'smooth' });
});
