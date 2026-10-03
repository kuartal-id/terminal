import type { Envelope, NewsItem } from '../../../shared/types';
import { cache } from '../cache';
import { demoNews } from '../providers/demo';
import { FEEDS, fetchFeed } from '../providers/rss';

export async function getNews(opts: { region?: string; topic?: string; q?: string; limit?: number }): Promise<Envelope<NewsItem[]>> {
  const all = await cache.get('news:all', 3 * 60_000, async () => {
    const results = await Promise.allSettled(FEEDS.map(fetchFeed));
    const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    // De-duplicate by URL and by near-identical title.
    const seen = new Set<string>();
    const unique = items.filter((n) => {
      const k = n.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
      if (seen.has(n.id) || seen.has(k)) return false;
      seen.add(n.id);
      seen.add(k);
      return true;
    });
    unique.sort((a, b) => (a.published < b.published ? 1 : -1));
    return { items: unique.length ? unique : demoNews(), live: unique.length > 0, feedsOk: ok, feedsTotal: FEEDS.length };
  });
  let items = all.items;
  if (opts.region === 'id' || opts.region === 'global') items = items.filter((n) => n.region === opts.region);
  if (opts.topic) items = items.filter((n) => n.topics.includes(opts.topic!));
  if (opts.q) {
    const q = opts.q.toLowerCase();
    items = items.filter((n) => n.title.toLowerCase().includes(q) || n.source.toLowerCase().includes(q));
  }
  return {
    data: items.slice(0, opts.limit ?? 150),
    source: all.live ? 'live' : 'demo',
    provider: all.live ? `Public RSS feeds (${all.feedsOk}/${all.feedsTotal} reachable)` : 'Kuartal demo headlines',
    asOf: new Date().toISOString(),
  };
}
