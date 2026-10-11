export interface ThemePaletteItem {
  id: string;
  label: string;
  cssVar: string;
  default: string;
  description?: string;
}

export interface ThemeToggleItem {
  id: string;
  label: string;
  description?: string;
  cssClass?: string;
  cssVar?: string;
  default: boolean;
}

export interface CustomThemeInfo {
  id: string;
  name: string;
  description: string;
  author?: string;
  version?: string;
  is_folder: boolean;
  folder_name?: string;
  folder_path?: string;
  css_filename: string;
  palette: ThemePaletteItem[];
  toggles: ThemeToggleItem[];
}

export interface ThemeContent {
  css: string;
  base_path?: string;
}
