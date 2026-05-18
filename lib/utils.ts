
/**
 * Utilitários globais para o Salgados Pro v3
 */

/**
 * Normaliza strings para comparação (remove acentos, espaços extras e converte para minúsculo)
 */
export const normalizeString = (str: string | null | undefined): string => {
  if (!str) return "";
  return str
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

/**
 * Normaliza números de telefone para comparação e busca.
 * Remove o 55 (DDI) e o 9º dígito se presente para evitar inconsistências.
 */
export const normalizePhone = (phone: string | null | undefined): string => {
  if (!phone) return "";
  
  // Remove tudo que não é dígito
  let clean = phone.replace(/\D/g, "");
  
  // Remove o prefixo 55 se existir
  if (clean.startsWith("55") && clean.length > 10) {
    clean = clean.substring(2);
  }
  
  // Remove o zero inicial se existir (ex: 021...)
  if (clean.startsWith("0")) {
    clean = clean.substring(1);
  }

  // Lógica do 9º dígito (Brasil): 
  // Se o número tem 11 dígitos (DDD + 9 + 8 dígitos), removemos o 9 para comparação universal
  // Ex: 21988887777 -> 2188887777
  if (clean.length === 11 && clean[2] === "9") {
    clean = clean.substring(0, 2) + clean.substring(3);
  }
  
  return clean;
};

/**
 * Formata moeda para Real Brasileiro
 */
export const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(val);
};

/**
 * Arredonda valores monetários para 2 casas decimais com precisão
 */
export const roundMoney = (v: number): number => {
  return Math.round((v + Number.EPSILON) * 100) / 100;
};

/**
 * Escala de Z-Index padronizada para o projeto
 */
export const Z_INDEX = {
  BASE: 0,
  NAV: 50,
  BACKDROP: 100,
  MODAL: 110,
  OVERLAY: 120,
  TOAST: 150,
  GOD_MODE: 200
};

let audioCtx: AudioContext | null = null;

/**
 * Toca um som baseado na categoria configurada (Vendas, Pedidos, etc)
 */
export const playSoundFromCategory = (category: 'SALES' | 'ORDERS' | 'SYSTEM') => {
  let mode = 'PADRÃO';
  if (category === 'SALES') {
     mode = localStorage.getItem('appInfoSoundModeSales') || 'CASH'; // default for sales changed to CASH
  } else if (category === 'ORDERS') {
     mode = localStorage.getItem('appInfoSoundModeOrders') || 'CHECK'; // default for orders changed to CHECK
  } else {
     mode = localStorage.getItem('appInfoSoundMode') || 'PADRÃO';
  }
  playSystemSound(mode);
};

/**
 * Toca um som de notificação baseado no modo selecionado pelo usuário
 */
export const playSystemSound = (mode: string) => {
  if (mode === 'OFF') return;
  
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (audioCtx?.state === 'suspended') {
      audioCtx.resume();
    }
    
    const ctx = audioCtx;
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (mode === 'MEC.') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (mode === 'SUAVE') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.4);
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (mode === 'CAIXA') {
      // Barulho Caixa Registradora (Cha-Ching)
      osc.type = 'square';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'square';
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc2.frequency.setValueAtTime(1800, ctx.currentTime + 0.1);
      osc2.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
      
      gain2.gain.setValueAtTime(0.05, ctx.currentTime + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
      
      osc2.start(ctx.currentTime + 0.1);
      osc2.stop(ctx.currentTime + 0.3);
    } else if (mode === 'MOEDA') {
      // Barulho Moeda (Ping)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(988, ctx.currentTime); // B5
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08); // E6
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else if (mode === 'CASH') {
      const audio = new Audio('/cash.mp3');
      audio.play().catch(e => console.warn('Audio play failed', e));
    } else if (mode === 'CHECK') {
      const audio = new Audio('/check.mp3');
      audio.play().catch(e => console.warn('Audio play failed', e));
    } else if (mode === 'GALERIA') {
      const base64 = localStorage.getItem('customSoundSales');
      if (base64) {
        const audio = new Audio(base64);
        audio.play().catch(e => console.warn('Audio play failed', e));
      } else {
        // Fallback to PADRÃO if not found
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5); 
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }
    } else if (mode === 'GALERIA_PEDIDOS') {
      const base64 = localStorage.getItem('customSoundOrders');
      if (base64) {
        const audio = new Audio(base64);
        audio.play().catch(e => console.warn('Audio play failed', e));
      } else {
        // Fallback to PADRÃO if not found
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5); 
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }
    } else { // 'PADRÃO'
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); 
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5); 

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch (e) {
    console.warn("Falha ao tocar som do sistema:", e);
  }
};
