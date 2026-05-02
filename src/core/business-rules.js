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

export const RESICO_PROFILE = {
  rfc: 'CASP800419T15',
  name: 'PAOLA CARVAJAL SANCHEZ',
  regimen: '626',
  previousRegimen: '612',
  regimenName: 'Regimen Simplificado de Confianza',
};

export const USO_CFDI_RULES = {
  G01: {
    description: 'Adquisicion de mercancias',
    lineType: LINE_TYPES.INVENTORY,
    odooType: 'Inventario',
    account: '115.01.01 — Inventario',
    category: 'Ferreteria / Inventario',
    reason: 'UsoCFDI G01 marks merchandise purchased for resale.',
  },
  G02: {
    description: 'Devoluciones, descuentos o bonificaciones',
    lineType: LINE_TYPES.REVIEW,
    odooType: 'Revisar',
    account: '',
    category: 'Compras / Devoluciones',
    reason: 'UsoCFDI G02 requires review before treating as purchase adjustment.',
  },
  G03: {
    description: 'Gastos en general',
    lineType: LINE_TYPES.EXPENSE,
    odooType: 'Gasto Operativo',
    account: '601.84.01 — Otros gastos generales',
    category: 'Gastos / General',
    reason: 'UsoCFDI G03 marks general operating expense for RESICO.',
  },
  I01: {
    description: 'Construcciones',
    lineType: LINE_TYPES.FIXED_ASSET,
    odooType: 'Activo Fijo',
    account: '159.01.01 — Construcciones en Proceso',
    category: 'Activo fijo / Construcciones',
    reason: 'UsoCFDI I01 marks investment or construction asset.',
  },
  I02: {
    description: 'Mobiliario y equipo de oficina',
    lineType: LINE_TYPES.FIXED_ASSET,
    odooType: 'Activo Fijo',
    account: '154.01.01 — Mobiliario y Equipo de Oficina',
    category: 'Activo fijo / Mobiliario',
    reason: 'UsoCFDI I02 marks office furniture and equipment asset.',
  },
  I03: {
    description: 'Equipo de transporte',
    lineType: LINE_TYPES.FIXED_ASSET,
    odooType: 'Activo Fijo',
    account: '156.01.01 — Equipo de Transporte',
    category: 'Activo fijo / Transporte',
    reason: 'UsoCFDI I03 marks transport equipment asset.',
  },
  I04: {
    description: 'Equipo de computo y accesorios',
    lineType: LINE_TYPES.FIXED_ASSET,
    odooType: 'Activo Fijo',
    account: '155.01.01 — Equipo de Computo',
    category: 'Activo fijo / Tecnologia',
    reason: 'UsoCFDI I04 marks computer equipment asset.',
  },
  I05: {
    description: 'Herramental',
    lineType: LINE_TYPES.FIXED_ASSET,
    odooType: 'Activo Fijo',
    account: '157.01.01 — Herramientas y Herramental',
    category: 'Activo fijo / Herramental',
    reason: 'UsoCFDI I05 marks tooling or equipment asset.',
  },
  I06: {
    description: 'Comunicaciones telefonicas',
    lineType: LINE_TYPES.EXPENSE,
    odooType: 'Gasto Operativo',
    account: '601.50.01 — Teléfono e Internet',
    category: 'Servicios / Telecom',
    reason: 'UsoCFDI I06 marks telecom operating expense.',
  },
  I07: {
    description: 'Comunicaciones satelitales',
    lineType: LINE_TYPES.EXPENSE,
    odooType: 'Gasto Operativo',
    account: '601.50.01 — Teléfono e Internet',
    category: 'Servicios / Telecom',
    reason: 'UsoCFDI I07 marks telecom operating expense.',
  },
  I08: {
    description: 'Otra maquinaria y equipo',
    lineType: LINE_TYPES.FIXED_ASSET,
    odooType: 'Activo Fijo',
    account: '153.01.01 — Maquinaria y Equipo',
    category: 'Activo fijo / Maquinaria',
    reason: 'UsoCFDI I08 marks machinery or equipment asset.',
  },
  S01: {
    description: 'Sin efectos fiscales',
    lineType: LINE_TYPES.IGNORE,
    odooType: 'Ignorar',
    account: '',
    category: 'Fiscal / Sin efectos',
    reason: 'UsoCFDI S01 has no fiscal effect; excluded from active Herramax structure.',
  },
  CP01: {
    description: 'Pagos',
    lineType: LINE_TYPES.IGNORE,
    odooType: 'Ignorar',
    account: '',
    category: 'Fiscal / Complemento de pago',
    reason: 'UsoCFDI CP01 is a payment complement, not a new expense.',
  },
  CN01: {
    description: 'Nomina',
    lineType: LINE_TYPES.IGNORE,
    odooType: 'Ignorar',
    account: '',
    category: 'Nomina / Ignorada',
    reason: 'UsoCFDI CN01 is payroll and is excluded from Herramax purchasing exports.',
  },
  D04: {
    description: 'Donativos',
    lineType: LINE_TYPES.REVIEW,
    odooType: 'Revisar',
    account: '603.01.01 — Donativos',
    category: 'Fiscal / Donativos',
    reason: 'UsoCFDI D04 is a donation and needs review before deductibility treatment.',
  },
};

export const PERSONAL_USO_CFDI = new Set(['D01', 'D02', 'D03', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10']);

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

export function normalizeUsoCfdi(value) {
  return normalizeText(value).replace(/[^A-Z0-9]/g, '');
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

export function classifyLine({ description, satCode, provider, rfc, usoCfdi, receiverRfc, receiverRegimen, supplierRules = [] }) {
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

  const normalizedUsoCfdi = normalizeUsoCfdi(usoCfdi);
  if (PERSONAL_USO_CFDI.has(normalizedUsoCfdi)) {
    return {
      lineType: LINE_TYPES.IGNORE,
      odooType: 'Ignorar',
      account: '',
      category: 'Personal / No negocio',
      reason: `UsoCFDI ${normalizedUsoCfdi} is personal for RESICO and is excluded from business purchasing exports.`,
    };
  }

  const usoRule = USO_CFDI_RULES[normalizedUsoCfdi];
  if (usoRule) {
    const receiverMatchesResico = !receiverRfc || normalizeRfc(receiverRfc) === RESICO_PROFILE.rfc;
    const regimenNote = receiverRegimen === RESICO_PROFILE.regimen
      ? ' Receiver regimen is RESICO 626.'
      : receiverRegimen === RESICO_PROFILE.previousRegimen
        ? ' Receiver regimen is previous business activity 612; RESICO mapping still applied.'
        : '';
    return {
      lineType: usoRule.lineType,
      odooType: usoRule.odooType,
      account: usoRule.account,
      category: usoRule.category,
      reason: `${usoRule.reason}${receiverMatchesResico ? regimenNote : ''}`,
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

  return { lineType: LINE_TYPES.INVENTORY, odooType: 'Inventario', reason: 'Default merchandise classification.' };
}
