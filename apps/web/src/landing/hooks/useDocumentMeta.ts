import { useEffect } from 'react';
import { SITE, absoluteUrl } from '../site';

export interface DocumentMeta {
  title: string;
  description: string;
  /** Route path used for canonical + og:url, e.g. '/terms'. Default '/' */
  path?: string;
  ogTitle?: string;
  ogDescription?: string;
  /** Absolute URL or site path (e.g. '/landing/og-nexus.png'). Default: keep the index.html value. */
  ogImage?: string;
  /** e.g. 'noindex,follow'. Default: keep the index.html value ('index,follow'). */
  robots?: string;
  /** 'website' (default) or 'article' */
  ogType?: 'website' | 'article';
}

type Undo = () => void;

function setMeta(attr: 'name' | 'property', key: string, content: string): Undo {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  let created = false;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
    created = true;
  }
  const prev = el.getAttribute('content');
  el.setAttribute('content', content);
  return () => {
    if (created) el?.remove();
    else if (prev !== null) el?.setAttribute('content', prev);
  };
}

function setCanonical(href: string): Undo {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  let created = false;
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
    created = true;
  }
  const prev = el.getAttribute('href');
  el.setAttribute('href', href);
  return () => {
    if (created) el?.remove();
    else if (prev !== null) el?.setAttribute('href', prev);
  };
}

/**
 * Per-route head management (no react-helmet). Sets title, description, canonical, Open Graph and Twitter
 * tags, and restores every previous value on unmount. Social scrapers do not run JS, so index.html carries
 * the home defaults; this serves browsers/Googlebot and the tab title.
 */
export function useDocumentMeta(meta: DocumentMeta): void {
  const { title, description, path = '/', ogTitle, ogDescription, ogImage, robots, ogType = 'website' } = meta;
  useEffect(() => {
    const undo: Undo[] = [];
    const prevTitle = document.title;
    document.title = title;
    undo.push(() => {
      document.title = prevTitle;
    });
    const url = absoluteUrl(path);
    undo.push(setMeta('name', 'description', description));
    undo.push(setCanonical(url));
    undo.push(setMeta('property', 'og:title', ogTitle ?? title));
    undo.push(setMeta('property', 'og:description', ogDescription ?? description));
    undo.push(setMeta('property', 'og:url', url));
    undo.push(setMeta('property', 'og:type', ogType));
    undo.push(setMeta('name', 'twitter:title', ogTitle ?? title));
    undo.push(setMeta('name', 'twitter:description', ogDescription ?? description));
    if (ogImage) {
      const abs = /^https?:/.test(ogImage) ? ogImage : `${SITE.origin}${ogImage}`;
      undo.push(setMeta('property', 'og:image', abs));
      undo.push(setMeta('name', 'twitter:image', abs));
    }
    if (robots) undo.push(setMeta('name', 'robots', robots));
    return () => undo.reverse().forEach((fn) => fn());
  }, [title, description, path, ogTitle, ogDescription, ogImage, robots, ogType]);
}

/**
 * Injects `<script type="application/ld+json" data-lp-ld="{id}">` into <head> while mounted
 * (JSON-LD is a data block, so the CSP `script-src 'self'` does not block it). Pass `null` to skip.
 * The FAQ section uses this for FAQPage; the object must match the visible text exactly.
 */
export function useJsonLd(id: string, data: Record<string, unknown> | null): void {
  const json = data ? JSON.stringify(data) : null;
  useEffect(() => {
    if (!json) return;
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.dataset.lpLd = id;
    el.textContent = json;
    document.head.appendChild(el);
    return () => el.remove();
  }, [id, json]);
}
