import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Box,
  Calculator,
  CheckSquare,
  Download,
  FileText,
  Fingerprint,
  RefreshCcw,
  Search,
  ShieldCheck,
  FolderOpen,
  Square,
  Trash2,
  TrendingUp,
  Upload,
  XCircle,
} from 'lucide-react';
import Papa from 'papaparse';
import { LINE_TYPES } from '../core/business-rules';
import { CUENTAS, TIPOS_ODOO } from '../core/odoo-logic';
import { saveInvoiceWithLines } from '../core/persistence';
import { parseInvoiceXmlWithMetadata } from '../core/xml-parser';
import { useStore } from '../store/useStore';

async function collectXmlFilesFromDirectory(directoryHandle, prefix = '') {
  const files = [];

  for await (const entry of directoryHandle.values()) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      files.push(...await collectXmlFilesFromDirectory(entry, path));
      continue;
    }

    if (!entry.name.toLowerCase().endsWith('.xml')) continue;
    const file = await entry.getFile();
    try {
      Object.defineProperty(file, 'relativePath', { value: path });
    } catch {
      file.relativePath = path;
    }
    files.push(file);
  }

  return files;
}

function getFileLabel(file) {
  return file.relativePath || file.webkitRelativePath || file.name;
}

export default function Processing() {
  const {
    state,
    addInvoice,
    addItems,
    setLastImportReport,
    removeItem,
    deleteLine,
    clearSession,
    updateItem,
    toggleSelection,
    selectAll,
    clearSelection,
    bulkUpdate,
    reclassifyItems,
  } = useStore();
  const [isDragging, setIsDragging] = useState(false);
  const [search, setSearch] = useState('');
  const [filterProv, setFilterProv] = useState('');
  const [filterAcct, setFilterAcct] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [showIgnoredAudit, setShowIgnoredAudit] = useState(false);
  const [isDropzoneExpanded, setIsDropzoneExpanded] = useState(state.items.length === 0);
  const [groupBy, setGroupBy] = useState('uuid');
  const [archiveStatus, setArchiveStatus] = useState(state.lastImportReport?.summary || '');
  const [importReport, setImportReport] = useState(state.lastImportReport || null);
  const [importProgress, setImportProgress] = useState(null);
  const activeImportReport = importReport || state.lastImportReport;
  const xmlAccept = '.xml,.XML,text/xml,application/xml';

  const handleFiles = useCallback(async (files) => {
    setSearch('');
    setFilterProv('');
    setFilterAcct('');
    setFilterCat('');
    setFilterMonth('');
    setShowOnlyPending(false);
    setShowIgnoredAudit(true);
    setImportProgress(null);

    const xmls = files.filter((file) => {
      const name = file.name.toLowerCase();
      return name.endsWith('.xml') || file.type === 'text/xml' || file.type === 'application/xml';
    });
    const existingUuids = new Set([
      ...Object.keys(state.invoices || {}),
      ...state.items.map((item) => item.uuid),
    ]);
    const existingLineIds = new Set(state.items.map((item) => item.id));
    const seenUuids = new Set();
    const report = {
      selected: files.length,
      xml: xmls.length,
      parsed: 0,
      added: 0,
      addedLines: 0,
      skippedDuplicateLines: 0,
      duplicateLocal: 0,
      duplicateCloud: 0,
      duplicateInSelection: 0,
      saved: 0,
      localOnly: 0,
      lines: 0,
      ignored: 0,
      review: 0,
      uniqueUuids: 0,
      nonXmlFiles: files.length - xmls.length,
      invoiceFiles: [],
      duplicateFiles: [],
      failed: [],
    };
    let saved = 0;
    let duplicates = 0;
    let localOnly = 0;
    const archiveJobs = [];
    setImportProgress(xmls.length > 0 ? { current: 0, total: xmls.length, phase: 'Leyendo XML locales' } : null);
    for (const file of xmls) {
      const fileLabel = getFileLabel(file);
      try {
        const { invoice, lines, xmlText } = await parseInvoiceXmlWithMetadata(file);
        addInvoice({ ...invoice, sourceFile: fileLabel, lineCount: lines.length });
        report.parsed += 1;
        report.lines += lines.length;
        report.ignored += lines.filter((line) => line.lineType === LINE_TYPES.IGNORE).length;
        report.review += lines.filter((line) => line.reviewStatus === 'needs_review' || line.lineType === LINE_TYPES.REVIEW).length;
        const newLines = lines.filter((line) => !existingLineIds.has(line.id));
        const skippedLines = lines.length - newLines.length;
        report.addedLines += newLines.length;
        report.skippedDuplicateLines += skippedLines;
        newLines.forEach((line) => existingLineIds.add(line.id));
        if (seenUuids.has(invoice.uuid)) {
          report.duplicateInSelection += 1;
          report.duplicateFiles.push({
            file: fileLabel,
            uuid: invoice.uuid,
            reason: 'UUID repetido dentro de la seleccion',
          });
        } else if (existingUuids.has(invoice.uuid)) {
          report.duplicateLocal += 1;
          report.duplicateFiles.push({
            file: fileLabel,
            uuid: invoice.uuid,
            reason: 'Ya estaba cargada antes de esta importacion',
          });
        } else {
          report.added += 1;
          existingUuids.add(invoice.uuid);
        }
        seenUuids.add(invoice.uuid);
        report.invoiceFiles.push({
          file: fileLabel,
          uuid: invoice.uuid,
          provider: invoice.provider,
          lines: lines.length,
          addedLines: newLines.length,
        });
        addItems(lines);
        archiveJobs.push({ invoice, lines, xmlText });
        setImportProgress({ current: report.parsed, total: xmls.length, phase: 'Leyendo XML locales' });
      } catch (error) {
        console.error(error);
        report.failed.push({ file: fileLabel, reason: error.message });
        setImportProgress({ current: report.parsed + report.failed.length, total: xmls.length, phase: 'Leyendo XML locales' });
      }
    }
    report.uniqueUuids = new Set(report.invoiceFiles.map((invoice) => invoice.uuid)).size;
    const summary = xmls.length > 0
      ? `${report.parsed}/${report.xml} XML leidos localmente. ${report.uniqueUuids} UUID unicos, ${report.added} facturas nuevas, ${report.addedLines} lineas nuevas. Archivando en Firebase en segundo plano.`
      : 'No encontre XML en la seleccion. Abre la carpeta sincronizada de Google Drive o usa Importar carpeta XML.';
    const finalReport = { ...report, summary, importedAt: new Date().toISOString() };
    setImportReport(finalReport);
    setLastImportReport(finalReport);
    if (xmls.length > 0) {
      setArchiveStatus(summary);
    } else if (files.length > 0) {
      setArchiveStatus(summary);
    }

    if (archiveJobs.length > 0) {
      setImportProgress({ current: 0, total: archiveJobs.length, phase: 'Archivando Firebase' });
      void Promise.allSettled(archiveJobs.map(async (job, index) => {
        try {
          const result = await saveInvoiceWithLines(job.invoice, job.lines, job.xmlText);
          setImportProgress({ current: index + 1, total: archiveJobs.length, phase: 'Archivando Firebase' });
          return result;
        } catch (error) {
          console.error(error);
          setImportProgress({ current: index + 1, total: archiveJobs.length, phase: 'Archivando Firebase' });
          throw error;
        }
      })).then((results) => {
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value?.status === 'duplicate') duplicates += 1;
          else if (result.status === 'fulfilled') saved += 1;
          else localOnly += 1;
        });
        const archivedReport = {
          ...finalReport,
          saved,
          duplicateCloud: duplicates,
          localOnly,
          summary: `${finalReport.parsed}/${finalReport.xml} XML leidos localmente. ${saved} archivadas en Firebase, ${duplicates} duplicadas en Firebase, ${localOnly} solo locales.`,
        };
        setImportReport(archivedReport);
        setLastImportReport(archivedReport);
        setArchiveStatus(archivedReport.summary);
        setImportProgress(null);
      });
    }
  }, [addInvoice, addItems, setLastImportReport, state.invoices, state.items]);

  const pickXmlFolder = useCallback(async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const directoryHandle = await window.showDirectoryPicker();
        const files = await collectXmlFilesFromDirectory(directoryHandle);
        await handleFiles(files);
        setIsDropzoneExpanded(false);
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
        console.error(error);
        alert(`No pude leer la carpeta: ${error.message}`);
        return;
      }
    }

    document.getElementById('xml-folder-input').click();
  }, [handleFiles]);

  const onDrop = useCallback(async (event) => {
    event.preventDefault();
    setIsDragging(false);
    await handleFiles(Array.from(event.dataTransfer.files));
    setIsDropzoneExpanded(false);
  }, [handleFiles]);

  const downloadCSV = (data, filename) => {
    const csv = Papa.unparse(data);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportProducts = () => {
    const existing = state.items
      .filter((item) => item.isExisting && item.lineType === LINE_TYPES.INVENTORY)
      .map((item) => ({
        'Internal Reference': item.canonicalSku || item.skuOriginal,
        Cost: item.cost.toFixed(2),
        'Sales Price': item.suggestedPrice.toFixed(2),
        'Product Category': item.category,
      }));

    const newProducts = state.items
      .filter((item) => !item.isExisting && item.lineType === LINE_TYPES.INVENTORY)
      .map((item) => ({
        'Internal Reference': item.purchaseSku,
        Name: item.description,
        Cost: item.cost.toFixed(2),
        'Sales Price': item.suggestedPrice.toFixed(2),
        'Product Category': item.category,
        'Product Type': 'Storable Product',
        'Vendors/Vendor': item.provider,
        'Customer Taxes': 'IVA 16% (VENTAS)',
        'Vendor Taxes': 'IVA 16% (COMPRAS)',
      }));

    downloadCSV(existing, '1_Odoo_Actualizar_Productos_Existentes.csv');
    downloadCSV(newProducts, '2_Odoo_Crear_Productos_Nuevos.csv');
  };

  const exportInventory = () => {
    const stockData = state.items
      .filter((item) => item.lineType === LINE_TYPES.INVENTORY)
      .map((item) => ({
        'product_id/default_code': item.isExisting ? item.canonicalSku || item.skuOriginal : item.purchaseSku,
        inventory_quantity: item.quantity,
        location_id: 'WH/Stock',
        inventory_diff_quantity: item.quantity,
      }));

    if (stockData.length === 0) {
      alert('No hay líneas marcadas como inventario para cargar existencias.');
      return;
    }

    downloadCSV(stockData, '3_Odoo_Cargar_Existencias.csv');
  };

  const exportAccounting = () => {
    const accountingLines = state.items
      .filter((item) => item.lineType !== LINE_TYPES.INVENTORY && item.lineType !== LINE_TYPES.IGNORE)
      .map((item) => ({
        UUID: item.uuid,
        Fecha: item.fecha,
        Proveedor: item.provider,
        RFC: item.rfc,
        Descripcion: item.description,
        Cuenta: item.account,
        Tipo: item.odooType,
        Cantidad: item.quantity,
        Costo: item.cost.toFixed(2),
        Subtotal: item.subtotal.toFixed(2),
      }));

    downloadCSV(accountingLines, '4_Odoo_Clasificacion_Contable.csv');
  };

  const filteredItems = useMemo(() => {
    return state.items.filter((item) => {
      const haystack = [item.description, item.purchaseSku, item.skuShielded, item.provider, item.uuid, item.rfc, item.email]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      const matchesProv = !filterProv || item.provider === filterProv;
      const matchesAcct = !filterAcct || (item.account || '').startsWith(filterAcct);
      const matchesCat = !filterCat || item.category === filterCat;
      const matchesMonth = !filterMonth || (item.fecha || '').startsWith(filterMonth);
      const matchesPending = !showOnlyPending || item.reviewStatus === 'needs_review' || !item.account || !item.odooType;
      const matchesAudit = showIgnoredAudit || item.lineType !== LINE_TYPES.IGNORE;
      return matchesSearch && matchesProv && matchesAcct && matchesCat && matchesMonth && matchesPending && matchesAudit;
    });
  }, [state.items, search, filterProv, filterAcct, filterCat, filterMonth, showOnlyPending, showIgnoredAudit]);

  const groupedData = useMemo(() => {
    const groups = {};
    filteredItems.forEach((item) => {
      const key = groupBy === 'provider' ? item.provider : item.uuid;
      groups[key] = groups[key] || [];
      groups[key].push(item);
    });
    return groups;
  }, [filteredItems, groupBy]);

  const uniqueProvs = [...new Set(state.items.map((item) => item.provider))].sort();
  const uniqueMonths = [...new Set(state.items.map((item) => (item.fecha || '').substring(0, 7)))].filter(Boolean).sort().reverse();
  const uniqueCategories = [...new Set(state.items.map((item) => item.category))].filter(Boolean).sort();

  const toggleGroupSelection = (items, selected) => {
    const ids = items.map((item) => item.id);
    const next = new Set(state.selectedIds);
    if (selected) ids.forEach((id) => next.add(id));
    else ids.forEach((id) => next.delete(id));
    selectAll([...next]);
  };

  const applyToGroup = (items, updates) => {
    bulkUpdate(new Set(items.map((item) => item.id)), updates);
  };

  const ignoredCount = state.items.filter((item) => item.lineType === LINE_TYPES.IGNORE).length;

  const clearFilters = useCallback(() => {
    setSearch('');
    setFilterProv('');
    setFilterAcct('');
    setFilterCat('');
    setFilterMonth('');
    setShowOnlyPending(false);
    setShowIgnoredAudit(ignoredCount > 0);
  }, [ignoredCount]);

  const hasActiveFilters = Boolean(search || filterProv || filterAcct || filterCat || filterMonth || showOnlyPending || (ignoredCount > 0 && !showIgnoredAudit));

  const handleClearSession = useCallback(() => {
    clearSession();
    setImportReport(null);
    setArchiveStatus('');
  }, [clearSession]);

  const stats = {
    total: state.items.reduce((acc, curr) => acc + curr.subtotal, 0),
    filteredTotal: filteredItems.reduce((acc, curr) => acc + curr.subtotal, 0),
    invoiceCount: Math.max(Object.keys(state.invoices || {}).length, new Set(state.items.map((item) => item.uuid)).size),
    visibleInvoiceCount: new Set(filteredItems.map((item) => item.uuid)).size,
    lineCount: state.items.length,
    visibleLineCount: filteredItems.length,
    pending: state.items.filter((item) => item.reviewStatus === 'needs_review' || !item.account || !item.odooType).length,
    visiblePending: filteredItems.filter((item) => item.reviewStatus === 'needs_review' || !item.account || !item.odooType).length,
    ignored: ignoredCount,
    existing: state.items.filter((item) => item.isExisting).length,
  };
  const importedXmlCount = activeImportReport?.xml || 0;
  const importedUniqueUuidCount = activeImportReport?.uniqueUuids || activeImportReport?.invoiceFiles?.length || 0;
  const hasImportMismatch = importedXmlCount > 0 && importedUniqueUuidCount > 0 && importedUniqueUuidCount !== importedXmlCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="HerraMax Plus" className="h-16 w-auto object-contain" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Purchasing Intelligence</h1>
          <p className="text-xs text-slate-400 font-medium">Auditoría y automatización de facturas XML</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Importado" value={`$${stats.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} sub={`${stats.lineCount} líneas cargadas`} icon={TrendingUp} color="bg-blue-500" />
        <StatCard
          label="Facturas Cargadas"
          value={hasImportMismatch ? `${stats.invoiceCount}/${importedXmlCount}` : stats.invoiceCount}
          sub={hasImportMismatch ? 'cargadas / XML recibidos' : `${stats.visibleInvoiceCount} visibles ahora`}
          icon={FileText}
          color={hasImportMismatch ? 'bg-red-500' : 'bg-amber-500'}
        />
        <StatCard label="Pendientes Totales" value={stats.pending} sub={`${stats.visiblePending} visibles ahora`} icon={AlertTriangle} color={stats.pending > 0 ? 'bg-red-500' : 'bg-green-500'} />
        <StatCard label="Odoo Match" value={stats.existing} sub="productos existentes" icon={Calculator} color="bg-purple-500" />
      </div>

      {activeImportReport && (
        <div className={cn('rounded-2xl border p-4 shadow-xl', hasImportMismatch ? 'border-red-500/30 bg-red-500/10' : 'border-green-500/20 bg-green-500/10')}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <p className={cn('text-xs font-black uppercase tracking-widest', hasImportMismatch ? 'text-red-300' : 'text-green-300')}>Ultima importacion XML</p>
              <p className="text-sm text-slate-100 font-bold">
                Seleccionados: {activeImportReport.selected} · XML recibidos: {activeImportReport.xml} · UUID unicos: {importedUniqueUuidCount} · Lineas nuevas: {activeImportReport.addedLines ?? activeImportReport.lines} · Fallidas: {activeImportReport.failed?.length || 0}
              </p>
              {hasImportMismatch && (
                <p className="mt-1 text-xs text-red-100">
                  Hay {importedXmlCount - importedUniqueUuidCount} XML que no terminaron como factura unica. Abre el diagnostico de abajo para ver si fueron duplicadas, fallidas o no llegaron completas desde Google Drive.
                </p>
              )}
            </div>
            <button onClick={() => setIsDropzoneExpanded(true)} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-black uppercase tracking-widest text-white transition-all">
              Revisar / reimportar
            </button>
          </div>
        </div>
      )}

      {importProgress && (
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 shadow-xl">
          <p className="text-xs font-black uppercase tracking-widest text-blue-300">{importProgress.phase}</p>
          <p className="text-sm text-slate-100 font-bold">{importProgress.current} / {importProgress.total}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900">
            <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${Math.min(100, Math.round((importProgress.current / Math.max(1, importProgress.total)) * 100))}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button onClick={() => setGroupBy(groupBy === 'uuid' ? 'provider' : 'uuid')} className="glass p-4 rounded-2xl text-left hover:bg-white/5 transition-all">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Modo Vista</p>
          <p className="text-lg font-black text-white">{groupBy === 'uuid' ? 'Por Factura' : 'Por Proveedor'}</p>
        </button>
        <button
          onClick={() => ignoredCount > 0 && setShowIgnoredAudit(!showIgnoredAudit)}
          disabled={ignoredCount === 0}
          className={cn('glass p-4 rounded-2xl text-left transition-all', ignoredCount > 0 && 'hover:bg-white/5', showIgnoredAudit && ignoredCount > 0 && 'ring-2 ring-red-400/40', ignoredCount === 0 && 'opacity-70 cursor-not-allowed')}
        >
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Auditoria Ignorados</p>
          <p className="text-lg font-black text-white">{ignoredCount > 0 ? (showIgnoredAudit ? 'Visible' : 'Oculta') : 'Sin ignorados'} - {stats.ignored} lineas</p>
        </button>
      </div>

      <div className="relative group/dropzone">
        {!isDropzoneExpanded && state.items.length > 0 && (
          <button onClick={() => setIsDropzoneExpanded(true)} className="w-full py-3 glass border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-blue-400 hover:bg-blue-500/10 transition-all flex items-center justify-center gap-2">
            <Upload className="w-4 h-4" />
            Añadir más facturas XML
          </button>
        )}

        <div
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={cn(
            'glass rounded-3xl transition-all flex flex-col items-center justify-center gap-4 group relative overflow-hidden',
            isDragging ? 'border-2 border-dashed border-blue-500 bg-blue-500/10 scale-[1.01]' : 'border-2 border-dashed border-white/10 hover:border-white/20 hover:bg-white/5',
            isDropzoneExpanded ? 'p-10 h-auto opacity-100' : 'h-0 p-0 opacity-0 pointer-events-none'
          )}
        >
          <input id="xml-input" type="file" multiple accept={xmlAccept} className="hidden" onChange={(event) => { handleFiles(Array.from(event.target.files)); event.target.value = ''; setIsDropzoneExpanded(false); }} />
          <input id="xml-folder-input" type="file" multiple webkitdirectory="" directory="" accept={xmlAccept} className="hidden" onChange={(event) => { handleFiles(Array.from(event.target.files)); event.target.value = ''; setIsDropzoneExpanded(false); }} />
          <div className="p-4 rounded-full bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
            <Upload className="w-8 h-8" />
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-white tracking-tight">Arrastra tus facturas XML aquí</p>
            <p className="text-sm text-slate-500 font-medium">elige archivos XML o importa toda la carpeta sincronizada</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={() => document.getElementById('xml-input').click()} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all">
              <Upload className="w-4 h-4" />
              Elegir XML
            </button>
            <button type="button" onClick={pickXmlFolder} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/15 text-slate-100 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
              <FolderOpen className="w-4 h-4" />
              Importar carpeta XML
            </button>
          </div>
        </div>
      </div>

      <div className="glass p-4 rounded-2xl border-white/5 space-y-4 shadow-xl">
        {hasActiveFilters && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-amber-300">Vista filtrada</p>
              <p className="text-sm text-slate-200">
                Mostrando {stats.visibleLineCount} de {stats.lineCount} líneas y {stats.visibleInvoiceCount} de {stats.invoiceCount} facturas.
              </p>
            </div>
            <button onClick={clearFilters} className="px-4 py-2 rounded-xl bg-amber-500 text-black text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition-all">
              Ver todo
            </button>
          </div>
        )}
        {archiveStatus && (
          <div className="px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-xs font-bold text-green-300">
            {archiveStatus}
          </div>
        )}
        {activeImportReport && (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            <ReportPill label="Seleccionados" value={activeImportReport.selected} />
            <ReportPill label="XML" value={activeImportReport.xml} />
            <ReportPill label="Leidos" value={activeImportReport.parsed} />
            <ReportPill label="UUID unicos" value={activeImportReport.uniqueUuids || activeImportReport.invoiceFiles?.length || activeImportReport.parsed} />
            <ReportPill label="Lineas nuevas" value={activeImportReport.addedLines ?? activeImportReport.lines} />
            <ReportPill label="Ya cargadas" value={activeImportReport.duplicateLocal} />
            <ReportPill label="Lineas total" value={activeImportReport.lines} />
            <ReportPill label="Revision" value={activeImportReport.review} tone={activeImportReport.review ? 'warn' : 'ok'} />
            <ReportPill label="Fallidas" value={activeImportReport.failed.length} tone={activeImportReport.failed.length ? 'bad' : 'ok'} />
            {(activeImportReport.selected !== activeImportReport.xml || activeImportReport.failed.length > 0 || activeImportReport.duplicateFiles?.length > 0 || activeImportReport.skippedDuplicateLines > 0) && (
              <div className="col-span-2 md:col-span-4 xl:col-span-8 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                <div className="flex items-center gap-2 font-black uppercase tracking-widest mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  Diagnostico de importacion
                </div>
                {activeImportReport.selected !== activeImportReport.xml && (
                  <p>El navegador recibio {activeImportReport.selected} archivos, pero solo {activeImportReport.xml} eran XML. Si seleccionaste mas XML en Windows, usa Importar carpeta XML o arrastra la carpeta completa.</p>
                )}
                {activeImportReport.skippedDuplicateLines > 0 && (
                  <p>{activeImportReport.skippedDuplicateLines} lineas ya existian en la sesion y no se duplicaron.</p>
                )}
                {activeImportReport.duplicateFiles?.length > 0 && (
                  <p>{activeImportReport.duplicateFiles.length} archivos tienen UUID ya cargado o repetido en la seleccion.</p>
                )}
                {activeImportReport.failed.length > 0 && (
                  <p>{activeImportReport.failed.length} XML no se pudieron leer; abre Archivos no importados abajo para ver nombres y errores.</p>
                )}
              </div>
            )}
            {activeImportReport.invoiceFiles?.length > 0 && (
              <details className="col-span-2 md:col-span-4 xl:col-span-8 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
                <summary className="cursor-pointer font-black uppercase tracking-widest text-blue-300">
                  Ver archivos factura leidos ({activeImportReport.invoiceFiles.length})
                </summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-auto">
                  {activeImportReport.invoiceFiles.map((invoice) => (
                    <div key={`${invoice.uuid}-${invoice.file}`} className="rounded-lg bg-background/60 px-3 py-2">
                      <p className="font-mono text-slate-100 truncate">{invoice.file}</p>
                      <p className="text-slate-500">{invoice.provider} · *{invoice.uuid.slice(-12)} · {invoice.lines} lineas ({invoice.addedLines ?? invoice.lines} nuevas)</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
            {activeImportReport.duplicateFiles?.length > 0 && (
              <details className="col-span-2 md:col-span-4 xl:col-span-8 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                <summary className="cursor-pointer font-black uppercase tracking-widest text-amber-300">
                  Ver duplicadas ({activeImportReport.duplicateFiles.length})
                </summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto">
                  {activeImportReport.duplicateFiles.map((duplicate) => (
                    <div key={`${duplicate.uuid}-${duplicate.file}`} className="rounded-lg bg-background/60 px-3 py-2">
                      <p className="font-mono text-slate-100 truncate">{duplicate.file}</p>
                      <p className="text-amber-200">*{duplicate.uuid.slice(-12)} - {duplicate.reason}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
            {activeImportReport.failed.length > 0 && (
              <div className="col-span-2 md:col-span-4 xl:col-span-8 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
                <div className="flex items-center gap-2 font-black uppercase tracking-widest mb-2">
                  <XCircle className="w-4 h-4" />
                  Archivos no importados
                </div>
                {activeImportReport.failed.slice(0, 6).map((failure) => (
                  <p key={failure.file} className="font-mono">{failure.file}: {failure.reason}</p>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[240px] relative group">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar SKU, descripción, folio, RFC..." className="w-full bg-background/50 border border-white/10 rounded-xl pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <select value={filterProv} onChange={(event) => setFilterProv(event.target.value)} className="bg-background/50 border border-white/10 rounded-xl px-4 py-2 text-xs focus:outline-none min-w-[180px]">
            <option value="">Proveedores</option>
            {uniqueProvs.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
          </select>
          <select value={filterCat} onChange={(event) => setFilterCat(event.target.value)} className="bg-background/50 border border-white/10 rounded-xl px-4 py-2 text-xs focus:outline-none min-w-[180px]">
            <option value="">Categorías</option>
            {uniqueCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={filterAcct} onChange={(event) => setFilterAcct(event.target.value)} className="bg-background/50 border border-white/10 rounded-xl px-4 py-2 text-xs focus:outline-none min-w-[180px]">
            <option value="">Cuentas</option>
            {CUENTAS.map((account) => <option key={account.codigo} value={account.codigo}>{account.codigo} — {account.nombre}</option>)}
          </select>
          <select value={filterMonth} onChange={(event) => setFilterMonth(event.target.value)} className="bg-background/50 border border-white/10 rounded-xl px-4 py-2 text-xs focus:outline-none">
            <option value="">Periodo</option>
            {uniqueMonths.map((month) => <option key={month} value={month}>{month}</option>)}
          </select>
          <button onClick={() => setShowOnlyPending(!showOnlyPending)} className={cn('px-4 py-2 rounded-xl text-xs font-bold transition-all border', showOnlyPending ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10')}>
            Solo Pendientes
          </button>
          <button
            onClick={() => ignoredCount > 0 && setShowIgnoredAudit(!showIgnoredAudit)}
            disabled={ignoredCount === 0}
            className={cn('px-4 py-2 rounded-xl text-xs font-bold transition-all border', showIgnoredAudit && ignoredCount > 0 ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10', ignoredCount === 0 && 'opacity-50 cursor-not-allowed hover:bg-white/5')}
          >
            Auditoria Ignorados
          </button>
          <button onClick={reclassifyItems} className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500 text-blue-300 hover:text-white border border-blue-500/50 rounded-xl transition-all">
            <RefreshCcw className="w-4 h-4" />
            <span className="text-xs font-bold">Recalcular</span>
          </button>
          <button onClick={clearFilters} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/50 rounded-xl transition-all">
            <RefreshCcw className="w-4 h-4" />
            <span className="text-xs font-bold">Ver Todo</span>
          </button>
          <button onClick={handleClearSession} className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/50 rounded-xl transition-all">
            <RefreshCcw className="w-4 h-4" />
            <span className="text-xs font-bold">Limpiar Todo</span>
          </button>
          <button onClick={exportProducts} className="flex items-center gap-2 px-5 py-2.5 bg-secondary hover:bg-amber-500 text-black rounded-xl transition-all shadow-lg shadow-amber-500/20 ml-auto">
            <Download className="w-4 h-4" />
            <span className="text-sm font-bold">Productos</span>
          </button>
          <button onClick={exportInventory} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20">
            <Box className="w-4 h-4" />
            <span className="text-sm font-bold">Existencias</span>
          </button>
          <button onClick={exportAccounting} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all shadow-lg shadow-purple-500/20">
            <Download className="w-4 h-4" />
            <span className="text-sm font-bold">Contabilidad</span>
          </button>
        </div>
      </div>

      {filteredItems.length > 0 && (
        <div className="glass rounded-2xl overflow-hidden border-white/5 shadow-premium animate-fade-in">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-4 w-10">
                    <button onClick={() => state.selectedIds.size > 0 ? clearSelection() : selectAll(filteredItems.map((item) => item.id))}>
                      {state.selectedIds.size === filteredItems.length && filteredItems.length > 0 ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Identificador / RFC</th>
                  <th className="px-6 py-4">SKU Compra</th>
                  <th className="px-6 py-4">Descripción / Categoría</th>
                  <th className="px-6 py-4">Tipo Odoo</th>
                  <th className="px-6 py-4">Cuenta Mayor</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {Object.entries(groupedData).map(([groupName, items]) => (
                  <React.Fragment key={groupName}>
                    <tr className="bg-blue-500/5 border-y border-white/5 group/header">
                      <td className="px-6 py-2">
                        <button onClick={() => toggleGroupSelection(items, !items.every((item) => state.selectedIds.has(item.id)))}>
                          {items.every((item) => state.selectedIds.has(item.id)) ? <CheckSquare className="w-3.5 h-3.5 text-blue-400" /> : <Square className="w-3.5 h-3.5 text-slate-600" />}
                        </button>
                      </td>
                      <td colSpan="3" className="px-2 py-2">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{groupBy === 'uuid' ? 'Factura' : 'Proveedor'}:</span>
                          <span className="text-xs font-bold text-white truncate max-w-[300px]">{groupBy === 'uuid' ? `*${groupName.slice(-12)}` : groupName}</span>
                          <span className="text-[10px] text-slate-500 font-bold">({items.length} líneas · ${items.reduce((sum, item) => sum + item.subtotal, 0).toLocaleString('es-MX')} MXN)</span>
                        </div>
                      </td>
                      <td className="px-6 py-2" colSpan="3">
                        <div className="flex items-center gap-2">
                          <select onChange={(event) => applyToGroup(items, { odooType: event.target.value })} className="bg-slate-800/50 text-[10px] font-bold uppercase text-white border border-white/10 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="">Tipo Bloque →</option>
                            {TIPOS_ODOO.map((type) => <option key={type} value={type}>{type}</option>)}
                          </select>
                          <select onChange={(event) => applyToGroup(items, { account: event.target.value })} className="bg-slate-800/50 text-[10px] font-bold uppercase text-white border border-white/10 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[220px]">
                            <option value="">Cuenta Bloque →</option>
                            {CUENTAS.map((account) => <option key={account.codigo} value={`${account.codigo} — ${account.nombre}`}>{account.codigo} — {account.nombre}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-2 text-right">
                        <button onClick={() => { if (confirm('¿Borrar factura completa?')) removeItem(items[0].uuid); }} className="p-1.5 rounded-lg hover:bg-red-500 text-slate-600 hover:text-white transition-all opacity-0 group-hover/header:opacity-100 shadow-lg shadow-red-500/20">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    {items.map((item) => (
                      <tr key={item.id} className={cn('hover:bg-white/5 transition-colors group', state.selectedIds.has(item.id) && 'bg-blue-500/5')}>
                        <td className="px-6 py-4">
                          <button onClick={() => toggleSelection(item.id)}>
                            {state.selectedIds.has(item.id) ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4 text-slate-700 group-hover:text-slate-500" />}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {item.reviewStatus === 'ready' && item.account && item.odooType ? <ShieldCheck className="w-4 h-4 text-success" /> : <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />}
                            <span className={cn('text-[9px] font-black uppercase', item.reviewStatus === 'ready' && item.account && item.odooType ? 'text-success' : 'text-red-500')}>
                              {item.reviewStatus === 'ready' && item.account && item.odooType ? 'Ready' : 'Review'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-mono text-slate-300">*{item.uuid.slice(-8)}</span>
                            <div className="flex items-center gap-1">
                              <Fingerprint className="w-3 h-3 text-slate-600" />
                              <span className="text-[9px] text-slate-500 font-bold uppercase">{item.rfc || 'S/N'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-black text-amber-400 font-mono tracking-tight">{item.purchaseSku || item.skuShielded}</span>
                            <span className={cn('text-[9px] font-black uppercase tracking-widest', item.isExisting ? 'text-green-400' : 'text-blue-400')}>
                              {item.isExisting ? `Odoo: ${item.canonicalSku}` : 'Nuevo producto'}
                            </span>
                            {item.ecommerceEligible && <span className="text-[9px] font-black uppercase tracking-widest text-pink-300">Ecommerce stock canonico</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col max-w-[260px]">
                            <span className="text-xs text-slate-200 truncate font-semibold" title={item.description}>{item.description}</span>
                            <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider">{item.category}</span>
                            <span className="text-[9px] text-slate-600">{item.reason}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <select value={item.odooType || ''} onChange={(event) => updateItem(item.id, { odooType: event.target.value, reviewStatus: 'ready' })} className="bg-slate-900 border border-white/10 rounded-lg text-[10px] px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-white w-full">
                            <option value="">Sin Tipo...</option>
                            {TIPOS_ODOO.map((type) => <option key={type} value={type}>{type}</option>)}
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <select value={item.account || ''} onChange={(event) => updateItem(item.id, { account: event.target.value, reviewStatus: 'ready' })} className="bg-slate-900 border border-white/10 rounded-lg text-[10px] px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-white w-full max-w-[240px]">
                            <option value="">Sin Cuenta...</option>
                            {CUENTAS.map((account) => <option key={account.codigo} value={`${account.codigo} — ${account.nombre}`}>{account.codigo} — {account.nombre}</option>)}
                          </select>
                        </td>
                        <td className="px-6 py-4 text-right text-xs font-bold text-white">${item.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => { if (confirm('¿Eliminar esta línea?')) deleteLine(item.id); }} className="p-1 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon, color, onClick, active }) {
  return (
    <div onClick={onClick} className={cn('glass p-6 rounded-2xl flex items-start justify-between group relative overflow-hidden transition-all duration-300', onClick && 'cursor-pointer hover:scale-[1.02]', active && 'ring-2 ring-white/20')}>
      <div className={cn('absolute bottom-0 left-0 h-1 transition-all duration-300 w-full opacity-30 group-hover:opacity-100', color, active && 'opacity-100 h-1.5')} />
      <div className="space-y-1">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-black tracking-tighter">{value}</p>
        <p className="text-[10px] text-slate-500 font-bold">{sub}</p>
      </div>
      <div className={cn('p-2 rounded-xl text-white shadow-lg', color)}>
        {React.createElement(icon, { className: 'w-5 h-5' })}
      </div>
    </div>
  );
}

function ReportPill({ label, value, tone }) {
  const colors = {
    ok: 'border-green-500/20 bg-green-500/10 text-green-300',
    warn: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    bad: 'border-red-500/20 bg-red-500/10 text-red-300',
  };

  return (
    <div className={cn('rounded-xl border px-3 py-2 bg-white/5 border-white/10', colors[tone])}>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="text-lg font-black text-white">{Number(value || 0).toLocaleString('es-MX')}</p>
    </div>
  );
}

function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
