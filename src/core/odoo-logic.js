/**
 * Odoo Business Logic - HerraMax V4
 * Updated with Real Chart of Accounts 2026
 */

// Comprehensive Chart of Accounts provided by User
export const CUENTAS = [
    { codigo: '101.01.01', nombre: 'Efectivo', tipo: 'Banco y efectivo' },
    { codigo: '102.01.01', nombre: 'Banco', tipo: 'Banco y efectivo' },
    { codigo: '105.01.01', nombre: 'Clientes nacionales', tipo: 'Por cobrar' },
    { codigo: '113.01.01', nombre: 'IVA a favor', tipo: 'Por cobrar' },
    { codigo: '115.01.01', nombre: 'Inventario', tipo: 'Activos corrientes' },
    { codigo: '118.01.01', nombre: 'IVA acreditable pagado', tipo: 'Activos corrientes' },
    { codigo: '119.01.01', nombre: 'IVA pendiente de pago', tipo: 'Activos corrientes' },
    { codigo: '155.01.01', nombre: 'Mobiliario y Equipo de Oficina', tipo: 'Activos fijos' },
    { codigo: '156.01.01', nombre: 'Tecnología', tipo: 'Activos fijos' },
    { codigo: '201.01.01', nombre: 'Proveedores nacionales', tipo: 'Por pagar' },
    { codigo: '501.01.01', nombre: 'Costo de venta', tipo: 'Costo de ingresos' },
    { codigo: '601.01.01', nombre: 'Sueldos y salarios', tipo: 'Costo de ingresos' },
    { codigo: '601.32.01', nombre: 'Gastos de Administración', tipo: 'Gastos' },
    { codigo: '601.34.01', nombre: 'Honorarios (P. Físicas)', tipo: 'Gastos' },
    { codigo: '601.45.01', nombre: 'Alquiler de Oficina (P. Físicas)', tipo: 'Gastos' },
    { codigo: '601.46.01', nombre: 'Alquiler de Oficina (P. Morales)', tipo: 'Gastos' },
    { codigo: '601.48.01', nombre: 'Combustible y Lubricantes', tipo: 'Gastos' },
    { codigo: '601.50.01', nombre: 'Teléfono e Internet', tipo: 'Gastos' },
    { codigo: '601.51.01', nombre: 'Agua', tipo: 'Gastos' },
    { codigo: '601.52.01', nombre: 'Electricidad', tipo: 'Gastos' },
    { codigo: '601.54.01', nombre: 'Limpieza', tipo: 'Gastos' },
    { codigo: '601.55.01', nombre: 'Papelería y Suministros', tipo: 'Gastos' },
    { codigo: '601.56.01', nombre: 'Mantenimiento Oficinas', tipo: 'Gastos' },
    { codigo: '601.60.01', nombre: 'Software y Suscripciones', tipo: 'Gastos' },
    { codigo: '601.73.01', nombre: 'Gastos de Importación', tipo: 'Gastos' },
    { codigo: '601.84.01', nombre: 'Otros gastos generales', tipo: 'Gastos' },
    { codigo: '602.61.01', nombre: 'Publicidad y Propaganda', tipo: 'Gastos' },
    { codigo: '602.72.01', nombre: 'Fletes y Acarreos', tipo: 'Gastos' },
    { codigo: '701.10.01', nombre: 'Comisiones Bancarias', tipo: 'Gastos' }
];

export const TIPOS_ODOO = [
    'Inventario',
    'Gasto Operativo',
    'Activo Fijo',
    'Servicio',
    'Mantenimiento'
];

export function suggestCategory(description) {
    const d = description.toLowerCase();
    if (d.includes('flete') || d.includes('envio') || d.includes('acarreo')) return 'Servicios / Fletes';
    if (d.includes('renta') || d.includes('alquiler')) return 'Gastos / Arrendamiento';
    if (d.includes('luz') || d.includes('cfe') || d.includes('electrica')) return 'Servicios / Electricidad';
    if (d.includes('tel') || d.includes('internet') || d.includes('izzi') || d.includes('telmex')) return 'Servicios / Telecom';
    if (d.includes('gasolin') || d.includes('diesel') || d.includes('combustible')) return 'Gastos / Combustible';
    if (d.includes('limpieza') || d.includes('detergente') || d.includes('jabon')) return 'Gastos / Limpieza';
    if (d.includes('papel') || d.includes('tinta') || d.includes('toner') || d.includes('oficina')) return 'Gastos / Papelería';
    
    // Default hardware categories
    if (d.includes('tubo') || d.includes('pvc') || d.includes('codo')) return 'Ferretería / Plomería';
    if (d.includes('cable') || d.includes('foco') || d.includes('apagador')) return 'Ferretería / Eléctrico';
    if (d.includes('martillo') || d.includes('pinza') || d.includes('desarmador')) return 'Ferretería / Herramientas';
    
    return 'Ferretería / General';
}

export function suggestAccount(description) {
    const d = description.toLowerCase();
    
    // Specific expense mapping
    if (d.includes('renta') || d.includes('alquiler')) return '601.46.01 — Alquiler de Oficina (P. Morales)';
    if (d.includes('flete') || d.includes('envio')) return '602.72.01 — Fletes y Acarreos';
    if (d.includes('luz') || d.includes('cfe')) return '601.52.01 — Electricidad';
    if (d.includes('agua')) return '601.51.01 — Agua';
    if (d.includes('internet') || d.includes('tel')) return '601.50.01 — Teléfono e Internet';
    if (d.includes('gasolin') || d.includes('diesel')) return '601.48.01 — Combustible y Lubricantes';
    if (d.includes('limpieza')) return '601.54.01 — Limpieza';
    if (d.includes('papel') || d.includes('oficina')) return '601.55.01 — Papelería y Suministros';
    if (d.includes('software') || d.includes('membresia')) return '601.60.01 — Software y Suscripciones';
    if (d.includes('comision') && d.includes('banc')) return '701.10.01 — Comisiones Bancarias';
    
    // Default for inventory products
    return '115.01.01 — Inventario';
}

export function calculateMarkup(description) {
    const d = description.toLowerCase();
    if (d.includes('renta') || d.includes('luz') || d.includes('tel')) return 0; // Gastos no tienen markup
    if (d.includes('flete')) return 0;
    
    // Default markups by type
    return 1.25; // 25% average
}

export function calculateSalesPrice(cost, markup) {
    if (markup === 0) return cost;
    return cost * markup;
}

export function shieldSKU(sku, description, provider) {
    if (!sku || sku === 'S/SKU') {
        const hash = Math.abs(description.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0));
        sku = `GEN-${hash.toString(36).toUpperCase().substring(0,6)}`;
    }

    const p = provider.toUpperCase();
    if (p.includes('TRUPER')) return `TRU-${sku}`;
    if (p.includes('ADIR')) return `ADIR-${sku}`;
    if (p.includes('IUSAC')) return `IUS-${sku}`;
    if (p.includes('URREA')) return `URR-${sku}`;
    if (p.includes('SANTUL')) return `SAN-${sku}`;
    if (p.includes('MAKITA')) return `MAK-${sku}`;
    if (p.includes('DEWALT')) return `DEW-${sku}`;
    if (p.includes('FANDELI')) return `FAN-${sku}`;
    if (p.includes('AUSTROMEX')) return `AUS-${sku}`;
    
    return `HM-${sku}`; // HerraMax Generic
}
