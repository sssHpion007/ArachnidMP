import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Pipette, X } from 'lucide-react';
import { AppLanguage } from '../i18n';
import { coverVariantUrl } from '../utils/coverArt';

interface CoverColorEyedropperProps {
  coverArt?: string | null;
  onPickColor: (color: string) => void;
  language?: AppLanguage;
}

const toHex = (value: number) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');

export const CoverColorEyedropper: React.FC<CoverColorEyedropperProps> = ({ coverArt, onPickColor, language = 'ru' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageSrc = coverArt ? (coverVariantUrl(coverArt, 256) || coverArt) : undefined;
  const crossOrigin = imageSrc && /^(https?:\/\/|cover:\/\/)/i.test(imageSrc) ? 'anonymous' as const : undefined;
  const isRussian = language === 'ru';

  useEffect(() => {
    if (!isOpen) return;
    dialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape, true);
    return () => window.removeEventListener('keydown', closeOnEscape, true);
  }, [isOpen]);

  const openPicker = () => {
    if (!imageSrc) return;
    setImageReady(false);
    setImageFailed(false);
    setIsOpen(true);
  };

  const pickColor = (event: React.MouseEvent<HTMLImageElement>) => {
    const image = imageRef.current;
    if (!image || !image.complete || !image.naturalWidth || !image.naturalHeight) return;
    const bounds = image.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = canvasRef.current ?? document.createElement('canvas');
    canvasRef.current = canvas;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;

    try {
      context.drawImage(image, 0, 0, width, height);
      const x = Math.max(0, Math.min(width - 1, Math.floor(((event.clientX - bounds.left) / bounds.width) * width)));
      const y = Math.max(0, Math.min(height - 1, Math.floor(((event.clientY - bounds.top) / bounds.height) * height)));
      const [red, green, blue, alpha] = context.getImageData(x, y, 1, 1).data;
      if (alpha < 16) return;
      const color = `#${toHex(red)}${toHex(green)}${toHex(blue)}`.toUpperCase();
      onPickColor(color);
      setIsOpen(false);
    } catch (error) {
      console.warn('Could not sample a color from the cover image:', error);
      setImageFailed(true);
    }
  };

  const picker = isOpen && imageSrc && typeof document !== 'undefined' ? createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => setIsOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={isRussian ? 'Пипетка цвета обложки' : 'Cover color eyedropper'}
        data-cover-color-picker="true"
        tabIndex={-1}
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-md3-outline-variant/30 bg-md3-surface-container shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-md3-outline-variant/15 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-md3-primary/10 text-md3-primary"><Pipette className="h-4 w-4" /></div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-md3-on-surface">{isRussian ? 'Выберите цвет с обложки' : 'Pick a color from the cover'}</div>
              <div className="text-[11px] text-md3-on-surface-variant">{isRussian ? 'Нажмите на нужный участок изображения' : 'Click the part of the image you want to sample'}</div>
            </div>
          </div>
          <button type="button" onClick={() => setIsOpen(false)} className="ml-3 grid h-8 w-8 shrink-0 place-items-center rounded-full text-md3-on-surface-variant transition-colors hover:bg-md3-surface-container-highest hover:text-md3-on-surface" aria-label={isRussian ? 'Закрыть пипетку' : 'Close eyedropper'}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative flex min-h-64 items-center justify-center bg-black/20 p-4 sm:p-6">
          {!imageFailed ? (
            <img
              ref={imageRef}
              src={imageSrc}
              crossOrigin={crossOrigin}
              alt={isRussian ? 'Обложка первого трека' : 'First track cover'}
              onLoad={() => setImageReady(true)}
              onError={() => { setImageFailed(true); setImageReady(false); }}
              onClick={pickColor}
              className={`max-h-[min(62vh,560px)] max-w-full select-none object-contain ${imageReady ? 'cursor-crosshair opacity-100' : 'opacity-0'}`}
              draggable={false}
            />
          ) : (
            <div className="max-w-sm rounded-2xl border border-md3-outline-variant/20 bg-md3-surface-container-high p-4 text-center text-xs text-md3-on-surface-variant">
              {isRussian ? 'Не удалось прочитать изображение. Проверьте, что у первого трека есть доступная обложка.' : 'Could not read the image. Make sure the first track has an accessible cover.'}
            </div>
          )}
          {!imageReady && !imageFailed && <div className="absolute text-xs text-md3-on-surface-variant">{isRussian ? 'Загружаем обложку…' : 'Loading cover…'}</div>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-md3-outline-variant/15 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 text-[11px] text-md3-on-surface-variant">
            <Pipette className="h-3.5 w-3.5 shrink-0 text-md3-primary" />
            <span className="truncate">{isRussian ? 'Щёлкните по оттенку, чтобы применить его' : 'Click a shade to apply it'}</span>
          </div>
          <button type="button" onClick={() => setIsOpen(false)} className="rounded-full bg-md3-surface-container-high px-4 py-2 text-xs font-semibold text-md3-on-surface-variant transition-colors hover:bg-md3-surface-container-highest hover:text-md3-on-surface">
            {isRussian ? 'Готово' : 'Done'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        disabled={!imageSrc}
        title={isRussian ? 'Взять из обложки' : 'Pick from cover'}
        aria-label={isRussian ? 'Взять цвет из обложки первого трека' : 'Pick a color from the first track cover'}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-md3-outline-variant/25 bg-md3-surface text-md3-on-surface-variant transition-colors hover:border-md3-primary/50 hover:bg-md3-primary/5 hover:text-md3-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Pipette className="h-3.5 w-3.5" />
      </button>
      {picker}
    </>
  );
};
