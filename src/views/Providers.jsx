import React from 'react';
import {
  Building2,
  Download,
  Edit3,
  Fingerprint,
  Mail,
  MapPin,
  Phone,
  Trash2,
  Users,
} from 'lucide-react';
import Papa from 'papaparse';
import { LINE_TYPES, normalizeRfc, normalizeText } from '../core/business-rules';
import { useStore } from '../store/useStore';

function isActiveLine(item) {
  return item.lineType !== LINE_TYPES.IGNORE;
}

export default function Providers() {
  const { state, updateProviderMetadata } = useStore();
  const [showHidden, setShowHidden] = React.useState(false);

  const existingPartnerKeys = React.useMemo(() => {
    const keys = new Set();
    Object.values(state.masterData.partners || {}).forEach((partner) => {
      if (partner.vat) keys.add(normalizeRfc(partner.vat));
      if (partner.name) keys.add(normalizeText(partner.name));
      if (partner.name) keys.add(normalizeRfc(partner.name));
      if (partner.id) keys.add(normalizeText(partner.id));
      if (partner.externalId) keys.add(normalizeText(partner.externalId));
    });
    return keys;
  }, [state.masterData.partners]);

  const allProviders = React.useMemo(() => {
    const map = new Map();
    state.items.filter(isActiveLine).forEach((item) => {
      const key = normalizeRfc(item.rfc) || normalizeRfc(item.provider);
      const meta = state.providerMetadata[key] || {};

      if (!map.has(key)) {
        map.set(key, {
          key,
          name: item.provider,
          rfc: item.rfc || 'S/N',
          email: meta.email || item.email || '',
          phone: meta.phone || item.phone || '',
          cp: item.cp || '',
          regimen: item.regimen || '',
          activity: meta.activity || '',
          hidden: Boolean(meta.hidden),
          lastInvoiced: item.fecha,
          totalVolume: item.subtotal,
          itemCount: 1,
        });
        return;
      }

      const existing = map.get(key);
      existing.totalVolume += item.subtotal;
      existing.itemCount += 1;
      if (!existing.email && item.email) existing.email = item.email;
      if (!existing.phone && item.phone) existing.phone = item.phone;
      if (!existing.cp && item.cp) existing.cp = item.cp;
      if (item.fecha > existing.lastInvoiced) existing.lastInvoiced = item.fecha;
    });

    return Array.from(map.values())
      .map((provider) => ({
        ...provider,
        existsInOdoo: existingPartnerKeys.has(normalizeRfc(provider.rfc)) || existingPartnerKeys.has(normalizeText(provider.name)) || existingPartnerKeys.has(normalizeRfc(provider.name)),
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume);
  }, [existingPartnerKeys, state.items, state.providerMetadata]);

  const providers = React.useMemo(() => (
    allProviders.filter((provider) => showHidden || !provider.hidden)
  ), [allProviders, showHidden]);

  const exportableProviders = React.useMemo(() => (
    allProviders.filter((provider) => !provider.hidden && !provider.existsInOdoo)
  ), [allProviders]);

  const hiddenCount = allProviders.filter((provider) => provider.hidden).length;
  const existingCount = allProviders.filter((provider) => !provider.hidden && provider.existsInOdoo).length;
  const newCount = allProviders.filter((provider) => !provider.hidden && !provider.existsInOdoo).length;

  const hideProvider = (provider) => {
    if (!confirm(`Quitar ${provider.name} del Directorio Maestro y de exportaciones Odoo? Las facturas no se borran.`)) return;
    updateProviderMetadata(provider.key, { hidden: true });
  };

  const restoreProvider = (provider) => {
    updateProviderMetadata(provider.key, { hidden: false });
  };

  const exportIdForProvider = (provider) => {
    const source = normalizeRfc(provider.rfc) || normalizeRfc(provider.name);
    return `herramax_supplier_${source.toLowerCase().replace(/[^a-z0-9_]+/g, '_')}`;
  };

  const exportProviders = () => {
    if (exportableProviders.length === 0) {
      alert('No hay proveedores nuevos para exportar a Odoo. Los proveedores ocultos o ya presentes en Odoo se omiten.');
      return;
    }

    const data = exportableProviders.map((provider) => ({
      ID: exportIdForProvider(provider),
      'Avatar 128': '',
      'Nombre completo': provider.name.toUpperCase(),
      'Número de identificación fiscal': provider.rfc === 'S/N' ? '' : provider.rfc.toUpperCase(),
      'Correo electrónico': provider.email,
      Teléfono: provider.phone,
      'C.P.': provider.cp,
      Actividades: provider.activity || `Giro: ${provider.regimen || 'General'}`,
      País: 'México',
      'Cuenta por cobrar': '105.01.01 Clientes nacionales',
      'Cuenta por pagar': '201.01.01 Proveedores nacionales',
      'Es un proveedor': 'Verdadero',
      Compañía: 'HerraMax Plus',
      Estadísticas: `CFDIs: ${provider.itemCount} | Vol: $${provider.totalVolume.toFixed(2)}`,
    }));

    const csv = Papa.unparse(data);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'Odoo_Contactos_Nuevos_V4.csv');
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
            "Sabueso" V4: Extraccion profunda de datos fiscales para Odoo.
          </p>
          <p className="text-xs font-bold text-slate-500">
            {newCount} nuevos para Odoo · {existingCount} ya existen · {hiddenCount} ocultos
          </p>
          <p className="text-[11px] text-slate-500 max-w-2xl">
            El export omite proveedores eliminados, proveedores con todas sus facturas ignoradas y contactos que ya existen en el maestro de Odoo por RFC o nombre.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => setShowHidden(!showHidden)}
            className="px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
          >
            {showHidden ? 'Ocultar eliminados' : `Ver eliminados (${hiddenCount})`}
          </button>
          <button
            onClick={exportProviders}
            className="flex items-center gap-3 px-8 py-4 bg-pink-600 hover:bg-pink-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-pink-600/20 active:scale-95"
          >
            <Download className="w-5 h-5" />
            Exportar Nuevos Odoo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers.map((provider) => (
          <div key={provider.key} className={cn('glass p-6 rounded-2xl border-white/5 space-y-4 hover:border-pink-500/30 transition-all group animate-fade-in relative overflow-hidden', provider.hidden && 'opacity-60')}>
            <div className="absolute top-0 right-0 w-1.5 h-full bg-pink-500/20" />

            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-pink-500/10 text-pink-400">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  'px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest',
                  provider.rfc === 'S/N' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400 shadow-lg shadow-green-500/10'
                )}>
                  {provider.rfc === 'S/N' ? 'RFC Missing' : 'RFC Verified'}
                </div>
                {provider.existsInOdoo && (
                  <div className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-300">
                    Odoo
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-white leading-tight truncate uppercase text-sm" title={provider.name}>{provider.name}</h3>
              <div className="flex items-center gap-2 text-slate-500">
                <Fingerprint className="w-3 h-3" />
                <span className="text-xs font-mono font-bold tracking-tighter">{provider.rfc}</span>
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
                  value={provider.activity}
                  onChange={(event) => updateProviderMetadata(provider.key, { activity: event.target.value })}
                  placeholder={provider.regimen ? `Giro: ${provider.regimen}` : 'Ej: Pinturas, Luz...'}
                  className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-pink-500/50 placeholder:text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <InfoPill icon={Mail} active={Boolean(provider.email)} tone="blue" text={provider.email || 'No Mail'} />
                <InfoPill icon={Phone} active={Boolean(provider.phone)} tone="green" text={provider.phone || 'No Tel'} />
                <div className="flex items-center gap-2 text-slate-400 bg-white/5 p-2 rounded-lg col-span-2">
                  <MapPin className={cn('w-3.5 h-3.5', provider.cp ? 'text-amber-400' : 'opacity-20')} />
                  <span className="text-[9px] truncate">C.P. {provider.cp || 'No detectado'}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Contabilidad</p>
                <p className="text-[10px] font-bold text-slate-400 tracking-tight">
                  {provider.existsInOdoo ? 'Ya existe en Odoo' : 'Nuevo para Odoo'}
                </p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Compras</p>
                <p className="text-sm font-black text-pink-400 tracking-tighter">${provider.totalVolume.toLocaleString('es-MX')}</p>
              </div>
            </div>

            <div className="flex justify-end">
              {provider.hidden ? (
                <button onClick={() => restoreProvider(provider)} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-blue-300 transition-all">
                  Restaurar
                </button>
              ) : (
                <button onClick={() => hideProvider(provider)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500 text-[10px] font-black uppercase tracking-widest text-red-300 hover:text-white transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoPill({ icon, active, tone, text }) {
  const Icon = icon;
  const colors = {
    blue: 'text-blue-400',
    green: 'text-green-400',
  };

  return (
    <div className="flex items-center gap-2 text-slate-400 bg-white/5 p-2 rounded-lg">
      <Icon className={cn('w-3.5 h-3.5', active ? colors[tone] : 'opacity-20')} />
      <span className="text-[9px] truncate">{text}</span>
    </div>
  );
}

function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
