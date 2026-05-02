import { suggestCategory, suggestAccount, calculateMarkup, calculateSalesPrice } from './odoo-logic';
import { buildPurchaseSku, classifyLine, normalizeRfc, normalizeSku } from './business-rules';

const CFDI_NAMESPACES = [
  'http://www.sat.gob.mx/cfd/4',
  'http://www.sat.gob.mx/cfd/3',
];

const TFD_NAMESPACE = 'http://www.sat.gob.mx/TimbreFiscalDigital';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getAttr(node, name, fallback = '') {
  if (!node) return fallback;
  return node.getAttribute(name) || node.getAttribute(name.toLowerCase()) || fallback;
}

function firstNode(xml, localName, namespaceUris = []) {
  const direct = xml.querySelector(localName);
  if (direct) return direct;

  for (const namespaceUri of namespaceUris) {
    const node = xml.getElementsByTagNameNS(namespaceUri, localName)[0];
    if (node) return node;
  }

  return Array.from(xml.getElementsByTagName('*')).find((node) => node.localName === localName) || null;
}

function allNodes(xml, localName, namespaceUris = []) {
  const direct = Array.from(xml.querySelectorAll(localName));
  if (direct.length > 0) return direct;

  for (const namespaceUri of namespaceUris) {
    const nodes = Array.from(xml.getElementsByTagNameNS(namespaceUri, localName));
    if (nodes.length > 0) return nodes;
  }

  return Array.from(xml.getElementsByTagName('*')).filter((node) => node.localName === localName);
}

function parseNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeUuid(value) {
  const cleaned = String(value || '').trim();
  return UUID_PATTERN.test(cleaned) ? cleaned.toUpperCase() : '';
}

function getUuidFromFileName(fileName) {
  const baseName = String(fileName || '').replace(/\.[^.]+$/, '');
  return normalizeUuid(baseName);
}

function extractEmail(text) {
  const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (!emailMatches) return '';
  return emailMatches.find((email) => !email.includes('sat.gob.mx') && !email.includes('w3.org')) || '';
}

function extractPhone(text) {
  const phoneMatches = text.match(/(?:\+?52\s?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/g);
  if (!phoneMatches) return '';
  return phoneMatches.find((phone) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 && !digits.startsWith('0000');
  }) || '';
}

export async function parseInvoiceXml(file) {
  const text = await file.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'application/xml');
  const parserError = xml.querySelector('parsererror');

  if (parserError) {
    throw new Error(`XML inválido: ${file.name}`);
  }

  const comp = firstNode(xml, 'Comprobante', CFDI_NAMESPACES) || xml.documentElement;
  const emisorNode = firstNode(xml, 'Emisor', CFDI_NAMESPACES);
  const receptorNode = firstNode(xml, 'Receptor', CFDI_NAMESPACES);
  const tfd = firstNode(xml, 'TimbreFiscalDigital', [TFD_NAMESPACE]);
  const conceptNodes = allNodes(xml, 'Concepto', CFDI_NAMESPACES);

  const provider = getAttr(emisorNode, 'Nombre', 'Proveedor Desconocido').toUpperCase().trim();
  let rfc = normalizeRfc(getAttr(emisorNode, 'Rfc'));
  const regimen = getAttr(emisorNode, 'RegimenFiscal');
  const cp = getAttr(comp, 'LugarExpedicion');
  const email = extractEmail(text).toLowerCase().trim();
  const phone = extractPhone(text).trim();

  if (!rfc) {
    const rfcMatch = text.match(/[A-Z&Ñ]{3,4}[0-9]{2}(0[1-9]|1[012])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{2}[0-9A]/i);
    rfc = normalizeRfc(rfcMatch ? rfcMatch[0] : '');
  }

  const stampedUuid = normalizeUuid(getAttr(tfd, 'UUID'));
  const fileUuid = getUuidFromFileName(file.name);
  const uuid = fileUuid || stampedUuid || `MANUAL-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  const fecha = getAttr(comp, 'Fecha').substring(0, 10);
  const cfdiType = getAttr(comp, 'TipoDeComprobante');
  const invoice = {
    uuid,
    stampedUuid,
    cfdiType,
    fecha,
    provider,
    rfc,
    receiverRfc: normalizeRfc(getAttr(receptorNode, 'Rfc')),
    receiverName: getAttr(receptorNode, 'Nombre').toUpperCase().trim(),
    receiverPostalCode: getAttr(receptorNode, 'DomicilioFiscalReceptor'),
    receiverRegimen: getAttr(receptorNode, 'RegimenFiscalReceptor'),
    usoCfdi: getAttr(receptorNode, 'UsoCFDI'),
    subtotal: parseNumber(getAttr(comp, 'SubTotal')),
    total: parseNumber(getAttr(comp, 'Total')),
    currency: getAttr(comp, 'Moneda', 'MXN'),
    cp,
    regimen,
    email,
    phone,
    sourceFile: file.name,
  };

  const lines = conceptNodes.map((node, index) => {
    const description = getAttr(node, 'Descripcion').toUpperCase().trim();
    const skuOriginal = normalizeSku(getAttr(node, 'NoIdentificacion')) || 'S/SKU';
    const cost = parseNumber(getAttr(node, 'ValorUnitario'));
    const quantity = parseNumber(getAttr(node, 'Cantidad'));
    const subtotal = parseNumber(getAttr(node, 'Importe')) || cost * quantity;
    const satCode = getAttr(node, 'ClaveProdServ');
    const classification = classifyLine({
      description,
      satCode,
      provider,
      rfc,
      usoCfdi: invoice.usoCfdi,
      receiverRfc: invoice.receiverRfc,
      receiverRegimen: invoice.receiverRegimen,
    });
    const purchaseSku = buildPurchaseSku({ sku: skuOriginal, description, provider, rfc });
    const markup = calculateMarkup(description);

    return {
      id: `${uuid}-${index}`,
      uuid,
      stampedUuid,
      cfdiType,
      fecha,
      provider,
      rfc,
      receiverRfc: invoice.receiverRfc,
      receiverName: invoice.receiverName,
      receiverPostalCode: invoice.receiverPostalCode,
      receiverRegimen: invoice.receiverRegimen,
      usoCfdi: invoice.usoCfdi,
      email,
      phone,
      cp,
      regimen,
      skuOriginal,
      skuShielded: purchaseSku,
      purchaseSku,
      canonicalSku: skuOriginal,
      description,
      satCode,
      unitCode: getAttr(node, 'ClaveUnidad'),
      unitName: getAttr(node, 'Unidad'),
      cost,
      quantity,
      qty: quantity,
      subtotal,
      category: classification.category || suggestCategory(description),
      account: classification.lineType === 'ignore' || classification.odooType === 'Revisar' ? '' : classification.account || suggestAccount(description),
      markup,
      suggestedPrice: calculateSalesPrice(cost, markup),
      isExisting: false,
      reviewStatus: classification.lineType === 'review' ? 'needs_review' : 'ready',
      ...classification,
    };
  });

  lines.invoice = invoice;
  lines.xmlText = text;
  return lines;
}

export async function parseInvoiceXmlWithMetadata(file) {
  const lines = await parseInvoiceXml(file);
  return {
    invoice: lines.invoice,
    lines,
    xmlText: lines.xmlText,
  };
}
