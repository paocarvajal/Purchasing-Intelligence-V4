import { useState, useEffect, useCallback } from 'react';

/**
 * Global Store for HerraMax V4
 */

let globalState = {
  items: [],
  sessionUuids: [],
  dests: [
    { id: 'ele45', name: 'Eléctrica 45', emoji: '⚡' },
    { id: 'fer41', name: 'Ferretería 41', emoji: '🔩' },
    { id: 'gen', name: 'General', emoji: '🏬' },
  ],
  itemDests: {}, // uuid -> destId
  selectedIds: new Set(),
  providerMetadata: {}, // rfc -> { activity: string, email: string, phone: string }
};

const stored = localStorage.getItem('hm_v4_store');
if (stored) {
  try {
    const parsed = JSON.parse(stored);
    globalState = { ...globalState, ...parsed, selectedIds: new Set() };
  } catch (e) {}
}

const listeners = new Set();

const setState = (next) => {
  globalState = typeof next === 'function' ? next(globalState) : { ...globalState, ...next };
  // Filter out non-serializable items for storage
  const { selectedIds, ...toStore } = globalState;
  localStorage.setItem('hm_v4_store', JSON.stringify(toStore));
  listeners.forEach(l => l(globalState));
};

export function useStore() {
  const [state, setInternalState] = useState(globalState);

  useEffect(() => {
    listeners.add(setInternalState);
    return () => listeners.delete(setInternalState);
  }, []);

  const addItems = useCallback((newItems) => {
    setState(prev => {
      const existingUuids = new Set(prev.items.map(i => i.uuid));
      const filtered = newItems.filter(i => !existingUuids.has(i.uuid));
      const addedUuids = [...new Set(filtered.map(i => i.uuid))];
      return {
        ...prev,
        items: [...prev.items, ...filtered],
        sessionUuids: [...new Set([...prev.sessionUuids, ...addedUuids])]
      };
    });
  }, []);

  const updateItem = useCallback((id, updates) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, ...updates } : i)
    }));
  }, []);

  const bulkUpdate = useCallback((ids, updates) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(i => ids.has(i.id) ? { ...i, ...updates } : i)
    }));
  }, []);

  const setItemDest = useCallback((uuid, destId) => {
    setState(prev => ({
      ...prev,
      itemDests: { ...prev.itemDests, [uuid]: destId }
    }));
  }, []);

  const toggleSelection = useCallback((id) => {
    setState(prev => {
      const next = new Set(prev.selectedIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, selectedIds: next };
    });
  }, []);

  const selectAll = useCallback((ids) => {
    setState(prev => ({ ...prev, selectedIds: new Set(ids) }));
  }, []);

  const clearSelection = useCallback(() => {
    setState(prev => ({ ...prev, selectedIds: new Set() }));
  }, []);

  const removeItem = useCallback((uuid) => {
    setState(prev => ({
      ...prev,
      items: prev.items.filter(i => i.uuid !== uuid),
      sessionUuids: prev.sessionUuids.filter(u => u !== uuid)
    }));
  }, []);

  const deleteLine = useCallback((id) => {
    setState(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== id)
    }));
  }, []);

  const clearSession = useCallback(() => {
    if (confirm('¿Seguro que quieres borrar TODA la información cargada? No se puede deshacer.')) {
      setState({
        items: [],
        sessionUuids: [],
        itemDests: {},
        selectedIds: new Set()
      });
      localStorage.removeItem('hm_v4_store');
    }
  }, []);

  const updateProviderMetadata = useCallback((rfc, updates) => {
    setState(prev => ({
      ...prev,
      providerMetadata: {
        ...prev.providerMetadata,
        [rfc]: { ...(prev.providerMetadata[rfc] || {}), ...updates }
      }
    }));
  }, []);

  return {
    state,
    addItems,
    updateItem,
    bulkUpdate,
    setItemDest,
    toggleSelection,
    selectAll,
    clearSelection,
    removeItem,
    deleteLine,
    clearSession,
    updateProviderMetadata
  };
}
