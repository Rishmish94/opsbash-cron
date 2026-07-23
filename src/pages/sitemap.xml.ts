import { execSync } from 'node:child_process';
import { getCollection } from 'astro:content';

export const prerender = true;

const SITE = 'https://opsbash.com';

// Per-route SEO tuning + a real, git-derived fallback lastmod for pages that
// carry no date of their own (used only if `git log` can't be run, e.g. a
// shallow CI checkout with no history for the file).
const PAGE_CONFIG: Record<string, { priority: string; changefreq: string; fallback: string }> = {
  '/': { priority: '1.0', changefreq: 'weekly', fallback: '2026-07-10' },
  '/cron-builder': { priority: '0.9', changefreq: 'weekly', fallback: '2026-07-08' },
  '/cidr-calculator': { priority: '0.9', changefreq: 'weekly', fallback: '2026-07-08' },
  '/jwt-decoder': { priority: '0.9', changefreq: 'weekly', fallback: '2026-06-22' },
  '/json-yaml-converter': { priority: '0.9', changefreq: 'weekly', fallback: '2026-06-22' },
  '/chmod-calculator': { priority: '0.9', changefreq: 'weekly', fallback: '2026-06-22' },
  '/gitignore-generator': { priority: '0.9', changefreq: 'weekly', fallback: '2026-06-22' },
  '/docker-compose-converter': { priority: '0.9', changefreq: 'weekly', fallback: '2026-06-11' },
  '/timestamp-converter': { priority: '0.9', changefreq: 'weekly', fallback: '2026-06-22' },
  '/json-diff': { priority: '0.9', changefreq: 'weekly', fallback: '2026-07-08' },
  '/k8s-secret-decoder': { priority: '0.9', changefreq: 'weekly', fallback: '2026-07-08' },
  '/log-sanitiser': { priority: '0.9', changefreq: 'weekly', fallback: '2026-07-08' },
  '/base64': { priority: '0.9', changefreq: 'weekly', fallback: '2026-07-08' },
  '/cheatsheets': { priority: '0.9', changefreq: 'weekly', fallback: '2026-07-10' },
  '/blog': { priority: '0.8', changefreq: 'weekly', fallback: '2026-07-09' },
  '/about': { priority: '0.5', changefreq: 'monthly', fallback: '2026-07-08' },
  '/author/rishabh': { priority: '0.5', changefreq: 'monthly', fallback: '2026-07-08' },
  '/contact': { priority: '0.4', changefreq: 'monthly', fallback: '2026-07-08' },
  '/privacy-policy': { priority: '0.3', changefreq: 'yearly', fallback: '2026-07-08' },
  '/terms': { priority: '0.3', changefreq: 'yearly', fallback: '2026-07-08' },
};
const DEFAULT_CONFIG = { priority: '0.5', changefreq: 'monthly' };

const EXCLUDED_ROUTE_NAMES = new Set(['404']);

function gitLastMod(filePath: string, fallback: string): string {
  try {
    const out = execSync(`git log -1 --format=%ad --date=short -- "${filePath}"`, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    return out || fallback;
  } catch {
    return fallback;
  }
}

function fileToRoute(key: string): string {
  let route = key.replace(/^\/src\/pages/, '').replace(/\.astro$/, '');
  route = route.replace(/\/index$/, '');
  return route === '' ? '/' : route;
}

interface SitemapEntry {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
}

async function buildEntries(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];

  // Static, file-based routes — discovered from disk so new pages under
  // src/pages are picked up automatically instead of needing a manual list.
  const pageModules = import.meta.glob('/src/pages/**/*.astro');
  for (const key of Object.keys(pageModules)) {
    if (key.includes('[')) continue; // dynamic routes are handled separately below
    const route = fileToRoute(key);
    const name = route.replace(/^\//, '') || 'index';
    if (EXCLUDED_ROUTE_NAMES.has(name)) continue;

    const config = PAGE_CONFIG[route] ?? DEFAULT_CONFIG;
    const fallback = 'fallback' in config ? config.fallback : new Date().toISOString().slice(0, 10);
    const filePath = key.replace(/^\//, '');
    entries.push({
      loc: `${SITE}${route}`,
      lastmod: gitLastMod(filePath, fallback),
      changefreq: config.changefreq,
      priority: config.priority,
    });
  }

  // Cheat sheets — discovered from the data directory, dated from each
  // sheet's own `lastUpdated` field (the same date shown on the page).
  const cheatsheetModules = import.meta.glob('/src/data/cheatsheets/*.json', { eager: true }) as Record<
    string,
    { default: { slug?: string; lastUpdated: string } }
  >;
  for (const [key, mod] of Object.entries(cheatsheetModules)) {
    const slug = key.split('/').pop()!.replace(/\.json$/, '');
    entries.push({
      loc: `${SITE}/cheatsheets/${slug}`,
      lastmod: mod.default.lastUpdated,
      changefreq: 'weekly',
      priority: '0.8',
    });
  }

  // Blog posts — discovered from the content collection, dated from each
  // post's own frontmatter `date`.
  const posts = await getCollection('blog');
  for (const post of posts) {
    entries.push({
      loc: `${SITE}/blog/${post.data.slug}`,
      lastmod: post.data.date,
      changefreq: 'monthly',
      priority: '0.7',
    });
  }

  return entries;
}

export async function GET() {
  const entries = await buildEntries();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${e.loc}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
