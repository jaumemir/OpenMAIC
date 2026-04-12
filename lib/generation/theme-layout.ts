import { nanoid } from 'nanoid';
import type { ThemeLayout, ThemeLayoutItem, ThemeLayoutZone } from '@/lib/types/theme';
import type { SlideContent } from '@/lib/types/stage';
import type { PPTElement, PPTTextElement, PPTShapeElement, PPTImageElement } from '@/lib/types/slides';

const CANVAS_W = 1000;
const CANVAS_H = 562.5;

// ─── Public Types ────────────────────────────────────────────────────────────

export interface LayoutContext {
  courseTitle?: string;
  slideTitle?: string;
  slideNumber?: number;
  totalSlides?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  /**
   * Resolve a ThemeManifest.assets key (e.g. "logo") to a data URI or absolute URL.
   * The caller maps: key → manifest.assets[key] → filename → data URI.
   *
   * Using a callback (not passing the manifest directly) keeps the Theme Editor decoupled:
   * a future editor can inject mock data URIs for live preview without touching the filesystem.
   */
  resolveAsset?: (assetKey: string) => string;
}

// ─── getContentZone ──────────────────────────────────────────────────────────

/**
 * Returns the y-range available for LLM-generated content,
 * given the reserved header/footer zones defined in the theme layout.
 */
export function getContentZone(
  layout: ThemeLayout | undefined,
  canvasHeight = CANVAS_H,
): { top: number; bottom: number; height: number } {
  const top = layout?.header?.height ?? 0;
  const bottom = canvasHeight - (layout?.footer?.height ?? 0);
  return { top, bottom, height: bottom - top };
}

// ─── interpolateLayoutVars ───────────────────────────────────────────────────

/**
 * Substitutes {{courseTitle}}, {{slideNumber}}, {{totalSlides}} in a string.
 * courseTitle is truncated at 50 chars with '…' to prevent footer overflow.
 * Unknown or undefined variables become empty strings.
 */
export function interpolateLayoutVars(content: string, ctx: LayoutContext): string {
  const title =
    ctx.courseTitle && ctx.courseTitle.length > 50
      ? ctx.courseTitle.slice(0, 50) + '…'
      : (ctx.courseTitle ?? '');

  const slideTitle =
    ctx.slideTitle && ctx.slideTitle.length > 80
      ? ctx.slideTitle.slice(0, 80) + '…'
      : (ctx.slideTitle ?? '');

  return content
    .replace(/\{\{courseTitle\}\}/g, title)
    .replace(/\{\{slideTitle\}\}/g, slideTitle)
    .replace(/\{\{slideNumber\}\}/g, ctx.slideNumber != null ? String(ctx.slideNumber) : '')
    .replace(/\{\{totalSlides\}\}/g, ctx.totalSlides != null ? String(ctx.totalSlides) : '');
}

// ─── applyThemeLayout ────────────────────────────────────────────────────────

/**
 * Injects header/footer elements from the theme layout into a slide.
 *
 * 1. Removes LLM-generated elements that overlap with header or footer zones.
 * 2. Converts ThemeLayoutItems to PPTElements (rect, logo, text, pageNumber).
 * 3. Returns a new SlideContent with layout elements prepended (under content visually).
 *
 * This function is called AFTER LLM generation and BEFORE persisting the slide.
 * All three renderers (web, PPTX, SCORM) read slide.elements[] directly, so
 * layout injection is transparent to them.
 */
export function applyThemeLayout(
  slide: SlideContent,
  layout: ThemeLayout,
  ctx: LayoutContext,
): SlideContent {
  const cw = ctx.canvasWidth ?? CANVAS_W;
  const ch = ctx.canvasHeight ?? CANVAS_H;
  const headerH = layout.header?.height ?? 0;
  const footerH = layout.footer?.height ?? 0;
  const footerTop = ch - footerH;

  // 1. Filter out LLM elements overlapping reserved zones.
  // PPTLineElement omits 'height', so use hasHeight guard before computing elBottom.
  const filtered = slide.canvas.elements.filter((el) => {
    const elTop = el.top;
    if (headerH > 0 && elTop < headerH) return false;
    if (footerH > 0 && 'height' in el) {
      const elBottom = el.top + (el as { height: number }).height;
      if (elBottom > footerTop) return false;
    }
    return true;
  });

  // 2. Build header elements (y offset = 0)
  const headerEls: PPTElement[] = layout.header
    ? buildZoneElements(layout.header, 0, cw, ch, ctx)
    : [];

  // 3. Build footer elements (y offset = footerTop)
  const footerEls: PPTElement[] = layout.footer
    ? buildZoneElements(layout.footer, footerTop, cw, ch, ctx)
    : [];

  // 4. Compose: layout elements first (bottom z-layer), content on top
  return {
    ...slide,
    canvas: {
      ...slide.canvas,
      elements: [...headerEls, ...footerEls, ...filtered],
    },
  };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function buildZoneElements(
  zone: ThemeLayoutZone,
  yOffset: number,
  cw: number,
  _ch: number,
  ctx: LayoutContext,
): PPTElement[] {
  const els: PPTElement[] = [];

  // Background rect spanning full zone width and height
  if (zone.background) {
    els.push(makeRect(0, yOffset, cw, zone.height, zone.background));
  }

  for (const item of zone.items) {
    const el = buildItem(item, yOffset, zone.height, cw, ctx);
    if (el) els.push(el);
  }

  return els;
}

function buildItem(
  item: ThemeLayoutItem,
  yOffset: number,
  zoneH: number,
  cw: number,
  ctx: LayoutContext,
): PPTElement | null {
  switch (item.type) {
    case 'rect': {
      const w = item.width ?? cw;
      const h = item.height ?? zoneH;
      return makeRect(item.x, yOffset + (item.y ?? 0), w, h, item.fill);
    }

    case 'logo': {
      const src = ctx.resolveAsset ? ctx.resolveAsset(item.asset) : '';
      if (!src) return null;
      const w = item.width;
      const h = item.height ?? zoneH - 10;
      const y = item.y != null ? item.y : Math.round((zoneH - h) / 2);
      return {
        id: nanoid(),
        type: 'image',
        left: item.x,
        top: yOffset + y,
        width: w,
        height: h,
        rotate: 0,
        src,
        fixedRatio: true,
      } satisfies PPTImageElement;
    }

    case 'text': {
      const font = item.font ?? 'Aptos, Calibri, sans-serif';
      const size = item.size ?? 11;
      const color = item.color ?? '#333333';
      const weight = item.weight ?? '400';
      const x = item.x ?? 16;
      const y = item.y ?? 0;
      // Height spans from y to end of zone so text is never clipped
      // (BaseTextElement adds p-[10px] padding internally)
      const h = zoneH - y;
      const raw = interpolateLayoutVars(item.content, ctx);
      const content = `<p style="text-align:${item.align ?? 'left'}"><span style="font-size:${size}px;color:${color};font-weight:${weight}">${raw}</span></p>`;
      return {
        id: nanoid(),
        type: 'text',
        left: x,
        top: yOffset + y,
        width: cw - x - 16,
        height: h,
        rotate: 0,
        content,
        defaultFontName: font,
        defaultColor: color,
        textType: yOffset === 0 ? 'header' : 'footer',
      } satisfies PPTTextElement;
    }

    case 'pageNumber': {
      const size = item.size ?? 10;
      const color = item.color ?? '#999999';
      const x = item.x ?? cw - 50;
      const y = item.y ?? 0;
      // Height spans from y to end of zone so text is never clipped
      const h = zoneH - y;
      const num =
        item.format === 'n/total'
          ? `${ctx.slideNumber ?? '?'} / ${ctx.totalSlides ?? '?'}`
          : String(ctx.slideNumber ?? '?');
      const content = `<p style="text-align:right"><span style="font-size:${size}px;color:${color}">${num}</span></p>`;
      return {
        id: nanoid(),
        type: 'text',
        left: x,
        top: yOffset + y,
        width: 60,
        height: h,
        rotate: 0,
        content,
        defaultFontName: 'Aptos, Calibri, sans-serif',
        defaultColor: color,
        textType: 'footer',
      } satisfies PPTTextElement;
    }

    default:
      return null;
  }
}

function makeRect(x: number, y: number, w: number, h: number, fill: string): PPTShapeElement {
  return {
    id: nanoid(),
    type: 'shape',
    left: x,
    top: y,
    width: w,
    height: h,
    rotate: 0,
    viewBox: [w, h],
    path: `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`,
    fill,
    fixedRatio: false,
  } satisfies PPTShapeElement;
}
