import React, { useMemo, useState } from 'react';
import {
  Plus,
  Save,
  ShieldOff,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { LINE_TYPES, ODOO_TYPES } from '../core/business-rules';
import { COLLECTIONS, upsertMasterRecords } from '../core/persistence';
import { useStore } from '../store/useStore';

const EMPTY_RULE = {
  key: '',
  match: '',
  rfc: '',
  prefix: '',
  defaultLineType: LINE_TYPES.REVIEW,
  defaultOdooType: 'Revisar',
  ignore: false,
};

export default function SupplierRules() {
  const { state, upsertSupplierRule, deleteSupplierRule } = useStore();
  const [draft, setDraft] = useState(EMPTY_RULE);
  const [message, setMessage] = useState('');

  const ignoredCount = useMemo(() => state.supplierRules.filter((rule) => rule.ignore).length, [state.supplierRules]);

  const saveRule = async () => {
    const key = draft.key.trim() || slugify(draft.rfc || draft.match || draft.prefix);
    if (!key) {
      setMessage('Agrega un RFC, nombre o prefijo antes de guardar.');
      return;
    }

    const rule = {
      ...draft,
      key,
      match: String(draft.match || '').split(',').map((value) => value.trim()).filter(Boolean),
    };

    upsertSupplierRule(rule);
    setDraft(EMPTY_RULE);
    setMessage('Regla guardada localmente.');

    try {
      await upsertMasterRecords(COLLECTIONS.supplierRules, [{ id: rule.key, ...rule }]);
      setMessage('Regla guardada localmente y en Firestore.');
    } catch (error) {
      console.error(error);
      setMessage('Regla guardada localmente. Firestore no acepto la escritura.');
    }
  };

  const editRule = (rule) => {
    setDraft({
      ...rule,
      match: (rule.match || []).join(', '),
      rfc: rule.rfc || '',
      prefix: rule.prefix || '',
      defaultLineType: rule.defaultLineType || LINE_TYPES.REVIEW,
      defaultOdooType: rule.defaultOdooType || 'Revisar',
      ignore: Boolean(rule.ignore),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <SlidersHorizontal className="w-8 h-8 text-amber-400" />
            Supplier Rules
          </h2>
          <p className="text-sm text-slate-400 font-medium">
            Prefijos, reglas de ignorado y clasificacion inicial por proveedor.
          </p>
        </div>
        <div className="glass rounded-xl px-5 py-3 border-white/5">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ignored RFCs</p>
          <p className="text-2xl font-black text-white">{ignoredCount}</p>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 border-white/5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Field label="Key">
            <input value={draft.key} onChange={(event) => setDraft({ ...draft, key: event.target.value })} className="field" placeholder="electrica-45" />
          </Field>
          <Field label="RFC">
            <input value={draft.rfc} onChange={(event) => setDraft({ ...draft, rfc: event.target.value })} className="field" placeholder="RFC exacto" />
          </Field>
          <Field label="Name match">
            <input value={draft.match} onChange={(event) => setDraft({ ...draft, match: event.target.value })} className="field" placeholder="ELECTRICA 45, EL 45" />
          </Field>
          <Field label="Prefix">
            <input value={draft.prefix} onChange={(event) => setDraft({ ...draft, prefix: event.target.value.toUpperCase() })} className="field" placeholder="E45-" />
          </Field>
          <Field label="Line type">
            <select value={draft.defaultLineType} onChange={(event) => setDraft({ ...draft, defaultLineType: event.target.value })} className="field">
              {Object.values(LINE_TYPES).map((lineType) => <option key={lineType} value={lineType}>{lineType}</option>)}
            </select>
          </Field>
          <Field label="Odoo type">
            <select value={draft.defaultOdooType} onChange={(event) => setDraft({ ...draft, defaultOdooType: event.target.value })} className="field">
              {ODOO_TYPES.map((odooType) => <option key={odooType} value={odooType}>{odooType}</option>)}
            </select>
          </Field>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <label className="flex items-center gap-3 text-sm font-bold text-slate-300">
            <input
              type="checkbox"
              checked={draft.ignore}
              onChange={(event) => setDraft({ ...draft, ignore: event.target.checked })}
              className="w-4 h-4 accent-red-500"
            />
            Ignorar facturas de este proveedor excepto en auditoria
          </label>
          <button onClick={saveRule} className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-black transition-all">
            {draft.key ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            Guardar regla
          </button>
        </div>

        {message && <p className="text-xs font-bold text-amber-300">{message}</p>}
      </div>

      <div className="glass rounded-2xl overflow-hidden border-white/5">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <tr>
              <th className="px-5 py-4">Rule</th>
              <th className="px-5 py-4">Match</th>
              <th className="px-5 py-4">Prefix</th>
              <th className="px-5 py-4">Defaults</th>
              <th className="px-5 py-4">Mode</th>
              <th className="px-5 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {state.supplierRules.map((rule) => (
              <tr key={rule.key} className="hover:bg-white/5 transition-colors">
                <td className="px-5 py-4">
                  <button onClick={() => editRule(rule)} className="text-sm font-black text-white hover:text-amber-300">{rule.key}</button>
                  {rule.rfc && <p className="text-[10px] text-slate-500 font-mono">{rule.rfc}</p>}
                </td>
                <td className="px-5 py-4 text-xs text-slate-300 max-w-[320px]">{(rule.match || []).join(', ') || 'RFC only'}</td>
                <td className="px-5 py-4 text-xs font-black text-amber-300 font-mono">{rule.prefix || 'No prefix'}</td>
                <td className="px-5 py-4 text-xs text-slate-300">{rule.defaultLineType || 'review'} / {rule.defaultOdooType || 'Revisar'}</td>
                <td className="px-5 py-4">
                  {rule.ignore ? (
                    <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-300">
                      <ShieldOff className="w-3 h-3" />
                      Ignored
                    </span>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-widest text-green-300">Active</span>
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  <button onClick={() => deleteSupplierRule(rule.key)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="space-y-1">
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
