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
}

export interface ThemeListItem {
  id: string;
  name: string;
  description: string;
  locked: boolean;
  builtIn: boolean;
  colors: Pick<ThemeManifest['colors'], 'primary' | 'background'>;
}
