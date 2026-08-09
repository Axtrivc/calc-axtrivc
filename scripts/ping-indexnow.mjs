/**
 * Fetch each subdomain's sitemap.xml, extract all <loc> URLs, and send
 * batch IndexNow ping requests (one batch per subdomain, chunked to 10k).
 *
 * Usage:
 *   node scripts/ping-indexnow.mjs            # live run
 *   node scripts/ping-indexnow.mjs --dry-run  # fetch + parse only, no POST
 *
 * IndexNow docs: https://www.indexnow.org/documentation
 *   - Max 10,000 URLs per request
 *   - Key file must be served at https://<host>/<key>.txt
 */

const INDEX_NOW_KEY = 'bb9f85e2e6034c4896427c2ef43c6281';
const INDEX_NOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS_PER_REQUEST = 10000;

const SUBDOMAINS = [
  'https://calc.axtrivc.com',
  'https://toolhub.axtrivc.com',
  'https://ca7.axtrivc.com',
];

const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch text content with a User-Agent header, throwing on non-2xx. */
async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'axtrivc-indexnow-pinger/1.0 (+https://axtrivc.com)' },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} fetching ${url}`);
  }
  return res.text();
}

/**
 * Recursively resolve a sitemap (or sitemap index) into a flat list of page URLs.
 *
 * - <sitemapindex> → children are <sitemap><loc> pointing at nested sitemaps → recurse.
 * - <urlset>       → children are <url><loc> pointing at real pages → collect.
 *
 * Guarded against infinite loops via a depth + visited set.
 */
async function extractUrlsFromSitemap(sitemapUrl, { visited = new Set(), depth = 0 } = {}) {
  if (depth > 5) {
    console.warn(`  ! Max depth reached at ${sitemapUrl}, skipping further nesting`);
    return [];
  }
  if (visited.has(sitemapUrl)) return [];
  visited.add(sitemapUrl);

  let xml;
  try {
    xml = await fetchText(sitemapUrl);
  } catch (err) {
    console.warn(`  ! Failed to fetch sitemap ${sitemapUrl}: ${err.message}`);
    return [];
  }

  const locMatches = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi)).map((m) =>
    m[1].trim()
  );

  const isIndex = /<sitemapindex[\s>]/i.test(xml);

  if (isIndex) {
    // Each <loc> is a nested sitemap URL — recurse.
    let all = [];
    for (const childUrl of locMatches) {
      const childUrls = await extractUrlsFromSitemap(childUrl, { visited, depth: depth + 1 });
      all = all.concat(childUrls);
    }
    return all;
  }

  // urlset: every <loc> is a real page URL.
  return locMatches;
}

/** Strip URL to host for IndexNow `host` field (lowercase, no port, no www-stripping). */
function getHost(originUrl) {
  return new URL(originUrl).host;
}

/** Send one IndexNow batch POST for a chunk of URLs. Returns HTTP status. */
async function pingIndexNow(host, urlList) {
  const payload = {
    host,
    key: INDEX_NOW_KEY,
    keyLocation: `https://${host}/${INDEX_NOW_KEY}.txt`,
    urlList,
  };

  const res = await fetch(INDEX_NOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });

  // IndexNow returns 200 (processed) or 202 (accepted, queued).
  // 4xx = bad payload / key validation failed; 422 = validation rejected; 429 = rate limited.
  const ok = res.status === 200 || res.status === 202;
  const body = await res.text().catch(() => '');
  return { status: res.status, ok, body };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const fmt = (n) => n.toLocaleString('en-US');

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(
    DRY_RUN
      ? '=== IndexNow ping (DRY RUN — no POST) ===\n'
      : '=== IndexNow ping ===\n'
  );

  const summary = [];

  for (const origin of SUBDOMAINS) {
    const host = getHost(origin);
    console.log(`▶ ${origin}  (host: ${host})`);

    const sitemapUrl = `${origin}/sitemap.xml`;
    console.log(`  Fetching ${sitemapUrl} ...`);
    const urls = await extractUrlsFromSitemap(sitemapUrl);
    const deduped = Array.from(new Set(urls));

    if (deduped.length === 0) {
      console.log(`  ⚠ No URLs found. Skipping.\n`);
      summary.push({ host, found: 0, submitted: 0, ok: false, status: null });
      continue;
    }

    console.log(`  Found ${fmt(deduped.length)} URL(s).`);

    if (DRY_RUN) {
      deduped.slice(0, 5).forEach((u) => console.log(`     · ${u}`));
      if (deduped.length > 5) console.log(`     … and ${fmt(deduped.length - 5)} more`);
      console.log(`  (dry-run: would POST ${fmt(deduped.length)} URL(s) to IndexNow)\n`);
      summary.push({ host, found: deduped.length, submitted: 0, ok: null, status: null });
      continue;
    }

    // Chunk + POST
    const chunks = chunk(deduped, MAX_URLS_PER_REQUEST);
    let totalSubmitted = 0;
    let allOk = true;
    const statuses = [];

    for (let i = 0; i < chunks.length; i++) {
      const batch = chunks[i];
      try {
        const { status, ok, body } = await pingIndexNow(host, batch);
        statuses.push(status);
        totalSubmitted += batch.length;

        if (ok) {
          console.log(
            `  ✅ Batch ${i + 1}/${chunks.length}: HTTP ${status} — submitted ${fmt(batch.length)} URL(s)`
          );
        } else {
          allOk = false;
          console.log(
            `  ❌ Batch ${i + 1}/${chunks.length}: HTTP ${status} — ${body || 'no response body'}`
          );
        }
      } catch (err) {
        allOk = false;
        console.log(`  ❌ Batch ${i + 1}/${chunks.length}: network error — ${err.message}`);
      }
    }

    console.log(
      `  → ${host}: ${allOk ? 'OK' : 'PARTIAL/FAILED'} (status: ${statuses.join(', ')}, submitted ${fmt(totalSubmitted)}/${fmt(deduped.length)})\n`
    );
    summary.push({ host, found: deduped.length, submitted: totalSubmitted, ok: allOk, status: statuses.join(', ') });
  }

  // Final summary table
  console.log('=== Summary ===');
  for (const s of summary) {
    const state = s.ok === null ? 'DRY-RUN' : s.ok ? 'OK ' : 'FAIL';
    console.log(
      `  [${state}] ${s.host.padEnd(28)} found=${fmt(s.found).padStart(6)}  submitted=${fmt(s.submitted).padStart(6)}  status=${s.status ?? '-'}`
    );
  }

  const anyFailed = summary.some((s) => s.ok === false);
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
