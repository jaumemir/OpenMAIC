import { describe, it, expect } from 'vitest';
import {
  getContentZone,
  interpolateLayoutVars,
  applyThemeLayout,
} from '@/lib/generation/theme-layout';
import type { ThemeLayout } from '@/lib/types/theme';
import type { SlideContent } from '@/lib/types/stage';
import type { PPTElement } from '@/lib/types/slides';

const CANVAS_W = 1000;
const CANVAS_H = 562.5;

// Minimal SlideContent for testing.
// Slide uses viewportSize (width px) and viewportRatio (width/height), NOT width/height fields.
function makeSlide(elements: PPTElement[] = []): SlideContent {
  return {
    type: 'slide',
    canvas: {
      id: 'test-slide',
      viewportSize: CANVAS_W,
      viewportRatio: CANVAS_W / CANVAS_H, // ~1.7778 (16:9)
      theme: {
        backgroundColor: '#ffffff',
        themeColors: [],
        fontColor: '#333333',
        fontName: 'Aptos',
      },
      elements,
    },
  };
}

describe('getContentZone', () => {
  it('returns full canvas when layout is undefined', () => {
    const zone = getContentZone(undefined, CANVAS_H);
    expect(zone).toEqual({ top: 0, bottom: CANVAS_H, height: CANVAS_H });
  });

  it('returns full canvas when layout has no header or footer', () => {
    const zone = getContentZone({}, CANVAS_H);
    expect(zone).toEqual({ top: 0, bottom: CANVAS_H, height: CANVAS_H });
  });

  it('accounts for header height', () => {
    const layout: ThemeLayout = { header: { height: 45, items: [] } };
    const zone = getContentZone(layout, CANVAS_H);
    expect(zone.top).toBe(45);
    expect(zone.bottom).toBe(CANVAS_H);
    expect(zone.height).toBe(CANVAS_H - 45);
  });

  it('accounts for footer height', () => {
    const layout: ThemeLayout = { footer: { height: 28, items: [] } };
    const zone = getContentZone(layout, CANVAS_H);
    expect(zone.top).toBe(0);
    expect(zone.bottom).toBe(CANVAS_H - 28);
    expect(zone.height).toBe(CANVAS_H - 28);
  });

  it('accounts for both header and footer', () => {
    const layout: ThemeLayout = {
      header: { height: 45, items: [] },
      footer: { height: 28, items: [] },
    };
    const zone = getContentZone(layout, CANVAS_H);
    expect(zone.top).toBe(45);
    expect(zone.bottom).toBe(CANVAS_H - 28);
    expect(zone.height).toBe(CANVAS_H - 45 - 28);
  });
});

describe('interpolateLayoutVars', () => {
  it('substitutes {{courseTitle}}', () => {
    const result = interpolateLayoutVars('Generalitat · {{courseTitle}}', {
      courseTitle: 'Introducció a la IA',
    });
    expect(result).toBe('Generalitat · Introducció a la IA');
  });

  it('substitutes {{slideNumber}} and {{totalSlides}}', () => {
    const result = interpolateLayoutVars('{{slideNumber}} / {{totalSlides}}', {
      slideNumber: 3,
      totalSlides: 10,
    });
    expect(result).toBe('3 / 10');
  });

  it('truncates courseTitle longer than 50 chars with ellipsis', () => {
    const longTitle = 'A'.repeat(60);
    const result = interpolateLayoutVars('{{courseTitle}}', { courseTitle: longTitle });
    expect(result.length).toBeLessThanOrEqual(51); // 50 chars + ellipsis char
    expect(result.endsWith('…')).toBe(true);
  });

  it('leaves unknown variables as empty string', () => {
    const result = interpolateLayoutVars('{{courseTitle}}', {});
    expect(result).toBe('');
  });

  it('handles all variables in one pass', () => {
    const result = interpolateLayoutVars(
      '{{courseTitle}} — slide {{slideNumber}} of {{totalSlides}}',
      { courseTitle: 'Test', slideNumber: 2, totalSlides: 8 },
    );
    expect(result).toBe('Test — slide 2 of 8');
  });
});

describe('applyThemeLayout', () => {
  const layout: ThemeLayout = {
    header: {
      height: 45,
      background: '#006699',
      items: [{ type: 'rect', x: 0, y: 0, fill: '#006699' }],
    },
    footer: {
      height: 28,
      items: [
        {
          type: 'text',
          content: 'Generalitat · {{courseTitle}}',
          x: 16,
          size: 10,
          color: '#555555',
        },
        { type: 'pageNumber', format: 'n/total', x: 950, size: 10, color: '#999999' },
      ],
    },
  };

  it('prepends header and footer elements to slide', () => {
    const slide = makeSlide();
    const result = applyThemeLayout(slide, layout, {
      courseTitle: 'Curs',
      slideNumber: 1,
      totalSlides: 5,
    });
    expect(result.canvas.elements.length).toBeGreaterThan(0);
    // First element should be from header (the background rect)
    expect(result.canvas.elements[0].type).toBe('shape');
    // Footer text element with substituted courseTitle
    const textEls = result.canvas.elements.filter((e) => e.type === 'text');
    const footerText = textEls.find((e) => {
      const el = e as { content?: string };
      return el.content?.includes('Generalitat');
    });
    expect(footerText).toBeDefined();
    const footerEl = footerText as { content?: string };
    expect(footerEl.content).toContain('Curs');
  });

  it('removes LLM elements that overlap header zone', () => {
    const slide = makeSlide([
      {
        id: 'overlap-header',
        type: 'text',
        left: 50,
        top: 10, // inside header (height 45)
        width: 200,
        height: 30,
        rotate: 0,
        content: 'Should be removed',
        defaultFontName: 'Aptos',
        defaultColor: '#333',
      },
    ]);
    const result = applyThemeLayout(slide, layout, { courseTitle: 'Test' });
    const remaining = result.canvas.elements.filter((e) => e.id === 'overlap-header');
    expect(remaining.length).toBe(0);
  });

  it('removes LLM elements that overlap footer zone', () => {
    const slide = makeSlide([
      {
        id: 'overlap-footer',
        type: 'text',
        left: 50,
        top: 540, // inside footer (bottom 28px → footerTop = 534.5)
        width: 200,
        height: 20,
        rotate: 0,
        content: 'Should be removed',
        defaultFontName: 'Aptos',
        defaultColor: '#333',
      },
    ]);
    const result = applyThemeLayout(slide, layout, { courseTitle: 'Test' });
    const remaining = result.canvas.elements.filter((e) => e.id === 'overlap-footer');
    expect(remaining.length).toBe(0);
  });

  it('preserves LLM elements within content zone', () => {
    const slide = makeSlide([
      {
        id: 'content-el',
        type: 'text',
        left: 50,
        top: 100, // well inside content zone (45 → 534.5)
        width: 200,
        height: 30,
        rotate: 0,
        content: 'Keep me',
        defaultFontName: 'Aptos',
        defaultColor: '#333',
      },
    ]);
    const result = applyThemeLayout(slide, layout, { courseTitle: 'Test' });
    const kept = result.canvas.elements.filter((e) => e.id === 'content-el');
    expect(kept.length).toBe(1);
  });

  it('does not modify slide when layout is empty', () => {
    const slide = makeSlide([
      {
        id: 'el1',
        type: 'text',
        left: 50,
        top: 100,
        width: 200,
        height: 30,
        rotate: 0,
        content: 'Content',
        defaultFontName: 'Aptos',
        defaultColor: '#333',
      },
    ]);
    const result = applyThemeLayout(slide, {}, {});
    expect(result.canvas.elements.length).toBe(1);
    expect(result.canvas.elements[0].id).toBe('el1');
  });
});
