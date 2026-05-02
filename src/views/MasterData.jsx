import React, { useMemo, useState } from 'react';
import {
  Cloud,
  Database,
  FileSpreadsheet,
  Loader2,
  RefreshCcw,
  Upload,
} from 'lucide-react';
import { MASTER_IMPORT_TYPES, parseMasterDataFile } from '../core/odoo-master-data';
import { COLLECTIONS, loadCollection, upsertMasterRecords } from '../core/persistence';
import { useStore } from '../store/useStore';

const TYPE_OPTIONS = Object.entries(MASTER_IMPORT_TYPES);

export default function MasterData() {
  const { state, importMasterData, markMasterImportSaved, replaceMasterData } = useStore();
  const [type, setType] = useState('productTemplates');
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const counts = useMemo(() => ({
    productTemplates: Object.keys(state.masterData.productTemplates || {}).length,
    productVariants: Object.keys(state.masterData.productVariants || {}).length,
    partners: Object.keys(state.masterData.partners || {}).length,
    accounts: Object.keys(state.masterData.accounts || {}).length,
  }), [state.masterData]);

  const handleFile = async (file) => {
    if (!file) return;
    setIsBusy(true);
    setMessage(`Importando ${file.name}...`);
    try {
      const parsed = await parseMasterDataFile(file, type);
      const importId = `${type}-${Date.now()}`;
      importMasterData(type, parsed.records, {
        id: importId,
        skipped: parsed.skipped,
        sourceFile: file.name,
        savedToCloud: false,
      });
      const omittedSummary = `${parsed.invalidRows || 0} invalidas, ${parsed.duplicateRecords || 0} duplicadas`;
      setMessage(`${parsed.records.length} registros unicos cargados localmente. ${parsed.skipped} filas omitidas (${omittedSummary}). Guardando en Firestore en segundo plano...`);
      setIsBusy(false);

      void (async () => {
        try {
          await upsertMasterRecords(parsed.collection, parsed.records);
          markMasterImportSaved(importId);
          setMessage(`${parsed.records.length} registros unicos cargados localmente y guardados en Firestore. ${parsed.skipped} filas omitidas (${omittedSummary}).`);
        } catch (cloudError) {
          console.error(cloudError);
          setMessage(`${parsed.records.length} registros unicos cargados localmente. Firestore no acepto la escritura. ${parsed.skipped} filas omitidas (${omittedSummary}).`);
        }
      })();
    } catch (error) {
      console.error(error);
      setMessage(`No se pudo importar: ${error.message}`);
      setIsBusy(false);
    }
  };

  const loadFromCloud = async () => {
    setIsBusy(true);
    setMessage('Leyendo catalogos desde Firestore...');
    try {
      const [products, suppliers, accounts] = await Promise.all([
        loadCollection(COLLECTIONS.products),
        loadCollection(COLLECTIONS.suppliers),
        loadCollection(COLLECTIONS.accounts),
      ]);

      replaceMasterData({
        productTemplates: indexBySource(products, 'odoo.product.template'),
        productVariants: indexBySource(products, 'odoo.product.product'),
        partners: indexById(suppliers),
        accounts: indexById(accounts),
        imports: state.masterData.imports || [],
      });
      setMessage(`Firestore sincronizado: ${products.length} productos, ${suppliers.length} contactos, ${accounts.length} cuentas.`);
    } catch (error) {
      console.error(error);
      setMessage(`No se pudo leer Firestore: ${error.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <Database className="w-8 h-8 text-blue-400" />
            Odoo Master Data
          </h2>
          <p className="text-sm text-slate-400 font-medium">
            Catalogos base para detectar productos existentes, SKUs canonicos y proveedores.
          </p>
        </div>
        <button
          onClick={loadFromCloud}
          disabled={isBusy}
          className="flex items-center justify-center gap-3 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all"
        >
          {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
          Sincronizar Firestore
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <CountCard label="Productos" value={counts.productTemplates} />
        <CountCard label="Variantes" value={counts.productVariants} />
        <CountCard label="Contactos" value={counts.partners} />
        <CountCard label="Cuentas" value={counts.accounts} />
      </div>

      <div className="glass rounded-2xl p-6 border-white/5 space-y-5">
        <div className="flex flex-col md:flex-row gap-4">
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none min-w-[260px]"
          >
            {TYPE_OPTIONS.map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <label className="flex-1 min-h-24 border-2 border-dashed border-white/10 rounded-2xl hover:border-blue-400/60 hover:bg-blue-500/5 transition-all cursor-pointer flex items-center justify-center gap-3 text-blue-300 font-bold">
            <Upload className="w-5 h-5" />
            Importar XLSX o CSV
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </label>
        </div>

        {message && (
          <div className="flex items-center gap-3 text-xs font-bold text-slate-300 bg-white/5 rounded-xl px-4 py-3">
            <RefreshCcw className="w-4 h-4 text-blue-400" />
            {message}
          </div>
        )}
      </div>

      <div className="glass rounded-2xl overflow-hidden border-white/5">
        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-amber-400" />
          <h3 className="font-black text-white">Historial local de importaciones</h3>
        </div>
        <div className="divide-y divide-white/5">
          {(state.masterData.imports || []).length === 0 && (
            <p className="px-6 py-8 text-sm text-slate-500">Todavia no hay importaciones registradas.</p>
          )}
          {(state.masterData.imports || []).map((row) => (
            <div key={row.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-white">{MASTER_IMPORT_TYPES[row.type]?.label || row.type}</p>
                <p className="text-xs text-slate-500">{row.sourceFile || 'Archivo sin nombre'} · {new Date(row.importedAt).toLocaleString('es-MX')}</p>
              </div>
              <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                {row.count} guardados · {row.skipped} omitidos · {row.savedToCloud ? 'Cloud' : 'Local'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CountCard({ label, value }) {
  return (
    <div className="glass p-5 rounded-2xl border-white/5">
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-black text-white tracking-tight">{value.toLocaleString('es-MX')}</p>
    </div>
  );
}

function indexById(records) {
  return records.reduce((acc, record) => {
    if (record.id) acc[record.id] = record;
    return acc;
  }, {});
}

function indexBySource(records, source) {
  return indexById(records.filter((record) => record.source === source));
}
