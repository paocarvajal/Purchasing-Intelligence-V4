export const LINE_TYPES = {
  INVENTORY: 'inventory',
  EXPENSE: 'expense',
  FIXED_ASSET: 'fixed_asset',
  SERVICE: 'service',
  IGNORE: 'ignore',
  REVIEW: 'review',
};

export const ODOO_TYPES = [
  'Inventario',
  'Gasto Operativo',
  'Activo Fijo',
  'Servicio',
  'Mantenimiento',
  'Ignorar',
  'Revisar',
];

export const TRUPER_BRANDS = [
  'TRUPER',
  'PRETUL',
  'FIERO',
  'FOSSET',
  'FOSET',
  'HERMEX',
  'KLINTEK',
  'VOLTECK',
  'VOLTEK',
  'LOTEK',
  'LAIT',
  'IUSA',
  'IUSACELL',
];

export const DEFAULT_SUPPLIER_RULES = [
  {
    key: 'electrica-45',
    match: ['ELECTRICA EL 45', 'ELECTRICA 45', 'EL 45'],
    prefix: 'E45-',
    defaultLineType: LINE_TYPES.INVENTORY,
    defaultOdooType: 'Inventario',
  },
  {
    key: 'ferreteria-43',
    match: ['FERRETERIA 43', 'FERRETERIA 41'],
    prefix: 'F43-',
    defaultLineType: LINE_TYPES.INVENTORY,
    defaultOdooType: 'Inventario',
  },
  {
    key: 'costco',
    match: ['COSTCO'],
    prefix: 'COS-',
    defaultLineType: LINE_TYPES.REVIEW,
    defaultOdooType: 'Revisar',
  },
];

export const IGNORE_SAT_CODES = new Set([
  '84111505', // payroll
  '86121700', // tuition/education
]);

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

export function normalizeRfc(value) {
  return normalizeText(value).replace(/[^A-Z0-9&]/g, '');
}

export function normalizeSku(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

export function findSupplierRule(providerName, rfc, extraRules = []) {
  const name = normalizeText(providerName);
  const supplierRfc = normalizeRfc(rfc);
  const rules = [...extraRules, ...DEFAULT_SUPPLIER_RULES];

  return rules.find((rule) => {
    if (rule.rfc && normalizeRfc(rule.rfc) === supplierRfc) return true;
    return (rule.match || []).some((term) => name.includes(normalizeText(term)));
  }) || null;
}

export function isTruperBrand(providerName, description = '') {
  const haystack = `${normalizeText(providerName)} ${normalizeText(description)}`;
  return TRUPER_BRANDS.some((brand) => haystack.includes(normalizeText(brand)));
}

export function makeGeneratedSku(description, providerName = '') {
  const source = `${providerName}|${description}`;
  const hash = Math.abs(
    source.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0)
  );
  return `GEN-${hash.toString(36).toUpperCase().substring(0, 8)}`;
}

export function buildPurchaseSku({ sku, description, provider, rfc, supplierRules = [] }) {
  const cleanSku = normalizeSku(sku) || makeGeneratedSku(description, provider);
  const rule = findSupplierRule(provider, rfc, supplierRules);

  if (rule?.prefix) return `${rule.prefix}${cleanSku}`;
  if (isTruperBrand(provider, description)) return cleanSku;

  return `SUP-${cleanSku}`;
}

export function classifyLine({ description, satCode, provider, rfc, supplierRules = [] }) {
  const rule = findSupplierRule(provider, rfc, supplierRules);
  if (rule?.ignore) {
    return {
      lineType: LINE_TYPES.IGNORE,
      odooType: 'Ignorar',
      reason: 'Supplier rule marks this RFC/name as ignored.',
    };
  }

  if (IGNORE_SAT_CODES.has(String(satCode || ''))) {
    return {
      lineType: LINE_TYPES.REVIEW,
      odooType: 'Revisar',
      reason: 'SAT code looks non-business; review before ignoring.',
    };
  }

  if (rule?.defaultLineType) {
    return {
      lineType: rule.defaultLineType,
      odooType: rule.defaultOdooType,
      reason: `Supplier rule ${rule.key} applied.`,
    };
  }

  const text = normalizeText(description);
  if (text.includes('RENTA') || text.includes('ALQUILER')) {
    return { lineType: LINE_TYPES.EXPENSE, odooType: 'Gasto Operativo', reason: 'Rent keyword match.' };
  }
  if (text.includes('MANTENIMIENTO') || text.includes('REPARACION')) {
    return { lineType: LINE_TYPES.EXPENSE, odooType: 'Mantenimiento', reason: 'Maintenance keyword match.' };
  }
  if (text.includes('ODOO') || text.includes('SOFTWARE') || text.includes('SUSCRIPCION')) {
    return { lineType: LINE_TYPES.SERVICE, odooType: 'Servicio', reason: 'Software/service keyword match.' };
  }
  if (text.includes('IMPRESORA') || text.includes('LAPTOP') || text.includes('EQUIPO')) {
    return { lineType: LINE_TYPES.FIXED_ASSET, odooType: 'Activo Fijo', reason: 'Store equipment keyword match.' };
  }
  if (text.includes('LIMPIEZA') || text.includes('JABON') || text.includes('MICROFIB')) {
    return { lineType: LINE_TYPES.EXPENSE, odooType: 'Gasto Operativo', reason: 'Store supply keyword match.' };
  }

  return { lineType: LINE_TYPES.REVIEW, odooType: 'Revisar', reason: 'No confident rule matched.' };
}
