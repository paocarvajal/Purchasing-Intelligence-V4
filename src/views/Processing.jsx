import React, { useState, useCallback, useMemo } from 'react';
import { 
  Upload, 
  FileText, 
  Trash2, 
  ShieldCheck, 
  Calculator, 
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Filter,
  Download,
  Search,
  CheckSquare,
  Square,
  AlertTriangle,
  Fingerprint,
  RefreshCcw,
  BookOpen
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { parseInvoiceXml } from '../core/xml-parser';
import { CUENTAS, TIPOS_ODOO } from '../core/odoo-logic';
import Papa from 'papaparse';

export default function Processing() {
  const { state, addItems, removeItem, deleteLine, clearSession, updateItem, toggleSelection, selectAll, clearSelection, bulkUpdate } = useStore();
  const [isDragging, setIsDragging] = useState(false);
  const [search, setSearch] = useState('');
  
  // Advanced Filters
  const [filterProv, setFilterProv] = useState('');
  const [filterAcct, setFilterAcct] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [isDropzoneExpanded, setIsDropzoneExpanded] = useState(state.items.length === 0);
  const [groupBy, setGroupBy] = useState('uuid'); 

  const onDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
    setIsDropzoneExpanded(false); // Colapsar después de subir
  }, [state.items.length]);

  const handleFiles = async (files) => {
    // Separate XMLs and potentially a CSV for accounts
    const xmls = files.filter(f => f.name.toLowerCase().endsWith('.xml'));
    
    if (xmls.length > 0) {
      for (const f of xmls) {
        try {
          const lines = await parseInvoiceXml(f);
          addItems(lines);
        } catch (err) { console.error(err); }
      }
    }
  };

  const exportAll = () => {
    if (state.items.length === 0) return;
    
    // Solo lo que YA existe en Odoo
    const existing = state.items
      .filter(i => i.isExisting)
      .map(i => ({ 
        'Internal Reference': i.skuOriginal, 
        'Cost': i.cost.toFixed(2), 
        'Sales Price': i.suggestedPrice.toFixed(2), 
        'Product Category': i.category 
      }));

    // Solo lo que es NUEVO y de tipo PRODUCTO (Mercancía)
    const architecture = state.items
      .filter(i => !i.isExisting && i.odooType === 'Producto')
      .map(i => ({ 
        'Internal Reference': i.skuShielded, 
        'Name': i.description, 
        'Cost': i.cost.toFixed(2), 
        'Sales Price': i.suggestedPrice.toFixed(2), 
        'Product Category': i.category,
        'Vendor': i.provider // Añadimos el proveedor para poder filtrar en Odoo
      }));

    downloadCSV(existing, '1_Odoo_Actualizar_Existentes.csv');
    downloadCSV(architecture, '2_Odoo_Importar_Nuevos_Estructura.csv');
  };

  const downloadCSV = (data, filename) => {
    const csv = Papa.unparse(data);
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredItems = useMemo(() => {
    return state.items.filter(i => {
      const matchesSearch = !search || [i.description, i.skuShielded, i.provider, i.uuid, i.rfc, i.email].some(v => (v || '').toLowerCase().includes(search.toLowerCase()));
      const matchesProv = !filterProv || i.provider === filterProv;
      const matchesAcct = !filterAcct || (i.account || '').startsWith(filterAcct);
      const matchesCat = !filterCat || i.category === filterCat;
      const matchesMonth = !filterMonth || (i.fecha || '').startsWith(filterMonth);
      const matchesPending = !showOnlyPending || !i.account || !i.odooType;
      return matchesSearch && matchesProv && matchesAcct && matchesCat && matchesMonth && matchesPending;
    });
  }, [state.items, search, filterProv, filterAcct, filterCat, filterMonth, showOnlyPending]);

  const groupedData = useMemo(() => {
    if (groupBy === 'none') return { 'Todas las líneas': filteredItems };
    const groups = {};
    filteredItems.forEach(i => {
      const key = groupBy === 'uuid' ? i.uuid : i.provider;
      if (!groups[key]) groups[key] = [];
      groups[key].push(i);
    });
    return groups;
  }, [filteredItems, groupBy]);

  const uniqueProvs = [...new Set(state.items.map(i => i.provider))].sort();
  const uniqueMonths = [...new Set(state.items.map(i => (i.fecha || '').substring(0, 7)))].sort().reverse();

  const toggleGroupSelection = (items, selected) => {
    const ids = items.map(i => i.id);
    const next = new Set(state.selectedIds);
    if (selected) ids.forEach(id => next.add(id)); else ids.forEach(id => next.delete(id));
    selectAll([...next]);
  };

  const applyToGroup = (items, updates) => {
    const ids = new Set(items.map(i => i.id));
    bulkUpdate(ids, updates);
  };

  const stats = {
    total: filteredItems.reduce((acc, curr) => acc + curr.subtotal, 0),
    count: new Set(filteredItems.map(i => i.uuid)).size,
    pending: filteredItems.filter(i => !i.account || !i.odooType).length
  };

  return (
    <div className="space-y-6">
      {/* KPI Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Gasto Filtrado" value={`$${stats.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} sub={`${filteredItems.length} líneas`} icon={TrendingUp} color="bg-blue-500" />
        <StatCard label="Facturas" value={stats.count} sub="en vista actual" icon={FileText} color="bg-amber-500" />
        <StatCard 
          label="Pendientes" 
          value={stats.pending} 
          sub="sin cuenta/tipo" 
          icon={AlertTriangle} 
          color={stats.pending > 0 ? "bg-red-500" : "bg-green-500"} 
          onClick={() => setShowOnlyPending(!showOnlyPending)}
          active={showOnlyPending}
        />
        <StatCard label="Modo Vista" value={groupBy === 'uuid' ? 'Por Factura' : 'Por Proveedor'} sub="clic para cambiar" icon={Calculator} color="bg-purple-500" onClick={() => setGroupBy(groupBy === 'uuid' ? 'provider' : 'uuid')} />
      </div>

      {/* Dropzone Collapsible */}
      <div className="relative group/dropzone">
        {!isDropzoneExpanded && state.items.length > 0 && (
          <button 
            onClick={() => setIsDropzoneExpanded(true)}
            className="w-full py-3 glass border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-blue-400 hover:bg-blue-500/10 transition-all flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Añadir más facturas XML
          </button>
        )}

        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('xml-input').click()}
          className={cn(
            "glass rounded-3xl transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group relative overflow-hidden",
            isDragging ? "border-2 border-dashed border-blue-500 bg-blue-500/10 scale-[1.01]" : "border-2 border-dashed border-white/10 hover:border-white/20 hover:bg-white/5",
            isDropzoneExpanded ? "p-10 h-auto opacity-100" : "h-0 p-0 opacity-0 pointer-events-none"
          )}
        >
          {isDropzoneExpanded && state.items.length > 0 && (
             <button 
               onClick={(e) => { e.stopPropagation(); setIsDropzoneExpanded(false); }}
               className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
             >
               <RefreshCcw className="w-4 h-4" />
             </button>
          )}
          <input id="xml-input" type="file" multiple accept=".xml" className="hidden" onChange={(e) => { handleFiles(Array.from(e.target.files)); setIsDropzoneExpanded(false); }} />
          <div className="p-4 rounded-full bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
            <Upload className="w-8 h-8" />
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-white tracking-tight">Arrastra tus facturas XML aquí</p>
            <p className="text-sm text-slate-500 font-medium">o haz clic para buscar archivos en tu computadora</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass p-4 rounded-2xl border-white/5 space-y-4 shadow-xl">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[240px] relative group">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar SKU, descripción, folio, RFC..." 
              className="w-full bg-background/50 border border-white/10 rounded-xl pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          
          <select value={filterProv} onChange={(e) => setFilterProv(e.target.value)} className="bg-background/50 border border-white/10 rounded-xl px-4 py-2 text-xs focus:outline-none min-w-[180px]">
            <option value="">Proveedores (Todos)</option>
            {uniqueProvs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="bg-background/50 border border-white/10 rounded-xl px-4 py-2 text-xs focus:outline-none">
            <option value="">Periodo (Todos)</option>
            {uniqueMonths.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <button 
            onClick={() => setShowOnlyPending(!showOnlyPending)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
              showOnlyPending ? "bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
            )}
          >
            Solo Pendientes
          </button>

          <div className="h-10 w-px bg-white/10 mx-1" />

          <button onClick={clearSession} className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/50 rounded-xl transition-all">
            <RefreshCcw className="w-4 h-4" />
            <span className="text-xs font-bold">Limpiar Todo</span>
          </button>

          <button onClick={exportAll} className="flex items-center gap-2 px-6 py-2.5 bg-secondary hover:bg-amber-500 text-black rounded-xl transition-all shadow-lg shadow-amber-500/20 ml-auto">
            <Download className="w-4 h-4" />
            <span className="text-sm font-bold">Exportar Todo</span>
          </button>
        </div>
      </div>

      {/* Table and rest of the UI... */}
      {filteredItems.length > 0 && (
         <div className="glass rounded-2xl overflow-hidden border-white/5 shadow-premium animate-fade-in">
           <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-white/5 border-b border-white/5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                   <th className="px-6 py-4 w-10">
                     <button onClick={() => state.selectedIds.size > 0 ? clearSelection() : selectAll(filteredItems.map(i => i.id))}>
                       {state.selectedIds.size === filteredItems.length && filteredItems.length > 0 ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                     </button>
                   </th>
                   <th className="px-6 py-4">Status</th>
                   <th className="px-6 py-4">Identificador / RFC</th>
                   <th className="px-6 py-4">SKU Protegido</th>
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
                         <button onClick={() => {
                           const allSelected = items.every(i => state.selectedIds.has(i.id));
                           toggleGroupSelection(items, !allSelected);
                         }}>
                           {items.every(i => state.selectedIds.has(i.id)) ? <CheckSquare className="w-3.5 h-3.5 text-blue-400" /> : <Square className="w-3.5 h-3.5 text-slate-600" />}
                         </button>
                       </td>
                       <td colSpan="3" className="px-2 py-2">
                         <div className="flex items-center gap-3">
                           <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{groupBy === 'uuid' ? 'Factura' : 'Proveedor'}:</span>
                           <span className="text-xs font-bold text-white truncate max-w-[300px]">{groupBy === 'uuid' ? `*${groupName.slice(-12)}` : groupName}</span>
                           <span className="text-[10px] text-slate-500 font-bold">({items.length} líneas · ${items.reduce((s,i)=>s+i.subtotal,0).toLocaleString('es-MX')} MXN)</span>
                         </div>
                       </td>
                       <td className="px-6 py-2">
                          <div className="flex items-center gap-2">
                             <select onChange={(e) => applyToGroup(items, { odooType: e.target.value })} className="bg-slate-800/50 text-[10px] font-bold uppercase text-white border border-white/10 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500">
                               <option value="">Tipo Bloque →</option>
                               {TIPOS_ODOO.map(t => <option key={t} value={t}>{t}</option>)}
                             </select>
                             <select onChange={(e) => applyToGroup(items, { account: e.target.value })} className="bg-slate-800/50 text-[10px] font-bold uppercase text-white border border-white/10 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[150px]">
                               <option value="">Cuenta Bloque →</option>
                               {CUENTAS.map(c => <option key={c.codigo} value={`${c.codigo} — ${c.nombre}`}>{c.codigo} — ${c.nombre}</option>)}
                             </select>
                          </div>
                       </td>
                       <td colSpan="2" className="px-6 py-2"></td>
                       <td className="px-6 py-2 text-right">
                         <button 
                           onClick={() => { if (confirm('¿Borrar factura completa?')) removeItem(items[0].uuid); }}
                           className="p-1.5 rounded-lg hover:bg-red-500 text-slate-600 hover:text-white transition-all opacity-0 group-hover/header:opacity-100 shadow-lg shadow-red-500/20"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </td>
                     </tr>
                     {items.map((item) => (
                       <tr key={item.id} className={cn("hover:bg-white/5 transition-colors group", state.selectedIds.has(item.id) && "bg-blue-500/5")}>
                         <td className="px-6 py-4">
                           <button onClick={() => toggleSelection(item.id)}>
                             {state.selectedIds.has(item.id) ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4 text-slate-700 group-hover:text-slate-500" />}
                           </button>
                         </td>
                         <td className="px-6 py-4">
                           <div className="flex items-center gap-2">
                             {item.account && item.odooType ? <ShieldCheck className="w-4 h-4 text-success" /> : <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />}
                             <span className={cn("text-[9px] font-black uppercase", item.account && item.odooType ? "text-success" : "text-red-500")}>
                               {item.account && item.odooType ? 'Ready' : 'Pending'}
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
                           <span className="text-xs font-black text-amber-400 font-mono tracking-tight">{item.skuShielded}</span>
                         </td>
                         <td className="px-6 py-4">
                           <div className="flex flex-col max-w-[220px]">
                             <span className="text-xs text-slate-200 truncate font-semibold" title={item.description}>{item.description}</span>
                             <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider">{item.category}</span>
                           </div>
                         </td>
                         <td className="px-6 py-4">
                            <select value={item.odooType || ''} onChange={(e) => updateItem(item.id, { odooType: e.target.value })} className="bg-slate-900 border border-white/10 rounded-lg text-[10px] px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-white w-full">
                              <option value="">Sin Tipo...</option>
                              {TIPOS_ODOO.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                         </td>
                         <td className="px-6 py-4">
                            <select value={item.account || ''} onChange={(e) => updateItem(item.id, { account: e.target.value })} className="bg-slate-900 border border-white/10 rounded-lg text-[10px] px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-white w-full max-w-[220px]">
                              <option value="">Sin Cuenta...</option>
                              {CUENTAS.map(c => <option key={c.codigo} value={`${c.codigo} — ${c.nombre}`}>{c.codigo} — ${c.nombre}</option>)}
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

function StatCard({ label, value, sub, icon: Icon, color, onClick, active }) {
  return (
    <div onClick={onClick} className={cn("glass p-6 rounded-2xl flex items-start justify-between group relative overflow-hidden transition-all duration-300", onClick && "cursor-pointer hover:scale-[1.02]", active && "ring-2 ring-white/20")}>
      <div className={cn("absolute bottom-0 left-0 h-1 transition-all duration-300 w-full opacity-30 group-hover:opacity-100", color, active && "opacity-100 h-1.5")} />
      <div className="space-y-1">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-black tracking-tighter">{value}</p>
        <p className="text-[10px] text-slate-500 font-bold">{sub}</p>
      </div>
      <div className={cn("p-2 rounded-xl text-white shadow-lg", color)}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}

function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
