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

  // Items that have a destination assigned → these get printed
  const printableItems = state.items.filter(item => state.itemDests[item.uuid]);

  const getDest = (uuid) => {
    const destId = state.itemDests[uuid];
    return state.dests.find(d => d.id === destId) || null;
  };

  return (
    <div className="space-y-6">
      {/* ── Print styles ─────────────────────────────────────────────── */}
      <style>{`
        @media print {
          /* Hide everything except our label area */
          body > * { display: none !important; }
          #__label_print_root { display: block !important; }

          /* Reset page margins for tight label packing */
          @page { margin: 4mm; }

          .lbl {
            width: 50.8mm;
            height: 25.4mm;
            page-break-inside: avoid;
            break-inside: avoid;
            box-sizing: border-box;
          }
        }

        /* Make the root visible only when printing (Tailwind's print: prefix) */
        @media not print {
          #__label_print_root { display: none; }
        }
      `}</style>

      {/* ── Screen UI ────────────────────────────────────────────────── */}
      <div className="glass p-8 rounded-3xl border-green-500/20 flex flex-col md:flex-row items-center gap-6 justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <Tag className="w-8 h-8 text-green-400" />
            Generador de Etiquetas
          </h2>
          <p className="text-slate-400">
            Asigna una factura a un destino y genera etiquetas térmicas de{' '}
            <span className="text-white font-bold">50.8 × 25.4 mm</span>.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-3 px-8 py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-green-600/20"
          >
            <Printer className="w-5 h-5" />
            Imprimir Etiquetas PDF
          </button>
          {printableItems.length > 0 && (
            <p className="text-xs text-green-400">
              {printableItems.length} producto{printableItems.length !== 1 ? 's' : ''} listos para imprimir
            </p>
          )}
        </div>
      </div>

      {/* Invoice cards */}
      <div className="grid grid-cols-1 gap-4">
        {Object.entries(invoices).map(([uuid, items]) => {
          const dest = getDest(uuid);
          return (
            <div key={uuid} className="glass rounded-2xl p-6 border-white/5">
              {/* Invoice header + destination buttons */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Factura: *{uuid.slice(-12)}</p>
                    <p className="text-xs text-slate-500">
                      {items[0].provider} &bull; {items.length} producto{items.length !== 1 ? 's' : ''} &bull; {items[0].fecha}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {state.dests.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setItemDest(uuid, d.id)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all',
                        state.itemDests[uuid] === d.id
                          ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                          : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <span className="text-lg leading-none">{d.emoji}</span>
                      {d.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Item chips preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {items.map(item => (
                  <div key={item.id} className="bg-white/5 rounded-xl p-3 flex flex-col gap-1">
                    <p className="text-xs font-bold text-white leading-tight line-clamp-2">
                      {item.description}
                    </p>
                    <p className="text-xs text-slate-500 font-mono">{item.purchaseSku}</p>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-slate-400">
                        {item.quantity} {item.unitName || 'pza'}
                      </p>
                      <p className="text-xs font-bold text-green-400">
                        ${Number(item.cost || 0).toFixed(2)}
                      </p>
                    </div>
                    {dest && (
                      <p className="text-xs text-purple-300 font-bold mt-1">
                        {dest.emoji} {dest.name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {Object.keys(invoices).length === 0 && (
          <div className="py-20 text-center opacity-20">
            <AlertCircle className="w-12 h-12 mx-auto mb-2" />
            <p className="font-bold">No hay facturas para asignar destinos</p>
          </div>
        )}
      </div>

      {/* ── PRINT AREA ────────────────────────────────────────────────
          Rendered always in DOM but visually hidden on screen.
          @media print makes it the only visible thing.
      ─────────────────────────────────────────────────────────────── */}
      <div id="__label_print_root" aria-hidden="true">
        {printableItems.length === 0 ? (
          <div style={{ padding: '20mm', textAlign: 'center', fontFamily: 'Arial, sans-serif', color: '#555' }}>
            <p style={{ fontSize: '12pt', fontWeight: 'bold' }}>Sin etiquetas para imprimir</p>
            <p style={{ fontSize: '9pt' }}>Asigna un destino a cada factura primero.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5mm', background: 'white', padding: '0' }}>
            {printableItems.map(item => {
              const dest = getDest(item.uuid);
              return (
                <div
                  key={item.id}
                  className="lbl"
                  style={{
                    width: '50.8mm',
                    height: '25.4mm',
                    border: '0.5pt solid #000',
                    boxSizing: 'border-box',
                    padding: '1.5mm 2mm',
                    fontFamily: 'Arial, Helvetica, sans-serif',
                    background: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    overflow: 'hidden',
                  }}
                >
                  {/* Row 1: Provider + Destination */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '5pt',
                      color: '#444',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      maxWidth: '58%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.provider}
                    </span>
                    {dest && (
                      <span style={{
                        fontSize: '5pt',
                        fontWeight: 'bold',
                        color: '#5b21b6',
                        border: '0.5pt solid #5b21b6',
                        borderRadius: '2pt',
                        padding: '0.5pt 2pt',
                        whiteSpace: 'nowrap',
                      }}>
                        {dest.name}
                      </span>
                    )}
                  </div>

                  {/* Row 2: Description (up to 2 lines) */}
                  <div style={{
                    flex: 1,
                    overflow: 'hidden',
                    margin: '1mm 0 0.5mm',
                  }}>
                    <p style={{
                      fontSize: '6pt',
                      fontWeight: 'bold',
                      color: '#000',
                      lineHeight: 1.25,
                      margin: 0,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {item.description}
                    </p>
                  </div>

                  {/* Row 3: SKU | Qty | Cost */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <p style={{
                        fontSize: '5.5pt',
                        fontFamily: 'Courier New, Courier, monospace',
                        fontWeight: 'bold',
                        color: '#111',
                        margin: 0,
                      }}>
                        {item.purchaseSku}
                      </p>
                      <p style={{ fontSize: '4.5pt', color: '#777', margin: 0 }}>
                        Cant: {item.quantity} {item.unitName || 'pza'} &bull; {item.fecha}
                      </p>
                    </div>
                    <p style={{
                      fontSize: '9pt',
                      fontWeight: 'bold',
                      color: '#000',
                      margin: 0,
                      whiteSpace: 'nowrap',
                    }}>
                      ${Number(item.cost || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

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
