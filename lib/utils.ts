
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
