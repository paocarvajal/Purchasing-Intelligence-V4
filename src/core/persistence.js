import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { ref, uploadString } from 'firebase/storage';
import { db, storage } from './firebase';

export const COLLECTIONS = {
  invoices: 'invoices',
  invoiceLines: 'invoiceLines',
  suppliers: 'suppliers',
  supplierRules: 'supplierRules',
  products: 'products',
  accounts: 'accounts',
  exportRuns: 'exportRuns',
  odooImports: 'odooImports',
};

export async function saveInvoiceWithLines(invoice, lines, xmlText) {
  const invoiceRef = doc(db, COLLECTIONS.invoices, invoice.uuid);
  const existing = await getDoc(invoiceRef);
  if (existing.exists()) {
    return { status: 'duplicate', invoiceId: invoice.uuid };
  }

  const batch = writeBatch(db);
  batch.set(invoiceRef, {
    ...invoice,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: invoice.status || 'review',
  });

  lines.forEach((line) => {
    batch.set(doc(db, COLLECTIONS.invoiceLines, line.id), {
      ...line,
      invoiceUuid: invoice.uuid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();

  if (xmlText) {
    const storageRef = ref(storage, `invoices/${invoice.uuid}.xml`);
    await uploadString(storageRef, xmlText, 'raw', { contentType: 'application/xml' });
  }

  return { status: 'saved', invoiceId: invoice.uuid };
}

export async function upsertMasterRecords(collectionName, records) {
  for (let index = 0; index < records.length; index += 450) {
    const batch = writeBatch(db);
    records.slice(index, index + 450).forEach((record) => {
      batch.set(doc(collection(db, collectionName), record.firestoreId || record.id), {
        ...record,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
    await batch.commit();
  }
  return { status: 'saved', count: records.length };
}

export async function loadCollection(collectionName) {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map((row) => ({ id: row.id, ...row.data() }));
}
