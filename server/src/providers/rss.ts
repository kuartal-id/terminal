import { XMLParser } from 'fast-xml-parser';
import type { NewsItem } from '../../../shared/types';
import { fetchText } from '../http';

/**
 * Free headline feeds. We only show title + link + source + time and send
 * readers to the publisher — the normal, intended use of a public RSS feed.
 * We never copy article bodies. Add/remove feeds here; a dead feed is skipped.
 */
export interface FeedDef {
  id: string;
  name: string;
  url: string;
  region: 'id' | 'global';
  topics: string[];
}

const FEED_LIST: FeedDef[] = [
  { id: 'cnbcid-market', name: 'CNBC Indonesia', url: 'https://www.cnbcindonesia.com/market/rss', region: 'id', topics: ['markets', 'idx'] },
  { id: 'cnbcid-news', name: 'CNBC Indonesia', url: 'https://www.cnbcindonesia.com/news/rss', region: 'id', topics: ['economy'] },
  { id: 'antara-ekonomi', name: 'Antara', url: 'https://www.antaranews.com/rss/ekonomi.xml', region: 'id', topics: ['economy'] },
  { id: 'tempo-bisnis', name: 'Tempo', url: 'https://rss.tempo.co/bisnis', region: 'id', topics: ['economy'] },
  { id: 'cnbc-top', name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', region: 'global', topics: ['markets'] },
  { id: 'cnbc-economy', name: 'CNBC', url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', region: 'global', topics: ['economy'] },
  { id: 'mw-top', name: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', region: 'global', topics: ['markets'] },
  { id: 'fed', name: 'Federal Reserve', url: 'https://www.federalreserve.gov/feeds/press_all.xml', region: 'global', topics: ['central-banks', 'rates'] },
  { id: 'ecb', name: 'ECB', url: 'https://www.ecb.europa.eu/rss/press.html', region: 'global', topics: ['central-banks', 'rates'] },
  { id: 'coindesk', name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', region: 'global', topics: ['crypto'] },
];

export const FEEDS: FeedDef[] = FEED_LIST.filter((f, i, arr) => arr.findIndex((g) => g.url === f.url) === i);

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });

function text(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object' && '#text' in (v as Record<string, unknown>)) return String((v as Record<string, unknown>)['#text']);
  return '';
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Parses RSS 2.0 and Atom. Pure — unit tested. */
export function parseFeed(xml: string, feed: FeedDef): NewsItem[] {
  const doc = parser.parse(xml);
  const rssItems = doc?.rss?.channel?.item;
  const atomItems = doc?.feed?.entry;
  const items: unknown[] = Array.isArray(rssItems) ? rssItems : rssItems ? [rssItems] : Array.isArray(atomItems) ? atomItems : atomItems ? [atomItems] : [];
  const out: NewsItem[] = [];
  for (const raw of items) {
    const it = raw as Record<string, unknown>;
    const title = decode(text(it.title));
    let url = text(it.link);
    if (!url && it.link && typeof it.link === 'object') {
      const links = Array.isArray(it.link) ? it.link : [it.link];
      const alt = (links as Record<string, string>[]).find((l) => !l['@_rel'] || l['@_rel'] === 'alternate');
      url = alt?.['@_href'] ?? '';
    }
    if (!url) url = text(it.guid);
    const dateStr = text(it.pubDate) || text(it.published) || text(it.updated) || text(it['dc:date']);
    const d = dateStr ? new Date(dateStr) : new Date();
    if (!title || !url) continue;
    out.push({
      id: hash(url),
      title,
      url: url.trim(),
      source: feed.name,
      published: isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
      region: feed.region,
      topics: feed.topics,
    });
  }
  return out;
}

export async function fetchFeed(feed: FeedDef): Promise<NewsItem[]> {
  const xml = await fetchText(feed.url, { timeoutMs: 7000, headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } });
  return parseFeed(xml, feed);
}
