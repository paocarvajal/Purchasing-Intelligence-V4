import { normalizeRfc, normalizeSku, normalizeText } from './business-rules';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export const ODOO_COLUMNS = {
  productTemplate: {
    name: 'Nombre',
    internalRef: 'Referencia interna',
    category: 'Categoría del producto',
    salePrice: 'Precio de venta',
    stock: 'Cantidad a la mano',
    unit: 'Unidad',
  },
  productVariant: {
    displayName: 'Nombre en pantalla',
    averageCost: 'Costo promedio',
    totalValue: 'Valor total',
    stock: 'Cantidad a la mano',
    available: 'Cantidad disponible para uso',
    unit: 'Unidad',
  },
  partner: {
    name: 'Nombre completo',
    vat: 'Número de identificación fiscal',
    email: 'Correo electrónico',
    phone: 'Teléfono',
    country: 'País',
    tags: 'Etiquetas',
  },
  account: {
    code: 'Código',
    name: 'Nombre de la cuenta',
    type: 'Tipo',
  },
};

function normalizeRow(row) {
  return Object.entries(row || {}).reduce((acc, [key, value]) => {
    acc[key] = value;
    acc[normalizeText(key)] = value;
    return acc;
  }, {});
}

function get(row, columnName) {
  const normalized = normalizeRow(row);
  return normalized[columnName] ?? normalized[normalizeText(columnName)] ?? '';
}

function toNumber(value) {
  if (typeof value === 'number') return value;
  const normalized = String(value || '').replace(/,/g, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeProductTemplateRow(row) {
  const ref = normalizeSku(get(row, ODOO_COLUMNS.productTemplate.internalRef));
  if (!ref) return null;

  return {
    id: ref,
    internalRef: ref,
    canonicalSku: ref,
    name: String(get(row, ODOO_COLUMNS.productTemplate.name) || '').trim(),
    category: String(get(row, ODOO_COLUMNS.productTemplate.category) || '').trim(),
    salePrice: toNumber(get(row, ODOO_COLUMNS.productTemplate.salePrice)),
    stock: toNumber(get(row, ODOO_COLUMNS.productTemplate.stock)),
    unit: String(get(row, ODOO_COLUMNS.productTemplate.unit) || 'Unidades').trim(),
    source: 'odoo.product.template',
  };
}

export function normalizeProductVariantRow(row) {
  const displayName = String(get(row, ODOO_COLUMNS.productVariant.displayName) || '');
  const ref = normalizeSku(displayName.match(/^\[([^\]]+)\]/)?.[1]);
  if (!ref) return null;

  return {
    id: ref,
    internalRef: ref,
    averageCost: toNumber(get(row, ODOO_COLUMNS.productVariant.averageCost)),
    stock: toNumber(get(row, ODOO_COLUMNS.productVariant.stock)),
    available: toNumber(get(row, ODOO_COLUMNS.productVariant.available)),
    totalValue: toNumber(get(row, ODOO_COLUMNS.productVariant.totalValue)),
    unit: String(get(row, ODOO_COLUMNS.productVariant.unit) || 'Unidades').trim(),
    source: 'odoo.product.product',
  };
}

export function normalizePartnerRow(row) {
  const vat = normalizeRfc(get(row, ODOO_COLUMNS.partner.vat));
  const name = String(get(row, ODOO_COLUMNS.partner.name) || '').trim();
  if (!vat && !name) return null;

  return {
    id: vat || normalizeText(name),
    vat,
    name,
    email: String(get(row, ODOO_COLUMNS.partner.email) || '').trim().toLowerCase(),
    phone: String(get(row, ODOO_COLUMNS.partner.phone) || '').trim(),
    country: String(get(row, ODOO_COLUMNS.partner.country) || 'México').trim(),
    tags: String(get(row, ODOO_COLUMNS.partner.tags) || '').trim(),
    source: 'odoo.res.partner',
  };
}

export function normalizeAccountRow(row) {
  const code = String(get(row, ODOO_COLUMNS.account.code) || '').trim();
  if (!code) return null;

  return {
    id: code,
    code,
    name: String(get(row, ODOO_COLUMNS.account.name) || '').trim(),
    type: String(get(row, ODOO_COLUMNS.account.type) || '').trim(),
    source: 'odoo.account.account',
  };
}

export function indexById(records) {
  return records.reduce((acc, record) => {
    if (record?.id) acc[record.id] = record;
    return acc;
  }, {});
}

export function findDuplicatePartners(partners) {
  const buckets = partners.reduce((acc, partner) => {
    const key = partner.vat || normalizeText(partner.name);
    if (!key) return acc;
    acc[key] = acc[key] || [];
    acc[key].push(partner);
    return acc;
  }, {});

  return Object.entries(buckets)
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({ key, count: rows.length, rows }));
}

export const MASTER_IMPORT_TYPES = {
  productTemplates: {
    label: 'Productos Odoo',
    collection: 'products',
    normalize: normalizeProductTemplateRow,
  },
  productVariants: {
    label: 'Variantes Odoo',
    collection: 'products',
    normalize: normalizeProductVariantRow,
  },
  partners: {
    label: 'Contactos / Proveedores',
    collection: 'suppliers',
    normalize: normalizePartnerRow,
  },
  accounts: {
    label: 'Cuentas contables',
    collection: 'accounts',
    normalize: normalizeAccountRow,
  },
};

function parseCsv(text) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  if (result.errors.length > 0) {
    throw new Error(result.errors[0].message);
  }
  return result.data;
}

async function parseXlsx(file) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
    defval: '',
    raw: false,
  });
}

export async function parseMasterDataFile(file, type) {
  const config = MASTER_IMPORT_TYPES[type];
  if (!config) throw new Error(`Unsupported Odoo import type: ${type}`);

  const fileName = file.name.toLowerCase();
  const rows = fileName.endsWith('.csv')
    ? parseCsv(await file.text())
    : await parseXlsx(file);

  const records = rows
    .map(config.normalize)
    .filter(Boolean)
    .map((record) => ({
      ...record,
      importType: type,
      firestoreId: `${record.source}:${record.id}`,
      sourceFile: file.name,
    }));

  return {
    type,
    collection: config.collection,
    label: config.label,
    records,
    skipped: rows.length - records.length,
  };
}
