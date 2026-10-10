import React from 'react';
import { UploadCloud, Sparkles } from 'lucide-react';
import { AppLanguage } from '../i18n';

interface DragDropOverlayProps {
  isDragging: boolean;
  language?: AppLanguage;
}

export const DragDropOverlay: React.FC<DragDropOverlayProps> = ({ isDragging, language = 'ru' }) => {
  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none bg-md3-surface-container/90 backdrop-blur-md flex flex-col items-center justify-center p-8 border-4 border-dashed border-md3-primary rounded-3xl m-3 animate-in fade-in zoom-in-95 duration-150 select-none">
      <div className="w-24 h-24 rounded-full bg-md3-primary/20 text-md3-primary flex items-center justify-center mb-6 shadow-xl animate-bounce">
        <UploadCloud className="w-12 h-12" />
      </div>
      <h2 className="text-2xl font-extrabold text-md3-on-surface mb-2 flex items-center gap-2">
        <Sparkles className="w-6 h-6 text-md3-primary" />
        {language === 'ru' ? 'Отпустите файлы сюда' : 'Drop audio files here'}
      </h2>
      <p className="text-sm text-md3-on-surface-variant max-w-md text-center">
        {language === 'ru' 
          ? 'Файлы мгновенно добавятся в библиотеку Arachnid с авточтением ID3-тегов и обложек.' 
          : 'Files will be instantly added to your Arachnid library with ID3 tags and cover art parsed.'}
      </p>
      <div className="flex items-center gap-2 mt-4 text-xs font-mono px-3 py-1.5 rounded-full bg-md3-surface-container-highest text-md3-primary font-semibold">
        <span>MP3</span> • <span>FLAC</span> • <span>WAV</span> • <span>OGG</span> • <span>M4A</span> • <span>OPUS</span>
      </div>
    </div>
  );
};
