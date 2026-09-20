import React from 'react';
import { AppDensity } from '../hooks/useDensity';

interface DensitySelectorProps {
  density: AppDensity;
  onToggle: () => void;
  isBannerActive?: boolean;
  className?: string;
}

export const DensitySelector: React.FC<DensitySelectorProps> = ({
  density,
  onToggle,
  isBannerActive = false,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative p-3.5 rounded-[1.4rem] transition-all active:scale-90 flex items-center justify-center select-none ${
        isBannerActive
          ? 'bg-white/20 text-white backdrop-blur-md border border-white/30 hover:bg-white/30'
          : 'bg-white shadow-sm border border-slate-100 text-slate-600 hover:text-indigo-600 hover:border-indigo-100'
      } ${className}`}
      title={`Escala atual: ${
        density === 'small' ? 'Pequeno (...)' : density === 'medium' ? 'Médio (||.)' : 'Grande (|||)'
      } — Toque para alternar`}
      aria-label="Alternar escala de exibição"
    >
      {/* Ícone fiel aos 3 níveis capturados nas imagens */}
      <span className="font-mono font-black text-sm sm:text-base tracking-tighter leading-none flex items-center justify-center h-5 px-0.5">
        {density === 'small' && (
          <span className="tracking-[-0.15em] text-xs font-black">...</span>
        )}
        {density === 'medium' && (
          <span className="tracking-[-0.05em] font-black">||.</span>
        )}
        {density === 'large' && (
          <span className="tracking-[-0.05em] font-black text-indigo-600">|||</span>
        )}
      </span>
    </button>
  );
};
