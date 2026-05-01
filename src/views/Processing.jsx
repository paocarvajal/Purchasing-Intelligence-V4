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
  Square,
  Trash2,
  TrendingUp,
  Upload,
} from 'lucide-react';
import Papa from 'papaparse';
import { LINE_TYPES } from '../core/business-rules';
import { CUENTAS, TIPOS_ODOO } from '../core/odoo-logic';
import { saveInvoiceWithLines } from '../core/persistence';
import { parseInvoiceXmlWithMetadata } from '../core/xml-parser';
import { useStore } from '../store/useStore';

export default function Processing() {
  const {
    state,
    addItems,
    removeItem,
    deleteLine,
    clearSession,
    updateItem,
    toggleSelection,
    selectAll,
    clearSelection,
    bulkUpdate,
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
  const [archiveStatus, setArchiveStatus] = useState('');

  const handleFiles = useCallback(async (files) => {
    const xmls = files.filter((file) => file.name.toLowerCase().endsWith('.xml'));
    let saved = 0;
    let duplicates = 0;
    let localOnly = 0;
    for (const file of xmls) {
      try {
        const { invoice, lines, xmlText } = await parseInvoiceXmlWithMetadata(file);
        addItems(lines);
        try {
          const result = await saveInvoiceWithLines(invoice, lines, xmlText);
          if (result.status === 'duplicate') duplicates += 1;
          else saved += 1;
        } catch (cloudError) {
          console.error(cloudError);
          localOnly += 1;
        }
      } catch (error) {
        console.error(error);
      }
    }
    if (xmls.length > 0) {
      setArchiveStatus(`${saved} archivadas en Firebase, ${duplicates} duplicadas, ${localOnly} solo locales.`);
    }
  }, [addItems]);

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

  const stats = {
    total: filteredItems.reduce((acc, curr) => acc + curr.subtotal, 0),
    count: new Set(filteredItems.map((item) => item.uuid)).size,
    pending: filteredItems.filter((item) => item.reviewStatus === 'needs_review' || !item.account || !item.odooType).length,
    ignored: state.items.filter((item) => item.lineType === LINE_TYPES.IGNORE).length,
    existing: filteredItems.filter((item) => item.isExisting).length,
  };

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
        <StatCard label="Gasto Filtrado" value={`$${stats.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} sub={`${filteredItems.length} líneas`} icon={TrendingUp} color="bg-blue-500" />
        <StatCard label="Facturas" value={stats.count} sub="en vista actual" icon={FileText} color="bg-amber-500" />
        <StatCard label="Pendientes" value={stats.pending} sub="requieren revisión" icon={AlertTriangle} color={stats.pending > 0 ? 'bg-red-500' : 'bg-green-500'} onClick={() => setShowOnlyPending(!showOnlyPending)} active={showOnlyPending} />
        <StatCard label="Odoo Match" value={stats.existing} sub="productos existentes" icon={Calculator} color="bg-purple-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button onClick={() => setGroupBy(groupBy === 'uuid' ? 'provider' : 'uuid')} className="glass p-4 rounded-2xl text-left hover:bg-white/5 transition-all">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Modo Vista</p>
          <p className="text-lg font-black text-white">{groupBy === 'uuid' ? 'Por Factura' : 'Por Proveedor'}</p>
        </button>
        <button onClick={() => setShowIgnoredAudit(!showIgnoredAudit)} className={cn('glass p-4 rounded-2xl text-left hover:bg-white/5 transition-all', showIgnoredAudit && 'ring-2 ring-red-400/40')}>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Auditoria Ignorados</p>
          <p className="text-lg font-black text-white">{showIgnoredAudit ? 'Visible' : 'Oculta'} - {stats.ignored} lineas</p>
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
          onClick={() => document.getElementById('xml-input').click()}
          className={cn(
            'glass rounded-3xl transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group relative overflow-hidden',
            isDragging ? 'border-2 border-dashed border-blue-500 bg-blue-500/10 scale-[1.01]' : 'border-2 border-dashed border-white/10 hover:border-white/20 hover:bg-white/5',
            isDropzoneExpanded ? 'p-10 h-auto opacity-100' : 'h-0 p-0 opacity-0 pointer-events-none'
          )}
        >
          <input id="xml-input" type="file" multiple accept=".xml" className="hidden" onChange={(event) => { handleFiles(Array.from(event.target.files)); setIsDropzoneExpanded(false); }} />
          <div className="p-4 rounded-full bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
            <Upload className="w-8 h-8" />
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-white tracking-tight">Arrastra tus facturas XML aquí</p>
            <p className="text-sm text-slate-500 font-medium">o haz clic para buscar archivos en tu computadora</p>
          </div>
        </div>
      </div>

      <div className="glass p-4 rounded-2xl border-white/5 space-y-4 shadow-xl">
        {archiveStatus && (
          <div className="px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-xs font-bold text-green-300">
            {archiveStatus}
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
          <button onClick={() => setShowIgnoredAudit(!showIgnoredAudit)} className={cn('px-4 py-2 rounded-xl text-xs font-bold transition-all border', showIgnoredAudit ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10')}>
            Auditoria Ignorados
          </button>
          <button onClick={clearSession} className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/50 rounded-xl transition-all">
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

function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
