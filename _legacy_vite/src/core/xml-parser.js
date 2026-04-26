/**
 * XML Parser for HerraMax V4
 * "Deep Extraction" mode: RFC, Email, Phone, Zip, and Regime.
 */
import { suggestCategory, suggestAccount, calculateMarkup, calculateSalesPrice, shieldSKU } from './odoo-logic';

export async function parseInvoiceXml(file) {
    const text = await file.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "application/xml");

    const ns = {
        cfdi: "http://www.sat.gob.mx/cfd/4",
        cfdi3: "http://www.sat.gob.mx/cfd/3",
        tfd: "http://www.sat.gob.mx/TimbreFiscalDigital"
    };

    try {
        const comp = xml.querySelector('Comprobante') || 
                     xml.getElementsByTagNameNS(ns.cfdi, 'Comprobante')[0] || 
                     xml.getElementsByTagNameNS(ns.cfdi3, 'Comprobante')[0] ||
                     xml.documentElement;
        
        const emisorNode = xml.querySelector('Emisor') || 
                           xml.getElementsByTagNameNS(ns.cfdi, 'Emisor')[0] || 
                           xml.getElementsByTagNameNS(ns.cfdi3, 'Emisor')[0];
        
        let emisorName = 'Proveedor Desconocido';
        let rfc = '';
        let email = '';
        let phone = '';
        let cp = '';
        let regimen = '';

        if (emisorNode) {
            emisorName = emisorNode.getAttribute('Nombre') || emisorNode.getAttribute('nombre') || 'Proveedor Desconocido';
            rfc = emisorNode.getAttribute('Rfc') || emisorNode.getAttribute('rfc') || '';
            regimen = emisorNode.getAttribute('RegimenFiscal') || '';
        }

        // Location Info (LugarExpedicion is the CP of the issuer in many cases)
        cp = comp.getAttribute('LugarExpedicion') || '';

        if (!rfc) {
            const rfcMatch = text.match(/[A-Z&Ñ]{3,4}[0-9]{2}(0[1-9]|1[012])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{2}[0-9A]/i);
            rfc = rfcMatch ? rfcMatch[0] : '';
        }

        const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        if (emailMatches) {
            const realEmails = emailMatches.filter(e => !e.includes('sat.gob.mx') && !e.includes('w3.org'));
            if (realEmails.length > 0) email = realEmails[0];
        }

        const phoneMatches = text.match(/(?:\+?52\s?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/g);
        if (phoneMatches) {
            const realPhones = phoneMatches.filter(p => {
                const digits = p.replace(/\D/g, '');
                return digits.length === 10 && !digits.startsWith('0000');
            });
            if (realPhones.length > 0) phone = realPhones[0];
        }

        const fechaAttr = Array.from(comp.attributes).find(a => a.name.toLowerCase() === 'fecha');
        const fecha = (fechaAttr ? fechaAttr.value : '').substring(0, 10);
        
        const tfd = xml.querySelector('TimbreFiscalDigital') || 
                    xml.getElementsByTagNameNS(ns.tfd, 'TimbreFiscalDigital')[0];
        const uuid = tfd?.getAttribute('UUID') || tfd?.getAttribute('uuid') || `MANUAL-${Math.random().toString(36).substr(2, 9)}`;

        const conceptNodes = Array.from(xml.querySelectorAll('Concepto')) || 
                             Array.from(xml.getElementsByTagNameNS(ns.cfdi, 'Concepto')) || 
                             Array.from(xml.getElementsByTagNameNS(ns.cfdi3, 'Concepto'));

        return conceptNodes.map((node, index) => {
            const desc = node.getAttribute('Descripcion') || node.getAttribute('descripcion') || '';
            const cost = parseFloat(node.getAttribute('ValorUnitario') || node.getAttribute('valorUnitario') || 0);
            const qty = parseFloat(node.getAttribute('Cantidad') || node.getAttribute('cantidad') || 0);
            
            return {
                id: `${uuid}-${index}`,
                uuid,
                fecha,
                provider: emisorName.toUpperCase().trim(),
                rfc: (rfc || '').toUpperCase().trim(),
                email: email.toLowerCase().trim(),
                phone: phone.trim(),
                cp,
                regimen,
                skuOriginal: node.getAttribute('NoIdentificacion') || 'S/SKU',
                skuShielded: shieldSKU(node.getAttribute('NoIdentificacion'), desc, emisorName),
                description: desc.toUpperCase().trim(),
                cost,
                qty,
                subtotal: cost * qty,
                category: suggestCategory(desc),
                account: suggestAccount(desc),
                markup: calculateMarkup(desc),
                suggestedPrice: calculateSalesPrice(cost, calculateMarkup(desc)),
                odooType: 'Gasto Operativo'
            };
        });
    } catch (error) {
        throw error;
    }
}
