import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export type AppDensity = 'small' | 'medium' | 'large';

const DENSITY_STORAGE_KEY = 'salgados_app_density';

export const useDensity = () => {
  const [density, setDensity] = useState<AppDensity>(() => {
    try {
      const stored = localStorage.getItem(DENSITY_STORAGE_KEY);
      if (stored === 'small' || stored === 'medium' || stored === 'large') {
        return stored as AppDensity;
      }
      // Suporte a migração de chaves antigas
      if (stored === 'compact') return 'small';
      if (stored === 'normal') return 'medium';
    } catch (e) {
      console.warn('Erro ao carregar densidade do armazenamento local:', e);
    }
    return 'medium'; // Padrão: Médio (||.)
  });

  // Atualiza atributo no documento e persiste no localStorage
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-density', density);
      document.body.setAttribute('data-density', density);
      localStorage.setItem(DENSITY_STORAGE_KEY, density);
    } catch (e) {
      console.warn('Erro ao salvar densidade no armazenamento local:', e);
    }
  }, [density]);

  const cycleDensity = useCallback(() => {
    setDensity(prev => {
      let next: AppDensity = 'medium';
      let label = 'Médio';
      if (prev === 'small') {
        next = 'medium';
        label = 'Médio';
      } else if (prev === 'medium') {
        next = 'large';
        label = 'Grande';
      } else {
        next = 'small';
        label = 'Pequeno';
      }

      toast.info(`Escala alterada para: ${label}`, {
        duration: 2200,
        position: 'top-center'
      });
      return next;
    });
  }, []);

  return {
    density,
    setDensity,
    cycleDensity,
    isSmall: density === 'small',
    isMedium: density === 'medium',
    isLarge: density === 'large',
  };
};
