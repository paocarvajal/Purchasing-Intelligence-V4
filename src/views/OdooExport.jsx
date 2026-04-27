import React from 'react';
import { 
  Download, 
  FileJson, 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertTriangle,
  Layers,
  Database
} from 'lucide-react';
import { useStore } from '../store/useStore';
import Papa from 'papaparse';

export default function OdooExport() {
  const { state } = useStore();

  const generateCSVs = () => {
    if (state.items.length === 0) return;

    // 1. Existing Products Update (Simplified logic for now)
    // In a real scenario, we'd compare with a master list
    const updateData = state.items.map(i => ({
      'Internal Reference': i.skuShielded.replace(/^(ADIR-|IUS-|IGO-|ARG-|SAB-|PHI-|EXT-)/, ''),
      'Cost': i.cost.toFixed(2),
      'Sales Price': i.suggestedPrice.toFixed(2)
    }));

    // 2. New Products Architecture
    const newData = state.items.map(i => ({
      'Internal Reference': i.skuShielded,
      'Name': i.description,
      'Cost': i.cost.toFixed(2),
      'Sales Price': i.suggestedPrice.toFixed(2),
      'Product Category': 'Pendiente por Clasificar (Nueva Marca)'
    }));

    downloadCSV(updateData, '1_Odoo_Actualizar_Existentes.csv');
    downloadCSV(newData, '2_Odoo_Importar_Nuevos_Arquitectura.csv');
  };

  const downloadCSV = (data, filename) => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="glass p-8 rounded-3xl border-purple-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Database className="w-32 h-32 text-purple-400" />
        </div>
        
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black uppercase tracking-widest">
            Pipeline Odoo v4
          </div>
          <h2 className="text-3xl font-black tracking-tight">Exportación Inteligente</h2>
          <p className="text-slate-400 max-w-xl">
            Genera automáticamente los archivos CSV listos para importar a Odoo. 
            El sistema aplica la **Arquitectura de SKUs Protegidos** y los **Márgenes Dinámicos** definidos por HerraMax.
          </p>
          
          <div className="pt-6 flex gap-4">
            <button 
              onClick={generateCSVs}
              className="flex items-center gap-3 px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-purple-600/20"
            >
              <Download className="w-5 h-5" />
              Generar Planillas de Importación
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass p-6 rounded-2xl space-y-4 border-blue-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <h3 className="font-bold">Actualización de Precios</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Para productos que ya existen en tu catálogo. Actualiza el costo real de la última factura y recalcula el precio de venta sugerido.
          </p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
              <CheckCircle2 className="w-3 h-3 text-success" />
              SKU ORIGINAL SIN PREFIJO
            </li>
            <li className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
              <CheckCircle2 className="w-3 h-3 text-success" />
              COSTO UNITARIO PROMEDIO
            </li>
          </ul>
        </div>

        <div className="glass p-6 rounded-2xl space-y-4 border-amber-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-bold">Nuevos Productos (Arquitectura)</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Crea nuevos registros con la arquitectura de SKUs protegidos (ej. ADIR-123). Evita colisiones entre marcas.
          </p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
              <CheckCircle2 className="w-3 h-3 text-success" />
              SKU PROTEGIDO CON PREFIJO
            </li>
            <li className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
              <CheckCircle2 className="w-3 h-3 text-success" />
              CATEGORIZACIÓN AUTOMÁTICA
            </li>
          </ul>
        </div>
      </div>

      {state.items.length > 0 && (
        <div className="glass p-6 rounded-2xl border-white/5 bg-green-500/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center text-success">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Listo para procesar</p>
              <p className="text-xs text-slate-400">Hay {state.items.length} líneas cargadas en la sesión actual listas para exportar.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
