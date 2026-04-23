# HerraMax Purchasing Intelligence V4 🚀

Herramienta de auditoría y automatización de compras de alta precisión para **HerraMax Plus**. Diseñada para procesar facturas XML (CFDI 3.3/4.0), enriquecer datos de productos y generar archivos de importación masiva para Odoo sin errores manuales.

## ✨ Características Principales
- **Extractor "Sabueso" V4**: Localización profunda de RFC, Emails, Teléfonos y C.P. en facturas XML.
- **SKU Shielding**: Blindaje automático de SKUs con prefijos por marca (TRU-, ADIR-, IUS-, etc.) para evitar duplicados en Odoo.
- **Catálogo Odoo 2026**: Clasificación automática basada en el catálogo real de más de 140 cuentas.
- **Exportación "Full Data"**: CSVs listos para Odoo (Contactos y Productos) con codificación UTF-8 BOM para Excel.
- **Auditoría de Precios**: Cálculo automático de márgenes y sugerencia de precios de venta.

## 🛠️ Tecnologías
- **React 19 + Vite**: Velocidad de desarrollo y ejecución.
- **Tailwind CSS v4**: Interfaz de alta densidad "Glassmorphism".
- **Lucide Icons**: Diseño visual premium.
- **PapaParse**: Procesamiento robusto de CSVs.

## 🚀 Despliegue Rápido
Este proyecto está configurado para desplegarse automáticamente en GitHub Pages.

1. **Instalar dependencias**: `npm install`
2. **Desplegar**: `npm run deploy`

## 📁 Estructura del Proyecto
- `/src/core`: Lógica de negocio, parser de XML y reglas de Odoo.
- `/src/views`: Módulos de Procesamiento, Proveedores y Etiquetas.
- `/src/store`: Gestión de estado persistente (LocalStorage).

---
*Desarrollado para HerraMax Plus - 2026*
