import { useState, useEffect, useCallback } from 'react';
import {
  DEFAULT_SUPPLIER_RULES,
  LINE_TYPES,
  buildPurchaseSku,
  classifyLine,
  isTruperBrand,
  normalizeRfc,
  normalizeSku,
} from '../core/business-rules';

/**
 * Global Store for HerraMax V4
 */

const DEFAULT_MASTER_DATA = {
  productTemplates: {},
  productVariants: {},
  partners: {},
  accounts: {},
  imports: [],
};

let globalState = {
  invoices: {},
  items: [],
  sessionUuids: [],
  dests: [
    { id: 'ele45', name: 'Eléctrica 45', emoji: '⚡' },
    { id: 'fer41', name: 'Ferretería 41', emoji: '🔩' },
    { id: 'gen', name: 'General', emoji: '🏬' },
  ],
  itemDests: {}, // uuid -> destId
  selectedIds: new Set(),
  providerMetadata: {}, // rfc -> { activity: string, email: string, phone: string }
  supplierRules: DEFAULT_SUPPLIER_RULES,
  masterData: DEFAULT_MASTER_DATA,
  lastImportReport: null,
  syncLog: [],
};

const stored = localStorage.getItem('hm_v4_store');
if (stored) {
  try {
    const parsed = JSON.parse(stored);
    globalState = {
      ...globalState,
      ...parsed,
      selectedIds: new Set(),
      supplierRules: parsed.supplierRules?.length ? parsed.supplierRules : DEFAULT_SUPPLIER_RULES,
      masterData: { ...DEFAULT_MASTER_DATA, ...(parsed.masterData || {}) },
      syncLog: parsed.syncLog || [],
    };
  } catch {
    localStorage.removeItem('hm_v4_store');
  }
}

const listeners = new Set();

function indexRecords(records) {
  return records.reduce((acc, record) => {
    if (record?.id) acc[record.id] = record;
    return acc;
  }, {});
}

function findCatalogMatch(line, masterData, purchaseSku) {
  const truper = isTruperBrand(line.provider, line.description);
  const baseSku = normalizeSku(line.skuOriginal);
  const canonicalSku = normalizeSku(line.canonicalSku);
  const generatedSku = normalizeSku(purchaseSku);
  const candidates = truper
    ? [baseSku, canonicalSku, generatedSku]
    : [generatedSku, canonicalSku, baseSku];

  for (const candidate of candidates.filter(Boolean)) {
    const template = masterData.productTemplates[candidate];
    const variant = masterData.productVariants[candidate];
    if (template || variant) {
      return {
        id: candidate,
        template,
        variant,
        record: { ...(template || {}), ...(variant || {}) },
      };
    }
  }

  return null;
}

function enrichLine(line, state, options = {}) {
  const ruleClassification = classifyLine({
    description: line.description,
    satCode: line.satCode,
    provider: line.provider,
    rfc: line.rfc,
    supplierRules: state.supplierRules,
  });
  const shouldApplyRuleClassification = options.forceClassification
    || !line.manuallyReviewed
    || ruleClassification.lineType === 'ignore'
    || ruleClassification.reason?.startsWith('Supplier rule');
  const purchaseSku = buildPurchaseSku({
    sku: line.skuOriginal,
    description: line.description,
    provider: line.provider,
    rfc: line.rfc,
    supplierRules: state.supplierRules,
  });
  const match = findCatalogMatch(line, state.masterData, purchaseSku);
  const truper = isTruperBrand(line.provider, line.description);
  const catalogStock = Number(match?.record?.stock || match?.record?.available || 0);
  const canonicalSku = match?.record?.canonicalSku || match?.record?.internalRef || (truper ? normalizeSku(line.skuOriginal) : purchaseSku);

  return {
    ...line,
    ...(shouldApplyRuleClassification ? ruleClassification : {}),
    account: shouldApplyRuleClassification && ruleClassification.lineType === 'ignore' ? '' : line.account,
    reviewStatus: shouldApplyRuleClassification && ruleClassification.lineType !== 'review' ? 'ready' : line.reviewStatus,
    purchaseSku,
    skuShielded: purchaseSku,
    canonicalSku,
    isExisting: Boolean(match),
    catalogName: match?.record?.name || match?.record?.displayName || '',
    catalogStock,
    catalogSource: match?.record?.source || '',
    productStatus: match ? 'existing' : 'new',
    skuRole: truper ? 'canonical' : 'purchase',
    ecommerceEligible: truper && Boolean(match) && catalogStock > 0,
  };
}

function enrichItems(items, state, options = {}) {
  return items.map((item) => enrichLine(item, state, options));
}

function lineTypeFromOdooType(odooType) {
  switch (odooType) {
    case 'Ignorar':
      return LINE_TYPES.IGNORE;
    case 'Inventario':
      return LINE_TYPES.INVENTORY;
    case 'Activo Fijo':
      return LINE_TYPES.FIXED_ASSET;
    case 'Servicio':
      return LINE_TYPES.SERVICE;
    case 'Gasto Operativo':
    case 'Mantenimiento':
      return LINE_TYPES.EXPENSE;
    case 'Revisar':
      return LINE_TYPES.REVIEW;
    default:
      return null;
  }
}

function normalizeManualUpdates(updates) {
  const next = { ...updates };

  if (Object.prototype.hasOwnProperty.call(next, 'odooType')) {
    const mappedLineType = lineTypeFromOdooType(next.odooType);
    if (mappedLineType) next.lineType = mappedLineType;

    if (next.odooType === 'Ignorar') {
      next.account = '';
      next.reviewStatus = 'ready';
      next.reason = 'Manual ignore.';
    } else if (next.odooType === 'Revisar') {
      next.account = '';
      next.reviewStatus = 'needs_review';
      next.reason = 'Manual review.';
    }
  }

  if (Object.prototype.hasOwnProperty.call(next, 'account') && !next.account && next.odooType !== 'Ignorar') {
    next.account = '';
  }

  return next;
}

const setState = (next) => {
  globalState = typeof next === 'function' ? next(globalState) : { ...globalState, ...next };
  // Filter out non-serializable items for storage
  const { selectedIds: _selectedIds, ...toStore } = globalState;
  localStorage.setItem('hm_v4_store', JSON.stringify(toStore));
  listeners.forEach(l => l(globalState));
};

export function useStore() {
  const [state, setInternalState] = useState(globalState);

  useEffect(() => {
    listeners.add(setInternalState);
    return () => listeners.delete(setInternalState);
  }, []);

  const addItems = useCallback((newItems) => {
    setState(prev => {
      const existingIds = new Set(prev.items.map(i => i.id));
      const filtered = enrichItems(newItems.filter(i => !existingIds.has(i.id)), prev);
      const addedUuids = [...new Set(filtered.map(i => i.uuid))];
      return {
        ...prev,
        items: [...prev.items, ...filtered],
        sessionUuids: [...new Set([...prev.sessionUuids, ...addedUuids])]
      };
    });
  }, []);

  const addInvoice = useCallback((invoice) => {
    setState(prev => ({
      ...prev,
      invoices: {
        ...(prev.invoices || {}),
        [invoice.uuid]: {
          ...(prev.invoices?.[invoice.uuid] || {}),
          ...invoice,
          importedAt: prev.invoices?.[invoice.uuid]?.importedAt || new Date().toISOString(),
        },
      },
      sessionUuids: [...new Set([...prev.sessionUuids, invoice.uuid])],
    }));
  }, []);

  const setLastImportReport = useCallback((report) => {
    setState(prev => ({
      ...prev,
      lastImportReport: report,
    }));
  }, []);

  const updateItem = useCallback((id, updates) => {
    const normalizedUpdates = normalizeManualUpdates(updates);
    setState(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, ...normalizedUpdates, manuallyReviewed: true } : i)
    }));
  }, []);

  const bulkUpdate = useCallback((ids, updates) => {
    const normalizedUpdates = normalizeManualUpdates(updates);
    setState(prev => ({
      ...prev,
      items: prev.items.map(i => ids.has(i.id) ? { ...i, ...normalizedUpdates, manuallyReviewed: true } : i)
    }));
  }, []);

  const setItemDest = useCallback((uuid, destId) => {
    setState(prev => ({
      ...prev,
      itemDests: { ...prev.itemDests, [uuid]: destId }
    }));
  }, []);

  const toggleSelection = useCallback((id) => {
    setState(prev => {
      const next = new Set(prev.selectedIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, selectedIds: next };
    });
  }, []);

  const selectAll = useCallback((ids) => {
    setState(prev => ({ ...prev, selectedIds: new Set(ids) }));
  }, []);

  const clearSelection = useCallback(() => {
    setState(prev => ({ ...prev, selectedIds: new Set() }));
  }, []);

  const removeItem = useCallback((uuid) => {
    setState(prev => ({
      ...prev,
      items: prev.items.filter(i => i.uuid !== uuid),
      sessionUuids: prev.sessionUuids.filter(u => u !== uuid)
    }));
  }, []);

  const deleteLine = useCallback((id) => {
    setState(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== id)
    }));
  }, []);

  const clearSession = useCallback(() => {
    if (confirm('¿Seguro que quieres borrar TODA la información cargada? No se puede deshacer.')) {
      setState(prev => ({
        ...prev,
        invoices: {},
        items: [],
        sessionUuids: [],
        itemDests: {},
        selectedIds: new Set(),
        lastImportReport: null,
      }));
    }
  }, []);

  const updateProviderMetadata = useCallback((rfc, updates) => {
    setState(prev => ({
      ...prev,
      providerMetadata: {
        ...prev.providerMetadata,
        [normalizeRfc(rfc)]: { ...(prev.providerMetadata[normalizeRfc(rfc)] || {}), ...updates }
      }
    }));
  }, []);

  const importMasterData = useCallback((type, records, importInfo = {}) => {
    setState(prev => {
      const masterData = {
        ...prev.masterData,
        [type]: {
          ...(prev.masterData[type] || {}),
          ...indexRecords(records),
        },
        imports: [
          {
            id: `${type}-${Date.now()}`,
            type,
            count: records.length,
            skipped: importInfo.skipped || 0,
            sourceFile: importInfo.sourceFile || '',
            savedToCloud: Boolean(importInfo.savedToCloud),
            importedAt: new Date().toISOString(),
          },
          ...(prev.masterData.imports || []),
        ].slice(0, 20),
      };
      const nextState = { ...prev, masterData };
      return {
        ...nextState,
        items: enrichItems(prev.items, nextState),
      };
    });
  }, []);

  const replaceMasterData = useCallback((nextMasterData) => {
    setState(prev => {
      const masterData = { ...DEFAULT_MASTER_DATA, ...nextMasterData };
      const nextState = { ...prev, masterData };
      return {
        ...nextState,
        items: enrichItems(prev.items, nextState),
      };
    });
  }, []);

  const upsertSupplierRule = useCallback((rule) => {
    setState(prev => {
      const normalizedRule = {
        ...rule,
        rfc: normalizeRfc(rule.rfc),
        match: Array.isArray(rule.match) ? rule.match : String(rule.match || '').split(',').map(value => value.trim()).filter(Boolean),
      };
      const exists = prev.supplierRules.some(existing => existing.key === normalizedRule.key);
      const supplierRules = exists
        ? prev.supplierRules.map(existing => existing.key === normalizedRule.key ? normalizedRule : existing)
        : [normalizedRule, ...prev.supplierRules];
      const nextState = { ...prev, supplierRules };
      return {
        ...nextState,
        items: enrichItems(prev.items, nextState),
      };
    });
  }, []);

  const deleteSupplierRule = useCallback((key) => {
    setState(prev => {
      const nextState = {
        ...prev,
        supplierRules: prev.supplierRules.filter(rule => rule.key !== key),
      };
      return {
        ...nextState,
        items: enrichItems(prev.items, nextState),
      };
    });
  }, []);

  const reclassifyItems = useCallback(() => {
    setState(prev => ({
      ...prev,
      items: enrichItems(prev.items.map(item => ({ ...item, manuallyReviewed: false })), prev, { forceClassification: true }),
    }));
  }, []);

  return {
    state,
    addInvoice,
    addItems,
    setLastImportReport,
    updateItem,
    bulkUpdate,
    setItemDest,
    toggleSelection,
    selectAll,
    clearSelection,
    removeItem,
    deleteLine,
    clearSession,
    updateProviderMetadata,
    importMasterData,
    replaceMasterData,
    upsertSupplierRule,
    deleteSupplierRule,
    reclassifyItems
  };
}
