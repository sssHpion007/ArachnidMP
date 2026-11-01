import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Palette, Sparkles } from 'lucide-react';
import { CustomThemeInfo } from '../types/theme';
import { ThemePaletteModal } from '../components/ThemePaletteModal';
import { HexColorInput } from '../components/HexColorInput';
import '../index.css';

const demoTheme: CustomThemeInfo = {
  id: 'aurora',
  name: 'Aurora Glass',
  description: 'A cool, luminous palette with soft violet highlights.',
  author: 'Arachnid Studio',
  version: '1.0',
  is_folder: true,
  folder_name: 'aurora',
  css_filename: 'theme.css',
  palette: [
    { id: 'primary', label: 'Primary accent', cssVar: '--md-sys-color-primary', default: '#8B5CF6', description: 'Main actions and active states.' },
    { id: 'surface', label: 'Dialog surface', cssVar: '--md-sys-color-surface', default: '#18171B', description: 'The editor window and main dialog surfaces.' },
    { id: 'surface-container', label: 'Panel surface', cssVar: '--md-sys-color-surface-container', default: '#211F26', description: 'Raised cards and input panels.' },
    { id: 'surface-low', label: 'Raised panel', cssVar: '--md-sys-color-surface-container-low', default: '#1D1B20', description: 'Editor sections and control cards.' },
    { id: 'on-surface', label: 'Main text', cssVar: '--md-sys-color-on-surface', default: '#E6E1E5', description: 'Primary interface text.' },
    { id: 'on-surface-variant', label: 'Secondary text', cssVar: '--md-sys-color-on-surface-variant', default: '#CAC4D0', description: 'Descriptions and helper labels.' },
    { id: 'secondary', label: 'Secondary accent', cssVar: '--md-sys-color-secondary', default: '#6ED3C5', description: 'Secondary controls and details.' },
    { id: 'outline', label: 'Outline', cssVar: '--md-sys-color-outline-variant', default: '#49454F', description: 'Borders and subtle separators.' },
    { id: 'on-primary', label: 'Primary button text', cssVar: '--md-sys-color-on-primary', default: '#1E004D', description: 'Text over the primary accent.' },
  ],
  toggles: [],
};

const ThemePalettePreview: React.FC = () => {
  const [colors, setColors] = useState<Record<string, string>>({});
  const [seedColor, setSeedColor] = useState('#8B5CF6');
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="min-h-screen bg-md3-background p-8 text-md3-on-surface">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between rounded-3xl border border-md3-outline-variant/20 bg-md3-surface-container-low p-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-md3-primary">
              <Sparkles className="h-4 w-4" /> Live preview
            </div>
            <h1 className="text-2xl font-bold">Theme settings</h1>
            <p className="mt-1 text-sm text-md3-on-surface-variant">HEX editing and a refreshed custom-theme palette editor.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 rounded-full bg-md3-primary px-5 py-3 text-sm font-bold text-md3-on-primary shadow-lg transition hover:scale-[1.02]"
          >
            <Palette className="h-4 w-4" /> Open palette editor
          </button>
        </header>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-3xl border border-md3-outline-variant/20 bg-md3-surface-container-low p-5">
            <h2 className="text-sm font-bold">Standard accent color</h2>
            <p className="mb-4 mt-1 text-xs text-md3-on-surface-variant">Paste a HEX value directly or use the color swatch.</p>
            <HexColorInput color={seedColor} onChange={setSeedColor} label="Theme accent color" language="en" />
          </section>
          <section className="rounded-3xl border border-md3-outline-variant/20 bg-md3-surface-container-low p-5">
            <h2 className="text-sm font-bold">Current palette</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {demoTheme.palette.map(item => {
                const color = colors[item.id] || item.default;
                return <span key={item.id} className="h-9 w-9 rounded-xl border border-white/10 shadow-sm" style={{ backgroundColor: color }} title={`${item.label}: ${color}`} />;
              })}
            </div>
          </section>
        </div>
      </div>

      <ThemePaletteModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        theme={demoTheme}
        paletteColors={colors}
        onUpdateColor={(itemId, hex) => setColors(current => ({ ...current, [itemId]: hex }))}
        onResetAll={() => setColors({})}
        language="en"
      />
    </div>
  );
};

const root = document.getElementById('root');
if (root) createRoot(root).render(<ThemePalettePreview />);
