import React from 'react';
import { Tag, Printer, AlertCircle } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function Labels() {
  const { state, setItemDest } = useStore();

  // Group items by Invoice (UUID)
  const invoices = state.items.reduce((acc, item) => {
    if (!acc[item.uuid]) acc[item.uuid] = [];
    acc[item.uuid].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="glass p-8 rounded-3xl border-green-500/20 flex flex-col md:flex-row items-center gap-6 justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <Tag className="w-8 h-8 text-green-400" />
            Generador de Etiquetas
          </h2>
          <p className="text-slate-400">
            Asigna facturas a destinos y genera etiquetas térmicas de **50.8mm x 25.4mm**.
          </p>
        </div>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-3 px-8 py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-green-600/20"
        >
          <Printer className="w-5 h-5" />
          Imprimir Etiquetas PDF
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {Object.entries(invoices).map(([uuid, items]) => (
          <div key={uuid} className="glass rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                <FileText className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Factura: *{uuid.slice(-12)}</p>
                <p className="text-xs text-slate-500">{items[0].provider} • {items.length} productos • {items[0].fecha}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {state.dests.map((dest) => (
                <button
                  key={dest.id}
                  onClick={() => setItemDest(uuid, dest.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all",
                    state.itemDests[uuid] === dest.id 
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                      : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span className="text-lg leading-none">{dest.emoji}</span>
                  {dest.name}
                </button>
              ))}
            </div>
          </div>
        ))}

        {Object.keys(invoices).length === 0 && (
          <div className="py-20 text-center opacity-20">
            <AlertCircle className="w-12 h-12 mx-auto mb-2" />
            <p className="font-bold">No hay facturas para asignar destinos</p>
          </div>
        )}
      </div>

      {/* Hidden Print Area */}
      <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[9999]">
         {/* Label rendering logic would go here for the print media query */}
         <p className="text-black p-10">Vista de impresión de etiquetas (50.8x25.4mm)</p>
      </div>
    </div>
  );
}

function FileText(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
