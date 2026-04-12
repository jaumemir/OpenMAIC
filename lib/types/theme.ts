export type ThemeLayoutItem =
  | {
      type: 'rect';
      x: number;
      y: number;
      width?: number; // defaults to canvas width
      height?: number; // defaults to zone height
      fill: string;
    }
  | {
      type: 'logo';
      /**
       * Key in ThemeManifest.assets, e.g. "logo" → assets["logo"] = "assets/logo.svg".
       * Using the assets key (not the raw filename) allows a future Theme Editor
       * to populate an asset picker from Object.keys(manifest.assets).
       */
      asset: string;
      x: number;
      y?: number; // defaults to vertically centered in zone
      width: number;
      height?: number; // auto from aspect ratio if omitted
    }
  | {
      type: 'text';
      content: string; // supports {{courseTitle}}, {{slideNumber}}, {{totalSlides}}
      x?: number; // defaults to 16
      y?: number; // defaults to vertically centered in zone
      size?: number; // font size px, default 11
      color?: string; // hex, default '#333333'
      font?: string; // font family, default 'Aptos, Calibri, sans-serif'
      weight?: string; // '400' | '600' | '700', default '400'
      align?: 'left' | 'center' | 'right'; // default 'left'
    }
  | {
      type: 'pageNumber';
      format?: 'n' | 'n/total'; // default 'n'
      x?: number; // defaults to canvas_width - 50
      y?: number; // defaults to vertically centered in zone
      size?: number; // default 10
      color?: string; // default '#999999'
    };

export interface ThemeLayoutZone {
  height: number; // px
  background?: string; // fills entire zone width if set
  items: ThemeLayoutItem[];
}

export interface ThemeLayout {
  header?: ThemeLayoutZone;
  footer?: ThemeLayoutZone;
}

export interface ThemeManifest {
  id: string;
  name: string;
  description: string;
  locked: boolean;
  builtIn: boolean;
  version: string;
  typography: {
    fontFamily: string;
    fontUrl?: string;
    headingWeight: string;
    bodyWeight: string;
  };
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent: string;
    palette: string[]; // 6 colors for charts/elements
  };
  modelInstructions: string;
  assets: Record<string, string>; // { "logo": "assets/logo.svg" }
  layout?: ThemeLayout; // optional: defines fixed header/footer zones
}

export interface ThemeListItem {
  id: string;
  name: string;
  description: string;
  locked: boolean;
  builtIn: boolean;
  colors: Pick<ThemeManifest['colors'], 'primary' | 'background'>;
}
