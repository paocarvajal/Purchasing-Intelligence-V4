import React from 'react';
import { 
  Users, 
  Download, 
  AlertCircle,
  Building2,
  Fingerprint,
  Mail,
  Phone,
  MapPin,
  Edit3
} from 'lucide-react';
import { useStore } from '../store/useStore';
import Papa from 'papaparse';

export default function Providers() {
  const { state, updateProviderMetadata } = useStore();

  const providers = React.useMemo(() => {
    const map = new Map();
    state.items.forEach(item => {
      const key = (item.rfc || item.provider).toUpperCase();
      const meta = state.providerMetadata[key] || {};
      
      if (!map.has(key)) {
        map.set(key, {
          name: item.provider,
          rfc: item.rfc || 'S/N',
          email: meta.email || item.email || '',
          phone: meta.phone || item.phone || '',
          cp: item.cp || '',
          regimen: item.regimen || '',
          activity: meta.activity || '',
          lastInvoiced: item.fecha,
          totalVolume: item.subtotal,
          itemCount: 1
        });
      } else {
        const existing = map.get(key);
        existing.totalVolume += item.subtotal;
        existing.itemCount += 1;
        if (!existing.email && item.email) existing.email = item.email;
        if (!existing.phone && item.phone) existing.phone = item.phone;
        if (!existing.cp && item.cp) existing.cp = item.cp;
        if (item.fecha > existing.lastInvoiced) existing.lastInvoiced = item.fecha;
      }
    });
    return Array.from(map.values()).sort((a,b) => b.totalVolume - a.totalVolume);
  }, [state.items, state.providerMetadata]);

  const exportProviders = () => {
    const data = providers.map(p => ({
      'Avatar 128': '',
      'Nombre completo': p.name.toUpperCase(),
      'RFC': p.rfc.toUpperCase(),
      'Correo electrónico': p.email,
      'Teléfono': p.phone,
      'C.P.': p.cp,
      'Actividades': p.activity || `Giro: ${p.regimen || 'General'}`,
      'País': 'México',
      'Cuenta por cobrar': '105.01.01 Clientes nacionales',
      'Cuenta por pagar': '201.01.01 Proveedores nacionales',
      'Es un proveedor': 'Verdadero',
      'Compañía': 'HerraMax Plus',
      'Estadísticas': `CFDIs: ${p.itemCount} | Vol: $${p.totalVolume.toFixed(2)}`
    }));

    const csv = Papa.unparse(data);
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'Odoo_Contactos_Full_Data_V4.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="glass p-8 rounded-3xl border-pink-500/20 flex flex-col md:flex-row items-center gap-6 justify-between shadow-2xl">
        <div className="space-y-2 text-center md:text-left">
          <h2 className="text-3xl font-black tracking-tight text-white flex items-center justify-center md:justify-start gap-3">
            <Users className="w-8 h-8 text-pink-400" />
            Directorio Maestro
          </h2>
          <p className="text-slate-400 font-medium italic">
            "Sabueso" V4: Extracción profunda de datos fiscales para Odoo.
          </p>
        </div>
        <button 
          onClick={exportProviders}
          className="flex items-center gap-3 px-8 py-4 bg-pink-600 hover:bg-pink-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-pink-600/20 active:scale-95"
        >
          <Download className="w-5 h-5" />
          Exportar Full Data V4
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers.map((p) => (
          <div key={p.rfc + p.name} className="glass p-6 rounded-2xl border-white/5 space-y-4 hover:border-pink-500/30 transition-all group animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1.5 h-full bg-pink-500/20" />
            
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-pink-500/10 text-pink-400">
                <Building2 className="w-6 h-6" />
              </div>
              <div className={cn(
                "px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest",
                p.rfc === 'S/N' ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400 shadow-lg shadow-green-500/10"
              )}>
                {p.rfc === 'S/N' ? 'RFC Missing' : 'RFC Verified'}
              </div>
            </div>
            
            <div className="space-y-1">
              <h3 className="font-bold text-white leading-tight truncate uppercase text-sm" title={p.name}>{p.name}</h3>
              <div className="flex items-center gap-2 text-slate-500">
                <Fingerprint className="w-3 h-3" />
                <span className="text-xs font-mono font-bold tracking-tighter">{p.rfc}</span>
              </div>
            </div>

            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Edit3 className="w-3 h-3 text-pink-500" />
                  Actividad General
                </label>
                <input 
                  type="text"
                  value={p.activity}
                  onChange={(e) => updateProviderMetadata(p.rfc, { activity: e.target.value })}
                  placeholder={p.regimen ? `Giro: ${p.regimen}` : "Ej: Pinturas, Luz..."}
                  className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-pink-500/50 placeholder:text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 text-slate-400 bg-white/5 p-2 rounded-lg">
                  <Mail className={cn("w-3.5 h-3.5", p.email ? "text-blue-400" : "opacity-20")} />
                  <span className="text-[9px] truncate">{p.email || 'No Mail'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 bg-white/5 p-2 rounded-lg">
                  <Phone className={cn("w-3.5 h-3.5", p.phone ? "text-green-400" : "opacity-20")} />
                  <span className="text-[9px] truncate">{p.phone || 'No Tel'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 bg-white/5 p-2 rounded-lg col-span-2">
                  <MapPin className={cn("w-3.5 h-3.5", p.cp ? "text-amber-400" : "opacity-20")} />
                  <span className="text-[9px] truncate">C.P. {p.cp || 'No detectado'}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Contabilidad</p>
                <p className="text-[10px] font-bold text-slate-400 tracking-tight">105 / 201 Ready</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Compras</p>
                <p className="text-sm font-black text-pink-400 tracking-tighter">${p.totalVolume.toLocaleString('es-MX')}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
