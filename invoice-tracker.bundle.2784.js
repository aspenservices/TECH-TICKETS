import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getDatabase, ref, onValue, push, set, remove, update, child, get } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

// ════════════════════════════════════════════════════════════
// CONFIGURACIÓN — Se guarda en localStorage. Edítala desde el botón ⚙ del header
// No necesitas editar este HTML manualmente
// ════════════════════════════════════════════════════════════
const SETTINGS_KEY = 'aspenInvoiceTracker_settings_v1';

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

const savedSettings = loadSettings() || {};
// ═══════════════════════════════════════════════════════════════════
// FIREBASE_CONFIG — hardcoded from Firebase Console (invoice-daily-f170e)
// User-saved settings can override, but defaults work out-of-the-box.
// ═══════════════════════════════════════════════════════════════════
const FIREBASE_CONFIG = savedSettings.firebaseConfig || {
  apiKey: "AIzaSyAG6k-VLWPfYF2xq989j8PUUCySL8MIyLU",
  authDomain: "invoice-daily-f170e.firebaseapp.com",
  databaseURL: "https://invoice-daily-f170e-default-rtdb.firebaseio.com",
  projectId: "invoice-daily-f170e",
  storageBucket: "invoice-daily-f170e.firebasestorage.app",
  messagingSenderId: "660377797408",
  appId: "1:660377797408:web:f90ffe0c821ce09ff20d45",
  measurementId: "G-WVPTSMFS72"
};
const COMPANY_PHONE = savedSettings.phone || '314-XXX-XXXX';
const COMPANY_WEBSITE = savedSettings.website || 'aspenspas.com';
const COMPANY_ADDRESS = savedSettings.address || '';
const FROM_NAME = savedSettings.fromName || 'Aspen Spas Service';

// ════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ════════════════════════════════════════════════════════════
let db = null;
let allInvoices = [];

// PRODUCTION CANDIDATE · Payment Follow-up bridge (read-only data access)
window.itkInvoiceDataReady = false;
window.itkGetAllInvoices = () => allInvoices.slice();
window.itkGetInvoiceById = (id) => allInvoices.find(i => String(i.id) === String(id)) || null;


// ════════════════════════════════════════════════════════════
// i18n — bilingual support (ES default / EN toggle)
// ════════════════════════════════════════════════════════════
const I18N = {
  es: {
    // Header
    'app.subtitle': 'Aspen Spas · service2@aspenspas.com',
    'header.connection.cloud': 'Sincronizado',
    'header.connection.local': 'Modo local (sin Firebase)',
    'header.notif.on': 'Notificaciones activas (click para desactivar)',
    'header.notif.off': 'Activar notificaciones',
    'header.notif.title': 'Estado de notificaciones',
    // Settings — collections team
    'settings.collections.title': 'Equipo de cobros (alertas internas)',
    'settings.collections.hint': 'Cuando marques una factura con CC declinada o sin CC en archivo, el sistema te ofrece mandar un email interno a la persona encargada de cobros.',
    'settings.collections.name': 'Nombre de la persona',
    'settings.collections.email': 'Email de la persona',
    'settings.collections.name.ph': 'Ej. Celia',
    'settings.collections.email.ph': 'ej. celia@aspenspas.com',
    'header.lang': 'EN',
    'header.lang.title': 'Switch to English',
    'header.settings': 'Configuración',
    // Setup banner
    'setup.title': 'Configuración pendiente:',
    'setup.body': 'Edita el archivo HTML y reemplaza el bloque FIREBASE_CONFIG con las credenciales de tu proyecto Firebase. Mientras tanto los datos se guardan solo en este navegador.',
    // Stats
    'stat.pending': 'Pendientes envío',
    'stat.pending.uptodate': 'Al día',
    'stat.pending.with24h': '{0} con +24h',
    'stat.followup': 'Por cobrar',
    'stat.followup.meta': '+7 días sin pago',
    'stat.cc': '💳 Pendiente CC / cobro',
    'stat.cc.meta': 'Click para ver',
    'stat.cc.allgood': 'Todo al día',
    'stat.sent': 'Enviadas este mes',
    'stat.paid': 'Cobradas este mes',
    // Aging
    'aging.title': '📊 Envejecimiento de cuentas por cobrar',
    'aging.totalSuffix': 'por cobrar',
    'aging.band.fresh': '0-7 días',
    'aging.band.warn': '8-14 días',
    'aging.band.late': '15-30 días',
    'aging.band.critical': '+30 días',
    'aging.invoices': 'factura(s)',
    // Tabs
    'tab.today': '🌅 Hoy',
    'tab.all': 'Todas',
    'tab.pending': 'Pendientes',
    'tab.followup': 'Por cobrar',
    'tab.sent': 'Enviadas',
    'tab.paid': 'Pagadas',
    'tab.snoozed': '💤 Snoozeadas',
    'tab.problems': '🚨 Problemas',
    'tab.senttoday': '📤 Enviadas hoy',
    'unconfirmed.banner': 'Tienes {0} alerta(s) generada(s) hace más de 24h que no confirmaste si las enviaste.',
    'unconfirmed.review': 'Revisar',
    'tab.customers': '👥 Clientes',
    'tab.techs': '👷 Técnicos',
    // Toolbar
    'toolbar.search': 'Buscar por cliente, factura, email… (encuentra snoozeadas)',
    'toolbar.exportCsv': 'Exportar CSV',
    'toolbar.exportQb': '📤 Exportar a QB',
    'toolbar.weeklyReport': '📑 Reporte semanal',
    'toolbar.bulkSend': '📦 Bulk send',
    'toolbar.exportQb.title': 'Formato compatible para importar pagos a QuickBooks',
    'toolbar.newInvoice': '+ Nueva Factura',
    // Today view
    'today.section.pending': '📤 Por enviar',
    'today.section.followup': '📅 Follow-ups que tocan hoy',
    'today.section.overdue': '⏰ Sin cobrar +14 días',
    'today.section.cc': '📞 CC sin pedir',
    'today.empty.title': '¡Todo al día!',
    'today.empty.text': 'No hay facturas pendientes de mandar, follow-ups que tocan hoy, ni cobros vencidos. Disfruta el día. 🎉',
    // Problem accounts
    'problems.empty.title': 'Sin cuentas problemáticas',
    'problems.empty.text': 'Los clientes que tengan 2+ facturas con CC declined / sin respuesta / disputa / +30 días sin pagar aparecerán aquí. Ahorita todo limpio.',
    'problems.intro': 'Clientes con historial problemático — pídeles CC al frente la próxima vez.',
    'problems.invoiceCount': '📊 {0} factura(s) históricas',
    'problems.daysUnpaid': '⏰ +{0} días sin pagar',
    'problems.viewProfile': 'Ver ficha →',
    'problems.totalSuffix': 'de {0} total',
    // Card actions
    'card.send': 'Mandar',
    'card.resend': 'Reenviar',
    'card.markPaid': '✓ Pagada',
    'card.payment.title': 'Estado de cobro',
    // Payment status modal
    'payment.title': '💳 Estado de cobro',
    'payment.method.label': 'Método de pago (si ya cobró)',
    'payment.method.none': '— Sin pagar —',
    'payment.method.check': '📝 Cheque',
    'payment.method.cash': '💵 Efectivo',
    'payment.method.cc': '💳 Tarjeta',
    'payment.method.ipospays': '🟢 ipospays',
    'payment.method.authnet': '🔵 Authorize.net',
    'payment.method.ach': '🏦 ACH',
    'payment.method.zelle': '📱 Zelle',
    'payment.method.venmo': '📱 Venmo',
    'payment.method.square': '⬛ Square',
    'payment.method.other': '❓ Otro',
    'payment.method.ref.ph': '# de cheque / últimos 4 de CC / referencia (opcional)',
    'payment.qbSync.label': '📒 Ya entrada en QuickBooks',
    'payment.qbSync.hint': 'Deja sin marcar si todavía necesitas registrar este pago en QB Desktop. Los pagos no sincronizados aparecen en la pestaña "💳 Pagadas · QB Pendiente".',
    'payment.check.location.title': 'Ubicación del cheque',
    'payment.check.location.choose': '— Seleccionar —',
    'payment.check.location.with_tech': 'Con el técnico (no entregado a oficina)',
    'payment.check.location.office': 'Llegó a oficina (pendiente depositar)',
    'payment.check.location.deposited': 'Depositado en banco',
    'payment.check.location.other': 'Otro / desconocido',
    'payment.check.notify': 'Notificar equipo de depósitos (con PDF adjunto)',
    'payment.check.notify.hint': 'Genera un email con la info del cheque y PDF de la factura, para que la oficina sepa qué cobrar y dónde está.',
    'payment.alerts.title': 'Alertas internas enviadas',
    'payment.alerts.hint': 'El sistema generó este email — confirma en Outlook → Sent que se envió.',
    'payment.reason.label': 'Motivo de no cobro',
    'payment.reason.cc_needed': '📞 Falta CC en archivo',
    'payment.reason.cc_declined': '❌ CC declinada',
    'payment.reason.no_response': '🔇 Cliente no contesta',
    'payment.reason.partial': '💵 Pago parcial',
    'payment.reason.pending': '⏳ Pago pendiente',
    'payment.reason.disputed': '⚠️ En disputa',
    'payment.reason.none': '— Ninguno —',
    'payment.cc.requested': 'Ya se le pidió el número de tarjeta',
    'payment.followup.label': 'Próximo follow-up (recordatorio)',
    'payment.followup.hint': 'Aparecerá en banner de alerta cuando llegue la fecha',
    'payment.note.label': 'Nota interna del cobro',
    'payment.note.ph': 'Ej: Cliente pidió volver a llamar el lunes',
    'card.snooze.title': 'Snooze',
    'card.unsnooze.title': 'Quitar snooze',
    'card.edit': 'Editar',
    'card.delete.title': 'Eliminar',
    'card.daysSinceCreated': 'creada hace {0}d',
    'card.daysSinceSent': 'enviada hace {0}d',
    'card.ccRequested': '✓ CC pedida',
    'card.ccRequestedTitle': 'Ya se le pidió la tarjeta',
    'card.followupOn': '📅 Follow-up {0}',
    'card.snoozedUntil': '💤 Snooze hasta {0}',
    'card.snoozedUntilTitle': 'Snoozeada hasta {0}',
    'card.timesResent': '📨 {0}× enviada',
    'card.timesResentTitle': 'Recordatorio #{0}',
    // Status
    'status.pending': 'SIN ENVIAR',
    'status.sent': 'ENVIADA',
    'status.followup': 'FOLLOW-UP',
    'status.paid': 'PAGADA',
    // Invoice form
    'form.invoice.new': 'Nueva factura',
    'form.invoice.edit': 'Editar factura',
    'form.invoice.number': 'Número de factura',
    'form.invoice.amount': 'Monto',
    'form.customer.name': 'Cliente (nombre completo)',
    'form.customer.namePlaceholder': 'Empieza a escribir para buscar...',
    'form.customer.nameHint': 'Si el cliente ya existe, lo seleccionas y se autocompletan email, modelo, serial',
    'form.customer.greeting': 'Nombre para saludo (Hi ___,)',
    'form.customer.greetingPlaceholder': 'Auto desde nombre completo',
    'form.customer.greetingHint': 'Vacío = se autocompleta',
    'form.customer.email': 'Email del cliente',
    'form.customer.email.optional': '(opcional — déjalo vacío si no tiene)',
    'form.customer.emailPlaceholder': 'cliente@email.com',
    'form.customer.phone': '📱 Teléfono',
    'form.customer.phone.optional': '(opcional — para enviar por iMessage)',
    'form.customer.phonePlaceholder': '(314) 555-1234',
    // Warranty calculator
    'warranty.openBtn': '🛡 Garantía',
    'warranty.openBtn.title': 'Calculadora de garantía — checa si un servicio está dentro de la cobertura',
    // Customer list
    'customer.list.subtitle': 'Tu lista de clientes — se llena automáticamente al facturar',
    'customer.addBtn': '+ Agregar cliente',
    'customer.editBtn': 'Editar',
    'customer.invoiceCount.one': '1 factura',
    'customer.invoiceCount.many': '{0} facturas',
    'customer.empty.title': 'No tienes clientes guardados aún',
    'customer.empty.text': 'Cada vez que crees una factura nueva con un cliente que no exista, se agregará automáticamente aquí. O puedes agregar uno manualmente.',
    'customer.search.noMatch': 'Sin coincidencias locales — escribe el nombre completo o usa "+ Agregar cliente"',
    // Today revenue widget
    'today.revenue.label': '📤 Hoy',
    'today.revenue.yesterday': 'Ayer',
    // Notification panel
    'notif.panel.title': 'Notificaciones de seguimiento',
    // Form close button
    'form.close': 'Cerrar',
    // Email stages
    'email.stage4': '✅ Recibo',
    'email.stage4.desc': 'Gracias, ya pagada',
    // Warranty modal
    'warranty.title': 'Calculadora de garantía',
    'warranty.model.label': 'Modelo del spa *',
    'warranty.model.hint': 'El sistema detecta automáticamente la serie (VS / GS / GS+ / ES / SS) en el nombre.',
    'warranty.delivery.label': 'Fecha de delivery *',
    'warranty.service.label': 'Fecha de servicio',
    'warranty.item.label': 'Item específico (opcional)',
    'warranty.item.generic': '— Reparación general (rige por serie) —',
    'warranty.item.stereo': 'Stereo / Speakers (1 año)',
    'warranty.item.lifts': 'Lifts (1 año)',
    'warranty.item.covers': 'Covers (1 año)',
    'warranty.item.ozone': 'Ozone (1 año)',
    'warranty.item.salt': 'Salt System (1 año)',
    'warranty.item.lights': 'LED / Pin lights (1 año)',
    'warranty.item.waterfall': 'Waterfall (1 año)',
    'warranty.item.pumps': 'Pump seals (1 año)',
    'warranty.item.band': 'Stainless band (1 año)',
    'warranty.item.pillow': 'Pillows (3 meses)',
    'warranty.cost.label': 'Costo estimado (opcional, para sugerir cargo al cliente)',
    'warranty.calculate': '⚡ Calcular',
    'warranty.rules.title': '📋 Ver reglas oficiales (Aspen Spas)',
    'warranty.apply': '📋 Aplicar nota a la factura',
    // Cross-app alert
    'crossapp.alert.title': 'Alertar a Tech Team',
    'crossapp.alert.intro': 'Esta alerta aparecerá en la app de TECH-TICKETS',
    'crossapp.alert.intro2': 'como banner en la ficha del cliente. Los técnicos la verán cuando vayan a hacer un servicio.',
    'crossapp.alert.severity.label': 'Urgencia',
    'crossapp.alert.severity.urgent': '🚨 Urgente — no hacer servicio sin cobrar',
    'crossapp.alert.severity.warn': '⚠ Aviso — preguntar antes del servicio',
    'crossapp.alert.severity.info': 'ℹ Informativo — solo para que sepa',
    'crossapp.alert.note.label': 'Nota adicional para el técnico (opcional)',
    'crossapp.alert.note.placeholder': 'Ej. Tom ya habló con el cliente — esperar a que llamen',
    'crossapp.alert.publish': '🔔 Publicar alerta',
    'form.serviceDate': 'Fecha de servicio',
    'form.technician': 'Técnico',
    'form.technicianPlaceholder': 'Selecciona',
    'form.serviceDesc': 'Descripción del servicio',
    'form.serviceDescPlaceholder': 'Ej. Replaced control board',
    'form.spaModel': 'Modelo del spa',
    'form.spaModelPlaceholder': 'Ej. 2014 El Dorado ES',
    'form.serial': 'Número de serie',
    'form.serialPlaceholder': 'Ej. 13542',
    'form.notes': 'Notas internas',
    'form.notesPlaceholder': 'No se manda al cliente',
    'form.cancel': 'Cancelar',
    'form.save': 'Guardar',
    'form.update': 'Actualizar',
    'form.delete': 'Eliminar',
    // Validation
    'form.validate.missing': '⚠ Falta: {0}',
    'form.validate.field.invoiceNumber': 'Número de factura',
    'form.validate.field.amount': 'Monto',
    'form.validate.field.customer': 'Cliente',
    'form.validate.field.email': 'Email del cliente',
    'form.validate.field.emailFormat': 'Email con formato válido',
    // Empty states
    'list.empty.title': 'No hay facturas',
    'list.empty.text': 'Click "+ Nueva Factura" para empezar.',
    // Toasts
    'toast.invoiceCreated': 'Factura agregada',
    'toast.invoiceUpdated': 'Factura actualizada',
    'toast.invoiceDeleted': 'Factura eliminada',
    'toast.markedSent': 'Factura #{0} marcada como enviada ({1})',
    'toast.markedPaid': 'Factura #{0} marcada como pagada',
    'toast.snoozedUntil': '💤 Snoozeada hasta {0}',
    'toast.unsnoozed': '⏰ Snooze quitado de #{0}',
    'toast.qbExported': '✓ {0} pagos exportados para QB',
    'toast.qbNoPayments': 'No hay facturas marcadas como pagadas con método. Marca el método de pago en cada factura primero.',
    'toast.notifEnabled': '🔔 Notificaciones activadas. Te alerto cuando haya follow-ups vencidos.',
    'toast.notifDisabled': 'Notificaciones desactivadas',
    'toast.notifTestTitle': '🔔 Notificaciones activas',
    'toast.notifTestBody': 'Te avisaré aquí cuando haya facturas que requieren follow-up.',
    'toast.langChanged': 'Idioma cambiado a Español',
    'toast.ticketsImported': '✓ Datos de "{0}" importados{1}',
    'toast.autoExtracted': ' · auto-extraído: {0}',
    // Email stages
    'email.stage1': '1️⃣ Primer envío',
    'email.stage1.desc': 'Cordial, agradecido',
    'email.stage2': '2️⃣ Recordatorio',
    'email.stage2.desc': 'Amigable, +7 días',
    'email.stage3': '3️⃣ Aviso final',
    'email.stage3.desc': 'Firme, past due',
    'email.tone': 'Tono del mensaje',
    // Sent labels
    'stage.firstSend': 'primer envío',
    'stage.reminder': 'recordatorio',
    'stage.pastDue': 'aviso final',
    'stage.receipt': 'recibo de pago',
  },
  en: {
    // Header
    'app.subtitle': 'Aspen Spas · service2@aspenspas.com',
    'header.connection.cloud': 'Synced',
    'header.connection.local': 'Local mode (no Firebase)',
    'header.notif.on': 'Notifications enabled (click to disable)',
    'header.notif.off': 'Enable notifications',
    'header.notif.title': 'Notification status',
    // Settings — collections team
    'settings.collections.title': 'Collections team (internal alerts)',
    'settings.collections.hint': 'When you mark an invoice with CC declined or no CC on file, the system offers to send an internal email to the person handling collections.',
    'settings.collections.name': 'Person\'s name',
    'settings.collections.email': 'Person\'s email',
    'settings.collections.name.ph': 'E.g. Celia',
    'settings.collections.email.ph': 'e.g. celia@aspenspas.com',
    'header.lang': 'ES',
    'header.lang.title': 'Cambiar a Español',
    'header.settings': 'Settings',
    // Setup banner
    'setup.title': 'Setup pending:',
    'setup.body': 'Edit the HTML file and replace the FIREBASE_CONFIG block with your Firebase project credentials. Meanwhile data is saved only in this browser.',
    // Stats
    'stat.pending': 'Pending to send',
    'stat.pending.uptodate': 'Up to date',
    'stat.pending.with24h': '{0} with +24h',
    'stat.followup': 'To collect',
    'stat.followup.meta': '+7 days unpaid',
    'stat.cc': '💳 Pending CC / collection',
    'stat.cc.meta': 'Click to view',
    'stat.cc.allgood': 'All caught up',
    'stat.sent': 'Sent this month',
    'stat.paid': 'Collected this month',
    // Aging
    'aging.title': '📊 A/R aging',
    'aging.totalSuffix': 'to collect',
    'aging.band.fresh': '0-7 days',
    'aging.band.warn': '8-14 days',
    'aging.band.late': '15-30 days',
    'aging.band.critical': '+30 days',
    'aging.invoices': 'invoice(s)',
    // Tabs
    'tab.today': '🌅 Today',
    'tab.all': 'All',
    'tab.pending': 'Pending',
    'tab.followup': 'To collect',
    'tab.sent': 'Sent',
    'tab.paid': 'Paid',
    'tab.snoozed': '💤 Snoozed',
    'tab.problems': '🚨 Problems',
    'tab.senttoday': '📤 Sent today',
    'unconfirmed.banner': 'You have {0} alert(s) generated more than 24h ago that you never confirmed sent.',
    'unconfirmed.review': 'Review',
    'tab.customers': '👥 Customers',
    'tab.techs': '👷 Technicians',
    // Toolbar
    'toolbar.search': 'Search by customer, invoice, email… (finds snoozed)',
    'toolbar.exportCsv': 'Export CSV',
    'toolbar.exportQb': '📤 Export to QB',
    'toolbar.weeklyReport': '📑 Weekly report',
    'toolbar.bulkSend': '📦 Bulk send',
    'toolbar.exportQb.title': 'QuickBooks-compatible payment import format',
    'toolbar.newInvoice': '+ New Invoice',
    // Today view
    'today.section.pending': '📤 To send',
    'today.section.followup': '📅 Follow-ups due today',
    'today.section.overdue': '⏰ Unpaid +14 days',
    'today.section.cc': '📞 CC not requested yet',
    'today.empty.title': 'All caught up!',
    'today.empty.text': 'No invoices pending to send, no follow-ups due today, no overdue collections. Enjoy the day. 🎉',
    // Problem accounts
    'problems.empty.title': 'No problem accounts',
    'problems.empty.text': 'Customers with 2+ invoices with CC declined / no response / disputed / +30 days unpaid will appear here. Currently all clean.',
    'problems.intro': 'Customers with problematic history — ask for CC up front next time.',
    'problems.invoiceCount': '📊 {0} historical invoice(s)',
    'problems.daysUnpaid': '⏰ +{0} days unpaid',
    'problems.viewProfile': 'View profile →',
    'problems.totalSuffix': 'of {0} total',
    // Card actions
    'card.send': 'Send',
    'card.resend': 'Resend',
    'card.markPaid': '✓ Paid',
    'card.payment.title': 'Payment status',
    // Payment status modal
    'payment.title': '💳 Payment status',
    'payment.method.label': 'Payment method (if already collected)',
    'payment.method.none': '— Unpaid —',
    'payment.method.check': '📝 Check',
    'payment.method.cash': '💵 Cash',
    'payment.method.cc': '💳 Credit card',
    'payment.method.ipospays': '🟢 ipospays',
    'payment.method.authnet': '🔵 Authorize.net',
    'payment.method.ach': '🏦 ACH',
    'payment.method.zelle': '📱 Zelle',
    'payment.method.venmo': '📱 Venmo',
    'payment.method.square': '⬛ Square',
    'payment.method.other': '❓ Other',
    'payment.method.ref.ph': 'Check # / last 4 of CC / reference (optional)',
    'payment.qbSync.label': '📒 Already entered in QuickBooks',
    'payment.qbSync.hint': 'Leave unchecked if you still need to record this payment in QB Desktop. Unsynced payments appear in the "💳 Paid · QB Pending" tab.',
    'payment.check.location.title': 'Check location',
    'payment.check.location.choose': '— Select —',
    'payment.check.location.with_tech': 'With technician (not delivered to office)',
    'payment.check.location.office': 'Arrived at office (pending deposit)',
    'payment.check.location.deposited': 'Deposited at bank',
    'payment.check.location.other': 'Other / unknown',
    'payment.check.notify': 'Notify deposit team (with PDF attached)',
    'payment.check.notify.hint': 'Generates an email with check info and invoice PDF, so the office knows what to deposit and where it is.',
    'payment.alerts.title': 'Internal alerts generated',
    'payment.alerts.hint': 'The system generated this email — confirm in Outlook → Sent that it was actually sent.',
    'payment.reason.label': 'Reason for no payment',
    'payment.reason.cc_needed': '📞 No CC on file',
    'payment.reason.cc_declined': '❌ CC declined',
    'payment.reason.no_response': '🔇 Customer not responding',
    'payment.reason.partial': '💵 Partial payment',
    'payment.reason.pending': '⏳ Pending payment',
    'payment.reason.disputed': '⚠️ Disputed',
    'payment.reason.none': '— None —',
    'payment.cc.requested': 'CC number has been requested',
    'payment.followup.label': 'Next follow-up (reminder)',
    'payment.followup.hint': 'Will appear in alerts banner when the date arrives',
    'payment.note.label': 'Internal payment note',
    'payment.note.ph': 'E.g.: Customer asked to call back on Monday',
    'card.snooze.title': 'Snooze',
    'card.unsnooze.title': 'Remove snooze',
    'card.edit': 'Edit',
    'card.delete.title': 'Delete',
    'card.daysSinceCreated': 'created {0}d ago',
    'card.daysSinceSent': 'sent {0}d ago',
    'card.ccRequested': '✓ CC requested',
    'card.ccRequestedTitle': 'CC has been requested',
    'card.followupOn': '📅 Follow-up {0}',
    'card.snoozedUntil': '💤 Snoozed until {0}',
    'card.snoozedUntilTitle': 'Snoozed until {0}',
    'card.timesResent': '📨 sent {0}×',
    'card.timesResentTitle': 'Reminder #{0}',
    // Status
    'status.pending': 'NOT SENT',
    'status.sent': 'SENT',
    'status.followup': 'FOLLOW-UP',
    'status.paid': 'PAID',
    // Invoice form
    'form.invoice.new': 'New invoice',
    'form.invoice.edit': 'Edit invoice',
    'form.invoice.number': 'Invoice number',
    'form.invoice.amount': 'Amount',
    'form.customer.name': 'Customer (full name)',
    'form.customer.namePlaceholder': 'Start typing to search...',
    'form.customer.nameHint': 'If the customer exists, select them to auto-fill email, model, serial',
    'form.customer.greeting': 'Greeting name (Hi ___,)',
    'form.customer.greetingPlaceholder': 'Auto from full name',
    'form.customer.greetingHint': 'Empty = auto-filled',
    'form.customer.email': 'Customer email',
    'form.customer.email.optional': '(optional — leave empty if customer has no email)',
    'form.customer.emailPlaceholder': 'customer@email.com',
    'form.customer.phone': '📱 Phone',
    'form.customer.phone.optional': '(optional — to send via iMessage)',
    'form.customer.phonePlaceholder': '(314) 555-1234',
    // Warranty calculator
    'warranty.openBtn': '🛡 Warranty',
    'warranty.openBtn.title': 'Warranty calculator — check if a service is within coverage',
    // Customer list
    'customer.list.subtitle': 'Your customer list — auto-populated when you invoice',
    'customer.addBtn': '+ Add customer',
    'customer.editBtn': 'Edit',
    'customer.invoiceCount.one': '1 invoice',
    'customer.invoiceCount.many': '{0} invoices',
    'customer.empty.title': 'No customers saved yet',
    'customer.empty.text': 'Every time you create a new invoice with a customer that doesn\'t exist, they\'ll be added here automatically. Or you can add one manually.',
    'customer.search.noMatch': 'No local matches — type the full name or use "+ Add customer"',
    // Today revenue widget
    'today.revenue.label': '📤 Today',
    'today.revenue.yesterday': 'Yesterday',
    // Notification panel
    'notif.panel.title': 'Follow-up notifications',
    // Form close button
    'form.close': 'Close',
    // Email stages
    'email.stage4': '✅ Receipt',
    'email.stage4.desc': 'Thanks, already paid',
    // Warranty modal
    'warranty.title': 'Warranty calculator',
    'warranty.model.label': 'Spa model *',
    'warranty.model.hint': 'The system auto-detects the series. Swim Spa always uses the 3-year Swim Spa rule, regardless of ES / GS / VS suffix.',
    'warranty.delivery.label': 'Delivery date *',
    'warranty.service.label': 'Service date',
    'warranty.item.label': 'Specific item (optional)',
    'warranty.item.generic': '— General repair (series rules apply) —',
    'warranty.item.stereo': 'Stereo / Speakers (1 year)',
    'warranty.item.lifts': 'Lifts (1 year)',
    'warranty.item.covers': 'Covers (1 year)',
    'warranty.item.ozone': 'Ozone (1 year)',
    'warranty.item.salt': 'Salt System (1 year)',
    'warranty.item.lights': 'LED / Pin lights (1 year)',
    'warranty.item.waterfall': 'Waterfall (1 year)',
    'warranty.item.pumps': 'Pump seals (1 year)',
    'warranty.item.band': 'Stainless band (1 year)',
    'warranty.item.pillow': 'Pillows (3 months)',
    'warranty.cost.label': 'Estimated cost (optional — to suggest customer charge)',
    'warranty.calculate': '⚡ Calculate',
    'warranty.rules.title': '📋 View official rules (Aspen Spas)',
    'warranty.apply': '📋 Apply note to invoice',
    // Cross-app alert
    'crossapp.alert.title': 'Alert Tech Team',
    'crossapp.alert.intro': 'This alert will appear in the TECH-TICKETS app',
    'crossapp.alert.intro2': 'as a banner on the customer record. Techs will see it when scheduled for service.',
    'crossapp.alert.severity.label': 'Urgency',
    'crossapp.alert.severity.urgent': '🚨 Urgent — do not service until paid',
    'crossapp.alert.severity.warn': '⚠ Warning — ask before service',
    'crossapp.alert.severity.info': 'ℹ Info only — just so they know',
    'crossapp.alert.note.label': 'Extra note for the tech (optional)',
    'crossapp.alert.note.placeholder': 'e.g. Tom already spoke with customer — wait for callback',
    'crossapp.alert.publish': '🔔 Publish alert',
    'form.serviceDate': 'Service date',
    'form.technician': 'Technician',
    'form.technicianPlaceholder': 'Select',
    'form.serviceDesc': 'Service description',
    'form.serviceDescPlaceholder': 'e.g. Replaced control board',
    'form.spaModel': 'Spa model',
    'form.spaModelPlaceholder': 'e.g. 2014 El Dorado ES',
    'form.serial': 'Serial number',
    'form.serialPlaceholder': 'e.g. 13542',
    'form.notes': 'Internal notes',
    'form.notesPlaceholder': 'Not sent to customer',
    'form.cancel': 'Cancel',
    'form.save': 'Save',
    'form.update': 'Update',
    'form.delete': 'Delete',
    // Validation
    'form.validate.missing': '⚠ Missing: {0}',
    'form.validate.field.invoiceNumber': 'Invoice number',
    'form.validate.field.amount': 'Amount',
    'form.validate.field.customer': 'Customer',
    'form.validate.field.email': 'Customer email',
    'form.validate.field.emailFormat': 'Valid email format',
    // Empty states
    'list.empty.title': 'No invoices',
    'list.empty.text': 'Click "+ New Invoice" to begin.',
    // Toasts
    'toast.invoiceCreated': 'Invoice added',
    'toast.invoiceUpdated': 'Invoice updated',
    'toast.invoiceDeleted': 'Invoice deleted',
    'toast.markedSent': 'Invoice #{0} marked as sent ({1})',
    'toast.markedPaid': 'Invoice #{0} marked as paid',
    'toast.snoozedUntil': '💤 Snoozed until {0}',
    'toast.unsnoozed': '⏰ Snooze removed from #{0}',
    'toast.qbExported': '✓ {0} payments exported for QB',
    'toast.qbNoPayments': 'No invoices marked as paid with payment method. Set payment method on each invoice first.',
    'toast.notifEnabled': '🔔 Notifications enabled. I\'ll alert you when follow-ups are due.',
    'toast.notifDisabled': 'Notifications disabled',
    'toast.notifTestTitle': '🔔 Notifications active',
    'toast.notifTestBody': 'I\'ll alert you here when invoices need follow-up.',
    'toast.langChanged': 'Language changed to English',
    'toast.ticketsImported': '✓ "{0}" data imported{1}',
    'toast.autoExtracted': ' · auto-extracted: {0}',
    // Email stages
    'email.stage1': '1️⃣ First send',
    'email.stage1.desc': 'Cordial, thankful',
    'email.stage2': '2️⃣ Reminder',
    'email.stage2.desc': 'Friendly, +7 days',
    'email.stage3': '3️⃣ Final notice',
    'email.stage3.desc': 'Firm, past due',
    'email.tone': 'Message tone',
    // Sent labels
    'stage.firstSend': 'first send',
    'stage.reminder': 'reminder',
    'stage.pastDue': 'final notice',
    'stage.receipt': 'paid receipt'
  }
};

let currentLang = (localStorage.getItem('aspenLang') || 'es');
if (!I18N[currentLang]) currentLang = 'es';

function t(key, ...args) {
  const dict = I18N[currentLang] || I18N.es;
  let str = (dict[key] !== undefined ? dict[key] : (I18N.es[key] !== undefined ? I18N.es[key] : key));
  args.forEach((arg, i) => { str = str.replace(`{${i}}`, arg); });
  return str;
}

function applyI18n() {
  // Text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  // Placeholder
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  // Title attribute
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  // HTML lang attribute
  document.documentElement.lang = currentLang;
}

window.toggleLang = function() {
  currentLang = (currentLang === 'es' ? 'en' : 'es');
  localStorage.setItem('aspenLang', currentLang);
  applyI18n();
  // Re-render dynamic content (cards, alerts, etc.)
  if (typeof computeAndRender === 'function') computeAndRender();
  toast(t('toast.langChanged'), 'success');
};
let allCustomers = [];
let currentFilter = 'all';
let searchTerm = '';
let editingId = null;
let editingCustomerId = null;
let sendingId = null;
let deletingId = null;
let useLocalStorage = false;
const LS_KEY_C = 'aspenInvoiceTracker_customers_v1';
let currentPdfBase64 = null;  // PDF subido en el form actual (base64)
let currentParseMeta = null;  // v33: procedencia del parseo (tier + confianza del monto)
let currentPdfAutoValues = {}; // fields auto-filled by the current PDF; cleared safely on remove
let currentPdfFilename = null;
// ─── Fields auto-extracted from Authorize.net PDFs (overlaid on saveInvoice) ───
// Stash here because they don't have a visible form field — applied at save time.
let currentExtractedStatus = null;        // 'paid' if Auth.net PDF status=Paid
let currentExtractedPaymentMethod = null; // 'auth_net' when Auth.net PDF detected
let currentExtractedQbSynced = null;      // false when extracted from Auth.net (= needs QB entry)
let currentExtractedPaidAt = null;        // timestamp from Auth.net invoice date when status=Paid
let currentPdfSize = 0;

const isConfigSet = FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('REEMPLAZAR');

// ════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ════════════════════════════════════════════════════════════
async function initFirebase() {
  if (!isConfigSet) {
    console.warn('Firebase no configurado, usando localStorage');
    document.getElementById('setupBanner').style.display = 'flex';
    setConnectionStatus('local', t('header.connection.local'));
    useLocalStorage = true;
    loadFromLocalStorage();
    return;
  }
  try {
    const app = initializeApp(FIREBASE_CONFIG);
    db = getDatabase(app);
    const auth = getAuth(app);
    setConnectionStatus('connecting', currentLang === 'en' ? 'Authenticating…' : 'Autenticando…');
    
    // Sign in anonymously — gives us a stable auth UID for Firestore/Realtime DB rules
    // Each browser/device gets its own anonymous user; same UID persists across reloads
    try {
      await signInAnonymously(auth);
      console.info('[Auth] Signed in anonymously, UID:', auth.currentUser?.uid);
    } catch (authErr) {
      console.error('[Auth] Anonymous sign-in failed:', authErr);
      // Common reason: Anonymous auth not enabled in Firebase Console
      if (authErr.code === 'auth/admin-restricted-operation' || authErr.code === 'auth/operation-not-allowed') {
        setConnectionStatus('error', currentLang === 'en'
          ? '⚠ Anonymous auth not enabled — enable in Firebase Console'
          : '⚠ Anonymous auth no habilitado — actívalo en Firebase Console');
        toast(currentLang === 'en'
          ? '⚠ Enable Anonymous sign-in in Firebase Console → Authentication → Sign-in method'
          : '⚠ Activa Anonymous sign-in en Firebase Console → Authentication → Sign-in method',
          'error');
      }
      // Fall through anyway — if rules still allow public, will work; if not, will error on read
    }
    
    setConnectionStatus('connecting', currentLang === 'en' ? 'Connecting to Firebase…' : 'Conectando a Firebase…');
    
    const invRef = ref(db, 'invoiceTracker/invoices');
    onValue(invRef, (snap) => {
      const data = snap.val() || {};
      allInvoices = Object.entries(data).map(([id, v]) => ({ id, ...v }));
      window.itkInvoiceDataReady = true;
      try{window.dispatchEvent(new CustomEvent('aspen:invoice-data',{detail:{count:allInvoices.length}}));}catch(_e){}
      setConnectionStatus('connected', t('header.connection.cloud') + ' · Firebase');
      computeAndRender();
    }, (err) => {
      console.error('Firebase error:', err);
      setConnectionStatus('error', currentLang === 'en' ? 'Connection error' : 'Error de conexión');
      useLocalStorage = true;
      loadFromLocalStorage();
    });
    
    // Suscripción al nodo de clientes
    const custRef = ref(db, 'invoiceTracker/customers');
    onValue(custRef, (snap) => {
      const data = snap.val() || {};
      allCustomers = Object.entries(data).map(([id, v]) => ({ id, ...v }));
      computeAndRender();
    });
    // Shared reconcile reminder state (synced across all devices/users)
    _subscribeSharedReconcile();
    // QB Backlog 5pm browser notification — checks every minute when enabled
    _startQbBacklogNotificationTimer();
  } catch (e) {
    console.error('Init error:', e);
    setConnectionStatus('error', 'Error al inicializar');
    useLocalStorage = true;
    loadFromLocalStorage();
  }
}

function setConnectionStatus(state, label) {
  const dot = document.getElementById('connDot');
  const txt = document.getElementById('connText');
  dot.className = 'connection-dot' + (state === 'connected' ? ' connected' : state === 'error' ? ' error' : '');
  txt.textContent = label;
  // Show prominent sync warning if not connected to Firebase
  const warn = document.getElementById('syncWarning');
  if (warn) {
    if (state === 'connected') {
      warn.style.display = 'none';
    } else if (state === 'local' || state === 'error') {
      warn.style.display = 'flex';
      const en = currentLang === 'en';
      if (state === 'local') {
        warn.innerHTML = `
          <div style="flex:1;">
            <strong>${en ? '⚠ Local mode (no sync between devices)' : '⚠ Modo local (sin sincronización entre equipos)'}</strong><br>
            <span style="font-size:12px;font-weight:400;">${en
              ? 'Data is saved only on this Mac. Other team members won\'t see your changes. To enable sync: Firebase needs to allow read/write — see README → Firebase Realtime Database Rules.'
              : 'Los datos se guardan solo en esta Mac. Tu equipo no verá tus cambios. Para sincronizar: Firebase debe permitir lectura/escritura — ver README → Firebase Realtime Database Rules.'}</span>
          </div>
          <button class="btn btn-sm" style="background:white;color:#9A3412;border:1px solid #FED7AA;padding:6px 12px;font-weight:700;font-size:11px;cursor:pointer;flex-shrink:0;" onclick="window.openSettingsModal()">${en ? 'Open Settings' : 'Abrir Settings'}</button>
        `;
      } else {
        warn.innerHTML = `
          <div style="flex:1;">
            <strong>${en ? '🚨 Firebase connection error' : '🚨 Error de conexión con Firebase'}</strong><br>
            <span style="font-size:12px;font-weight:400;">${en
              ? 'Cannot reach the database. Working in local fallback. Check your internet connection or Firebase Console.'
              : 'No se puede conectar a la base de datos. Trabajando en modo local. Revisa tu conexión a internet o Firebase Console.'}</span>
          </div>
          <button class="btn btn-sm" style="background:white;color:#991B1B;border:1px solid #FECACA;padding:6px 12px;font-weight:700;font-size:11px;cursor:pointer;flex-shrink:0;" onclick="location.reload()">${en ? 'Reload' : 'Recargar'}</button>
        `;
      }
    }
  }
}

// ════════════════════════════════════════════════════════════
// LOCAL STORAGE FALLBACK (mientras configuras Firebase)
// ════════════════════════════════════════════════════════════
const LS_KEY = 'aspenInvoiceTracker_v1';
function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY) || '[]';
    allInvoices = JSON.parse(raw);
    const rawC = localStorage.getItem(LS_KEY_C) || '[]';
    allCustomers = JSON.parse(rawC);
  } catch { allInvoices = []; allCustomers = []; }
  computeAndRender();
}
function saveToLocalStorage() {
  try { 
    localStorage.setItem(LS_KEY, JSON.stringify(allInvoices));
    localStorage.setItem(LS_KEY_C, JSON.stringify(allCustomers));
  } catch {}
}

// ════════════════════════════════════════════════════════════
// CRUD DE FACTURAS
// ════════════════════════════════════════════════════════════
async function createInvoice(data) {
  const now = Date.now();
  // Honor explicit status='paid' from data (e.g. Auth.net PDF auto-fill).
  // Default is 'pending' but data spread comes AFTER so it can override.
  const isPreSetPaid = data.status === 'paid';
  const invoice = {
    status: 'pending',
    ...data,
    createdAt: now,
    sentAt: data.sentAt || null,
    paidAt: isPreSetPaid ? (data.paidAt || now) : null,
    history: [{ ts: now, action: isPreSetPaid ? 'created_paid' : 'created',
                ...(isPreSetPaid && data.paymentMethod ? { via: data.paymentMethod } : {}) }]
  };
  if (useLocalStorage) {
    invoice.id = 'local_' + now;
    allInvoices.push(invoice);
    saveToLocalStorage();
    computeAndRender();
  } else {
    const newRef = push(ref(db, 'invoiceTracker/invoices'));
    await set(newRef, invoice);
  }
  toast(t('toast.invoiceCreated'), 'success');
}

async function updateInvoiceData(id, updates) {
  if (useLocalStorage) {
    const idx = allInvoices.findIndex(i => i.id === id);
    if (idx >= 0) {
      allInvoices[idx] = { ...allInvoices[idx], ...updates };
      saveToLocalStorage();
      computeAndRender();
    }
  } else {
    await update(ref(db, `invoiceTracker/invoices/${id}`), updates);
  }
}
window.itkUpdateInvoiceData = (id, updates) => updateInvoiceData(id, updates);


async function deleteInvoice(id) {
  if (useLocalStorage) {
    allInvoices = allInvoices.filter(i => i.id !== id);
    saveToLocalStorage();
    computeAndRender();
  } else {
    await remove(ref(db, `invoiceTracker/invoices/${id}`));
  }
  toast(t('toast.invoiceDeleted'), 'success');
}

// ════════════════════════════════════════════════════════════
// CRUD DE CLIENTES
// ════════════════════════════════════════════════════════════
async function createCustomer(data) {
  const now = Date.now();
  const customer = { ...data, createdAt: now, updatedAt: now };
  if (useLocalStorage) {
    customer.id = 'cust_' + now;
    allCustomers.push(customer);
    saveToLocalStorage();
    computeAndRender();
    return customer.id;
  } else {
    const newRef = push(ref(db, 'invoiceTracker/customers'));
    await set(newRef, customer);
    return newRef.key;
  }
}

async function updateCustomerData(id, updates) {
  updates.updatedAt = Date.now();
  if (useLocalStorage) {
    const idx = allCustomers.findIndex(c => c.id === id);
    if (idx >= 0) {
      allCustomers[idx] = { ...allCustomers[idx], ...updates };
      saveToLocalStorage();
      computeAndRender();
    }
  } else {
    await update(ref(db, `invoiceTracker/customers/${id}`), updates);
  }
}

async function deleteCustomer(id) {
  if (useLocalStorage) {
    allCustomers = allCustomers.filter(c => c.id !== id);
    saveToLocalStorage();
    computeAndRender();
  } else {
    await remove(ref(db, `invoiceTracker/customers/${id}`));
  }
}

// Auto-crear cliente desde datos de factura si no existe
async function autoCreateCustomerFromInvoice(invoiceData) {
  const matched = findCustomerByName(invoiceData.customerName);
  if (matched) {
    // Actualizar info que pueda haber cambiado
    const updates = {};
    if (invoiceData.customerEmail && invoiceData.customerEmail !== matched.email) updates.email = invoiceData.customerEmail;
    if (invoiceData.spaModel && !matched.spaModel) updates.spaModel = invoiceData.spaModel;
    if (invoiceData.serialNumber && !matched.serialNumber) updates.serialNumber = invoiceData.serialNumber;
    if (Object.keys(updates).length > 0) await updateCustomerData(matched.id, updates);
    return matched.id;
  }
  // Crear cliente nuevo
  return await createCustomer({
    name: invoiceData.customerName,
    greetingName: invoiceData.greetingName || deriveGreetingName(invoiceData.customerName),
    email: invoiceData.customerEmail,
    spaModel: invoiceData.spaModel || '',
    serialNumber: invoiceData.serialNumber || '',
    phone: '',
    address: '',
    cabinet: '',
    notes: ''
  });
}

function findCustomerByName(name) {
  if (!name) return null;
  const norm = name.trim().toLowerCase();
  // 1. Exact match first (fastest)
  let m = allCustomers.find(c => (c.name || '').trim().toLowerCase() === norm);
  if (m) return m;

  // 2. TOKEN-BASED MATCHING — handles QB flip, & vs and, middle initials, etc.
  //    "Joel Svoboda"  ↔  "Svoboda, Joel"            → MATCH
  //    "Bulejski, Denise and Jim"  ↔  "Denise and Jim Bulejski"  → MATCH
  //    Uses the same _nameMatchTokens / _tokensEqual / _tokensSubset helpers as the auto-fill.
  if (typeof _nameMatchTokens === 'function') {
    const qTokens = _nameMatchTokens(name);
    if (qTokens.length > 0) {
      // 2a. Exact token set match
      let cands = allCustomers.filter(c => _tokensEqual(_nameMatchTokens(c.name), qTokens));
      if (cands.length === 1) return cands[0];
      // 2b. Subset match (query tokens ⊂ candidate tokens) — user typed less than the canonical name
      if (cands.length === 0) {
        cands = allCustomers.filter(c => _tokensSubset(qTokens, _nameMatchTokens(c.name)));
        if (cands.length === 1) return cands[0];
        // Tie-break: pick the one with same token count (closest match)
        if (cands.length > 1) {
          const sameLen = cands.filter(c => _nameMatchTokens(c.name).length === qTokens.length);
          if (sameLen.length === 1) return sameLen[0];
        }
      }
    }
  }

  // 3. Legacy fallback: comma-flipped exact match
  if (norm.includes(',')) {
    const flipped = norm.split(',').map(s => s.trim()).reverse().join(' ').replace(/\s+/g, ' ');
    m = allCustomers.find(c => (c.name || '').trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ') === flipped);
    if (m) return m;
  }
  return null;
}

/* v2.60.0 — REGLA DE ORO DE IDENTIDAD. Este wrapper es por donde el tablero de
   pagos y Customer 360 leen telefono, email, modelo de spa y numero de serie.
   findCustomerByName hace matching por SUBCONJUNTO de tokens, asi que
   "Miller, Julie" matcheaba "Miller, Julie & Steve" y la ficha mostraba el
   telefono del hogar equivocado — exactamente lo que prohibe el bloque
   canonico "IDENTIDAD DE CLIENTE". Se llamaba a otra casa a hablar de una
   deuda. Ahora el resultado tiene que ser el MISMO hogar; si no, mejor no
   mostrar nada que mostrar datos de otro. */
window.itkFindCustomerByName = (name) => {
  const c = findCustomerByName(name);
  if (!c) return c;
  try {
    if (typeof window._custSameHousehold === 'function') {
      const found = c.name || c.customerName || c.customer || '';
      if (found && !window._custSameHousehold(name, found)) {
        console.warn('[identidad] "' + name + '" resolvia a otro hogar ("' + found + '") — descartado');
        return null;
      }
    }
  } catch (_e) {}
  return c;
};
window.itkGetCustomers = () => Array.isArray(allCustomers) ? allCustomers.slice() : [];



// Smart fuzzy matcher: handles partial names, last-only, first-only, "Bailey" → "Bailey, Meghan and Jonathan"
function smartMatchCustomer(query, candidates) {
  if (!query || !candidates) return [];
  const q = query.trim().toLowerCase();
  const qTokens = q.split(/[\s,&]+/).filter(t => t.length >= 2);
  
  // Score each candidate
  const scored = candidates.map(c => {
    const name = (c.name || '').trim().toLowerCase();
    const email = (c.email || '').toLowerCase();
    const phone = (c.phone || '').toLowerCase();
    let score = 0;

    // Exact match → highest
    if (name === q) score += 1000;
    // Starts with query (e.g. "bailey" matches "bailey, meghan...")
    if (name.startsWith(q)) score += 500;
    // Query is contained
    if (name.includes(q)) score += 200;
    // Email match
    if (email && email.includes(q)) score += 150;
    // Phone partial
    if (phone && phone.replace(/\D/g, '').includes(q.replace(/\D/g, ''))) score += 100;
    // Token-level: each query token found in name = +50
    const nameTokens = name.split(/[\s,&]+/).filter(Boolean);
    for (const qt of qTokens) {
      if (nameTokens.some(nt => nt.startsWith(qt))) score += 50;
      else if (name.includes(qt)) score += 20;
    }
    // Last name match (assumes "Last, First" format common in QB)
    if (name.includes(',')) {
      const lastName = name.split(',')[0].trim();
      if (lastName === q) score += 300;
      if (lastName.startsWith(q)) score += 150;
    }
    return { c, score };
  });

  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.c);
}

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════
function deriveGreetingName(fullName) {
  if (!fullName) return '';
  // "Reynaldo, Alberto" → "Alberto"
  if (fullName.includes(',')) {
    const after = fullName.split(',')[1].trim();
    return after.split(/\s+/)[0];
  }
  // "Doug & Carrie Meyer" → "Doug"
  if (fullName.includes('&')) {
    return fullName.split('&')[0].trim().split(/\s+/)[0];
  }
  // "Alberto Reynaldo" → "Alberto"
  return fullName.trim().split(/\s+/)[0];
}

function fmtCurrency(amt) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amt || 0);
}
function fmtDate(ts) {
  if (!ts) return '—';
  const d = typeof ts === 'string' ? new Date(ts) : new Date(ts);
  return d.toLocaleDateString('es-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDateShort(ts) {
  if (!ts) return '—';
  const d = typeof ts === 'string' ? new Date(ts) : new Date(ts);
  return d.toLocaleDateString('es-US', { month: 'short', day: 'numeric' });
}
function daysSince(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function deriveStatus(inv) {
  if (inv.status === 'paid') return 'paid';
  if (inv.status === 'sent') {
    const d = daysSince(inv.sentAt);
    if (d !== null && d >= 7) return 'followup';
    return 'sent';
  }
  return 'pending';
}
window.itkDeriveInvoiceStatus = (inv) => deriveStatus(inv);


function statusLabel(s) {
  return { pending: t('status.pending'), sent: t('status.sent'), followup: t('status.followup'), paid: t('status.paid') }[s] || s;
}

// ════════════════════════════════════════════════════════════
// EMAIL TEMPLATE & MAILTO
// ════════════════════════════════════════════════════════════
// Email stages — used when sending or re-sending an invoice
// 1 = First send (cordial, thank-you tone)
// 2 = Friendly reminder (7+ days later, polite nudge)
// 3 = Firm reminder (15+ days, "this is overdue", final notice tone)
function suggestEmailStage(inv) {
  // If invoice is already paid, suggest the receipt/thank-you template
  if (inv.status === 'paid' || deriveStatus(inv) === 'paid') return 4;
  if (!inv.sentAt) return 1;
  const days = daysSince(inv.sentAt);
  // Also consider how many times re-sent
  const sendCount = (inv.history || []).filter(h => h.action === 'sent').length;
  if (sendCount >= 3 || days >= 21) return 3;
  if (sendCount >= 2 || days >= 7) return 2;
  return 1;
}

function buildEmailSubject(inv, stage) {
  stage = stage || suggestEmailStage(inv);
  if (stage === 2) return `Reminder: Invoice #${inv.invoiceNumber} from Aspen Spas`;
  if (stage === 3) return `Past Due: Invoice #${inv.invoiceNumber} — Please remit payment`;
  if (stage === 4) return `Thank you! Paid invoice #${inv.invoiceNumber} from Aspen Spas`;
  return `Invoice #${inv.invoiceNumber} from Aspen Spas`;
}

// Mantenido como alias para compatibilidad
function buildEmailBody(inv, stage) {
  return buildEmailPlainText(inv, stage);
}

// Stage-specific copy for the message body
function getStageCopy(stage) {
  if (stage === 2) {
    return {
      intro: 'Just a friendly reminder — we have an outstanding invoice on our records and wanted to make sure it didn\'t slip through. Your invoice is attached for your reference.',
      closing: 'If you\'ve already sent payment, please disregard this message — and thanks! Otherwise, we\'d appreciate your prompt attention. If there\'s a question or anything we can help clarify, just reply to this email or give us a call.',
      signoff: 'Thanks again for your business,'
    };
  }
  if (stage === 3) {
    return {
      intro: 'Our records show that this invoice is now past due. We\'re re-attaching it here for your convenience. We\'d like to settle this account before it requires further follow-up.',
      closing: 'Please remit payment at your earliest convenience. If there\'s a billing question, a dispute, or you need to arrange payment, please reply to this email or call us right away so we can resolve it together.',
      signoff: 'Sincerely,'
    };
  }
  if (stage === 4) {
    return {
      intro: 'Thank you for trusting <strong style="color:#0f172a;">Aspen Spas</strong> with your service. Your payment has been received — we truly appreciate your business. <strong>Attached you\'ll find your paid invoice for your records.</strong>',
      closing: 'It\'s a real pleasure to take care of you and your spa. If you ever have questions, need future service, or just want to chat about chemistry or maintenance tips, just reply to this email or give us a call at',
      signoff: 'With our sincere thanks,'
    };
  }
  // Stage 1 — first send
  return {
    intro: 'Thank you for choosing <strong style="color:#0f172a;">Aspen Spas</strong>. Please find your invoice attached for the recent service.',
    closing: 'If you have any questions about this invoice or the service performed, just reply to this email — we read every one — or call us at',
    signoff: 'Thank you for your business,'
  };
}

function getStageCopyPlain(stage) {
  if (stage === 2) {
    return {
      intro: 'Just a friendly reminder — we have an outstanding invoice on our records and wanted to make sure it didn\'t slip through. Your invoice is attached for your reference.',
      closing: 'If you\'ve already sent payment, please disregard this message — and thanks! Otherwise, we\'d appreciate your prompt attention. If there\'s a question or anything we can help clarify, just reply to this email or call us at',
      signoff: 'Thanks again for your business,'
    };
  }
  if (stage === 3) {
    return {
      intro: 'Our records show that this invoice is now past due. We\'re re-attaching it here for your convenience. We\'d like to settle this account before it requires further follow-up.',
      closing: 'Please remit payment at your earliest convenience. If there\'s a billing question, a dispute, or you need to arrange payment, please reply or call us at',
      signoff: 'Sincerely,'
    };
  }
  if (stage === 4) {
    return {
      intro: 'Thank you for trusting Aspen Spas with your service. Your payment has been received — we truly appreciate your business. Attached you will find your paid invoice for your records.',
      closing: 'It is a real pleasure to take care of you and your spa. If you ever have questions, need future service, or just want to chat about chemistry or maintenance tips, just reply or call us at',
      signoff: 'With our sincere thanks,'
    };
  }
  return {
    intro: 'Thank you for choosing Aspen Spas. Please find your invoice attached for the recent service.',
    closing: 'If you have any questions, just reply to this email or call us at',
    signoff: 'Thank you for your business,'
  };
}

// ════════════════════════════════════════════════════════════
// RECONCILE TRACKING + NUDGE
// Records when QB reconciliation last ran, and nudges Nela when it's been
// too long — because the resolve cycle only closes ALERTED invoices, the
// bulk of paid invoices only close via QB reconcile. If she doesn't do it
// regularly, stale-open invoices pile up.
// ════════════════════════════════════════════════════════════
const RECONCILE_KEY = 'aspenLastReconcile';
let _sharedReconcile = null; // last-reconcile state synced from Firebase (shared across devices/users)
function getLastReconcile() {
  // Prefer the shared Firebase value; fall back to this device's local cache.
  if (_sharedReconcile && _sharedReconcile.at) return _sharedReconcile;
  try { return JSON.parse(localStorage.getItem(RECONCILE_KEY) || 'null'); }
  catch (_e) { return null; }
}
function setLastReconcile(count) {
  const rec = {
    at: Date.now(),
    by: (typeof getInvoiceTrackerUser === 'function' ? getInvoiceTrackerUser() : '') || '',
    count: count || 0
  };
  // Local cache first (instant, works offline)
  try { localStorage.setItem(RECONCILE_KEY, JSON.stringify(rec)); } catch (_e) {}
  _sharedReconcile = rec;
  // Then push to Firebase so every device/user sees the same "last reconciled".
  try {
    if (db && !useLocalStorage && typeof set === 'function') {
      set(ref(db, 'invoiceTracker/meta/lastReconcile'), rec).catch(e => console.warn('[Reconcile] sync failed:', e));
    }
  } catch (_e) {}
  renderReconcileNudge();
}
// Subscribe to the shared reconcile state — called once Firebase is connected.
function _subscribeSharedReconcile() {
  try {
    if (!db || typeof onValue !== 'function') return;
    onValue(ref(db, 'invoiceTracker/meta/lastReconcile'), (snap) => {
      const v = snap.val();
      if (v && v.at) {
        _sharedReconcile = v;
        try { localStorage.setItem(RECONCILE_KEY, JSON.stringify(v)); } catch (_e) {}
      }
      renderReconcileNudge();
    });
  } catch (e) { console.warn('[Reconcile] subscribe failed:', e); }
}
// How many open invoices are "stale" — open and older than N days, so likely
// already paid in QB but never reconciled here.
function _staleOpenCount(days) {
  const cutoff = Date.now() - (days || 14) * 86400000;
  return (allInvoices || []).filter(i => {
    if (i.status === 'paid') return false;
    const created = i.createdAt || i.sentAt || 0;
    return created > 0 && created < cutoff;
  }).length;
}
function renderReconcileNudge() {
  const el = document.getElementById('reconcileNudge');
  if (!el) return;
  const en = currentLang === 'en';
  const openCount = (allInvoices || []).filter(i => i.status !== 'paid').length;
  // Nothing open → nothing to nudge about
  if (openCount === 0) { el.style.display = 'none'; return; }
  const last = getLastReconcile();
  const now = Date.now();
  const days = last && last.at ? Math.floor((now - last.at) / 86400000) : null;
  const stale = _staleOpenCount(14);

  // Decide urgency. never reconciled OR >14d = red; 7-14d = amber; <7d = hide
  let bg, border, color, icon, msg;
  if (days === null) {
    bg = '#FEF2F2'; border = '#FCA5A5'; color = '#991B1B'; icon = '🔄';
    msg = en
      ? `You've never reconciled with QuickBooks. You have <b>${openCount}</b> open invoice${openCount !== 1 ? 's' : ''}${stale ? ` (<b>${stale}</b> older than 2 weeks — likely already paid)` : ''}.`
      : `Nunca has reconciliado con QuickBooks. Tienes <b>${openCount}</b> factura${openCount !== 1 ? 's' : ''} abierta${openCount !== 1 ? 's' : ''}${stale ? ` (<b>${stale}</b> de más de 2 semanas — probablemente ya pagadas)` : ''}.`;
  } else if (days >= 14) {
    bg = '#FEF2F2'; border = '#FCA5A5'; color = '#991B1B'; icon = '⚠️';
    msg = en
      ? `It's been <b>${days} days</b> since you reconciled with QB. <b>${openCount}</b> open${stale ? `, <b>${stale}</b> likely already paid` : ''} — close them in bulk.`
      : `Hace <b>${days} días</b> que no reconcilias con QB. <b>${openCount}</b> abiertas${stale ? `, <b>${stale}</b> probablemente ya pagadas` : ''} — ciérralas en bloque.`;
  } else if (days >= 7) {
    bg = '#FFFBEB'; border = '#FDE68A'; color = '#92400E'; icon = '🔔';
    msg = en
      ? `<b>${days} days</b> since last QB reconcile · <b>${openCount}</b> open. A good time to import QB payments.`
      : `<b>${days} días</b> desde la última reconciliación · <b>${openCount}</b> abiertas. Buen momento para importar pagos de QB.`;
  } else {
    // Recently reconciled — show a calm confirmation, not a nag
    bg = '#F0FDF4'; border = '#86EFAC'; color = '#065F46'; icon = '✓';
    const whenTxt = days === 0 ? (en ? 'today' : 'hoy') : (en ? `${days}d ago` : `hace ${days}d`);
    el.style.cssText = `display:flex;align-items:center;gap:12px;padding:10px 16px;margin-bottom:16px;border-radius:8px;font-size:12px;font-weight:600;background:${bg};border:1px solid ${border};color:${color};`;
    el.innerHTML = `<span>${icon}</span><span style="flex:1;">${en ? 'Last reconciled with QB' : 'Última reconciliación con QB'} <b>${whenTxt}</b>${last.count ? ` · ${last.count} ${en ? 'closed' : 'cerradas'}` : ''}.</span>
      <button onclick="window.openQbReconcile()" style="background:transparent;border:1px solid ${color};color:${color};padding:5px 11px;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">🔄 ${en ? 'Reconcile' : 'Reconciliar'}</button>`;
    return;
  }
  el.style.cssText = `display:flex;align-items:center;gap:12px;padding:13px 18px;margin-bottom:16px;border-radius:10px;font-size:13px;font-weight:600;background:${bg};border:1.5px solid ${border};color:${color};`;
  el.innerHTML = `<span style="font-size:18px;">${icon}</span>
    <span style="flex:1;line-height:1.45;">${msg}</span>
    <button onclick="window.openQbReconcile()" style="background:${color};color:#fff;border:none;padding:9px 16px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;">🔄 ${en ? 'Reconcile now' : 'Reconciliar ahora'}</button>`;
}

// ════════════════════════════════════════════════════════════
// RENDERING
// ════════════════════════════════════════════════════════════
// QB BACKLOG — 5PM DAILY BROWSER NOTIFICATION
// Nela works in TECH-TICKETS most of the day. At 5pm she should get a desktop
// nudge if there are paid invoices not yet entered in QuickBooks Desktop.
// Limitations: browser notifications only fire when the tab is open. If she
// closes the tab before 5pm, no nudge. The weekly summary email is the backup.
// ════════════════════════════════════════════════════════════
const QB_NOTIF_LAST_KEY = 'aspenQbBacklogNotifLast';     // YYYY-MM-DD of last fire
const QB_NOTIF_ENABLED_KEY = 'aspenQbBacklogNotifEnabled'; // '1' = enabled
const QB_NOTIF_HOUR = 17; // 5pm local time

function _qbNotifEnabled() {
  try { return localStorage.getItem(QB_NOTIF_ENABLED_KEY) === '1'; } catch { return false; }
}

window.enableQbBacklogNotifications = async function() {
  const en = currentLang === 'en';
  if (!('Notification' in window)) {
    toast(en ? "Your browser doesn't support notifications" : 'Tu navegador no soporta notificaciones', 'error');
    return;
  }
  let perm = Notification.permission;
  if (perm === 'default') {
    try { perm = await Notification.requestPermission(); } catch { perm = 'denied'; }
  }
  if (perm === 'granted') {
    try { localStorage.setItem(QB_NOTIF_ENABLED_KEY, '1'); } catch (_e) {}
    toast(en ? '✓ 5pm QB Backlog reminders enabled' : '✓ Recordatorios 5pm QB Backlog activados', 'success');
    _startQbBacklogNotificationTimer();
    computeAndRender(); // re-render banner so the enable button disappears
  } else if (perm === 'denied') {
    toast(en
      ? 'Notifications blocked. Enable them in browser settings (lock icon in address bar)'
      : 'Notificaciones bloqueadas. Actívalas en config del navegador (candado en la barra)', 'warn');
  }
};

window.disableQbBacklogNotifications = function() {
  try { localStorage.removeItem(QB_NOTIF_ENABLED_KEY); } catch (_e) {}
  if (_qbNotifTimer) { clearInterval(_qbNotifTimer); _qbNotifTimer = null; }
  toast(currentLang === 'en' ? 'QB Backlog reminders off' : 'Recordatorios QB Backlog desactivados', 'info');
  computeAndRender();
};

let _qbNotifTimer = null;
function _startQbBacklogNotificationTimer() {
  if (_qbNotifTimer) clearInterval(_qbNotifTimer);
  if (!_qbNotifEnabled()) return;
  // Check every minute. Cheap; only fires the notification window 17:00-17:30 once per day.
  _qbNotifTimer = setInterval(_checkQbBacklogNotification, 60 * 1000);
  // Also run once immediately in case the user opened the app inside the window
  _checkQbBacklogNotification();
}

function _checkQbBacklogNotification() {
  if (!_qbNotifEnabled()) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const now = new Date();
  // Trigger window: 17:00–17:30 local time
  if (now.getHours() !== QB_NOTIF_HOUR) return;
  if (now.getMinutes() >= 30) return;
  // Once per day max
  const todayKey = now.toISOString().slice(0, 10);
  try { if (localStorage.getItem(QB_NOTIF_LAST_KEY) === todayKey) return; } catch (_e) {}
  // Snapshot the backlog right now
  const qbArr = (allInvoices || []).filter(i => deriveStatus(i) === 'paid' && !i.qbSynced);
  if (qbArr.length === 0) return; // nothing to nag about
  const total = qbArr.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const threeDaysAgo = Date.now() - 3 * 86400000;
  const staleCount = qbArr.filter(i => (i.paidAt || 0) > 0 && i.paidAt < threeDaysAgo).length;
  try {
    const en = currentLang === 'en';
    const title = en ? '📒 QB Backlog reminder' : '📒 Recordatorio QB Backlog';
    const body = en
      ? `${qbArr.length} paid invoice${qbArr.length !== 1 ? 's' : ''} ($${total.toFixed(2)}) still need${qbArr.length === 1 ? 's' : ''} to be entered in QuickBooks Desktop${staleCount > 0 ? ` — ${staleCount} over 3 days old.` : '.'}`
      : `${qbArr.length} factura${qbArr.length !== 1 ? 's' : ''} pagada${qbArr.length !== 1 ? 's' : ''} ($${total.toFixed(2)}) sin entrar en QuickBooks Desktop${staleCount > 0 ? ` — ${staleCount} con +3 días.` : '.'}`;
    const notif = new Notification(title, {
      body, tag: 'qb-backlog-' + todayKey, requireInteraction: staleCount > 0
    });
    notif.onclick = () => {
      try { window.focus(); } catch (_e) {}
      try { window.jumpToFilter('qb_pending'); } catch (_e) {}
      notif.close();
    };
    try { localStorage.setItem(QB_NOTIF_LAST_KEY, todayKey); } catch (_e) {}
  } catch (e) {
    console.warn('[QBNotif] Failed to show notification:', e);
  }
}

// ════════════════════════════════════════════════════════════
// QB BACKLOG SNAPSHOT — publish to cross_app_events for TECH-TICKETS to read
// Lets the TECH-TICKETS weekly summary email include the current QB backlog.
// Debounced + skip-if-unchanged to avoid Firestore write spam.
// ════════════════════════════════════════════════════════════
const QB_SNAPSHOT_EVENT_ID_KEY = 'aspenQbSnapshotEventId';
const QB_SNAPSHOT_LAST_COUNT_KEY = 'aspenQbSnapshotLastCount';
let _qbSnapshotPublishTimer = null;

function _scheduleQbBacklogSnapshotPublish() {
  // Debounce so a burst of updates collapses into one Firestore write
  clearTimeout(_qbSnapshotPublishTimer);
  _qbSnapshotPublishTimer = setTimeout(_publishQbBacklogSnapshotIfChanged, 2500);
}

async function _publishQbBacklogSnapshotIfChanged() {
  try {
    if (useLocalStorage) return; // offline-only mode — nothing to publish
    const qbArr = (allInvoices || []).filter(i => deriveStatus(i) === 'paid' && !i.qbSynced);
    const count = qbArr.length;
    const total = qbArr.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const threeDaysAgo = Date.now() - 3 * 86400000;
    const staleCount = qbArr.filter(i => (i.paidAt || 0) > 0 && i.paidAt < threeDaysAgo).length;
    // Skip if nothing changed — avoid spamming Firestore on every keystroke
    let lastCount = -1;
    try { lastCount = parseInt(localStorage.getItem(QB_SNAPSHOT_LAST_COUNT_KEY) || '-1', 10); } catch (_e) {}
    if (lastCount === count && count > 0) return; // unchanged non-zero, skip
    // Resolve the previous snapshot so TECH-TICKETS only sees ONE open snapshot at a time
    let priorId = null;
    try { priorId = localStorage.getItem(QB_SNAPSHOT_EVENT_ID_KEY); } catch (_e) {}
    if (priorId) {
      try { await resolveCrossAppEvent(priorId, 'invoice-tracker', 'qb_backlog_snapshot_superseded'); } catch (_e) {}
      try { localStorage.removeItem(QB_SNAPSHOT_EVENT_ID_KEY); } catch (_e) {}
    }
    // If count is 0, just resolve the prior and stop — no need for a "0" snapshot
    if (count === 0) {
      try { localStorage.setItem(QB_SNAPSHOT_LAST_COUNT_KEY, '0'); } catch (_e) {}
      return;
    }
    // Compact item list — cap at 20 to stay well under Firestore's 1 MiB doc limit
    const items = qbArr.slice(0, 20).map(i => ({
      invoiceNumber: i.invoiceNumber || '',
      customer: i.customerName || '',
      amount: Number(i.amount) || 0,
      paidAt: i.paidAt || null,
      method: i.paymentMethod || null
    }));
    const severity = staleCount > 0 ? 'urgent' : (count >= 5 ? 'warn' : 'info');
    const result = await publishCrossAppEvent({
      eventType: 'qb_backlog_snapshot',
      customerName: '_system_qb_backlog', // sentinel — not a real customer
      payload: { count, total, staleCount, items, publishedAt: Date.now() },
      severity,
      createdBy: 'invoice-tracker'
    });
    if (result && result.name) {
      const eventId = result.name.split('/').pop();
      try {
        localStorage.setItem(QB_SNAPSHOT_EVENT_ID_KEY, eventId);
        localStorage.setItem(QB_SNAPSHOT_LAST_COUNT_KEY, String(count));
      } catch (_e) {}
      console.info('[QBSnapshot] Published count=' + count + ' total=$' + total.toFixed(2) + ' id=' + eventId);
    }
  } catch (e) {
    console.warn('[QBSnapshot] Publish failed (non-fatal):', e.message || e);
  }
}

// ════════════════════════════════════════════════════════════
// MAIN RENDER
// ════════════════════════════════════════════════════════════
function computeAndRender() {
  const sorted = [...allInvoices].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  // Refresh the cross-app inbox badge — picks up new resolutions that arrived via Firebase realtime
  try { if (typeof updateCrossAppInboxBadge === 'function') updateCrossAppInboxBadge(); } catch(_e){}
  try { renderReconcileNudge(); } catch(_e){}
  
  // Stats
  const now = Date.now();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0,0,0,0);
  const startTs = startOfMonth.getTime();
  
  let pending = 0, followup = 0, sentMonth = 0, paidMonth = 0;
  let sentMonthAmt = 0, paidMonthAmt = 0;
  let oldPending = 0;
  
  let cAll = sorted.length, cPending = 0, cFollowup = 0, cSent = 0, cPaid = 0;
  
  for (const inv of sorted) {
    const s = deriveStatus(inv);
    if (s === 'pending') {
      pending++;
      cPending++;
      if (daysSince(inv.createdAt) >= 1) oldPending++;
    } else if (s === 'sent') {
      cSent++;
      if ((inv.sentAt || 0) >= startTs) {
        sentMonth++;
        sentMonthAmt += Number(inv.amount) || 0;
      }
    } else if (s === 'followup') {
      followup++;
      cFollowup++;
      cSent++;
    } else if (s === 'paid') {
      cPaid++;
      if ((inv.paidAt || 0) >= startTs) {
        paidMonth++;
        paidMonthAmt += Number(inv.amount) || 0;
      }
    }
  }
  
  document.getElementById('cntPending').textContent = pending;
  document.getElementById('cntPendingMeta').textContent = oldPending > 0 ? t('stat.pending.with24h', oldPending) : t('stat.pending.uptodate');
  document.getElementById('cntFollowup').textContent = followup;
  document.getElementById('cntSentMonth').textContent = sentMonth;
  document.getElementById('cntSentMonthAmt').textContent = fmtCurrency(sentMonthAmt);
  document.getElementById('cntPaidMonth').textContent = paidMonth;
  document.getElementById('cntPaidMonthAmt').textContent = fmtCurrency(paidMonthAmt);

  // CC / payment-failed counter
  const ccPending = countCcPending();
  document.getElementById('cntCC').textContent = ccPending;
  const ccCardEl = document.getElementById('statCC');
  if (ccPending === 0) {
    ccCardEl.classList.remove('cc');
    document.getElementById('cntCCMeta').textContent = t('stat.cc.allgood');
  } else {
    ccCardEl.classList.add('cc');
    const noCc = allInvoices.filter(i => i.paymentReason === 'cc_needed' && !i.ccRequested && deriveStatus(i) !== 'paid').length;
    document.getElementById('cntCCMeta').textContent = noCc > 0 ? (currentLang === 'en' ? `${noCc} CC not requested` : `${noCc} sin pedir CC`) : t('stat.cc.meta');
  }
  
  // Tab counts
  document.getElementById('cntAll').textContent = cAll;
  document.getElementById('cntPendingTab').textContent = cPending;
  document.getElementById('cntFollowupTab').textContent = cFollowup;
  document.getElementById('cntSentTab').textContent = cSent;
  document.getElementById('cntPaidTab').textContent = cPaid;
  document.getElementById('cntCustomersTab').textContent = allCustomers.length;
  document.getElementById('cntTodayTab').textContent = countTodayTotal();
  // Sent today count (any sent action or confirmed alert today)
  const todayMs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  let sentTodayCount = 0;
  allInvoices.forEach(inv => {
    (inv.history || []).forEach(h => {
      if (h.ts < todayMs) return;
      if (h.action === 'sent') sentTodayCount++;
      else if ((h.action === 'alert_collections' || h.action === 'alert_check') && h.confirmed) sentTodayCount++;
    });
  });
  document.getElementById('cntSentTodayTab').textContent = sentTodayCount;
  document.getElementById('cntProblemsTab').textContent = getProblemCustomers().length;
  document.getElementById('cntSnoozedTab').textContent = countSnoozed();
  // QB Pending count — paid invoices still awaiting QuickBooks Desktop entry
  // Aging-aware: if ANY unsynced paid is older than 3 days, color the badge red (urgent).
  const qbPendingArr = allInvoices.filter(i => deriveStatus(i) === 'paid' && !i.qbSynced);
  const qbPendingCount = qbPendingArr.length;
  const cntQbEl = document.getElementById('cntQbPendingTab');
  if (cntQbEl) {
    cntQbEl.textContent = qbPendingCount;
    const threeDaysAgo = Date.now() - 3 * 86400000;
    const hasStale = qbPendingArr.some(i => (i.paidAt || 0) > 0 && i.paidAt < threeDaysAgo);
    // Visual urgency on the tab badge itself — red when stale, blue otherwise, transparent at zero
    if (qbPendingCount === 0) {
      cntQbEl.style.background = 'transparent';
      cntQbEl.style.color = 'var(--text-mute)';
    } else if (hasStale) {
      cntQbEl.style.background = 'var(--pending)';
      cntQbEl.style.color = 'white';
    } else {
      cntQbEl.style.background = '#1C8FA8';
      cntQbEl.style.color = 'white';
    }
  }
  // Cross-app publish — debounced, skip-if-unchanged. Fires AFTER count is fresh.
  _scheduleQbBacklogSnapshotPublish();
  
  // Update unconfirmed alerts banner
  updateUnconfirmedBanner();
  // Update today's revenue + 7-day mini chart
  renderTodayRevenue();

  // Aging Report (always rendered, hides itself if empty)
  renderAgingCard();
  
  // Alerts banner — comprehensive notifications panel
  const alertsBox = document.getElementById('alertsBox');
  alertsBox.innerHTML = '';
  const en = currentLang === 'en';
  const seeBtn = en ? 'View →' : 'Ver →';
  const todayBtn = en ? 'Open Today →' : 'Abrir Hoy →';
  
  // Critical: old pending invoices (created +24h, not sent)
  if (oldPending > 0) {
    const div = document.createElement('div');
    div.className = 'alert-row red';
    const txt = en
      ? `You have <strong>${oldPending} invoice${oldPending !== 1 ? 's' : ''}</strong> created +24h ago without sending.`
      : `Tienes <strong>${oldPending} factura${oldPending !== 1 ? 's' : ''}</strong> creada${oldPending !== 1 ? 's' : ''} hace +24h sin enviar.`;
    div.innerHTML = `<span class="alert-icon">⚠</span> ${txt} <button class="btn btn-sm" style="margin-left:auto;background:var(--pending);color:white;padding:4px 10px;font-size:11px;" onclick="window.jumpToFilter('pending')">${seeBtn}</button>`;
    alertsBox.appendChild(div);
  }
  
  // Critical: follow-ups due today
  const due = dueFollowups();
  if (due.length > 0) {
    const div = document.createElement('div');
    div.className = 'alert-row red';
    const names = due.slice(0, 3).map(i => `#${i.invoiceNumber} ${i.customerName}`).join(', ');
    const txt = en
      ? `<strong>${due.length} follow-up${due.length !== 1 ? 's' : ''} due today</strong>: ${escapeHtml(names)}${due.length > 3 ? '…' : ''}`
      : `<strong>${due.length} follow-up${due.length !== 1 ? 's' : ''} pendiente${due.length !== 1 ? 's' : ''} hoy</strong>: ${escapeHtml(names)}${due.length > 3 ? '…' : ''}`;
    div.innerHTML = `<span class="alert-icon">📅</span> ${txt} <button class="btn btn-sm" style="margin-left:auto;background:var(--pending);color:white;padding:4px 10px;font-size:11px;" onclick="window.jumpToFilter('today')">${todayBtn}</button>`;
    alertsBox.appendChild(div);
  }
  
  // Warning: +7 days sent without payment mark
  if (followup > 0) {
    const div = document.createElement('div');
    div.className = 'alert-row amber';
    const txt = en
      ? `<strong>${followup} invoice${followup !== 1 ? 's' : ''}</strong> sent +7 days ago without payment mark.`
      : `<strong>${followup} factura${followup !== 1 ? 's' : ''}</strong> enviada${followup !== 1 ? 's' : ''} hace +7 días sin marca de pago.`;
    div.innerHTML = `<span class="alert-icon">⏰</span> ${txt} <button class="btn btn-sm" style="margin-left:auto;background:var(--followup);color:white;padding:4px 10px;font-size:11px;" onclick="window.jumpToFilter('followup')">${seeBtn}</button>`;
    alertsBox.appendChild(div);
  }

  // ─── QB BACKLOG ALERT — paid invoices waiting to be entered in QuickBooks Desktop ───
  // Aging-aware: red if any unsynced paid invoice is >3 days old (real accounting drift risk),
  // amber otherwise. Hides itself at 0. Click → jumpToFilter('qb_pending').
  const qbBacklog = allInvoices.filter(i => deriveStatus(i) === 'paid' && !i.qbSynced && !isSnoozed(i));
  if (qbBacklog.length > 0) {
    const threeDaysAgo = Date.now() - 3 * 86400000;
    const staleCount = qbBacklog.filter(i => (i.paidAt || 0) > 0 && i.paidAt < threeDaysAgo).length;
    const qbTotal = qbBacklog.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const div = document.createElement('div');
    div.className = staleCount > 0 ? 'alert-row red' : 'alert-row amber';
    // Override color to match QB-branding blue when no stale items (still actionable, less urgent)
    if (staleCount === 0) {
      div.style.background = '#EFF6FF';
      div.style.borderColor = '#93C5FD';
      div.style.color = '#1E40AF';
    }
    const txt = en
      ? `<strong>${qbBacklog.length} paid invoice${qbBacklog.length !== 1 ? 's' : ''}</strong> (${fmtCurrency(qbTotal)}) still need${qbBacklog.length === 1 ? 's' : ''} to be entered in QuickBooks Desktop${staleCount > 0 ? ` · <b>${staleCount} older than 3 days</b>` : ''}.`
      : `<strong>${qbBacklog.length} factura${qbBacklog.length !== 1 ? 's' : ''} pagada${qbBacklog.length !== 1 ? 's' : ''}</strong> (${fmtCurrency(qbTotal)}) sin entrar en QuickBooks Desktop${staleCount > 0 ? ` · <b>${staleCount} con +3 días</b>` : ''}.`;
    const btnColor = staleCount > 0 ? 'var(--pending)' : '#1C8FA8';
    // Soft "Enable 5pm reminder" CTA — shown ONCE next to the alert when permission not yet granted.
    // Once enabled, it disappears (replaced by a quieter "🔔 on" hint).
    let notifLink = '';
    if (typeof Notification !== 'undefined') {
      if (_qbNotifEnabled() && Notification.permission === 'granted') {
        notifLink = `<span title="${escapeHtml(en ? '5pm reminder is on. Click to turn off.' : 'Recordatorio 5pm activo. Click para apagar.')}" onclick="window.disableQbBacklogNotifications()" style="font-size:11px;color:inherit;opacity:0.7;cursor:pointer;padding:2px 6px;">🔔 ${en ? 'on' : 'on'}</span>`;
      } else if (Notification.permission !== 'denied') {
        notifLink = `<button onclick="window.enableQbBacklogNotifications()" title="${escapeHtml(en ? 'Get a desktop notification at 5pm if this backlog is still non-zero' : 'Recibir una notificación de escritorio a las 5pm si el backlog sigue >0')}" style="font-size:11px;font-weight:700;background:transparent;border:1px dashed currentColor;color:inherit;padding:3px 9px;border-radius:6px;cursor:pointer;margin:0 6px;">🔔 ${en ? '5pm reminder' : 'Recordatorio 5pm'}</button>`;
      }
    }
    div.innerHTML = `<span class="alert-icon">📒</span> ${txt} ${notifLink}<button class="btn btn-sm" style="margin-left:auto;background:${btnColor};color:white;padding:4px 10px;font-size:11px;" onclick="window.jumpToFilter('qb_pending')">${en ? 'Open backlog →' : 'Abrir backlog →'}</button>`;
    alertsBox.appendChild(div);
  }
  
  // Warning: CC needed but not yet asked
  const ccUnasked = allInvoices.filter(i => i.paymentReason === 'cc_needed' && !i.ccRequested && deriveStatus(i) !== 'paid');
  if (ccUnasked.length > 0) {
    const div = document.createElement('div');
    div.className = 'alert-row amber';
    const names = ccUnasked.slice(0, 3).map(i => i.customerName).join(', ');
    const txt = en
      ? `<strong>${ccUnasked.length} customer${ccUnasked.length !== 1 ? 's' : ''}</strong> haven't been asked for their card number: ${escapeHtml(names)}${ccUnasked.length > 3 ? '…' : ''}`
      : `<strong>${ccUnasked.length} cliente${ccUnasked.length !== 1 ? 's' : ''}</strong> sin que les pidas el número de tarjeta: ${escapeHtml(names)}${ccUnasked.length > 3 ? '…' : ''}`;
    div.innerHTML = `<span class="alert-icon">💳</span> ${txt}`;
    alertsBox.appendChild(div);
  }
  
  // Warning: critical aging (+30 days unpaid)
  const agingBands = computeAgingBands();
  if (agingBands.critical.count > 0) {
    const div = document.createElement('div');
    div.className = 'alert-row red';
    const txt = en
      ? `<strong>${agingBands.critical.count} invoice${agingBands.critical.count !== 1 ? 's' : ''}</strong> +30 days unpaid (${fmtCurrency(agingBands.critical.amt)}).`
      : `<strong>${agingBands.critical.count} factura${agingBands.critical.count !== 1 ? 's' : ''}</strong> con +30 días sin pagar (${fmtCurrency(agingBands.critical.amt)}).`;
    div.innerHTML = `<span class="alert-icon">🚨</span> ${txt} <button class="btn btn-sm" style="margin-left:auto;background:var(--pending);color:white;padding:4px 10px;font-size:11px;" onclick="window.filterByAgingBand('critical')">${seeBtn}</button>`;
    alertsBox.appendChild(div);
  }
  
  // Info: problematic accounts detected
  const probCount = getProblemCustomers().length;
  if (probCount > 0) {
    const div = document.createElement('div');
    div.className = 'alert-row amber';
    const txt = en
      ? `<strong>${probCount} customer${probCount !== 1 ? 's' : ''}</strong> with problematic history detected (CC declined / no response / disputes / +30d).`
      : `<strong>${probCount} cliente${probCount !== 1 ? 's' : ''}</strong> con historial problemático detectado${probCount !== 1 ? 's' : ''} (CC declined / sin respuesta / disputas / +30d).`;
    div.innerHTML = `<span class="alert-icon">🚨</span> ${txt} <button class="btn btn-sm" style="margin-left:auto;background:var(--followup);color:white;padding:4px 10px;font-size:11px;" onclick="window.jumpToFilter('problems')">${seeBtn}</button>`;
    alertsBox.appendChild(div);
  }
  
  // Success: all clear
  if (alertsBox.children.length === 0 && allInvoices.length > 0) {
    const div = document.createElement('div');
    div.className = 'alert-row';
    div.style.cssText = 'background:#ECFDF5;border-color:#A7F3D0;color:#047857;';
    div.innerHTML = `<span class="alert-icon">✨</span> ${en ? 'All caught up! No urgent items.' : '¡Todo al día! Sin pendientes urgentes.'}`;
    alertsBox.appendChild(div);
  }
  
  // Filtered list
  let filtered = sorted;
  if (currentFilter === 'customers') {
    document.getElementById('invoiceList').style.display = 'none';
    document.getElementById('customerView').style.display = 'block';
    renderCustomers();
    return;
  }
  document.getElementById('invoiceList').style.display = 'flex';
  document.getElementById('customerView').style.display = 'none';
  
  if (currentFilter === 'dashboard') {
    renderDashboardView();
    return;
  }
  if (currentFilter === 'today') {
    renderTodayView();
    return;
  }
  if (currentFilter === 'senttoday') {
    renderSentTodayView();
    return;
  }
  if (currentFilter === 'techs') {
    renderTechsView();
    return;
  }
  if (currentFilter === 'unconfirmed') {
    // Special filter: invoices with unconfirmed alerts (>24h old)
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    filtered = filtered.filter(i => 
      (i.history || []).some(h => 
        (h.action === 'alert_collections' || h.action === 'alert_check') &&
        !h.confirmed &&
        h.ts < cutoff
      )
    );
  } else if (currentFilter === 'problems') {
    renderProblemView();
    return;
  }
  if (currentFilter === 'snoozed') {
    filtered = filtered.filter(i => isSnoozed(i));
  } else if (currentFilter && currentFilter.startsWith('aging_')) {
    const bandKey = currentFilter.split('_')[1];
    const bands = computeAgingBands();
    const ids = new Set(bands[bandKey].items.map(i => i.id));
    filtered = filtered.filter(i => ids.has(i.id));
  } else if (currentFilter === 'cc_pending') {
    filtered = filtered.filter(i => deriveStatus(i) !== 'paid' && !!i.paymentReason && !isSnoozed(i));
  } else if (currentFilter === 'qb_pending') {
    // Paid invoices that haven't been recorded in QuickBooks Desktop yet
    filtered = filtered.filter(i => deriveStatus(i) === 'paid' && !i.qbSynced && !isSnoozed(i));
  } else if (currentFilter !== 'all') {
    filtered = filtered.filter(i => deriveStatus(i) === currentFilter && !isSnoozed(i));
  } else {
    // 'all' tab: hide snoozed by default unless searching
    if (!searchTerm) filtered = filtered.filter(i => !isSnoozed(i));
  }
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    filtered = filtered.filter(i => 
      (i.invoiceNumber || '').toLowerCase().includes(q) ||
      (i.customerName || '').toLowerCase().includes(q) ||
      (i.customerEmail || '').toLowerCase().includes(q) ||
      (i.serialNumber || '').toLowerCase().includes(q)
    );
  }
  
  renderList(filtered);
}

function renderCustomers() {
  const list = document.getElementById('customerList');
  let customers = [...allCustomers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    customers = customers.filter(c => 
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.serialNumber || '').toLowerCase().includes(q)
    );
  }
  
  if (customers.length === 0) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">👥</div>
        <div class="empty-title">${escapeHtml(t('customer.empty.title'))}</div>
        <div class="empty-text">${escapeHtml(t('customer.empty.text'))}</div>
        <button class="btn btn-primary" onclick="window.openAddCustomerModal()">${escapeHtml(t('customer.addBtn'))}</button>
      </div>`;
    return;
  }
  
  list.innerHTML = customers.map(c => {
    const invoiceCount = allInvoices.filter(i => (i.customerName || '').trim().toLowerCase() === (c.name || '').trim().toLowerCase()).length;
    const countLabel = invoiceCount === 1 ? t('customer.invoiceCount.one') : t('customer.invoiceCount.many', invoiceCount);
    return `
      <div class="customer-card" onclick="window.openCustomerDetail('${c.id}')">
        <div class="customer-info">
          <div class="customer-name">${escapeHtml(c.name)}</div>
          <div class="customer-meta">
            ${c.email ? `<span>✉ ${escapeHtml(c.email)}</span>` : ''}
            ${c.phone ? `<span>☎ ${escapeHtml(c.phone)}</span>` : ''}
            ${c.spaModel ? `<span>🛁 ${escapeHtml(c.spaModel)}</span>` : ''}
            ${c.serialNumber ? `<span># ${escapeHtml(c.serialNumber)}</span>` : ''}
          </div>
          <div class="customer-stats">
            <span>${escapeHtml(countLabel)}</span>
          </div>
        </div>
        <div class="invoice-actions">
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();window.openEditCustomerModal('${c.id}')">${escapeHtml(t('customer.editBtn'))}</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderList(invoices) {
  const list = document.getElementById('invoiceList');
  if (invoices.length === 0) {
    // ─── Filter-specific empty states — generic "no invoices in this view" hides context ───
    const en = currentLang === 'en';
    if (currentFilter === 'qb_pending') {
      const paidCount = allInvoices.filter(i => deriveStatus(i) === 'paid').length;
      // Distinguish "all your paid invoices are already in QB" (good) from "you have no paid invoices yet"
      list.innerHTML = `
        <div class="empty">
          <div class="empty-icon">📒</div>
          <div class="empty-title">${en ? 'No QB backlog 🎉' : 'Sin backlog en QB 🎉'}</div>
          <div class="empty-text">${
            paidCount === 0
              ? (en ? 'No paid invoices yet. When you mark an invoice paid (or upload an Authorize.net PDF with Status: Paid), it lands here until you tick "Already entered in QuickBooks".'
                    : 'No tienes facturas pagadas todavía. Cuando marques una pagada (o subas un PDF de Authorize.net con Status: Paid), aparece aquí hasta que marques "Already entered in QuickBooks".')
              : (en ? `All ${paidCount} paid invoice${paidCount !== 1 ? 's are' : ' is'} synced to QuickBooks. Open a paid invoice → 💳 button → uncheck "Already entered in QuickBooks" if one slipped through.`
                    : `Las ${paidCount} factura${paidCount !== 1 ? 's' : ''} pagada${paidCount !== 1 ? 's están' : ' está'} sincronizada${paidCount !== 1 ? 's' : ''} con QuickBooks. Abre una factura pagada → botón 💳 → destilda "Already entered in QuickBooks" si alguna se te coló.`)
          }</div>
        </div>`;
      return;
    }
    const emptyMsg = allInvoices.length === 0
      ? (currentLang === 'en' ? 'Start by adding your first invoice. Each time you create one in QuickBooks, log it here so it doesn\'t get forgotten.' : 'Empieza agregando tu primera factura. Cada vez que crees una en QuickBooks, regístrala aquí para no olvidarla.')
      : (currentLang === 'en' ? 'Change tabs or adjust your search.' : 'Cambia de pestaña o ajusta tu búsqueda.');
    const emptyTitle = currentLang === 'en' ? 'No invoices in this view' : 'No hay facturas en esta vista';
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📋</div>
        <div class="empty-title">${escapeHtml(emptyTitle)}</div>
        <div class="empty-text">${escapeHtml(emptyMsg)}</div>
        ${allInvoices.length === 0 ? `<button class="btn btn-primary" onclick="window.openAddModal()">${escapeHtml(t('toolbar.newInvoice'))}</button>` : ''}
      </div>`;
    return;
  }
  
  list.innerHTML = invoices.map(inv => renderInvoiceCardHtml(inv)).join('');
}

// ════════════════════════════════════════════════════════════
// MODAL HANDLERS
// ════════════════════════════════════════════════════════════
window.openAddModal = function() {
  editingId = null;
  document.getElementById('formTitle').textContent = t('form.invoice.new');
  document.getElementById('formSaveBtn').textContent = t('form.save');
  ['fInvoiceNumber','fAmount','fCustomerName','fGreetingName','fCustomerEmail','fCustomerPhone','fServiceDesc','fSpaModel','fSerial','itkFNotes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('fTechnician').value = '';
  document.getElementById('fServiceDate').value = (typeof fmtD==='function'?fmtD(new Date()):new Date().toISOString().split('T')[0]);
  // Reset PDF state
  removePdf();
  document.getElementById('formModal').classList.add('open');
  setTimeout(() => document.getElementById('fInvoiceNumber').focus(), 100);
};

window.openEditModal = function(id) {
  const inv = allInvoices.find(i => i.id === id);
  if (!inv) return;
  editingId = id;
  document.getElementById('formTitle').textContent = `${t('form.invoice.edit')} #${inv.invoiceNumber}`;
  document.getElementById('formSaveBtn').textContent = t('form.update');
  document.getElementById('fInvoiceNumber').value = inv.invoiceNumber || '';
  document.getElementById('fAmount').value = inv.amount || '';
  document.getElementById('fCustomerName').value = inv.customerName || '';
  document.getElementById('fGreetingName').value = inv.greetingName || '';
  document.getElementById('fCustomerEmail').value = inv.customerEmail || '';
  document.getElementById('fCustomerPhone').value = inv.customerPhone || '';
  document.getElementById('fServiceDate').value = inv.serviceDate || '';
  document.getElementById('fTechnician').value = inv.technician || '';
  document.getElementById('fServiceDesc').value = inv.serviceDescription || '';
  document.getElementById('fSpaModel').value = inv.spaModel || '';
  document.getElementById('fSerial').value = inv.serialNumber || '';
  document.getElementById('itkFNotes').value = inv.notes || '';
  // Reset y luego mostrar PDF existente si lo hay
  removePdf();
  if (inv.pdfBase64) {
    currentPdfBase64 = inv.pdfBase64;
    currentPdfFilename = inv.pdfFilename || `Invoice_${inv.invoiceNumber}.pdf`;
    currentPdfSize = inv.pdfSize || 0;
    showPdfFileInfo(currentPdfFilename, currentPdfSize);
    document.getElementById('pdfDropZone').style.display = 'none';
  }
  document.getElementById('formModal').classList.add('open');
};

window.saveInvoice = async function() {
  // Safety net: if user typed a customer name but never blurred (e.g., clicked Save directly),
  // try to auto-fill from the customer database before reading form values.
  try { await window.tryAutoFillCustomerFromName(); } catch(_e){}

  const data = {
    invoiceNumber: document.getElementById('fInvoiceNumber').value.trim(),
    amount: parseFloat(document.getElementById('fAmount').value) || 0,
    customerName: document.getElementById('fCustomerName').value.trim(),
    greetingName: document.getElementById('fGreetingName').value.trim(),
    customerEmail: document.getElementById('fCustomerEmail').value.trim(),
    customerPhone: document.getElementById('fCustomerPhone').value.trim(),
    serviceDate: document.getElementById('fServiceDate').value,
    technician: document.getElementById('fTechnician').value,
    serviceDescription: document.getElementById('fServiceDesc').value.trim(),
    spaModel: document.getElementById('fSpaModel').value.trim(),
    serialNumber: document.getElementById('fSerial').value.trim(),
    notes: document.getElementById('itkFNotes').value.trim()
  };
  
  // Clear previous error states
  ['fInvoiceNumber','fAmount','fCustomerName','fCustomerEmail'].forEach(id => {
    document.getElementById(id).classList.remove('field-err');
  });

  // Validate with explicit field-by-field highlighting
  const missing = [];
  if (!data.invoiceNumber) { missing.push({ id: 'fInvoiceNumber', label: t('form.validate.field.invoiceNumber') }); }
  if (!data.amount || data.amount <= 0) { missing.push({ id: 'fAmount', label: t('form.validate.field.amount') }); }
  if (!data.customerName) { missing.push({ id: 'fCustomerName', label: t('form.validate.field.customer') }); }
  // Email is OPTIONAL — only validate format if provided
  if (data.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerEmail)) {
    missing.push({ id: 'fCustomerEmail', label: t('form.validate.field.emailFormat') });
  }
  
  if (missing.length > 0) {
    missing.forEach(m => {
      const el = document.getElementById(m.id);
      el.classList.add('field-err');
    });
    const firstEl = document.getElementById(missing[0].id);
    firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => firstEl.focus(), 300);
    const labels = missing.map(m => m.label).join(', ');
    const msg = t('form.validate.missing', labels);
    const errEl = document.getElementById('formErrorMsg');
    errEl.textContent = msg;
    errEl.style.display = 'block';
    toast(msg, 'error');
    return;
  }
  
  // Clear any previous error banner
  document.getElementById('formErrorMsg').style.display = 'none';

  // ─── MERGE FLAGS EXTRACTED FROM AUTH.NET PDF (if any) ───
  // These don't have visible form fields — they were stashed by applyExtractedFields.
  // Apply only when creating a NEW invoice; editing preserves whatever the user has set.
  if (!editingId) {
    if (currentExtractedStatus) data.status = currentExtractedStatus;
    if (currentExtractedPaymentMethod) data.paymentMethod = currentExtractedPaymentMethod;
    if (currentExtractedQbSynced !== null) data.qbSynced = currentExtractedQbSynced;
    if (currentExtractedPaidAt) data.paidAt = currentExtractedPaidAt;
  }

  // Duplicate detection — when creating NEW (not editing), warn if invoice # already exists
  // Prevents Alberto from accidentally creating duplicate invoices with the same number
  if (!editingId && data.invoiceNumber) {
    const existing = allInvoices.find(i => String(i.invoiceNumber).trim() === String(data.invoiceNumber).trim());
    if (existing) {
      const en = currentLang === 'en';
      const msg = en
        ? `Invoice #${data.invoiceNumber} already exists (${existing.customerName}). Continue creating a duplicate, or cancel and edit the existing one?`
        : `La factura #${data.invoiceNumber} ya existe (${existing.customerName}). ¿Crear duplicada de todos modos, o cancelar y editar la existente?`;
      if (!confirm(msg)) {
        toast(en ? 'Cancelled — edit the existing invoice instead' : 'Cancelado — edita la factura existente', 'warn');
        return;
      }
    }
  }


  // ─── SMART DUPLICATE DETECTION (v13) ───────────────────────────────
  // Invoice number duplicates are checked above. This second guard looks for an
  // ACTIVE invoice for the same customer so a second follow-up is not created by
  // accident. Exact service-date/amount matches are treated as high-confidence.
  if (!editingId && data.customerName) {
    const normCustomer = s => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    const targetName = normCustomer(data.customerName);
    const activeSameCustomer = allInvoices.filter(i => {
      if (!i || normCustomer(i.customerName) !== targetName) return false;
      const s = deriveStatus(i);
      return s !== 'paid';
    });
    if (activeSameCustomer.length) {
      const exact = activeSameCustomer.find(i => {
        const sameDate = data.serviceDate && i.serviceDate && String(i.serviceDate) === String(data.serviceDate);
        const sameAmt = Math.abs(Number(i.amount || 0) - Number(data.amount || 0)) < 0.01;
        return sameDate && sameAmt;
      });
      const candidate = exact || activeSameCustomer.slice().sort((a,b) => Number(b.createdAt||0)-Number(a.createdAt||0))[0];
      const en = currentLang === 'en';
      const high = !!exact;
      const msg = en
        ? `${high ? 'Possible duplicate detected.' : 'Active invoice already exists for this customer.'}\n\n` +
          `Existing: #${candidate.invoiceNumber || '—'} · $${Number(candidate.amount||0).toFixed(2)} · ${deriveStatus(candidate)}${candidate.serviceDate ? ' · '+candidate.serviceDate : ''}\n` +
          `New: #${data.invoiceNumber || '—'} · $${Number(data.amount||0).toFixed(2)}${data.serviceDate ? ' · '+data.serviceDate : ''}\n\n` +
          `${high ? 'Same customer, service date and amount strongly suggest a duplicate.' : 'Continue only if this is a separate service/invoice.'}`
        : `${high ? 'Posible duplicado detectado.' : 'Ya existe una factura activa para este cliente.'}\n\n` +
          `Existente: #${candidate.invoiceNumber || '—'} · $${Number(candidate.amount||0).toFixed(2)} · ${deriveStatus(candidate)}${candidate.serviceDate ? ' · '+candidate.serviceDate : ''}\n` +
          `Nueva: #${data.invoiceNumber || '—'} · $${Number(data.amount||0).toFixed(2)}${data.serviceDate ? ' · '+data.serviceDate : ''}\n\n` +
          `${high ? 'Mismo cliente, fecha y monto indican un duplicado probable.' : 'Continúa solo si corresponde a otro servicio/factura.'}`;
      if (!confirm(msg)) {
        toast(en ? 'Duplicate prevented — existing active invoice kept' : 'Duplicado evitado — se conserva la factura activa', 'warn');
        return;
      }
    }
  }
  
  try {
    if (editingId) {
      // Si subió un PDF nuevo, actualizarlo también
      if (currentPdfBase64) {
        data.pdfBase64 = String(currentPdfBase64||'').replace(/^data:application\/pdf;base64,/i,'').replace(/\s+/g,'');
        data.pdfValidated = _pf25PdfHeaderOk(_pf25PdfBytes(data.pdfBase64));
        data.pdfValidatedAt = data.pdfValidated ? Date.now() : null;
        data.pdfFilename = currentPdfFilename;
        data.pdfSize = currentPdfSize;
        if (currentParseMeta) data._parseMeta = currentParseMeta;   // v33
      }
      await updateInvoiceData(editingId, data);
      toast(t('toast.invoiceUpdated'), 'success');
    } else {
      // Auto-crear/actualizar cliente al crear factura nueva
      await autoCreateCustomerFromInvoice(data);
      // Guardar PDF si lo subió
      if (currentPdfBase64) {
        data.pdfBase64 = String(currentPdfBase64||'').replace(/^data:application\/pdf;base64,/i,'').replace(/\s+/g,'');
        data.pdfValidated = _pf25PdfHeaderOk(_pf25PdfBytes(data.pdfBase64));
        data.pdfValidatedAt = data.pdfValidated ? Date.now() : null;
        data.pdfFilename = currentPdfFilename;
        data.pdfSize = currentPdfSize;
        if (currentParseMeta) data._parseMeta = currentParseMeta;   // v33
      }
      await createInvoice(data);
    }
    closeModal('formModal');
  } catch (err) {
    console.error('Save error:', err);
    // Show real error to user inside the modal
    const errEl = document.getElementById('formErrorMsg');
    const errMsg = err.message || String(err);
    let humanMsg;
    if (errMsg.includes('PERMISSION_DENIED') || errMsg.includes('permission_denied')) {
      humanMsg = currentLang === 'en'
        ? `🚨 Firebase rejected the write: PERMISSION_DENIED. Database rules need to allow writes. Check Firebase Console → Realtime Database → Rules. Data was saved locally as backup.`
        : `🚨 Firebase rechazó el guardado: PERMISSION_DENIED. Las reglas de la base de datos no permiten escritura. Revisa Firebase Console → Realtime Database → Rules. Tus datos se guardaron localmente como respaldo.`;
      // Auto-fallback to localStorage so user doesn't lose data
      try {
        const localInvoice = {
          ...data,
          id: 'local_fallback_' + Date.now(),
          status: 'pending',
          createdAt: Date.now(),
          sentAt: null, paidAt: null,
          history: [{ ts: Date.now(), action: 'created' }],
          _firebaseFailed: true
        };
        if (editingId) {
          const idx = allInvoices.findIndex(i => i.id === editingId);
          if (idx >= 0) allInvoices[idx] = { ...allInvoices[idx], ...data };
        } else {
          allInvoices.push(localInvoice);
        }
        saveToLocalStorage();
        computeAndRender();
      } catch (e2) { console.error('Local fallback also failed:', e2); }
    } else if (errMsg.includes('network') || errMsg.includes('offline')) {
      humanMsg = currentLang === 'en'
        ? `🌐 Network error: ${errMsg}. Saved locally — will sync when reconnected.`
        : `🌐 Error de red: ${errMsg}. Guardado localmente — sincronizará al reconectar.`;
    } else {
      humanMsg = currentLang === 'en'
        ? `❌ Error: ${errMsg}`
        : `❌ Error: ${errMsg}`;
    }
    errEl.textContent = humanMsg;
    errEl.style.display = 'block';
    toast(humanMsg, 'error');
    // Do NOT close modal — let user see the error and try again
  }
};

let currentEmailStage = 1;

window.setEmailStage = function(stage) {
  currentEmailStage = stage;
  document.querySelectorAll('#sendModal .email-stage-radio').forEach(r => {
    r.classList.toggle('active', Number(r.dataset.stage) === stage);
  });
  // Refresh preview
  const inv = allInvoices.find(i => i.id === sendingId);
  if (inv) {
    document.getElementById('prevSubject').textContent = buildEmailSubject(inv, stage);
    document.getElementById('prevBody').textContent = buildEmailPlainText(inv, stage);
  }
  // Update hint
  const hintsEs = {
    1: '✉ Tono cordial agradeciendo al cliente. Header negro.',
    2: '🔔 Recordatorio amigable, asume que tal vez no vio el primero. Header naranja.',
    3: '🚨 Past Due — firme, último aviso antes de colección. Header rojo.'
  };
  const hintsEn = {
    1: '✉ Cordial tone thanking the customer. Black header.',
    2: '🔔 Friendly reminder, assumes they may have missed the first one. Orange header.',
    3: '🚨 Past Due — firm, final notice before collections. Red header.'
  };
  const hints = currentLang === 'en' ? hintsEn : hintsEs;
  document.getElementById('stageHint').textContent = hints[stage] || '';
};

window.openSendModal = function(id) {
  const inv = allInvoices.find(i => i.id === id);
  if (!inv) return;
  sendingId = id;
  
  // Auto-suggest the appropriate stage based on history
  const suggested = suggestEmailStage(inv);
  currentEmailStage = suggested;
  setEmailStage(suggested);
  
  // Show suggestion explanation
  const sendCount = (inv.history || []).filter(h => h.action === 'sent').length;
  let suggestionText = '';
  if (suggested === 4) suggestionText = currentLang === 'en'
    ? '✅ Invoice is PAID — receipt/thank-you template suggested.'
    : '✅ Factura PAGADA — sugerido template de recibo/gracias.';
  else if (sendCount === 0) suggestionText = currentLang === 'en' ? 'First send suggested (new invoice).' : 'Primer envío sugerido (factura nueva).';
  else if (suggested === 2) suggestionText = currentLang === 'en' 
    ? `Reminder suggested: already sent ${daysSince(inv.sentAt)} day(s) ago, ${sendCount}× sent.`
    : `Sugerido recordatorio: ya enviada hace ${daysSince(inv.sentAt)} día${daysSince(inv.sentAt) !== 1 ? 's' : ''}, ${sendCount}× enviada.`;
  else if (suggested === 3) suggestionText = currentLang === 'en'
    ? `Final notice suggested: already sent ${daysSince(inv.sentAt)} day(s) ago, ${sendCount}× sent.`
    : `Sugerido aviso final: ya enviada hace ${daysSince(inv.sentAt)} día${daysSince(inv.sentAt) !== 1 ? 's' : ''}, ${sendCount}× enviada.`;
  document.getElementById('stageHint').textContent = suggestionText;
  
  document.getElementById('prevTo').textContent = inv.customerEmail || (inv.customerPhone ? '📱 ' + inv.customerPhone + ' (SMS — no email)' : '⚠ No email or phone');
  
  // Show/hide SMS button based on phone availability
  // Look up phone from invoice OR from customer record
  const customer = (inv.customerName) ? findCustomerByName(inv.customerName) : null;
  const phoneAvailable = (inv.customerPhone || (customer && customer.phone) || '').replace(/[^\d+]/g, '');
  const smsBtn = document.getElementById('sendSmsBtn');
  if (smsBtn) {
    smsBtn.style.display = phoneAvailable ? 'inline-block' : 'none';
  }
  
  const attachmentEl = document.getElementById('prevAttachment');
  const warnEl = document.getElementById('sendNoPdfWarn');
  if (inv.pdfBase64) {
    const sizeKb = ((inv.pdfSize || 0) / 1024).toFixed(0);
    attachmentEl.innerHTML = `📎 ${escapeHtml(inv.pdfFilename || 'Invoice.pdf')} <span style="color:var(--text-mute);">(${sizeKb} KB)</span>`;
    warnEl.style.display = 'none';
  } else {
    attachmentEl.innerHTML = `<span style="color:var(--followup);">⚠ Sin PDF guardado</span>`;
    warnEl.style.display = 'flex';
  }
  
  document.getElementById('sendModal').classList.add('open');
};

window.markAsSent = async function() {
  if (!sendingId) return;
  const inv = allInvoices.find(i => i.id === sendingId);
  const now = Date.now();
  // Manual click = explicit confirmation, so set confirmed:true
  const history = [...(inv.history || []), { ts: now, action: 'sent', stage: currentEmailStage, confirmed: true }];
  // If invoice is ALREADY paid, don't downgrade status — just log to history
  const updates = inv.status === 'paid'
    ? { history, lastEmailStage: currentEmailStage }
    : { status: 'sent', sentAt: now, history, lastEmailStage: currentEmailStage };
  await updateInvoiceData(sendingId, updates);
  const stageLabel = ({1: t('stage.firstSend'), 2: t('stage.reminder'), 3: t('stage.pastDue'), 4: t('stage.receipt')})[currentEmailStage];
  toast(t('toast.markedSent', inv.invoiceNumber, stageLabel), 'success');
  closeModal('sendModal');
};

window.markAsPaid = async function(id) {
  const inv = allInvoices.find(i => i.id === id);
  if (!inv) return;
  if (!confirm(currentLang === 'en' ? `Mark invoice #${inv.invoiceNumber} from ${inv.customerName} as paid?` : `¿Marcar factura #${inv.invoiceNumber} de ${inv.customerName} como pagada?`)) return;
  const now = Date.now();
  const history = [...(inv.history || []), { ts: now, action: 'paid' }];
  await updateInvoiceData(id, { status: 'paid', paidAt: now, history });
  toast(t('toast.markedPaid', inv.invoiceNumber), 'success');
  // Gap B fix: resolve any open TECH-TICKETS alerts for this invoice too.
  const whoResolved = getInvoiceTrackerUser() || 'Invoice Tracker';
  const paidInv = allInvoices.find(i => i.id === id) || inv;
  setTimeout(async () => {
    try {
      const r = await resolveInvoiceCrossAppAlerts(paidInv, whoResolved, 'paid_in_invoice_tracker');
      if (r && r.resolved > 0) {
        toast(currentLang === 'en'
          ? `✓ ${r.resolved} TECH-TICKETS alert${r.resolved !== 1 ? 's' : ''} auto-resolved`
          : `✓ ${r.resolved} alerta${r.resolved !== 1 ? 's' : ''} de TECH-TICKETS auto-resuelta${r.resolved !== 1 ? 's' : ''}`, 'success');
        try { if (typeof updateCrossAppInboxBadge === 'function') updateCrossAppInboxBadge(); } catch(_e){}
      }
    } catch(_e){ console.warn('[markAsPaid] resolve alerts failed', _e); }
  }, 300);
};

window.openDeleteModal = function(id) {
  const inv = allInvoices.find(i => i.id === id);
  if (!inv) return;
  deletingId = id;
  document.getElementById('delInvoiceNum').textContent = '#' + inv.invoiceNumber;
  document.getElementById('delCustomer').textContent = inv.customerName;
  document.getElementById('deleteModal').classList.add('open');
};

// ════════════════════════════════════════════════════════════
// QUICK-CLOSE QB SYNCED — one-click "I entered this in QuickBooks" toggle.
// Saves opening the full payment modal when she's batch-clearing the QB Pending tab.
// History stamps WHO + WHEN to keep audit trail for accounting reconciliation.
// ════════════════════════════════════════════════════════════
window.markQbSynced = async function(id) {
  const inv = allInvoices.find(i => i.id === id);
  if (!inv) return;
  const en = currentLang === 'en';
  if (inv.qbSynced) {
    // Already synced — offer to un-sync (in case of mistake)
    if (!confirm(en
      ? `Invoice #${inv.invoiceNumber} is already marked as entered in QuickBooks. Un-mark it?`
      : `La factura #${inv.invoiceNumber} ya está marcada como entrada en QuickBooks. ¿Quitar la marca?`)) return;
    const now = Date.now();
    const who = getInvoiceTrackerUser() || 'Invoice Tracker';
    const history = [...(inv.history || []), { ts: now, action: 'qb_unsynced', by: who }];
    await updateInvoiceData(id, { qbSynced: false, history });
    toast(en ? '↩ QB sync removed — back in backlog' : '↩ Marca QB removida — vuelve al backlog', 'info');
    return;
  }
  const now = Date.now();
  const who = getInvoiceTrackerUser() || 'Invoice Tracker';
  const history = [...(inv.history || []), { ts: now, action: 'qb_synced', by: who }];
  await updateInvoiceData(id, { qbSynced: true, history });
  toast(en
    ? `✅ #${inv.invoiceNumber} marked as entered in QuickBooks`
    : `✅ #${inv.invoiceNumber} marcada como entrada en QuickBooks`, 'success');
};

window.confirmDelete = async function() {
  if (!deletingId) return;
  await deleteInvoice(deletingId);
  closeModal('deleteModal');
};

window.closeModal = function(id) {
  document.getElementById(id).classList.remove('open');
};

// ════════════════════════════════════════════════════════════
// SETTINGS MODAL
// ════════════════════════════════════════════════════════════
window.openSettingsModal = function() {
  document.getElementById('setPhone').value = savedSettings.phone || '';
  document.getElementById('setWebsite').value = savedSettings.website || 'aspenspas.com';
  document.getElementById('setFromName').value = savedSettings.fromName || 'Aspen Spas Service';
  document.getElementById('setFirebaseConfig').value = savedSettings.firebaseConfig 
    ? JSON.stringify(savedSettings.firebaseConfig, null, 2) 
    : '';
  // Tickets DB
  const tdb = savedSettings.ticketsDb || {};
  document.getElementById('setTixApiKey').value = tdb.apiKey || '';
  document.getElementById('setTixProjectId').value = tdb.projectId || '';
  document.getElementById('setTixTicketsColl').value = tdb.ticketsCollection || 'tickets';
  document.getElementById('setTixCustColl').value = tdb.customersCollection || '';
  document.getElementById('tixTestResult').innerHTML = '';
  // Collections team email
  document.getElementById('cfgCollectionsName').value = savedSettings.collectionsName || '';
  document.getElementById('cfgCollectionsEmail').value = savedSettings.collectionsEmail || '';
  document.getElementById('settingsModal').classList.add('open');
};

window.testTicketsConnection = async function() {
  const apiKey = document.getElementById('setTixApiKey').value.trim() || DEFAULT_TICKETS_DB.apiKey;
  const projectId = document.getElementById('setTixProjectId').value.trim() || DEFAULT_TICKETS_DB.projectId;
  const ticketsColl = document.getElementById('setTixTicketsColl').value.trim() || 'tickets';
  const resultEl = document.getElementById('tixTestResult');
  const en = currentLang === 'en';

  resultEl.innerHTML = `<span style="color:var(--text-soft);">${en ? 'Running full diagnostic…' : 'Diagnóstico completo…'}</span>`;
  const lines = [];

  // ── STEP 1: Anonymous auth (mint a token) — this is what 401s come from ──
  let token = null;
  try {
    // Clear any stale token so we test a fresh mint
    _ticketsAuthToken = null; _ticketsAuthTokenExp = 0;
    token = await getTicketsAuthToken();
    if (token) {
      lines.push(`<div style="color:var(--sent);">✓ ${en ? 'Auth: signed in (anonymous token OK)' : 'Auth: sesión iniciada (token anónimo OK)'}</div>`);
    } else {
      const hint = getTicketsConnectionHint(currentLang);
      lines.push(`<div style="color:var(--pending);">❌ ${en ? 'Auth FAILED' : 'Auth FALLÓ'} — ${escapeHtml(hint)}</div>`);
    }
  } catch (e) {
    lines.push(`<div style="color:var(--pending);">❌ ${en ? 'Auth error' : 'Error de auth'}: ${escapeHtml(e.message)}</div>`);
  }

  // ── STEP 2: Authenticated READ (tickets) ──
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${ticketsColl}?pageSize=1&key=${apiKey}`;
    const res = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
    if (res.ok) {
      lines.push(`<div style="color:var(--sent);">✓ ${en ? 'Read OK (tickets reachable)' : 'Lectura OK (tickets accesible)'}</div>`);
    } else {
      let msg = `HTTP ${res.status}`;
      if (res.status === 401) msg = en ? '401 — token rejected (auth/network issue, see below)' : '401 — token rechazado (problema auth/red, ver abajo)';
      if (res.status === 403) msg = en ? '403 — Firestore rules block read' : '403 — reglas Firestore bloquean lectura';
      if (res.status === 400) msg = en ? '400 — invalid API key' : '400 — API Key inválida';
      lines.push(`<div style="color:var(--pending);">❌ ${en ? 'Read' : 'Lectura'}: ${escapeHtml(msg)}</div>`);
    }
  } catch (e) {
    lines.push(`<div style="color:var(--pending);">❌ ${en ? 'Read network error' : 'Error de red en lectura'}: ${escapeHtml(e.message)}</div>`);
  }

  // ── STEP 3: Authenticated WRITE test (the operation that's actually failing) ──
  // Write a tiny self-test doc to a separate collection so we don't pollute
  // cross_app_events, then we know publish/resolve will work.
  if (token) {
    try {
      const wUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/_connection_tests?key=${apiKey}`;
      const wRes = await fetch(wUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { from: { stringValue: 'invoice-tracker' }, at: { timestampValue: new Date().toISOString() } } })
      });
      if (wRes.ok) {
        lines.push(`<div style="color:var(--sent);">✓ ${en ? 'Write OK — publishing alerts will work!' : 'Escritura OK — ¡publicar alertas funcionará!'}</div>`);
      } else {
        let msg = `HTTP ${wRes.status}`;
        if (wRes.status === 401) msg = en ? '401 — token rejected on write' : '401 — token rechazado al escribir';
        if (wRes.status === 403) msg = en ? '403 — rules block write (need: allow write if request.auth != null)' : '403 — reglas bloquean escritura (necesita: allow write if request.auth != null)';
        lines.push(`<div style="color:var(--pending);">❌ ${en ? 'Write' : 'Escritura'}: ${escapeHtml(msg)}</div>`);
      }
    } catch (e) {
      lines.push(`<div style="color:var(--pending);">❌ ${en ? 'Write network error' : 'Error de red en escritura'}: ${escapeHtml(e.message)}</div>`);
    }
  } else {
    lines.push(`<div style="color:var(--text-soft);">⏭ ${en ? 'Write test skipped (no token)' : 'Test de escritura omitido (sin token)'}</div>`);
  }

  // ── Verdict + actionable hint ──
  if (!token) {
    lines.push(`<div style="margin-top:6px;padding:7px 9px;background:#FEF2F2;border:1px solid #FCA5A5;border-radius:6px;color:#991B1B;font-size:11px;line-height:1.5;">
      <b>${en ? 'Most likely cause:' : 'Causa más probable:'}</b><br>
      1. ${en ? 'A VPN or ad-blocker is blocking <code>securetoken.googleapis.com</code> — try disabling <b>VPN Plus</b> / blockers for this site.' : 'Un VPN o ad-blocker está bloqueando <code>securetoken.googleapis.com</code> — prueba desactivar <b>VPN Plus</b> / bloqueadores para este sitio.'}<br>
      2. ${en ? 'Anonymous auth is OFF in Firebase — Console → Authentication → Sign-in method → Anonymous → Enable.' : 'Auth anónima está APAGADA en Firebase — Console → Authentication → Sign-in method → Anonymous → Enable.'}<br>
      3. ${en ? 'Check your internet connection.' : 'Revisa tu conexión a internet.'}
    </div>`);
  }
  resultEl.innerHTML = lines.join('');
};

window.saveSettings = function() {
  const newSettings = {
    phone: document.getElementById('setPhone').value.trim(),
    website: document.getElementById('setWebsite').value.trim() || 'aspenspas.com',
    address: (document.getElementById('setAddress')?.value || '').trim(),
    fromName: document.getElementById('setFromName').value.trim() || 'Aspen Spas Service',
    collectionsName: document.getElementById('cfgCollectionsName').value.trim(),
    collectionsEmail: document.getElementById('cfgCollectionsEmail').value.trim(),
    firebaseConfig: null,
    ticketsDb: null
  };
  
  const fbRaw = document.getElementById('setFirebaseConfig').value.trim();
  if (fbRaw) {
    try {
      let cleaned = fbRaw.replace(/^.*?(\{)/s, '{').replace(/(;|\s)*$/, '');
      cleaned = cleaned.replace(/([{,]\s*)([A-Za-z_][\w]*)(\s*):/g, '$1"$2"$3:');
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
      const parsed = JSON.parse(cleaned);
      if (!parsed.apiKey) throw new Error('apiKey faltante');
      newSettings.firebaseConfig = parsed;
    } catch (e) {
      console.error('Firebase parse error:', e);
      toast('JSON de Firebase inválido. Asegúrate de copiar el bloque completo desde { hasta }', 'error');
      return;
    }
  }

  // Tickets DB config
  const tixApiKey = document.getElementById('setTixApiKey').value.trim();
  const tixProjectId = document.getElementById('setTixProjectId').value.trim();
  if (tixApiKey && tixProjectId) {
    newSettings.ticketsDb = {
      apiKey: tixApiKey,
      projectId: tixProjectId,
      ticketsCollection: document.getElementById('setTixTicketsColl').value.trim() || 'tickets',
      customersCollection: document.getElementById('setTixCustColl').value.trim() || null
    };
  }
  
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  toast('Configuración guardada. Recargando…', 'success');
  setTimeout(() => location.reload(), 800);
};

// ════════════════════════════════════════════════════════════
// PDF UPLOAD & PARSING
// ════════════════════════════════════════════════════════════

function _pf25PdfBytes(raw){
  try{let s=String(raw||'').trim();if(/^data:application\/pdf;base64,/i.test(s))s=s.slice(s.indexOf(',')+1);s=s.replace(/\s+/g,'');let bin=atob(s),b=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);return b}catch(e){return null}
}
function _pf25PdfHeaderOk(b){return !!b&&b.length>5&&b[0]===37&&b[1]===80&&b[2]===68&&b[3]===70&&b[4]===45}

window.handlePdfUpload = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.type !== 'application/pdf') {
    toast('Solo archivos PDF', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast('PDF muy grande (max 5MB). Comprime y vuelve a intentar.', 'error');
    return;
  }
  
  const dropZone = document.getElementById('pdfDropZone');
  dropZone.classList.add('processing');
  dropZone.querySelector('.pdf-upload-title').textContent = 'Procesando PDF…';
  
  try {
    const arrayBuffer = await file.arrayBuffer();

    // v33.2: a real PDF starts with the bytes "%PDF-". Anything else cannot be
    // parsed, cannot be opened by the customer, and must never be stored or
    // emailed. Check this BEFORE touching any state.
    if (!_pf25PdfHeaderOk(new Uint8Array(arrayBuffer.slice(0, 8)))) {
      const probe = new Uint8Array(arrayBuffer.slice(0, Math.min(8192, arrayBuffer.byteLength)));
      let empty = true;
      for (let i = 0; i < probe.length; i++) { if (probe[i] !== 0) { empty = false; break; } }
      const en = (typeof currentLang !== 'undefined' && currentLang === 'en');
      const why = empty
        ? (en ? `<b>"${escapeHtml(file.name)}" is empty.</b> It is ${Math.round(file.size/1024)} KB of nothing — every byte is zero. This is what a cloud file (iCloud Drive, Dropbox, OneDrive) looks like when it was never actually downloaded, or an export that was interrupted. Open the folder, make sure the file downloads for real, or re-export the invoice from QuickBooks — then upload it again.`
              : `<b>"${escapeHtml(file.name)}" está vacío.</b> Son ${Math.round(file.size/1024)} KB de nada: todos sus bytes son cero. Así se ve un archivo de la nube (iCloud Drive, Dropbox, OneDrive) que nunca se descargó de verdad, o una exportación que se cortó a mitad. Abrí la carpeta y asegurate de que el archivo se baje completo, o volvé a exportar la factura desde QuickBooks, y subilo de nuevo.`)
        : (en ? `<b>"${escapeHtml(file.name)}" is not a PDF.</b> It has a .pdf name but its contents are something else, so no reader can open it. Re-export it from QuickBooks and upload it again.`
              : `<b>"${escapeHtml(file.name)}" no es un PDF.</b> Tiene nombre .pdf pero adentro hay otra cosa, así que ningún lector puede abrirlo. Volvé a exportarlo desde QuickBooks y subilo de nuevo.`);

      const banner = document.getElementById('extractedBanner');
      if (banner) {
        banner.className = 'alert-row red';
        banner.style.marginBottom = '14px';
        banner.innerHTML = `<span class="alert-icon">⚠</span><div>${why}</div>`;
        banner.style.display = 'flex';
      }
      toast(en ? 'That file is not a readable PDF — nothing was attached' : 'Ese archivo no es un PDF legible — no se adjuntó nada', 'error');
      console.warn('[PDF Parser] rejected "' + file.name + '" — no %PDF- header (' + file.size + ' bytes, all-zero: ' + empty + ')');
      dropZone.classList.remove('processing');
      const ttl0 = dropZone.querySelector('.pdf-upload-title');
      if (ttl0) ttl0.textContent = 'Subir PDF · QuickBooks o PayTrace';
      const inp0 = document.getElementById('pdfFileInput'); if (inp0) inp0.value = '';
      return;
    }

    // Convertir a base64 para guardar
    currentPdfBase64 = await arrayBufferToBase64(arrayBuffer);
    currentPdfFilename = file.name;
    currentPdfSize = file.size;
    
    // Mostrar info del archivo y ocultar zona de upload
    showPdfFileInfo(file.name, file.size);
    dropZone.style.display = 'none';
    
    // Intentar extraer texto y campos
    const extracted = await extractPdfFields(arrayBuffer);
    // Filtrar campos especiales (_error, _set*, _authBanner)
    const realFields = Object.keys(extracted).filter(k => !k.startsWith('_'));
    if (realFields.length > 0) {
      applyExtractedFields(extracted);
      // v33: remember how this parse went so the record can be audited later.
      currentParseMeta = {
        amountConfidence: extracted._amountConfidence || null,
        amountNeedsReview: !!extracted._amountNeedsReview,
        amountReason: extracted._amountReason || null,
        tier: extracted._fallbackUsed ? 'raw_bytes' : (extracted._pdfRepaired ? 'repaired' : 'text_layer'),
        partial: !!extracted._partial,
        at: Date.now()
      };
      currentPdfAutoValues = {
        fInvoiceNumber: extracted.invoiceNumber || '',
        fAmount: extracted.amount != null ? String(extracted.amount) : '',
        fCustomerName: extracted.customerName || '',
        fCustomerEmail: extracted.customerEmail || '',
        fServiceDate: extracted.serviceDate || '',
        fServiceDesc: extracted.serviceDescription || ''
      };
      // Auth.net PDFs surface a richer banner explaining what will happen on save
      // v33: amount trouble outranks every other banner — a missing or guessed
      // total is the one thing that must never be saved without a human look.
      const amtBad = extracted._amountNeedsReview || extracted._amountConfidence === 'guess';
      if (amtBad) {
        const why = extracted._amountReason === 'raw_byte_scrape'
          ? 'El monto se recuperó de los bytes crudos del PDF — es una estimación. Verificálo contra la factura antes de guardar.'
          : 'No encontré un renglón "Total" confiable, así que dejé el monto como está. Completálo a mano.';
        showExtractedBanner(realFields.length, why, 'warn');
      } else if (extracted._authBanner) {
        showAuthNetBanner(extracted._authBanner, realFields.length);
      } else if (extracted._partial) {
        showExtractedBanner(realFields.length, extracted._error || 'Parseo parcial — verificá cada campo.', 'warn');
      } else if (extracted._pdfRepaired) {
        showExtractedBanner(realFields.length, 'PDF reparado correctamente — los campos se recuperaron del documento reconstruido.');
      } else if (extracted._fallbackUsed) {
        showExtractedBanner(realFields.length, extracted._error || 'Se usó el parser de respaldo — verificá los campos detectados.', 'warn');
      } else if (extracted._salesOrder) {
        showExtractedBanner(realFields.length, extracted._amountConfidence === 'low'
          ? 'Sales Order de Aspen — S.O. No. y descripciones parseados. El Total se tomó del último valor en $; confirmalo contra el papel.'
          : 'Sales Order de Aspen detectado — S.O. No., Total y descripciones parseados.');
      } else {
        showExtractedBanner(realFields.length, null);
      }
      // Safety net: also fire the token-based customer lookup (catches cases where the customer
      // is in TICKETS DB but not local, OR the PDF customer name format differs from the local DB)
      try { await window.tryAutoFillCustomerFromName(); } catch(_e){ console.warn('[PDF→AutoFill]', _e); }
    } else {
      showExtractedBanner(0, extracted._error || null);
    }
    
  } catch (e) {
    console.error('Error PDF:', e);
    toast('Error procesando PDF: ' + e.message, 'error');
    dropZone.classList.remove('processing');
    dropZone.querySelector('.pdf-upload-title').textContent = 'Subir PDF · QuickBooks o PayTrace';
  }
};

function showPdfFileInfo(name, size) {
  const sizeKb = (size / 1024).toFixed(0);
  const info = document.getElementById('pdfFileInfo');
  info.innerHTML = `
    <div class="pdf-file-info">
      <div class="pdf-file-info-icon">📄</div>
      <div class="pdf-file-info-main">
        <div class="pdf-file-info-name">${escapeHtml(name)}</div>
        <div class="pdf-file-info-size">${sizeKb} KB · Adjunto al email automáticamente</div>
      </div>
      <button type="button" style="border:1px solid #d6dce1;background:#fff;border-radius:7px;padding:5px 9px;font-size:11px;cursor:pointer" onclick="event.preventDefault();event.stopPropagation();removePdf(event);setTimeout(()=>document.getElementById('pdfFileInput')?.click(),30)">Replace</button>
      <button type="button" class="pdf-file-info-remove" onclick="event.preventDefault();event.stopPropagation();removePdf(event)" title="Remove PDF">×</button>
    </div>`;
  info.style.display = 'block';
}

function showExtractedBanner(count, errorMsg, level) {
  const banner = document.getElementById('extractedBanner');
  if (count > 0) {
    // v33: the note used to be discarded whenever ANY field parsed — which is
    // exactly when "verify this" matters. Now it always renders under the count,
    // and level='warn' turns the whole banner amber.
    const note = errorMsg
      ? `<div style="margin-top:5px;font-size:12px;font-weight:500;opacity:.92">${escapeHtml(errorMsg)}</div>`
      : '';
    if (level === 'warn') {
      banner.className = 'alert-row amber';
      banner.style.marginBottom = '14px';
      banner.innerHTML = `<span class="alert-icon">⚠</span><div>Auto-completé ${count} campo${count !== 1 ? 's' : ''} del PDF — revisa antes de guardar.${note}</div>`;
    } else {
      banner.className = 'pdf-extracted-banner';
      banner.style.marginBottom = '';
      banner.innerHTML = `<span>✓</span><div>Auto-completé ${count} campo${count !== 1 ? 's' : ''} del PDF. Revisa y completa lo que falte.${note}</div>`;
    }
    banner.style.display = 'flex';
  } else {
    banner.className = 'alert-row amber';
    banner.style.marginBottom = '14px';
    const reason = errorMsg ? ` (${escapeHtml(errorMsg)})` : '';
    banner.innerHTML = `<span>ℹ</span> No pude extraer campos del PDF automáticamente${reason}. Llénalos manualmente abajo.`;
    banner.style.display = 'flex';
  }
}

// Banner specific to Authorize.net PDFs — explains exactly what flags will be applied at save.
// Without this, the auto-paid + auto-QB-pending behavior would be a surprise.
function showAuthNetBanner(authStatus, count) {
  const banner = document.getElementById('extractedBanner');
  const en = currentLang === 'en';
  if (authStatus === 'paid') {
    banner.className = 'pdf-extracted-banner';
    banner.style.background = '#EFF6FF';
    banner.style.border = '1px solid #93C5FD';
    banner.style.color = '#1E40AF';
    banner.innerHTML = en
      ? `🔵 <b>Authorize.net invoice detected — Status: PAID.</b> Auto-filled ${count} fields. On save, this will be marked <b>Paid via Authorize.net</b> and added to the <b>"💳 Paid · QB Pending"</b> tab as a reminder to enter it in QuickBooks Desktop.`
      : `🔵 <b>Factura de Authorize.net — Status: PAGADA.</b> Auto-completé ${count} campos. Al guardar quedará marcada <b>Pagada vía Authorize.net</b> y aparecerá en la pestaña <b>"💳 Paid · QB Pending"</b> como recordatorio para registrarla en QuickBooks Desktop.`;
  } else if (authStatus === 'overdue') {
    banner.className = 'alert-row red';
    banner.style.marginBottom = '14px';
    banner.innerHTML = en
      ? `🔵 <b>Authorize.net invoice — Status: OVERDUE.</b> Auto-filled ${count} fields. Will be saved as <b>unpaid</b> — collection reminder is on you.`
      : `🔵 <b>Factura de Authorize.net — Status: VENCIDA.</b> Auto-completé ${count} campos. Se guardará como <b>impaga</b> — el recordatorio de cobro queda en tus manos.`;
  } else {
    banner.className = 'pdf-extracted-banner';
    banner.innerHTML = en
      ? `🔵 <b>Authorize.net invoice — Status: UNPAID.</b> Auto-filled ${count} fields. Saved as pending.`
      : `🔵 <b>Factura de Authorize.net — Status: NO PAGADA.</b> Auto-completé ${count} campos. Se guardará como pendiente.`;
  }
  banner.style.display = 'flex';
}

window.removePdf = function(ev) {
  try{ if(ev){ev.preventDefault();ev.stopPropagation();} }catch(_e){}

  // Clear values that still exactly match what THIS PDF auto-filled.
  // Never erase a field the user has edited manually after parsing.
  try{
    Object.entries(currentPdfAutoValues||{}).forEach(([id,val])=>{
      if(val===null||val===undefined||val==='')return;
      const el=document.getElementById(id);
      if(el && String(el.value||'').trim()===String(val).trim()) el.value='';
    });
  }catch(_e){}
  currentPdfAutoValues={};

  currentPdfBase64 = null;
  currentPdfFilename = null;
  currentPdfSize = 0;
  currentParseMeta = null;
  currentExtractedStatus = null;
  currentExtractedPaymentMethod = null;
  currentExtractedQbSynced = null;
  currentExtractedPaidAt = null;

  const input=document.getElementById('pdfFileInput');
  if(input){ input.value=''; input.type=''; input.type='file'; input.accept='application/pdf'; }
  const info=document.getElementById('pdfFileInfo'); if(info){info.innerHTML='';info.style.display='none';}
  const banner=document.getElementById('extractedBanner'); if(banner){banner.innerHTML='';banner.style.display='none';}
  const dropZone=document.getElementById('pdfDropZone');
  if(dropZone){
    dropZone.style.display='block';
    dropZone.classList.remove('processing','has-file');
    const ttl=dropZone.querySelector('.pdf-upload-title'); if(ttl)ttl.textContent='Subir PDF · QuickBooks o PayTrace';
  }
  try{toast('PDF removed — you can upload it again','success')}catch(_e){}
};;

async function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}


/* v29 — resilient PDF fallback parser.
   Some QuickBooks/browser-generated PDFs are readable by Chrome but PDF.js
   reports "Invalid PDF structure". We still preserve the original PDF and
   recover whatever fields are present in raw printable strings / filename. */
function _pf29PrintablePdfText(arrayBuffer){
  try{
    const bytes=new Uint8Array(arrayBuffer);
    let out='',run='';
    for(let i=0;i<bytes.length;i++){
      const c=bytes[i];
      if((c>=32&&c<=126)||c===10||c===13||c===9){run+=String.fromCharCode(c);}
      else{if(run.length>=4)out+=' '+run;run='';}
    }
    if(run.length>=4)out+=' '+run;
    return out.replace(/\\([()\\])/g,'$1').replace(/\s+/g,' ').trim();
  }catch(e){return''}
}
function _pf29NameFromFilename(name){
  let s=String(name||'').replace(/\.pdf$/i,'').replace(/[_-]+/g,' ').trim();
  s=s.replace(/\b(?:invoice|inv|statement|receipt)\b\s*#?\s*\d*/ig,' ')
     .replace(/\b(?:sauna|swim\s*spa|hot\s*tub|spa)\b.*$/i,' ')
     .replace(/\s+/g,' ').trim();
  return s.length>=3?s:'';
}
function _pf29FallbackPdfFields(arrayBuffer,filename){
  const raw=_pf29PrintablePdfText(arrayBuffer),r={};
  let m;
  const invRx=[/Invoice\s*(?:No\.?|Number|#)\s*[:#\-]?\s*(\d{4,10})/i,/\bInv(?:oice)?\s*#\s*(\d{4,10})/i,/\bInvoice\s+(\d{4,10})\b/i,/S\.?\s*O\.?\s*No\.?\s*[:#\-]?\s*(\d{4,10})/i];
  for(const rx of invRx){m=raw.match(rx);if(m){r.invoiceNumber=m[1];break;}}
  if(/\bSales\s+Order\b/i.test(raw)){
    const ds=[...raw.matchAll(/\$\s*([\d,]+\.\d{2})/g)];
    if(ds.length)r.amount=parseFloat(ds[ds.length-1][1].replace(/,/g,''));
  }
  if(!r.amount){m=raw.match(/(?:Total|Amount\s+Due|Balance\s+Due|Invoice\s+Total)\s*[:$]?\s*\$?\s*([\d,]+\.\d{2})/i);if(m)r.amount=parseFloat(m[1].replace(/,/g,''));}
  m=raw.match(/[\w._%+\-]+@[\w.\-]+\.\w{2,}/i);if(m)r.customerEmail=m[0];
  m=raw.match(/(?:Bill\s+To|Customer)\s*:?\s*([A-Z][A-Za-z&.,'\- ]{3,70}?)(?=\s+(?:Email|Phone|Address|Invoice|Date|Terms|Total|Amount|Item|Description)\b)/i);
  if(m)r.customerName=m[1].trim().replace(/\s+/g,' ');
  if(!r.customerName){const fn=_pf29NameFromFilename(filename);if(fn)r.customerName=fn;}
  m=raw.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if(m)r.serviceDate=`${m[3]}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;
  r._fallbackUsed=true;
  return r;
}


/* v31 — resilient fallback for Aspen QuickBooks / Sales Order PDFs.
   Uses a fresh byte copy and recognizes S.O. No / final total / description text
   when those strings are recoverable outside the PDF.js text layer. */
function _pf31LoosePdfText(arrayBuffer){
  try{
    const bytes=new Uint8Array(arrayBuffer),chunks=[],dec=new TextDecoder('latin1');
    const raw=dec.decode(bytes);
    // Pull literal PDF strings: (...) plus general printable runs.
    const literals=[]; let m;
    const rx=/\(([^()]*(?:\\.[^()]*)*)\)/g;
    while((m=rx.exec(raw))&&literals.length<12000){
      const s=m[1].replace(/\\([()\\])/g,'$1').replace(/\\n|\\r/g,' ');
      if(/[A-Za-z0-9]/.test(s))literals.push(s);
    }
    const runs=(raw.match(/[\x20-\x7E]{4,}/g)||[]);
    return literals.concat(runs).join(' ').replace(/\s+/g,' ').trim();
  }catch(e){return''}
}
function _pf31FallbackPdfFields(arrayBuffer,filename){
  const raw=_pf31LoosePdfText(arrayBuffer),r={}; let m;
  const isSO=/\bSales\s*Order\b/i.test(raw)||/S\.?\s*O\.?\s*No\.?/i.test(raw);

  const invPatterns=[
    /S\.?\s*O\.?\s*No\.?\s*[:#\-]?\s*(\d{4,10})\b/i,
    /Invoice\s*(?:No\.?|Number|#)\s*[:#\-]?\s*(\d{4,10})\b/i,
    /\bInv(?:oice)?\s*#\s*(\d{4,10})\b/i
  ];
  for(const rx of invPatterns){m=raw.match(rx);if(m){r.invoiceNumber=m[1];break}}

  // Aspen Sales Order: authoritative total is the final explicit currency value.
  const dollars=[...raw.matchAll(/\$\s*([\d,]+\.\d{2})/g)];
  if(isSO&&dollars.length)r.amount=parseFloat(dollars[dollars.length-1][1].replace(/,/g,''));
  if(!r.amount){m=raw.match(/(?:Grand\s+Total|Invoice\s+Total|Amount\s+Due|Balance\s+Due|\bTotal\b)\s*[:$]?\s*\$?\s*([\d,]+\.\d{2})/i);if(m)r.amount=parseFloat(m[1].replace(/,/g,''))}
  // v33: this tier reads raw bytes, not a text layer. Anything it returns is a
  // guess and must be labelled as one — the UI blocks a silent save on these.
  if(r.amount!=null){r._amountConfidence='guess';r._amountNeedsReview=true;r._amountReason='raw_byte_scrape'}

  m=raw.match(/[\w._%+\-]+@[\w.\-]+\.\w{2,}/i);if(m)r.customerEmail=m[0];
  m=raw.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);if(m)r.serviceDate=`${m[3]}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;

  // Bill To / customer name when recoverable.
  m=raw.match(/Bill\s*To\s*:?\s*([A-Za-z][A-Za-z0-9&.,'\- ]{3,70}?)(?=\s+\d{2,6}\s+|\s+(?:Ship\s*To|Terms|Sales\s+Person|Item|Description)\b)/i);
  if(m)r.customerName=m[1].trim().replace(/\s+/g,' ');
  if(!r.customerName){const fn=_pf29NameFromFilename(filename);if(fn)r.customerName=fn;}

  if(isSO){
    const descriptions=[];
    // Common Aspen item descriptions, even when flattened into one raw string.
    const candidates=[
      /Additional\s+Service\s+Labor\s*\/\s*Hour/ig,
      /in\.k300\s+Topside\s+control/ig,
      /Spa\s+pack\s+IN\.YE-?3/ig,
      /(?:Repair|Replacement|Install|Installation|Service|Labor)[A-Za-z0-9 .\/&+\-]{3,80}/ig
    ];
    candidates.forEach(rx=>{let x;while((x=rx.exec(raw))&&descriptions.length<8){let d=x[0].replace(/\s+/g,' ').trim();if(!/Retail\s+Sale|tax/i.test(d)&&!descriptions.includes(d))descriptions.push(d)}});
    if(descriptions.length)r.serviceDescription=descriptions.join(' · ').slice(0,500);
    r._salesOrder=true;
  }
  r._fallbackUsed=true;
  return r;
}

async function extractPdfFields(arrayBuffer) {
  if (!window.pdfjsLib) {
    console.error('PDF.js did not load.');
    return { _error: 'PDF.js not available. Check internet connection.' };
  }
  if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // Keep our own immutable copy. PDF.js workers can transfer/detach ArrayBuffers;
  // v29/v30 were sometimes handing the fallback parser an already-detached buffer.
  const originalBytes = new Uint8Array(arrayBuffer.slice(0));

  async function readWithPdfJs(opts,sourceBytes){
    const data = (sourceBytes||originalBytes).slice();
    const pdf = await window.pdfjsLib.getDocument(Object.assign({data:data,stopAtErrors:false},opts||{})).promise;
    const positionedText=[];
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i);
      const content=await page.getTextContent({normalizeWhitespace:true,disableCombineTextItems:false});
      content.items.forEach(item=>{
        // v33: keep the page index. Without it buildLinesFromPositioned sorted
        // every page's items together by y and scrambled multi-page invoices.
        if(item.str&&item.str.trim()) positionedText.push({text:item.str,page:i,x:Math.round(item.transform[4]),y:Math.round(item.transform[5])});
      });
    }
    try{await pdf.destroy()}catch(_e){}
    return positionedText;
  }

  let positionedText=[],firstError=null;
  try{
    positionedText=await readWithPdfJs({});
  }catch(e1){
    firstError=e1;
    console.warn('[PDF Parser] standard PDF.js read failed; retrying conservative mode',e1);
    try{
      positionedText=await readWithPdfJs({disableFontFace:true,useWorkerFetch:false,isEvalSupported:false});
    }catch(e2){
      console.warn('[PDF Parser] conservative PDF.js read failed; using raw fallback',e2);
    }
  }

  // v33.1: if PDF.js could read the text layer at all, whatever it parsed WINS.
  // v33.0 gated this on "invoiceNumber AND amount", which sent every parse with
  // a missing amount down to the raw-byte scraper — and that scraper then beat
  // the real text layer, wiping customerName, customerEmail, serviceDate,
  // serviceDescription and the Auth.net paid/QB-pending flags. The repair tier
  // exists for PDFs PDF.js cannot READ, not for documents that simply lack a
  // field. A missing amount is flagged (_amountNeedsReview), never a reason to
  // throw away a good parse.
  if(positionedText.length){
    const lines=buildLinesFromPositioned(positionedText);
    const result=parseInvoiceFromLines(lines,positionedText)||{};
    const fields=Object.keys(result).filter(k=>!k.startsWith('_'));
    if(fields.length)return result;
  }

  // v32 — structural repair pass.
  // Some Aspen/QB exports open in Chrome but have a damaged xref/object table
  // that PDF.js rejects as "Invalid PDF structure". PDF-Lib can often rebuild
  // the document; if successful we parse AND store the repaired bytes.
  if(window.PDFLib && window.PDFLib.PDFDocument){
    try{
      console.log('[PDF Parser] attempting structural repair with PDF-Lib');
      const repairedDoc=await window.PDFLib.PDFDocument.load(originalBytes,{
        ignoreEncryption:true,
        throwOnInvalidObject:false,
        updateMetadata:false
      });
      const repairedBytes=await repairedDoc.save({
        useObjectStreams:false,
        addDefaultPage:false,
        updateFieldAppearances:false
      });
      const repairedText=await readWithPdfJs({
        disableFontFace:true,
        useWorkerFetch:false,
        isEvalSupported:false
      },repairedBytes);

      if(repairedText.length){
        const repairedLines=buildLinesFromPositioned(repairedText);
        const repairedResult=parseInvoiceFromLines(repairedLines,repairedText)||{};
        const repairedFields=Object.keys(repairedResult).filter(k=>!k.startsWith('_'));
        if(repairedFields.length){
          repairedResult._pdfRepaired=true;
          repairedResult._fallbackUsed=false;
          // Persist the same repaired PDF that we successfully parsed. v33.1
          // restores this to the v32 behaviour: if the repair recovered ANY
          // field, the repaired bytes are what we keep — otherwise we would
          // store and email a PDF that no reader in the chain could open.
          try{
            const cleanBuffer=repairedBytes.buffer.slice(
              repairedBytes.byteOffset,
              repairedBytes.byteOffset+repairedBytes.byteLength
            );
            currentPdfBase64=await arrayBufferToBase64(cleanBuffer);
            currentPdfSize=repairedBytes.byteLength;
          }catch(_saveRepairErr){console.warn('[PDF Parser] repaired bytes parsed but could not replace stored bytes',_saveRepairErr)}
          return repairedResult;
        }
      }
    }catch(repairErr){
      console.warn('[PDF Parser] PDF-Lib repair did not recover this file',repairErr);
    }
  }

  // IMPORTANT: fallback gets a fresh, non-detached byte copy.
  const fallbackBuffer=originalBytes.buffer.slice(originalBytes.byteOffset,originalBytes.byteOffset+originalBytes.byteLength);
  const fb=_pf31FallbackPdfFields(fallbackBuffer,currentPdfFilename);
  const fbFields=Object.keys(fb).filter(k=>!k.startsWith('_'));
  if(fbFields.length){
    fb._fallbackUsed=true;
    if(firstError)fb._error='PDF.js could not read the internal structure; resilient fallback recovered '+fbFields.length+' field(s).';
    return fb;
  }
  return {_error:'PDF attached, but its text layer is not readable by the browser parser. Remove it and re-upload, or complete the missing fields manually.',_fallbackUsed:true};
}

function buildLinesFromPositioned(items) {
  if (!items || items.length === 0) return [];
  // Sort por y descendente (PDF coords: y crece hacia arriba)
  // v33: order by PAGE first, then y descending. Sorting every page's items
  // together put page 2's header above page 1's total, so "last $ on the page"
  // heuristics picked a value from the wrong page. Single-page PDFs are
  // unaffected — every item reports page 1.
  const sorted = [...items].sort((a, b) => ((a.page || 1) - (b.page || 1)) || (b.y - a.y));
  const Y_TOL = 4;
  const lines = [];
  let currentLine = [];
  let currentY = null;
  let currentPage = null;

  for (const item of sorted) {
    const itemPage = item.page || 1;
    if (currentY === null || (itemPage === currentPage && Math.abs(item.y - currentY) <= Y_TOL)) {
      currentLine.push(item);
      if (currentY === null) { currentY = item.y; currentPage = itemPage; }
    } else {
      currentLine.sort((a, b) => a.x - b.x);
      lines.push({
        y: currentY,
        page: currentPage,
        items: currentLine,
        text: currentLine.map(i => i.text).join(' ').trim()
      });
      currentLine = [item];
      currentY = item.y;
      currentPage = itemPage;
    }
  }
  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.x - b.x);
    lines.push({
      y: currentY,
      page: currentPage,
      items: currentLine,
      text: currentLine.map(i => i.text).join(' ').trim()
    });
  }
  
  return lines.filter(l => l.text.length > 0);
}


/* v30 — Aspen Spas Sales Order parser.
   Real Aspen PDFs may be titled "Sales Order" and use "S.O. No." instead of
   "Invoice No.". Treat the S.O. number as the tracking/invoice number used by
   Payment Follow-up, and parse the final Total + item descriptions directly. */
function _isAspenSalesOrderPdf(joined){
  return /\bSales\s+Order\b/i.test(joined||'') && /S\.?\s*O\.?\s*No\.?/i.test(joined||'');
}
function _soCleanItemDescription(line){
  let s=String(line||'').replace(/\s+/g,' ').trim();
  if(!s)return'';
  if(/ILL\s+Retail\s+Sale|sales?\s+tax|tax\b/i.test(s))return'';
  if(/^(?:Item|Description|Qty\.?|Amount|P\.O\.|Total|SIGNATURE|QUOTES\s+VALID)/i.test(s))return'';
  // Remove trailing Qty + Amount (e.g. "... 2 200.00").
  s=s.replace(/\s+\d+(?:\.\d+)?\s+\$?[\d,]+\.\d{2}\s*$/,'').trim();
  // QuickBooks sometimes truncates the item name then inserts "..." before description.
  if(s.includes('...')) s=s.split('...').slice(1).join('...').trim();
  else {
    // Product-code layouts: "gecko-control - 300 in.k300 Topside control"
    // or "gecko-pack in.ye-3 Spa pack IN.YE-3".
    let m=s.match(/^\S+(?:\s*-\s*\S+)?\s+((?:in\.[\w.-]+\s+)?[A-Z][A-Za-z0-9 .()\/&+\-]+)$/i);
    if(m&&m[1])s=m[1].trim();
  }
  return s.replace(/^[-–—·\s]+|[-–—·\s]+$/g,'').trim();
}
function _parseAspenSalesOrder(lines, joinedIn){
  const result={}, joined=String(joinedIn||lines.map(l=>l.text).join(' '));
  const texts=lines.map(l=>String(l.text||'').replace(/\s+/g,' ').trim()).filter(Boolean);

  // S.O. No. can be same line or immediately below the header.
  let m=joined.match(/S\.?\s*O\.?\s*No\.?\s*[:#\-]?\s*(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s+)?(\d{4,10})\b/i);
  if(m) result.invoiceNumber=m[1];
  if(!result.invoiceNumber){
    for(let i=0;i<texts.length;i++){
      if(/S\.?\s*O\.?\s*No\.?/i.test(texts[i])){
        const same=texts[i].match(/\b(\d{4,10})\b/);
        if(same){result.invoiceNumber=same[1];break;}
        for(let j=i+1;j<Math.min(i+4,texts.length);j++){
          // v33: the value row is often "<date> <number>", not a bare number.
          const n=texts[j].match(/^\s*(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s+)?(\d{4,10})\s*$/);
          // v33.1: same year guard _parseQbInvoice already had — "01/01/2020 2020"
          // must not hand back 2020 as the S.O. number.
          if(n&&!(n[1].length===4&&+n[1]>=1990&&+n[1]<=2100)){result.invoiceNumber=n[1];break;}
        }
      }
      if(result.invoiceNumber)break;
    }
  }

  // Sales Order date = service/order date for tracking unless user overwrites it.
  let dm=joined.match(/\bDate\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/i);
  if(!dm) dm=joined.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/);
  if(dm) result.serviceDate=parseUSDate(dm[1]);

  // Customer: first human-name line after S.O. number/value, before addresses.
  let soIdx=texts.findIndex(t=>/S\.?\s*O\.?\s*No\.?/i.test(t));
  if(soIdx>=0){
    for(let i=soIdx+1;i<Math.min(texts.length,soIdx+7);i++){
      const t=texts[i];
      if(/^\d{4,10}$/.test(t)||/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(t))continue;
      if(/^(?:Terms|Sales\s+Person|Ship\s+To|Bill\s+To|SIGNATURE|Total|P\.O\.)/i.test(t))continue;
      if(/^\d+\s+/.test(t))continue; // address
      if(/[A-Za-z]/.test(t) && (/,|\s&\s|\sand\s/i.test(t))){result.customerName=t;break;}
    }
  }

  // Total: Aspen Sales Orders put the authoritative total as the LAST explicit $ value.
  const dollarMatches=[...joined.matchAll(/\$\s*([\d,]+\.\d{2})/g)];
  if(dollarMatches.length){
    // v33: positional heuristic, not an anchored read — label it so the UI can
    // ask for confirmation instead of presenting it as certain.
    result.amount=parseFloat(dollarMatches[dollarMatches.length-1][1].replace(/,/g,''));
    result._amountConfidence='low';
    result._amountReason='last_dollar_on_page';
  } else {
    // If text extraction drops the $ symbol, prefer a value after Total, otherwise last amount.
    let totalIdx=texts.findIndex(t=>/^Total$/i.test(t));
    if(totalIdx>=0){
      for(let i=totalIdx+1;i<texts.length;i++){
        const tm=texts[i].match(/^\$?\s*([\d,]+\.\d{2})\s*$/);
        if(tm){result.amount=parseFloat(tm[1].replace(/,/g,''));result._amountConfidence='high';}
      }
    }
    if(result.amount==null){result._amountNeedsReview=true;result._amountReason='no_total_anchor';}
  }

  // Service/comment = meaningful rows from Item / Description table.
  const descriptions=[];
  let tableStart=texts.findIndex(t=>/\bItem\b.*\bDescription\b.*\bQty\.?\b.*\bAmount\b/i.test(t));
  if(tableStart<0)tableStart=texts.findIndex(t=>/^Item\b/i.test(t)&&/Description/i.test(t));
  if(tableStart>=0){
    for(let i=tableStart+1;i<texts.length;i++){
      const t=texts[i];
      if(/^\$?[\d,]+\.\d{2}$/.test(t)||/^(?:SIGNATURE|Total|We appreciate|QUOTES VALID)/i.test(t))continue;
      const d=_soCleanItemDescription(t);
      if(d && /[A-Za-z]/.test(d) && !descriptions.includes(d))descriptions.push(d);
    }
  }
  if(descriptions.length) result.serviceDescription=descriptions.slice(0,6).join(' · ').slice(0,500);

  result._salesOrder=true;
  return result;
}

function parseInvoiceFromLines(lines, allItems) {
  const joined = lines.map(l => l.text).join(' ');

  // Original Aspen parser first.
  let result;
  if (_isAspenSalesOrderPdf(joined)) {
    console.log('[PDF Parser] Detected Aspen Sales Order format');
    result = _parseAspenSalesOrder(lines, joined);
  } else if (_isAuthNetPdf(joined)) {
    console.log('[PDF Parser] Detected payment-processor format');
    result = _parseAuthNetInvoice(lines, joined);
  } else {
    console.log('[PDF Parser] Detected QuickBooks Desktop format');
    result = _parseQbInvoice(lines, allItems, joined);
  }
  result = result || {};

  // V15: additional invoice-number patterns only.
  // This does not change customer/amount/email parsing that already works.
  if (!result.invoiceNumber) {
    const patterns = [
      /\bInvoice\s*(?:Number|No\.?|#)\s*[:#\-]?\s*(\d{4,10})\b/i,
      /\bInv(?:oice)?\s*#\s*(\d{4,10})\b/i,
      /\bInvoice\s+(\d{4,10})\b/i
    ];
    for (const rx of patterns) {
      const m = joined.match(rx);
      if (m && m[1]) { result.invoiceNumber = m[1]; break; }
    }
  }

  // Header + nearby line fallback.
  if (!result.invoiceNumber) {
    for (let i = 0; i < lines.length; i++) {
      const txt = String(lines[i].text || '');
      if (/Invoice\s*(?:No\.?|Number|#)/i.test(txt)) {
        const nearby = [txt, ...lines.slice(i + 1, i + 4).map(x => String(x.text || ''))];
        for (const c of nearby) {
          const nums = c.match(/\b\d{4,10}\b/g) || [];
          const candidate = nums.find(n => {
            const v = Number(n);
            return !(n.length === 4 && v >= 1990 && v <= 2100);
          });
          if (candidate) { result.invoiceNumber = candidate; break; }
        }
      }
      if (result.invoiceNumber) break;
    }
  }

  console.log('[PDF Parser] Parsed invoice:', result.invoiceNumber || '(not found)');
  return result;
}

function _isAuthNetPdf(joined) {
  // High-confidence markers — any one of these strongly indicates Auth.net
  if (/Partial\s+Payment\s+Allowed/i.test(joined)) return true;
  if (/Authorize\.?\s*net/i.test(joined)) return true;
  // Fallback combo — colon-delimited Invoice Number + Status field is the Auth.net signature
  // (QB uses "Invoice No." with period, not "Invoice Number:" with colon)
  if (/Invoice\s+Number\s*:/i.test(joined) &&
      /Status\s*:\s*(Paid|Unpaid|Overdue)\b/i.test(joined)) return true;
  return false;
}

// Parse "May 28, 2026" → "2026-05-28" (Auth.net uses long-form English dates)
function _parseTextDate(s) {
  const months = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
  const m = s.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (!m) return '';
  const mo = months[m[1].toLowerCase().slice(0, 3)];
  if (!mo) return '';
  return `${m[3]}-${String(mo).padStart(2,'0')}-${m[2].padStart(2,'0')}`;
}

function _parseAuthNetInvoice(lines, joined) {
  const result = {};

  // ───────── INVOICE NUMBER ─────────
  const invM = joined.match(/Invoice\s+Number\s*:\s*(\d{1,10})/i);
  if (invM) result.invoiceNumber = invM[1];

  // ───────── STATUS (Paid / Unpaid / Overdue) ─────────
  // Drives the auto-paid + QB-pending flagging downstream
  const statusM = joined.match(/Status\s*:\s*(Paid|Unpaid|Overdue)\b/i);
  const authStatus = statusM ? statusM[1].toLowerCase() : null;

  // ───────── INVOICE DATE ─────────
  // Used as paidAt when status=Paid (Auth.net doesn't expose payment timestamp in PDF)
  const dateM = joined.match(/Invoice\s+Date\s*:\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (dateM) result.serviceDate = _parseTextDate(dateM[1]);

  // ───────── CUSTOMER NAME (Bill To: <name> on same line) ─────────
  // Format: "Bill To: Heather Costello" — capture until newline or "Email" / "Phone" boundary
  // PDFs concatenate lines with spaces when extracted, so we also stop at known section headers
  const billM = joined.match(/Bill\s+To\s*:\s*([^\n]+?)(?=\s+(?:Email|Phone|Address|Details|Item|Total|$))/i);
  if (billM) result.customerName = billM[1].trim().replace(/\s+/g, ' ');

  // ───────── EMAIL ─────────
  const emailM = joined.match(/Email\s*:\s*([\w._+\-]+@[\w.\-]+\.\w{2,})/i);
  if (emailM) result.customerEmail = emailM[1];

  // ───────── TOTAL AMOUNT ─────────
  // Auth.net format: "Total: $492.33 USD" — explicit USD suffix
  let totalM = joined.match(/Total\s*:\s*\$?\s*([\d,]+\.\d{2})\s*USD/i);
  if (!totalM) totalM = joined.match(/Total\s*:\s*\$?\s*([\d,]+\.\d{2})/i);
  if (totalM) result.amount = parseFloat(totalM[1].replace(/,/g, ''));

  // ───────── FLAGS for downstream auto-fill ─────────
  // Only auto-mark paid when Auth.net explicitly says so. Unpaid/Overdue stay pending.
  if (authStatus === 'paid') {
    result._setStatus = 'paid';
    result._setPaymentMethod = 'auth_net';
    result._setQbSynced = false;  // ← the whole point: needs to be entered in QB Desktop
    if (result.serviceDate) {
      result._setPaidAt = new Date(result.serviceDate + 'T12:00:00').getTime();
    } else {
      result._setPaidAt = Date.now();
    }
    result._authBanner = 'paid';
  } else if (authStatus === 'overdue') {
    result._authBanner = 'overdue';
  } else if (authStatus === 'unpaid') {
    result._authBanner = 'unpaid';
  }

  return result;
}

function _parseQbInvoice(lines, allItems, joinedIn) {
  const result = {};
  const joined = joinedIn || lines.map(l => l.text).join(' ');
  const lineTexts = lines.map(l => l.text);
  
  // ───────── INVOICE NUMBER ─────────
  // QBD layout: "Invoice No." puede estar en la misma línea con la fecha intermedia,
  // o en línea separada con valores debajo. Manejar ambos casos.
  // Ejemplos reales:
  //   "Date Invoice No. 5/6/2026 271199" (mismo Y)
  //   "Invoice No." en una línea, "5/6/2026 271199" en la siguiente
  //   "Invoice No. 271199" simple
  let invMatch = joined.match(/Invoice\s*No\.?\s*[:.]?\s*(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s+)?(\d{5,8})\b/i);
  if (invMatch) {
    result.invoiceNumber = invMatch[1];
  } else {
    // Buscar línea que contenga "Invoice No." y revisar siguientes líneas por número
    for (let i = 0; i < lineTexts.length; i++) {
      if (/Invoice\s*No\.?/i.test(lineTexts[i])) {
        // Probar mismo patrón en esa línea sola
        const sameLine = lineTexts[i].match(/Invoice\s*No\.?\s*[:.]?\s*(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s+)?(\d{5,8})\b/i);
        if (sameLine) { result.invoiceNumber = sameLine[1]; break; }
        // Si no, escanear siguientes 3 líneas por número largo (no año)
        for (let j = i + 1; j <= Math.min(i + 3, lineTexts.length - 1); j++) {
          const allNums = [...lineTexts[j].matchAll(/\b(\d{5,8})\b/g)].map(m => m[1]);
          for (const num of allNums) {
            const n = parseInt(num);
            if (n < 1900 || n > 2100) {  // no es un año
              result.invoiceNumber = num;
              break;
            }
          }
          if (result.invoiceNumber) break;
        }
        if (result.invoiceNumber) break;
      }
    }
  }
  
  // ───────── SERVICE DATE ─────────
  let svcMatch = joined.match(/Service\s*Date\s*[:.]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (svcMatch) {
    result.serviceDate = parseUSDate(svcMatch[1]);
  } else {
    // QBD a veces pone "Service Date" en una línea y la fecha debajo
    for (let i = 0; i < lineTexts.length; i++) {
      if (/^Service\s*Date\s*$/i.test(lineTexts[i].trim()) && i + 1 < lineTexts.length) {
        const next = lineTexts[i + 1].trim();
        const m = next.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
        if (m) { result.serviceDate = parseUSDate(m[1]); break; }
      }
    }
  }
  
  // ───────── TOTAL (NOT Subtotal, NOT Balance Due si es $0) ─────────
  // Estrategia: buscar "Total" precedido por whitespace o inicio (NO "Subtotal")
  // y capturar el valor numérico cercano
  // Usamos la línea con "Total" y leemos el primer dollar value en la sección de totales
  
  let totalAmt = null;
  for (let i = 0; i < lineTexts.length; i++) {
    const line = lineTexts[i].trim();
    // "Total $158.72" en una línea
    let m = line.match(/(?:^|\s)Total\s+\$?\s*([\d,]+\.\d{2})\s*$/i);
    // v33.1: same anchor, but the amount no longer has to END the line.
    // Real QB rows look like "Total 158.72 Balance Due 158.72".
    if (!m) m = line.match(/(?:^|\s)Total\s*:?\s+\$?\s*([\d,]+\.\d{2})/i);
    if (m && !/Subtotal/i.test(line)) {
      totalAmt = parseFloat(m[1].replace(/,/g, ''));
      break;
    }
    // Solo "Total" — buscar valor en líneas siguientes
    if (/^Total\s*$/i.test(line)) {
      for (let j = i + 1; j <= Math.min(i + 4, lineTexts.length - 1); j++) {
        const m2 = lineTexts[j].match(/\$?\s*([\d,]+\.\d{2})/);
        if (m2) {
          totalAmt = parseFloat(m2[1].replace(/,/g, ''));
          break;
        }
      }
      if (totalAmt !== null) break;
    }
  }
  
  // v33: NEVER invent an amount. The old fallback took Math.max() over every
  // dollar figure on the page, so a line item, a subtotal or a footer figure
  // could be written onto a real payment record with no warning. An empty
  // field that asks for attention beats a wrong number that doesn't.
  if (totalAmt === null) {
    result._amountNeedsReview = true;
    result._amountReason = 'no_total_anchor';
  }

  if (totalAmt !== null && totalAmt > 0) {
    result.amount = totalAmt;
    result._amountConfidence = 'high';   // anchored to a "Total" row
  }
  
  // ───────── CUSTOMER NAME (Bill To) ─────────
  // Estrategia: encontrar la línea con "Bill To:", luego buscar nombre en líneas siguientes
  // que NO sean "Ship To:", labels, ni números puros
  // Bonus: usar coordenadas X — el nombre debería estar a la izquierda (mismo X que "Bill To")
  let billToLineIdx = -1;
  let billToX = null;
  for (let i = 0; i < lines.length; i++) {
    if (/^Bill\s*To\s*:?$/i.test(lines[i].text.trim()) || /^Bill\s*To\s*:/i.test(lines[i].text.trim())) {
      billToLineIdx = i;
      // Posición X de "Bill To:" — el primer item en la línea
      billToX = lines[i].items[0]?.x;
      break;
    }
  }
  
  if (billToLineIdx >= 0) {
    const customerLines = [];
    for (let j = billToLineIdx + 1; j <= Math.min(billToLineIdx + 6, lines.length - 1); j++) {
      const line = lines[j];
      const text = line.text.trim();
      if (!text) continue;
      // Skip la línea entera si solo dice "Ship To" 
      if (/^Ship\s*To/i.test(text) && text.length < 12) continue;
      // Stop al llegar a la tabla de items
      if (/^Item\b|^Qty|^Description|^Rate|^Amount|^B\/O/i.test(text)) break;
      
      // Si la línea tiene "Ship To" mezclado con el nombre, separar por X
      // Tomar solo items cuya X es <= la X de Bill To + tolerance
      if (billToX !== null) {
        const leftItems = line.items.filter(it => it.x <= billToX + 50);
        const leftText = leftItems.map(it => it.text).join(' ').trim();
        if (leftText && !/^Ship\s*To/i.test(leftText)) {
          customerLines.push(leftText);
        }
      } else {
        customerLines.push(text);
      }
      
      if (customerLines.length >= 4) break;
    }
    
    if (customerLines.length > 0) {
      result.customerName = customerLines[0];
      if (customerLines.length > 1) {
        result.address = customerLines.slice(1).join(', ');
      }
    }
  }
  
  // ───────── SERVICE DESCRIPTION ─────────
  // Try multiple patterns to extract technician notes from QB invoice
  // Increased limit to 500 chars to fit detailed multi-sentence service notes
  
  // Pattern 1: "Services Provided: ..." (legacy QB template format)
  for (let i = 0; i < lineTexts.length; i++) {
    const m = lineTexts[i].match(/Services?\s*Provided\s*:\s*:?\s*(.+)/i);
    if (m && m[1].trim().length > 5) {
      result.serviceDescription = m[1].trim().slice(0, 500);
      break;
    }
  }
  
  // Pattern 2: ".MM/DD/YYYY: TECH performed..." (typical Aspen Spas QB note format)
  // Example: ".05/06/2026: Pedro performed Platinum Flush service and replaced the heater gaskets..."
  if (!result.serviceDescription) {
    // Combine multiple consecutive lines that look like a tech note (date prefix + multi-line continuation)
    for (let i = 0; i < lineTexts.length; i++) {
      const m = lineTexts[i].match(/^\.?\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*:?\s*(.+)/);
      if (m && m[1].trim().length > 5) {
        // Collect this line + subsequent continuation lines (until hitting another date, total, tax, or empty section)
        let combined = m[1].trim();
        for (let j = i + 1; j < Math.min(i + 5, lineTexts.length); j++) {
          const next = lineTexts[j].trim();
          if (!next) break;
          // Stop if we hit another date marker, totals, taxes, or item header
          if (/^\.?\s*\d{1,2}\/\d{1,2}\/\d{2,4}/.test(next)) break;
          if (/^(Total|Tax|Subtotal|Balance|Payment|Item|Qty|Rate|Amount|Service Date|Customer Message|Memo)/i.test(next)) break;
          // If next line starts with capital and looks like prose, append it
          if (next.length > 3 && /[a-zA-Z]/.test(next)) {
            combined += ' ' + next;
          } else {
            break;
          }
        }
        result.serviceDescription = combined.slice(0, 500);
        break;
      }
    }
  }
  
  // Pattern 3: "TECH_NAME performed ..." (without date prefix)
  // Common technician names: Jeremy, Robert, Pedro, Jarred, Fernando, Fabian, Gabriel
  if (!result.serviceDescription) {
    for (let i = 0; i < lineTexts.length; i++) {
      const m = lineTexts[i].match(/^(Jeremy|Robert|Pedro|Jarred|Fernando|Fabian|Gabriel|Neil|Dan|SV|Tech)\s+performed\s+(.+)/i);
      if (m) {
        let combined = lineTexts[i].trim();
        // Append continuation lines
        for (let j = i + 1; j < Math.min(i + 4, lineTexts.length); j++) {
          const next = lineTexts[j].trim();
          if (!next) break;
          if (/^(Total|Tax|Subtotal|Balance|Payment|Item)/i.test(next)) break;
          if (next.length > 3 && /[a-zA-Z]/.test(next)) combined += ' ' + next;
          else break;
        }
        result.serviceDescription = combined.slice(0, 500);
        break;
      }
    }
  }
  
  return result;
}

function parseUSDate(s) {
  // "5/5/2026" o "05/05/26" → "2026-05-05"
  const parts = s.split(/[\/\-]/);
  if (parts.length !== 3) return '';
  let [m, d, y] = parts;
  if (y.length === 2) y = '20' + y;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function applyExtractedFields(extracted) {
  if (extracted.invoiceNumber && !document.getElementById('fInvoiceNumber').value) {
    document.getElementById('fInvoiceNumber').value = extracted.invoiceNumber;
  }
  if (extracted.amount && !document.getElementById('fAmount').value) {
    document.getElementById('fAmount').value = extracted.amount;
  }
  if (extracted.customerName && !document.getElementById('fCustomerName').value) {
    document.getElementById('fCustomerName').value = extracted.customerName;
    // Si ese cliente ya existe, autocompletar email
    const existing = findCustomerByName(extracted.customerName);
    if (existing) {
      if (existing.email) document.getElementById('fCustomerEmail').value = existing.email;
      if (existing.phone) document.getElementById('fCustomerPhone').value = existing.phone;
      if (existing.greetingName) document.getElementById('fGreetingName').value = existing.greetingName;
      if (existing.spaModel && !document.getElementById('fSpaModel').value) document.getElementById('fSpaModel').value = existing.spaModel;
      if (existing.serialNumber && !document.getElementById('fSerial').value) document.getElementById('fSerial').value = existing.serialNumber;
    }
  }
  // Auth.net PDFs include the customer email directly — apply it if the form is empty
  if (extracted.customerEmail && !document.getElementById('fCustomerEmail').value) {
    document.getElementById('fCustomerEmail').value = extracted.customerEmail;
  }
  if (extracted.serviceDate && !document.getElementById('fServiceDate').value) {
    document.getElementById('fServiceDate').value = extracted.serviceDate;
  }
  if (extracted.serviceDescription && !document.getElementById('fServiceDesc').value) {
    document.getElementById('fServiceDesc').value = extracted.serviceDescription;
  }
  // ─── AUTH.NET FLAGS — stash for saveInvoice to merge into the new record ───
  // These don't have visible form fields; they apply at save time.
  if (extracted._setStatus) currentExtractedStatus = extracted._setStatus;
  if (extracted._setPaymentMethod) currentExtractedPaymentMethod = extracted._setPaymentMethod;
  if (extracted._setQbSynced !== undefined) currentExtractedQbSynced = extracted._setQbSynced;
  if (extracted._setPaidAt) currentExtractedPaidAt = extracted._setPaidAt;
}

// ════════════════════════════════════════════════════════════
// EMAIL HTML BODY (FORMATO BONITO)
// ════════════════════════════════════════════════════════════
// Aspen logo, embedded via CID (Content-ID) so Outlook renders it inline in
// the email body instead of dropping a data: URI. Attached by buildEmlFile().
const LOGO_CID = 'aspenlogo@aspenspas.com';
const ASPEN_LOGO_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAlgAAAEHCAYAAAByVjhjAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAI/tJ' +
  'REFUeNrs3TFy28iex/G2y/lwTjBwzQGGihwa2mRDSycQGWzkQNIJJJ1AVDDRBqJOYDrcZEWHE4lzAJcxJxjtCd7iL/7xBpYlsQF0' +
  'A92N76eKpXrzZAoEG90/dDe6jQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAsHz9+C7n' +
  'LGAIrzkFAICE5WXImnEaQMACAMCdn8rXGacBBCwAANzJy1f29eO7A04FCFgAAHRUhqqs/DHV/3nMGQEBCwCA7uq9VjkT3kHAAgCg' +
  'u8e9VkecEhCwAABo6evHdyflj+zRf57psCFAwAIAoGG4mpjnnxyccYZAwAIAoLnr8jV55v9jmBAELAAAmvj68d25+X5y+2MZC4+C' +
  'gAUAgH24kuBks6joB84WfHvFKQAAJBKurhv8k7e//v5HwZmDL/RgAQBiD1eXDcOVmHHm4NMbTgEAINJglWmwylv8c5nsfs5ZhC/0' +
  'YAEAYgxXss7VXctwJWSy+5QzCV/owQIAxBSsJFDJkKCLcCQrvc85qyBgAQDGHKzkCcHc4dseELDgC08RAgBCDVUTDUHS0+RrOO/w' +
  '19//WHG24Ro9WACA0IKVhKoPGq4mnv+c/B0CFghYAIDkAlXVUyVhJ+8hVNUxTAgvGCIEAAwRqjINN7JcwtBP8+3/+vsfa74VuEQP' +
  'FgBgjKGqTnrOCFggYAEAoglVfUxU70qO75RvCy4xRAgA8BGscrPtqZpFcsjsTQin6MECALgKVRMNVNJblUV2+NKLteBbBAELABBK' +
  'sJpqqJpF/DHeE7BAwAIAhBCscuN+dfWh5HyjcIk5WACApsFqpsEqS+yj7f36+x8bvmG4QA8WAGDswaoi87AIWCBgAQB6CVZ5+eM6' +
  '4WBV+Y1vGwQsAEAfwSqVOVY2cr51uMIcLADA42CVabCajfDjMw8LTrzmFAAAauHqvPxxN9JwJaaUArjAECEAoFrL6pqAwTwsuEEP' +
  'FgAQrs7NtteK3hvOARyhBwsAxhus6LX6Uc4pgAv0YAHAOMPVSfnjlnD15LnJOAvoih4sABhXeJANmS/NeCex25CAVXAa0AU9WAAw' +
  'nnAlweGWcLUTvXrojB4sABhHuJpquJpwNnbiHKEzerAAIP1wNTPbpwQJDnbecwpAwAIA7ApX15wJgIAFACBcDSnnFICABQAYe7i6' +
  '5xsHAQsAQLhyRzZmXns4h8xXAwELAPDvYDA14+q5uihfBx7em6UaQMACAHy3FMNYHJavD3zzIGABAHyFKxnSkp6rsQxtzfXnjG8f' +
  'BCwAgC9j2rR5/uvvfyzNdssfgIAFAHDv68d358bPPKRgw5V+ZuZJgYAFAPASrvLyx9nIwtV0RJ8ZkWIvQgCIN1zJfKtPI/io8rTg' +
  'YRmu1rW5ZkDQ6MECgHiNYVK7rHO1L+Gq9pkZGgQBCwDg3teP705M+vOuVhquNvqZL8145pohcgwRAkB84Up6rVKeg/SwgGgZrBa1' +
  'zzwrf5zw7YOABQDwJeWhwbXZTmYvHoUr5l2BgAUA8EOfGkxxmOyHXquBw9WG0gYCFgCMR4o9OcvydVqGq/tAwpV5fCwAAQsAEqWL' +
  'a2YJfaS12fZarZ/4rIOFK7PtTQMIWAAwgnAlc66OUw9W+lnlacEhJ7QzPAgCFgCMhASO2Ce27wpW1SKiQ88xKyhuIGABQOIS6L2S' +
  '9ayungtW+hmnJpxFRP+i1IGABQDpi7H36l6D1UV9yYVnwtWs/HEZ0GdcU+TQ1StOAQCES3uvvkUUsGT+0pWEq11P4ulnk2A1C+kD' +
  'lMdN24jO6MECgLDF0HtV9VZdVdvaWATH3GyHBLMAAyJAwAKAxB0FfGzr8nVjLHqrasGq2ubnJODPBBCwACBVOjcpC+ywCg1Vy11z' +
  'q574PPJ0YOjb/Hyh5IGABQBp+xDIcVRDgDcvPQn4QrCSJwNlrlUe+gkvP9+KYgcCFgAkqgwlmRl+PSgJG5/L0LHs8BlkOHAWyWkn' +
  'XIGABQCJGypcFablEGAtWMkQoMyxkrW7Ylpe4jPFDgQsAEhb35Pbl6blEGACwapCDxYIWACQKh1a62NF88J07K2qHa+EqpmJdzuf' +
  'pe2TkAABCwDi5Ht4UMLURdu5VbVgNa0Fq9jdUOxAwAKAtPkaHlybFzZbbhCsZnqMeSLnu+h6TgACFgAETOcxuR4eLMrXvOP8qqmG' +
  'KglXk8RO+wUlDwQsAEhb7vC9ZE7RaYdlFiYaqI5MP3PChlB0HSoFCFgAEL73jt5nYbbDgY0nbusQoCxyejCC803vFQhYADACecd/' +
  'X5gWw4GJPAnY+FzRewUCFgAkzsH8q5WGq/sGf1OCVUyrrbs0p9SBgAUA6esSrmSu1aJhmDvRcDVGK54cBAELAMYhb/FvpLdq3mST' +
  'Yn0i8FP5ykZ6nh8m/1Pc4NNrTgEABOOXFkFhv2G4mpU/bkccrsRpl5XrARv0YAFAOJqEnipcbRqGq+uRn+MVE9vRB3qwACAceYPf' +
  'PWwYrqaEKyPni4ntIGABwFjopHNbbVZl/zTyU1zNVWNDZxCwAGBEbJ8gXDYd4tKhwWzk57fRcCpAwAKA8diUIaHNENeHkZ+3OeEK' +
  'BCwAGKfcJih4fO+Uw9WS4gUCFgDgKRcdemEmIz1nhCsMhmUaACB8smfeOafBWuMlLADX6MECgDC8f+H/67rq+JiCxoZwBQIWAGCX' +
  'dZOV2p97j5GcqxXhCqFgiBAAwnbh4D2uzHZj51Q97C3IfCuEhB4sAAhX0WJB0R/ovnuLRM+RnJ89whVCQw8WAITrwvF75cZ+QdPg' +
  'w6fZ9lqtKCYIET1YABAmGfZyFh50i5h9E/+E92o48C3hCgQsAEBTK9f75tVCVozBpDDbpyklWC0oHggdQ4QAEKbPPt5UQ9bh14/v' +
  '8vLnmQl/lfd1+bphjhVi84pTAADDKwPPbS3s3JeB4uee/q78zaPyNQvodBRm28t2pRP0gejQgwUA4eltCE+fUlyXQUuG3w7MdmNo' +
  'CV19b68jc8Ok127FOlYgYAEAXKnPt/rS9x/XocOlvqqeLXnJCvNTx4HrXgPVF/25dj3fDCBgAQDEn2bbgyTWQx9M1bNV/e8ycGUa' +
  'tOT1mwauTF9PWT8RGOW/FQz7gYAFAOhbkAFEj0leLI0AWGCZBgAIC/OPAAIWAMCRtf78k1MBELAAAG7RgwUQsAAAjoMVT9MBAAC4' +
  '8vXju39xFoA00IMFAOFgeBAgYAEAHFtzCoA0sA7WCP3Xf/5HZraLA+b6n34y28UD64ry9Vftrvr+v//nf6n8Ab9uerj+J+afBUMn' +
  'z1z/cs3/Xy30FeX1X/D1wHHb84v5caHaalHaarX/TVn2opyXyGbP4yjUU/PPlhe56bblxcb8s8XFKtaCD4ysDqjvMZi1fJt7DVuf' +
  'ufbRIFAdOGh7iqrsleUumoVuX43sy5Yv91OLf/ql/FLPI/yss/J13KFCtbHSQr9seZy3A5+q6k690Lv0tafv4zb266c8N/sDfcbD' +
  'IRrz8vNcmh97dpo4LY97M2AdMNXr/8D42bhZrvmbrtdMeZxSTx31dFq+27InpF658jxc76irZRThMJL2p/pOcw9vL3XBlZS/0HtV' +
  'xxawJCSdtfxC38Zwx6Z3DGcarvpUFfpFk/NUHm+IT01ttAL+4upuKdDP2TRgvRroM0qZOh3gWrrt2EDsDzGsrsHq0lPj9pR1lzDZ' +
  'oV52VW899IyYAXvl9Du7C7VMNQxWZ55v6usumrY5fRrbJPe2d0mTAQJL04I90Yrq20DHOtEL65seR8yksjspX5/Kz/K33FmWr9xg' +
  'KCfaAGF3HXCpDXWf5VX+1l2k173UW9LDJ71Hcq1/GuhaP3b8e70HRL0h2dUL59qZlr0g6+fRBCxN1lkPF8AQny3XSvUsgMN5CFrl' +
  'Md0l0ihW4fpWKhCC1mAuOQUvN3BaB5wMeBjVdT+J+FQe6LX+ra9rvTadw+r4dJQitLa171Bfl+l3FlwdMaYerK5j/JlOFA2tYpW7' +
  'xtue7xpsTPXO4iShMpTrhfwp8kYkynOfWFly3cCFUgdU133sN1dZj9d603I9C6jsSY/VdSCHc6LHQ8DquRDkjtL1cWCfSwrTWeCn' +
  '/zK0Qu/oLvcbvVm9OyPYPhmu5PoK6bxU4WSa0LXu87Mce/59n+3PLLDvaxZSezOWHixXT6jkoVQagRbuMZloI8J30O85Z6jwnzpg' +
  '2rH3oJrgvTDbycL1lzzcsXFwfUwSutanHr7DWYtwPBm63tHhuC7HUGjZu3jitdb/v0vICqKeSH6hUR2vdlkY5e5hTriyJk/mzBMu' +
  'YjIB3rRdpgKtKs+bsS96q8GlzbIYEppkMdO1zVN/+neqNbQOWlz7qayVVYWsfcdLb7QdgZB2aDlQ2ZNy0Ga4/mFJH9tyUVtDq+lS' +
  'Q/LeXwhYPVXIHir40wEf551FFK42Q4fRnsgw6GbINY9GRu5O90Z+DpoOCz70FjQNplrPSUO+1Abv0jJozR3fdJyabj1qmb5k5fBq' +
  'Ffs2IUvmZO25qP91ikHW8p/LU3t53zcaGrib9poutewVDcue/L70ri4aLP8g38t+KHXxGAKWj/FqSe/nA4SrqoKLJVztj2S156rS' +
  'GXuj3xdpXM5jW/zXYT2Qm2a9SXJDuOj6d7XBO9TG7vKZgHevf2/p+GNvXIaJWs9c0zWbMv03LtZl69o2HZn+9668bBDsH8qLi7Aj' +
  '5an8zlb692extDlJz8FqOb49VGhzXbiHVIwoXH3X6JN9+rtxCu1x9R7ZDivJ9bfnIlw9buzk+tb3f6r3YBn6CZS6SY6zfL012172' +
  'JnXVSdeyVxv+6mLW5zXQcLrNRsvexvF3NjdPj4qsQ2xzUp/k7isI9T7JsMVd61DuzUBbmwTS6POUWz9GOeG9tq+oDW9DJfq++z4b' +
  '1B7DlgTCt6bZEGTXp7dt/r3N8fTZDjUJV97Cjn5fF7X/JEE5yBv6ZAOWBpKQHq2N7e+1DVf7I56LNIkkBKfiYIRLZdg+EX3h+zrU' +
  '9z+tNahFrCdVG+f9BiGr9XVeG558SWHshiGPAyx7c99hR6cHrLWcBzvPN+UeLN+bh057XOk389Rwr/VOYP+Jl1zcS9PscdkhwtW6' +
  'wYsgnJ7rkfUa2tQDcs0u+jgYGX4sX3sp9FjrZzg0dsOFkw4LT5+Y3VM9qgcSCovjmPXQBklnRWbxq8u+2gDttToPuUwlOcndw9IM' +
  'L4W4Phpul+HKdlPm9aOL63jHOZ0P0XMlF1nLykJeH4z74CrBO4v5bj4ymRnooZMB6rWJZSO3GukQvYv6pCjPs9SPNkN478126QHX' +
  'N//3tfeVY7m0eL+l51Nj25lwRSlKPGCZ/salZZLhRQ+N6QdH77MyLbpvNTjN5bOa7dNy+RPhahlL4dDPI6+lNlonGiBd9YTkHiq8' +
  '/bGv/fQCWeF9OYJQazvl4YYi0cnCMmA1noJiuSfuslZHLy0C1sMC2J5vcH+x+J2CpWq+l9wQoTaYfQ7T9PG3cgfvIRdtp8nn0oBp' +
  'j1F9bsBFzIts6pMp0vvRZP7FLr9RtfTuegSfcWpZpmnkOtYJxq5nqk29bNNeXD06lqWj9/Vd9ih3qQcssx3y6XNOxsznHBBH87wK' +
  '42bdluqilzu8uYa280QqVakcbOdfOL+zRfebkBFsWzSxvNbR3Z+e6vJddcPqiZ5Ymx7JWQBzEf+k2KQfsPre/Nj3k2MuLpor13My' +
  'dA2ZpFZp14rNRRDNqFoGcckyGQQsR9aWoalJebN58OrmiXppbfm9nvC1EbC86bj1QKihzkVvCF23DYIjAStakwFusEJD2euXVf1s' +
  '+eCVTMF4bmjSZvL4EV8HAcunoR6RzwJfj4cnijzcvSJIJ/qUKAELsbVNL4Uomxu/bOBhcuaephqwHKwV1TWEhHznzOrizRScgqiD' +
  '7fWYT+LIA2bfNhbfh9S/u4LPi5PZG0x2H7IXi3KXasAy3XqvpPB2nU+UB7w3Wk5R7zVso525o3Mva5GlOB/FNoAyVNRTnWk5t3Vm' +
  'cZNrs3aZzWT33FPAtvmc2Qh3Vkg/YFneIbxkqWPfqfZisUced2LB04cMXC1UeJZgmbetn2Zc75395vD7sLn5v7C4PiRgF547G55j' +
  '+4TgGUUnsYBlui/NUFXqy67H4aFiKxy8hxzTNcWdgBVByDp3WOYvEzs3G8tGneu9+w17bvGrNsOD0jZlO35t3WCRXJsbEB/t0Nry' +
  '98awXMroAlaX1Fwv3F3vnrv2pPkKWNVFd8udrVWF2PUcMcTYjavlP2YJDlmsG1zvhKx2TizrgC8Wv2PTm9Rk5f2lRf3ivB1quIvE' +
  'NSErkYBleYdgVbg1aK07HpLr7lmXSyxIY/OtPGfnBC0vYd3HdzY6WpkvHb1daiGjSWMsAfMT13qj9iRrUIevd7zX1OzuCSuaLA3T' +
  'YJV5H8OETa7J60TnQY4rYJnuk9tXHSqwpzh9VFYvKJcNdrVWkAStS544+q5ClMbYxfkoOJudnRo3PYFyPZ4nFD5XDcvXgV7r9Cjs' +
  'vv6lbvxkLFfMt+jVcd17VbmyLPeuF8BueqyXOmoy2jbmTeQXRGa6PSH3w5MbcjchwcN0GyZyvbv5jXE/L6ja5FjWDZIA91nPx+h6' +
  'X7RivTbuVuT3sWWEVFRDnaLeN5qW61I3F3cxj+o4sc2gq03Xm1zr0qMgN1ZR7x3quQ64NY421LZcWFQsWlwbG62zdx3rsbHr7bL9' +
  'u+vy764btrnyu3dy/ZntjiKjal9i78HqOpzz3J1A1wrI9aOyK8/ncarnUi4Eudu99nD3E2KlOtUw/c243e5obeCiQpfGx0WFnNSE' +
  'dw1Ibc5LpkGrmiaQUcoe6oGZ1gG2dfa9RTCyCVfLDluY2fRi+Vg6qO1SKjNtX27H1Jv6JuKLousegJsX0rQU3q7jx8fG0WRdufPW' +
  'O4A+CmZ15zXTHhMJd1Xv1n2A5eC84T/5SSvSqfGzAGsxxl5Aj+QaunPwPjLp++CFrUhic6jnZdLyGpcbKlnKIujru4f249g0Hx2w' +
  '2dvV1/Bg/abbZqTlzLh7aKRqi2T4vu3cxlyD32XVtiR0Tf7gVcQXyEnHu9JTvUN+7v1vTfcFOn92VWlphfDNDLsqe3VBLB1+j/9K' +
  '7JpalOfnNLHPaTVE2PUzln/j1TPve2ncbGRblK8922vSQR3gdWhVe8nvXF/ffYctvUnaNRoh11SXG5eJBqmf9DttO8IgN+Z7Oz7P' +
  'zCKA7Hwfi/N2bexWiH/r+vu0/Nu27lMNWzHPwer6lMSukHDjIGBJo3Du4sPqnBS5E/k04Dk/0J4AafCuNEywJMGju1tOgXMXxm41' +
  '7F0yl9fk0HQuzr6xn5htdX2b7TBiaD1bIQzxynk4tPi9s57qiSuLkFMt2bBwXPbmOsLhImRVxyijJkmFrSjnYDlYmmHn2Lf20nSt' +
  'WI4dF+qV6wulwwVRPYnIkg/fl6uC0+A8SLjYyurfjV9Kc4+0h0xCluty9xC0ytffutTDwciLoZTB/V3Xt667tqt83bsYBdCpCDa9' +
  'eseeyt7c4XX5OGxJmfs79ifdY53k3rXA2I59d03QE9cT+nT4aRnI91APWlTAFttdoNPNxdrR210ndm6kkd3zePN1UGvwxnhDtdFw' +
  'ZRNm+uq9avJe3vYI1KC4Z/ys/Vc96S6T4+9inBwfXcCyXLztJUWDeREuLoRjD4Va7hpOA/paJloBj3nl6At6r7xzdbec3HYe0sun' +
  'N1/7xt9TrNUN1d/6pPEYgtbKNlw1WDZo6fj4bEZajj2WvWo+mavN2p8i7X71BGw0126MPVhdC8pVk4LjIJlPfdw96AR9H0MDXcz0' +
  'TmNsd7jLlx6YgLMyL2XdVS/hZYrlVG4ey9e+56D1cK0bnSKQaHErNFgdNpiDZtN7tXJ5I9ZgZfcD30Pj2pv1Vq9RX+1SVgtaeeiF' +
  'KKqApRVi1/TadNjPRS/Wka/K1Gy7Zy9MOPvfyZ3GmPY8XGqPIvqxMO42gz5L9STVgpbUD0tP9cPDOdSbqlRW65Y6dV6eu7dNngBt' +
  '0Db5eAjG9j2Peyh30pN6LufPbHu0fIX8TNuZoHtSY+vB6vqodpu7B9su2Bfv9nzdPVQF2nNF2iZkJbOwI+EqqODgcsL7SYKbQT8+' +
  'Xxsto1WDt/J0vce8gKSEABlelVC133ICuk3bVPhYtqPBSMuszzAi51FD/lvTfZmNZz+Tlr0gA35sAatrT9BNi0Ji2wU76N2DBMda' +
  'RXpqhh86nCU88V3KxCnharDQsHYYFC5Hcs7utcGTZQZ+9hC2qu14QgxZhYao6nWhdaSEqVcaqhYdh+5s2iafD8FcWX5HBwOUvULP' +
  '756nsDUNNWRFsw6WXrhZl4usw7oaNuuN2ASOC99ryuj7yzDKQu/Oj/SiGqIbVSrcdWJrZa00XBUGQ5JKOndQrmWO5MmY5tDp9biU' +
  'V21F8w+OGl+55o2H/Q573w/Tcdvk6kb9pXrJdmX35YBlr6i1T5mWuSPTfa/diYasvZDq5ph6sHrvvaoVCheT3Xu/e9B5GDKfQO5Y' +
  'D03/Q4gu5syFQs7dnk56JVwNHxIKhz0CZ2Ndy+2Znq2udd1lQnOybNiMTnhdsLXBSEsWyrD4o56tapmRLnXrw9PsIRWMKAKWg6UZ' +
  'jIPU7mJy4tmAhXlVC1suCrPLyidEVYUlDc7Peu7YYzCscOByM+hrzue/w1Y1lLNoeUM2mvOpYcUmTPaxRl4wk93bdGLIMiM6Of7Q' +
  'tO/tm4b0ZOurSAqxi32P1g4qYRd3ZUF1dWt4PTJutiJ5zt5z4SSQPfqq7+OLhs6N6zDl4HMGO0Ti6jM+txehRQN36+gjfHeOQ9+L' +
  'sKfvtFrs8bhF/TC3GSq03IswyHMpq9yb3SMT1ROdfRzPnWU79Tb0nngdQjxr0fZ72X+xjTeRXOAzB2+VB/KRzozf9Wka3zloL8Cp' +
  'ziU48nCuDoyfJ0geKt4WnznqRg/ff5dluV06qiPkRu4tZ/W78yuNlKzevtC6q8mT3IPO9+kpANhM++hzf9IrY9d7KNfLeeBlTwKg' +
  '7HlYfSbbDo7qpmDwzxfDJPeTxK5LWUU6C/HuQe82l9orIAU6c/TW7302sDSDo3dq3DzIIfNTznXZE/wYtOQm7E9jN5m6Op95wteo' +
  'zVBb0fOmxbaT3Y9NJJueV1tBNRzJCuLzvUmkEMdG7uzmARdo6RXY0wvVRc/AmCa8YoDGvyyvp8bNvJ9j6RHjQYbnb8LK8yPnxnZY' +
  'Vp5OTC5gNRlZ0aHm0Dzsk+vhaU+fZU96s4zleZ+EEO7fBF6IZ2aY5QV8k20LTkNevqBa0LFBgX6xsNM0oYeG38XwdjVBe5+z+uIN' +
  '2IWxe2gnT/Q02LZNmXE3EuCj82IZWdmb67zhqWXZGzRghf4U4XGiF2c0yxfoYpo8PYcYuNoAPU94kVxX9cK5sXvCMNXe6xTapmmk' +
  'OxnYXufvhz7QYANWg8dfuUD9u3D0fQI+G/2NcbgZtKHndZflGK99B4teh+Qowut8beyWGBr8O3rNFz+YLJa9u3qepAl04Wp9t8ww' +
  'd3CXzyP93Cm1Td72yfVsTcBqf4cgJ2bGhZoUhhnRx83Aw9NunImgrulkegK1Ny5P7HuMsa39K4aDfM0XPqi865YS8jSLPr4aQ8MH' +
  '9FHWVibBJ9civqZT6glM8aY4xvlkUVzfr/nCo/+sD0sp+AxZI9tXDGmQhzMI9XBZD2aJ3vxPYpmuEps3ARZi+aLHNLlUwtFFm3V3' +
  'Hi28NtNd7H2sr9V1D0WGB9EruZ50Begzzsbg1qnU1Za/dxHQMf9iedyxLdmQEbCGacxjvXDPO4SreliTgnfoakhOA2/XR9YLA/Qf' +
  'ss51bayMs+HlZng6os86MXajDcvQdgLQeWO7rgFZsmEa0Yb2UVzTryMsCCk6bnieZi/clcg5/Oaiy7d8D9mmyMXQ4xeaIwxkzinw' +
  'Jh/RDZbtVkw3AR677V6IMU3N+WDxO+uhDzK0HiwXX/CiTOG9PUWkQaZrCLHetsDy7z2sRl3+rvQGXjTdDkGD7plx97QMyzx0d1l+' +
  'LyHMKdr0eX115Xgz6CANuLepzYTv+0S2HTqzvDbWAR67lP9Li9+bNdlhRHr1hnh4SUdpbHpPBy93b0KqJEz3oagmad0V2801bcLl' +
  'csc5OmgY5jINWpd6nF+0Etg8vlC0wOZ6Z+Cy679gXzcneNCgPVebQYcWrKptfeQ63+v5b+eWZXKdwHk+MHYjK1chHr/u1Wl7kyGj' +
  'FucW50S++1uZ5zjAkKjtNKLBR05CGiJ00Xu17rsx1wTvoofmxW0LtEC37SmrtuaRf39Xvte/6q/yv/1ttpu3nnloyIOsdDAeeo1e' +
  'pPSZqgZOg+NUb6L6DnY2UliM1KZtctUO+GI7dHlk8f3PtOxJOTjrc6V+Lfczy18fPNy/DqSycLU331Dj3xc+L+RaZRrbHbhUOkua' +
  'eAQQsmSF9ySeZtUG7fbRzdBJj4/aS5jLLH93Ffm5ls9pEyCWIa/1p0OXNuX/xR1GNMhfP2qLPvXxwIPmhFvbchfCyEkoPVguuu/v' +
  'm841clh4C0dp+eDxtgW1QhXj8MYVC4wiINFPeNcHT56rD2Q6wLnnv3/d4GZ4mcD1bzscFUNPve0xHj0VbsrXJ7MdQnzsoY3yGbK0' +
  'XWzSDgbxsMHryArxixfzwJ/B1Rd6nEi4ktC5oE1HQHfxm5jLpIabXUOBMmTzSesOpw1c+bo1zUYaoh6WbTCyso5knqn0JtoE3u92' +
  'GKmFm5fmSMu5utMbANffg/zdO2M/fWUTyv65rwMoxLlxszTDoHcQ2nvm4m5tpncLVbiKdXLzKb1XCNCFiWyFd60P7hqEG2mQZKmW' +
  '865BS//2uTZweYN/ukjg4RbbsBDFPFOtj207Io71+582DDfytPOdi3lZGuql1+xTw06GYJ5yDqEHK8rJ7c9YOniPiVaQlxGHq0Uo' +
  'dxDAE43MPMJjblOPnGnQumw6fCO/r/Ntvun7NGngCpPGQwU2bVMRWV1nGwZnHcJ59YShBK3G7yM9VhqsvpnmKwssQloqY9BlGhwu' +
  'zXATUOF10UUqFdqhifPR8mVM6yRhlCFrVdY9UgnnER32ofYkNK0PJlonySR4CT4yTPqn/rx/9HvSMP6mP7OWxynveRh773WDLduu' +
  'Iiv7RYOyL2szLmRtLNPuCfbqyXeZGyjlTf7u/5kf5ytn+nrf8ZoMbo2+odfBcjH3KpjHYxsW3pdUBW5fC2gsPVlLT3shAq7N9Q45' +
  'poZR6oMuczKreuXA46EeRrTdiou2aRnhZ7uxbKOkB096hJayz63ptqD2tNaO+dgOb6PtZVAGGyLUbkMXF/oqsLslZ5PdtaLaN3E8' +
  '6ky4QlR38iayYaxafRBi75Ac036gK5k3bZtyY9eDF+VTkjpfuLAJ5DrBvPo3odbvGy17wX0XQ87Bmhk3w19XkRbeXXLdAkOWn5Dh' +
  'gcOAK9Y54QoRWpjI9snTkLVnwlrTa5NKuKpubmNsezx1BBw/attCa4eWoYaroQOWi8ntm0C7o131Yp3VCrf0Yr01YT1mLhXq3lDr' +
  'jwEdw0p0E971uGVitYSsEHrgFtrApbKIa2bsRlY2kX9m2zo7r6/NqO3Qnhl+lfRqrt885F7E1wMVYtu9nWK9g3AVOA7qT2Bob9ap' +
  'Bq0hQ81aK9V99hlE5CFLyvIq0mM/17pgNVAdIDdXqS3HktLCoi+G9AZtyNkTAV+GqqU3a4j6X24s3sbw9OZQPVgueq+C3ftJC6+L' +
  'Y3tyoTst4HLn/bPZrvnRVyFf1oLV2gBpODWRrY31qC44rN103fdYB2xSKgQN5gXfJ9JrbzvScvDUUgsScMqXlLu58d+jVWiw+llu' +
  'LGIJ9a+oW5OpHKZaOXR91PVxoZYLR3YlX7FwKBBNSHhvHG1BpnXAZ+oA7Ch7mZa5D47aoKqj4kus6yoSsNIt7FLAM339Vqtop48q' +
  '3cL80wMmP/8y20mrG4b/gCRuvDLzzxpXz9UD61qg+lPrgk1qvVTovQ2qytl7/c/Vemv1AL951P6stewR5gEAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAbv2/AAMApWZlk1zRssMAAAAASUVO' +
  'RK5CYII=';

function buildEmailHtmlBody(inv, stage) {
  stage = stage || suggestEmailStage(inv);
  const copy = getStageCopy(stage);
  const greet = inv.greetingName || deriveGreetingName(inv.customerName) || 'there';
  const dateStr = inv.serviceDate
    ? new Date(inv.serviceDate + 'T12:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
    : '—';
  const senderName = getActiveFromName();

  const status = stage === 4
    ? { label:'PAYMENT RECEIVED', orange:'#2E8B57' }
    : stage === 3
      ? { label:'FINAL NOTICE', orange:'#C0492F' }
      : stage === 2
        ? { label:'FRIENDLY REMINDER', orange:'#E65A0A' }
        : { label:'INVOICE READY', orange:'#E65A0A' };

  const brown = '#653022';
  const darkBrown = '#4A241B';
  const orange = status.orange;
  const pale = '#FBF4EF';
  const amountLabel = stage === 4 ? 'Amount Paid' : 'Amount Due';

  const serviceRows = [];
  if (inv.serviceDescription) serviceRows.push(escapeHtml(inv.serviceDescription));
  if (inv.notes) serviceRows.push(escapeHtml(inv.notes));
  const workHtml = serviceRows.length
    ? serviceRows.map(x => `<div style="padding:7px 0;border-bottom:1px solid #eaded7;font-size:14px;color:#3c2923;"><span style="color:${orange};font-weight:800;margin-right:8px;">✓</span>${x}</div>`).join('')
    : `<div style="font-size:14px;color:#6b5b54;">Your detailed invoice is attached to this email.</div>`;

  const addressHtml = COMPANY_ADDRESS
    ? `<div style="margin-top:5px;">${escapeHtml(COMPANY_ADDRESS)}</div>`
    : '';

  const introHtml = (stage === 1 || stage === 4) ? copy.intro : escapeHtml(copy.intro);
  const closingHtml = (stage === 1 || stage === 4) ? copy.closing : escapeHtml(copy.closing);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3efec;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3efec;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(74,36,27,.12);">

<tr>
<td style="background:${darkBrown};padding:16px 28px;border-bottom:5px solid ${orange};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td valign="middle">
        <img src="cid:${LOGO_CID}" width="220" alt="Aspen Spas" style="display:block;width:220px;max-width:72%;height:auto;">
      </td>
      <td valign="middle" align="right" style="color:#fff;">
        <div style="font-size:11px;letter-spacing:1.8px;font-weight:700;color:#ffd5bd;">${status.label}</div>
        <div style="font-size:13px;margin-top:6px;color:#fff;">Invoice #${escapeHtml(inv.invoiceNumber)}</div>
      </td>
    </tr>
  </table>
</td>
</tr>

<tr><td style="padding:32px 32px 10px;">
  <div style="font-size:30px;line-height:1.15;font-weight:800;color:${brown};">Hi ${escapeHtml(greet)},</div>
  <p style="font-size:15px;line-height:1.65;color:#5e4a42;margin:12px 0 22px;">${introHtml}</p>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #eaded7;border-radius:12px;overflow:hidden;">
    <tr>
      <td colspan="2" style="background:${pale};padding:16px 18px;border-bottom:1px solid #eaded7;">
        <div style="font-size:11px;letter-spacing:1.4px;color:${orange};font-weight:800;">INVOICE SUMMARY</div>
      </td>
    </tr>
    <tr>
      <td style="padding:18px;width:58%;vertical-align:top;">
        <div style="font-size:12px;color:#92776c;">Customer</div>
        <div style="font-size:17px;font-weight:800;color:${brown};margin-top:3px;">${escapeHtml(inv.customerName || '')}</div>
        <div style="font-size:12px;color:#92776c;margin-top:14px;">Service Date</div>
        <div style="font-size:14px;font-weight:700;color:#3c2923;margin-top:3px;">${dateStr}</div>
        ${inv.technician ? `<div style="font-size:12px;color:#92776c;margin-top:14px;">Service Technician</div><div style="font-size:14px;font-weight:700;color:#3c2923;margin-top:3px;">${escapeHtml(inv.technician)}</div>` : ''}
        ${inv.spaModel ? `<div style="font-size:12px;color:#92776c;margin-top:14px;">Spa Model</div><div style="font-size:14px;font-weight:700;color:#3c2923;margin-top:3px;">${escapeHtml(inv.spaModel)}</div>` : ''}
      </td>
      <td style="padding:18px;background:#fffaf7;border-left:1px solid #eaded7;vertical-align:top;">
        <div style="font-size:12px;color:#92776c;">${amountLabel}</div>
        <div style="font-size:29px;font-weight:900;color:${orange};margin-top:5px;">${fmtCurrency(inv.amount)}</div>
        <div style="font-size:12px;color:#92776c;margin-top:18px;">Invoice Number</div>
        <div style="font-size:15px;font-weight:800;color:${brown};margin-top:3px;">#${escapeHtml(inv.invoiceNumber)}</div>
      </td>
    </tr>
  </table>

  <div style="margin-top:22px;padding:18px;background:${pale};border-radius:12px;border-left:5px solid ${orange};">
    <div style="font-size:13px;font-weight:800;color:${brown};letter-spacing:.5px;margin-bottom:8px;">WORK PERFORMED</div>
    ${workHtml}
  </div>

  <div style="text-align:center;margin:25px 0 8px;">
    <div style="display:inline-block;background:${brown};color:#fff;padding:14px 26px;border-radius:9px;font-size:14px;font-weight:800;letter-spacing:.3px;">
      INVOICE PDF ATTACHED
    </div>
    <div style="font-size:12px;color:#92776c;margin-top:9px;">Open the attached PDF to view or print the complete invoice.</div>
  </div>

  <p style="font-size:15px;line-height:1.65;color:#5e4a42;margin:25px 0 8px;">${closingHtml} <a href="tel:${COMPANY_PHONE.replace(/[^\d]/g,'')}" style="color:${orange};font-weight:800;text-decoration:none;">${escapeHtml(COMPANY_PHONE)}</a>.</p>
  <p style="font-size:15px;color:#5e4a42;margin:0 0 5px;">${escapeHtml(copy.signoff)}</p>
  <p style="font-size:15px;color:${brown};font-weight:800;margin:0;">${escapeHtml(senderName)}</p>
</td></tr>

<tr>
<td style="padding:22px 32px;background:${darkBrown};color:#fff;border-top:5px solid ${orange};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="font-size:12px;line-height:1.7;color:#f7e9e2;">
        <strong style="color:#fff;">Questions? We’re here to help.</strong><br>
        <a href="mailto:${getActiveUserEmail()}" style="color:#ffd5bd;text-decoration:none;">${getActiveUserEmail()}</a><br>
        <a href="tel:${COMPANY_PHONE.replace(/[^\d]/g,'')}" style="color:#ffd5bd;text-decoration:none;">${escapeHtml(COMPANY_PHONE)}</a>
        ${addressHtml}
      </td>
      <td align="right" style="font-size:12px;line-height:1.7;">
        <a href="https://${COMPANY_WEBSITE}" style="color:#ffd5bd;text-decoration:none;">${escapeHtml(COMPANY_WEBSITE)}</a><br>
        <span style="color:#fff;">Relax. Renew. Enjoy.</span>
      </td>
    </tr>
  </table>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
function buildEmailPlainText(inv, stage) {
  stage = stage || suggestEmailStage(inv);
  const copy = getStageCopyPlain(stage);
  const greet = inv.greetingName || deriveGreetingName(inv.customerName) || 'there';
  const dateStr = inv.serviceDate 
    ? new Date(inv.serviceDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) 
    : '';
  const techLine = inv.technician ? `\nService performed by: ${inv.technician}` : '';
  
  return `Hi ${greet},

${copy.intro}

Invoice details:
  Invoice number:  #${inv.invoiceNumber}
  Service date:    ${dateStr}
  Amount due:      ${fmtCurrency(inv.amount)}${techLine}

${copy.closing} ${COMPANY_PHONE}.

${copy.signoff}
${getActiveFromName()}
${getActiveUserEmail()}  |  ${COMPANY_PHONE}  |  ${COMPANY_WEBSITE}${COMPANY_ADDRESS ? '\n' + COMPANY_ADDRESS : ''}`;
}

// ════════════════════════════════════════════════════════════
// .EML FILE GENERATION (con PDF adjunto)
// ════════════════════════════════════════════════════════════
function buildEmlFile(inv, pdfBase64, pdfFilename, stage) {
  stage = stage || suggestEmailStage(inv);
  const boundary = '====aspen_' + Math.random().toString(36).slice(2, 12) + '====';
  const relBoundary = '====rel_' + Math.random().toString(36).slice(2, 12) + '====';
  const altBoundary = '====alt_' + Math.random().toString(36).slice(2, 12) + '====';
  const emailDate = new Date().toUTCString();

  const subject = buildEmailSubject(inv, stage);
  const htmlBody = buildEmailHtmlBody(inv, stage);
  const plainText = buildEmailPlainText(inv, stage);

  // Wrap base64 a 76 chars/línea (RFC 2045)
  const wrappedB64 = pdfBase64 ? pdfBase64.match(/.{1,76}/g).join('\r\n') : '';
  const wrappedLogoB64 = ASPEN_LOGO_B64.match(/.{1,76}/g).join('\r\n');

  // multipart/alternative: texto plano + HTML (el HTML llama al logo como cid:LOGO_CID)
  const altParts = [
    `--${altBoundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    encodeQuotedPrintable(plainText),
    ``,
    `--${altBoundary}`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    encodeQuotedPrintable(htmlBody),
    ``,
    `--${altBoundary}--`
  ];

  // El logo como parte de imagen adjunta DENTRO del correo (CID inline).
  // Content-ID debe coincidir con el cid: del <img> en el HTML.
  const logoParts = [
    `--${relBoundary}`,
    `Content-Type: image/png; name="aspen-logo.png"`,
    `Content-Transfer-Encoding: base64`,
    `Content-ID: <${LOGO_CID}>`,
    `Content-Disposition: inline; filename="aspen-logo.png"`,
    ``,
    wrappedLogoB64,
    ``
  ];

  // multipart/related = (alternative) + (logo). Esto es lo que hace que Outlook
  // muestre el logo en el cuerpo en vez de descartar un data: URI.
  const relatedParts = [
    `--${relBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    ``,
    ...altParts,
    ``,
    ...logoParts,
    `--${relBoundary}--`
  ];

  const lines = [
    `From: "${getActiveFromName()}" <${getActiveUserEmail()}>`,
    `To: ${inv.customerEmail}`,
    `Subject: ${subject}`,
    `Date: ${emailDate}`,
    `X-Unsent: 1`,
    `MIME-Version: 1.0`,
    pdfBase64
      ? `Content-Type: multipart/mixed; boundary="${boundary}"`
      : `Content-Type: multipart/related; boundary="${relBoundary}"`,
    ``
  ];

  if (pdfBase64) {
    // multipart/mixed > [ related (HTML + logo) , PDF adjunto ]
    lines.push(
      `--${boundary}`,
      `Content-Type: multipart/related; boundary="${relBoundary}"`,
      ``,
      ...relatedParts,
      ``,
      `--${boundary}`,
      `Content-Type: application/pdf; name="${pdfFilename}"`,
      `Content-Disposition: attachment; filename="${pdfFilename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      wrappedB64,
      ``,
      `--${boundary}--`
    );
  } else {
    // Sin PDF: el nivel superior ya es multipart/related
    lines.push(...relatedParts);
  }

  return lines.join('\r\n');
}

function encodeQuotedPrintable(str) {
  // Encode UTF-8 bytes as quoted-printable
  const utf8 = unescape(encodeURIComponent(str));
  let result = '';
  for (let i = 0; i < utf8.length; i++) {
    const c = utf8.charCodeAt(i);
    if (c === 0x3D) result += '=3D';
    else if (c >= 0x20 && c <= 0x7E && c !== 0x3D) result += utf8[i];
    else if (c === 0x0A) result += '\r\n';
    else if (c === 0x0D) continue;
    else if (c === 0x09 || c === 0x20) result += utf8[i];
    else result += '=' + c.toString(16).toUpperCase().padStart(2, '0');
  }
  // Wrap lines a 76 chars
  const wrapped = result.split('\r\n').map(line => {
    if (line.length <= 76) return line;
    let out = '';
    let pos = 0;
    while (pos < line.length) {
      let chunk = line.slice(pos, pos + 75);
      // No cortar en medio de =XX
      if (chunk.endsWith('=')) chunk = chunk.slice(0, -1);
      else if (chunk.length >= 2 && chunk.charAt(chunk.length - 2) === '=') chunk = chunk.slice(0, -2);
      out += chunk + (pos + chunk.length < line.length ? '=\r\n' : '');
      pos += chunk.length;
    }
    return out;
  }).join('\r\n');
  return wrapped;
}

// ════════════════════════════════════════════════════════════
// SEND VIA SMS / iMESSAGE — for customers without email but with phone
// Opens Messages app on Mac (or iPhone) with phone + body pre-filled
// ════════════════════════════════════════════════════════════
window.sendViaSms = function() {
  const inv = allInvoices.find(i => i.id === sendingId);
  if (!inv) return;
  
  // Get phone
  let phone = (inv.customerPhone || '').trim();
  if (!phone) {
    const customer = findCustomerByName(inv.customerName);
    phone = (customer && customer.phone) || '';
  }
  if (!phone) {
    toast(currentLang === 'en' ? 'No phone number on file' : 'No hay teléfono registrado', 'error');
    return;
  }
  
  let cleanPhone = phone.replace(/[^\d+]/g, '');
  if (/^\d{10}$/.test(cleanPhone)) cleanPhone = '+1' + cleanPhone;
  
  const en = currentLang === 'en';
  const stage = currentEmailStage;
  const greet = inv.greetingName || deriveGreetingName(inv.customerName) || (en ? 'there' : 'hola');
  const amount = fmtCurrency(inv.amount);
  const invNum = inv.invoiceNumber;
  const phoneNum = COMPANY_PHONE || '';
  
  // Stage-specific SMS body
  let body;
  if (stage === 4) {
    body = en
      ? `Hi ${greet}! ✨\n\nThank you for trusting Aspen Spas with your spa service. We've received your payment of ${amount} for invoice #${invNum}.\n\nWe truly appreciate your business — taking care of you and your spa is a real pleasure. Your paid invoice is attached for your records.\n\nIf you ever need future service or have questions, just reply or call us at ${phoneNum}.\n\n— Aspen Spas Team 🛁`
      : `¡Hola ${greet}! ✨\n\nGracias por confiar en Aspen Spas con tu servicio de spa. Recibimos tu pago de ${amount} por la factura #${invNum}.\n\nApreciamos mucho tu confianza — cuidar de ti y de tu spa es un verdadero placer. Tu factura pagada va adjunta para tus registros.\n\nSi necesitas servicio futuro o tienes preguntas, responde o llámanos al ${phoneNum}.\n\n— Equipo Aspen Spas 🛁`;
  } else if (stage === 3) {
    body = en
      ? `Hi ${greet},\n\nThis is Aspen Spas. Invoice #${invNum} for ${amount} is now past due. Invoice attached.\n\nCould you please reply or call us at ${phoneNum} so we can resolve this together?\n\nThank you,\nAspen Spas`
      : `Hola ${greet},\n\nLes habla Aspen Spas. La factura #${invNum} por ${amount} ya está vencida. Factura adjunta.\n\n¿Podrías responder o llamarnos al ${phoneNum} para resolverlo juntos?\n\nGracias,\nAspen Spas`;
  } else if (stage === 2) {
    body = en
      ? `Hi ${greet},\n\nFriendly reminder from Aspen Spas — invoice #${invNum} for ${amount} is still pending. Invoice attached. If you've already paid, please disregard. Otherwise, reply or call us at ${phoneNum}.\n\nThank you!\nAspen Spas`
      : `Hola ${greet},\n\nRecordatorio amigable de Aspen Spas — la factura #${invNum} por ${amount} sigue pendiente. Factura adjunta. Si ya la pagaste, ignora este mensaje. Si no, responde o llámanos al ${phoneNum}.\n\nGracias!\nAspen Spas`;
  } else {
    body = en
      ? `Hi ${greet}!\n\nThank you for choosing Aspen Spas. This is your invoice #${invNum} for ${amount} for the recent service. Invoice attached.\n\nIf you have questions, reply or call us at ${phoneNum}.\n\nThank you for your business!\n— Aspen Spas Team`
      : `¡Hola ${greet}!\n\nGracias por elegir Aspen Spas. Esta es tu factura #${invNum} por ${amount} por el servicio reciente. Factura adjunta.\n\nSi tienes preguntas, responde o llámanos al ${phoneNum}.\n\n¡Gracias por tu confianza!\n— Equipo Aspen Spas`;
  }
  
  const smsUrl = `sms:${cleanPhone}?&body=${encodeURIComponent(body)}`;
  const hasPdf = !!inv.pdfBase64;
  
  // Step 1 — Download PDF first (if exists)
  let pdfFilename = null;
  if (hasPdf) {
    pdfFilename = inv.pdfFilename || `Invoice_${inv.invoiceNumber}.pdf`;
    // Convert base64 → blob → download
    const b64 = inv.pdfBase64;
    const byteChars = atob(b64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    const pdfBlob = new Blob([byteArray], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(pdfBlob);
    a.download = pdfFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 200);
  }
  
  // Step 2 — Show step-by-step instructions modal BEFORE opening Messages
  // Replace any existing overlay
  const existing = document.getElementById('confirmSendOverlay');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'confirmSendOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  
  const stepsHtml = hasPdf ? `
    <div style="text-align:left;background:#F1F5F9;padding:14px 16px;border-radius:8px;font-size:13px;line-height:1.7;color:#134A63;">
      <div style="font-weight:700;margin-bottom:8px;">${en ? 'Steps to send with PDF:' : 'Pasos para enviar con PDF:'}</div>
      <div>✅ <strong>${en ? 'PDF downloaded' : 'PDF descargado'}:</strong> <code style="background:white;padding:2px 6px;border-radius:4px;font-size:11px;">${escapeHtml(pdfFilename)}</code></div>
      <div>2️⃣ ${en ? 'Click "Open Messages" below — Messages opens with text pre-filled.' : 'Click "Abrir Messages" abajo — Messages se abrirá con el texto pre-llenado.'}</div>
      <div>3️⃣ <strong style="color:#0284C7;">${en ? 'Drag the PDF from Downloads → into the Messages chat.' : 'Arrastra el PDF de Downloads → al chat de Messages.'}</strong></div>
      <div>4️⃣ ${en ? 'Click Send in Messages.' : 'Click Send en Messages.'}</div>
      <div>5️⃣ ${en ? 'Come back here to confirm.' : 'Vuelve aquí a confirmar.'}</div>
    </div>` : `
    <div style="text-align:left;background:#F1F5F9;padding:14px 16px;border-radius:8px;font-size:13px;line-height:1.7;color:#134A63;">
      <div style="font-weight:700;margin-bottom:8px;">${en ? 'Note:' : 'Nota:'}</div>
      <div>⚠ ${en ? 'This invoice has no PDF saved. Only the text message will be sent.' : 'Esta factura no tiene PDF guardado. Solo se enviará el texto.'}</div>
      <div>2️⃣ ${en ? 'Click "Open Messages" below.' : 'Click "Abrir Messages" abajo.'}</div>
      <div>3️⃣ ${en ? 'Click Send in Messages.' : 'Click Send en Messages.'}</div>
    </div>`;
  
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;max-width:500px;width:100%;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,0.3);">
      <div style="font-size:36px;text-align:center;margin-bottom:8px;">📱</div>
      <h3 style="margin:0 0 16px 0;text-align:center;font-size:18px;color:#134A63;">${en ? 'Send via iMessage/SMS' : 'Enviar por iMessage/SMS'}</h3>
      <div style="text-align:center;font-size:13px;color:#475569;margin-bottom:14px;">${en ? 'To' : 'Para'}: <strong>${escapeHtml(inv.customerName)}</strong> · 📱 ${escapeHtml(cleanPhone)}</div>
      ${stepsHtml}
      <div style="display:flex;gap:8px;flex-direction:column;margin-top:16px;">
        <button onclick="window.openMessagesWithSms('${invNum}', '${cleanPhone}', this)" data-sms-url="${escapeHtml(smsUrl)}" style="background:#2E8B57;color:white;border:0;padding:14px 16px;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;">
          📱 ${en ? 'Open Messages now' : 'Abrir Messages ahora'}
        </button>
        <button onclick="document.getElementById('confirmSendOverlay').remove();" style="background:#F1F5F9;color:#475569;border:0;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;">
          ${en ? 'Cancel' : 'Cancelar'}
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
};

// Click handler for "Open Messages now" — triggers sms: URL and replaces modal with confirm
window.openMessagesWithSms = function(invNum, phone, btnEl) {
  const url = btnEl.dataset.smsUrl;
  // Open Messages
  window.location.href = url;
  
  // Wait briefly for Messages to open, then transition modal to confirm
  setTimeout(async () => {
    const inv = allInvoices.find(i => i.invoiceNumber === invNum);
    if (!inv) return;
    
    const now = Date.now();
    const histEntry = { ts: now, action: 'sent', stage: currentEmailStage, channel: 'sms', confirmed: false };
    const newHistory = [...(inv.history || []), histEntry];
    const updates = inv.status === 'paid'
      ? { history: newHistory, lastEmailStage: currentEmailStage }
      : { history: newHistory, status: 'sent', sentAt: now, lastEmailStage: currentEmailStage };
    await updateInvoiceData(inv.id, updates);
    
    // Replace modal content with confirmation
    const overlay = document.getElementById('confirmSendOverlay');
    if (overlay) {
      const en = currentLang === 'en';
      overlay.innerHTML = `
        <div style="background:white;border-radius:16px;max-width:440px;width:100%;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,0.3);">
          <div style="font-size:36px;text-align:center;margin-bottom:8px;">📱</div>
          <h3 style="margin:0 0 12px 0;text-align:center;font-size:18px;color:#134A63;">${en ? 'Did you send the SMS?' : '¿Enviaste el SMS?'}</h3>
          <p style="margin:0 0 20px 0;text-align:center;font-size:14px;color:#475569;line-height:1.5;">
            ${en
              ? `In Messages, did you drag the PDF and click <strong>Send</strong> to <strong>${escapeHtml(inv.customerName)}</strong>?`
              : `En Messages, ¿arrastraste el PDF y le diste click a <strong>Send</strong> a <strong>${escapeHtml(inv.customerName)}</strong>?`}
          </p>
          <div style="display:flex;gap:8px;flex-direction:column;">
            <button onclick="window.confirmSmsYes('${inv.id}', ${newHistory.length - 1})" style="background:#2E8B57;color:white;border:0;padding:12px 16px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
              ✅ ${en ? 'Yes — mark as sent' : 'Sí lo envié — marcar enviado'}
            </button>
            <button onclick="window.confirmSendNo()" style="background:#F1F5F9;color:#475569;border:0;padding:12px 16px;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;">
              ⏰ ${en ? "Not yet — I'll send it later" : 'Aún no — lo envío después'}
            </button>
          </div>
        </div>`;
    }
  }, 600);
};

window.confirmSmsYes = async function(invoiceId, historyIndex) {
  const inv = allInvoices.find(i => i.id === invoiceId);
  if (!inv) return;
  const newHistory = [...(inv.history || [])];
  if (newHistory[historyIndex]) {
    newHistory[historyIndex] = { ...newHistory[historyIndex], confirmed: true, confirmedAt: Date.now() };
    await updateInvoiceData(invoiceId, { history: newHistory });
  }
  const overlay = document.getElementById('confirmSendOverlay');
  if (overlay) overlay.remove();
  closeModal('sendModal');
  toast(currentLang === 'en' ? '✅ SMS marked as sent' : '✅ SMS marcado como enviado', 'success');
};

window.generateEmlAndDownload = function() {
  const inv = allInvoices.find(i => i.id === sendingId);
  if (!inv) return;

  /* v2.61.0 — este email le dice un numero al cliente. Si ese numero nunca se
     verifico contra el papel, se pregunta antes de mandarlo, no despues. */
  const _why = window.itkMontoSinVerificar && window.itkMontoSinVerificar(inv);
  if (_why) {
    const _en = currentLang === 'en';
    if (!confirm(_en
      ? `The amount on invoice #${inv.invoiceNumber} ($${Number(inv.amount||0).toFixed(2)}) was never verified — ${_why}.\n\nThis email quotes that figure to the customer. Send anyway?`
      : `El monto de la factura #${inv.invoiceNumber} ($${Number(inv.amount||0).toFixed(2)}) nunca se verificó — ${_why}.\n\nEste email le cotiza esa cifra al cliente. ¿Mandarlo igual?`)) return;
  }
  
  const pdfBase64 = inv.pdfBase64 || null;
  const pdfFilename = inv.pdfFilename || `Invoice_${inv.invoiceNumber}.pdf`;
  
  const emlContent = buildEmlFile(inv, pdfBase64, pdfFilename, currentEmailStage);
  const blob = new Blob([emlContent], { type: 'message/rfc822' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  const stageSuffix = currentEmailStage === 1 ? '' : (currentEmailStage === 2 ? '_reminder' : '_pastdue');
  a.download = `Invoice_${inv.invoiceNumber}_for_${(inv.customerName || 'customer').replace(/[^a-zA-Z0-9]/g, '_')}${stageSuffix}.eml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  
  toast(pdfBase64 ? 'Email descargado con PDF adjunto. Doble click en el .eml para abrirlo' : 'Email descargado (sin PDF). Doble click para abrir', 'success');
  
  // After download, ask if she actually clicked Send in Outlook (same dynamic as internal alerts)
  setTimeout(() => askConfirmSendCustomer(sendingId, currentEmailStage), 600);
};

// ════════════════════════════════════════════════════════════
// CUSTOMER EMAIL CONFIRMATION — ask if user actually sent it
// If yes: mark invoice as 'sent' (calls markAsSent equivalent)
// ════════════════════════════════════════════════════════════
window.askConfirmSendCustomer = function(invoiceId, stage) {
  const inv = allInvoices.find(i => i.id === invoiceId);
  if (!inv) return;
  
  const en = currentLang === 'en';
  const stageLabel = ({1: en ? '1st send' : 'Primer envío', 2: en ? 'Reminder' : 'Recordatorio', 3: en ? 'Past due' : 'Vencida'})[stage];
  
  const overlay = document.createElement('div');
  overlay.id = 'confirmSendOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;max-width:440px;width:100%;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,0.3);">
      <div style="font-size:36px;text-align:center;margin-bottom:8px;">📤</div>
      <h3 style="margin:0 0 12px 0;text-align:center;font-size:18px;color:#134A63;">${en ? 'Did you send the email?' : '¿Enviaste el email?'}</h3>
      <p style="margin:0 0 20px 0;text-align:center;font-size:14px;color:#475569;line-height:1.5;">
        ${en
          ? `In Outlook, did you click <strong>Send</strong> on the email to <strong>${escapeHtml(inv.customerName)}</strong>?<br>(${stageLabel})`
          : `En Outlook, ¿le diste click a <strong>Send</strong> al email para <strong>${escapeHtml(inv.customerName)}</strong>?<br>(${stageLabel})`}
      </p>
      <p style="margin:0 0 20px 0;text-align:center;font-size:12px;color:#94A3B8;font-style:italic;">
        ${en ? 'Verify it appears in Outlook → Sent Items' : 'Verifica que aparezca en Outlook → Sent Items'}
      </p>
      <div style="display:flex;gap:8px;flex-direction:column;">
        <button onclick="window.confirmSendCustomerYes('${invoiceId}', ${stage})" style="background:#2E8B57;color:white;border:0;padding:12px 16px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
          ✅ ${en ? 'Yes — mark invoice as sent' : 'Sí lo envié — marcar factura como enviada'}
        </button>
        <button onclick="window.confirmSendNo()" style="background:#F1F5F9;color:#475569;border:0;padding:12px 16px;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;">
          ⏰ ${en ? "Not yet — I'll send it later" : 'Aún no — lo envío después'}
        </button>
      </div>
      <p style="font-size:11px;color:#94A3B8;text-align:center;margin:14px 0 0 0;font-style:italic;">
        ${en ? 'You can still click "Mark as sent" manually in the modal' : 'También puedes click "Marcar como enviada" manualmente en el modal'}
      </p>
    </div>`;
  document.body.appendChild(overlay);
};

window.confirmSendCustomerYes = async function(invoiceId, stage) {
  const inv = allInvoices.find(i => i.id === invoiceId);
  if (!inv) return;
  const now = Date.now();
  const history = [...(inv.history || []), { ts: now, action: 'sent', stage: stage, confirmed: true }];
  
  // If invoice is ALREADY paid, don't downgrade — just log + skip auto-snooze (no follow-up needed for paid)
  if (inv.status === 'paid') {
    await updateInvoiceData(invoiceId, { history, lastEmailStage: stage });
    const overlay = document.getElementById('confirmSendOverlay');
    if (overlay) overlay.remove();
    closeModal('sendModal');
    toast(currentLang === 'en'
      ? `✅ Email sent to ${escapeHtml(inv.customerName)} (invoice already paid — no follow-up needed)`
      : `✅ Email enviado a ${escapeHtml(inv.customerName)} (factura ya pagada — sin follow-up)`,
      'success');
    return;
  }
  
  // ─── AUTO-SNOOZE: set follow-up date based on stage (only for unpaid invoices) ───
  const daysAhead = ({1: 7, 2: 3, 3: 1})[stage] || 7;
  const followUp = new Date();
  followUp.setDate(followUp.getDate() + daysAhead);
  followUp.setHours(0, 0, 0, 0);
  const followUpStr = followUp.toISOString().slice(0, 10);
  
  const updates = { 
    status: 'sent', 
    sentAt: now, 
    history, 
    lastEmailStage: stage,
    nextFollowUp: followUpStr
  };
  await updateInvoiceData(invoiceId, updates);
  
  const overlay = document.getElementById('confirmSendOverlay');
  if (overlay) overlay.remove();
  closeModal('sendModal');
  const stageLbl = ({1: t('stage.firstSend'), 2: t('stage.reminder'), 3: t('stage.pastDue'), 4: t('stage.receipt')})[stage];
  const followUpLabel = followUp.toLocaleDateString();
  toast(currentLang === 'en'
    ? `✅ Marked as sent (${stageLbl}). Follow-up auto-set for ${followUpLabel} (+${daysAhead}d).`
    : `✅ Marcada como enviada (${stageLbl}). Follow-up automático: ${followUpLabel} (+${daysAhead}d).`,
    'success');
};

// ════════════════════════════════════════════════════════════
// AUTOCOMPLETE DE CLIENTE EN FORMULARIO DE FACTURA
// ════════════════════════════════════════════════════════════
window.onCustomerInput = async function(e) {
  const q = e.target.value.trim();
  const list = document.getElementById('customerSuggestions');
  if (!q || q.length < 2) {
    list.classList.remove('open');
    return;
  }

  // 1. Local customers (smart matched)
  const localMatches = smartMatchCustomer(q, allCustomers).slice(0, 6);

  // Render local results immediately
  let html = '';
  if (localMatches.length > 0) {
    html += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-mute);font-weight:700;padding:8px 12px 4px;">📋 Tu base local</div>';
    html += localMatches.map(c => `
      <div class="autocomplete-item" onmousedown="window.pickCustomer('${c.id}')">
        <span class="autocomplete-item-name">${escapeHtml(c.name)}</span>
        <span class="autocomplete-item-meta">${escapeHtml(c.email || '—')}${c.spaModel ? ' · ' + escapeHtml(c.spaModel) : ''}${c.phone ? ' · ' + escapeHtml(c.phone) : ''}</span>
      </div>
    `).join('');
  }

  // 2. Search TICKETS database (cross-Firebase) — async, append when ready
  if (allCustomers.length === 0 || localMatches.length < 4) {
    html += '<div id="autoTicketsLoading" style="font-size:11px;color:var(--text-mute);padding:8px 12px;font-style:italic;">🔍 Buscando en TICKETS database…</div>';
  }

  list.innerHTML = html || `<div class="autocomplete-item" style="color:var(--text-mute);">${escapeHtml(t('customer.search.noMatch'))}</div>`;
  list.classList.add('open');

  // Fire ticket search async
  if (allCustomers.length === 0 || localMatches.length < 4) {
    try {
      const tixCustomers = await searchTicketsCustomers(q);
      // Filter out ones we already have locally (by name)
      const localNames = new Set(allCustomers.map(c => (c.name || '').trim().toLowerCase()));
      const newOnes = tixCustomers.filter(t => !localNames.has((t.name || '').trim().toLowerCase())).slice(0, 6);
      
      const loading = document.getElementById('autoTicketsLoading');
      if (loading) loading.remove();
      
      if (newOnes.length > 0) {
        const tixHeader = currentLang === 'en' ? '🔌 From TICKETS database' : '🔌 De TICKETS database';
        const importHint = currentLang === 'en' ? '↓ import' : '↓ importar';
        const tixHtml = `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0284C7;font-weight:700;padding:8px 12px 4px;">${tixHeader}</div>` +
          newOnes.map(tk => `
            <div class="autocomplete-item" onmousedown="window.pickTicketCustomer(${JSON.stringify(tk).replace(/"/g, '&quot;')})">
              <span class="autocomplete-item-name">${escapeHtml(tk.name)} <span style="font-size:11px;color:#0284C7;">${importHint}</span></span>
              <span class="autocomplete-item-meta">${escapeHtml(tk.email || '—')}${tk.address ? ' · ' + escapeHtml(tk.address) : ''}${tk.phone ? ' · ' + escapeHtml(tk.phone) : ''}</span>
            </div>
          `).join('');
        list.insertAdjacentHTML('beforeend', tixHtml);
      } else if (localMatches.length === 0) {
        const noMatchTxt = currentLang === 'en' ? 'No matches in TICKETS either — type the full name' : 'Sin coincidencias en TICKETS tampoco — escribe el nombre completo';
        list.insertAdjacentHTML('beforeend', `<div class="autocomplete-item" style="color:var(--text-mute);font-size:11px;">${noMatchTxt}</div>`);
      }
    } catch (err) {
      const loading = document.getElementById('autoTicketsLoading');
      const errPrefix = currentLang === 'en' ? '⚠ TICKETS DB unavailable' : '⚠ TICKETS DB no disponible';
      if (loading) loading.innerHTML = `<span style="color:var(--pending);">${errPrefix}: ${escapeHtml(err.message || 'no conectado')}</span>`;
    }
  }
};

window.pickTicketCustomer = function(tk) {
  // Pre-fill the invoice form with the ticket customer data
  document.getElementById('fCustomerName').value = tk.name || '';
  document.getElementById('fGreetingName').value = tk.greetingName || deriveGreetingName(tk.name) || '';
  document.getElementById('fCustomerEmail').value = tk.email || '';
  document.getElementById('fCustomerPhone').value = tk.phone || '';
  document.getElementById('fSpaModel').value = tk.spaModel || '';
  document.getElementById('fSerial').value = tk.serialNumber || '';
  document.getElementById('customerSuggestions').classList.remove('open');
  
  // Auto-parse spaDescription for model/serial if invoice form fields are empty
  let parseMsg = '';
  if (tk.spaDescription && tk.spaDescription.trim()) {
    try {
      const parsed = parseQbNotesText(tk.spaDescription);
      if (parsed) {
        const fillIfEmpty = (id, val) => {
          if (!val) return;
          const el = document.getElementById(id);
          if (el && !el.value.trim()) el.value = val;
        };
        if (parsed.spaModel) fillIfEmpty('fSpaModel', parsed.spaModel);
        if (parsed.serialNumber) fillIfEmpty('fSerial', parsed.serialNumber);
        const filled = [];
        if (parsed.spaModel) filled.push(currentLang === 'en' ? 'model' : 'modelo');
        if (parsed.serialNumber) filled.push('serial');
        if (parsed.address) filled.push(currentLang === 'en' ? 'address' : 'dirección');
        if (filled.length) parseMsg = t('toast.autoExtracted', filled.join(', '));
      }
    } catch (e) { console.warn('Spa parse failed', e); }
  }
  
  toast(t('toast.ticketsImported', tk.name || '', parseMsg), 'success');
};

// ════════════════════════════════════════════════════════════
// TOKEN-BASED NAME MATCHING — handles all real-world name variations:
//   "Bulejski, Denise and Jim"  ↔  "Denise and Jim Bulejski"   (QB flip)
//   "Doug & Carrie Meyer"        ↔  "Meyer, Doug and Carrie"   (& vs and)
//   "Donna B. Baranyai"          ↔  "Donna Baranyai"           (middle initial)
//   "donna baranyai"             ↔  "Donna Baranyai"           (case)
//
// Strategy: normalize → split into tokens → strip stopwords + short tokens
//           → sort alphabetically → compare. Order-agnostic, format-agnostic.
// ════════════════════════════════════════════════════════════
const _NAME_STOPWORDS = new Set(['and', 'or', 'the', 'a', 'an', 'y', 'e', 'de', 'di', 'del']);
function _nameMatchTokens(name) {
  if (!name) return [];
  return String(name).toLowerCase()
    .replace(/[.,&\-_'"`()\/\\]/g, ' ')   // strip punctuation
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(t => t.length >= 2 && !_NAME_STOPWORDS.has(t))
    .sort();
}
function _tokensEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function _tokensSubset(sub, sup) {
  if (sub.length === 0) return false;
  const supSet = new Set(sup);
  return sub.every(t => supSet.has(t));
}

window.pickCustomer = function(id) {
  const c = allCustomers.find(x => x.id === id);
  if (!c) return;
  document.getElementById('fCustomerName').value = c.name || '';
  document.getElementById('fGreetingName').value = c.greetingName || '';
  document.getElementById('fCustomerEmail').value = c.email || '';
  document.getElementById('fCustomerPhone').value = c.phone || '';
  document.getElementById('fSpaModel').value = c.spaModel || '';
  document.getElementById('fSerial').value = c.serialNumber || '';
  document.getElementById('customerSuggestions').classList.remove('open');
  toast(currentLang === 'en' ? `Customer "${c.name}" auto-filled` : `Cliente "${c.name}" autocompletado`, 'success');
};

// ════════════════════════════════════════════════════════════
// AUTO-FILL ON BLUR — if user types a full customer name and clicks away
// without picking from the dropdown, we still try to auto-complete their info.
// Only fills empty fields (never overrides what user already typed).
// ════════════════════════════════════════════════════════════
window.tryAutoFillCustomerFromName = async function() {
  const nameEl = document.getElementById('fCustomerName');
  if (!nameEl) return false;
  const name = (nameEl.value || '').trim();
  if (!name || name.length < 3) return false;

  // The auto-fill targets (only fill these if currently empty)
  const fields = {
    greetingName: document.getElementById('fGreetingName'),
    email:        document.getElementById('fCustomerEmail'),
    phone:        document.getElementById('fCustomerPhone'),
    spaModel:     document.getElementById('fSpaModel'),
    serial:       document.getElementById('fSerial')
  };

  // Skip if everything's already populated (user filled manually)
  const allFilled = Object.values(fields).every(el => el && (el.value || '').trim());
  if (allFilled) return false;

  // ── TOKEN-BASED MATCHING (handles all the QB flip / format variations) ──
  const qTokens = _nameMatchTokens(name);
  if (qTokens.length === 0) return false;

  // PASS 1: EXACT token set match (same tokens regardless of order)
  // "Denise and Jim Bulejski" tokens = ["bulejski","denise","jim"]
  // "Bulejski, Denise and Jim"  tokens = ["bulejski","denise","jim"]  ← MATCH
  let candidates = allCustomers.filter(c => _tokensEqual(_nameMatchTokens(c.name), qTokens));
  let matchType = 'exact';

  // PASS 2: SUBSET match — every query token is found in candidate (user typed shorter)
  // "Donna Baranyai" subset of "Donna B Baranyai"
  if (candidates.length === 0) {
    candidates = allCustomers.filter(c => _tokensSubset(qTokens, _nameMatchTokens(c.name)));
    matchType = 'partial';
  }

  let match = null;
  let source = null;
  if (candidates.length === 1) {
    match = candidates[0];
    source = 'local';
  } else if (candidates.length > 1) {
    // Ambiguous — pick the one whose token set has the SAME LENGTH as query (closest)
    // If still ambiguous after that, abort (don't guess)
    const sameLen = candidates.filter(c => _nameMatchTokens(c.name).length === qTokens.length);
    if (sameLen.length === 1) { match = sameLen[0]; source = 'local'; }
  }

  // FALLBACK: search TICKETS database for token match
  if (!match) {
    try {
      const tixMatches = await searchTicketsCustomers(name);
      let tixCandidates = tixMatches.filter(t => _tokensEqual(_nameMatchTokens(t.name), qTokens));
      if (tixCandidates.length === 0) {
        tixCandidates = tixMatches.filter(t => _tokensSubset(qTokens, _nameMatchTokens(t.name)));
      }
      if (tixCandidates.length === 1) {
        match = tixCandidates[0];
        source = 'tickets';
      } else if (tixCandidates.length > 1) {
        const sameLen = tixCandidates.filter(t => _nameMatchTokens(t.name).length === qTokens.length);
        if (sameLen.length === 1) { match = sameLen[0]; source = 'tickets'; }
      }
    } catch (_e) { /* network/auth failure — silent */ }
  }

  if (!match) {
    console.info('[AutoFill] No unique match for', JSON.stringify(name), '— query tokens:', qTokens);
    return false;
  }

  console.info('[AutoFill] Matched:', match.name, '(source:', source + ', type:', matchType + ')');

  // If the matched record has a model/serial in its spaDescription text, try to parse them out
  let parsedFromDesc = {};
  if (match.spaDescription && typeof parseQbNotesText === 'function') {
    try { parsedFromDesc = parseQbNotesText(match.spaDescription) || {}; } catch(_e){}
  }

  // Fill only empty fields
  const fillIfEmpty = (el, val) => {
    if (!el || !val) return false;
    if ((el.value || '').trim()) return false;
    el.value = val;
    return true;
  };

  let filledCount = 0;
  if (fillIfEmpty(fields.greetingName, match.greetingName || (typeof deriveGreetingName === 'function' ? deriveGreetingName(match.name) : ''))) filledCount++;
  if (fillIfEmpty(fields.email,        match.email)) filledCount++;
  if (fillIfEmpty(fields.phone,        match.phone)) filledCount++;
  if (fillIfEmpty(fields.spaModel,     match.spaModel || parsedFromDesc.spaModel)) filledCount++;
  if (fillIfEmpty(fields.serial,       match.serialNumber || parsedFromDesc.serialNumber)) filledCount++;

  // Normalize the name field to the canonical form from the DB
  // (this is what makes the link from "Denise and Jim Bulejski" to "Bulejski, Denise and Jim" visible)
  if (match.name && match.name !== name) {
    nameEl.value = match.name;
  }

  if (filledCount > 0 || (match.name && match.name !== name)) {
    const en = currentLang === 'en';
    const srcLbl = source === 'tickets' ? 'TICKETS' : (en ? 'your customers' : 'tu base de clientes');
    toast(en
      ? `✓ Matched "${match.name}" — ${filledCount} field(s) auto-filled from ${srcLbl}`
      : `✓ Match "${match.name}" — ${filledCount} campo(s) autocompletado(s) desde ${srcLbl}`,
      'success');
  }
  return filledCount > 0;
};

// ════════════════════════════════════════════════════════════
// MODAL DE CLIENTE
// ════════════════════════════════════════════════════════════
window.switchCustomerTab = function(tabName) {
  document.querySelectorAll('.cust-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.cust-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tabName));
};

window.openAddCustomerModal = function() {
  editingCustomerId = null;
  document.getElementById('customerFormTitle').textContent = 'Agregar cliente';
  document.getElementById('customerSaveBtn').textContent = 'Guardar';
  document.getElementById('customerDeleteBtn').style.display = 'none';
  ['cName','cGreeting','cEmail','cCcEmail','cPhone','cMobilePhone','cAltPhone','cSpaModel','cAddress','cSerial','cCabinet','cBoard','cHeater','cTopside','cQbRaw','cNotes','qbNotesInput','cTixSearch'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('qbParseResult').classList.remove('show');
  document.getElementById('cTixResults').innerHTML = '';
  // Reset to first tab + auto-open import tools (we're starting from scratch)
  window.switchCustomerTab('address');
  const tools = document.getElementById('custImportTools');
  if (tools) tools.open = true;
  document.getElementById('customerModal').classList.add('open');
  setTimeout(() => document.getElementById('cName').focus(), 100);
};

window.openEditCustomerModal = async function(id) {
  const c = allCustomers.find(x => x.id === id);
  if (!c) return;
  editingCustomerId = id;
  document.getElementById('customerFormTitle').textContent = `Editar: ${c.name}`;
  document.getElementById('customerSaveBtn').textContent = 'Actualizar';
  document.getElementById('customerDeleteBtn').style.display = 'inline-flex';
  document.getElementById('cName').value = c.name || '';
  document.getElementById('cGreeting').value = c.greetingName || '';
  document.getElementById('cEmail').value = c.email || '';
  document.getElementById('cCcEmail').value = c.ccEmail || '';
  document.getElementById('cPhone').value = c.phone || '';
  document.getElementById('cMobilePhone').value = c.mobilePhone || '';
  document.getElementById('cAltPhone').value = c.altPhone || '';
  document.getElementById('cSpaModel').value = c.spaModel || '';
  document.getElementById('cAddress').value = c.address || '';
  document.getElementById('cSerial').value = c.serialNumber || '';
  document.getElementById('cCabinet').value = c.cabinet || '';
  document.getElementById('cBoard').value = c.boardNumber || '';
  document.getElementById('cHeater').value = c.heaterNumber || '';
  document.getElementById('cTopside').value = c.topsideNumber || '';
  document.getElementById('cQbRaw').value = c.qbNotesRaw || '';
  document.getElementById('cNotes').value = c.notes || '';
  document.getElementById('qbNotesInput').value = '';
  document.getElementById('cTixSearch').value = '';
  document.getElementById('cTixResults').innerHTML = '';
  document.getElementById('qbParseResult').classList.remove('show');
  // Reset to Address Info tab + collapse import tools (editing existing data)
  window.switchCustomerTab('address');
  const tools = document.getElementById('custImportTools');
  if (tools) tools.open = false;
  document.getElementById('customerModal').classList.add('open');
  
  // ─── AUTO-SEARCH TICKETS for missing data ──────────────────
  // If phone or address is empty, automatically search TICKETS by name
  const hasMissingData = !c.phone || !c.address || !c.serialNumber || !c.spaModel;
  if (hasMissingData && c.name) {
    const resEl = document.getElementById('cTixResults');
    resEl.innerHTML = `<div style="font-size:11px;color:#0284C7;padding:4px;">🔎 ${currentLang === 'en' ? 'Searching TICKETS for missing data…' : 'Buscando en TICKETS los datos faltantes…'}</div>`;
    try {
      const all = await fetchAllTicketsCustomers();
      // Try exact + comma-flipped match first
      const norm = (s) => (s || '').toLowerCase().replace(/[,\.]/g, '').replace(/\s+/g, ' ').trim();
      const targetN = norm(c.name);
      const targetFlipped = c.name.includes(',') 
        ? norm(c.name.split(',').map(s => s.trim()).reverse().join(' '))
        : null;
      
      let exact = all.find(t => norm(t.name) === targetN || (targetFlipped && norm(t.name) === targetFlipped));
      
      // Also try matching by email
      if (!exact && c.email) {
        const emailNorm = c.email.toLowerCase().trim();
        exact = all.find(t => (t.email || '').toLowerCase().trim() === emailNorm);
      }
      
      if (exact) {
        // Check what fields TICKETS has that we're missing
        const missing = [];
        if (!c.phone && exact.phone) missing.push({label: currentLang === 'en' ? 'Phone' : 'Teléfono', value: exact.phone});
        if (!c.address && exact.address) missing.push({label: currentLang === 'en' ? 'Address' : 'Dirección', value: exact.address});
        if (!c.spaModel && exact.spaModel) missing.push({label: currentLang === 'en' ? 'Spa Model' : 'Modelo', value: exact.spaModel});
        if (!c.serialNumber && exact.serialNumber) missing.push({label: 'Serial #', value: exact.serialNumber});
        if (!c.spaModel && !c.serialNumber && exact.spaDescription) missing.push({label: currentLang === 'en' ? 'Spa description' : 'Descripción del spa', value: '(' + (exact.spaDescription.length) + ' chars)'});
        
        if (missing.length > 0) {
          // Stash for the import button
          window._pendingTixImport = exact;
          const previewLines = missing.map(m => `<div style="font-size:11px;color:#065F46;"><strong>${escapeHtml(m.label)}:</strong> ${escapeHtml(String(m.value).slice(0, 50))}${String(m.value).length > 50 ? '…' : ''}</div>`).join('');
          resEl.innerHTML = `
            <div style="background:#ECFDF5;border:1px solid #6EE7B7;border-radius:var(--r-sm);padding:10px;margin-top:6px;">
              <div style="font-weight:700;color:#047857;font-size:12px;margin-bottom:6px;">✓ ${currentLang === 'en' ? 'Found in TICKETS — fields available' : 'Encontrado en TICKETS — campos disponibles'} (${missing.length}):</div>
              ${previewLines}
              <button type="button" class="btn btn-primary btn-sm" style="margin-top:10px;width:100%;" onclick="window.applyPendingTixImport()">
                ⬇ ${currentLang === 'en' ? 'Import these fields' : 'Importar estos campos'}
              </button>
            </div>
          `;
        } else {
          resEl.innerHTML = `<div style="font-size:11px;color:var(--text-mute);padding:4px;">✓ ${currentLang === 'en' ? 'Found in TICKETS, but no missing fields to import.' : 'Encontrado en TICKETS, pero no hay campos faltantes que importar.'}</div>`;
        }
      } else {
        resEl.innerHTML = `<div style="font-size:11px;color:var(--text-mute);padding:4px;">${currentLang === 'en' ? '⚠ Not found in TICKETS by exact name. Use the search above to look manually.' : '⚠ No se encontró en TICKETS por nombre exacto. Usa la búsqueda arriba para buscar manualmente.'}</div>`;
      }
    } catch (err) {
      console.warn('Auto-search TICKETS failed:', err);
      resEl.innerHTML = `<div style="font-size:11px;color:var(--pending);padding:4px;">⚠ TICKETS DB ${currentLang === 'en' ? 'not reachable' : 'no disponible'}: ${escapeHtml(err.message || '')}</div>`;
    }
  }
};

// Apply the pending TICKETS import to currently-open customer edit form
window.applyPendingTixImport = function() {
  const tk = window._pendingTixImport;
  if (!tk) {
    toast(currentLang === 'en' ? 'No pending import' : 'Nada pendiente para importar', 'error');
    return;
  }
  const fillIfEmpty = (id, val) => {
    if (!val) return false;
    const el = document.getElementById(id);
    if (el && !el.value.trim()) { el.value = val; return true; }
    return false;
  };
  const filled = [];
  if (fillIfEmpty('cPhone', tk.phone)) filled.push(currentLang === 'en' ? 'phone' : 'teléfono');
  if (fillIfEmpty('cAddress', tk.address)) filled.push(currentLang === 'en' ? 'address' : 'dirección');
  if (fillIfEmpty('cSpaModel', tk.spaModel)) filled.push(currentLang === 'en' ? 'model' : 'modelo');
  if (fillIfEmpty('cSerial', tk.serialNumber)) filled.push('serial #');
  
  // Also auto-parse spaDescription if available
  if (tk.spaDescription && tk.spaDescription.trim()) {
    const rawEl = document.getElementById('cQbRaw');
    if (rawEl && !rawEl.value.trim()) rawEl.value = tk.spaDescription;
    const qbInput = document.getElementById('qbNotesInput');
    if (qbInput && !qbInput.value.trim()) qbInput.value = tk.spaDescription;
    try {
      const parsed = parseQbNotesText(tk.spaDescription);
      if (parsed) {
        if (parsed.spaModel && fillIfEmpty('cSpaModel', parsed.spaModel)) filled.push('modelo (parsed)');
        if (parsed.serialNumber && fillIfEmpty('cSerial', parsed.serialNumber)) filled.push('serial (parsed)');
        if (parsed.address && fillIfEmpty('cAddress', parsed.address)) filled.push('addr (parsed)');
        if (parsed.boardNumber && fillIfEmpty('cBoard', parsed.boardNumber)) filled.push('board');
        if (parsed.heaterNumber && fillIfEmpty('cHeater', parsed.heaterNumber)) filled.push('heater');
        if (parsed.topsideNumber && fillIfEmpty('cTopside', parsed.topsideNumber)) filled.push('topside');
        if (parsed.cabinet && fillIfEmpty('cCabinet', parsed.cabinet)) filled.push('cabinet');
      }
    } catch (e) { console.warn('Parse failed:', e); }
  }
  
  if (filled.length === 0) {
    toast(currentLang === 'en' ? 'All fields already had values, nothing imported' : 'Todos los campos ya tenían valor, nada importado', 'success');
  } else {
    const msg = currentLang === 'en' 
      ? `✓ Imported: ${filled.join(', ')}. Click Update to save.`
      : `✓ Importado: ${filled.join(', ')}. Click Actualizar para guardar.`;
    toast(msg, 'success');
    // Update the panel to confirm
    document.getElementById('cTixResults').innerHTML = `<div style="font-size:11px;color:var(--sent);padding:4px;font-weight:600;">${escapeHtml(msg)}</div>`;
  }
  window._pendingTixImport = null;
};

window.saveCustomer = async function() {
  const data = {
    name: document.getElementById('cName').value.trim(),
    greetingName: document.getElementById('cGreeting').value.trim(),
    email: document.getElementById('cEmail').value.trim(),
    ccEmail: document.getElementById('cCcEmail').value.trim(),
    phone: document.getElementById('cPhone').value.trim(),
    mobilePhone: document.getElementById('cMobilePhone').value.trim(),
    altPhone: document.getElementById('cAltPhone').value.trim(),
    spaModel: document.getElementById('cSpaModel').value.trim(),
    address: document.getElementById('cAddress').value.trim(),
    serialNumber: document.getElementById('cSerial').value.trim(),
    cabinet: document.getElementById('cCabinet').value.trim(),
    boardNumber: document.getElementById('cBoard').value.trim(),
    heaterNumber: document.getElementById('cHeater').value.trim(),
    topsideNumber: document.getElementById('cTopside').value.trim(),
    qbNotesRaw: document.getElementById('cQbRaw').value.trim(),
    notes: document.getElementById('cNotes').value.trim()
  };
  if (!data.name) {
    toast(currentLang === 'en' ? 'Customer name is required' : 'El nombre del cliente es requerido', 'error');
    return;
  }
  // Email format check only if provided (email is OPTIONAL)
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    toast(currentLang === 'en' ? 'Invalid email format' : 'Formato de email inválido', 'error');
    return;
  }
  if (data.ccEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.ccEmail)) {
    toast(currentLang === 'en' ? 'Invalid CC email format' : 'Formato de CC email inválido', 'error');
    return;
  }
  if (editingCustomerId) {
    await updateCustomerData(editingCustomerId, data);
    toast(currentLang === 'en' ? 'Customer updated' : 'Cliente actualizado', 'success');
  } else {
    await createCustomer(data);
    toast(currentLang === 'en' ? 'Customer added' : 'Cliente agregado', 'success');
  }
  closeModal('customerModal');
};

window.deleteCurrentCustomer = async function() {
  if (!editingCustomerId) return;
  const c = allCustomers.find(x => x.id === editingCustomerId);
  if (!confirm(`¿Eliminar a "${c.name}" de tu lista de clientes? Las facturas existentes no se afectan.`)) return;
  await deleteCustomer(editingCustomerId);
  toast(currentLang === 'en' ? 'Customer deleted' : 'Cliente eliminado', 'success');
  closeModal('customerModal');
};

// ════════════════════════════════════════════════════════════
// QB NOTES PARSER
// ════════════════════════════════════════════════════════════
// QuickBooks NOTES blocks often use a 2-column layout where the right side
// holds the address (street #, street name, city/state, zip) and the left
// side holds spa info (model, dates, pack, components). Lines are separated
// by 2+ spaces. We split into left/right streams, then parse each.
// ════════════════════════════════════════════════════════════
// WARRANTY CALCULATOR — Aspen Spas policy engine
// Based on official Warranty Breakdown chart:
//   VS series: Labor Y1 free, Parts Y1-3 free
//   GS series: Labor Y1 free, Y2-5 trip charge; Parts Y1-3 free, Y4-5 50% MSRP
//   GS+ series: same coverage as GS (Aspen internal — confirmar con Tom/Sam si cambia)
//   ES series: Parts & Labor Y1-5 full coverage (100%)
//   SS (Swim Spa) series: Parts & Labor Y1-3 full coverage (100%) — Aspen internal
//   1-year items: stereo, speakers, lifts, covers, ozone, salt system, lights, waterfall, pump seals
//   3-month items: pillows
//   Hard cutoff: spas delivered 2019 or earlier = out of warranty
//   Trip Charge (TC) = $150 base + $100/hr overage (billed as separate line items) — updated May 2026
// ════════════════════════════════════════════════════════════
const WARRANTY_YEAR_ONE_ITEMS = ['stereo', 'speakers', 'lifts', 'covers', 'ozone', 'salt system', 'salt', 'stainless band', 'led', 'pin lights', 'waterfall', 'pump seals', 'pump', 'heater', 'control pack', 'pack'];
const TRIP_CHARGE_AMOUNT = 150;  // Aspen Spas standard TC (May 2026)

function detectSpaSeries(spaModel) {
  if (!spaModel) return null;
  const m = spaModel.toUpperCase();
  // PRODUCT-FAMILY OVERRIDE: "Swim Spa" always uses SS/3-year warranty,
  // even when the description also contains ES/GS/VS (e.g. "Swim Spa - ES").
  // Therefore Swim Spa MUST be checked before ordinary series tokens.
  if (/\bSWIM[\s-]*SPA\b/.test(m) || /^\s*SWIM\b/.test(m)) return 'SS';
  // Order matters for normal hot tubs: ES → SS → GS+ → GS → VS
  if (/\bES\b/.test(m)) return 'ES';
  if (/\bSS\b/.test(m)) return 'SS';
  if (/\bGS\s*\+|\bGS\+/.test(m)) return 'GS+';
  if (/\bGS\b/.test(m)) return 'GS';
  if (/\bVS\b/.test(m)) return 'VS';
  return null;
}

function calculateWarranty({ spaModel, deliveryDate, serviceDate, specialItem }) {
  const out = { series: null, ageYears: null, year: null, verdict: 'UNKNOWN', reason: '', laborCharge: false, partsCharge: false, partsPct: 0, laborPct: 0, notes: [] };
  
  if (!spaModel) { out.reason = 'Falta modelo del spa'; return out; }
  if (!deliveryDate) { out.reason = 'Falta fecha de delivery'; return out; }
  
  out.series = detectSpaSeries(spaModel);
  if (!out.series) { out.reason = 'No se detectó la serie (VS/GS/ES) en el modelo'; return out; }
  
  const delivery = new Date(deliveryDate);
  if (isNaN(delivery)) { out.reason = 'Fecha de delivery inválida'; return out; }
  
  const service = serviceDate ? new Date(serviceDate) : new Date();
  if (isNaN(service)) { out.reason = 'Fecha de servicio inválida'; return out; }
  
  out.ageYears = (service - delivery) / (365.25 * 24 * 60 * 60 * 1000);
  out.year = Math.max(1, Math.ceil(out.ageYears)); // Year 1 = 0-1 years, Year 2 = 1-2, etc.
  
  // Hard cutoff: 2019 or earlier delivery = OUT
  if (delivery.getFullYear() <= 2019) {
    out.verdict = 'OUT_OF_WARRANTY';
    out.reason = `Delivery ${delivery.getFullYear()} — Aspen policy: spas de 2019 o anteriores están 100% fuera de garantía`;
    out.laborCharge = true; out.partsCharge = true; out.partsPct = 100; out.laborPct = 100;
    return out;
  }
  
  // Pillows special — 3 months only
  if (specialItem && /pillow|almohad/i.test(specialItem)) {
    const months = out.ageYears * 12;
    if (months > 3) {
      out.verdict = 'OUT_OF_WARRANTY';
      out.reason = `Pillows: solo 3 meses de garantía (lleva ${months.toFixed(1)} meses)`;
      out.laborCharge = true; out.partsCharge = true; out.partsPct = 100; out.laborPct = 100;
    } else {
      out.verdict = 'COVERED';
      out.reason = 'Pillows: dentro de los 3 meses, cubierto';
    }
    return out;
  }
  
  // 1-year items override (regardless of series)
  if (specialItem) {
    const itemLower = specialItem.toLowerCase();
    const isYearOneItem = WARRANTY_YEAR_ONE_ITEMS.some(i => itemLower.includes(i));
    if (isYearOneItem) {
      if (out.ageYears > 1) {
        out.verdict = 'OUT_OF_WARRANTY';
        out.reason = `Item de 1 año (${specialItem}): garantía expiró (${out.ageYears.toFixed(1)} años)`;
        out.laborCharge = true; out.partsCharge = true; out.partsPct = 100; out.laborPct = 100;
      } else {
        out.verdict = 'COVERED';
        out.reason = `Item de 1 año (${specialItem}): dentro de garantía`;
      }
      return out;
    }
  }
  
  // Series-specific logic
  if (out.series === 'VS') {
    if (out.ageYears <= 1) {
      out.verdict = 'COVERED'; out.reason = 'VS Año 1: Labor + Parts cubiertos';
    } else if (out.ageYears <= 3) {
      out.verdict = 'PARTIAL'; out.reason = 'VS Año 2-3: Parts cubiertos, Labor con cargo';
      out.laborCharge = true; out.laborPct = 100;
      out.notes.push('Cobra labor completo');
    } else {
      out.verdict = 'OUT_OF_WARRANTY'; out.reason = `VS más de 3 años (${out.ageYears.toFixed(1)})`;
      out.laborCharge = true; out.partsCharge = true; out.partsPct = 100; out.laborPct = 100;
    }
  } else if (out.series === 'GS' || out.series === 'GS+') {
    // GS+ uses the same coverage as GS per current Aspen internal policy.
    // Si Tom/Sam cambian la regla para GS+, actualizar aquí.
    const label = out.series;  // preserve original label ('GS' or 'GS+')
    if (out.ageYears <= 1) {
      out.verdict = 'COVERED'; out.reason = `${label} Año 1: Labor + Parts cubiertos`;
    } else if (out.ageYears <= 3) {
      out.verdict = 'PARTIAL'; out.reason = `${label} Año 2-3: Parts cubiertos, Labor = TRIP CHARGE únicamente ($${TRIP_CHARGE_AMOUNT})`;
      out.laborCharge = 'TRIP_CHARGE'; out.laborPct = 0;
      out.tripChargeAmount = TRIP_CHARGE_AMOUNT;
      out.notes.push(`Solo cobra trip charge de $${TRIP_CHARGE_AMOUNT} (no labor completo)`);
    } else if (out.ageYears <= 5) {
      out.verdict = 'PARTIAL'; out.reason = `${label} Año 4-5: Parts 50% MSRP, Labor = TRIP CHARGE únicamente ($${TRIP_CHARGE_AMOUNT})`;
      out.laborCharge = 'TRIP_CHARGE'; out.partsCharge = true; out.partsPct = 50;
      out.tripChargeAmount = TRIP_CHARGE_AMOUNT;
      out.notes.push(`Cobra 50% del MSRP en parts + trip charge de $${TRIP_CHARGE_AMOUNT}`);
    } else {
      out.verdict = 'OUT_OF_WARRANTY'; out.reason = `${label} más de 5 años (${out.ageYears.toFixed(1)})`;
      out.laborCharge = true; out.partsCharge = true; out.partsPct = 100; out.laborPct = 100;
    }
  } else if (out.series === 'ES') {
    if (out.ageYears <= 5) {
      out.verdict = 'COVERED'; out.reason = 'ES Año 1-5: cobertura total 100%';
    } else {
      out.verdict = 'OUT_OF_WARRANTY'; out.reason = `ES más de 5 años (${out.ageYears.toFixed(1)})`;
      out.laborCharge = true; out.partsCharge = true; out.partsPct = 100; out.laborPct = 100;
    }
  } else if (out.series === 'SS') {
    // Swim Spa — 3 años full warranty (parts + labor)
    if (out.ageYears <= 3) {
      out.verdict = 'COVERED'; out.reason = 'SS (Swim Spa) Año 1-3: cobertura total 100%';
    } else {
      out.verdict = 'OUT_OF_WARRANTY'; out.reason = `SS (Swim Spa) más de 3 años (${out.ageYears.toFixed(1)})`;
      out.laborCharge = true; out.partsCharge = true; out.partsPct = 100; out.laborPct = 100;
    }
  }
  
  return out;
}


function parseQbNotesText(raw) {
  if (!raw) return null;
  const txt = raw.replace(/\r/g, '').trim();
  if (!txt) return null;
  const rawLines = txt.split('\n').map(l => l.trimEnd()).filter(l => l.trim());

  const out = {
    spaModel: '', address: '', serialNumber: '', boardNumber: '',
    heaterNumber: '', topsideNumber: '', cabinet: '',
    delivered: '', ordered: '', jets: '', pumps: '', pack: '',
    extras: []
  };

  // ════════════════════════════════════════════════════
  // PHASE 1: LABEL-BASED EXTRACTION (high confidence)
  // Handles NEW QB format: "Spa Model: 2011 Pinnacle GS",
  // "Cabinet Material: Durawood   Cabinet Color: Cedar", etc.
  // ════════════════════════════════════════════════════
  // Extract value AFTER a known label. Stops at:
  //   - 2+ spaces (column break)
  //   - end of line
  //   - another known label
  function extractLabel(text, labelSrc) {
    const stopAtOtherLabel = '(?=\\s+(?:Acrylic|Cabinet\\s*(?:Material|Color)|Spa\\s*Model|Del(?:ivered)?|Ordered|Board|Heater|Topside|Pump|Serial|Address|Stereo|Wifi|Lights?|Pillow|Pack)\\s*[:=#])';
    const re = new RegExp(
      `(?:^|\\s)(?:${labelSrc})\\s*[:=#]\\s*([^\\n]+?)(?:\\s{2,}|${stopAtOtherLabel}|$)`,
      'i'
    );
    const m = text.match(re);
    if (!m) return '';
    return m[1].trim().replace(/[,;]+$/, '');
  }

  // Run label extraction line-by-line
  for (const ln of rawLines) {
    if (!out.spaModel)      out.spaModel      = extractLabel(ln, 'Spa\\s*Model');
    if (!out.delivered)     out.delivered     = extractLabel(ln, 'Del(?:ivered)?');
    if (!out.ordered)       out.ordered       = extractLabel(ln, 'Ordered');
    if (!out.boardNumber)   out.boardNumber   = extractLabel(ln, 'Board');
    if (!out.heaterNumber)  out.heaterNumber  = extractLabel(ln, 'Heater');
    if (!out.topsideNumber) out.topsideNumber = extractLabel(ln, 'Topside(?:\\s*Ser(?:ial)?)?');
    if (!out.serialNumber) {
      const v = extractLabel(ln, 'Serial');
      const d = v.match(/\d{3,}/);
      if (d) out.serialNumber = d[0];
    }
  }

  // Cabinet — combine "Cabinet Material" + "Cabinet Color" if both present
  let cabMat = '', cabColor = '';
  for (const ln of rawLines) {
    if (!cabMat)   cabMat   = extractLabel(ln, 'Cabinet\\s*Material');
    if (!cabColor) cabColor = extractLabel(ln, 'Cabinet\\s*Color');
  }
  if (cabMat && cabColor) out.cabinet = `${cabMat} / ${cabColor}`;
  else if (cabMat)        out.cabinet = cabMat;
  else if (cabColor)      out.cabinet = cabColor;

  // ════════════════════════════════════════════════════
  // PHASE 2: POSITIONAL FALLBACK (old format)
  // Only runs for fields NOT found in Phase 1.
  // ════════════════════════════════════════════════════
  const leftLines = [], rightLines = [];
  for (const ln of rawLines) {
    const m = ln.match(/^(\s*)(.+?)(\s{2,})(.+?)\s*$/);
    if (m && m[2].trim() && m[4].trim()) {
      leftLines.push(m[2].trim());
      rightLines.push(m[4].trim());
    } else {
      const indent = ln.match(/^\s*/)[0].length;
      const c = ln.trim();
      if (indent > 20) rightLines.push(c); else leftLines.push(c);
    }
  }
  const allLines = [...leftLines, ...rightLines];

  // Helper: does the line look like a "Label: value" line we already parsed?
  const isLabelLine = (l) => /^(?:Spa\s*Model|Cabinet\s*(?:Material|Color)|Acrylic\s*Color|Del(?:ivered)?\s*[:=]|Ordered\s*[:=]|Board\s*[#:=]|Heater\s*[#:=]|Topside.*?[#:=]|Serial.*?[#:=]|Address\s*[:=])/i.test(l);

  // Spa Model fallback: line starting with year + word
  if (!out.spaModel) {
    for (const l of leftLines) {
      if (/^(19|20)\d{2}\s+[A-Za-z]/.test(l) && !/^(Del|Ord)/i.test(l)) {
        out.spaModel = l.trim(); break;
      }
    }
  }

  // Serial fallback: line starting with "# 1234567" or pure 10+ digit line
  if (!out.serialNumber) {
    for (const l of allLines) {
      const m = l.match(/^#\s*([0-9]{4,})/);
      if (m) { out.serialNumber = m[1]; break; }
    }
  }
  if (!out.serialNumber) {
    const dig = allLines.find(l => /^\d{10,}$/.test(l));
    if (dig) out.serialNumber = dig;
  }

  // ════════════════════════════════════════════════════
  // ADDRESS — STRICT MODE.
  // Only fill if we find a real "City, ST Zip" pattern.
  // (Notes usually don't contain addresses — those live in
  // the QB customer card itself, not the NOTES block. So
  // we'd rather leave address empty than guess wrong.)
  // ════════════════════════════════════════════════════
  const cityStateZipRe = /^([A-Z][A-Za-z\.\s]+?),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/;
  const streetRe       = /^(\d{2,6})\s+([A-Z][A-Za-z\.][a-zA-Z\s\.]{2,40})$/;

  let streetLine = '', cityLine = '';
  let cityNoZip = '', zipOnly = '';
  for (const l of allLines) {
    if (isLabelLine(l)) continue;
    if (!streetLine) {
      const m = l.match(streetRe);
      if (m) {
        const num = parseInt(m[1], 10);
        const looksLikeYear = num >= 1900 && num <= 2099;
        const looksLikeSpa = /(Pinnacle|Eldorado|El\s+Dorado|VS|GS|ES|SS|Plus|Pro|Vista|Summit)\s*$/i.test(m[2]);
        if (!looksLikeYear && !looksLikeSpa) streetLine = `${m[1]} ${m[2].trim()}`;
      }
    }
    if (!cityLine) {
      const m = l.match(cityStateZipRe);
      if (m) cityLine = `${m[1].trim()}, ${m[2]} ${m[3]}`;
    }
    // City+State on its own line (no zip yet), e.g. "Oakville, MO"
    if (!cityNoZip) {
      const m = l.match(/^([A-Z][A-Za-z\.\s]+?),\s*([A-Z]{2})$/);
      if (m) cityNoZip = `${m[1].trim()}, ${m[2]}`;
    }
    // Standalone 5-digit zip on its own line
    if (!zipOnly && /^\d{5}(-\d{4})?$/.test(l)) zipOnly = l;
  }
  // If we didn't get the full city,state,zip on one line, try to combine fragments
  if (!cityLine && cityNoZip && zipOnly) cityLine = `${cityNoZip} ${zipOnly}`;
  else if (!cityLine && cityNoZip) cityLine = cityNoZip;

  // Only set address if we have a city line (most reliable marker).
  // Bare street without city is too risky → leave empty.
  if (cityLine && streetLine) out.address = `${streetLine}\n${cityLine}`;
  else if (cityLine)          out.address = cityLine;

  // Pack
  if (!out.pack) {
    for (const l of allLines) {
      const m = l.match(/(Balboa[^,\n]*|Gecko[^,\n]*|ACC[^,\n]*?\d|Smart[\s]?Touch[^,\n]*|in\.[a-z]+[^,\n]*)/i);
      if (m) { out.pack = m[1].trim(); break; }
    }
  }

  // Jets, pumps
  for (const l of allLines) {
    if (!out.jets && /\d+\s*(WW|jets?)\b/i.test(l) && !isLabelLine(l)) out.jets = l;
    if (!out.pumps && /pumps?/i.test(l) && /(amp|hp)/i.test(l)) out.pumps = l;
  }

  // Cabinet fallback (only if Phase 1 didn't find it)
  if (!out.cabinet) {
    for (const l of allLines) {
      if (isLabelLine(l)) continue;
      if (/durawood|mahogany|cedar|chestnut/i.test(l)) {
        out.cabinet = l.replace(/^Cabinet\s*Material\s*[:=]\s*/i, '').trim();
        break;
      }
    }
  }

  // Extras
  const usedValues = new Set([
    out.spaModel, out.cabinet, out.delivered, out.ordered, out.pack,
    out.serialNumber, out.boardNumber, out.heaterNumber, out.topsideNumber,
    out.jets, out.pumps, streetLine, cityLine
  ].filter(Boolean));
  for (const l of leftLines) {
    if (!l || isLabelLine(l)) continue;
    if (usedValues.has(l)) continue;
    if (l === out.spaModel) continue;
    if (/^\d+$/.test(l)) continue;
    if (out.extras.length < 10) out.extras.push(l);
  }

  return out;
}

window.parseQbNotes = function() {
  const raw = document.getElementById('qbNotesInput').value;
  if (!raw.trim()) {
    toast('Pega primero las notas de QB', 'error');
    return;
  }
  const parsed = parseQbNotesText(raw);
  if (!parsed) {
    toast('No pude parsear el texto', 'error');
    return;
  }

  // Auto-fill form fields (only if currently empty, to not overwrite user data)
  const fillIfEmpty = (id, val) => {
    if (!val) return false;
    const el = document.getElementById(id);
    if (!el) return false;
    if (!el.value.trim()) { el.value = val; return true; }
    return false;
  };
  let filled = [];
  if (fillIfEmpty('cSpaModel', parsed.spaModel)) filled.push('Modelo');
  if (fillIfEmpty('cAddress', parsed.address)) filled.push('Dirección');
  if (fillIfEmpty('cSerial', parsed.serialNumber)) filled.push('Serial');
  if (fillIfEmpty('cBoard', parsed.boardNumber)) filled.push('Board');
  if (fillIfEmpty('cHeater', parsed.heaterNumber)) filled.push('Heater');
  if (fillIfEmpty('cTopside', parsed.topsideNumber)) filled.push('Topside');
  if (fillIfEmpty('cCabinet', parsed.cabinet || parsed.pack)) filled.push('Cabinet/Pack');

  // Always store raw notes
  document.getElementById('cQbRaw').value = raw.trim();

  const result = document.getElementById('qbParseResult');
  if (filled.length === 0) {
    result.innerHTML = `<strong>⚠️ No se extrajo nada nuevo</strong><br>Los campos ya tenían datos. Mira abajo y edita lo que necesites manualmente.`;
  } else {
    result.innerHTML = `<strong>✓ Llené: ${filled.join(', ')}</strong>${parsed.extras.length ? `<br><span style="color:#047857;">Extras detectados: ${escapeHtml(parsed.extras.join(' · '))}</span>` : ''}`;
  }
  result.classList.add('show');
  toast(`✓ Parseado: ${filled.length} campos`, 'success');
};

// ════════════════════════════════════════════════════════════
// SEARCH & IMPORT FROM TICKETS DB into customer form
// ════════════════════════════════════════════════════════════
let _tixSearchDebounce = null;
window.searchTixForImport = function(e) {
  const q = e.target.value.trim();
  const resEl = document.getElementById('cTixResults');
  clearTimeout(_tixSearchDebounce);
  if (!q || q.length < 2) {
    resEl.innerHTML = '';
    return;
  }
  const en = currentLang === 'en';
  resEl.innerHTML = `<div style="font-size:11px;color:var(--text-mute);font-style:italic;padding:4px;">${en ? 'Searching…' : 'Buscando…'}</div>`;
  _tixSearchDebounce = setTimeout(async () => {
    try {
      // Force fetch the full list so we have count + samples for diagnostic
      const allCustomers = await fetchAllTicketsCustomers();
      const results = smartMatchCustomer(q, allCustomers);
      
      if (results.length === 0) {
        // Diagnostic info: show how many customers TICKETS has and a few sample names
        const totalInTickets = allCustomers.length;
        if (totalInTickets === 0) {
          // Likely permissions issue or empty DB
          resEl.innerHTML = `
            <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:var(--r-sm);padding:10px;">
              <div style="font-size:12px;font-weight:700;color:#92400E;margin-bottom:4px;">⚠ ${en ? 'TICKETS database returned 0 customers' : 'TICKETS DB devolvió 0 clientes'}</div>
              <div style="font-size:11px;color:#78350F;line-height:1.4;">
                ${en
                  ? 'This usually means: (a) Firestore rules block public read, OR (b) the database is empty. Open browser console (Cmd+Opt+J) and look for HTTP 403 errors. Solution: deploy the firestore.rules from terminal.'
                  : 'Esto normalmente significa: (a) las reglas de Firestore bloquean la lectura pública, O (b) la base de datos está vacía. Abre la consola del navegador (Cmd+Opt+J) y busca errores HTTP 403. Solución: deploya el archivo firestore.rules desde terminal.'}
              </div>
            </div>`;
        } else {
          // DB has customers but no match for this query — show first 3 names as samples
          const samples = allCustomers.slice(0, 3).map(c => c.name).filter(Boolean).slice(0, 3);
          resEl.innerHTML = `
            <div style="font-size:11px;color:var(--text-mute);padding:6px;">
              <div style="margin-bottom:4px;">${en ? `No match in ${totalInTickets} customers from TICKETS DB.` : `Sin match en ${totalInTickets} clientes de TICKETS DB.`}</div>
              ${samples.length > 0 ? `<div style="color:var(--text-soft);font-size:11px;">${en ? 'Examples in DB' : 'Ejemplos en DB'}: ${samples.map(s => escapeHtml(s)).join(' · ')}</div>` : ''}
              <div style="margin-top:6px;color:var(--text-soft);font-size:11px;">${en ? 'Try with last name only, or check spelling.' : 'Intenta solo con apellido, o verifica ortografía.'}</div>
            </div>`;
        }
        return;
      }
      resEl.innerHTML = results.slice(0, 5).map((t, idx) => `
        <div style="padding:8px 10px;background:white;border:1px solid #BFDBFE;border-radius:var(--r-sm);margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div style="min-width:0;flex:1;">
            <div style="font-size:13px;font-weight:600;">${escapeHtml(t.name)}</div>
            <div style="font-size:11px;color:var(--text-soft);">${escapeHtml(t.email || '')}${t.phone ? ' · ' + escapeHtml(t.phone) : ''}${t.address ? ' · ' + escapeHtml(t.address) : ''}${t.visits ? ` · ${t.visits} ${en ? 'visits' : 'visitas'}` : ''}</div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick='window.applyTixImport(${idx})'>↓ ${en ? 'Import' : 'Importar'}</button>
        </div>
      `).join('');
      window._tixLastResults = results;
    } catch (err) {
      const en = currentLang === 'en';
      const is401 = /401/.test(err.message || '');
      // For a 401, the real cause is almost always the auth token — show the
      // human hint (network vs anonymous-auth-disabled) instead of a raw code.
      const hint = is401 ? getTicketsConnectionHint(currentLang) : (err.message || 'Error');
      resEl.innerHTML = `<div style="font-size:11px;color:var(--pending);padding:6px 4px;line-height:1.5;">
        ⚠ ${escapeHtml(hint)}
        <button type="button" onclick="window.retryTixCustomerFetch()" style="margin-left:6px;background:none;border:1px solid var(--pending);color:var(--pending);border-radius:5px;padding:1px 8px;font-size:11px;font-weight:700;cursor:pointer;">🔄 ${en ? 'Retry' : 'Reintentar'}</button>
      </div>`;
    }
  }, 350);
};

// Force-clear the cached (failed) auth token + customer cache and re-run the
// last customer search. Wired to the 🔄 Retry button shown on a 401.
window.retryTixCustomerFetch = function() {
  _ticketsAuthToken = null;
  _ticketsAuthTokenExp = 0;
  _ticketsCustCache = null;
  _ticketsCustCacheTs = 0;
  const input = document.getElementById('cTixSearch');
  if (input) {
    if (typeof window.searchTixForImport === 'function') { window.searchTixForImport({ target: input }); }
    else { input.dispatchEvent(new Event('input')); }
  }
  toast(currentLang === 'en' ? 'Reconnecting to TECH-TICKETS…' : 'Reconectando a TECH-TICKETS…', 'info');
};

window.applyTixImport = function(idx) {
  const tk = (window._tixLastResults || [])[idx];
  if (!tk) return;
  // Fill form fields (only if empty, to not overwrite user edits)
  const fillIfEmpty = (id, val) => {
    if (!val) return;
    const el = document.getElementById(id);
    if (el && !el.value.trim()) el.value = val;
  };
  fillIfEmpty('cName', tk.name);
  fillIfEmpty('cGreeting', tk.greetingName || deriveGreetingName(tk.name));
  fillIfEmpty('cEmail', tk.email);
  fillIfEmpty('cPhone', tk.phone);
  fillIfEmpty('cAddress', tk.address);
  fillIfEmpty('cSpaModel', tk.spaModel);
  fillIfEmpty('cSerial', tk.serialNumber);
  
  // ─── Auto-parse spaDescription if present ───────────────────────
  // TECH-TICKETS stores delivery/serial/model/jets/pumps as multiline text
  // We pipe it through parseQbNotesText to extract structured fields automatically
  let parseMsg = '';
  if (tk.spaDescription && tk.spaDescription.trim()) {
    // Pre-fill QB notes paste textarea with the spa description (so user sees it & can re-parse)
    const qbInput = document.getElementById('qbNotesInput');
    if (qbInput && !qbInput.value.trim()) {
      qbInput.value = tk.spaDescription;
    }
    // Try the parser
    try {
      const parsed = parseQbNotesText(tk.spaDescription);
      if (parsed) {
        const parsedFields = [];
        if (parsed.spaModel) { fillIfEmpty('cSpaModel', parsed.spaModel); parsedFields.push(currentLang === 'en' ? 'model' : 'modelo'); }
        if (parsed.serialNumber) { fillIfEmpty('cSerial', parsed.serialNumber); parsedFields.push(currentLang === 'en' ? 'serial' : 'serial'); }
        if (parsed.address && !document.getElementById('cAddress').value.trim()) {
          document.getElementById('cAddress').value = parsed.address;
          parsedFields.push(currentLang === 'en' ? 'address' : 'dirección');
        }
        if (parsed.boardNumber) { fillIfEmpty('cBoard', parsed.boardNumber); parsedFields.push('board'); }
        if (parsed.heaterNumber) { fillIfEmpty('cHeater', parsed.heaterNumber); parsedFields.push('heater'); }
        if (parsed.topsideNumber) { fillIfEmpty('cTopside', parsed.topsideNumber); parsedFields.push('topside'); }
        if (parsed.cabinet) { fillIfEmpty('cCabinet', parsed.cabinet); parsedFields.push('cabinet'); }
        // Save the raw spa description text in cQbRaw (the reference field)
        const rawEl = document.getElementById('cQbRaw');
        if (rawEl && !rawEl.value.trim()) rawEl.value = tk.spaDescription;
        if (parsedFields.length) parseMsg = t('toast.autoExtracted', parsedFields.join(', '));
      }
    } catch (e) {
      console.warn('Spa description parse failed', e);
    }
  }
  
  const importedLabel = currentLang === 'en' ? 'Imported from TICKETS' : 'Importado de TICKETS';
  document.getElementById('cTixResults').innerHTML = `<div style="font-size:11px;color:var(--sent);padding:4px;font-weight:600;">✓ ${importedLabel}: ${escapeHtml(tk.name)}${parseMsg ? '<br>' + escapeHtml(parseMsg) : ''}</div>`;
  toast(t('toast.ticketsImported', tk.name || '', parseMsg), 'success');
};

// ════════════════════════════════════════════════════════════
// PAYMENT STATUS HANDLERS
// ════════════════════════════════════════════════════════════
let psEditingId = null;
let psSelectedReason = '';
let psSelectedMethod = '';

// ════════════════════════════════════════════════════════════
// WARRANTY CALCULATOR — UI bindings
// ════════════════════════════════════════════════════════════
let _warrantyLastResult = null;
let _warrantyStandalone = false;  // true cuando se abre desde toolbar, no desde Nueva Factura

window.openWarrantyStandalone = function() {
  // Standalone mode: empty form, no "Apply to invoice" button.
  _warrantyStandalone = true;
  document.getElementById('wcSpaModel').value = '';
  document.getElementById('wcDeliveryDate').value = '';
  document.getElementById('wcServiceDate').value = _hoyLocal(); // v2.64.0: local date, not UTC (after 7pm CDT the UTC date is tomorrow)
  document.getElementById('wcSpecialItem').value = '';
  document.getElementById('wcLaborCost').value = '';
  document.getElementById('wcPartsCost').value = '';
  document.getElementById('wcResult').style.display = 'none';
  document.getElementById('wcApplyBtn').style.display = 'none';
  document.getElementById('warrantyModal').classList.add('open');
  // Focus model field for fast entry
  setTimeout(() => document.getElementById('wcSpaModel').focus(), 50);
};

window.openWarrantyFromInvoice = function() {
  // Invoice-form mode: pre-fill from invoice form, then open modal
  _warrantyStandalone = false;
  const spaModel = document.getElementById('fSpaModel').value.trim();
  const serviceDate = document.getElementById('fServiceDate').value;
  document.getElementById('wcSpaModel').value = spaModel;
  document.getElementById('wcServiceDate').value = serviceDate || _hoyLocal(); // v2.64.0: local date, not UTC
  // Try to detect delivery date from QB notes if cliente está autocompletado
  const customerName = document.getElementById('fCustomerName').value.trim();
  const c = findCustomerByName(customerName);
  if (c && c.qbNotesRaw) {
    const parsed = parseQbNotesText(c.qbNotesRaw);
    if (parsed && parsed.delivered) {
      // Convert MM/DD/YYYY to YYYY-MM-DD
      const m = parsed.delivered.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if (m) {
        let yr = m[3].length === 2 ? '20' + m[3] : m[3];
        document.getElementById('wcDeliveryDate').value = `${yr}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
      }
    }
  }
  document.getElementById('wcResult').style.display = 'none';
  document.getElementById('wcApplyBtn').style.display = 'none';
  document.getElementById('warrantyModal').classList.add('open');
};

window.runWarrantyCalc = function() {
  const spaModel = document.getElementById('wcSpaModel').value.trim();
  const deliveryDate = document.getElementById('wcDeliveryDate').value;
  const serviceDate = document.getElementById('wcServiceDate').value;
  const specialItem = document.getElementById('wcSpecialItem').value;
  const laborCost = parseFloat(document.getElementById('wcLaborCost').value) || 0;
  const partsCost = parseFloat(document.getElementById('wcPartsCost').value) || 0;
  
  const result = calculateWarranty({ spaModel, deliveryDate, serviceDate, specialItem });
  _warrantyLastResult = result;
  
  // Build the result UI
  let bgColor, borderColor, titleColor, icon, verdictText;
  switch (result.verdict) {
    case 'COVERED':
      bgColor = '#ECFDF5'; borderColor = '#6EE7B7'; titleColor = '#047857';
      icon = '✅'; verdictText = currentLang === 'en' ? 'COVERED — No charge to customer' : 'CUBIERTO — No cobrar al cliente';
      break;
    case 'PARTIAL':
      bgColor = '#FEF3C7'; borderColor = '#FCD34D'; titleColor = '#92400E';
      icon = '⚠'; verdictText = currentLang === 'en' ? 'PARTIAL coverage — Partial charge' : 'COBERTURA PARCIAL — Cobro parcial';
      break;
    case 'OUT_OF_WARRANTY':
      bgColor = '#FEF2F2'; borderColor = '#FCA5A5'; titleColor = '#991B1B';
      icon = '❌'; verdictText = currentLang === 'en' ? 'OUT OF WARRANTY — Charge in full' : 'FUERA DE GARANTÍA — Cobro completo';
      break;
    default:
      bgColor = '#F1F5F9'; borderColor = '#CBD5E1'; titleColor = '#475569';
      icon = 'ℹ'; verdictText = currentLang === 'en' ? 'INCOMPLETE — Need more info' : 'INCOMPLETO — Faltan datos';
  }
  
  // Calculate suggested charge amounts
  let suggestedTotal = 0;
  let chargeBreakdown = [];
  if (result.laborCharge === true && laborCost > 0) {
    suggestedTotal += laborCost * (result.laborPct / 100);
    chargeBreakdown.push(`Labor: $${laborCost.toFixed(2)} × ${result.laborPct}% = <strong>$${(laborCost * result.laborPct / 100).toFixed(2)}</strong>`);
  } else if (result.laborCharge === 'TRIP_CHARGE') {
    const tc = result.tripChargeAmount || 150;
    suggestedTotal += tc;
    chargeBreakdown.push(currentLang === 'en'
      ? `Labor: <strong>Trip charge only — $${tc}</strong> (no full labor)`
      : `Labor: <strong>Solo trip charge — $${tc}</strong> (no labor completo)`);
  } else if (result.laborCharge === false) {
    chargeBreakdown.push(currentLang === 'en' ? 'Labor: <strong style="color:#047857;">FREE</strong>' : 'Labor: <strong style="color:#047857;">GRATIS</strong>');
  }
  
  if (result.partsCharge && result.partsPct > 0 && partsCost > 0) {
    suggestedTotal += partsCost * (result.partsPct / 100);
    chargeBreakdown.push(`Parts: $${partsCost.toFixed(2)} × ${result.partsPct}% = <strong>$${(partsCost * result.partsPct / 100).toFixed(2)}</strong>`);
  } else if (result.partsCharge === false) {
    chargeBreakdown.push(currentLang === 'en' ? 'Parts: <strong style="color:#047857;">FREE</strong>' : 'Parts: <strong style="color:#047857;">GRATIS</strong>');
  }
  
  const ageStr = result.ageYears !== null ? `${result.ageYears.toFixed(1)} ${currentLang === 'en' ? 'years' : 'años'}` : '—';
  const seriesBadge = result.series ? `<span style="background:${titleColor};color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:0.04em;">${result.series}</span>` : '';
  
  const resEl = document.getElementById('wcResult');
  resEl.innerHTML = `
    <div style="background:${bgColor};border:1px solid ${borderColor};border-radius:var(--r-md);padding:14px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="font-size:24px;">${icon}</div>
        <div style="flex:1;">
          <div style="font-weight:700;color:${titleColor};font-size:14px;">${verdictText}</div>
          <div style="font-size:11px;color:${titleColor};opacity:0.8;">${seriesBadge} ${currentLang === 'en' ? 'Age' : 'Edad'}: ${ageStr}</div>
        </div>
      </div>
      <div style="font-size:13px;color:${titleColor};line-height:1.5;margin-bottom:6px;"><strong>${currentLang === 'en' ? 'Reason' : 'Motivo'}:</strong> ${escapeHtml(result.reason)}</div>
      ${chargeBreakdown.length > 0 ? `
        <div style="border-top:1px solid ${borderColor};padding-top:8px;margin-top:8px;font-size:12px;">
          ${chargeBreakdown.map(l => `<div style="margin-bottom:2px;">${l}</div>`).join('')}
          ${suggestedTotal > 0 ? `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed ${borderColor};font-size:14px;"><strong>${currentLang === 'en' ? 'Suggested total to charge' : 'Total sugerido a cobrar'}: $${suggestedTotal.toFixed(2)}</strong></div>` : ''}
        </div>` : ''}
      ${result.notes.length > 0 ? `<div style="margin-top:6px;font-size:11px;color:${titleColor};font-style:italic;">${result.notes.map(n => `💡 ${escapeHtml(n)}`).join(' · ')}</div>` : ''}
    </div>
  `;
  resEl.style.display = 'block';
  
  // Show "Apply to invoice" button only if we have meaningful data AND we're not in standalone mode
  document.getElementById('wcApplyBtn').style.display = (result.verdict !== 'UNKNOWN' && !_warrantyStandalone) ? 'inline-flex' : 'none';
  // Stash suggested total for apply
  window._warrantySuggestedTotal = suggestedTotal;
};

window.applyWarrantyToInvoice = function() {
  const r = _warrantyLastResult;
  if (!r) return;
  // Append a verdict note to the invoice notes
  const notesEl = document.getElementById('itkFNotes');
  const tag = `[Garantía ${r.series || '?'} · ${r.verdict}] ${r.reason}`;
  const existing = (notesEl.value || '').trim();
  if (!existing.includes(tag)) {
    notesEl.value = existing ? `${existing}\n${tag}` : tag;
  }
  // If suggested total > 0 and amount is empty, prefill
  const total = window._warrantySuggestedTotal || 0;
  const amountEl = document.getElementById('fAmount');
  if (total > 0 && (!amountEl.value || parseFloat(amountEl.value) === 0)) {
    amountEl.value = total.toFixed(2);
  }
  closeModal('warrantyModal');
  toast(currentLang === 'en' ? '✓ Warranty note added to invoice' : '✓ Nota de garantía agregada a la factura', 'success');
};


window.openPaymentModal = function(id) {
  const inv = allInvoices.find(i => i.id === id);
  if (!inv) return;
  psEditingId = id;
  psSelectedReason = inv.paymentReason || '';
  psSelectedMethod = ['auth_net','ipospays','credit_card','square'].includes(inv.paymentMethod) ? 'paytrace' : (inv.paymentMethod || '');
  document.getElementById('psInvNum').textContent = `#${inv.invoiceNumber}`;
  document.getElementById('psCcRequested').checked = !!inv.ccRequested;
  document.getElementById('psNextFollowup').value = inv.nextFollowUp || '';
  document.getElementById('psNote').value = inv.paymentNote || '';
  document.getElementById('psMethodRef').value = inv.paymentRef || '';
  document.getElementById('psCheckLocation').value = inv.checkLocation || '';
  // QB sync state — show block only when a method is selected OR invoice is already paid
  const qbSyncCheckbox = document.getElementById('psQbSynced');
  const qbSyncBlock = document.getElementById('psQbSyncBlock');
  if (qbSyncCheckbox) qbSyncCheckbox.checked = !!inv.qbSynced;
  if (qbSyncBlock) qbSyncBlock.style.display = (psSelectedMethod || inv.status === 'paid') ? 'block' : 'none';
  // Show/hide check tracking section based on selected method
  const checkBlock = document.getElementById('psCheckTracking');
  checkBlock.style.display = (psSelectedMethod === 'check') ? 'block' : 'none';
  
  // Populate alert history (audit trail)
  const alertEvents = (inv.history || []).filter(h => h.action === 'alert_collections' || h.action === 'alert_check' || h.action === 'crossapp_alert_published');
  const alertHistDiv = document.getElementById('psAlertHistory');
  const alertHistList = document.getElementById('psAlertHistoryList');
  if (alertEvents.length > 0) {
    const en = currentLang === 'en';
    alertHistList.innerHTML = alertEvents.slice().reverse().map(ev => {
      const histIdx = (inv.history || []).indexOf(ev);
      const when = new Date(ev.ts);
      const whenStr = when.toLocaleString();
      const icon = ev.action === 'alert_check' ? '💵' : (ev.action === 'crossapp_alert_published' ? '🔔' : '🚨');
      const typeLabel = ev.action === 'alert_check'
        ? (en ? 'Check tracking alert' : 'Alerta tracking de cheque')
        : (ev.action === 'crossapp_alert_published'
            ? (en ? 'Tech alert' : 'Alerta a Tech Team')
            : (en ? 'Collections alert' : 'Alerta de cobros'));
      let extra = '';
      if (ev.action === 'alert_check' && ev.location) {
        const locMap = {
          with_tech: en ? `with tech ${ev.technician || ''}` : `con técnico ${ev.technician || ''}`,
          office: en ? 'in office' : 'en oficina',
          deposited: en ? 'deposited' : 'depositado',
          other: en ? 'other' : 'otro'
        };
        extra = ` — 📍 ${locMap[ev.location] || ev.location}`;
      }
      if (ev.action === 'alert_collections' && ev.reason) {
        const reasonMap = {
          cc_declined: en ? 'CC declined' : 'CC rechazada',
          cc_needed: en ? 'No CC on file' : 'Falta CC'
        };
        extra = ` — ${reasonMap[ev.reason] || ev.reason}`;
      }
      if (ev.action === 'crossapp_alert_published') {
        const reasonMap = {
          cc_declined: en ? 'CC declined' : 'CC rechazada',
          cc_needed: en ? 'No CC on file' : 'Falta CC',
          no_response: en ? 'No response' : 'Sin respuesta',
          disputed: en ? 'Disputed' : 'En disputa',
          partial: en ? 'Partial payment' : 'Pago parcial',
          pending: en ? 'Pending payment' : 'Pago pendiente'
        };
        const sevLabel = ev.severity === 'urgent' ? (en ? '🚨 Urgent' : '🚨 Urgente')
                       : ev.severity === 'info' ? (en ? 'ℹ Info' : 'ℹ Info')
                       : (en ? '⚠ Warning' : '⚠ Aviso');
        extra = ` — ${sevLabel}${ev.reason ? ' · ' + (reasonMap[ev.reason] || ev.reason) : ''}`;
      }
      const pdfNote = (ev.hasPdf || ev.pdfAttached) ? ' 📎' : '';
      
      // Status badge: confirmed (green ✓ Sent) vs not confirmed (yellow ⏰ Generated)
      let statusBadge, confirmBtn = '';
      if (ev.confirmed) {
        const confirmTime = ev.confirmedAt ? new Date(ev.confirmedAt).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}) : '';
        statusBadge = `<span style="background:#DCFCE7;color:#2E8B57;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">✅ ${en ? 'SENT' : 'ENVIADO'}${confirmTime ? ' · ' + confirmTime : ''}</span>`;
      } else {
        statusBadge = `<span style="background:#FEF3C7;color:#92400E;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">⏰ ${en ? 'GENERATED — not confirmed' : 'GENERADO — sin confirmar'}</span>`;
        confirmBtn = `<button onclick="window.confirmSendYesFromHistory('${inv.id}', ${histIdx})" style="margin-top:6px;background:#2E8B57;color:white;border:0;padding:6px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">✅ ${en ? 'I sent it — mark as sent' : 'Sí lo envié — marcar enviado'}</button>`;
      }
      
      return `<div style="padding:8px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">${icon} <strong>${escapeHtml(typeLabel)}</strong>${pdfNote} ${statusBadge}</div>
        <div style="margin-top:4px;">→ ${escapeHtml(ev.recipientName || '')} (${escapeHtml(ev.recipient || '—')})${extra}</div>
        ${ev.publishedBy ? `<div style="font-size:11px;color:var(--text-soft);margin-top:2px;">${en ? 'Published by' : 'Publicado por'}: <b>${escapeHtml(ev.publishedBy)}</b></div>` : ''}
        <div style="color:var(--text-mute);font-size:11px;margin-top:2px;">${escapeHtml(whenStr)}</div>
        ${confirmBtn}
      </div>`;
    }).join('');
    alertHistDiv.style.display = 'block';
  } else {
    alertHistDiv.style.display = 'none';
  }

  // Highlight selected radios
  document.querySelectorAll('#psReasonGroup .ps-radio').forEach(r => {
    r.classList.toggle('active', (r.dataset.val || '') === (inv.paymentReason || ''));
  });
  document.querySelectorAll('#psMethodGroup .ps-radio').forEach(r => {
    r.classList.toggle('active', (r.dataset.method || '') === psSelectedMethod);
  });
  // Show the "⏪ Mark as Unpaid" button only when the invoice is currently paid.
  // Lets the user reverse a wrong "marked as paid" without leaving the modal.
  const unpaidBtn = document.getElementById('psUnpaidBtn');
  if (unpaidBtn) unpaidBtn.style.display = (inv.status === 'paid') ? 'inline-flex' : 'none';

  document.getElementById('paymentModal').classList.add('open');
};

// ════════════════════════════════════════════════════════════
// MARK AS UNPAID — reverses a wrong "marked as paid" without re-creating the invoice.
// Keeps the paymentMethod/paymentRef/paymentNote for audit, just clears the paid flag
// and reverts status to 'sent' (if it was previously sent) or 'pending' otherwise.
// History entry stamps WHO and WHEN so the audit trail is intact.
// ════════════════════════════════════════════════════════════
window.markPaymentAsUnpaid = async function() {
  if (!psEditingId) return;
  const inv = allInvoices.find(i => i.id === psEditingId);
  if (!inv) return;
  if (inv.status !== 'paid') {
    toast(currentLang === 'en' ? 'Invoice is not currently paid' : 'La factura no está marcada como pagada', 'info');
    return;
  }
  const en = currentLang === 'en';
  if (!confirm(en
    ? `Mark invoice #${inv.invoiceNumber} (${inv.customerName}) as UNPAID?\n\nThis reverses the paid status. The payment method and notes will be kept for reference. The QB sync flag will also be cleared.`
    : `¿Marcar factura #${inv.invoiceNumber} (${inv.customerName}) como NO PAGADA?\n\nEsto revierte el estado de pagada. El método y notas se mantienen como referencia. La marca de QB sync también se quita.`)) return;
  // Decide what status to revert to — if the invoice was previously sent (has sentAt), go to 'sent'.
  // Otherwise back to 'pending'. This keeps the natural lifecycle intact.
  const revertStatus = inv.sentAt ? 'sent' : 'pending';
  const now = Date.now();
  const who = getInvoiceTrackerUser() || 'Invoice Tracker';
  const history = [...(inv.history || []), { ts: now, action: 'unmarked_paid', by: who, prevStatus: 'paid' }];
  await updateInvoiceData(psEditingId, {
    status: revertStatus,
    paidAt: null,
    qbSynced: false,  // can't be "synced to QB" if it's not even paid anymore
    history
  });
  toast(en
    ? `⏪ #${inv.invoiceNumber} reverted to ${revertStatus === 'sent' ? 'SENT' : 'PENDING'} — payment method kept for reference`
    : `⏪ #${inv.invoiceNumber} revertida a ${revertStatus === 'sent' ? 'ENVIADA' : 'PENDIENTE'} — método se mantiene como referencia`, 'success');
  closeModal('paymentModal');
};

window.savePaymentStatus = async function() {
  if (!psEditingId) return;
  const ccChecked = document.getElementById('psCcRequested').checked;
  let updates = {
    paymentReason: psSelectedReason || null,
    paymentMethod: psSelectedMethod || null,
    paymentRef: document.getElementById('psMethodRef').value.trim() || null,
    checkLocation: psSelectedMethod === 'check' ? (document.getElementById('psCheckLocation').value || null) : null,
    ccRequested: ccChecked,
    ccRequestedAt: ccChecked ? Date.now() : null,
    nextFollowUp: document.getElementById('psNextFollowup').value || null,
    paymentNote: document.getElementById('psNote').value.trim() || null,
    // QB sync flag — true when the payment has been recorded in QuickBooks Desktop.
    // When false on a paid invoice, it shows up in the "💳 Paid · QB Pending" backlog tab.
    qbSynced: !!document.getElementById('psQbSynced').checked
  };
  
  // ─── AUTO-SNOOZE for CC requested: if newly checked, set follow-up +2 days ───
  const invForCheck = allInvoices.find(i => i.id === psEditingId);
  const wasNotChecked = !invForCheck || !invForCheck.ccRequested;
  if (ccChecked && wasNotChecked && !updates.nextFollowUp) {
    const fu = new Date();
    fu.setDate(fu.getDate() + 2);
    fu.setHours(0, 0, 0, 0);
    updates.nextFollowUp = fu.toISOString().slice(0, 10);
  }
  // If a payment method was selected, auto-mark invoice as paid — EXCEPT for
  // checks not yet deposited (money isn't in our hands yet).
  // NOTE: Auth.net used to be treated as "awaiting" but that was wrong — her
  // dominant workflow is "customer paid via Auth.net Virtual Terminal", so
  // Auth.net now behaves like cash/CC/ACH. For the "I sent an Auth.net invoice
  // and am waiting for payment" case, leave method UNSELECTED and pick a
  // reason like "Pending payment" + set a follow-up date.
  let willMarkPaid = false;
  let willMarkCheckPending = false;
  let willUnmarkPaid = false;
  if (psSelectedMethod) {
    const inv = allInvoices.find(i => i.id === psEditingId);
    const checkPendingDeposit = (psSelectedMethod === 'check' && updates.checkLocation !== 'deposited');
    
    if (inv && inv.status !== 'paid') {
      if (checkPendingDeposit) {
        // Don't mark as paid — keep status as pending, but record the method + location
        willMarkCheckPending = true;
        updates.paymentReason = null;
      } else {
        // Cash / CC / ACH / Auth.net / Other / Check (deposited) → mark as paid
        updates.status = 'paid';
        updates.paidAt = Date.now();
        updates.paymentReason = null;
        willMarkPaid = true;
      }
    } else if (inv && inv.status === 'paid' && checkPendingDeposit) {
      // Was paid, but now user is saying check is NOT yet deposited → un-mark as paid
      updates.status = 'pending';
      updates.paidAt = null;
      willUnmarkPaid = true;
    }
  }
  await updateInvoiceData(psEditingId, updates);
  let toastMsg;
  if (willMarkPaid) {
    toastMsg = currentLang === 'en' ? '✓ Marked as paid' : '✓ Marcada como pagada';
  } else if (willMarkCheckPending) {
    toastMsg = currentLang === 'en'
      ? '📝 Check recorded — invoice stays PENDING until check is deposited at bank'
      : '📝 Cheque registrado — factura sigue PENDIENTE hasta que se deposite en el banco';
  } else if (willUnmarkPaid) {
    toastMsg = currentLang === 'en'
      ? '⏪ Invoice un-marked as paid — pending check deposit'
      : '⏪ Factura des-marcada como pagada — pendiente depósito del cheque';
  } else {
    toastMsg = currentLang === 'en' ? 'Payment status updated' : 'Estado de cobro actualizado';
  }
  toast(toastMsg, 'success');
  closeModal('paymentModal');

  // ─── Gap B fix: when the invoice is now PAID, resolve any open cross-app
  // alerts in TECH-TICKETS so the task closes there too and Nela gets the
  // "resolved" reflection. Best-effort, runs after the modal closes. ───
  if (willMarkPaid) {
    const paidInv = allInvoices.find(i => i.id === psEditingId) || invForCheck;
    const whoResolved = getInvoiceTrackerUser() || 'Invoice Tracker';
    setTimeout(async () => {
      try {
        const r = await resolveInvoiceCrossAppAlerts(paidInv, whoResolved, 'paid_in_invoice_tracker');
        if (r && r.resolved > 0) {
          toast(currentLang === 'en'
            ? `✓ ${r.resolved} TECH-TICKETS alert${r.resolved !== 1 ? 's' : ''} auto-resolved`
            : `✓ ${r.resolved} alerta${r.resolved !== 1 ? 's' : ''} de TECH-TICKETS auto-resuelta${r.resolved !== 1 ? 's' : ''}`, 'success');
          try { if (typeof updateCrossAppInboxBadge === 'function') updateCrossAppInboxBadge(); } catch(_e){}
        }
      } catch(_e){ console.warn('[savePaymentStatus] resolve alerts failed', _e); }
    }, 300);
  }
  
  // ─── If payment problem (declined/no-CC), offer to notify collections team ───
  const isProblematic = !willMarkPaid && (psSelectedReason === 'cc_declined' || psSelectedReason === 'cc_needed');
  if (isProblematic) {
    setTimeout(() => offerCollectionsNotification(psEditingId, psSelectedReason), 400);
  }
};

// Show a confirm modal to offer generating an internal email to the collections team
function offerCollectionsNotification(invoiceId, reason) {
  const inv = allInvoices.find(i => i.id === invoiceId);
  if (!inv) return;
  const collectionsEmail = (savedSettings.collectionsEmail || '').trim();
  const collectionsName = (savedSettings.collectionsName || '').trim();
  const en = currentLang === 'en';
  
  if (!collectionsEmail) {
    // Settings not configured — give Alberto the option to go set it up
    if (confirm(en
      ? `Mark this invoice for collections follow-up.\n\nNo collections team email is configured yet. Open Settings to set one?`
      : `Marcar esta factura para seguimiento de cobros.\n\nNo hay email de la persona de cobros configurado todavía. ¿Abrir Settings para configurarlo?`)) {
      window.openSettingsModal();
    }
    return;
  }
  
  const reasonLabel = reason === 'cc_declined'
    ? (en ? 'Credit card DECLINED' : 'Tarjeta DECLINADA')
    : (en ? 'No credit card on file' : 'Sin CC en archivo');

  // For CC-related issues, Cc Alberto so he and Celia coordinate collecting the card
  const ccCard = (reason === 'cc_declined' || reason === 'cc_needed');
  const ccLine = ccCard
    ? (en ? `\nCc: Alberto <${ALBERTO_EMAIL}>` : `\nCc: Alberto <${ALBERTO_EMAIL}>`)
    : '';

  if (!confirm(en
    ? `Send internal alert email to ${collectionsName || collectionsEmail}?${ccLine}\n\nInvoice: #${inv.invoiceNumber}\nCustomer: ${inv.customerName}\nIssue: ${reasonLabel}\nAmount: ${fmtCurrency(inv.amount)}`
    : `¿Mandar alerta interna a ${collectionsName || collectionsEmail}?${ccLine}\n\nFactura: #${inv.invoiceNumber}\nCliente: ${inv.customerName}\nProblema: ${reasonLabel}\nMonto: ${fmtCurrency(inv.amount)}`)) {
    return;
  }
  
  generateCollectionsEml(inv, reason);
}

// View the PDF stored on an invoice (opens in a new browser tab so the user
// can verify "yes, the PDF really is saved on this invoice"). Used by the
// 📎 PDF badge on each invoice card. Falls back to download if popups blocked.
window.viewInvoicePdf = function(invoiceId) {
  const inv = allInvoices.find(i => i.id === invoiceId);
  if (!inv || !inv.pdfBase64) {
    toast(currentLang === 'en' ? 'No PDF saved on this invoice' : 'Esta factura no tiene PDF guardado', 'error');
    return;
  }
  try {
    const byteChars = atob(inv.pdfBase64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      // Popup blocked — fall back to download
      const a = document.createElement('a');
      a.href = url;
      a.download = inv.pdfFilename || `Invoice_${inv.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    console.error('[viewInvoicePdf]', e);
    toast('Error: ' + e.message, 'error');
  }
};

// ════════════════════════════════════════════════════════════
// USER IDENTITY — Invoice Tracker uses Anonymous Auth (no formal login),
// so we maintain a localStorage-backed "who am I" so audit attribution
// (alerts, history entries) shows the real person publishing.
// ════════════════════════════════════════════════════════════
const INVOICE_TRACKER_USERS = [
  { name: 'Alberto', role: 'Service Manager · Admin',       initials: 'AR', email: 'service1@aspenspas.com' },
  { name: 'Nela',    role: 'Service Admin · Organizer',     initials: 'NE', email: 'service2@aspenspas.com' },
  { name: 'Celia',   role: 'Customer Service · Organizer',  initials: 'CE', email: 'service@aspenspas.com'  }
];
// Default fallback email when no user is picked (header display + .eml From:)
const DEFAULT_FROM_EMAIL = 'service2@aspenspas.com';
// Email accounts used internally (referenced for collections CC routing)
const ALBERTO_EMAIL = 'service1@aspenspas.com';
const CELIA_EMAIL   = 'service@aspenspas.com';
const INVOICE_TRACKER_USER_KEY = 'invoiceTrackerUser';

function getInvoiceTrackerUser() {
  try {
    return localStorage.getItem(INVOICE_TRACKER_USER_KEY) || null;
  } catch (_e) { return null; }
}

// Get the email of the user currently signed in (Alberto→service1, Nela→service2, Celia→service).
// Falls back to DEFAULT_FROM_EMAIL when no user picked.
function getActiveUserEmail() {
  const name = getInvoiceTrackerUser();
  if (!name) return DEFAULT_FROM_EMAIL;
  const u = INVOICE_TRACKER_USERS.find(x => x.name === name);
  return (u && u.email) ? u.email : DEFAULT_FROM_EMAIL;
}

// Get the display name for the From header (e.g., "Aspen Spas Service" or saved fromName).
function getActiveFromName() {
  const activeName = getInvoiceTrackerUser();
  const department = savedSettings.fromName || 'Aspen Spas Service';
  return activeName ? `${activeName} · ${department}` : department;
}

function setInvoiceTrackerUser(name) {
  try {
    if (name) localStorage.setItem(INVOICE_TRACKER_USER_KEY, name);
    else localStorage.removeItem(INVOICE_TRACKER_USER_KEY);
  } catch (_e) {}
  updateUserPickerButton();
}

function updateUserPickerButton() {
  const btn = document.getElementById('userPickerBtn');
  if (!btn) return;
  const name = getInvoiceTrackerUser();
  // Also update the header subtitle "Aspen Spas · <email>" with the active user's email
  const sub = document.querySelector('.brand-sub');
  if (sub) sub.textContent = 'Aspen Spas · ' + getActiveUserEmail();
  // Also update the "From:" in any email-preview modal
  const prevFrom = document.getElementById('prevFrom');
  if (prevFrom) prevFrom.textContent = getActiveUserEmail();
  if (name) {
    const u = INVOICE_TRACKER_USERS.find(x => x.name === name);
    btn.textContent = u ? `👤 ${u.initials}` : `👤 ${name.substring(0,2).toUpperCase()}`;
    btn.title = currentLang === 'en' ? `Signed in as ${name} — click to change` : `Sesión como ${name} — click para cambiar`;
    btn.style.background = 'var(--accent-soft)';
    btn.style.color = 'var(--accent)';
    btn.style.borderColor = 'var(--accent)';
  } else {
    btn.textContent = '👤';
    btn.title = currentLang === 'en' ? 'Set your name (for alert attribution)' : 'Establece tu nombre (para atribución de alertas)';
    btn.style.background = '#FEF2F2';
    btn.style.color = '#991B1B';
    btn.style.borderColor = '#FCA5A5';
  }
}

window.openUserPicker = function() {
  const list = document.getElementById('userPickerList');
  const current = getInvoiceTrackerUser();
  const en = currentLang === 'en';
  list.innerHTML = INVOICE_TRACKER_USERS.map(u => {
    const isActive = current === u.name;
    return `<button onclick="window.pickUser('${u.name.replace(/'/g, "\\'")}')" style="
      display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:var(--r-md);
      border:2px solid ${isActive ? 'var(--accent)' : 'var(--border)'};
      background:${isActive ? 'var(--accent-soft)' : 'var(--bg-card)'};
      cursor:pointer;text-align:left;width:100%;transition:all 0.15s;
    ">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:var(--accent);color:white;font-weight:700;font-size:13px;">${u.initials}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:14px;color:var(--text);">${u.name}${isActive ? ' ✓' : ''}</div>
        <div style="font-size:11px;color:var(--text-soft);">${u.role}</div>
      </div>
    </button>`;
  }).join('');
  document.getElementById('userPickerModal').classList.add('open');
};

window.pickUser = function(name) {
  setInvoiceTrackerUser(name);
  closeModal('userPickerModal');
  toast((currentLang === 'en' ? 'Now signed in as ' : 'Ahora como ') + name, 'success');
};

// ════════════════════════════════════════════════════════════
// CROSS-APP ALERT — UI handlers (publishes to TECH-TICKETS bus)
// ════════════════════════════════════════════════════════════
let _caAlertInvoiceId = null;

window.openCrossAppAlertModal = function(invoiceId) {
  const inv = allInvoices.find(i => i.id === invoiceId);
  if (!inv) return;
  _caAlertInvoiceId = invoiceId;
  
  // Build summary card
  const en = currentLang === 'en';
  const reasonText = inv.paymentReason ? paymentReasonLabel(inv.paymentReason) : (en ? 'Unpaid +30 days' : 'Sin pagar +30 días');
  const ageDays = inv.sentAt ? daysSince(inv.sentAt) : (inv.createdAt ? daysSince(inv.createdAt) : 0);
  
  document.getElementById('caAlertSummary').innerHTML = `
    <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${escapeHtml(inv.customerName)}</div>
    <div style="color:var(--text-soft);">
      <div>${en ? 'Invoice' : 'Factura'}: <strong>#${escapeHtml(inv.invoiceNumber)}</strong> · <strong>${fmtCurrency(inv.amount)}</strong></div>
      <div>${en ? 'Issue' : 'Problema'}: <strong style="color:var(--pending);">${escapeHtml(reasonText)}</strong></div>
      ${ageDays > 0 ? `<div>${en ? 'Age' : 'Edad'}: ${ageDays} ${en ? 'days' : 'días'}</div>` : ''}
      <div style="margin-top:4px;font-size:12px;color:var(--text-mute);">${en ? 'Match keys' : 'Llaves de match'}: <code>${escapeHtml(_custKeys(inv.customerName).join(', '))}</code></div>
    </div>
  `;
  
  // Auto-pick severity based on payment reason
  const sevSel = document.getElementById('caAlertSeverity');
  if (inv.paymentReason === 'cc_declined' || inv.paymentReason === 'disputed') {
    sevSel.value = 'urgent';
  } else if (inv.paymentReason === 'no_response' || inv.paymentReason === 'cc_needed') {
    sevSel.value = 'warn';
  } else if (inv.paymentReason === 'pending' || inv.paymentReason === 'partial') {
    sevSel.value = 'info';
  } else {
    sevSel.value = 'warn';
  }
  
  document.getElementById('caAlertNote').value = '';
  document.getElementById('crossAppAlertModal').classList.add('open');
};

window.publishCrossAppAlert = async function() {
  const inv = allInvoices.find(i => i.id === _caAlertInvoiceId);
  if (!inv) return;
  
  const severity = document.getElementById('caAlertSeverity').value;
  const note = document.getElementById('caAlertNote').value.trim();
  const en = currentLang === 'en';
  const btn = document.getElementById('caAlertPublishBtn');
  
  // Identify who is publishing — required for proper audit attribution
  let publishedBy = getInvoiceTrackerUser();
  if (!publishedBy) {
    closeModal('crossAppAlertModal');
    toast(en
      ? 'Please pick who you are first (button 👤 in header), then publish again'
      : 'Primero indica quién eres (botón 👤 en el header) y vuelve a publicar', 'error');
    window.openUserPicker();
    return;
  }
  
  btn.disabled = true;
  btn.textContent = en ? 'Publishing…' : 'Publicando…';
  
  try {
    const payload = {
      invoiceNumber: inv.invoiceNumber,
      amount: Number(inv.amount) || 0,
      reason: inv.paymentReason || 'unpaid_30d',
      reasonLabel: inv.paymentReason ? paymentReasonLabel(inv.paymentReason) : (en ? 'Unpaid +30 days' : 'Sin pagar +30 días'),
      customerEmail: inv.customerEmail || '',
      customerPhone: inv.customerPhone || '',
      technician: inv.technician || '',
      invoiceCreatedAt: inv.createdAt || null,
      invoiceSentAt: inv.sentAt || null,
      note: note || null
    };

    // Attach the invoice PDF if available, but guard against Firestore's 1 MiB document limit.
    // Typical invoice PDFs are 50-150 KB original (67-200 KB base64). We cap at 600 KB base64
    // to leave headroom for other fields and metadata.
    let pdfAttached = false;
    let pdfSkippedReason = null;
    if (inv.pdfBase64) {
      const sizeBytes = inv.pdfBase64.length; // base64 chars ≈ bytes
      if (sizeBytes <= 600 * 1024) {
        payload.pdfBase64 = inv.pdfBase64;
        payload.pdfFilename = (inv.invoiceNumber ? `Invoice-${inv.invoiceNumber}` : 'Invoice') + '.pdf';
        pdfAttached = true;
      } else {
        pdfSkippedReason = 'too_large';
        console.warn('[CrossAppAlert] PDF too large (' + Math.round(sizeBytes/1024) + ' KB base64) — skipping attachment');
      }
    }
    
    const result = await publishCrossAppEvent({
      eventType: 'payment_alert',
      customerName: inv.customerName,
      payload,
      severity,
      createdBy: publishedBy
    });
    
    if (!result) throw new Error('Publish returned null');
    
    // Stamp history on the invoice so we can show "already alerted" badge next render
    const eventId = result.name ? result.name.split('/').pop() : null;
    const historyEntry = {
      action: 'crossapp_alert_published',
      ts: Date.now(),
      severity,
      eventId,
      note: note || null,
      pdfAttached,
      pdfSkippedReason,
      recipient: 'TECH-TICKETS',
      recipientName: 'Tech Team',
      reason: inv.paymentReason || null,
      publishedBy: publishedBy,
      confirmed: true,
      confirmedAt: Date.now()
    };
    const newHistory = [...(inv.history || []), historyEntry];
    
    // Update the invoice locally and in Firebase RTDB
    inv.history = newHistory;
    if (db && typeof update === 'function') {
      try {
        await update(ref(db, `invoiceTracker/invoices/${inv.id}`), { history: newHistory });
      } catch (e) {
        console.warn('Could not persist history to RTDB:', e);
      }
    }
    
    closeModal('crossAppAlertModal');
    toast(en
      ? `✓ Tech team notified about ${inv.customerName}`
      : `✓ Tech team notificado sobre ${inv.customerName}`, 'success');
    computeAndRender();
  } catch (err) {
    console.error('[CrossAppAlert] Publish failed:', err);
    const is401 = /401|unauthenticated|missing or invalid auth/i.test(err.message || '');
    if (is401) {
      // The token to tech-tickets-a9485 is being rejected. Show the human hint
      // (network block vs anonymous-auth-disabled) and keep the modal OPEN so
      // Nela can hit retry without re-typing everything.
      const hint = getTicketsConnectionHint(currentLang);
      toast(en
        ? `Can't reach TECH-TICKETS (auth). ${hint}`
        : `No se puede conectar a TECH-TICKETS (auth). ${hint}`, 'error');
      // Force a fresh token on next attempt
      _ticketsAuthToken = null; _ticketsAuthTokenExp = 0;
    } else {
      toast(en
        ? `Error publishing alert: ${err.message}`
        : `Error publicando alerta: ${err.message}`, 'error');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = en ? '🔔 Publish alert' : '🔔 Publicar alerta';
  }
};

// Generate an .eml internal alert addressed to the collections team
async function generateCollectionsEml(inv, reason) {
  const collectionsEmail = (savedSettings.collectionsEmail || '').trim();
  const collectionsName = (savedSettings.collectionsName || '').trim();
  const en = currentLang === 'en';
  
  const reasonLabel = reason === 'cc_declined'
    ? (en ? '❌ CC DECLINED' : '❌ CC DECLINADA')
    : (en ? '📞 No CC on file' : '📞 Sin CC en archivo');
  
  const subject = en
    ? `[ACTION NEEDED] Invoice #${inv.invoiceNumber} — ${reasonLabel.replace(/[❌📞]/g, '').trim()} — ${inv.customerName}`
    : `[ACCIÓN REQUERIDA] Factura #${inv.invoiceNumber} — ${reasonLabel.replace(/[❌📞]/g, '').trim()} — ${inv.customerName}`;
  
  const customer = allCustomers.find(c => 
    (c.name || '').toLowerCase().trim() === (inv.customerName || '').toLowerCase().trim()
  );
  
  const fields = en ? {
    issue: 'Issue', invNum: 'Invoice #', cust: 'Customer', amt: 'Amount', email: 'Email',
    phone: 'Phone', model: 'Spa model', sent: 'Last sent', greet: `Hi ${collectionsName || 'team'},`,
    body: `An invoice needs your follow-up because of a payment issue.`,
    action: `ACTION NEEDED: please call the customer to update payment method and complete the charge.`,
    note: `(This email was generated automatically from the Invoice Tracker dashboard.)`,
    sig: `— Aspen Spas Service Department`
  } : {
    issue: 'Problema', invNum: 'Factura #', cust: 'Cliente', amt: 'Monto', email: 'Email',
    phone: 'Teléfono', model: 'Modelo del spa', sent: 'Último envío', greet: `Hola ${collectionsName || 'equipo'},`,
    body: `Una factura necesita tu seguimiento por un problema de cobro.`,
    action: `ACCIÓN REQUERIDA: por favor llama al cliente para actualizar el método de pago y completar el cobro.`,
    note: `(Este email se generó automáticamente desde el Invoice Tracker dashboard.)`,
    sig: `— Aspen Spas Service Department`
  };
  
  const sentDate = inv.sentAt ? new Date(inv.sentAt).toLocaleDateString() : '—';
  
  // Plain-text version (fallback for email clients that don't render HTML)
  const plainTextLines = [
    fields.greet,
    '',
    fields.body,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `${fields.issue}: ${reasonLabel}`,
    `${fields.invNum}: ${inv.invoiceNumber}`,
    `${fields.cust}: ${inv.customerName}`,
    `${fields.amt}: ${fmtCurrency(inv.amount)}`,
    `${fields.email}: ${inv.customerEmail || '—'}`,
    customer && customer.phone ? `${fields.phone}: ${customer.phone}` : null,
    inv.spaModel ? `${fields.model}: ${inv.spaModel}` : null,
    `${fields.sent}: ${sentDate}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `>>> ${fields.action}`,
    '',
    fields.note,
    fields.sig
  ].filter(Boolean);
  const plainText = plainTextLines.join('\n');
  
  // Pretty HTML version (red header, table, callout)
  const htmlBody = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;color:#0f172a;max-width:560px;margin:0 auto;">
  <div style="background:#7f1d1d;color:white;padding:20px;border-radius:8px 8px 0 0;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;opacity:0.8;">${en ? 'INTERNAL ALERT' : 'ALERTA INTERNA'}</div>
    <div style="font-size:18px;font-weight:700;margin-top:4px;">${reasonLabel}</div>
  </div>
  <div style="padding:24px;background:white;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 14px 0;font-size:14px;">${escapeHtml(fields.greet)}</p>
    <p style="margin:0 0 14px 0;font-size:14px;line-height:1.5;">${escapeHtml(fields.body)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:12px 0;">
      <tr><td style="padding:6px 8px;background:#f8fafc;font-weight:600;width:40%;">${escapeHtml(fields.issue)}</td><td style="padding:6px 8px;background:#fef2f2;color:#991b1b;font-weight:700;">${reasonLabel}</td></tr>
      <tr><td style="padding:6px 8px;background:#f8fafc;font-weight:600;">${escapeHtml(fields.invNum)}</td><td style="padding:6px 8px;font-family:monospace;">${escapeHtml(inv.invoiceNumber)}</td></tr>
      <tr><td style="padding:6px 8px;background:#f8fafc;font-weight:600;">${escapeHtml(fields.cust)}</td><td style="padding:6px 8px;">${escapeHtml(inv.customerName)}</td></tr>
      <tr><td style="padding:6px 8px;background:#f8fafc;font-weight:600;">${escapeHtml(fields.amt)}</td><td style="padding:6px 8px;font-weight:700;">${fmtCurrency(inv.amount)}</td></tr>
      <tr><td style="padding:6px 8px;background:#f8fafc;font-weight:600;">${escapeHtml(fields.email)}</td><td style="padding:6px 8px;"><a href="mailto:${escapeHtml(inv.customerEmail)}" style="color:#0284C7;">${escapeHtml(inv.customerEmail || '—')}</a></td></tr>
      ${customer && customer.phone ? `<tr><td style="padding:6px 8px;background:#f8fafc;font-weight:600;">${escapeHtml(fields.phone)}</td><td style="padding:6px 8px;font-family:monospace;"><a href="tel:${escapeHtml(customer.phone)}" style="color:#0284C7;">${escapeHtml(customer.phone)}</a></td></tr>` : ''}
      ${inv.spaModel ? `<tr><td style="padding:6px 8px;background:#f8fafc;font-weight:600;">${escapeHtml(fields.model)}</td><td style="padding:6px 8px;">${escapeHtml(inv.spaModel)}</td></tr>` : ''}
      <tr><td style="padding:6px 8px;background:#f8fafc;font-weight:600;">${escapeHtml(fields.sent)}</td><td style="padding:6px 8px;">${escapeHtml(sentDate)}</td></tr>
    </table>
    <div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:12px 14px;border-radius:4px;margin-top:14px;font-size:13px;color:#78350f;">
      <strong>${escapeHtml(fields.action)}</strong>
    </div>
    ${inv.pdfBase64 ? `<div style="font-size:12px;color:#475569;margin-top:14px;background:#f1f5f9;padding:10px 12px;border-radius:4px;">📎 ${en ? 'Invoice PDF is attached to this email for reference.' : 'PDF de la factura adjunto para tu referencia.'}</div>` : ''}
    <p style="font-size:11px;color:#94a3b8;margin-top:18px;font-style:italic;">${escapeHtml(fields.note)}</p>
    <p style="font-size:13px;color:#475569;margin-top:6px;">${escapeHtml(fields.sig)}</p>
  </div>
</body></html>`.trim();
  
  // Build .eml file with PDF attached (same MIME structure as customer email)
  const pdfBase64 = inv.pdfBase64 || '';
  const pdfFilename = inv.pdfFilename || `Invoice_${inv.invoiceNumber}.pdf`;
  const boundary = '====aspen_internal_' + Math.random().toString(36).slice(2, 12) + '====';
  const altBoundary = '====alt_internal_' + Math.random().toString(36).slice(2, 12) + '====';
  const wrappedB64 = pdfBase64 ? pdfBase64.match(/.{1,76}/g).join('\r\n') : '';

  // For CC-related issues, Nela wants Alberto on Cc so he and Celia can
  // coordinate collecting the credit card data with the customer.
  const ccCard = (reason === 'cc_declined' || reason === 'cc_needed');
  // Don't Cc Alberto if he himself is the active sender, and don't Cc Celia if she is.
  const activeEmail = getActiveUserEmail();
  const ccList = [];
  if (ccCard && ALBERTO_EMAIL !== activeEmail && ALBERTO_EMAIL !== (collectionsEmail || '').toLowerCase()) {
    ccList.push(`"Alberto Reynaldo" <${ALBERTO_EMAIL}>`);
  }

  const emlLines = [
    `From: "${savedSettings.fromName || 'Aspen Spas Service'}" <${activeEmail}>`,
    `To: "${collectionsName || 'Collections'}" <${collectionsEmail}>`,
    ...(ccList.length ? [`Cc: ${ccList.join(', ')}`] : []),
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `X-Unsent: 1`,
    `MIME-Version: 1.0`,
    pdfBase64 
      ? `Content-Type: multipart/mixed; boundary="${boundary}"`
      : `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    ``
  ];
  
  if (pdfBase64) {
    // Wrapper multipart/mixed > multipart/alternative > body parts + PDF attachment
    emlLines.push(
      `--${boundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      ``,
      `--${altBoundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      encodeQuotedPrintable(plainText),
      ``,
      `--${altBoundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      encodeQuotedPrintable(htmlBody),
      ``,
      `--${altBoundary}--`,
      ``,
      `--${boundary}`,
      `Content-Type: application/pdf; name="${pdfFilename}"`,
      `Content-Disposition: attachment; filename="${pdfFilename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      wrappedB64,
      ``,
      `--${boundary}--`
    );
  } else {
    // No PDF: just multipart/alternative
    emlLines.push(
      `--${altBoundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      encodeQuotedPrintable(plainText),
      ``,
      `--${altBoundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      encodeQuotedPrintable(htmlBody),
      ``,
      `--${altBoundary}--`
    );
  }
  
  const emlContent = emlLines.join('\r\n');
  const blob = new Blob([emlContent], { type: 'message/rfc822' });
  const filename = `Internal_Alert_${inv.invoiceNumber}_${(inv.customerName || 'customer').replace(/[^a-zA-Z0-9]/g, '_')}.eml`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 100);
  
  const hasPdf = !!pdfBase64;
  // ─── Log to invoice history (audit trail) — initially as "generated" only ───
  const histEntry = {
    ts: Date.now(),
    action: 'alert_collections',
    recipient: collectionsEmail,
    recipientName: collectionsName || 'Collections team',
    reason: reason,
    hasPdf: hasPdf,
    confirmed: false  // becomes true when user confirms send
  };
  const newHistory = [...(inv.history || []), histEntry];
  await updateInvoiceData(inv.id, { history: newHistory });
  
  // After download, ask if she actually clicked Send in Outlook
  setTimeout(() => askConfirmSend(inv.id, newHistory.length - 1), 600);
  
  toast(en
    ? `✉ Alert .eml downloaded ${hasPdf ? 'with PDF' : '(no PDF)'}. Forward to ${collectionsName || 'team'} in Outlook → click Send.`
    : `✉ Alerta .eml descargada ${hasPdf ? 'con PDF' : '(sin PDF)'}. Forward a ${collectionsName || 'cobros'} en Outlook → click Send.`,
    'success');
}

// ════════════════════════════════════════════════════════════
// CONFIRM SEND — ask user if they actually clicked Send in Outlook
// Updates the latest history entry to confirmed:true if yes
// ════════════════════════════════════════════════════════════
window.askConfirmSend = function(invoiceId, historyIndex) {
  const inv = allInvoices.find(i => i.id === invoiceId);
  if (!inv) return;
  const ev = (inv.history || [])[historyIndex];
  if (!ev || ev.confirmed) return;
  
  const en = currentLang === 'en';
  const recipient = ev.recipientName || 'recipient';
  
  // Modal HTML — reuses simple confirm UI
  const overlay = document.createElement('div');
  overlay.id = 'confirmSendOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;max-width:440px;width:100%;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,0.3);">
      <div style="font-size:36px;text-align:center;margin-bottom:8px;">📤</div>
      <h3 style="margin:0 0 12px 0;text-align:center;font-size:18px;color:#134A63;">${en ? 'Did you click Send?' : '¿Le diste click a Send?'}</h3>
      <p style="margin:0 0 20px 0;text-align:center;font-size:14px;color:#475569;line-height:1.5;">
        ${en
          ? `In Outlook, did you actually click <strong>Send</strong> on the email to ${escapeHtml(recipient)}? Verify it appears in <strong>Sent Items</strong>.`
          : `En Outlook, ¿realmente le diste click a <strong>Send</strong> al correo para ${escapeHtml(recipient)}? Verifica que aparezca en <strong>Sent Items</strong>.`}
      </p>
      <div style="display:flex;gap:8px;flex-direction:column;">
        <button onclick="window.confirmSendYes('${invoiceId}', ${historyIndex})" style="background:#2E8B57;color:white;border:0;padding:12px 16px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
          ✅ ${en ? 'Yes, I sent it (mark as sent)' : 'Sí lo envié (marcar como enviado)'}
        </button>
        <button onclick="window.confirmSendNo()" style="background:#F1F5F9;color:#475569;border:0;padding:12px 16px;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;">
          ⏰ ${en ? "Not yet — I'll do it later" : 'Aún no — lo hago después'}
        </button>
      </div>
      <p style="font-size:11px;color:#94A3B8;text-align:center;margin:14px 0 0 0;font-style:italic;">
        ${en ? 'You can confirm later from the payment modal' : 'Puedes confirmar después desde el payment modal'}
      </p>
    </div>`;
  document.body.appendChild(overlay);
};

window.confirmSendYes = async function(invoiceId, historyIndex) {
  const inv = allInvoices.find(i => i.id === invoiceId);
  if (!inv) return;
  const newHistory = [...(inv.history || [])];
  if (newHistory[historyIndex]) {
    newHistory[historyIndex] = { ...newHistory[historyIndex], confirmed: true, confirmedAt: Date.now() };
    await updateInvoiceData(invoiceId, { history: newHistory });
  }
  const overlay = document.getElementById('confirmSendOverlay');
  if (overlay) overlay.remove();
  toast(currentLang === 'en'
    ? '✅ Marked as sent — audit trail updated'
    : '✅ Marcado como enviado — historial actualizado', 'success');
};

window.confirmSendNo = function() {
  const overlay = document.getElementById('confirmSendOverlay');
  if (overlay) overlay.remove();
  toast(currentLang === 'en'
    ? '⏰ Pending — confirm later from payment modal'
    : '⏰ Pendiente — confirma después desde el payment modal', 'success');
};

// Confirm send when user clicks the inline button inside the alert history list
window.confirmSendYesFromHistory = async function(invoiceId, historyIndex) {
  const inv = allInvoices.find(i => i.id === invoiceId);
  if (!inv) return;
  const newHistory = [...(inv.history || [])];
  if (newHistory[historyIndex]) {
    newHistory[historyIndex] = { ...newHistory[historyIndex], confirmed: true, confirmedAt: Date.now() };
    await updateInvoiceData(invoiceId, { history: newHistory });
    // Re-render the modal contents in place by re-opening
    setTimeout(() => window.openPaymentModal(invoiceId), 100);
  }
  toast(currentLang === 'en' ? '✅ Marked as sent' : '✅ Marcado como enviado', 'success');
};

// ════════════════════════════════════════════════════════════
// CHECK TRACKING — notify deposit team about a check that needs depositing
// Generates a .eml with PDF attached, ready to send via Outlook
// ════════════════════════════════════════════════════════════
window.notifyDepositTeam = async function() {
  if (!psEditingId) return;
  const inv = allInvoices.find(i => i.id === psEditingId);
  if (!inv) return;
  
  const collectionsEmail = (savedSettings.collectionsEmail || '').trim();
  const collectionsName = (savedSettings.collectionsName || '').trim();
  const en = currentLang === 'en';
  
  if (!collectionsEmail) {
    if (confirm(en
      ? 'No deposit team email configured. The system uses the same email as the collections team.\n\nOpen Settings to set it up?'
      : 'No hay email del equipo de depósitos configurado. El sistema usa el mismo email que el equipo de cobros.\n\n¿Abrir Settings para configurarlo?')) {
      window.openSettingsModal();
    }
    return;
  }
  
  // Read current values from modal (might not be saved yet)
  const checkRef = document.getElementById('psMethodRef').value.trim();
  const checkLocation = document.getElementById('psCheckLocation').value || '';
  const checkNote = document.getElementById('psNote').value.trim();
  
  // Localized location labels
  const locLabels = {
    with_tech: en ? `With technician ${inv.technician || '(unknown)'}` : `Con el técnico ${inv.technician || '(desconocido)'}`,
    office: en ? 'Arrived at office (pending deposit)' : 'Llegó a oficina (pendiente depositar)',
    deposited: en ? 'Already deposited at bank' : 'Ya depositado en banco',
    other: en ? 'Other / unknown' : 'Otro / desconocido',
    '': en ? '(not specified)' : '(sin especificar)'
  };
  const locLabel = locLabels[checkLocation] || locLabels[''];
  
  // Determine action needed based on location
  let actionText;
  if (checkLocation === 'with_tech') {
    actionText = en
      ? `Please retrieve the check from technician ${inv.technician || ''} and deposit at the bank.`
      : `Por favor recoger el cheque del técnico ${inv.technician || ''} y depositar en el banco.`;
  } else if (checkLocation === 'office') {
    actionText = en
      ? 'Please deposit this check at the bank.'
      : 'Por favor depositar este cheque en el banco.';
  } else if (checkLocation === 'deposited') {
    actionText = en
      ? 'Check already deposited — this is just a confirmation/record.'
      : 'Cheque ya depositado — esta es solo una confirmación/registro.';
  } else {
    actionText = en
      ? 'Please confirm the location of this check and proceed with deposit if needed.'
      : 'Por favor confirma la ubicación de este cheque y procede con el depósito si es necesario.';
  }
  
  const subject = en
    ? `💵 Check received — Invoice #${inv.invoiceNumber} — ${inv.customerName} — ${fmtCurrency(inv.amount)}`
    : `💵 Cheque recibido — Factura #${inv.invoiceNumber} — ${inv.customerName} — ${fmtCurrency(inv.amount)}`;
  
  // Plain text body
  const plainTextLines = [
    en ? `Hi ${collectionsName || 'team'},` : `Hola ${collectionsName || 'equipo'},`,
    '',
    en
      ? 'A check has been collected for an invoice. Tracking info:'
      : 'Se cobró un cheque por una factura. Detalles para tracking:',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `${en ? 'Invoice' : 'Factura'} #: ${inv.invoiceNumber}`,
    `${en ? 'Customer' : 'Cliente'}: ${inv.customerName}`,
    `${en ? 'Amount' : 'Monto'}: ${fmtCurrency(inv.amount)}`,
    `${en ? 'Service date' : 'Fecha de servicio'}: ${inv.serviceDate || '—'}`,
    `${en ? 'Technician who collected' : 'Técnico que cobró'}: ${inv.technician || '—'}`,
    `${en ? 'Check #' : '# Cheque'}: ${checkRef || '(' + (en ? 'not provided' : 'no provisto') + ')'}`,
    `${en ? 'Check location' : 'Ubicación'}: ${locLabel}`,
    inv.spaModel ? `${en ? 'Spa model' : 'Modelo de spa'}: ${inv.spaModel}` : null,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `>>> ${en ? 'ACTION NEEDED' : 'ACCIÓN REQUERIDA'}: ${actionText}`,
    '',
    checkNote ? (en ? 'Internal note from technician:' : 'Nota interna del técnico:') : null,
    checkNote ? `"${checkNote}"` : null,
    checkNote ? '' : null,
    en ? '(This email was generated automatically from the Invoice Tracker.)' : '(Email generado automáticamente desde el Invoice Tracker.)',
    '— Aspen Spas Service Department'
  ].filter(l => l !== null);
  const plainText = plainTextLines.join('\n');
  
  // Pretty HTML version (green header for "received check")
  const htmlBody = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;color:#0f172a;max-width:560px;margin:0 auto;">
  <div style="background:#15803d;color:white;padding:20px;border-radius:8px 8px 0 0;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;opacity:0.85;">${en ? 'CHECK TRACKING' : 'TRACKING DE CHEQUE'}</div>
    <div style="font-size:18px;font-weight:700;margin-top:4px;">💵 ${en ? 'Check received' : 'Cheque recibido'} — ${escapeHtml(fmtCurrency(inv.amount))}</div>
  </div>
  <div style="padding:24px;background:white;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 14px 0;font-size:14px;">${en ? `Hi ${escapeHtml(collectionsName || 'team')},` : `Hola ${escapeHtml(collectionsName || 'equipo')},`}</p>
    <p style="margin:0 0 14px 0;font-size:14px;line-height:1.5;">${en ? 'A check has been collected for an invoice. Here are the tracking details:' : 'Se cobró un cheque por una factura. Aquí los detalles para el tracking:'}</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:12px 0;">
      <tr><td style="padding:6px 8px;background:#f8fafc;font-weight:600;width:40%;">${en ? 'Invoice' : 'Factura'} #</td><td style="padding:6px 8px;font-family:monospace;">${escapeHtml(inv.invoiceNumber)}</td></tr>
      <tr><td style="padding:6px 8px;background:#f8fafc;font-weight:600;">${en ? 'Customer' : 'Cliente'}</td><td style="padding:6px 8px;">${escapeHtml(inv.customerName)}</td></tr>
      <tr><td style="padding:6px 8px;background:#f8fafc;font-weight:600;">${en ? 'Amount' : 'Monto'}</td><td style="padding:6px 8px;background:#f0fdf4;color:#15803d;font-weight:700;">${fmtCurrency(inv.amount)}</td></tr>
      <tr><td style="padding:6px 8px;background:#f8fafc;font-weight:600;">${en ? 'Technician' : 'Técnico'}</td><td style="padding:6px 8px;">${escapeHtml(inv.technician || '—')}</td></tr>
      <tr><td style="padding:6px 8px;background:#f8fafc;font-weight:600;">${en ? 'Check #' : 'Cheque #'}</td><td style="padding:6px 8px;font-family:monospace;">${escapeHtml(checkRef || '(' + (en ? 'not provided' : 'no provisto') + ')')}</td></tr>
      <tr><td style="padding:6px 8px;background:#f8fafc;font-weight:600;">📍 ${en ? 'Location' : 'Ubicación'}</td><td style="padding:6px 8px;background:#fef9c3;color:#854d0e;font-weight:600;">${escapeHtml(locLabel)}</td></tr>
      ${inv.spaModel ? `<tr><td style="padding:6px 8px;background:#f8fafc;font-weight:600;">${en ? 'Spa model' : 'Modelo'}</td><td style="padding:6px 8px;">${escapeHtml(inv.spaModel)}</td></tr>` : ''}
      <tr><td style="padding:6px 8px;background:#f8fafc;font-weight:600;">${en ? 'Service date' : 'Fecha servicio'}</td><td style="padding:6px 8px;">${escapeHtml(inv.serviceDate || '—')}</td></tr>
    </table>
    <div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:12px 14px;border-radius:4px;margin-top:14px;font-size:13px;color:#78350f;">
      <strong>${en ? 'ACTION NEEDED:' : 'ACCIÓN REQUERIDA:'}</strong> ${escapeHtml(actionText)}
    </div>
    ${checkNote ? `<div style="margin-top:14px;padding:10px 12px;background:#f8fafc;border-left:3px solid #94a3b8;border-radius:4px;font-size:13px;color:#475569;"><strong>${en ? 'Note from technician:' : 'Nota del técnico:'}</strong><br><em>"${escapeHtml(checkNote)}"</em></div>` : ''}
    ${inv.pdfBase64 ? `<div style="font-size:12px;color:#475569;margin-top:14px;background:#f1f5f9;padding:10px 12px;border-radius:4px;">📎 ${en ? 'Invoice PDF is attached to this email for reference.' : 'PDF de la factura adjunto para tu referencia.'}</div>` : ''}
    <p style="font-size:11px;color:#94a3b8;margin-top:18px;font-style:italic;">${en ? '(This email was generated automatically from the Invoice Tracker.)' : '(Email generado automáticamente desde el Invoice Tracker.)'}</p>
    <p style="font-size:13px;color:#475569;margin-top:6px;">— Aspen Spas Service Department</p>
  </div>
</body></html>`.trim();
  
  // Build .eml with PDF attached (same MIME structure as customer/collections emails)
  const pdfBase64 = inv.pdfBase64 || '';
  const pdfFilename = inv.pdfFilename || `Invoice_${inv.invoiceNumber}.pdf`;
  const boundary = '====aspen_check_' + Math.random().toString(36).slice(2, 12) + '====';
  const altBoundary = '====alt_check_' + Math.random().toString(36).slice(2, 12) + '====';
  const wrappedB64 = pdfBase64 ? pdfBase64.match(/.{1,76}/g).join('\r\n') : '';
  
  const emlLines = [
    `From: "${savedSettings.fromName || 'Aspen Spas Service'}" <${getActiveUserEmail()}>`,
    `To: "${collectionsName || 'Deposit Team'}" <${collectionsEmail}>`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `X-Unsent: 1`,
    `MIME-Version: 1.0`,
    pdfBase64 
      ? `Content-Type: multipart/mixed; boundary="${boundary}"`
      : `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    ``
  ];
  
  if (pdfBase64) {
    emlLines.push(
      `--${boundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      ``,
      `--${altBoundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      encodeQuotedPrintable(plainText),
      ``,
      `--${altBoundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      encodeQuotedPrintable(htmlBody),
      ``,
      `--${altBoundary}--`,
      ``,
      `--${boundary}`,
      `Content-Type: application/pdf; name="${pdfFilename}"`,
      `Content-Disposition: attachment; filename="${pdfFilename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      wrappedB64,
      ``,
      `--${boundary}--`
    );
  } else {
    emlLines.push(
      `--${altBoundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      encodeQuotedPrintable(plainText),
      ``,
      `--${altBoundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      encodeQuotedPrintable(htmlBody),
      ``,
      `--${altBoundary}--`
    );
  }
  
  const emlContent = emlLines.join('\r\n');
  const blob = new Blob([emlContent], { type: 'message/rfc822' });
  const filename = `Check_${inv.invoiceNumber}_${(inv.customerName || 'customer').replace(/[^a-zA-Z0-9]/g, '_')}.eml`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 100);
  
  // ─── Log to invoice history (audit trail) — initially as "generated" only ───
  const histEntry = {
    ts: Date.now(),
    action: 'alert_check',
    recipient: collectionsEmail,
    recipientName: collectionsName || 'Deposit team',
    location: checkLocation,
    checkRef: checkRef,
    technician: inv.technician || null,
    hasPdf: !!pdfBase64,
    confirmed: false
  };
  const newHistory = [...(inv.history || []), histEntry];
  await updateInvoiceData(inv.id, { history: newHistory });
  
  // Also publish to TECH-TICKETS so the tech team sees the check-pending status
  // when they go to service this customer. Auto-prompt — user can decline.
  try {
    const publishedBy = getInvoiceTrackerUser();
    if (publishedBy) {
      const locLabel = en
        ? { with_tech: 'with tech', office: 'in office', other: 'other' }[checkLocation] || checkLocation
        : { with_tech: 'con técnico', office: 'en oficina', other: 'otro' }[checkLocation] || checkLocation;
      const techLabel = inv.technician ? (en ? ` (${inv.technician})` : ` (${inv.technician})`) : '';
      const confirmMsg = en
        ? `Also alert TECH-TICKETS about this check pending deposit?\n\nCustomer: ${inv.customerName}\nLocation: ${locLabel}${techLabel}\nAmount: $${Number(inv.amount).toFixed(2)}\n\nThe tech team will see it when they go service this customer.${pdfBase64 ? '\n\n📎 Invoice PDF will be attached.' : ''}`
        : `¿Alertar también a TECH-TICKETS sobre este cheque sin depositar?\n\nCliente: ${inv.customerName}\nUbicación: ${locLabel}${techLabel}\nMonto: $${Number(inv.amount).toFixed(2)}\n\nEl tech team lo verá cuando vaya a dar servicio a este cliente.${pdfBase64 ? '\n\n📎 El PDF de la factura se adjuntará.' : ''}`;
      if (confirm(confirmMsg)) {
        const payload = {
          invoiceNumber: inv.invoiceNumber,
          amount: Number(inv.amount) || 0,
          reason: 'check_pending_deposit',
          reasonLabel: en ? `Check pending deposit (${locLabel})` : `Cheque sin depositar (${locLabel})`,
          customerEmail: inv.customerEmail || '',
          customerPhone: inv.customerPhone || '',
          technician: inv.technician || '',
          checkLocation: checkLocation || null,
          checkRef: checkRef || null,
          invoiceCreatedAt: inv.createdAt || null,
          invoiceSentAt: inv.sentAt || null,
          note: null
        };
        // Attach PDF if it fits (600 KB guard, same as the regular Alert Tech flow)
        if (inv.pdfBase64 && inv.pdfBase64.length <= 600 * 1024) {
          payload.pdfBase64 = inv.pdfBase64;
          payload.pdfFilename = (inv.invoiceNumber ? `Invoice-${inv.invoiceNumber}` : 'Invoice') + '.pdf';
        }
        try {
          const result = await publishCrossAppEvent({
            eventType: 'payment_alert',
            customerName: inv.customerName,
            payload,
            severity: 'warn',
            createdBy: publishedBy
          });
          // Stamp history with this second event so we can detect resolution + show badge
          const eventId = result && result.name ? result.name.split('/').pop() : null;
          const ttHist = {
            action: 'crossapp_alert_published',
            ts: Date.now(),
            severity: 'warn',
            eventId,
            note: null,
            pdfAttached: !!payload.pdfBase64,
            recipient: 'TECH-TICKETS',
            recipientName: 'Tech Team',
            reason: 'check_pending_deposit',
            publishedBy,
            confirmed: true,
            confirmedAt: Date.now()
          };
          inv.history = [...(inv.history || []), ttHist];
          await updateInvoiceData(inv.id, { history: inv.history });
          toast(en ? '🔔 Also alerted TECH-TICKETS' : '🔔 También alertado a TECH-TICKETS', 'success');
        } catch (e) {
          console.warn('[alert_check → tech-tickets]', e);
          toast(en ? 'Tech alert failed: ' + e.message : 'Falló alert a tech: ' + e.message, 'error');
        }
      }
    }
  } catch (_e) { /* non-fatal */ }
  
  // After download, ask if she actually clicked Send in Outlook
  setTimeout(() => askConfirmSend(inv.id, newHistory.length - 1), 600);
  
  toast(en
    ? `✉ Check .eml downloaded ${pdfBase64 ? 'with PDF' : '(no PDF)'}. Forward to ${collectionsName || 'team'} in Outlook → click Send.`
    : `✉ Cheque .eml descargado ${pdfBase64 ? 'con PDF' : '(sin PDF)'}. Forward a ${collectionsName || 'cobros'} en Outlook → click Send.`,
    'success');
};

// Wire up radios (one-time setup, called on DOM ready below)
function wirePaymentReasonRadios() {
  document.querySelectorAll('#psReasonGroup .ps-radio').forEach(r => {
    r.addEventListener('click', () => {
      document.querySelectorAll('#psReasonGroup .ps-radio').forEach(x => x.classList.remove('active'));
      r.classList.add('active');
      psSelectedReason = r.dataset.val || '';
    });
  });
  document.querySelectorAll('#psMethodGroup .ps-radio').forEach(r => {
    r.addEventListener('click', () => {
      document.querySelectorAll('#psMethodGroup .ps-radio').forEach(x => x.classList.remove('active'));
      r.classList.add('active');
      psSelectedMethod = r.dataset.method || '';
      // Show/hide check tracking block based on selection
      const checkBlock = document.getElementById('psCheckTracking');
      if (checkBlock) checkBlock.style.display = (psSelectedMethod === 'check') ? 'block' : 'none';
      // Show/hide QB sync block — relevant whenever a payment method is selected
      const qbBlock = document.getElementById('psQbSyncBlock');
      if (qbBlock) qbBlock.style.display = psSelectedMethod ? 'block' : 'none';
    });
  });
}

// Helper: get human label for payment reason
function paymentReasonLabel(r) {
  return ({
    cc_needed: '📞 Falta CC',
    cc_declined: '❌ CC rechazada',
    no_response: '🔇 Sin respuesta',
    partial: '💵 Pago parcial',
    disputed: '⚠️ En disputa'
  })[r] || '';
}

// Helper: get human label for payment method
function paymentMethodLabel(m) {
  return ({
    check: '📝 Check', cash: '💵 Cash', paytrace: '💳 PayTrace',
    ipospays: '💳 PayTrace', credit_card: '💳 PayTrace', auth_net: '💳 PayTrace', square: '💳 PayTrace',
    ach: '🏦 ACH', zelle: '📱 Zelle', venmo: '📱 Venmo', other: '❓ Other'
  })[m] || '';
}

// Helper: count invoices that need CC / cobro attention
function countCcPending() {
  return allInvoices.filter(i => {
    if (i.status === 'paid') return false;
    return !!i.paymentReason; // any failure reason counts
  }).length;
}

// Helper: invoices with followup date due today or earlier
function dueFollowups() {
  const today = new Date();
  today.setHours(0,0,0,0);
  const todayStr = today.toISOString().split('T')[0];
  return allInvoices.filter(i => {
    if (i.status === 'paid') return false;
    if (!i.nextFollowUp) return false;
    return i.nextFollowUp <= todayStr;
  });
}

// Filter shortcut: show only invoices with payment issues
window.filterByPaymentStatus = function() {
  // Switch to "all" tab and set a virtual filter
  currentFilter = 'cc_pending';
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  // Highlight none specifically; rely on the stat card click
  computeAndRender();
  toast(currentLang === 'en' ? 'Showing invoices with pending collection' : 'Mostrando facturas con cobro pendiente', 'success');
};

// Jump to any filter from alert buttons
window.jumpToFilter = function(filter) {
  currentFilter = filter;
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.filter === filter);
  });
  computeAndRender();
  // Scroll to list
  document.getElementById('invoiceList').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ════════════════════════════════════════════════════════════
// CUSTOMER DETAIL MODAL (QB-style ficha)
// ════════════════════════════════════════════════════════════
let cdCurrentCustomerId = null;
let cdCurrentCustomerName = null;

window.openCustomerDetail = async function(idOrName) {
  // Accept either an id or a customer name (for invoices that match no customer record)
  let c = null;
  if (idOrName) {
    c = allCustomers.find(x => x.id === idOrName);
    if (!c) c = findCustomerByName(idOrName);
  }
  const name = c ? c.name : (idOrName || '');
  cdCurrentCustomerId = c ? c.id : null;
  cdCurrentCustomerName = name;

  // Header
  document.getElementById('cdName').textContent = name || 'Cliente sin registrar';
  const subParts = [];
  if (c?.email) subParts.push(`<span>✉ ${escapeHtml(c.email)}</span>`);
  if (c?.phone) subParts.push(`<span>☎ ${escapeHtml(c.phone)}</span>`);
  if (c?.spaModel) subParts.push(`<span>🛁 ${escapeHtml(c.spaModel)}</span>`);
  if (!c) subParts.push('<span style="color:var(--followup);">⚠ No está en la base de clientes — créalo para guardar info</span>');
  document.getElementById('cdSub').innerHTML = subParts.join('');

  // Customer-specific invoices
  const norm = (name || '').trim().toLowerCase();
  const invs = allInvoices.filter(i => (i.customerName || '').trim().toLowerCase() === norm)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // Summary
  let totalSent = 0, totalPaid = 0, pendingAmt = 0, ccCount = 0;
  for (const i of invs) {
    const amt = Number(i.amount) || 0;
    const s = deriveStatus(i);
    if (s === 'paid') totalPaid += amt;
    else { totalSent += amt; if (s !== 'pending') pendingAmt += amt; }
    if (i.paymentReason && s !== 'paid') ccCount++;
  }
  
  // ─── PAYMENT SCORE (A/B/C) ───
  // A = avg payment ≤7 days + no CC issues
  // B = avg payment 8-30 days OR 1 CC issue
  // C = avg payment >30 days OR 2+ CC issues
  const paidInvs = invs.filter(i => deriveStatus(i) === 'paid' && i.sentAt && i.paidAt);
  let avgDaysToPay = null;
  if (paidInvs.length > 0) {
    const totalDays = paidInvs.reduce((sum, i) => sum + Math.max(0, (i.paidAt - i.sentAt) / 86400000), 0);
    avgDaysToPay = totalDays / paidInvs.length;
  }
  let score, scoreColor, scoreBg, scoreNote;
  if (paidInvs.length === 0) {
    score = '—'; scoreColor = '#64748B'; scoreBg = '#F1F5F9';
    scoreNote = currentLang === 'en' ? 'no paid history' : 'sin historial pagado';
  } else if (avgDaysToPay <= 7 && ccCount === 0) {
    score = 'A'; scoreColor = '#2E8B57'; scoreBg = '#DCFCE7';
    scoreNote = currentLang === 'en' ? 'fast payer' : 'paga rápido';
  } else if (avgDaysToPay <= 30 && ccCount <= 1) {
    score = 'B'; scoreColor = '#CA8A04'; scoreBg = '#FEF9C3';
    scoreNote = currentLang === 'en' ? 'average' : 'promedio';
  } else {
    score = 'C'; scoreColor = '#C0492F'; scoreBg = '#FEE2E2';
    scoreNote = currentLang === 'en' ? 'slow / problematic' : 'lento / problemático';
  }
  
  // ─── LTV (Lifetime Value) — total invoiced ever for this customer ───
  const ltv = totalSent + totalPaid;
  const firstService = invs.length > 0 ? Math.min(...invs.map(i => i.createdAt || Date.now())) : Date.now();
  const yearsCustomer = Math.max(1, Math.round((Date.now() - firstService) / (365 * 86400000) * 10) / 10);
  
  document.getElementById('cdSummaryRow').innerHTML = `
    <div class="cd-summary-card" style="background:${scoreBg};border:2px solid ${scoreColor}40;">
      <div class="cd-summary-label">${currentLang === 'en' ? 'Pay score' : 'Score pago'}</div>
      <div class="cd-summary-value" style="color:${scoreColor};font-size:32px;">${score}</div>
      <div style="font-size:11px;color:${scoreColor};margin-top:-4px;">${escapeHtml(scoreNote)}</div>
      ${avgDaysToPay !== null ? `<div style="font-size:11px;color:var(--text-mute);margin-top:2px;">${currentLang === 'en' ? 'avg' : 'prom'} ${Math.round(avgDaysToPay)}d</div>` : ''}
    </div>
    <div class="cd-summary-card"><div class="cd-summary-label">${currentLang === 'en' ? 'Lifetime value' : 'Valor histórico'}</div><div class="cd-summary-value">${fmtCurrency(ltv)}</div><div style="font-size:11px;color:var(--text-mute);margin-top:2px;">${invs.length} ${currentLang === 'en' ? 'services' : 'servicios'} · ${yearsCustomer}y</div></div>
    <div class="cd-summary-card success"><div class="cd-summary-label">${currentLang === 'en' ? 'Collected' : 'Cobrado'}</div><div class="cd-summary-value">${fmtCurrency(totalPaid)}</div></div>
    <div class="cd-summary-card ${pendingAmt > 0 ? 'warn' : ''}"><div class="cd-summary-label">${currentLang === 'en' ? 'Pending' : 'Pendiente'}</div><div class="cd-summary-value">${fmtCurrency(pendingAmt)}</div></div>
    <div class="cd-summary-card ${ccCount > 0 ? 'danger' : ''}"><div class="cd-summary-label">${currentLang === 'en' ? 'CC alerts' : 'Alertas CC'}</div><div class="cd-summary-value">${ccCount}</div></div>
  `;

  // Contact + spa grid
  const cdRow = (label, val, mono) => `
    <div class="cd-row">
      <span class="cd-row-label">${label}</span>
      <span class="cd-row-value ${val ? (mono ? 'mono' : '') : 'empty'}">${val ? escapeHtml(val) : '— sin dato —'}</span>
    </div>`;
  document.getElementById('cdContactGrid').innerHTML = `
    ${cdRow('Main Email', c?.email)}
    ${cdRow('CC Email', c?.ccEmail)}
    ${cdRow('Main Phone', c?.phone)}
    ${cdRow('Mobile', c?.mobilePhone)}
    ${cdRow('Alt. Phone', c?.altPhone)}
    ${cdRow('Dirección', c?.address)}
    ${cdRow('Saludo (Hi __)', c?.greetingName)}
    ${cdRow('Modelo del spa', c?.spaModel)}
    ${cdRow('Serial #', c?.serialNumber, true)}
    ${cdRow('Cabinet/Pack', c?.cabinet)}
    ${cdRow('Notas internas', c?.notes)}
  `;

  // Components section
  const compEntries = [];
  if (c?.boardNumber) compEntries.push(['Board #', c.boardNumber]);
  if (c?.heaterNumber) compEntries.push(['Heater #', c.heaterNumber]);
  if (c?.topsideNumber) compEntries.push(['Topside Ser #', c.topsideNumber]);
  if (compEntries.length > 0) {
    document.getElementById('cdCompSection').style.display = 'block';
    document.getElementById('cdCompList').innerHTML = compEntries.map(([k, v]) => `
      <div class="cd-comp-item"><span class="cd-comp-item-label">${k}</span><span class="cd-comp-item-val">${escapeHtml(v)}</span></div>
    `).join('');
  } else {
    document.getElementById('cdCompSection').style.display = 'none';
  }

  // Invoice history
  document.getElementById('cdInvCount').textContent = invs.length;
  if (invs.length === 0) {
    document.getElementById('cdInvList').innerHTML = '<div class="cd-tk-empty">Sin facturas para este cliente todavía.</div>';
  } else {
    document.getElementById('cdInvList').innerHTML = invs.map(i => {
      const s = deriveStatus(i);
      const reason = i.paymentReason ? `<span class="payment-pill ${i.paymentReason}">${paymentReasonLabel(i.paymentReason)}</span>` : '';
      return `
        <div class="cd-inv-row" onclick="closeModal('customerDetailModal'); window.openEditModal('${i.id}')">
          <span class="cd-inv-num">#${escapeHtml(i.invoiceNumber)}</span>
          <span>
            <span class="cd-inv-date">${i.serviceDate ? fmtDateShort(i.serviceDate) : (i.createdAt ? fmtDateShort(i.createdAt) : '')}</span>
            ${i.technician ? ` · <span style="color:var(--text-soft);font-size:11px;">${escapeHtml(i.technician)}</span>` : ''}
          </span>
          ${reason}
          <span class="cd-inv-status status-badge ${s}">${statusLabel(s)}</span>
          <span class="cd-inv-amount">${fmtCurrency(i.amount)}</span>
        </div>
      `;
    }).join('');
  }

  // QB raw notes
  if (c?.qbNotesRaw) {
    document.getElementById('cdQbSection').style.display = 'block';
    document.getElementById('cdQbRaw').textContent = c.qbNotesRaw;
  } else {
    document.getElementById('cdQbSection').style.display = 'none';
  }

  // Tickets — fetch async cross-Firebase
  document.getElementById('cdTkList').innerHTML = '<div class="cd-tk-empty">Cargando tickets…</div>';
  document.getElementById('cdTkCount').textContent = '…';

  // Open modal first, then load tickets in background
  document.getElementById('customerDetailModal').classList.add('open');

  try {
    const tickets = await fetchTicketsForCustomer(name);
    renderTicketsInDetail(tickets);
  } catch (err) {
    console.error('Ticket fetch error', err);
    document.getElementById('cdTkList').innerHTML = `<div class="cd-tk-empty">No se pudieron cargar los tickets:<br><span style="font-size:11px;">${escapeHtml(err.message || 'Error de red')}</span></div>`;
    document.getElementById('cdTkCount').textContent = '?';
  }
};

window.cdToggleSection = function(titleEl) {
  const section = titleEl.closest('.cd-section');
  section.classList.toggle('collapsed');
};

window.cdEditCustomer = function() {
  if (cdCurrentCustomerId) {
    closeModal('customerDetailModal');
    setTimeout(() => window.openEditCustomerModal(cdCurrentCustomerId), 180);
  } else {
    // No customer record — open add modal pre-filled with name
    closeModal('customerDetailModal');
    setTimeout(() => {
      window.openAddCustomerModal();
      document.getElementById('cName').value = cdCurrentCustomerName || '';
    }, 180);
  }
};

window.cdNewInvoiceForCustomer = function() {
  closeModal('customerDetailModal');
  setTimeout(() => {
    window.openAddModal();
    if (cdCurrentCustomerName) document.getElementById('fCustomerName').value = cdCurrentCustomerName;
    const c = allCustomers.find(x => x.id === cdCurrentCustomerId);
    if (c) {
      document.getElementById('fCustomerEmail').value = c.email || '';
      document.getElementById('fCustomerPhone').value = c.phone || '';
      document.getElementById('fGreetingName').value = c.greetingName || '';
      document.getElementById('fSpaModel').value = c.spaModel || '';
      document.getElementById('fSerial').value = c.serialNumber || '';
    }
  }, 180);
};

// ════════════════════════════════════════════════════════════
// CROSS-FIREBASE: Fetch tickets from tech-tickets-a9485
// ════════════════════════════════════════════════════════════
// TICKETS DB config — backed by tech-tickets-a9485 Firebase project
// Both the mobile PWA and the TECH-TICKETS web admin use the same backend.
// The web admin has a dedicated 'customers' collection with rich profile data
// (billTo, city, zip, mainPhone, spaDescription, etc.) — try that first.
const DEFAULT_TICKETS_DB = {
  apiKey: 'AIzaSyDsmFIRqRrvTqRgzWKLFjA9Sdnro7nz8zc',
  projectId: 'tech-tickets-a9485',
  ticketsCollection: 'tickets',
  customersCollection: 'customers'
};

function getTicketsDbConfig() {
  if (savedSettings.ticketsDb && savedSettings.ticketsDb.apiKey && savedSettings.ticketsDb.projectId) {
    return savedSettings.ticketsDb;
  }
  return DEFAULT_TICKETS_DB;
}

// ════════════════════════════════════════════════════════════
// TICKETS Anonymous Auth — sign in to tech-tickets-a9485 to get an
// auth token for Firestore REST calls. Lets us use rules:
//   allow read, write: if request.auth != null;
// instead of public read. Same pattern Alberto uses in TECH-TICKETS app.
// ════════════════════════════════════════════════════════════
let _ticketsAuthApp = null;
let _ticketsAuthToken = null;
let _ticketsAuthTokenExp = 0;
let _ticketsAuthLastError = null; // surfaced to the user for clearer diagnostics

async function getTicketsAuthToken() {
  /* FIX v2.25.6 (12 ago 2026) — USAR LA SESION DE PERSONAL DE ESTA MISMA PAGINA.
     Este helper viene de la app SUELTA del Invoice Tracker, que vivia en otro
     proyecto y no tenia mas remedio que abrir una sesion ANONIMA aparte contra
     tech-tickets. Ahora el Invoice Tracker corre DENTRO de TECH-TICKETS, que ya
     tiene sesion de personal (claim staff:true) sobre EL MISMO proyecto.
     Las reglas v3 dejan cross_app_events con create+read para cualquier sesion
     firmada, pero UPDATE solo para isStaff() — por eso resolveCrossAppEvent
     devolvia 403 PERMISSION_DENIED en cada intento y las alertas de pago nunca
     se cerraban desde el Invoice Tracker.
     El token del app principal NO se cachea aqui: el SDK ya lo refresca solo, y
     cachearlo una hora congelaria una sesion anonima de antes del login. */
  try {
    if (window.firebase && firebase.apps && firebase.apps.length && firebase.auth) {
      const u = firebase.auth().currentUser;
      if (u) {
        const tk = await u.getIdToken();
        if (tk) return tk;
      }
    }
  } catch (_mainAuth) { /* si algo falla, cae al camino anonimo de siempre */ }
  // Return cached token if still valid (refresh 5 min before expiry)
  if (_ticketsAuthToken && Date.now() < _ticketsAuthTokenExp - 300_000) {
    return _ticketsAuthToken;
  }
  const cfg = getTicketsDbConfig();
  // Retry up to 3 times with backoff — transient internet drops (the
  // ERR_NAME_NOT_RESOLVED / ERR_INTERNET_DISCONNECTED on securetoken we saw)
  // would otherwise leave us with NO token and every Firestore call 401s.
  const MAX_TRIES = 3;
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    try {
      if (!_ticketsAuthApp) {
        // Initialize a SECOND Firebase app — different project, separate auth
        _ticketsAuthApp = initializeApp({
          apiKey: cfg.apiKey,
          authDomain: `${cfg.projectId}.firebaseapp.com`,
          projectId: cfg.projectId
        }, 'tickets-auth'); // unique app name (Firebase requires it)
      }
      const auth = getAuth(_ticketsAuthApp);
      if (!auth.currentUser) {
        await signInAnonymously(auth);
        console.info('[TicketsAuth] Signed in anonymously to', cfg.projectId, 'UID:', auth.currentUser?.uid);
      }
      // force-refresh (getIdToken(true)) so we never send a stale/expired token.
      // A stale token is the classic cause of "401 UNAUTHENTICATED" when the
      // securetoken refresh endpoint was briefly unreachable on a prior call.
      const token = await auth.currentUser.getIdToken(true);
      _ticketsAuthToken = token;
      _ticketsAuthTokenExp = Date.now() + 60 * 60 * 1000; // Firebase ID tokens last 1 hour
      _ticketsAuthLastError = null;
      return token;
    } catch (err) {
      _ticketsAuthLastError = { code: err.code, message: err.message, at: Date.now() };
      const isNetwork = /network|disconnect|name_not_resolved|fetch|timeout/i.test((err.code || '') + (err.message || ''));
      console.warn(`[TicketsAuth] attempt ${attempt}/${MAX_TRIES} failed:`, err.code, err.message, isNetwork ? '(network)' : '');
      // auth/operation-not-allowed = Anonymous sign-in is DISABLED in the
      // Firebase console — retrying won't help, bail immediately with a hint.
      if (err.code === 'auth/operation-not-allowed') {
        _ticketsAuthLastError.hint = 'Anonymous auth is disabled in tech-tickets-a9485. Enable it: Firebase Console → Authentication → Sign-in method → Anonymous → Enable.';
        console.error('[TicketsAuth] ' + _ticketsAuthLastError.hint);
        return null;
      }
      if (attempt < MAX_TRIES) {
        await new Promise(r => setTimeout(r, attempt * 800)); // 0.8s, 1.6s backoff
      }
    }
  }
  return null; // all retries exhausted
}

// Human-readable status of the TECH-TICKETS connection — used by the customer
// search UI so Nela sees WHY it failed instead of a bare "401".
function getTicketsConnectionHint(lang) {
  const en = lang === 'en';
  if (!_ticketsAuthLastError) return en ? 'Connected' : 'Conectado';
  if (_ticketsAuthLastError.hint) return _ticketsAuthLastError.hint;
  const isNetwork = /network|disconnect|name_not_resolved|fetch|timeout/i
    .test((_ticketsAuthLastError.code || '') + (_ticketsAuthLastError.message || ''));
  if (isNetwork) {
    return en
      ? 'No internet connection to reach TECH-TICKETS. Check your wifi and click 🔄 to retry.'
      : 'Sin conexión a internet para llegar a TECH-TICKETS. Revisa tu wifi y dale 🔄 para reintentar.';
  }
  return (en ? 'Auth error: ' : 'Error de autenticación: ') + (_ticketsAuthLastError.code || _ticketsAuthLastError.message || 'unknown');
}

// ════════════════════════════════════════════════════════════
// CROSS-APP EVENT BUS — publishes to tech-tickets-a9485/cross_app_events
// ════════════════════════════════════════════════════════════
// Mirrors TECH-TICKETS' _custKeys / _custGroupKey so customer matching is
// consistent across apps. "Sickbert, Michelle" and "Michelle Sickbert" both
// resolve to "fam:sickbert" → same customer in TECH-TICKETS.
/* v2.58.0 — ANTES ESTE MÓDULO TENÍA SU PROPIA COPIA, Y ERA LA PEOR DE TODAS:
   _custGroupKey devolvía 'fam:' + APELLIDO SOLO, así que para el Invoice Tracker
   TODOS los Miller eran un único cliente. Vive en un bloque de tipo module, así
   que no contaminaba el global — pero sí mandaba dentro de la pestaña Invoices y
   es la clave que se estampa en los cross_app_events que publica.
   Ahora delega en la definición canónica de la app. El respaldo local es una
   copia EXACTA de esa misma regla, no una variante: solo corre si el módulo se
   cargara antes que el script principal, y da el mismo resultado. */
function _aspIdNormM(s){
  var l = String(s || '').toLowerCase();
  if (l.normalize) l = l.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return l.replace(/['\u2018\u2019\-\u2010\u2011\u2013\u2014.]/g, '');
}
function _custGroupKey(s) {
  if (typeof window !== 'undefined' && typeof window._custGroupKey === 'function'
      && window._custGroupKey !== _custGroupKey) return window._custGroupKey(s);
  if (!s) return '';
  const lower = _aspIdNormM(s);
  const clean = lower.replace(/[^a-z0-9, ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return lower.replace(/[^a-z0-9]/g, '');
  const sig = clean.replace(/,/g, ' ').split(/\s+/)
    .filter(w => w.length >= 2 && w !== 'and' && w !== 'the');
  if (!sig.length) return lower.replace(/[^a-z0-9]/g, '');
  sig.sort();
  return 'fam:' + sig.join('|');
}
function _custKeys(s) {
  if (typeof window !== 'undefined' && typeof window._custKeys === 'function'
      && window._custKeys !== _custKeys) return window._custKeys(s);
  if (!s) return [];
  const out = [];
  const fullNorm = _aspIdNormM(s).replace(/[^a-z0-9]/g, '');
  if (fullNorm) out.push(fullNorm);
  const gk = _custGroupKey(s);
  if (gk && out.indexOf(gk) < 0) out.push(gk);
  return out;
}

// Firestore REST value wrapper — converts JS value to Firestore format
function _firestoreWrap(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(_firestoreWrap) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = _firestoreWrap(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

// Publish a cross-app event to tech-tickets-a9485/cross_app_events.
// Schema (contract — DO NOT change without updating consumers):
//   eventType:     'payment_alert' | 'chem_service_overdue' | 'inventory_low' | ...
//   sourceApp:     'invoice-tracker' | 'chemical-maintenance' | 'payroll' | ...
//   customerKey:   _custGroupKey(customerName) — stable cross-app match key
//   customerName:  display name as it appears in source app
//   payload:       event-type-specific data
//   severity:      'info' | 'warn' | 'urgent'
//   status:        'open' (set on publish; consumer flips to 'acknowledged'/'resolved')
//   createdAt:     server timestamp
//   createdBy:     'alberto' or other identifier
async function publishCrossAppEvent({ eventType, customerName, payload, severity = 'warn', createdBy = 'invoice-tracker' }) {
  if (!eventType || !customerName) {
    console.warn('[CrossAppEvent] Missing required fields:', { eventType, customerName });
    return null;
  }
  const cfg = getTicketsDbConfig();
  const token = await getTicketsAuthToken();
  if (!token) {
    throw new Error('No auth token for tech-tickets — cannot publish event');
  }
  const body = {
    fields: {
      eventType: _firestoreWrap(eventType),
      sourceApp: _firestoreWrap('invoice-tracker'),
      customerKey: _firestoreWrap(_custGroupKey(customerName)),  // single key, for indexing on source
      customerKeys: _firestoreWrap(_custKeys(customerName)),     // ARRAY of keys, for cross-app matching (intersection)
      customerName: _firestoreWrap(customerName),
      payload: _firestoreWrap(payload || {}),
      severity: _firestoreWrap(severity),
      status: _firestoreWrap('open'),
      createdBy: _firestoreWrap(createdBy),
      createdAt: { timestampValue: new Date().toISOString() },
      resolvedAt: { nullValue: null },
      resolvedBy: { nullValue: null }
    }
  };
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/cross_app_events?key=${cfg.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Publish failed (HTTP ${res.status}): ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  console.info('[CrossAppEvent] Published', eventType, 'for', customerName, '→', data.name?.split('/').pop());
  return data;
}

// ════════════════════════════════════════════════════════════
// RESOLVE a cross_app_event in tech-tickets-a9485 (Gap B fix).
// When Invoice Tracker marks an invoice PAID, we PATCH the matching
// cross_app_event(s) so TECH-TICKETS Alerts Center closes the task and
// shows "resolved" — the same as if someone clicked Resolve over there.
// This makes the two apps talk both ways instead of one-way.
//   eventId:     Firestore doc ID stored on the invoice history at publish time
//   resolvedBy:  who triggered it (the Invoice Tracker user)
//   reason:      short machine reason, e.g. 'paid_in_invoice_tracker'
// Returns true on success, false on failure (never throws — best-effort).
async function resolveCrossAppEvent(eventId, resolvedBy, reason) {
  if (!eventId) return false;
  try {
    const cfg = getTicketsDbConfig();
    const token = await getTicketsAuthToken();
    if (!token) { console.warn('[ResolveEvent] No auth token — skipping', eventId); return false; }
    // updateMask lists EXACTLY the fields we touch so we don't clobber the rest
    const masks = ['status', 'resolvedAt', 'resolvedBy', 'resolvedReason']
      .map(f => 'updateMask.fieldPaths=' + encodeURIComponent(f)).join('&');
    const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/cross_app_events/${eventId}?key=${cfg.apiKey}&${masks}`;
    const body = {
      fields: {
        status: { stringValue: 'resolved' },
        resolvedAt: { timestampValue: new Date().toISOString() },
        resolvedBy: { stringValue: resolvedBy || 'Invoice Tracker' },
        resolvedReason: { stringValue: reason || 'paid_in_invoice_tracker' }
      }
    };
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn(`[ResolveEvent] PATCH failed (HTTP ${res.status}) for ${eventId}: ${txt.slice(0, 160)}`);
      return false;
    }
    console.info('[ResolveEvent] Resolved cross_app_event', eventId, 'by', resolvedBy);
    return true;
  } catch (err) {
    console.warn('[ResolveEvent] Error resolving', eventId, err.message);
    return false;
  }
}

// Resolve ALL open cross-app alerts published for a given invoice. Reads the
// invoice's history for 'crossapp_alert_published' entries, resolves each
// eventId in TECH-TICKETS, and stamps a 'crossapp_alert_resolved' entry back
// on the invoice so the local UI + inbox stay consistent. Best-effort: a
// network hiccup never blocks the "mark paid" flow.
async function resolveInvoiceCrossAppAlerts(inv, resolvedBy, reason) {
  try {
    if (!inv || !Array.isArray(inv.history)) return { attempted: 0, resolved: 0 };
    const pubs = inv.history.filter(h => h.action === 'crossapp_alert_published' && h.eventId);
    if (!pubs.length) return { attempted: 0, resolved: 0 };
    // Skip ones we already recorded as resolved locally
    const alreadyResolved = new Set(
      inv.history.filter(h => h.action === 'crossapp_alert_resolved' && h.eventId).map(h => h.eventId)
    );
    const todo = pubs.filter(p => !alreadyResolved.has(p.eventId));
    if (!todo.length) return { attempted: 0, resolved: 0 };
    let resolved = 0;
    const newHist = (inv.history || []).slice();
    for (const pub of todo) {
      const ok = await resolveCrossAppEvent(pub.eventId, resolvedBy, reason);
      if (ok) {
        resolved++;
        newHist.push({
          action: 'crossapp_alert_resolved',
          eventId: pub.eventId,
          by: resolvedBy || 'Invoice Tracker',
          reason: reason || 'paid_in_invoice_tracker',
          at: Date.now()
        });
      }
    }
    if (resolved > 0) {
      await updateInvoiceData(inv.id, { history: newHist });
    }
    return { attempted: todo.length, resolved };
  } catch (err) {
    console.warn('[ResolveInvoiceAlerts] Error', err.message);
    return { attempted: 0, resolved: 0 };
  }
}

// ════════════════════════════════════════════════════════════
// QB RECONCILIATION IMPORTER (#1 + #3)
// Nela exports a report from QuickBooks Desktop (Open Invoices or Payments),
// pastes the rows (or uploads a CSV), and we bulk-detect which invoices got
// paid — then mark them paid + auto-resolve their TECH-TICKETS alerts. Kills
// the "check 40 invoices one by one" problem. No external library: we parse
// CSV/TSV ourselves so a blocked CDN never breaks it.
// ════════════════════════════════════════════════════════════
let _qbRecMatches = []; // [{invId, num, customer, amount, appAmount, confidence}]

// Normalize an invoice number for matching: digits only, no leading zeros.
function _qbNormNum(s) {
  return String(s == null ? '' : s).replace(/[^0-9]/g, '').replace(/^0+/, '');
}
// Parse a money-ish string ("$1,234.50", "1.234,50", "(123.00)") to a number.
function _qbParseAmount(s) {
  if (s == null) return NaN;
  let t = String(s).trim();
  const neg = /^\(.*\)$/.test(t); // accounting negatives
  t = t.replace(/[()$\s]/g, '');
  // If both , and . present, assume , is thousands sep
  if (t.indexOf(',') > -1 && t.indexOf('.') > -1) t = t.replace(/,/g, '');
  else if (t.indexOf(',') > -1 && t.indexOf('.') === -1) t = t.replace(/,/g, ''); // 1,234 -> 1234
  const n = parseFloat(t);
  return isNaN(n) ? NaN : (neg ? -n : n);
}
// Split one CSV/TSV line into cells, honoring "quoted, fields".
function _qbSplitLine(line, delim) {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === delim) { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

// Parse pasted text → array of {num, amount, name}. Auto-detects delimiter,
// header row, and which columns hold the number / amount / customer.
function _qbParseReport(text) {
  const rawLines = text.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.trim().length);
  if (!rawLines.length) return { rows: [], error: 'empty' };
  // Delimiter: tab if any line has one (Excel paste), else comma
  const delim = rawLines.some(l => l.indexOf('\t') > -1) ? '\t' : ',';
  const grid = rawLines.map(l => _qbSplitLine(l, delim));
  // Find a header row: the row containing a recognizable "number" header
  const numHdr = /^(num|number|no\.?|invoice\s*#?|invoice\s*number|doc\s*num|trans\s*#?|#)$/i;
  const amtHdr = /^(amount|open\s*balance|balance|total|amt|orig\.?\s*amount)$/i;
  const nameHdr = /^(name|customer|customer:job|client|bill\s*to)$/i;
  const typeHdr = /^(type|transaction\s*type)$/i;
  let headerIdx = -1, colNum = -1, colAmt = -1, colName = -1, colType = -1;
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const row = grid[r];
    let n = -1, a = -1, nm = -1, ty = -1;
    row.forEach((cell, ci) => {
      const c = cell.trim();
      if (n < 0 && numHdr.test(c)) n = ci;
      if (a < 0 && amtHdr.test(c)) a = ci;
      if (nm < 0 && nameHdr.test(c)) nm = ci;
      if (ty < 0 && typeHdr.test(c)) ty = ci;
    });
    if (n >= 0 || a >= 0) { headerIdx = r; colNum = n; colAmt = a; colName = nm; colType = ty; break; }
  }
  // Build a quick lookup of app invoice numbers for content-based fallback
  const appNums = new Set((allInvoices || []).map(i => _qbNormNum(i.invoiceNumber)));
  // Fallback column detection by content if no header found
  if (headerIdx < 0) {
    const sample = grid.slice(0, Math.min(grid.length, 40));
    const score = (ci, fn) => sample.reduce((s, row) => s + (fn(row[ci]) ? 1 : 0), 0);
    let bestNum = -1, bestNumScore = 0, bestAmt = -1, bestAmtScore = 0;
    const width = Math.max(...grid.map(r => r.length));
    for (let ci = 0; ci < width; ci++) {
      const ns = score(ci, v => v && appNums.has(_qbNormNum(v)));
      if (ns > bestNumScore) { bestNumScore = ns; bestNum = ci; }
      const as = score(ci, v => v && !isNaN(_qbParseAmount(v)) && /\d/.test(v) && /[.,]/.test(v));
      if (as > bestAmtScore) { bestAmtScore = as; bestAmt = ci; }
    }
    colNum = bestNum; colAmt = bestAmt; headerIdx = -1;
  }
  if (colNum < 0 && colAmt < 0) return { rows: [], error: 'no_columns' };
  // Extract data rows (skip header)
  const rows = [];
  for (let r = (headerIdx >= 0 ? headerIdx + 1 : 0); r < grid.length; r++) {
    const row = grid[r];
    // If a Type column exists, keep only Invoice / Payment rows (skip Total etc.)
    if (colType >= 0) {
      const ty = (row[colType] || '').toLowerCase();
      if (ty && !/invoice|payment|receipt|credit/.test(ty)) continue;
    }
    const numRaw = colNum >= 0 ? row[colNum] : '';
    const num = _qbNormNum(numRaw);
    if (!num) continue; // a usable row needs an invoice number
    const amount = colAmt >= 0 ? _qbParseAmount(row[colAmt]) : NaN;
    const name = colName >= 0 ? (row[colName] || '') : '';
    rows.push({ num, amount: isNaN(amount) ? null : amount, name });
  }
  return { rows, delim, headerIdx, colNum, colAmt, colName };
}

window.openQbReconcile = function() {
  const en = currentLang === 'en';
  // i18n labels
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('qbRecTitle', en ? 'Reconcile with QuickBooks' : 'Reconciliar con QuickBooks');
  set('qbRecModeOpenT', en ? 'Open Invoices (what they still owe)' : 'Open Invoices (lo que aún deben)');
  set('qbRecModeOpenD', en ? "What's NOT in the list = already paid" : 'Lo que NO esté en la lista = ya se pagó');
  set('qbRecModePaidT', en ? 'Payments received' : 'Pagos recibidos');
  set('qbRecModePaidD', en ? "What IS in the list = paid" : 'Lo que SÍ esté en la lista = se pagó');
  set('qbRecUploadLbl', en ? 'Upload Excel/CSV' : 'Subir Excel/CSV');
  set('qbRecParseLbl', en ? 'Analyze' : 'Analizar');
  set('qbRecApplyLbl', en ? 'Apply (mark paid)' : 'Aplicar (marcar pagadas)');
  set('qbRecCancelBtn', en ? 'Cancel' : 'Cancelar');
  set('qbRecBackBtn', en ? '← Back' : '← Atrás');
  set('qbRecSelAll', en ? '✓ Select all' : '✓ Marcar todas');
  set('qbRecSelNone', en ? '✕ None' : '✕ Ninguna');
  const intro = document.getElementById('qbRecIntro');
  if (intro) intro.innerHTML = en
    ? 'Export the <b>Open Invoices</b> report from QuickBooks (Reports → Customers &amp; Receivables → Open Invoices), open it in Excel, copy the rows and <b>paste</b> them below. Or upload a CSV.'
    : 'Exporta de QuickBooks el reporte <b>Open Invoices</b> (Reports → Customers &amp; Receivables → Open Invoices), ábrelo en Excel, copia las filas y <b>pégalas</b> abajo. O sube un archivo CSV.';
  // reset state
  document.getElementById('qbRecPaste').value = '';
  document.getElementById('qbRecParseMsg').innerHTML = '';
  document.getElementById('qbRecStep1').style.display = '';
  document.getElementById('qbRecStep2').style.display = 'none';
  document.getElementById('qbRecApplyBtn').style.display = 'none';
  document.getElementById('qbRecBackBtn').style.display = 'none';
  _qbRecMatches = [];
  document.getElementById('qbReconcileModal').classList.add('open');
};

window.qbRecLoadFile = async function(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const en = currentLang === 'en';
  const name = (file.name || '').toLowerCase();
  const isExcel = /\.(xlsx|xlsm|xlsb|xls)$/i.test(name);
  const isPdf = /\.pdf$/i.test(name);
  const msgEl = document.getElementById('qbRecParseMsg');
  // CRITICAL: reset the file input value at the very end so re-selecting the SAME file
  // fires onchange again. Without this, picking the same file twice silently does nothing.
  const resetInput = () => { try { event.target.value = ''; } catch (_e) {} };
  // Friendly catch: someone drops a PDF (likely an Authorize.net invoice) into the QB report uploader.
  // PDFs are NOT bulk reports — they go through the "+ Nueva Factura" → PDF dropzone, not here.
  if (isPdf) {
    msgEl.innerHTML = `<span style="color:var(--pending);line-height:1.5;display:block;">⚠ ${en
      ? "That's a PDF, not a QuickBooks report. PDFs go through <b>+ New Invoice → drag PDF</b> (auto-extracts fields). This uploader expects an <b>Excel/CSV bulk report</b> from QB Desktop."
      : "Eso es un PDF, no un reporte de QuickBooks. Los PDFs van por <b>+ Nueva Factura → arrastra PDF</b> (auto-extrae campos). Este importador espera un <b>reporte Excel/CSV bulk</b> de QB Desktop."}</span>`;
    resetInput();
    return;
  }
  if (isExcel) {
    // Excel (.xlsx/.xls/.xlsm/.xlsb) needs a parser — lazy-load SheetJS only when needed.
    msgEl.innerHTML = `<span style="color:var(--text-soft);">${en ? 'Reading Excel…' : 'Leyendo Excel…'}</span>`;
    try {
      const XLSX = await _loadSheetJS();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const tsv = XLSX.utils.sheet_to_csv(ws, { FS: '\t' });
      document.getElementById('qbRecPaste').value = tsv;
      const rowCount = tsv.split('\n').filter(l => l.trim()).length;
      msgEl.innerHTML = `<span style="color:var(--sent);">${en
        ? `✓ Excel loaded · ${rowCount} row${rowCount !== 1 ? 's' : ''} ready · click <b>Analyze</b>`
        : `✓ Excel cargado · ${rowCount} fila${rowCount !== 1 ? 's' : ''} listas · click <b>Analizar</b>`}</span>`;
    } catch (e) {
      console.warn('[QBRec] Excel read failed:', e);
      msgEl.innerHTML = `<span style="color:var(--pending);line-height:1.5;display:block;">⚠ ${en
        ? "Couldn't read Excel (your VPN/blocker may be blocking the reader). <b>Easiest fix:</b> open the file in Excel, select the rows, Copy, and <b>PASTE</b> them in the box above. Or in Excel: File → Save As → CSV, then upload the .csv."
        : "No pude leer el Excel (tu VPN/bloqueador puede estar bloqueando el lector). <b>Más fácil:</b> abre el archivo en Excel, selecciona las filas, Copia y <b>PÉGALAS</b> en el cuadro de arriba. O en Excel: Archivo → Guardar como → CSV, y sube el .csv."}</span>`;
    }
    resetInput();
    return;
  }
  // CSV / TSV / plain text — read directly, no library needed
  msgEl.innerHTML = `<span style="color:var(--text-soft);">${en ? 'Reading file…' : 'Leyendo archivo…'}</span>`;
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result || '';
    document.getElementById('qbRecPaste').value = text;
    // FIX: previously this path had no success feedback, so users saw a stale "Reading…" message
    // and clicked Analyze before being confident the file actually loaded. Now we confirm it.
    const rowCount = String(text).split('\n').filter(l => l.trim()).length;
    msgEl.innerHTML = `<span style="color:var(--sent);">${en
      ? `✓ File loaded · ${rowCount} row${rowCount !== 1 ? 's' : ''} ready · click <b>Analyze</b>`
      : `✓ Archivo cargado · ${rowCount} fila${rowCount !== 1 ? 's' : ''} listas · click <b>Analizar</b>`}</span>`;
    resetInput();
  };
  reader.onerror = () => {
    msgEl.innerHTML = `<span style="color:var(--pending);">⚠ ${en ? "Couldn't read file" : 'No se pudo leer el archivo'}</span>`;
    resetInput();
  };
  reader.readAsText(file);
};

// Lazy-load SheetJS from CDN, only the first time an Excel file is uploaded.
// Kept out of the main bundle so a blocked CDN never breaks the rest of the app.
let _sheetJSPromise = null;
function _loadSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (_sheetJSPromise) return _sheetJSPromise;
  _sheetJSPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('XLSX not available'));
    s.onerror = () => reject(new Error('Failed to load SheetJS (blocked?)'));
    document.head.appendChild(s);
    setTimeout(() => { if (!window.XLSX) reject(new Error('SheetJS load timeout')); }, 8000);
  });
  return _sheetJSPromise;
}

window.qbRecParse = function() {
  const en = currentLang === 'en';
  const text = document.getElementById('qbRecPaste').value || '';
  const msgEl = document.getElementById('qbRecParseMsg');
  if (!text.trim()) { msgEl.innerHTML = `<span style="color:var(--pending);">⚠ ${en ? 'Paste or upload your QB report first' : 'Pega o sube tu reporte de QB primero'}</span>`; return; }
  const mode = (document.querySelector('input[name="qbRecMode"]:checked') || {}).value || 'open';
  const parsed = _qbParseReport(text);
  if (parsed.error || !parsed.rows.length) {
    msgEl.innerHTML = `<span style="color:var(--pending);">⚠ ${en ? "Couldn't find invoice numbers in that data. Make sure the report includes a Num/Invoice # column." : 'No encontré números de factura. Asegúrate que el reporte tenga una columna Num/Invoice #.'}</span>`;
    return;
  }
  // Set of invoice numbers present in the QB report
  const reportNums = new Set(parsed.rows.map(r => r.num));
  const reportByNum = {}; parsed.rows.forEach(r => { reportByNum[r.num] = r; });
  // Open invoices in the app (anything not already paid)
  const openInvoices = (allInvoices || []).filter(i => i.status !== 'paid');
  const matches = [];
  if (mode === 'open') {
    // Open Invoices report = still owed. App-open invoice NOT in report → paid.
    openInvoices.forEach(inv => {
      const n = _qbNormNum(inv.invoiceNumber);
      if (n && !reportNums.has(n)) {
        matches.push({ invId: inv.id, num: inv.invoiceNumber, customer: inv.customerName, appAmount: Number(inv.amount) || 0, amount: null, confidence: 'paid_gone' });
      }
    });
  } else {
    // Payments report = these got paid. App-open invoice IN report → paid.
    openInvoices.forEach(inv => {
      const n = _qbNormNum(inv.invoiceNumber);
      if (n && reportNums.has(n)) {
        const rep = reportByNum[n];
        const amtMatch = rep.amount == null ? null : Math.abs((Number(inv.amount) || 0) - Math.abs(rep.amount)) < 0.02;
        matches.push({ invId: inv.id, num: inv.invoiceNumber, customer: inv.customerName, appAmount: Number(inv.amount) || 0, amount: rep.amount, confidence: amtMatch === false ? 'amount_mismatch' : 'matched' });
      }
    });
  }
  _qbRecMatches = matches;
  // Render review step
  const listEl = document.getElementById('qbRecList');
  const sumEl = document.getElementById('qbRecSummary');
  const parsedCount = parsed.rows.length;
  const openCount = openInvoices.length;
  if (!matches.length) {
    sumEl.innerHTML = `<span style="color:var(--sent);">✓ ${en ? 'Nothing to reconcile — your app already matches QB. 🎉' : 'Nada que reconciliar — tu app ya coincide con QB. 🎉'}</span><div style="font-size:11px;color:var(--text-soft);font-weight:400;margin-top:4px;">${en ? 'Read' : 'Leí'} ${parsedCount} ${en ? 'rows from QB' : 'filas de QB'} · ${openCount} ${en ? 'open invoices in app' : 'facturas abiertas en la app'}</div>`;
    listEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-soft);font-size:13px;">${en ? 'All ' + openCount + ' open invoices accounted for.' : 'Las ' + openCount + ' facturas abiertas están al día.'}</div>`;
    document.getElementById('qbRecApplyBtn').style.display = 'none';
  } else {
    const totalAmt = matches.reduce((s, m) => s + (m.appAmount || 0), 0);
    // ── SAFETY GUARD (Open Invoices mode) ──
    // If a suspiciously high share of open invoices would be marked paid, the
    // pasted report was probably TRUNCATED (only part of the rows copied).
    // Warn loudly and leave everything UNCHECKED so nothing is applied by accident.
    let truncationWarn = '';
    let preCheck = true;
    if (mode === 'open' && openCount > 0) {
      const ratio = matches.length / openCount;
      if (ratio > 0.4) {
        preCheck = false;
        truncationWarn = `<div style="margin-bottom:10px;padding:10px 12px;background:#FEF2F2;border:2px solid #FCA5A5;border-radius:8px;color:#991B1B;font-size:12px;line-height:1.5;">
          ⚠️ <b>${en ? 'Heads up' : 'Cuidado'}:</b> ${en
            ? `this would mark <b>${matches.length} of ${openCount}</b> open invoices as paid (${Math.round(ratio*100)}%). That's a lot — your QB paste may have been <b>cut off</b>. I left everything <b>unchecked</b>. Re-copy the FULL report (all rows) and try again, or check only the ones you're sure about.`
            : `esto marcaría <b>${matches.length} de ${openCount}</b> facturas abiertas como pagadas (${Math.round(ratio*100)}%). Es mucho — tu copia de QB pudo haberse <b>cortado</b>. Dejé todo <b>sin marcar</b>. Vuelve a copiar el reporte COMPLETO (todas las filas) e intenta de nuevo, o marca solo las que estés segura.`}
        </div>`;
      }
    }
    sumEl.innerHTML = (en
      ? `Found <b>${matches.length}</b> invoice${matches.length !== 1 ? 's' : ''} that appear <b>PAID</b> in QB but still open here — total <b>${fmtCurrency(totalAmt)}</b>. Review and apply:`
      : `Encontré <b>${matches.length}</b> factura${matches.length !== 1 ? 's' : ''} que aparecen <b>PAGADAS</b> en QB pero abiertas aquí — total <b>${fmtCurrency(totalAmt)}</b>. Revisa y aplica:`)
      + `<div style="font-size:11px;color:var(--text-soft);font-weight:400;margin-top:4px;">${en ? 'Read' : 'Leí'} ${parsedCount} ${en ? 'rows from QB' : 'filas de QB'} · ${openCount} ${en ? 'open in app' : 'abiertas en app'}</div>`
      + truncationWarn
      + (matches.length > 8 ? `<input type="text" id="qbRecSearch" oninput="window.qbRecFilter()" placeholder="${en ? '🔍 Filter by name or invoice #…' : '🔍 Filtrar por nombre o # factura…'}" style="width:100%;margin-top:10px;padding:8px 10px;border:1px solid var(--border);border-radius:7px;font-size:12px;box-sizing:border-box;">` : '');
    listEl.innerHTML = matches.map((m, idx) => {
      const warn = m.confidence === 'amount_mismatch';
      const badge = warn
        ? `<span style="font-size:11px;font-weight:700;color:#92400E;background:#FEF3C7;border-radius:4px;padding:1px 6px;">⚠ ${en ? 'amount differs' : 'monto difiere'}</span>`
        : '';
      const chk = (preCheck && !warn) ? 'checked' : '';
      return `<label class="qbRecRow" data-search="${escapeHtml((String(m.num) + ' ' + (m.customer||'')).toLowerCase())}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;${warn ? 'background:#FFFBEB;' : ''}">
        <input type="checkbox" class="qbRecChk" data-idx="${idx}" ${chk}>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;">#${escapeHtml(String(m.num))} · ${escapeHtml(m.customer || '')}</div>
          <div style="font-size:11px;color:var(--text-soft);">${fmtCurrency(m.appAmount)}${m.amount != null ? ` · QB: ${fmtCurrency(Math.abs(m.amount))}` : ''} ${badge}</div>
        </div>
      </label>`;
    }).join('');
    document.getElementById('qbRecApplyBtn').style.display = '';
  }
  document.getElementById('qbRecStep1').style.display = 'none';
  document.getElementById('qbRecStep2').style.display = '';
  document.getElementById('qbRecBackBtn').style.display = '';
};

// Filter the review list as Nela types (large reconciliations).
window.qbRecFilter = function() {
  const q = (document.getElementById('qbRecSearch')?.value || '').toLowerCase().trim();
  document.querySelectorAll('#qbRecList .qbRecRow').forEach(row => {
    const hay = row.getAttribute('data-search') || '';
    row.style.display = (!q || hay.indexOf(q) > -1) ? '' : 'none';
  });
};

window.qbRecToggleAll = function(state) {
  document.querySelectorAll('.qbRecChk').forEach(c => { c.checked = state; });
};
window.qbRecBack = function() {
  document.getElementById('qbRecStep1').style.display = '';
  document.getElementById('qbRecStep2').style.display = 'none';
  document.getElementById('qbRecApplyBtn').style.display = 'none';
  document.getElementById('qbRecBackBtn').style.display = 'none';
};

window.qbRecApply = async function() {
  const en = currentLang === 'en';
  const checked = [...document.querySelectorAll('.qbRecChk')].filter(c => c.checked).map(c => parseInt(c.dataset.idx, 10));
  if (!checked.length) { toast(en ? 'Select at least one' : 'Selecciona al menos una', 'error'); return; }
  const applyBtn = document.getElementById('qbRecApplyBtn');
  applyBtn.disabled = true;
  const whoResolved = getInvoiceTrackerUser() || 'Invoice Tracker';
  let paid = 0, alertsResolved = 0;
  for (const idx of checked) {
    const m = _qbRecMatches[idx];
    if (!m) continue;
    const inv = allInvoices.find(i => i.id === m.invId);
    if (!inv || inv.status === 'paid') continue;
    const now = Date.now();
    const history = [...(inv.history || []), { ts: now, action: 'paid', via: 'qb_reconcile', by: whoResolved }];
    await updateInvoiceData(inv.id, { status: 'paid', paidAt: now, history });
    paid++;
    // Reuse the #2 sync: resolve any open TECH-TICKETS alerts for this invoice
    try {
      const freshInv = allInvoices.find(i => i.id === m.invId) || inv;
      const r = await resolveInvoiceCrossAppAlerts(freshInv, whoResolved, 'paid_via_qb_reconcile');
      if (r && r.resolved) alertsResolved += r.resolved;
    } catch (_e) {}
  }
  applyBtn.disabled = false;
  closeModal('qbReconcileModal');
  toast(en
    ? `✓ ${paid} invoice${paid !== 1 ? 's' : ''} marked paid${alertsResolved ? ` · ${alertsResolved} TECH-TICKETS alert${alertsResolved !== 1 ? 's' : ''} resolved` : ''}`
    : `✓ ${paid} factura${paid !== 1 ? 's' : ''} marcada${paid !== 1 ? 's' : ''} pagada${paid !== 1 ? 's' : ''}${alertsResolved ? ` · ${alertsResolved} alerta${alertsResolved !== 1 ? 's' : ''} de TECH-TICKETS resuelta${alertsResolved !== 1 ? 's' : ''}` : ''}`, 'success');
  try { if (typeof computeAndRender === 'function') computeAndRender(); } catch (_e) {}
  try { if (typeof updateCrossAppInboxBadge === 'function') updateCrossAppInboxBadge(); } catch (_e) {}
  // Record that a reconcile just happened → resets the nudge timer.
  try { setLastReconcile(paid); } catch (_e) {}
};


// Firestore REST value unwrapper — converts Firestore format back to plain JS
function _firestoreUnwrap(fields) {
  if (!fields) return {};
  const out = {};
  for (const k of Object.keys(fields)) {
    const v = fields[k];
    if (v.stringValue !== undefined) out[k] = v.stringValue;
    else if (v.integerValue !== undefined) out[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) out[k] = v.doubleValue;
    else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
    else if (v.timestampValue !== undefined) out[k] = v.timestampValue;
    else if (v.nullValue !== undefined) out[k] = null;
    else if (v.arrayValue) out[k] = (v.arrayValue.values || []).map(x => {
      if (x.stringValue !== undefined) return x.stringValue;
      if (x.integerValue !== undefined) return parseInt(x.integerValue, 10);
      return x;
    });
    else if (v.mapValue) out[k] = _firestoreUnwrap(v.mapValue.fields);
    else out[k] = v;
  }
  return out;
}

// ════════════════════════════════════════════════════════════
// CROSS-APP RESOLVE SYNC — when TECH-TICKETS marks a cross_app_event as
// resolved, we want Invoice Tracker to reflect that. Approach: poll every
// 30 seconds for resolved events (only when tab is visible). For each
// resolved event that matches one of our invoices via history.eventId,
// stamp a `crossapp_alert_resolved` entry on that invoice so the UI can
// show "✓ Tech resolved" instead of "Alert Tech (already sent)".
// ════════════════════════════════════════════════════════════
let _crossAppPollTimer = null;
let _crossAppPollBusy = false;

// ═══ CROSS-APP INBOX — track resolutions from TECH-TICKETS ═══
// Persists the timestamp of the latest seen resolution per device.
// Anything newer than this is "unread" and shown with a red dot.
const CROSSAPP_INBOX_SEEN_KEY = 'aspenCrossAppInboxLastSeen';

// Global cache of ALL resolved cross-app events seen by the poll.
// We render the inbox from THIS array (not from invoice histories) so events
// show up even if they don't match an Invoice Tracker invoice — e.g. published
// from a different device, eventId chain broke, legacy events, etc.
let _allResolvedEvents = [];
/* v2.72.3 — the moment THIS session started watching. A resolution is announced only if the
   server resolved it after this (2 min of tolerance for a skewed clock). The first load seeds
   the watermark at the OLDEST of 100 unordered resolutions and then walks forward 50 at a
   time; everything in that walk that was not among the first 100 used to count as "new",
   so every reload re-announced the history: "N tech alert(s) resolved" over and over. */
const _crossAppSessionStartMs = Date.now();

function _getCrossAppInboxLastSeen() {
  try { return Number(localStorage.getItem(CROSSAPP_INBOX_SEEN_KEY) || 0); }
  catch(_e) { return 0; }
}

function _setCrossAppInboxLastSeen(ts) {
  try { localStorage.setItem(CROSSAPP_INBOX_SEEN_KEY, String(ts)); }
  catch(_e) {}
}

// Returns the full list of resolved events, newest first.
// Includes both matched (linked to an Invoice Tracker invoice) and unmatched.
function getAllCrossAppResolutions() {
  return [..._allResolvedEvents].sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

function countUnreadResolutions() {
  const lastSeen = _getCrossAppInboxLastSeen();
  return getAllCrossAppResolutions().filter(r => r.ts > lastSeen).length;
}

// Update the red dot badge on the 📬 button in the header.
function updateCrossAppInboxBadge() {
  const badge = document.getElementById('crossAppInboxBadge');
  if (!badge) return;
  const n = countUnreadResolutions();
  if (n > 0) {
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

// Human-friendly label for a reason code (mirrors TECH-TICKETS labels)
function _reasonLabelEs(reason) {
  const map = {
    cc_declined:           'Tarjeta declinada',
    cc_needed:             'Sin tarjeta en archivo',
    no_cc_on_file:         'Sin tarjeta en archivo',
    no_response:           'Cliente no responde',
    disputed:              'Disputado',
    partial:               'Pago parcial',
    partial_payment:       'Pago parcial',
    pending:               'Pago pendiente',
    check_pending_deposit: 'Cheque pendiente de depósito',
    unpaid_30d:            'Sin pago 30+ días'
  };
  return reason && map[reason] ? map[reason] : (reason || 'Alerta');
}

function _reasonLabelEn(reason) {
  const map = {
    cc_declined:           'Card declined',
    cc_needed:             'No card on file',
    no_cc_on_file:         'No card on file',
    no_response:           'No customer response',
    disputed:              'Disputed',
    partial:               'Partial payment',
    partial_payment:       'Partial payment',
    pending:               'Pending payment',
    check_pending_deposit: 'Check pending deposit',
    unpaid_30d:            'Unpaid 30+ days'
  };
  return reason && map[reason] ? map[reason] : (reason || 'Alert');
}

function _relativeTime(ts) {
  if (!ts) return '';
  const en = currentLang === 'en';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1)   return en ? 'just now' : 'recién';
  if (mins < 60)  return en ? `${mins}m ago` : `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return en ? `${hrs}h ago` : `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30)  return en ? `${days}d ago` : `hace ${days}d`;
  return new Date(ts).toLocaleDateString();
}

// Open the inbox modal and render the list of resolutions.
window.openCrossAppInbox = function() {
  renderCrossAppInbox();
  document.getElementById('crossAppInboxModal').classList.add('open');
};

function renderCrossAppInbox() {
  const en = currentLang === 'en';
  const listEl = document.getElementById('crossAppInboxList');
  const titleEl = document.getElementById('crossAppInboxTitle');
  const countEl = document.getElementById('crossAppInboxUnreadCount');
  const hintEl = document.getElementById('crossAppInboxHint');
  const markBtn = document.getElementById('crossAppInboxMarkAllBtn');
  if (!listEl) return;

  if (titleEl) titleEl.textContent = en ? 'Tech Responses' : 'Respuestas de Tech';
  if (hintEl)  hintEl.textContent  = en
    ? 'When a tech resolves an alert you published from Invoice Tracker, it appears here. Red dot = unread.'
    : 'Cuando un técnico resuelve una alerta que enviaste desde Invoice Tracker, aparece acá. Punto rojo = no leído.';
  if (markBtn) markBtn.textContent = en ? 'Mark all as read' : 'Marcar todo como leído';

  // Update the diagnostic status strip (last poll, count, errors)
  renderInboxStatusStrip();

  const lastSeen = _getCrossAppInboxLastSeen();
  const all = getAllCrossAppResolutions();
  const unread = all.filter(r => r.ts > lastSeen).length;
  if (countEl) {
    if (unread > 0) { countEl.style.display = 'inline-block'; countEl.textContent = unread + (en ? ' new' : ' nuevas'); }
    else countEl.style.display = 'none';
  }

  if (!all.length) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:48px 20px;color:var(--text-soft);background:#f9fafb;border:1px dashed var(--border);border-radius:8px;">
        <div style="font-size:42px;margin-bottom:10px;">📭</div>
        <div style="font-weight:600;font-size:14px;color:var(--text);margin-bottom:4px;">${en ? 'No tech responses yet' : 'Aún no hay respuestas'}</div>
        <div style="font-size:12px;">${en ? 'When techs resolve your alerts, they\'ll show up here.' : 'Cuando los técnicos resuelvan tus alertas aparecerán acá.'}</div>
      </div>`;
    return;
  }

  // Show up to 50 most recent
  const items = all.slice(0, 50);
  const reasonLbl = en ? _reasonLabelEn : _reasonLabelEs;
  // Map method codes to human labels with description (matches TECH-TICKETS resolve modal)
  const methodInfo = en ? {
    card_collected: { label: 'Card collected',         desc: 'Got new/updated CC info from customer',           icon: '💳' },
    customer_paid:  { label: 'Customer paid',          desc: 'Cash, check, Zelle, etc.',                        icon: '💵' },
    reminder_sent:  { label: 'Reminder sent',          desc: 'Sent the customer another reminder',              icon: '📧' },
    contacted:      { label: 'Contacted customer',     desc: 'Spoke with them, follow-up scheduled',            icon: '📞' },
    no_contact:     { label: 'Could not reach',        desc: 'Tried, no response — passed to admin',            icon: '🛟' },
    written_off:    { label: 'Written off',            desc: 'Bad debt, not pursuing',                          icon: '🗑' },
    other:          { label: 'Other',                  desc: 'See note for details',                            icon: '❔' }
  } : {
    card_collected: { label: 'Tarjeta recibida',       desc: 'Obtuvo nueva info de tarjeta del cliente',         icon: '💳' },
    customer_paid:  { label: 'Cliente pagó',           desc: 'Efectivo, cheque, Zelle, etc.',                    icon: '💵' },
    reminder_sent:  { label: 'Recordatorio enviado',   desc: 'Le mandó otro recordatorio al cliente',            icon: '📧' },
    contacted:      { label: 'Cliente contactado',     desc: 'Habló con el cliente, seguimiento agendado',       icon: '📞' },
    no_contact:     { label: 'No se pudo contactar',   desc: 'Intentó, sin respuesta — pasó a admin',            icon: '🛟' },
    written_off:    { label: 'Dado de baja',           desc: 'Deuda incobrable, no se sigue',                    icon: '🗑' },
    other:          { label: 'Otro',                   desc: 'Ver nota para detalles',                           icon: '❔' }
  };
  let html = '<div style="display:grid;gap:10px;">';
  for (const r of items) {
    const isUnread = r.ts > lastSeen;
    const time = _relativeTime(r.ts);
    const reasonText = reasonLbl(r.reason);
    const sevColor = r.severity === 'urgent' ? '#dc2626' : (r.severity === 'info' ? '#3b82f6' : '#f59e0b');
    const m = r.resolutionMethod ? methodInfo[r.resolutionMethod] : null;
    const noteText = r.resolutionNote && r.resolutionNote.trim();

    html += `
      <div style="background:${isUnread ? '#ECFDF5' : 'white'};border:1px solid ${isUnread ? '#6EE7B7' : 'var(--border)'};border-radius:10px;overflow:hidden;">
        <!-- Top row: customer + reason + invoice -->
        <div style="padding:11px 13px;display:flex;gap:11px;align-items:flex-start;${r.matchedInvoiceId ? 'cursor:pointer;' : ''}" ${r.matchedInvoiceId ? `onclick="window.goToInvoiceFromInbox('${r.matchedInvoiceId}')"` : ''}>
          <div style="flex-shrink:0;margin-top:3px;">
            ${isUnread
              ? '<span style="display:inline-block;width:9px;height:9px;background:#10b981;border-radius:50%;box-shadow:0 0 0 2px #d1fae5;"></span>'
              : '<span style="display:inline-block;width:9px;height:9px;background:#d1d5db;border-radius:50%;"></span>'}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="font-weight:700;font-size:15px;color:var(--text);">${escapeHtml(r.customerName || '—')}</span>
              ${!r.matchedInvoiceId ? `<span style="font-size:11px;color:#9ca3af;background:#f3f4f6;padding:1px 6px;border-radius:999px;" title="${en ? 'Resolution from another device or app' : 'Resolución desde otro dispositivo o app'}">${en ? 'external' : 'externa'}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:5px;">
              ${r.reason ? `<span style="font-size:11px;color:white;background:${sevColor};font-weight:600;padding:2px 8px;border-radius:999px;">${escapeHtml(reasonText)}</span>` : ''}
              ${r.invoiceNumber ? `<span style="font-size:12px;color:var(--text-soft);">${en ? 'Invoice' : 'Factura'} <b>#${escapeHtml(String(r.invoiceNumber))}</b>${r.amount ? ' · <b>' + fmtCurrency(r.amount) + '</b>' : ''}</span>` : ''}
            </div>
          </div>
          <div style="flex-shrink:0;display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
            <button onclick="event.stopPropagation();window.itkOpenCustomerTimeline('${escapeHtml((r.customerName||'').replace(/'/g,'&#39;'))}')" title="${en ? 'See all alerts for this customer' : 'Ver historial completo del cliente'}" style="background:white;border:1px solid #d1d5db;color:#374151;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;">🧵 ${en ? 'History' : 'Historial'}</button>
          </div>
        </div>

        <!-- Resolution panel: structured, clear, friendly -->
        <div style="background:${isUnread ? '#d1fae5' : '#f0fdf4'};border-top:1px solid #6ee7b7;padding:11px 13px;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;color:#047857;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <span style="background:#10b981;color:white;width:18px;height:18px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;">✓</span>
            ${en ? 'Resolved' : 'Resuelta'}
          </div>
          <div style="display:grid;gap:4px;font-size:13px;color:#064e3b;">
            <div><span style="color:#047857;font-weight:600;">👤 ${en ? 'Resolved by' : 'Resolvió'}:</span> <b>${escapeHtml(r.resolvedBy || '—')}</b></div>
            ${m ? `<div><span style="color:#047857;font-weight:600;">${m.icon} ${en ? 'Action' : 'Acción'}:</span> <b>${escapeHtml(m.label)}</b> <span style="color:#65a30d;font-size:11px;">— ${escapeHtml(m.desc)}</span></div>` : ''}
            <div><span style="color:#047857;font-weight:600;">⏱ ${en ? 'When' : 'Cuándo'}:</span> ${escapeHtml(time)}</div>
          </div>
          <div style="margin-top:10px;padding:9px 11px;background:white;border-radius:7px;border:1px solid #a7f3d0;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.05em;color:#065f46;text-transform:uppercase;margin-bottom:4px;">💬 ${en ? `Note from ${r.resolvedBy || 'tech'}` : `Nota de ${r.resolvedBy || 'tech'}`}</div>
            ${noteText
              ? `<div style="font-size:13px;color:#111;line-height:1.4;font-style:italic;">"${escapeHtml(noteText)}"</div>`
              : `<div style="font-size:12px;color:#9ca3af;font-style:italic;">${en ? 'No additional note — quick action only' : 'Sin nota adicional — solo acción rápida'}</div>`}
          </div>
          ${r.publishedBy ? `<div style="font-size:11px;color:#6b7280;margin-top:6px;text-align:right;">${en ? 'You published this as' : 'Vos publicaste esta como'} <b>${escapeHtml(r.publishedBy)}</b></div>` : ''}
          ${(() => {
            // Manual fallback: if this resolution means PAID and the matched
            // invoice isn't paid yet, offer a one-click "Mark paid" button.
            if (!r.matchedInvoiceId) return '';
            const _mInv = (allInvoices || []).find(i => i.id === r.matchedInvoiceId);
            if (!_mInv || _mInv.status === 'paid') return '';
            const _isPaidMethod = ['customer_paid', 'paid-in-app'].includes(r.resolutionMethod);
            if (!_isPaidMethod) return '';
            return `<div style="margin-top:10px;text-align:right;">
              <button onclick="event.stopPropagation();window.markInvoicePaidFromInbox('${r.matchedInvoiceId}')" style="background:#047857;color:white;border:none;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">💵 ${en ? 'Mark invoice PAID here' : 'Marcar factura PAGADA aquí'}</button>
            </div>`;
          })()}
        </div>
      </div>`;
  }
  html += '</div>';
  listEl.innerHTML = html;
}

// Manual "Mark paid" from the inbox card — guaranteed fallback when the
// auto mark-paid didn't fire (e.g. stale resolution). Marks the invoice paid
// in Invoice Tracker; the cross_app_event is already resolved in TECH-TICKETS.
window.markInvoicePaidFromInbox = async function(invoiceId) {
  const en = currentLang === 'en';
  const inv = (allInvoices || []).find(i => i.id === invoiceId);
  if (!inv) { toast(en ? 'Invoice not found' : 'Factura no encontrada', 'error'); return; }
  if (inv.status === 'paid') { toast(en ? 'Already paid' : 'Ya está pagada', 'info'); return; }
  const now = Date.now();
  const who = getInvoiceTrackerUser() || 'Invoice Tracker';
  const history = [...(inv.history || []), { ts: now, action: 'paid', via: 'inbox_confirm', by: who, note: 'Confirmed paid from Tech Responses inbox' }];
  await updateInvoiceData(invoiceId, { status: 'paid', paidAt: now, history });
  toast(en ? `💵 Invoice #${inv.invoiceNumber} marked PAID` : `💵 Factura #${inv.invoiceNumber} marcada PAGADA`, 'success');
  try { if (typeof renderCrossAppInbox === 'function') renderCrossAppInbox(); } catch(_e){}
  try { if (typeof computeAndRender === 'function') computeAndRender(); } catch(_e){}
  try { if (typeof updateCrossAppInboxBadge === 'function') updateCrossAppInboxBadge(); } catch(_e){}
};

// Click a resolution row → close modal, scroll to invoice, briefly highlight it.
window.goToInvoiceFromInbox = function(invoiceId) {
  closeModal('crossAppInboxModal');
  // Find the invoice card in the DOM
  setTimeout(() => {
    const card = document.querySelector(`[data-invoice-id="${invoiceId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.transition = 'box-shadow 0.3s ease';
      card.style.boxShadow = '0 0 0 3px #10b981';
      setTimeout(() => { card.style.boxShadow = ''; }, 2400);
    } else {
      // Fallback: open the audit modal directly
      if (typeof window.openCrossAppAlertModal === 'function') window.openCrossAppAlertModal(invoiceId);
    }
  }, 200);
};

window.markAllResolutionsSeen = function() {
  const all = getAllCrossAppResolutions();
  const maxTs = all.length ? all[0].ts : Date.now();
  _setCrossAppInboxLastSeen(maxTs);
  updateCrossAppInboxBadge();
  renderCrossAppInbox();
  toast(currentLang === 'en' ? '✓ Marked as read' : '✓ Marcado como leído', 'success');
};

// Manually trigger a poll — used when Nela clicks the refresh button in the inbox.
// Forces an immediate poll regardless of the 30s interval, then re-renders.
window.refreshCrossAppInbox = async function() {
  const btn = document.getElementById('crossAppInboxRefreshBtn');
  const lbl = document.getElementById('crossAppRefreshLabel');
  const en = currentLang === 'en';
  if (btn) btn.disabled = true;
  if (lbl) lbl.textContent = en ? 'Searching…' : 'Buscando…';
  try {
    await pollCrossAppResolves();
  } finally {
    if (btn) btn.disabled = false;
    if (lbl) lbl.textContent = en ? 'Search now' : 'Buscar ahora';
    renderCrossAppInbox();
  }
};

// ═══ FEATURE: Get all alerts (open + resolved) for a single customer ═══
// Walks every invoice that matches the customerName and pulls every crossapp_alert_*
// history entry so the timeline modal can show one chronological view.
function getCustomerAlertHistory(customerName) {
  if (!customerName) return [];
  const norm = String(customerName).trim().toLowerCase();
  const out = [];
  const seenEventIds = new Set();
  // First pass: walk invoices that publish/resolve via history
  for (const inv of allInvoices) {
    if (String(inv.customerName || '').trim().toLowerCase() !== norm) continue;
    const hist = inv.history || [];
    const pubs = hist.filter(h => h.action === 'crossapp_alert_published');
    for (const pub of pubs) {
      const res = hist.find(h => h.action === 'crossapp_alert_resolved' && h.eventId === pub.eventId);
      seenEventIds.add(pub.eventId);
      out.push({
        eventId: pub.eventId,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount,
        publishedAt: pub.ts,
        publishedBy: pub.publishedBy,
        reason: pub.reason,
        severity: pub.severity,
        resolved: !!res,
        resolvedAt: res ? res.ts : null,
        resolvedBy: res ? res.resolvedBy : null,
        resolutionMethod: res ? res.resolutionMethod : null,
        resolutionNote: res ? res.resolutionNote : null
      });
    }
  }
  // Second pass: include resolved events from _allResolvedEvents that
  // weren't already captured (e.g., legacy events with broken eventId chain)
  for (const ev of _allResolvedEvents) {
    if (!ev.customerName || String(ev.customerName).trim().toLowerCase() !== norm) continue;
    if (seenEventIds.has(ev.eventId)) continue;
    out.push({
      eventId: ev.eventId,
      invoiceId: ev.matchedInvoiceId || null,
      invoiceNumber: ev.invoiceNumber,
      amount: ev.amount,
      publishedAt: ev.ts,  // best guess — we don't have publishedAt for orphans
      publishedBy: ev.publishedBy,
      reason: ev.reason,
      severity: ev.severity,
      resolved: true,
      resolvedAt: ev.ts,
      resolvedBy: ev.resolvedBy,
      resolutionMethod: ev.resolutionMethod,
      resolutionNote: ev.resolutionNote
    });
  }
  out.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
  return out;
}

// ═══ FEATURE #5: Customer timeline modal ═══
// Shows every alert (open + resolved) for a given customer chronologically.
window.itkOpenCustomerTimeline = function(customerName) {
  const en = currentLang === 'en';
  const titleEl = document.getElementById('customerTimelineTitle');
  const bodyEl  = document.getElementById('customerTimelineBody');
  if (titleEl) titleEl.textContent = (en ? 'History — ' : 'Historial — ') + customerName;
  if (!bodyEl) return;

  const history = getCustomerAlertHistory(customerName);
  if (!history.length) {
    bodyEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-soft);">${en ? 'No alerts found for this customer.' : 'Sin alertas registradas para este cliente.'}</div>`;
    document.getElementById('customerTimelineModal').classList.add('open');
    return;
  }

  const open = history.filter(h => !h.resolved).length;
  const resolved = history.filter(h => h.resolved).length;
  const reasonLbl = en ? _reasonLabelEn : _reasonLabelEs;

  // Compute average resolution time for resolved ones
  const resolvedDurations = history.filter(h => h.resolved && h.resolvedAt && h.publishedAt).map(h => h.resolvedAt - h.publishedAt);
  const avgMs = resolvedDurations.length ? resolvedDurations.reduce((a,b)=>a+b,0) / resolvedDurations.length : 0;
  const avgHrs = Math.round(avgMs / 3600000);

  // Same friendly method info as the inbox
  const methodInfo = en ? {
    card_collected: { label: 'Card collected',         desc: 'Got new/updated CC info from customer',   icon: '💳' },
    customer_paid:  { label: 'Customer paid',          desc: 'Cash, check, Zelle, etc.',                icon: '💵' },
    reminder_sent:  { label: 'Reminder sent',          desc: 'Sent the customer another reminder',      icon: '📧' },
    contacted:      { label: 'Contacted customer',     desc: 'Spoke with them, follow-up scheduled',    icon: '📞' },
    no_contact:     { label: 'Could not reach',        desc: 'Tried, no response — passed to admin',    icon: '🛟' },
    written_off:    { label: 'Written off',            desc: 'Bad debt, not pursuing',                  icon: '🗑' },
    other:          { label: 'Other',                  desc: 'See note for details',                    icon: '❔' }
  } : {
    card_collected: { label: 'Tarjeta recibida',       desc: 'Obtuvo nueva info de tarjeta del cliente', icon: '💳' },
    customer_paid:  { label: 'Cliente pagó',           desc: 'Efectivo, cheque, Zelle, etc.',            icon: '💵' },
    reminder_sent:  { label: 'Recordatorio enviado',   desc: 'Le mandó otro recordatorio al cliente',    icon: '📧' },
    contacted:      { label: 'Cliente contactado',     desc: 'Habló con el cliente, seguimiento agendado', icon: '📞' },
    no_contact:     { label: 'No se pudo contactar',   desc: 'Intentó, sin respuesta — pasó a admin',    icon: '🛟' },
    written_off:    { label: 'Dado de baja',           desc: 'Deuda incobrable, no se sigue',            icon: '🗑' },
    other:          { label: 'Otro',                   desc: 'Ver nota para detalles',                   icon: '❔' }
  };

  let html = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:9px 13px;flex:1;min-width:120px;">
        <div style="font-size:11px;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${en ? 'Open' : 'Abiertas'}</div>
        <div style="font-size:22px;font-weight:700;color:#dc2626;">${open}</div>
      </div>
      <div style="background:#ECFDF5;border:1px solid #6EE7B7;border-radius:8px;padding:9px 13px;flex:1;min-width:120px;">
        <div style="font-size:11px;color:#047857;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${en ? 'Resolved' : 'Resueltas'}</div>
        <div style="font-size:22px;font-weight:700;color:#10b981;">${resolved}</div>
      </div>
      ${resolvedDurations.length ? `
      <div style="background:#f1f5f9;border:1px solid var(--border);border-radius:8px;padding:9px 13px;flex:1;min-width:120px;">
        <div style="font-size:11px;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${en ? 'Avg resolution' : 'Tiempo promedio'}</div>
        <div style="font-size:22px;font-weight:700;color:var(--text);">${avgHrs}h</div>
      </div>` : ''}
    </div>
    <div style="display:grid;gap:10px;">`;

  for (const h of history) {
    const reasonText = reasonLbl(h.reason);
    const sevColor = h.severity === 'urgent' ? '#dc2626' : (h.severity === 'info' ? '#3b82f6' : '#f59e0b');
    const pubStr = _relativeTime(h.publishedAt);
    const m = h.resolutionMethod ? methodInfo[h.resolutionMethod] : null;
    const noteText = h.resolutionNote && h.resolutionNote.trim();

    html += `
      <div style="background:white;border:1px solid var(--border);border-left:4px solid ${h.resolved ? '#10b981' : sevColor};border-radius:10px;overflow:hidden;">
        <div style="padding:11px 13px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="font-size:11px;color:white;background:${sevColor};font-weight:600;padding:2px 8px;border-radius:999px;">${escapeHtml(reasonText)}</span>
              ${h.resolved
                ? `<span style="font-size:11px;color:white;background:#10b981;font-weight:600;padding:2px 8px;border-radius:999px;">✓ ${en ? 'Resolved' : 'Resuelta'}</span>`
                : `<span style="font-size:11px;color:white;background:#dc2626;font-weight:600;padding:2px 8px;border-radius:999px;">${en ? 'OPEN' : 'ABIERTA'}</span>`}
            </div>
            <div style="font-size:11px;color:var(--text-mute);">${en ? 'Invoice' : 'Factura'} <b>#${escapeHtml(h.invoiceNumber || '')}</b> · ${fmtCurrency(h.amount || 0)}</div>
          </div>
          <div style="font-size:12px;color:var(--text-soft);margin-top:6px;">
            📤 ${en ? 'Published' : 'Publicada'} ${escapeHtml(pubStr)}${h.publishedBy ? ' ' + (en ? 'by' : 'por') + ' <b>' + escapeHtml(h.publishedBy) + '</b>' : ''}
          </div>
        </div>
        ${h.resolved ? `
          <div style="background:#f0fdf4;border-top:1px solid #6ee7b7;padding:11px 13px;">
            <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;color:#047857;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
              <span style="background:#10b981;color:white;width:18px;height:18px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;">✓</span>
              ${en ? 'Resolved' : 'Resuelta'}
            </div>
            <div style="display:grid;gap:4px;font-size:13px;color:#064e3b;">
              <div><span style="color:#047857;font-weight:600;">👤 ${en ? 'Resolved by' : 'Resolvió'}:</span> <b>${escapeHtml(h.resolvedBy || '—')}</b></div>
              ${m ? `<div><span style="color:#047857;font-weight:600;">${m.icon} ${en ? 'Action' : 'Acción'}:</span> <b>${escapeHtml(m.label)}</b> <span style="color:#65a30d;font-size:11px;">— ${escapeHtml(m.desc)}</span></div>` : ''}
              <div><span style="color:#047857;font-weight:600;">⏱ ${en ? 'When' : 'Cuándo'}:</span> ${escapeHtml(_relativeTime(h.resolvedAt))}</div>
            </div>
            <div style="margin-top:10px;padding:9px 11px;background:white;border-radius:7px;border:1px solid #a7f3d0;">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.05em;color:#065f46;text-transform:uppercase;margin-bottom:4px;">💬 ${en ? `Note from ${h.resolvedBy || 'tech'}` : `Nota de ${h.resolvedBy || 'tech'}`}</div>
              ${noteText
                ? `<div style="font-size:13px;color:#111;line-height:1.4;font-style:italic;">"${escapeHtml(noteText)}"</div>`
                : `<div style="font-size:12px;color:#9ca3af;font-style:italic;">${en ? 'No additional note — quick action only' : 'Sin nota adicional — solo acción rápida'}</div>`}
            </div>
          </div>
        ` : ''}
      </div>`;
  }
  html += '</div>';
  bodyEl.innerHTML = html;
  document.getElementById('customerTimelineModal').classList.add('open');
};

// ═══ FEATURE #3: Stats Dashboard ═══
window.openCrossAppStats = function() {
  document.getElementById('crossAppStatsModal').classList.add('open');
  window.renderCrossAppStats(30);
};

window.renderCrossAppStats = function(rangeDays) {
  const en = currentLang === 'en';
  const titleEl = document.getElementById('crossAppStatsTitle');
  if (titleEl) titleEl.textContent = en ? 'Alert statistics' : 'Estadísticas de alertas';

  // Highlight active range button
  document.querySelectorAll('#crossAppStatsRangeBar .btn').forEach(b => {
    b.style.background = String(b.dataset.range) === String(rangeDays) ? 'var(--accent)' : '';
    b.style.color = String(b.dataset.range) === String(rangeDays) ? 'white' : '';
  });

  const cutoff = rangeDays === 'all' ? 0 : (Date.now() - rangeDays * 24 * 60 * 60 * 1000);

  // Collect ALL alert events from invoice histories (published + resolved pairs)
  const events = [];
  const seenIds = new Set();
  for (const inv of allInvoices) {
    const hist = inv.history || [];
    const pubs = hist.filter(h => h.action === 'crossapp_alert_published');
    for (const pub of pubs) {
      if (pub.ts < cutoff) continue;
      const res = hist.find(h => h.action === 'crossapp_alert_resolved' && h.eventId === pub.eventId);
      seenIds.add(pub.eventId);
      events.push({
        ts: pub.ts,
        customerName: inv.customerName,
        reason: pub.reason,
        severity: pub.severity,
        publishedBy: pub.publishedBy,
        resolved: !!res,
        resolvedAt: res ? res.ts : null,
        resolvedBy: res ? res.resolvedBy : null,
        resolutionMethod: res ? res.resolutionMethod : null
      });
    }
  }
  // Augment with orphan resolved events that didn't have a matching publish history
  for (const ev of _allResolvedEvents) {
    if (seenIds.has(ev.eventId)) continue;
    if (ev.ts < cutoff) continue;
    events.push({
      ts: ev.ts,
      customerName: ev.customerName,
      reason: ev.reason,
      severity: ev.severity,
      publishedBy: ev.publishedBy,
      resolved: true,
      resolvedAt: ev.ts,
      resolvedBy: ev.resolvedBy,
      resolutionMethod: ev.resolutionMethod
    });
  }

  const total = events.length;
  const resolved = events.filter(e => e.resolved).length;
  const open = total - resolved;
  const pct = total ? Math.round((resolved / total) * 100) : 0;

  // Avg resolution time
  const durs = events.filter(e => e.resolved && e.resolvedAt).map(e => e.resolvedAt - e.ts);
  const avgMs = durs.length ? durs.reduce((a,b)=>a+b,0) / durs.length : 0;
  const avgHrs = Math.round(avgMs / 3600000 * 10) / 10;

  // Under 24h
  const under24 = durs.filter(d => d < 24 * 3600000).length;
  const under24Pct = durs.length ? Math.round((under24 / durs.length) * 100) : 0;

  // Top reasons
  const reasonCounts = {};
  events.forEach(e => { const k = e.reason || 'other'; reasonCounts[k] = (reasonCounts[k] || 0) + 1; });
  const reasonLbl = en ? _reasonLabelEn : _reasonLabelEs;
  const topReasons = Object.entries(reasonCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);

  // Top resolvers
  const resolverCounts = {};
  events.filter(e => e.resolved).forEach(e => { const k = e.resolvedBy || '?'; resolverCounts[k] = (resolverCounts[k] || 0) + 1; });
  const topResolvers = Object.entries(resolverCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);

  // Top problem customers
  const customerCounts = {};
  events.forEach(e => { const k = e.customerName || '?'; customerCounts[k] = (customerCounts[k] || 0) + 1; });
  const topCustomers = Object.entries(customerCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);

  // Top publishers
  const publisherCounts = {};
  events.forEach(e => { const k = e.publishedBy || '?'; publisherCounts[k] = (publisherCounts[k] || 0) + 1; });
  const topPublishers = Object.entries(publisherCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);

  const bodyEl = document.getElementById('crossAppStatsBody');
  if (!bodyEl) return;

  if (!total) {
    bodyEl.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--text-soft);background:#f9fafb;border:1px dashed var(--border);border-radius:8px;">
      <div style="font-size:42px;margin-bottom:10px;">📊</div>
      <div style="font-weight:600;color:var(--text);">${en ? 'No alerts in this range' : 'Sin alertas en este rango'}</div>
    </div>`;
    return;
  }

  // Helper to render a top-N list with bars
  const topList = (arr, maxV) => arr.map(([k, v]) => {
    const w = Math.round((v / maxV) * 100);
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:5px;">
      <div style="flex:1;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(k)}</div>
      <div style="flex:2;background:#f1f5f9;height:18px;border-radius:4px;position:relative;overflow:hidden;">
        <div style="height:100%;width:${w}%;background:linear-gradient(90deg,#3b82f6,#60a5fa);"></div>
      </div>
      <div style="width:34px;text-align:right;font-size:12px;font-weight:600;color:var(--text);">${v}</div>
    </div>`;
  }).join('');

  const maxReason = topReasons.length ? topReasons[0][1] : 1;
  const maxResolver = topResolvers.length ? topResolvers[0][1] : 1;
  const maxCustomer = topCustomers.length ? topCustomers[0][1] : 1;
  const maxPublisher = topPublishers.length ? topPublishers[0][1] : 1;

  bodyEl.innerHTML = `
    <!-- Top KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:18px;">
      <div style="background:#f1f5f9;border:1px solid var(--border);border-radius:8px;padding:11px 13px;">
        <div style="font-size:11px;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${en ? 'Total alerts' : 'Total alertas'}</div>
        <div style="font-size:26px;font-weight:700;color:var(--text);">${total}</div>
      </div>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:11px 13px;">
        <div style="font-size:11px;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${en ? 'Open' : 'Abiertas'}</div>
        <div style="font-size:26px;font-weight:700;color:#dc2626;">${open}</div>
      </div>
      <div style="background:#ECFDF5;border:1px solid #6EE7B7;border-radius:8px;padding:11px 13px;">
        <div style="font-size:11px;color:#047857;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${en ? 'Resolved' : 'Resueltas'}</div>
        <div style="font-size:26px;font-weight:700;color:#10b981;">${resolved} <span style="font-size:13px;color:var(--text-soft);">(${pct}%)</span></div>
      </div>
      <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:11px 13px;">
        <div style="font-size:11px;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${en ? 'Avg resolution' : 'Promedio resolución'}</div>
        <div style="font-size:26px;font-weight:700;color:#1e40af;">${avgHrs}h</div>
      </div>
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:11px 13px;">
        <div style="font-size:11px;color:#2E8B57;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${en ? 'Under 24h' : 'En 24h'}</div>
        <div style="font-size:26px;font-weight:700;color:#2E8B57;">${under24Pct}%</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;">
      <!-- Top reasons -->
      <div>
        <div style="font-size:11px;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:8px;">${en ? 'Top issue types' : 'Tipos de problema más frecuentes'}</div>
        ${topList(topReasons.map(([k,v]) => [reasonLbl(k), v]), maxReason) || '<div style="color:var(--text-mute);font-size:12px;">—</div>'}
      </div>

      <!-- Top resolvers -->
      <div>
        <div style="font-size:11px;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:8px;">${en ? 'Who resolves the most' : 'Quién resuelve más'}</div>
        ${topList(topResolvers, maxResolver) || '<div style="color:var(--text-mute);font-size:12px;">—</div>'}
      </div>

      <!-- Top problem customers -->
      <div>
        <div style="font-size:11px;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:8px;">${en ? 'Most problematic customers' : 'Clientes más problemáticos'}</div>
        ${topList(topCustomers, maxCustomer) || '<div style="color:var(--text-mute);font-size:12px;">—</div>'}
      </div>

      <!-- Top publishers -->
      <div>
        <div style="font-size:11px;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:8px;">${en ? 'Who publishes the most alerts' : 'Quién publica más alertas'}</div>
        ${topList(topPublishers, maxPublisher) || '<div style="color:var(--text-mute);font-size:12px;">—</div>'}
      </div>
    </div>
  `;
};

// ═══ FEATURE #2: Push notifications for cross-app resolutions ═══
// Shows a browser/PWA notification when a new tech resolution arrives.
// Reuses the existing Notification permission already granted via the bell button.
function _crossAppShowPushNotif({ customerName, resolvedBy, invoiceNumber, resolutionNote, resolutionMethod }) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const en = currentLang === 'en';
  const title = en ? `✓ ${resolvedBy || 'Tech team'} resolved an alert` : `✓ ${resolvedBy || 'Equipo Tech'} resolvió una alerta`;
  let body = `${customerName || '?'} · #${invoiceNumber || '?'}`;
  if (resolutionNote) body += `\n💬 "${resolutionNote}"`;
  try {
    if (_swRegistration && _swRegistration.showNotification) {
      _swRegistration.showNotification(title, {
        body,
        icon: '/invoice-tracker/icon-192.png',
        badge: '/invoice-tracker/icon-192.png',
        tag: 'crossapp-resolution',
        renotify: true
      });
    } else {
      const n = new Notification(title, { body, tag: 'crossapp-resolution' });
      n.onclick = () => { window.focus(); window.openCrossAppInbox && window.openCrossAppInbox(); n.close(); };
    }
  } catch (e) { console.warn('[CrossAppPush]', e); }
}

// ═══ FEATURE #4: Auto-escalation — alerts open > 24h get flagged + Alberto notified ═══
const ESCALATION_THRESHOLD_MS = 24 * 60 * 60 * 1000;  // 24 hours
const ESCALATED_LOCAL_KEY = 'aspenEscalatedAlerts';   // localStorage cache of already-escalated event IDs

function _getEscalatedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(ESCALATED_LOCAL_KEY) || '[]')); }
  catch(_e) { return new Set(); }
}
function _saveEscalatedSet(set) {
  try { localStorage.setItem(ESCALATED_LOCAL_KEY, JSON.stringify(Array.from(set))); }
  catch(_e) {}
}

// Check OPEN events from cross_app_events; for any older than 24h that we haven't already
// escalated, show a push notification + a toast. The event ID is cached so we don't re-escalate.
async function checkAutoEscalations() {
  if (document.hidden) return;
  try {
    const token = await getTicketsAuthToken();
    const cfg = getTicketsDbConfig();
    const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents:runQuery?key=${cfg.apiKey}`;
    const body = {
      structuredQuery: {
        from: [{ collectionId: 'cross_app_events' }],
        where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'open' } } },
        limit: 100
      }
    };
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    if (!resp.ok) return;
    const arr = await resp.json();
    if (!Array.isArray(arr)) return;
    const escalated = _getEscalatedSet();
    const now = Date.now();
    const en = currentLang === 'en';
    let newEscalations = 0;
    for (const item of arr) {
      if (!item.document) continue;
      const eventId = item.document.name.split('/').pop();
      if (escalated.has(eventId)) continue;
      const flds = _firestoreUnwrap(item.document.fields);
      const createdAtTs = flds.createdAt && flds.createdAt.toMillis ? flds.createdAt.toMillis()
                       : flds.createdAt ? new Date(flds.createdAt).getTime() : 0;
      if (!createdAtTs) continue;
      const ageMs = now - createdAtTs;
      if (ageMs < ESCALATION_THRESHOLD_MS) continue;
      // It's escalation-worthy
      escalated.add(eventId);
      newEscalations++;
      const ageHrs = Math.round(ageMs / 3600000);
      const customer = flds.customerName || '?';
      const reasonLbl = en ? _reasonLabelEn(flds.payload && flds.payload.reason) : _reasonLabelEs(flds.payload && flds.payload.reason);
      const title = en ? `⏰ Alert open ${ageHrs}h — escalate?` : `⏰ Alerta abierta hace ${ageHrs}h — ¿escalar?`;
      const bodyTxt = `${customer} · ${reasonLbl}`;
      toast('⏰ ' + (en ? 'Auto-escalation:' : 'Auto-escalation:') + ' ' + customer + ' (' + ageHrs + 'h)', 'warn');
      // Browser push
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          if (_swRegistration && _swRegistration.showNotification) {
            _swRegistration.showNotification(title, { body: bodyTxt, tag: 'auto-escalation-' + eventId });
          } else {
            new Notification(title, { body: bodyTxt, tag: 'auto-escalation-' + eventId });
          }
        } catch(_e){}
      }
    }
    if (newEscalations > 0) _saveEscalatedSet(escalated);
  } catch (e) {
    console.warn('[AutoEscalation]', e);
  }
}

let _autoEscalationTimer = null;
function startAutoEscalation() {
  if (_autoEscalationTimer) return;
  // First check 10s after startup
  setTimeout(checkAutoEscalations, 10000);
  // Then every 5 minutes
  _autoEscalationTimer = setInterval(checkAutoEscalations, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkAutoEscalations();
  });
}

// Renders the small status strip at the top of the inbox: poll health + counts
function renderInboxStatusStrip() {
  const el = document.getElementById('crossAppInboxStatus');
  if (!el) return;
  const en = currentLang === 'en';
  const all = getAllCrossAppResolutions();
  const lastSeen = _getCrossAppInboxLastSeen();
  const unread = all.filter(r => r.ts > lastSeen).length;

  let dot, msg;
  if (_crossAppPollLastError) {
    dot = '<span style="display:inline-block;width:8px;height:8px;background:#dc2626;border-radius:50%;"></span>';
    msg = (en ? '⚠ Connection error: ' : '⚠ Error de conexión: ') + escapeHtml(_crossAppPollLastError);
  } else if (_crossAppPollLastSuccess > 0) {
    const secs = Math.round((Date.now() - _crossAppPollLastSuccess) / 1000);
    const ago = secs < 60 ? (en ? `${secs}s ago` : `hace ${secs}s`) : (en ? `${Math.floor(secs/60)}m ago` : `hace ${Math.floor(secs/60)}m`);
    dot = '<span style="display:inline-block;width:8px;height:8px;background:#10b981;border-radius:50%;"></span>';
    msg = (en
      ? `Connected · Last check ${ago} · <b>${all.length}</b> resolved alert(s) · <b>${unread}</b> unread`
      : `Conectado · Última verificación ${ago} · <b>${all.length}</b> alerta(s) resuelta(s) · <b>${unread}</b> sin leer`);
  } else {
    dot = '<span style="display:inline-block;width:8px;height:8px;background:#f59e0b;border-radius:50%;"></span>';
    msg = en ? 'Waiting for first sync…' : 'Esperando primera sincronización…';
  }
  el.innerHTML = dot + '<span style="flex:1;">' + msg + '</span>';
}

// Status tracking for the poll — exposed to the inbox so Nela can see if it's running
let _crossAppPollLastSuccess = 0;
let _crossAppPollLastError = null;
let _crossAppPollLastCount = 0;
let _crossAppPollAttempts = 0;
/* v2.26.2 — marca de agua: el resolvedAt mas reciente que ya procesamos.
   0 = todavia no hubo carga inicial. Vive solo en memoria a proposito: un
   refresco de pagina hace UNA consulta completa y sigue incremental desde ahi,
   y asi no gastamos ni un byte del localStorage, que anda apretado. */
let _crossAppSinceMs = 0;

async function pollCrossAppResolves() {
  if (document.hidden) return;
  if (_crossAppPollBusy) return;
  _crossAppPollBusy = true;
  _crossAppPollAttempts++;
  try {
    const token = await getTicketsAuthToken();
    const cfg = getTicketsDbConfig();
    /* v2.26.2 — DEJAMOS DE RELEER LOS MISMOS 100 EVENTOS CADA VUELTA.
       Antes: where status=='resolved' limit 100, cada 30 s. Eso eran ~12.000
       lecturas de Firestore por hora y por pestana abierta, trayendo siempre
       los mismos documentos ya vistos. Y peor: sin orderBy, en cuanto hubiera
       mas de 100 eventos resueltos, Firestore devuelve un subconjunto
       arbitrario -- una resolucion nueva podia caer fuera de la ventana y no
       verse NUNCA, con la insignia "Tech ack" quedandose muda.
       Ahora: la primera vuelta hace la carga completa (para poblar el inbox) y
       las siguientes piden solo resolvedAt > marca de agua, ordenado ascendente.
       El filtro de rango y el orderBy son del MISMO campo, asi que basta el
       indice de un solo campo que Firestore crea solo -- no hace falta indice
       compuesto, que era justo lo que se queria evitar. El filtro de status se
       aplica del lado del cliente.
       Si hay atraso, cada vuelta avanza 50 y va alcanzando; ya no se pierde
       ninguno. En regimen normal cada consulta trae CERO documentos. */
    const incremental = _crossAppSinceMs > 0;
    const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents:runQuery?key=${cfg.apiKey}`;
    const body = incremental ? {
      structuredQuery: {
        from: [{ collectionId: 'cross_app_events' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'resolvedAt' },
            op: 'GREATER_THAN',
            // 1 s de holgura: si dos eventos comparten el mismo instante, ninguno
            // se salta. Los repetidos los absorbe la fusion por eventId.
            value: { timestampValue: new Date(_crossAppSinceMs - 1000).toISOString() }
          }
        },
        orderBy: [{ field: { fieldPath: 'resolvedAt' }, direction: 'ASCENDING' }],
        limit: 50
      }
    } : {
      structuredQuery: {
        from: [{ collectionId: 'cross_app_events' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'status' },
            op: 'EQUAL',
            value: { stringValue: 'resolved' }
          }
        },
        limit: 100
      }
    };
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      _crossAppPollLastError = `HTTP ${resp.status}: ${errBody.slice(0, 200)}`;
      console.warn('[CrossAppPoll]', _crossAppPollLastError);
      return;
    }
    const arr = await resp.json();
    if (!Array.isArray(arr)) {
      _crossAppPollLastError = 'Unexpected response shape';
      console.warn('[CrossAppPoll]', _crossAppPollLastError, arr);
      return;
    }
    _crossAppPollLastError = null;
    _crossAppPollLastSuccess = Date.now();
    const docs = arr.filter(item => item.document);
    _crossAppPollLastCount = docs.length;
    console.info('[CrossAppPoll]', incremental ? 'incremental ·' : 'carga inicial ·', docs.length, 'evento(s)');

    // Build the new "_allResolvedEvents" cache. We include EVERY resolved event,
    // not just ones that match an Invoice Tracker invoice. We also try to match
    // each event to an invoice (by eventId OR by customer+invoice#) for enrichment
    // and to stamp the invoice history so the "✓ Tech ack" badge keeps working.
    const previouslyKnownIds = new Set(_allResolvedEvents.map(e => e.eventId));
    let _maxSeenTs = _crossAppSinceMs, _minSeenTs = 0;
    const nextEvents = [];
    const newlyStamped = [];
    let markedPaidThisPoll = false; // force a re-render even for already-known events
    const en = currentLang === 'en';

    for (const item of docs) {
      const eventId = item.document.name.split('/').pop();
      const flds = _firestoreUnwrap(item.document.fields);
      const payload = (flds.payload && typeof flds.payload === 'object') ? flds.payload : {};

      // v2.26.2 — la vuelta incremental filtra por fecha, no por estado, asi que
      // el estado se comprueba aqui.
      if (incremental && flds.status !== 'resolved') continue;

      // Extract the "when resolved" timestamp — prefer Firestore server time
      let resolvedTs = 0;
      if (flds.resolvedAt) {
        if (flds.resolvedAt.toMillis) resolvedTs = flds.resolvedAt.toMillis();
        else if (typeof flds.resolvedAt === 'number') resolvedTs = flds.resolvedAt;
        else if (typeof flds.resolvedAt === 'string') resolvedTs = new Date(flds.resolvedAt).getTime() || 0;
      }
      /* La marca de agua SOLO se mueve con fechas reales del servidor: un
         Date.now() inventado para un documento sin resolvedAt la empujaria de
         mas y se saltaria eventos buenos.
         Y ojo con la direccion, que aqui casi me como 89 eventos en la
         simulacion: en la carga INICIAL la pagina viene sin orderBy, o sea
         desordenada, asi que sembrar con el mas RECIENTE de esa pagina hace
         saltar la marca por encima de todo lo que quedaba en medio. Se siembra
         con el mas ANTIGUO y desde ahi la vuelta incremental camina hacia
         adelante de 50 en 50 sin saltarse nada; los repetidos los absorbe la
         fusion por eventId. */
      if (resolvedTs) {
        if (incremental) { if (resolvedTs > _maxSeenTs) _maxSeenTs = resolvedTs; }
        else if (!_minSeenTs || resolvedTs < _minSeenTs) _minSeenTs = resolvedTs;
      }
      const _tsServer = resolvedTs; // v2.72.3 — the server's own time, before any fallback
      if (!resolvedTs) resolvedTs = Date.now();

      // Try to match an invoice — primary by eventId, fallback by customer+invoice#
      let matchedInv = allInvoices.find(i =>
        (i.history || []).some(h => h.action === 'crossapp_alert_published' && h.eventId === eventId)
      );
      if (!matchedInv) {
        const invNum = payload.invoiceNumber || flds.invoiceNumber;
        const custName = flds.customerName || payload.customerName;
        if (invNum && custName) {
          matchedInv = allInvoices.find(i =>
            String(i.invoiceNumber || '') === String(invNum) &&
            String(i.customerName || '').trim().toLowerCase() === String(custName).trim().toLowerCase()
          );
        }
      }

      // Build the event record we'll show in the inbox (using event data, falling back to invoice data)
      const evRecord = {
        eventId,
        ts: resolvedTs,
        customerName: flds.customerName || payload.customerName || (matchedInv ? matchedInv.customerName : '—'),
        invoiceNumber: payload.invoiceNumber || flds.invoiceNumber || (matchedInv ? matchedInv.invoiceNumber : null),
        amount: Number(payload.amount || flds.amount || (matchedInv ? matchedInv.amount : 0)) || 0,
        reason: payload.reason || null,
        severity: flds.severity || null,
        resolvedBy: flds.resolvedBy || null,
        resolutionMethod: flds.resolutionMethod || null,
        resolutionNote: flds.resolutionNote || null,
        publishedBy: flds.createdBy || payload.publishedBy || null,
        matchedInvoiceId: matchedInv ? matchedInv.id : null,
        sourceApp: flds.sourceApp || 'unknown'
      };
      nextEvents.push(evRecord);

      // If matched to an invoice AND not yet stamped, stamp it so the invoice card shows "Tech ack"
      if (matchedInv) {
        const alreadyStamped = (matchedInv.history || []).some(h => h.action === 'crossapp_alert_resolved' && h.eventId === eventId);
        if (!alreadyStamped) {
          const histEntry = {
            ts: Date.now(),
            action: 'crossapp_alert_resolved',
            eventId,
            resolvedAt: flds.resolvedAt || null,
            resolvedBy: flds.resolvedBy || null,
            resolutionMethod: flds.resolutionMethod || null,
            resolutionNote: flds.resolutionNote || null
          };
          const newHistory = [...(matchedInv.history || []), histEntry];
          matchedInv.history = newHistory;
          try {
            if (db && typeof update === 'function') {
              await update(ref(db, `invoiceTracker/invoices/${matchedInv.id}`), { history: newHistory });
            }
          } catch (e) {
            console.warn('[CrossAppPoll] Persist failed:', e);
          }
        }

        // ── Mark the invoice PAID when TECH-TICKETS closed it as paid ──
        // TECH-TICKETS sends one of two "paid" resolution methods:
        //   • 'paid-in-app'   → the quick "💵 Mark paid" button
        //   • 'customer_paid' → the resolve modal "💵 Customer paid" option
        // Both mean the money was collected → reflect it here as PAID.
        // (Note: 'card_collected' is NOT paid — that's just new CC info on file.)
        const _paidMethods = ['paid-in-app', 'customer_paid'];
        if (_paidMethods.includes(flds.resolutionMethod) && matchedInv.status !== 'paid') {
          try {
            const now = Date.now();
            const paidHist = [...(matchedInv.history || []), {
              ts: now, action: 'paid', via: 'tech-tickets',
              resolvedBy: flds.resolvedBy || null,
              resolutionMethod: flds.resolutionMethod || null,
              note: 'Marked paid from TECH-TICKETS (' + (flds.resolutionMethod || '') + ')'
            }];
            matchedInv.status = 'paid';
            matchedInv.paidAt = now;
            matchedInv.history = paidHist;
            await updateInvoiceData(matchedInv.id, { status: 'paid', paidAt: now, history: paidHist });
            markedPaidThisPoll = true;
            // v2.66.1 — la ESCRITURA de PAGADA (arriba) siempre ocurre para ponerse
            // al dia; el TOAST solo en incremental, mismo criterio que el aviso de
            // resoluciones: en la carga inicial, ponerse al dia con un backlog de
            // facturas no debe soltar una rafaga de "💵 marcada PAGADA".
            const _enPaid = currentLang === 'en';
            if (incremental && _tsServer >= _crossAppSessionStartMs - 120000) toast(_enPaid
              ? `💵 Invoice #${matchedInv.invoiceNumber} marked PAID (by ${flds.resolvedBy || 'Tech team'})`
              : `💵 Factura #${matchedInv.invoiceNumber} marcada PAGADA (por ${flds.resolvedBy || 'Equipo Tech'})`,
              'success');
          } catch (e) {
            console.warn('[CrossAppPoll] Auto mark-paid failed:', e);
          }
        }
      }

      // If this event wasn't in our previous cache, it's "new" → toast + push
      if (!previouslyKnownIds.has(eventId)) {
        newlyStamped.push({ ev: evRecord, fresh: _tsServer >= _crossAppSessionStartMs - 120000 });
      }
    }
    /* v2.26.2 — FUSIONAR, no reconstruir. Con la consulta incremental cada
       vuelta trae solo lo nuevo; si siguieramos asignando el resultado tal cual,
       el inbox se vaciaria en la segunda vuelta. Se reemplaza por eventId lo que
       llego, se conserva lo demas, y se recorta a los 300 mas recientes para que
       el arreglo no crezca sin fin en memoria. */
    if (incremental) {
      const _byId = new Map(_allResolvedEvents.map(e => [e.eventId, e]));
      nextEvents.forEach(e => _byId.set(e.eventId, e));
      _allResolvedEvents = Array.from(_byId.values()).sort((a, b) => b.ts - a.ts).slice(0, 300);
    } else {
      _allResolvedEvents = nextEvents;
    }
    if (incremental) {
      if (_maxSeenTs > _crossAppSinceMs) _crossAppSinceMs = _maxSeenTs;
    } else {
      // Sin eventos resueltos todavia: arrancamos incremental desde 45 dias
      // atras para no repetir la consulta completa en cada vuelta.
      _crossAppSinceMs = _minSeenTs || (Date.now() - 45 * 86400000);
    }

    if (newlyStamped.length > 0) {
      console.info('[CrossAppPoll]', newlyStamped.length, 'NEW resolution(s)');
      /* v2.66.1 — SILENCIO EN LA CARGA INICIAL. La PRIMERA vuelta (no incremental)
         trae TODO el historial de resoluciones para poblar el 📬 inbox. En un
         arranque limpio previouslyKnownIds esta vacio (vive solo en memoria y se
         borra en cada recarga), asi que esas ~100 caian en newlyStamped y se
         anunciaban como si acabaran de pasar: el toast "N tech alert(s) resolved"
         salia en CADA recarga — y sin parar en el iPhone, porque iOS mata y revive
         la PWA de cero una y otra vez. Ahora SOLO avisamos de resoluciones que
         llegan de verdad nuevas MIENTRAS la app esta abierta (incremental===true).
         El historial sigue apareciendo en el inbox con su insignia; ya no grita al
         arrancar. El badge y el render se hacen igual, para que el inbox se llene. */
      if (incremental) {
        // v2.72.3 — announce only what was resolved during this session; the catch-up walk
        // through older history still fills the inbox (render + badge below), silently.
        const _nuevas = newlyStamped.filter(x => x.fresh);
        if (!_nuevas.length) {
          console.info('[CrossAppPoll] poniendose al dia —', newlyStamped.length, 'resoluciones anteriores a esta sesion, al inbox sin aviso');
        } else if (_nuevas.length <= 3) {
          _nuevas.forEach(({ ev }) => {
            const who = ev.resolvedBy || (en ? 'Tech team' : 'Equipo Tech');
            const customer = (ev.customerName || '').trim() || (en ? 'a customer' : 'un cliente');
            const invNumPart = ev.invoiceNumber ? ` (#${ev.invoiceNumber})` : '';
            const msg = en
              ? `✓ ${who} resolved alert for ${customer}${invNumPart}`
              : `✓ ${who} resolvió la alerta de ${customer}${invNumPart}`;
            toast(msg, 'success');
            _crossAppShowPushNotif({
              customerName: customer,
              resolvedBy: who,
              invoiceNumber: ev.invoiceNumber,
              resolutionNote: ev.resolutionNote,
              resolutionMethod: ev.resolutionMethod
            });
          });
        } else {
          toast((en ? `✓ ${_nuevas.length} tech alert(s) resolved — see 📬 inbox` : `✓ ${_nuevas.length} alertas resueltas — ver 📬 inbox`), 'success');
        }
      } else {
        console.info('[CrossAppPoll] carga inicial silenciosa —', newlyStamped.length, 'resoluciones al inbox, sin toast/push');
      }
      updateCrossAppInboxBadge();
      computeAndRender();
    }
    // Even if no NEW resolutions arrived, if we auto-marked an invoice PAID
    // (e.g. a previously-seen resolution that hadn't been applied yet), the
    // list still needs to refresh so the card flips to PAID immediately.
    if (markedPaidThisPoll && newlyStamped.length === 0) {
      updateCrossAppInboxBadge();
      computeAndRender();
    }
  } catch (e) {
    console.warn('[CrossAppPoll]', e);
  } finally {
    _crossAppPollBusy = false;
  }
}

function startCrossAppResolvePolling() {
  if (_crossAppPollTimer) return;
  // First poll immediately on startup
  setTimeout(pollCrossAppResolves, 3000);
  /* v2.26.2 — de 30 s a 3 min. Con la consulta incremental cada vuelta ya no
     cuesta casi nada, pero no hay razon para preguntar 120 veces por hora si
     Nela marco una factura: el poll al volver a la pestana (abajo) cubre el
     caso impaciente. */
  _crossAppPollTimer = setInterval(pollCrossAppResolves, 180000);
  // Also poll on tab focus (catches the case where Nela was away)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) pollCrossAppResolves();
  });
}

let _ticketsCache = null;
let _ticketsCacheTs = 0;
let _ticketsCustCache = null;
let _ticketsCustCacheTs = 0;
const TICKETS_CACHE_MS = 60_000;

async function fetchAllTicketsRaw() {
  if (_ticketsCache && (Date.now() - _ticketsCacheTs) < TICKETS_CACHE_MS) return _ticketsCache;
  const cfg = getTicketsDbConfig();
  const token = await getTicketsAuthToken();
  const allTickets = [];
  let pageToken = '';
  const MAX_PAGES = 10; // safety cap: up to 10,000 tickets
  
  for (let pageNum = 0; pageNum < MAX_PAGES; pageNum++) {
    let url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/${cfg.ticketsCollection || 'tickets'}?pageSize=1000&key=${cfg.apiKey}`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      if (res.status === 403) throw new Error('TICKETS DB bloquea lectura (reglas Firestore o auth no enabled). Revisa reglas o activa Anonymous auth.');
      if (res.status === 404) throw new Error(`Colección "${cfg.ticketsCollection || 'tickets'}" no existe en ${cfg.projectId}`);
      throw new Error(`HTTP ${res.status}: ${txt.slice(0, 100)}`);
    }
    const data = await res.json();
    const docs = data.documents || [];
    for (const d of docs) {
      const fields = d.fields || {};
      const obj = { _id: d.name.split('/').pop() };
      for (const [k, v] of Object.entries(fields)) obj[k] = unwrapFirestoreValue(v);
      allTickets.push(obj);
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  
  console.info(`[TICKETS] Fetched ${allTickets.length} tickets across ${Math.ceil(allTickets.length / 1000)} page(s)`);
  _ticketsCache = allTickets;
  _ticketsCacheTs = Date.now();
  return allTickets;
}

// Helper: derive customers from tickets (used as fallback when no customers collection exists)
async function deriveCustomersFromTickets() {
  const tickets = await fetchAllTicketsRaw();
  const byName = new Map();
  for (const t of tickets) {
    const n = (t.customer || t.customerName || t.name || '').trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, {
        name: n, email: '', phone: '', altPhone: '',
        streetAddress: '', city: '', state: '', zip: '',
        address: '', spaModel: '', serialNumber: '',
        spaDescription: '', zone: '', notes: '',
        visits: 0, lastDate: ''
      });
    }
    const entry = byName.get(key);
    entry.visits++;
    if (t.date && (!entry.lastDate || t.date > entry.lastDate)) entry.lastDate = t.date;
    const pick = (key, ...altKeys) => {
      if (entry[key]) return;
      for (const k of [key, ...altKeys]) {
        if (t[k] && String(t[k]).trim()) { entry[key] = String(t[k]).trim(); return; }
      }
    };
    pick('email', 'customerEmail', 'mail');
    pick('phone', 'mainPhone', 'tel', 'phoneNumber', 'customerPhone');
    pick('altPhone', 'alternatePhone', 'phone2', 'phoneAlt');
    pick('streetAddress', 'billTo', 'address1', 'street', 'addressLine1');
    pick('city', 'addressCity');
    pick('state', 'addressState');
    pick('zip', 'zipCode', 'postalCode');
    pick('spaModel', 'model', 'spa', 'spaType');
    pick('serialNumber', 'serial', 'spaSerial', 'sn');
    pick('spaDescription', 'spa_description', 'spaDesc', 'description', 'spaInfo', 'equipmentDescription');
    pick('zone', 'serviceZone', 'area');
    pick('notes', 'customerNotes', 'note');
  }
  // Build composed `address` from parts
  for (const e of byName.values()) {
    if (e.streetAddress) {
      const cityStateZip = [e.city, e.state, e.zip].filter(Boolean).join(' ').trim();
      e.address = cityStateZip ? `${e.streetAddress}, ${cityStateZip}` : e.streetAddress;
    }
  }
  return Array.from(byName.values());
}

// Fetch from a separate "customers" collection if the user's TECH-TICKETS app has one
async function fetchAllTicketsCustomers() {
  const cfg = getTicketsDbConfig();
  if (!cfg.customersCollection) {
    return deriveCustomersFromTickets();
  }
  if (_ticketsCustCache && (Date.now() - _ticketsCustCacheTs) < TICKETS_CACHE_MS) return _ticketsCustCache;
  const token = await getTicketsAuthToken();
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/${cfg.customersCollection}?pageSize=1000&key=${cfg.apiKey}`;
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) {
    // If customers collection doesn't exist, derive from tickets instead
    if (res.status === 404) {
      console.info(`Collection "${cfg.customersCollection}" not found, deriving customers from tickets`);
      return deriveCustomersFromTickets();
    }
    throw new Error(`Customers HTTP ${res.status}`);
  }
  const data = await res.json();
  const docs = data.documents || [];
  // Auto-fallback: if customers collection is empty, derive from tickets
  if (docs.length === 0) {
    console.info(`Collection "${cfg.customersCollection}" returned 0 documents, deriving customers from tickets`);
    return deriveCustomersFromTickets();
  }
  const customers = docs.map(d => {
    const fields = d.fields || {};
    const obj = { _id: d.name.split('/').pop() };
    for (const [k, v] of Object.entries(fields)) obj[k] = unwrapFirestoreValue(v);
    obj.name = obj.name || obj.customerName || obj.customer || '';
    obj.email = obj.email || obj.customerEmail || '';
    obj.phone = obj.phone || obj.mainPhone || obj.tel || obj.phoneNumber || '';
    obj.altPhone = obj.altPhone || obj.alternatePhone || obj.phone2 || '';
    obj.streetAddress = obj.billTo || obj.address1 || obj.street || obj.addressLine1 || '';
    obj.city = obj.city || obj.addressCity || '';
    obj.state = obj.state || obj.addressState || 'MO';
    obj.zip = obj.zip || obj.zipCode || obj.postalCode || '';
    if (obj.streetAddress) {
      const parts = [obj.streetAddress];
      const cityStateZip = [obj.city, obj.state, obj.zip].filter(Boolean).join(' ').trim();
      if (cityStateZip) parts.push(cityStateZip);
      obj.address = parts.join(', ');
    } else {
      obj.address = obj.address || obj.fullAddress || obj.shipTo || '';
    }
    obj.spaDescription = obj.spaDescription || obj.spa_description || obj.spaDesc || obj.description || obj.spaInfo || obj.equipmentDescription || obj.spa || '';
    obj.zone = obj.zone || obj.serviceZone || '';
    obj.notes = obj.notes || obj.customerNotes || obj.note || '';
    return obj;
  });
  _ticketsCustCache = customers;
  _ticketsCustCacheTs = Date.now();
  return customers;
}

async function searchTicketsCustomers(query) {
  const all = await fetchAllTicketsCustomers();
  return smartMatchCustomer(query, all);
}

function unwrapFirestoreValue(v) {
  if (!v || typeof v !== 'object') return v;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) {
    return (v.arrayValue.values || []).map(unwrapFirestoreValue);
  }
  if ('mapValue' in v) {
    const out = {};
    for (const [k, x] of Object.entries(v.mapValue.fields || {})) out[k] = unwrapFirestoreValue(x);
    return out;
  }
  return null;
}

async function fetchTicketsForCustomer(customerName) {
  if (!customerName) return [];
  const all = await fetchAllTicketsRaw();
  const norm = customerName.trim().toLowerCase();
  const tokens = norm.split(/[\s,&]+/).filter(t => t.length >= 3);
  return all.filter(t => {
    const tc = (t.customer || '').trim().toLowerCase();
    if (!tc) return false;
    if (tc === norm) return true;
    if (tc.includes(norm) || norm.includes(tc)) return true;
    const tcTokens = tc.split(/[\s,&]+/).filter(x => x.length >= 3);
    const overlap = tokens.filter(t => tcTokens.includes(t)).length;
    return overlap >= 2;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function renderTicketsInDetail(tickets) {
  document.getElementById('cdTkCount').textContent = tickets.length;
  if (tickets.length === 0) {
    document.getElementById('cdTkList').innerHTML = '<div class="cd-tk-empty">Sin tickets de servicio registrados para este cliente.</div>';
    return;
  }
  document.getElementById('cdTkList').innerHTML = tickets.slice(0, 10).map(t => {
    const techs = Array.isArray(t.techs) ? t.techs : [];
    const wt = Array.isArray(t.workTypes) ? t.workTypes : [];
    const items = Array.isArray(t.items) ? t.items : [];
    const status = t.status || 'pending';
    const stClass = status === 'complete' ? 'complete' : status === 'reschedule' ? 'resched' : 'done';
    const stLabel = status === 'complete' ? 'Completado' : status === 'reschedule' ? 'Reagendado' : (status === 'done' ? 'Cerrado' : 'Activo');
    const totalAmt = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);

    return `
      <div class="cd-tk">
        <div class="cd-tk-head">
          <div style="min-width:0;flex:1;">
            <div class="cd-tk-title">${escapeHtml(t.date || 'Sin fecha')}${techs.length ? ' · ' + escapeHtml(techs.join(', ')) : ''}</div>
            <div class="cd-tk-meta">
              ${t.arrival ? `<span>🕐 ${escapeHtml(t.arrival)}${t.departure ? ' → ' + escapeHtml(t.departure) : ''}</span>` : ''}
              ${totalAmt > 0 ? `<span>💵 ${fmtCurrency(totalAmt)}</span>` : ''}
            </div>
            ${wt.length ? `<div class="cd-tk-tags">${wt.slice(0, 5).map(w => `<span class="cd-tk-tag">${escapeHtml(w)}</span>`).join('')}</div>` : ''}
          </div>
          <span class="cd-tk-status ${stClass}">${stLabel}</span>
        </div>
        ${items.length ? `
          <div class="cd-tk-items">
            ${items.slice(0, 6).map(it => `
              <div class="cd-tk-items-row">
                <span style="min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(it.name || it.n || '—')}${it.qty > 1 ? ` ×${it.qty}` : ''}</span>
                <span style="font-family:'IBM Plex Mono',monospace;color:var(--text);font-weight:600;">${fmtCurrency((Number(it.price) || 0) * (Number(it.qty) || 1))}</span>
              </div>`).join('')}
            ${items.length > 6 ? `<div style="font-size:11px;color:var(--text-mute);margin-top:4px;">+ ${items.length - 6} más</div>` : ''}
          </div>` : ''}
        ${t.notes ? `<div class="cd-tk-notes">"${escapeHtml(t.notes)}"</div>` : ''}
      </div>
    `;
  }).join('') + (tickets.length > 10 ? `<div style="text-align:center;font-size:11px;color:var(--text-mute);padding:6px;">Mostrando 10 de ${tickets.length} tickets</div>` : '');
}

// ════════════════════════════════════════════════════════════
// BROWSER NOTIFICATIONS (push when follow-ups are due)
// ════════════════════════════════════════════════════════════
const NOTIF_KEY = 'aspenInvoiceTracker_lastNotifCheck';
let _notifInterval = null;

// Register a real Service Worker file for background notifications
// ════════════════════════════════════════════════════════════
// FORCE APP UPDATE — nukes the service worker + all caches, then
// hard-reloads. This is the bulletproof fix for "I deployed but the
// site shows the old version" (the SW was serving a cached HTML).
// Exposed as a button in Settings + the notification panel.
// ════════════════════════════════════════════════════════════
window.forceAppUpdate = async function() {
  const en = currentLang === 'en';
  try {
    toast(en ? 'Clearing cache…' : 'Limpiando caché…', 'info');
    /* FIX v2.25.5 (12 ago 2026) — ACOTADO A ESTA APP. Cache Storage y el
       registro de service workers son POR ORIGEN, y todas las apps de Aspen
       viven en aspenservices.github.io. getRegistrations() + caches.keys()
       devolvian TAMBIEN lo de Delivery Tracker, Chemical y Warehouse, asi que
       un clic en el boton 🔄 las dejaba a todas sin modo offline. Ahora:
       solo la registracion de ESTE scope y solo las caches "aspen-spas-*". */
    // 1. Unregister only the service worker that controls this scope
    if ('serviceWorker' in navigator) {
      const r = await navigator.serviceWorker.getRegistration();
      if (r) { try { await r.unregister(); } catch (_e) {} }
    }
    // 2. Delete only this app's Cache Storage entries (CACHE_NAME = "aspen-spas-" + version)
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const k of keys) {
        if (k.indexOf('aspen-spas-') !== 0) continue;   // no tocar las otras apps del origen
        try { await caches.delete(k); } catch (_e) {}
      }
    }
  } catch (e) {
    console.warn('[ForceUpdate]', e);
  } finally {
    // 3. Hard reload bypassing HTTP cache (cache-bust query forces a fresh GET)
    const u = new URL(location.href);
    u.searchParams.set('_v', Date.now().toString());
    location.replace(u.toString());
  }
};

// Auto-check for a newer service worker on every load. If one installs while
// the page is open, show a non-intrusive "new version" reload prompt so Nela
// doesn't have to manually clear cache after a deploy.
async function _checkForAppUpdate(reg) {
  if (!reg) return;
  try {
    reg.update();
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        // A new worker is installed AND an old one was controlling → update ready
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          const en = currentLang === 'en';
          if (confirm(en
            ? 'A new version of the app is available. Reload now to update?'
            : 'Hay una nueva versión de la app. ¿Recargar ahora para actualizar?')) {
            window.forceAppUpdate();
          }
        }
      });
    });
  } catch (_e) { /* best-effort */ }
}

// (GitHub Pages blocks blob: URL service workers, so we need a real file)
let _swRegistration = null;
async function registerNotifSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service Workers not supported in this browser');
    return null;
  }
  try {
    // Use scope=./ so it works at /invoice-tracker/ path on GitHub Pages
    _swRegistration = await navigator.serviceWorker.getRegistration();  /* portado: NO se registra un SW propio — TECH-TICKETS ya registra el suyo en ./sw.js */
    console.info('[SW] Registered successfully:', _swRegistration.scope);
    // Ensure the worker is active before we try to use it
    await navigator.serviceWorker.ready;
    /* FIX v2.25.5 (12 ago 2026) — DESACTIVADO. TECH-TICKETS ya engancha su
       propio "updatefound" sobre ESTA MISMA registracion (busca confirmDialog
       "A new version of the app is available"). Tener los dos vivos daba dos
       avisos por el mismo deploy — el modal del app y el confirm() nativo de
       aqui — y el de aqui llamaba forceAppUpdate(), que borra cache y
       desregistra. Se deja la funcion definida por si se necesita suelta. */
    // _checkForAppUpdate(_swRegistration);
    return _swRegistration;
  } catch (e) {
    console.error('[SW] Register failed:', e);
    return null;
  }
}

async function requestNotifPermission() {
  if (!('Notification' in window)) {
    toast(currentLang === 'en' ? 'Your browser does not support notifications' : 'Tu navegador no soporta notificaciones', 'error');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') {
    toast(currentLang === 'en' ? 'Permissions denied — enable them in browser Settings' : 'Permisos denegados — habilítalos en Configuración del navegador', 'error');
    return false;
  }
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// ════════════════════════════════════════════════════════════
// NOTIFICATION HEALTH PANEL — visible status + diagnostics
// Click on 🔔 in header opens this; replaces old toggle-only behavior
// ════════════════════════════════════════════════════════════
window.openNotifPanel = function() {
  renderNotifPanel();
  document.getElementById('notifModal').classList.add('open');
};

window.renderNotifPanel=renderNotifPanel; // v2.63.0: the toggle button calls it from an inline onclick (global scope)
function renderNotifPanel() {
  const body = document.getElementById('notifPanelBody');
  if (!body) return;
  
  const en = currentLang === 'en';
  const enabled = localStorage.getItem('aspenNotifEnabled') === '1';
  const supported = ('Notification' in window);
  const permission = supported ? Notification.permission : 'denied';
  const swSupported = 'serviceWorker' in navigator;
  const swActive = !!_swRegistration;
  const lastCheck = Number(localStorage.getItem(NOTIF_KEY) || 0);
  const lastCheckStr = lastCheck > 0 ? new Date(lastCheck).toLocaleString() : (en ? '— never —' : '— nunca —');
  
  // Get upcoming follow-ups (next 7 days)
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const sevenDays = todayStart.getTime() + 7 * 24 * 60 * 60 * 1000;
  const upcoming = allInvoices
    .filter(inv => {
      if (deriveStatus(inv) === 'paid') return false;
      if (!inv.nextFollowUp) return false;
      const followDate = new Date(inv.nextFollowUp + 'T00:00:00').getTime();
      return followDate >= todayStart.getTime() && followDate <= sevenDays;
    })
    .sort((a,b) => a.nextFollowUp.localeCompare(b.nextFollowUp));
  
  const oldPending = allInvoices.filter(i => deriveStatus(i) === 'pending' && daysSince(i.createdAt) >= 1).length;
  const ccUnasked = allInvoices.filter(i => i.paymentReason === 'cc_needed' && !i.ccRequested && deriveStatus(i) !== 'paid').length;
  const aging = computeAgingBands();
  
  // Build the panel
  let html = '';
  
  // Section 1: Master toggle
  html += `
    <div style="background:${enabled ? '#ECFDF5' : '#F1F5F9'};border:1px solid ${enabled ? '#6EE7B7' : 'var(--border)'};border-radius:var(--r-md);padding:14px;display:flex;align-items:center;gap:12px;">
      <div style="font-size:32px;">${enabled ? '🔔' : '🔕'}</div>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:14px;color:${enabled ? '#047857' : 'var(--text)'};">${enabled ? (en ? 'Notifications ENABLED' : 'Notificaciones ACTIVAS') : (en ? 'Notifications DISABLED' : 'Notificaciones DESACTIVADAS')}</div>
        <div style="font-size:11px;color:var(--text-soft);margin-top:2px;">${enabled ? (en ? 'You\'ll get reminders for follow-ups, unsent invoices, and CC issues.' : 'Te llegan recordatorios de follow-ups, facturas sin enviar, y problemas de CC.') : (en ? 'Click below to receive daily reminders.' : 'Click abajo para recibir recordatorios diarios.')}</div>
      </div>
      <button class="btn ${enabled ? 'btn-ghost' : 'btn-primary'} btn-sm" onclick="window.toggleNotifications().then(() => renderNotifPanel())" style="flex-shrink:0;">${enabled ? (en ? 'Disable' : 'Desactivar') : (en ? 'Enable' : 'Activar')}</button>
    </div>
  `;
  
  // Section 2: Status checks (only if enabled)
  if (enabled) {
    const checks = [
      {
        ok: supported,
        label: en ? 'Browser supports notifications' : 'Navegador soporta notificaciones',
        fail: en ? 'Use Chrome or Safari' : 'Usa Chrome o Safari'
      },
      {
        ok: permission === 'granted',
        label: en ? 'Browser permission granted' : 'Permiso del navegador concedido',
        fail: permission === 'denied' ? (en ? 'BLOCKED — go to browser settings to allow' : 'BLOQUEADO — ve a Configuración del navegador para permitir') : (en ? 'Not yet granted' : 'No concedido aún'),
        action: permission === 'denied' ? { label: en ? 'macOS Notifications →' : 'Notificaciones macOS →', onclick: 'window.openMacNotifSettings()' } : null
      },
      {
        ok: swActive,
        label: en ? 'Service Worker registered (background notifs)' : 'Service Worker registrado (notifs en background)',
        fail: en ? 'Failed to register — only works with tab open' : 'No registró — solo funciona con pestaña abierta',
        action: !swActive && swSupported ? { label: en ? 'Re-register' : 'Re-registrar', onclick: 'window.retryRegisterSW()' } : null
      }
    ];
    
    html += `<div style="border:1px solid var(--border);border-radius:var(--r-md);padding:12px;background:white;">`;
    html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-soft);margin-bottom:10px;">${en ? '⚙ System health' : '⚙ Estado del sistema'}</div>`;
    for (const c of checks) {
      html += `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #F1F5F9;font-size:13px;">
          <span style="font-size:16px;">${c.ok ? '✅' : '❌'}</span>
          <span style="flex:1;color:${c.ok ? 'var(--text)' : '#991B1B'};">${escapeHtml(c.label)}${!c.ok ? `<br><span style="font-size:11px;color:var(--text-soft);font-style:italic;">${escapeHtml(c.fail)}</span>` : ''}</span>
          ${c.action ? `<button class="btn btn-secondary btn-sm" style="font-size:11px;padding:3px 8px;" onclick="${c.action.onclick}">${escapeHtml(c.action.label)}</button>` : ''}
        </div>`;
    }
    html += `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;font-size:13px;">
      <span style="font-size:16px;">⏱</span>
      <span style="flex:1;color:var(--text-soft);">${en ? 'Last check' : 'Último check'}: <strong style="color:var(--text);">${escapeHtml(lastCheckStr)}</strong></span>
    </div>`;
    html += `</div>`;
  }
  
  // Section 3: Today / upcoming pending items (always shown)
  const totalPending = upcoming.length + oldPending + ccUnasked + aging.critical.count;
  html += `<div style="border:1px solid var(--border);border-radius:var(--r-md);padding:12px;background:white;">`;
  html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-soft);margin-bottom:10px;">${en ? '📋 What you\'ll be notified about' : '📋 De qué se te notificará'}</div>`;
  
  if (totalPending === 0) {
    html += `<div style="font-size:13px;color:var(--text-soft);text-align:center;padding:14px;">✨ ${en ? 'All caught up — nothing pending!' : '¡Todo al día — sin pendientes!'}</div>`;
  } else {
    if (upcoming.length > 0) {
      html += `<div style="margin-bottom:8px;">`;
      html += `<div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:4px;">📅 ${en ? `Follow-ups in next 7 days (${upcoming.length})` : `Follow-ups próximos 7 días (${upcoming.length})`}</div>`;
      for (const inv of upcoming.slice(0, 5)) {
        const followDate = new Date(inv.nextFollowUp + 'T00:00:00');
        const daysAway = Math.round((followDate - todayStart) / (1000 * 60 * 60 * 24));
        const whenLabel = daysAway === 0 ? (en ? 'Today' : 'Hoy') : daysAway === 1 ? (en ? 'Tomorrow' : 'Mañana') : (en ? `In ${daysAway} days` : `En ${daysAway} días`);
        const whenColor = daysAway === 0 ? '#991B1B' : daysAway <= 2 ? '#9A3412' : 'var(--text-soft)';
        html += `<div style="font-size:12px;padding:4px 0;display:flex;justify-content:space-between;gap:8px;">
          <span style="color:var(--text);">#${escapeHtml(inv.invoiceNumber)} ${escapeHtml(inv.customerName)}</span>
          <span style="color:${whenColor};font-weight:600;font-size:11px;">${whenLabel}</span>
        </div>`;
      }
      if (upcoming.length > 5) {
        html += `<div style="font-size:11px;color:var(--text-mute);font-style:italic;">+ ${upcoming.length - 5} ${en ? 'more' : 'más'}</div>`;
      }
      html += `</div>`;
    }
    if (oldPending > 0) {
      html += `<div style="font-size:12px;color:var(--text);padding:4px 0;">⚠ ${en ? `${oldPending} invoice(s) +24h unsent` : `${oldPending} factura(s) sin enviar +24h`}</div>`;
    }
    if (ccUnasked > 0) {
      html += `<div style="font-size:12px;color:var(--text);padding:4px 0;">💳 ${en ? `${ccUnasked} customer(s) without CC asked` : `${ccUnasked} cliente(s) sin pedir CC`}</div>`;
    }
    if (aging.critical.count > 0) {
      html += `<div style="font-size:12px;color:#991B1B;padding:4px 0;font-weight:600;">🚨 ${en ? `${aging.critical.count} invoice(s) +30 days unpaid (${fmtCurrency(aging.critical.amt)})` : `${aging.critical.count} factura(s) +30 días sin pagar (${fmtCurrency(aging.critical.amt)})`}</div>`;
    }
  }
  html += `</div>`;
  
  // Section 4: Action buttons
  if (enabled && permission === 'granted') {
    html += `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <button class="btn btn-primary btn-sm" onclick="window.testNotification()" style="padding:10px;">🧪 ${en ? 'Fire test now' : 'Disparar test ahora'}</button>
        <button class="btn btn-secondary btn-sm" onclick="window.fireSummaryNow()" style="padding:10px;">📨 ${en ? 'Send today\'s summary' : 'Mandar resumen de hoy'}</button>
      </div>`;
  }
  
  // Section 5: Honest disclaimer
  html += `
    <details style="margin-top:4px;">
      <summary style="font-size:11px;color:var(--text-mute);cursor:pointer;">ℹ ${en ? 'How does this actually work?' : '¿Cómo funciona realmente?'}</summary>
      <div style="font-size:12px;color:var(--text-soft);line-height:1.5;background:#F8FAFC;padding:10px;border-radius:var(--r-sm);margin-top:6px;border:1px solid var(--border);">
        ${en
          ? `Notifications fire when: (1) you open the dashboard, (2) every 15 min while it stays open, (3) once per day in summary mode. They <strong>do NOT work when the browser is fully closed</strong> — they need at least one tab to be alive (background tabs are OK thanks to Service Worker). For "true push" while everything is closed we'd need Firebase Cloud Messaging, which requires backend setup. For now: leave one Chrome tab pinned with the tracker open and you'll never miss a follow-up.`
          : `Las notificaciones se disparan: (1) al abrir el dashboard, (2) cada 15 min mientras esté abierto, (3) una vez al día en modo resumen. <strong>NO funcionan con el navegador completamente cerrado</strong> — necesitan al menos una pestaña viva (en background OK gracias al Service Worker). Para "push verdadero" sin el browser abierto necesitaríamos Firebase Cloud Messaging, que requiere backend. Por ahora: deja una pestaña de Chrome pinneada con el tracker abierto y nunca te perderás un follow-up.`}
      </div>
    </details>
  `;
  
  body.innerHTML = html;
}

// Re-register SW (called from panel)
window.retryRegisterSW = async function() {
  toast(currentLang === 'en' ? 'Retrying Service Worker registration...' : 'Reintentando registro del Service Worker...', 'success');
  const reg = await registerNotifSW();
  setTimeout(() => renderNotifPanel(), 500);
  if (reg) {
    toast(currentLang === 'en' ? '✓ Service Worker registered!' : '✓ Service Worker registrado!', 'success');
  } else {
    toast(currentLang === 'en' ? '⚠ Still failed. Check console (Cmd+Opt+J).' : '⚠ Sigue fallando. Revisa consola (Cmd+Opt+J).', 'error');
  }
};

// Open macOS notification settings
window.openMacNotifSettings = function() {
  // Try to open via x-apple-systempreferences (works on macOS)
  window.location.href = 'x-apple.systempreferences:com.apple.preference.notifications';
  setTimeout(() => {
    toast(currentLang === 'en'
      ? 'If nothing opened: System Settings → Notifications → find Chrome → Allow'
      : 'Si no se abrió nada: System Settings → Notifications → busca Chrome → Allow', 'success');
  }, 800);
};

// Force fire today's summary notification (for testing)
window.fireSummaryNow = function() {
  if (Notification.permission !== 'granted') {
    toast(currentLang === 'en' ? 'Notifications not granted' : 'Notificaciones no permitidas', 'error');
    return;
  }
  // Reset the once-per-day flag and fire
  localStorage.removeItem(NOTIF_KEY);
  checkAndNotify(true);
  toast(currentLang === 'en' ? '✓ Summary fired (check your notifications)' : '✓ Resumen disparado (revisa tus notificaciones)', 'success');
};


window.toggleNotifications = async function() {
  const enabled = localStorage.getItem('aspenNotifEnabled') === '1';
  if (enabled) {
    localStorage.setItem('aspenNotifEnabled', '0');
    if (_notifInterval) { clearInterval(_notifInterval); _notifInterval = null; }
    toast(t('toast.notifDisabled'), 'success');
    updateNotifButton();
    return;
  }
  const ok = await requestNotifPermission();
  if (!ok) return;
  localStorage.setItem('aspenNotifEnabled', '1');
  // Try to register SW — if it fails, notifs only work with tab focused
  const reg = await registerNotifSW();
  if (!reg) {
    toast(currentLang === 'en'
      ? '⚠ Notifications enabled, but Service Worker failed. Notifs only work with tab open. Check console.'
      : '⚠ Notificaciones activadas, pero falló el Service Worker. Solo llegan con pestaña abierta. Revisa consola.', 'error');
  } else {
    toast(t('toast.notifEnabled'), 'success');
  }
  startNotifChecker();
  updateNotifButton();
  // Test notification — fires immediately to verify it works
  setTimeout(() => {
    showNotif(t('toast.notifTestTitle'), t('toast.notifTestBody'), 'test-' + Date.now());
  }, 500);
  // Then comprehensive check after data loads
  setTimeout(() => checkAndNotify(true), 2000);
};

function showNotif(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    console.warn('[Notif] Not granted');
    return;
  }
  const opts = {
    body,
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23134A63" rx="20"/%3E%3Ctext x="50" y="62" font-size="50" text-anchor="middle" fill="white"%3E📋%3C/text%3E%3C/svg%3E',
    badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="%23B5733A"/%3E%3C/svg%3E',
    tag: tag || 'invoice-tracker',
    requireInteraction: false,
    renotify: true
  };
  // Path 1: Use existing SW registration (works in background)
  if (_swRegistration) {
    _swRegistration.showNotification(title, opts).then(
      () => console.info('[Notif] Shown via SW:', title),
      err => {
        console.warn('[Notif] SW showNotification failed, falling back:', err);
        fallbackNotif(title, body, tag);
      }
    );
    return;
  }
  // Path 2: Try ready promise (in case _swRegistration not set yet)
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, opts);
    }).catch(() => fallbackNotif(title, body, tag));
    return;
  }
  // Path 3: Direct (only works when tab focused)
  fallbackNotif(title, body, tag);
}

function fallbackNotif(title, body, tag) {
  try {
    const n = new Notification(title, {
      body,
      icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23134A63" rx="20"/%3E%3Ctext x="50" y="62" font-size="50" text-anchor="middle" fill="white"%3E📋%3C/text%3E%3C/svg%3E',
      tag: tag || 'invoice-tracker',
      requireInteraction: false
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 8000);
    console.info('[Notif] Shown via fallback:', title);
  } catch (e) { console.error('[Notif] Fallback failed:', e); }
}

function checkAndNotify(force) {
  if (localStorage.getItem('aspenNotifEnabled') !== '1') return;
  if (Notification.permission !== 'granted') return;
  
  if (!force) {
    const lastCheck = Number(localStorage.getItem(NOTIF_KEY) || 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();
    // Only notify once per calendar day unless forced
    if (lastCheck >= todayTs) return;
  }
  
  const due = dueFollowups();
  const oldPending = allInvoices.filter(i => deriveStatus(i) === 'pending' && daysSince(i.createdAt) >= 1).length;
  const ccUnasked = allInvoices.filter(i => i.paymentReason === 'cc_needed' && !i.ccRequested && deriveStatus(i) !== 'paid').length;
  const aging = computeAgingBands();
  const critical = aging.critical.count;
  
  const totalPending = due.length + oldPending + ccUnasked + critical;
  if (totalPending === 0) {
    if (force) {
      showNotif(
        currentLang === 'en' ? '✨ All caught up!' : '✨ ¡Todo al día!',
        currentLang === 'en' ? 'No pending invoices, follow-ups, or CC asks. Enjoy the day.' : 'Sin pendientes, follow-ups, ni CCs sin pedir. Disfruta el día.',
        'morning-summary'
      );
    }
    return;
  }
  
  // Build a comprehensive summary instead of just one alert
  let title, body;
  const en = currentLang === 'en';
  
  // Build body with all categories
  const lines = [];
  if (due.length > 0) {
    const names = due.slice(0, 2).map(i => `#${i.invoiceNumber}`).join(', ');
    lines.push(en ? `📅 ${due.length} follow-up(s) today: ${names}` : `📅 ${due.length} follow-up(s) hoy: ${names}`);
  }
  if (oldPending > 0) {
    lines.push(en ? `⚠ ${oldPending} unsent +24h` : `⚠ ${oldPending} sin enviar +24h`);
  }
  if (ccUnasked > 0) {
    lines.push(en ? `💳 ${ccUnasked} CC not requested` : `💳 ${ccUnasked} sin pedir CC`);
  }
  if (critical > 0) {
    lines.push(en ? `🚨 ${critical} +30d unpaid (${fmtCurrency(aging.critical.amt)})` : `🚨 ${critical} +30d sin pagar (${fmtCurrency(aging.critical.amt)})`);
  }
  
  title = en
    ? `📋 Aspen Invoice Tracker — ${totalPending} pending action(s)`
    : `📋 Aspen Invoice Tracker — ${totalPending} acción(es) pendiente(s)`;
  body = lines.join('\n');
  
  showNotif(title, body, 'morning-summary');
  
  if (!force) {
    const today = new Date(); today.setHours(0,0,0,0);
    localStorage.setItem(NOTIF_KEY, String(today.getTime()));
  }
}

function startNotifChecker() {
  if (_notifInterval) clearInterval(_notifInterval);
  // Run once on load (with 3s delay to let data load from Firebase first)
  setTimeout(() => checkAndNotify(false), 3000);
  // Then check every 15 min while page is open
  _notifInterval = setInterval(() => checkAndNotify(false), 15 * 60 * 1000);
}

window.testNotification = function() {
  // Manual test trigger from UI — useful to verify perms work
  if (Notification.permission !== 'granted') {
    toast(currentLang === 'en' ? 'Notifications not enabled — click 🔕 to enable first' : 'Notificaciones no activadas — click 🔕 primero', 'error');
    return;
  }
  checkAndNotify(true);
};

function updateNotifButton() {
  const btn = document.getElementById('notifBtn');
  if (!btn) return;
  const enabled = localStorage.getItem('aspenNotifEnabled') === '1' && (typeof Notification !== 'undefined' && Notification.permission === 'granted');
  btn.textContent = enabled ? '🔔' : '🔕';
  btn.title = enabled ? t('header.notif.on') : t('header.notif.off');
  btn.style.color = enabled ? 'var(--sent)' : '';
}
// ════════════════════════════════════════════════════════════
window.openSnoozeMenu = function(event, id) {
  event.stopPropagation();
  // Remove any existing menu
  document.querySelectorAll('.snooze-menu').forEach(m => m.remove());
  const menu = document.createElement('div');
  menu.className = 'snooze-menu';
  menu.style.cssText = `position:absolute;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-md);box-shadow:var(--shadow-md);padding:6px;z-index:200;min-width:160px;`;
  
  const opts = [
    { label: currentLang === 'en' ? '💤 3 days' : '💤 3 días', days: 3 },
    { label: currentLang === 'en' ? '💤 7 days' : '💤 7 días', days: 7 },
    { label: currentLang === 'en' ? '💤 14 days' : '💤 14 días', days: 14 },
    { label: currentLang === 'en' ? '📅 Until date…' : '📅 Hasta fecha…', days: 'custom' }
  ];
  menu.innerHTML = opts.map(o => `
    <div style="padding:8px 12px;cursor:pointer;border-radius:6px;font-size:13px;" onmouseover="this.style.background='var(--bg-soft)'" onmouseout="this.style.background='transparent'" onclick="window.snoozeInvoice('${id}', ${typeof o.days === 'number' ? o.days : `'${o.days}'`})">${o.label}</div>
  `).join('');
  
  // Position near the click
  document.body.appendChild(menu);
  const rect = event.target.getBoundingClientRect();
  menu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  menu.style.left = (rect.left + window.scrollX - 140) + 'px';
  
  // Close on outside click
  setTimeout(() => {
    const close = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', close);
      }
    };
    document.addEventListener('click', close);
  }, 50);
};

window.snoozeInvoice = async function(id, days) {
  const inv = allInvoices.find(i => i.id === id);
  if (!inv) return;
  let untilDate;
  if (days === 'custom') {
    const today = new Date().toISOString().split('T')[0];
    const input = prompt(currentLang === 'en' ? `Until what date do you want to snooze invoice #${inv.invoiceNumber}? (format YYYY-MM-DD)` : `¿Hasta qué fecha snoozeas la factura #${inv.invoiceNumber}? (formato YYYY-MM-DD)`, today);
    if (!input) return;
    untilDate = input;
  } else {
    const d = new Date();
    d.setDate(d.getDate() + Number(days));
    untilDate = d.toISOString().split('T')[0];
  }
  const history = [...(inv.history || []), { ts: Date.now(), action: 'snoozed', until: untilDate }];
  await updateInvoiceData(id, { snoozedUntil: untilDate, history });
  toast(t('toast.snoozedUntil', untilDate), 'success');
  document.querySelectorAll('.snooze-menu').forEach(m => m.remove());
};

window.unsnoozeInvoice = async function(id) {
  const inv = allInvoices.find(i => i.id === id);
  if (!inv) return;
  const history = [...(inv.history || []), { ts: Date.now(), action: 'unsnoozed' }];
  await updateInvoiceData(id, { snoozedUntil: null, history });
  toast(t('toast.unsnoozed', inv.invoiceNumber), 'success');
};

function isSnoozed(inv) {
  return inv.snoozedUntil && new Date(inv.snoozedUntil) > new Date();
}

function countSnoozed() {
  return allInvoices.filter(i => isSnoozed(i)).length;
}

// ════════════════════════════════════════════════════════════
// AGING REPORT
// ════════════════════════════════════════════════════════════
function computeAgingBands() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const bands = {
    fresh: { labelKey: 'aging.band.fresh', cls: 'fresh', count: 0, amt: 0, items: [] },
    warn: { labelKey: 'aging.band.warn', cls: 'warn', count: 0, amt: 0, items: [] },
    late: { labelKey: 'aging.band.late', cls: 'late', count: 0, amt: 0, items: [] },
    critical: { labelKey: 'aging.band.critical', cls: 'critical', count: 0, amt: 0, items: [] }
  };
  for (const inv of allInvoices) {
    const s = deriveStatus(inv);
    if (s === 'paid') continue;
    if (!inv.sentAt && s !== 'pending') continue;
    const refDate = inv.sentAt || inv.createdAt;
    if (!refDate) continue;
    const ageDays = Math.floor((now - refDate) / day);
    let band;
    if (ageDays <= 7) band = bands.fresh;
    else if (ageDays <= 14) band = bands.warn;
    else if (ageDays <= 30) band = bands.late;
    else band = bands.critical;
    band.count++;
    band.amt += Number(inv.amount) || 0;
    band.items.push(inv);
  }
  return bands;
}

function renderAgingCard() {
  const bands = computeAgingBands();
  const totalAmt = bands.fresh.amt + bands.warn.amt + bands.late.amt + bands.critical.amt;
  const totalCount = bands.fresh.count + bands.warn.count + bands.late.count + bands.critical.count;
  const card = document.getElementById('agingCard');
  if (totalCount === 0) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';
  document.getElementById('agingTotal').textContent = `${fmtCurrency(totalAmt)} ${t('aging.totalSuffix')} (${totalCount})`;
  
  const maxAmt = Math.max(bands.fresh.amt, bands.warn.amt, bands.late.amt, bands.critical.amt, 1);
  document.getElementById('agingBands').innerHTML = ['fresh', 'warn', 'late', 'critical'].map(key => {
    const b = bands[key];
    const pct = (b.amt / maxAmt) * 100;
    return `
      <div class="aging-band ${b.cls}${b.count === 0 ? ' empty' : ''}" onclick="window.filterByAgingBand('${key}')">
        <div class="aging-band-label">${escapeHtml(t(b.labelKey))}</div>
        <div class="aging-band-amt">${fmtCurrency(b.amt)}</div>
        <div class="aging-band-count">${b.count} ${escapeHtml(t('aging.invoices'))}</div>
        <div class="aging-band-bar" style="width:${pct}%;"></div>
      </div>
    `;
  }).join('');
}

window.filterByAgingBand = function(bandKey) {
  const bands = computeAgingBands();
  const ids = new Set(bands[bandKey].items.map(i => i.id));
  if (ids.size === 0) return;
  currentFilter = 'aging_' + bandKey;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  computeAndRender();
  toast(currentLang === 'en' ? `Showing ${t(bands[bandKey].labelKey)}` : `Mostrando ${t(bands[bandKey].labelKey)}`, 'success');
};

// ════════════════════════════════════════════════════════════
// TODAY VIEW
// ════════════════════════════════════════════════════════════
function getTodayItems() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const sections = {
    pending: { titleKey: 'today.section.pending', urgent: true, items: [] },
    followup: { titleKey: 'today.section.followup', urgent: true, items: [] },
    overdue: { titleKey: 'today.section.overdue', warn: true, items: [] },
    cc_unasked: { titleKey: 'today.section.cc', warn: true, items: [] }
  };

  for (const inv of allInvoices) {
    const s = deriveStatus(inv);
    if (s === 'paid') continue;
    if (isSnoozed(inv)) continue;
    
    // Pending: created and not sent
    if (s === 'pending') sections.pending.items.push(inv);
    
    // Follow-up due today or earlier
    if (inv.nextFollowUp && inv.nextFollowUp <= todayStr) sections.followup.items.push(inv);
    
    // Sent +14 days
    if (inv.sentAt && (now - inv.sentAt) >= 14 * day && s !== 'pending') {
      sections.overdue.items.push(inv);
    }
    
    // CC needed but not yet requested
    if (inv.paymentReason === 'cc_needed' && !inv.ccRequested) {
      sections.cc_unasked.items.push(inv);
    }
  }
  return sections;
}

function countTodayTotal() {
  const sec = getTodayItems();
  // Use a Set to avoid double-counting the same invoice across sections
  const ids = new Set();
  for (const k of Object.keys(sec)) for (const i of sec[k].items) ids.add(i.id);
  return ids.size;
}

function renderTodayView() {
  const list = document.getElementById('invoiceList');
  const sec = getTodayItems();
  const totalItems = Object.values(sec).reduce((s, x) => s + x.items.length, 0);
  if (totalItems === 0) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">🌅</div>
        <div class="empty-title">${escapeHtml(t('today.empty.title'))}</div>
        <div class="empty-text">${escapeHtml(t('today.empty.text'))}</div>
      </div>`;
    return;
  }
  
  let html = '';
  for (const [key, sx] of Object.entries(sec)) {
    if (sx.items.length === 0) continue;
    const cls = sx.urgent ? 'urgent' : (sx.warn ? 'warn' : '');
    html += `<div class="section-hdr ${cls}"><span class="section-hdr-title">${escapeHtml(t(sx.titleKey))}</span><span class="section-hdr-count">${sx.items.length}</span></div>`;
    html += sx.items.map(inv => renderInvoiceCardHtml(inv)).join('');
  }
  list.innerHTML = html;
}

// Refactored: extract the per-card render so it can be reused in the today view
function renderInvoiceCardHtml(inv) {
  const s = deriveStatus(inv);
  const urgentCls = s === 'pending' && daysSince(inv.createdAt) >= 1 ? ' urgent' : (s === 'followup' ? ' warn' : '');
  const days = s === 'pending' ? daysSince(inv.createdAt) : (s === 'followup' || s === 'sent' ? daysSince(inv.sentAt) : null);
  const daysLabel = days !== null && days !== undefined ? (s === 'pending' ? t('card.daysSinceCreated', days) : t('card.daysSinceSent', days)) : '';
  const payPill = inv.paymentReason && s !== 'paid' ? `<span class="payment-pill ${inv.paymentReason}">${paymentReasonLabel(inv.paymentReason)}</span>` : '';
  const methodPill = inv.paymentMethod && s === 'paid' ? `<span class="payment-pill" style="background:var(--paid-bg);color:var(--paid);">${paymentMethodLabel(inv.paymentMethod)}${inv.paymentRef ? ' · ' + escapeHtml(inv.paymentRef) : ''}</span>` : '';
  // QB Pending badge — flags paid invoices that haven't been entered in QuickBooks Desktop yet.
  // Shows next to the method pill so it's obvious which payments still need accounting follow-up.
  const qbPendingPill = (s === 'paid' && !inv.qbSynced) ? `<span class="payment-pill" style="background:#EFF6FF;color:#1E40AF;border:1px solid #93C5FD;font-weight:700;" title="${escapeHtml(currentLang === 'en' ? 'Paid but not yet recorded in QuickBooks Desktop' : 'Pagada pero aún no registrada en QuickBooks Desktop')}">📒 ${currentLang === 'en' ? 'QB PENDING' : 'QB PENDIENTE'}</span>` : '';
  // Special pill: check collected but not yet deposited (still pending)
  const checkPendingPill = (inv.paymentMethod === 'check' && inv.checkLocation && inv.checkLocation !== 'deposited' && s !== 'paid') 
    ? `<span class="payment-pill" style="background:#FEF9C3;color:#854D0E;border:1px solid #FDE047;">📝 ${currentLang === 'en' ? 'CHECK PENDING DEPOSIT' : 'CHEQUE SIN DEPOSITAR'}${inv.checkLocation === 'with_tech' && inv.technician ? ' · ' + escapeHtml(inv.technician) : ''}${inv.checkLocation === 'office' ? ' · ' + (currentLang === 'en' ? 'In office' : 'En oficina') : ''}</span>`
    : '';
  // Internal alerts badge — shows when alerts have been generated for this invoice
  const alertEvents = (inv.history || []).filter(h => h.action === 'alert_collections' || h.action === 'alert_check');
  const lastAlert = alertEvents[alertEvents.length - 1];
  const alertBadge = lastAlert ? (() => {
    const when = new Date(lastAlert.ts);
    const today = new Date(); today.setHours(0,0,0,0);
    const isToday = when.getTime() >= today.getTime();
    const timeStr = isToday 
      ? when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : when.toLocaleDateString();
    const icon = lastAlert.action === 'alert_check' ? '💵' : '🚨';
    const recipient = escapeHtml(lastAlert.recipientName || 'Cobros');
    const isConfirmed = lastAlert.confirmed === true;
    const stateLabel = isConfirmed
      ? (currentLang === 'en' ? 'Sent' : 'Enviado')
      : (currentLang === 'en' ? 'Generated' : 'Generado');
    const stateIcon = isConfirmed ? '✅' : '⏰';
    const bg = isConfirmed ? '#DCFCE7' : '#FEF3C7';
    const fg = isConfirmed ? '#2E8B57' : '#92400E';
    const border = isConfirmed ? '#86EFAC' : '#FDE047';
    const tooltip = currentLang === 'en'
      ? `${stateIcon} ${stateLabel} for ${recipient} at ${when.toLocaleString()}. ${alertEvents.length} alert(s) total. ${isConfirmed ? 'You confirmed Send was clicked.' : 'NOT confirmed sent yet — confirm in payment modal.'}`
      : `${stateIcon} ${stateLabel} a ${recipient} a las ${when.toLocaleString()}. ${alertEvents.length} alerta(s). ${isConfirmed ? 'Confirmaste que enviaste.' : 'NO confirmado aún — confirma en payment modal.'}`;
    return `<span style="font-size:11px;color:${fg};background:${bg};padding:2px 8px;border-radius:999px;font-weight:700;border:1px solid ${border};" title="${escapeHtml(tooltip)}">${stateIcon} ${icon} ${recipient} · ${timeStr}${alertEvents.length > 1 ? ` (×${alertEvents.length})` : ''}</span>`;
  })() : '';
  
  // Customer email send badge — shows when emails have been sent to the customer
  const sentEvents = (inv.history || []).filter(h => h.action === 'sent');
  const lastSent = sentEvents[sentEvents.length - 1];
  const customerSentBadge = lastSent ? (() => {
    const when = new Date(lastSent.ts);
    const today = new Date(); today.setHours(0,0,0,0);
    const isToday = when.getTime() >= today.getTime();
    const timeStr = isToday 
      ? when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : when.toLocaleDateString();
    // Stage-specific icons: 1=📧 first send, 2=🔔 reminder, 3=⚠️ past due, 4=💚 receipt/thanks
    // If channel is SMS, override with 📱
    const stageIcons = { 1: '📧', 2: '🔔', 3: '⚠️', 4: '💚' };
    const icon = lastSent.channel === 'sms' ? '📱' : (stageIcons[lastSent.stage] || '📧');
    // Use customer first name if available
    const customerFirstName = (inv.greetingName || (inv.customerName || '').split(/[ &,]/)[0] || 'Cliente').trim();
    const recipient = escapeHtml(customerFirstName);
    // Legacy entries (before confirm modal existed) have confirmed:undefined — treat as confirmed
    const isConfirmed = lastSent.confirmed !== false;
    const stateLabel = isConfirmed
      ? (currentLang === 'en' ? 'Sent' : 'Enviado')
      : (currentLang === 'en' ? 'Generated' : 'Generado');
    const stateIcon = isConfirmed ? '✅' : '⏰';
    // Different color palette than alerts (so they're visually distinct)
    // Customer sends: blue tint when confirmed, yellow when not
    const bg = isConfirmed ? '#DBEAFE' : '#FEF3C7';
    const fg = isConfirmed ? '#1E40AF' : '#92400E';
    const border = isConfirmed ? '#93C5FD' : '#FDE047';
    const stageNames = currentLang === 'en' 
      ? { 1: 'first send', 2: 'reminder', 3: 'past due', 4: 'paid receipt' }
      : { 1: 'primer envío', 2: 'recordatorio', 3: 'aviso final', 4: 'recibo de pago' };
    const stageName = stageNames[lastSent.stage] || 'email';
    const tooltip = currentLang === 'en'
      ? `${stateIcon} ${stateLabel} to ${recipient} at ${when.toLocaleString()} (${stageName}). ${sentEvents.length} email(s) total. ${isConfirmed ? 'You confirmed Send was clicked.' : 'NOT confirmed sent yet.'}`
      : `${stateIcon} ${stateLabel} a ${recipient} a las ${when.toLocaleString()} (${stageName}). ${sentEvents.length} email(s) en total. ${isConfirmed ? 'Confirmaste que enviaste.' : 'NO confirmado aún.'}`;
    return `<span style="font-size:11px;color:${fg};background:${bg};padding:2px 8px;border-radius:999px;font-weight:700;border:1px solid ${border};" title="${escapeHtml(tooltip)}">${stateIcon} ${icon} ${recipient} · ${timeStr}${sentEvents.length > 1 ? ` (×${sentEvents.length})` : ''}</span>`;
  })() : '';
  const ccBadge = inv.ccRequested && s !== 'paid' ? `<span style="font-size:11px;color:var(--sent);font-weight:600;" title="${escapeHtml(t('card.ccRequestedTitle'))}">${escapeHtml(t('card.ccRequested'))}</span>` : '';
  const fuLabel = inv.nextFollowUp && s !== 'paid' ? `<span style="color:var(--followup);font-size:11px;">${escapeHtml(t('card.followupOn', inv.nextFollowUp))}</span>` : '';
  // Snooze indicator
  const isSnoozedFlag = inv.snoozedUntil && new Date(inv.snoozedUntil) > new Date();
  const snoozeLabel = isSnoozedFlag ? `<span style="font-size:11px;color:#7c3aed;font-weight:600;" title="${escapeHtml(t('card.snoozedUntilTitle', inv.snoozedUntil))}">${escapeHtml(t('card.snoozedUntil', inv.snoozedUntil))}</span>` : '';
  const sendCount = (inv.history || []).filter(h => h.action === 'sent').length;
  const stageBadge = sendCount >= 2 && s !== 'paid' ? `<span style="font-size:11px;color:#9a3412;font-weight:700;background:#FFEDD5;padding:1px 6px;border-radius:999px;" title="${escapeHtml(t('card.timesResentTitle', sendCount))}">${escapeHtml(t('card.timesResent', sendCount))}</span>` : '';
  
  const snoozedCls = isSnoozedFlag ? ' snoozed' : '';
  
  return `
    <div class="invoice-card${urgentCls}${snoozedCls}">
      ${bulkMode ? `<input type="checkbox" data-bulk-id="${inv.id}" onclick="event.stopPropagation();window.toggleBulkSelect('${inv.id}')" ${bulkSelectedIds.has(inv.id) ? 'checked' : ''} style="width:18px;height:18px;margin-right:8px;cursor:pointer;accent-color:#0284C7;">` : ''}
      <div class="invoice-status ${s}"></div>
      <div class="invoice-main">
        <div class="invoice-title">
          <span class="invoice-num">#${escapeHtml(inv.invoiceNumber)}</span>
          ${inv.pdfBase64 ? `<span onclick="event.stopPropagation();window.viewInvoicePdf('${inv.id}')" title="${escapeHtml(currentLang === 'en' ? 'PDF saved — click to view' : 'PDF guardado — click para ver')}" style="display:inline-flex;align-items:center;gap:3px;background:#DCFCE7;color:#2E8B57;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;cursor:pointer;border:1px solid #86EFAC;">📎 PDF</span>` : ''}
          <span class="invoice-customer clickable" onclick="window.openCustomerDetail('${escapeHtml(inv.customerName).replace(/'/g, "\\'")}')">${escapeHtml(inv.customerName)}</span>
          <span class="status-badge ${s}">${statusLabel(s)}</span>
          ${payPill}
          ${methodPill}
          ${qbPendingPill}
          ${checkPendingPill}
          ${stageBadge}
        </div>
        <div class="invoice-meta">
          <span>✉ ${escapeHtml(inv.customerEmail)}</span>
          ${inv.technician ? `<span>👷 ${escapeHtml(inv.technician)}</span>` : ''}
          ${inv.serviceDate ? `<span>📅 ${fmtDateShort(inv.serviceDate)}</span>` : ''}
          ${daysLabel ? `<span>⏱ ${daysLabel}</span>` : ''}
          ${ccBadge}
          ${fuLabel}
          ${snoozeLabel}
          ${alertBadge}
          ${customerSentBadge}
        </div>
      </div>
      <div class="invoice-amount">${fmtCurrency(inv.amount)}</div>
      <div class="invoice-actions">
        ${s === 'pending' ? `<button class="btn btn-primary btn-sm" onclick="window.openSendModal('${inv.id}')">${escapeHtml(t('card.send'))}</button>` : ''}
        ${s === 'sent' || s === 'followup' ? `<button class="btn btn-success btn-sm" onclick="window.markAsPaid('${inv.id}')">${escapeHtml(t('card.markPaid'))}</button>` : ''}
        ${s === 'sent' || s === 'followup' ? `<button class="btn btn-secondary btn-sm" onclick="window.openSendModal('${inv.id}')">${escapeHtml(t('card.resend'))}</button>` : ''}
        ${s === 'paid' ? `<button class="btn btn-secondary btn-sm" onclick="window.openSendModal('${inv.id}')" title="${escapeHtml(currentLang === 'en' ? 'Send receipt / resend invoice / send any email to this customer' : 'Mandar recibo / reenviar factura / mandar cualquier email a este cliente')}">📩 ${escapeHtml(currentLang === 'en' ? 'Send' : 'Enviar')}</button>` : ''}
        ${(s === 'paid' && !inv.qbSynced) ? `<button class="btn btn-sm" onclick="event.stopPropagation();window.markQbSynced('${inv.id}')" title="${escapeHtml(currentLang === 'en' ? 'Mark this invoice as entered in QuickBooks Desktop (removes from QB Pending tab)' : 'Marcar esta factura como entrada en QuickBooks Desktop (sale de QB Pending)')}" style="background:#1C8FA8;color:#fff;border:none;font-weight:700;">✅ QB</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="window.openPaymentModal('${inv.id}')" title="${escapeHtml(t('card.payment.title'))}">💳</button>
        ${(() => {
          // Cross-app alert button — shown when invoice has a payment problem the tech team should know about
          const isPaymentProblem = s !== 'paid' && (
            inv.paymentReason === 'cc_declined' ||
            inv.paymentReason === 'cc_needed' ||
            inv.paymentReason === 'disputed' ||
            inv.paymentReason === 'no_response' ||
            inv.paymentReason === 'partial' ||
            inv.paymentReason === 'pending' ||
            (s === 'followup' && daysSince(inv.sentAt) >= 30) ||
            // Also show for check-pending-deposit invoices (yellow status)
            (inv.paymentMethod === 'check' && inv.checkLocation && inv.checkLocation !== 'deposited')
          );
          if (!isPaymentProblem) return '';
          // Detect alert state: published / resolved / not yet alerted
          const lastPublished = (inv.history || []).filter(h => h.action === 'crossapp_alert_published').slice(-1)[0];
          const lastResolved = (inv.history || []).filter(h => h.action === 'crossapp_alert_resolved').slice(-1)[0];
          const alreadyAlerted = !!lastPublished;
          const techResolved = lastResolved && lastPublished && lastResolved.ts > lastPublished.ts;
          // Resolved state — show green "✓ Tech resolved" pill (with who resolved it if available)
          if (techResolved) {
            const by = lastResolved.resolvedBy ? ' · ' + lastResolved.resolvedBy : '';
            const en = currentLang === 'en';
            const title = (en ? 'Tech team resolved this alert' : 'Tech team resolvió esta alerta') + by;
            return `<button class="btn btn-sm" onclick="window.openCrossAppAlertModal('${inv.id}')" title="${escapeHtml(title)}" style="background:#DCFCE7;color:#2E8B57;border:1px solid #86EFAC;font-weight:600;">✓ ${escapeHtml(en ? 'Tech ack' : 'Tech ack')}</button>`;
          }
          const title = currentLang === 'en'
            ? (alreadyAlerted ? 'Tech team already notified — click to re-send' : 'Notify Tech Team about this payment issue')
            : (alreadyAlerted ? 'Tech team ya notificado — click para reenviar' : 'Alertar a Tech Team sobre este problema de pago');
          const icon = alreadyAlerted ? '🔔' : '🔔';
          const cls = alreadyAlerted ? 'btn-ghost' : 'btn-secondary';
          return `<button class="btn ${cls} btn-sm" onclick="window.openCrossAppAlertModal('${inv.id}')" title="${escapeHtml(title)}" style="${alreadyAlerted ? 'opacity:0.55;' : 'background:#FEF2F2;color:#991B1B;border:1px solid #FCA5A5;'}">${icon}${alreadyAlerted ? '' : ' ' + escapeHtml(currentLang === 'en' ? 'Alert Tech' : 'Alertar Tech')}</button>`;
        })()}
        ${s !== 'paid' ? (isSnoozedFlag ? `<button class="btn btn-ghost btn-sm" onclick="window.unsnoozeInvoice('${inv.id}')" title="${escapeHtml(t('card.unsnooze.title'))}">⏰</button>` : `<button class="btn btn-ghost btn-sm" onclick="window.openSnoozeMenu(event, '${inv.id}')" title="${escapeHtml(t('card.snooze.title'))}">💤</button>`) : ''}
        <button class="btn btn-ghost btn-sm" onclick="window.openEditModal('${inv.id}')">${escapeHtml(t('card.edit'))}</button>
        <button class="btn btn-ghost btn-sm btn-icon" onclick="window.openDeleteModal('${inv.id}')" title="${escapeHtml(t('card.delete.title'))}">🗑</button>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
// PROBLEM ACCOUNTS
// ════════════════════════════════════════════════════════════
function getProblemCustomers() {
  // For each customer, count payment issues across all their invoices
  const byCustomer = new Map();
  for (const inv of allInvoices) {
    const name = (inv.customerName || '').trim();
    if (!name) continue;
    if (!byCustomer.has(name)) {
      byCustomer.set(name, {
        name,
        email: inv.customerEmail,
        totalInvoices: 0,
        totalAmount: 0,
        unpaidAmount: 0,
        issues: { cc_declined: 0, no_response: 0, disputed: 0, cc_needed: 0, partial: 0 },
        oldestUnpaidDays: 0,
        worstFollowUp: null
      });
    }
    const c = byCustomer.get(name);
    c.totalInvoices++;
    c.totalAmount += Number(inv.amount) || 0;
    const s = deriveStatus(inv);
    if (s !== 'paid') c.unpaidAmount += Number(inv.amount) || 0;
    if (inv.paymentReason && s !== 'paid') c.issues[inv.paymentReason] = (c.issues[inv.paymentReason] || 0) + 1;
    if (s !== 'paid' && (inv.sentAt || inv.createdAt)) {
      const ageDays = Math.floor((Date.now() - (inv.sentAt || inv.createdAt)) / 86400000);
      if (ageDays > c.oldestUnpaidDays) c.oldestUnpaidDays = ageDays;
    }
  }
  // Score: any customer with 2+ issues OR 1 declined+disputed OR oldestUnpaid >= 30
  return Array.from(byCustomer.values())
    .map(c => {
      const issueCount = Object.values(c.issues).reduce((a, b) => a + b, 0);
      const hasSerious = c.issues.cc_declined > 0 || c.issues.disputed > 0;
      const isProblem = issueCount >= 2 || (hasSerious && issueCount >= 1) || c.oldestUnpaidDays >= 30;
      return { ...c, issueCount, isProblem };
    })
    .filter(c => c.isProblem)
    .sort((a, b) => b.issueCount * 1000 + b.oldestUnpaidDays - (a.issueCount * 1000 + a.oldestUnpaidDays));
}

function renderProblemView() {
  const list = document.getElementById('invoiceList');
  const probs = getProblemCustomers();
  if (probs.length === 0) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">✨</div>
        <div class="empty-title">${escapeHtml(t('problems.empty.title'))}</div>
        <div class="empty-text">${escapeHtml(t('problems.empty.text'))}</div>
      </div>`;
    return;
  }
  list.innerHTML = `
    <div style="font-size:12px;color:var(--text-soft);margin-bottom:10px;padding:0 4px;">
      ${escapeHtml(t('problems.intro'))}
    </div>
    ${probs.map(c => {
      const issuesPills = [];
      if (c.issues.cc_declined) issuesPills.push(`<span class="payment-pill cc_declined">${c.issues.cc_declined}× ${currentLang === 'en' ? 'CC declined' : 'CC rechazada'}</span>`);
      if (c.issues.no_response) issuesPills.push(`<span class="payment-pill no_response">${c.issues.no_response}× ${currentLang === 'en' ? 'no response' : 'sin respuesta'}</span>`);
      if (c.issues.disputed) issuesPills.push(`<span class="payment-pill disputed">${c.issues.disputed}× ${currentLang === 'en' ? 'disputed' : 'disputa'}</span>`);
      if (c.issues.cc_needed) issuesPills.push(`<span class="payment-pill cc_needed">${c.issues.cc_needed}× ${currentLang === 'en' ? 'CC needed' : 'falta CC'}</span>`);
      if (c.issues.partial) issuesPills.push(`<span class="payment-pill partial">${c.issues.partial}× ${currentLang === 'en' ? 'partial' : 'pago parcial'}</span>`);
      return `
        <div class="prob-row" onclick="window.openCustomerDetail('${escapeHtml(c.name).replace(/'/g, "\\'")}')">
          <div>
            <div class="prob-name">${escapeHtml(c.name)}</div>
            <div class="prob-meta">
              <span>${escapeHtml(t('problems.invoiceCount', c.totalInvoices))}</span>
              ${c.oldestUnpaidDays > 0 ? `<span style="color:var(--pending);">${escapeHtml(t('problems.daysUnpaid', c.oldestUnpaidDays))}</span>` : ''}
              ${c.email ? `<span>✉ ${escapeHtml(c.email)}</span>` : ''}
            </div>
            <div class="prob-issues">${issuesPills.join('')}</div>
          </div>
          <div class="prob-stat">
            ${fmtCurrency(c.unpaidAmount)}
            <div class="prob-stat-amt">${escapeHtml(t('problems.totalSuffix', fmtCurrency(c.totalAmount)))}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();window.openCustomerDetail('${escapeHtml(c.name).replace(/'/g, "\\'")}')">${escapeHtml(t('problems.viewProfile'))}</button>
        </div>
      `;
    }).join('')}
  `;
}

// ════════════════════════════════════════════════════════════
// SENT TODAY VIEW — shows everything sent/confirmed today with stats
// ════════════════════════════════════════════════════════════
function renderSentTodayView() {
  const list = document.getElementById('invoiceList');
  const en = currentLang === 'en';
  
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayMs = todayStart.getTime();
  
  // Collect all "sent activity" today across all invoices
  const customerSends = []; // { invoice, ts, stage }
  const internalAlerts = []; // { invoice, ts, action, recipientName, confirmed, location, reason, hasPdf }
  
  allInvoices.forEach(inv => {
    (inv.history || []).forEach(h => {
      if (h.ts < todayMs) return;
      if (h.action === 'sent') {
        customerSends.push({ invoice: inv, ts: h.ts, stage: h.stage });
      } else if ((h.action === 'alert_collections' || h.action === 'alert_check') && h.confirmed) {
        internalAlerts.push({ invoice: inv, ts: h.ts, action: h.action, recipientName: h.recipientName, location: h.location, reason: h.reason, hasPdf: h.hasPdf });
      }
    });
  });
  
  // Compute stats
  const totalCustomerSends = customerSends.length;
  const totalAlerts = internalAlerts.length;
  const totalChecksTracked = internalAlerts.filter(a => a.action === 'alert_check').reduce((sum, a) => sum + (a.invoice.amount || 0), 0);
  const totalCustomerAmount = customerSends.reduce((sum, s) => sum + (s.invoice.amount || 0), 0);
  
  // Also count un-confirmed (still pending)
  const pendingConfirmAlerts = [];
  allInvoices.forEach(inv => {
    (inv.history || []).forEach(h => {
      if (h.ts < todayMs) return;
      if ((h.action === 'alert_collections' || h.action === 'alert_check') && !h.confirmed) {
        pendingConfirmAlerts.push({ invoice: inv, ts: h.ts, action: h.action });
      }
    });
  });
  
  if (totalCustomerSends === 0 && totalAlerts === 0 && pendingConfirmAlerts.length === 0) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📤</div>
        <div class="empty-title">${en ? 'Nothing sent today yet' : 'Aún no has enviado nada hoy'}</div>
        <div class="empty-text">${en ? 'Customer emails and confirmed internal alerts will appear here.' : 'Los emails a clientes y alertas confirmadas aparecerán aquí.'}</div>
      </div>`;
    return;
  }
  
  // Build stat cards row
  const statsHtml = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;">
      <div style="background:#DBEAFE;border:1px solid #93C5FD;border-radius:var(--r-md);padding:12px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#1E40AF;">${en ? 'Customer emails' : 'Emails a clientes'}</div>
        <div style="font-size:24px;font-weight:800;color:#134A63;margin-top:4px;">${totalCustomerSends}</div>
        <div style="font-size:11px;color:#475569;margin-top:2px;">${fmtCurrency(totalCustomerAmount)} ${en ? 'invoiced' : 'facturado'}</div>
      </div>
      <div style="background:#DCFCE7;border:1px solid #86EFAC;border-radius:var(--r-md);padding:12px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#2E8B57;">${en ? 'Internal alerts ✓' : 'Alertas internas ✓'}</div>
        <div style="font-size:24px;font-weight:800;color:#134A63;margin-top:4px;">${totalAlerts}</div>
        <div style="font-size:11px;color:#475569;margin-top:2px;">${en ? 'confirmed sent' : 'confirmadas enviadas'}</div>
      </div>
      <div style="background:#FEF9C3;border:1px solid #FDE047;border-radius:var(--r-md);padding:12px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#854D0E;">${en ? 'Checks tracked' : 'Cheques en tracking'}</div>
        <div style="font-size:24px;font-weight:800;color:#134A63;margin-top:4px;">${fmtCurrency(totalChecksTracked)}</div>
        <div style="font-size:11px;color:#475569;margin-top:2px;">${internalAlerts.filter(a => a.action === 'alert_check').length} ${en ? 'checks' : 'cheques'}</div>
      </div>
      <div style="background:${pendingConfirmAlerts.length > 0 ? '#FEE2E2' : '#F1F5F9'};border:1px solid ${pendingConfirmAlerts.length > 0 ? '#FCA5A5' : 'var(--border)'};border-radius:var(--r-md);padding:12px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${pendingConfirmAlerts.length > 0 ? '#991B1B' : 'var(--text-soft)'};">${en ? 'Pending confirm' : 'Sin confirmar'}</div>
        <div style="font-size:24px;font-weight:800;color:#134A63;margin-top:4px;">${pendingConfirmAlerts.length}</div>
        <div style="font-size:11px;color:#475569;margin-top:2px;">${en ? 'generated, not confirmed' : 'generadas sin confirmar'}</div>
      </div>
    </div>`;
  
  // Combine + sort all events by time DESC
  const allEvents = [
    ...customerSends.map(s => ({ ts: s.ts, type: 'customer', data: s })),
    ...internalAlerts.map(a => ({ ts: a.ts, type: 'alert', data: a })),
    ...pendingConfirmAlerts.map(a => ({ ts: a.ts, type: 'pending', data: a }))
  ].sort((a, b) => b.ts - a.ts);
  
  const stageNames = {1: en ? 'First send' : 'Primer envío', 2: en ? 'Reminder' : 'Recordatorio', 3: en ? 'Past due' : 'Vencida'};
  const eventsHtml = allEvents.map(ev => {
    const time = new Date(ev.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (ev.type === 'customer') {
      const inv = ev.data.invoice;
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:white;border:1px solid var(--border);border-radius:var(--r-md);margin-bottom:8px;cursor:pointer;" onclick="window.openCustomerDetail('${escapeHtml(inv.customerName).replace(/'/g, "\\'")}')">
        <div style="font-size:18px;">📧</div>
        <div style="flex:1;">
          <div style="font-weight:600;font-size:13px;">#${escapeHtml(inv.invoiceNumber)} ${escapeHtml(inv.customerName)}</div>
          <div style="font-size:11px;color:var(--text-mute);">${escapeHtml(inv.customerEmail || '')} · ${stageNames[ev.data.stage] || '—'}</div>
        </div>
        <div style="font-size:13px;font-weight:700;color:var(--text);">${fmtCurrency(inv.amount)}</div>
        <div style="font-size:11px;color:var(--text-mute);min-width:60px;text-align:right;">${time}</div>
      </div>`;
    }
    if (ev.type === 'alert') {
      const inv = ev.data.invoice;
      const icon = ev.data.action === 'alert_check' ? '💵' : '🚨';
      const detail = ev.data.action === 'alert_check' ? (en ? 'Check tracking' : 'Tracking de cheque') : (en ? 'Collections alert' : 'Alerta de cobros');
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:#F0FDF4;border:1px solid #86EFAC;border-radius:var(--r-md);margin-bottom:8px;cursor:pointer;" onclick="window.openPaymentModal('${inv.id}')">
        <div style="font-size:18px;">${icon}</div>
        <div style="flex:1;">
          <div style="font-weight:600;font-size:13px;">#${escapeHtml(inv.invoiceNumber)} ${escapeHtml(inv.customerName)} · ✅</div>
          <div style="font-size:11px;color:var(--text-mute);">${detail} → ${escapeHtml(ev.data.recipientName || '')}</div>
        </div>
        <div style="font-size:13px;font-weight:700;color:#2E8B57;">${fmtCurrency(inv.amount)}</div>
        <div style="font-size:11px;color:var(--text-mute);min-width:60px;text-align:right;">${time}</div>
      </div>`;
    }
    if (ev.type === 'pending') {
      const inv = ev.data.invoice;
      const icon = ev.data.action === 'alert_check' ? '💵' : '🚨';
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:#FEF3C7;border:1px solid #FDE047;border-radius:var(--r-md);margin-bottom:8px;cursor:pointer;" onclick="window.openPaymentModal('${inv.id}')">
        <div style="font-size:18px;">${icon}⏰</div>
        <div style="flex:1;">
          <div style="font-weight:600;font-size:13px;color:#854D0E;">#${escapeHtml(inv.invoiceNumber)} ${escapeHtml(inv.customerName)} · ${en ? 'NOT CONFIRMED' : 'SIN CONFIRMAR'}</div>
          <div style="font-size:11px;color:#854D0E;">${en ? 'Generated but you did not confirm if you sent it' : 'Generado pero no confirmaste si lo enviaste'} — ${en ? 'click to confirm' : 'click para confirmar'}</div>
        </div>
        <div style="font-size:13px;font-weight:700;color:#854D0E;">${fmtCurrency(inv.amount)}</div>
        <div style="font-size:11px;color:#854D0E;min-width:60px;text-align:right;">${time}</div>
      </div>`;
    }
    return '';
  }).join('');
  
  list.innerHTML = `
    ${statsHtml}
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-soft);margin-bottom:8px;">${en ? 'Activity today (most recent first)' : 'Actividad de hoy (más reciente primero)'}</div>
    ${eventsHtml}`;
}

// ════════════════════════════════════════════════════════════
// UNCONFIRMED ALERTS BANNER — shows when there are alerts >24h old not confirmed
// ════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════
// PERSONAL KPI DASHBOARD — Nela's at-a-glance view of her collections.
// Six KPIs: collection rate this month, avg days to collect (90d window),
// total pending $, collected this week $, week-over-week delta, and the
// top 5 customers with the most outstanding balance.
// Colors: green = healthy, amber = attention needed, red = critical.
// ════════════════════════════════════════════════════════════
function _dashComputeKPIs() {
  const now = Date.now();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const sevenDaysAgo = now - 7 * 86400000;
  const fourteenDaysAgo = now - 14 * 86400000;
  const ninetyDaysAgo = now - 90 * 86400000;

  const invs = Array.isArray(allInvoices) ? allInvoices : [];

  // KPI 1 — Collection rate this month
  // Of invoices created in the current calendar month, what % are now paid?
  const createdThisMonth = invs.filter(i => (i.createdAt || 0) >= monthStart);
  const paidThisMonth = createdThisMonth.filter(i => deriveStatus(i) === 'paid');
  const collectionRate = createdThisMonth.length > 0
    ? Math.round((paidThisMonth.length / createdThisMonth.length) * 100)
    : null;

  // KPI 2 — Average days to collect (rolling 90 days of paid invoices)
  // Only counts invoices with both sentAt and paidAt — others are noise.
  const paidRecent = invs.filter(i =>
    deriveStatus(i) === 'paid' &&
    i.sentAt && i.paidAt &&
    i.paidAt >= ninetyDaysAgo
  );
  let avgDays = null;
  if (paidRecent.length > 0) {
    const totalDays = paidRecent.reduce(
      (sum, i) => sum + Math.max(0, (i.paidAt - i.sentAt) / 86400000), 0
    );
    avgDays = Math.round(totalDays / paidRecent.length);
  }

  // KPI 3 — Total pending ($) — every invoice not yet paid
  const pendingInvs = invs.filter(i => deriveStatus(i) !== 'paid');
  const totalPending = pendingInvs.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  // KPI 4 — Collected this week ($) — paidAt within last 7 days
  const collectedThisWeek = invs
    .filter(i => i.paidAt && i.paidAt >= sevenDaysAgo)
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);

  // KPI 5 — Week-over-week delta — last week = 8-14 days ago
  const collectedLastWeek = invs
    .filter(i => i.paidAt && i.paidAt >= fourteenDaysAgo && i.paidAt < sevenDaysAgo)
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);

  let weekDeltaPct = null;
  let weekDirection = 'flat';
  if (collectedLastWeek > 0) {
    weekDeltaPct = Math.round(((collectedThisWeek - collectedLastWeek) / collectedLastWeek) * 100);
    if (weekDeltaPct > 0) weekDirection = 'up';
    else if (weekDeltaPct < 0) weekDirection = 'down';
    else weekDirection = 'flat';
  } else if (collectedThisWeek > 0) {
    weekDirection = 'new'; // nothing last week to compare against
  } else {
    weekDirection = 'none'; // nothing either week
  }

  // KPI 6 — Top 5 customers with most pending
  const custMap = new Map();
  pendingInvs.forEach(i => {
    const name = (i.customerName || '').trim() || '(unknown)';
    if (!custMap.has(name)) custMap.set(name, { name, total: 0, count: 0 });
    const c = custMap.get(name);
    c.total += Number(i.amount) || 0;
    c.count++;
  });
  const topCustomers = Array.from(custMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // BONUS KPI — Paid but not yet entered in QB Desktop (backlog she should clear)
  const qbPendingInvs = invs.filter(i => deriveStatus(i) === 'paid' && !i.qbSynced);
  const qbPendingCount = qbPendingInvs.length;
  const qbPendingTotal = qbPendingInvs.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  return {
    collectionRate, createdCount: createdThisMonth.length, paidCount: paidThisMonth.length,
    avgDays, paidRecentCount: paidRecent.length,
    totalPending, pendingCount: pendingInvs.length,
    collectedThisWeek, collectedLastWeek, weekDeltaPct, weekDirection,
    topCustomers,
    qbPendingCount, qbPendingTotal
  };
}

function renderDashboardView() {
  const list = document.getElementById('invoiceList');
  const en = currentLang === 'en';
  const k = _dashComputeKPIs();

  // ─── KPI 1: Collection rate this month ───
  let rateClass = 'neutral';
  let rateValue = '—';
  let rateMeta = en ? 'No invoices created this month yet' : 'Sin facturas creadas este mes';
  if (k.collectionRate !== null) {
    rateValue = k.collectionRate + '%';
    rateMeta = en
      ? `${k.paidCount} of ${k.createdCount} invoice${k.createdCount !== 1 ? 's' : ''} paid`
      : `${k.paidCount} de ${k.createdCount} factura${k.createdCount !== 1 ? 's' : ''} pagadas`;
    if (k.collectionRate >= 70) rateClass = 'green';
    else if (k.collectionRate >= 50) rateClass = 'amber';
    else rateClass = 'red';
  }

  // ─── KPI 2: Average days to collect ───
  let daysClass = 'neutral';
  let daysValue = '—';
  let daysMeta = en ? 'No paid invoices in the last 90 days' : 'Sin pagos en los últimos 90 días';
  if (k.avgDays !== null) {
    daysValue = k.avgDays + (en ? ' days' : ' días');
    daysMeta = en
      ? `Average across ${k.paidRecentCount} paid invoice${k.paidRecentCount !== 1 ? 's' : ''} (90-day window)`
      : `Promedio de ${k.paidRecentCount} factura${k.paidRecentCount !== 1 ? 's' : ''} pagada${k.paidRecentCount !== 1 ? 's' : ''} (ventana 90 días)`;
    if (k.avgDays <= 14) daysClass = 'green';
    else if (k.avgDays <= 30) daysClass = 'amber';
    else daysClass = 'red';
  }

  // ─── KPI 3: Total pending $ ───
  const pendingClass = k.totalPending > 0 ? 'amber' : 'neutral';
  const pendingMeta = en
    ? `${k.pendingCount} open invoice${k.pendingCount !== 1 ? 's' : ''}`
    : `${k.pendingCount} factura${k.pendingCount !== 1 ? 's' : ''} abierta${k.pendingCount !== 1 ? 's' : ''}`;

  // ─── KPI 4 + 5: Collected this week + week-over-week delta ───
  const weekClass = k.collectedThisWeek > 0 ? 'green' : 'neutral';
  let deltaPill = '';
  let weekMeta;
  if (k.weekDirection === 'up') {
    deltaPill = `<span class="dash-delta up">▲ ${k.weekDeltaPct}%</span>`;
    weekMeta = en
      ? `vs ${fmtCurrency(k.collectedLastWeek)} last week`
      : `vs ${fmtCurrency(k.collectedLastWeek)} sem. anterior`;
  } else if (k.weekDirection === 'down') {
    deltaPill = `<span class="dash-delta down">▼ ${Math.abs(k.weekDeltaPct)}%</span>`;
    weekMeta = en
      ? `vs ${fmtCurrency(k.collectedLastWeek)} last week`
      : `vs ${fmtCurrency(k.collectedLastWeek)} sem. anterior`;
  } else if (k.weekDirection === 'flat') {
    deltaPill = `<span class="dash-delta flat">= 0%</span>`;
    weekMeta = en
      ? `Same as last week (${fmtCurrency(k.collectedLastWeek)})`
      : `Igual a sem. anterior (${fmtCurrency(k.collectedLastWeek)})`;
  } else if (k.weekDirection === 'new') {
    deltaPill = `<span class="dash-delta up">▲ ${en ? 'new' : 'nuevo'}</span>`;
    weekMeta = en ? 'Nothing was collected last week' : 'Nada cobrado la semana anterior';
  } else {
    weekMeta = en ? 'Nothing collected in the last 2 weeks' : 'Sin cobros en las últimas 2 semanas';
  }

  // ─── HEADER + CARDS ───
  let html = `
    <div class="dash-header">
      <h2>📊 ${en ? 'My Dashboard' : 'Mi Dashboard'}</h2>
      <p>${en ? 'Personal collection KPIs · updates in real time' : 'KPIs personales de cobranza · tiempo real'}</p>
    </div>
    <div class="dash-grid">
      <div class="dash-card ${rateClass}">
        <div class="dash-label"><span>${en ? 'Collection rate · this month' : 'Tasa de cobro · este mes'}</span></div>
        <div class="dash-value">${rateValue}</div>
        <div class="dash-meta">${rateMeta}</div>
      </div>
      <div class="dash-card ${daysClass}">
        <div class="dash-label"><span>${en ? 'Avg days to collect' : 'Días promedio para cobrar'}</span></div>
        <div class="dash-value">${daysValue}</div>
        <div class="dash-meta">${daysMeta}</div>
      </div>
      <div class="dash-card ${pendingClass}">
        <div class="dash-label"><span>${en ? 'Total pending' : 'Total pendiente'}</span></div>
        <div class="dash-value">${fmtCurrency(k.totalPending)}</div>
        <div class="dash-meta">${pendingMeta}</div>
      </div>
      <div class="dash-card ${weekClass}">
        <div class="dash-label"><span>${en ? 'Collected this week' : 'Cobrado esta semana'}</span>${deltaPill}</div>
        <div class="dash-value">${fmtCurrency(k.collectedThisWeek)}</div>
        <div class="dash-meta">${weekMeta}</div>
      </div>
      <div class="dash-card ${k.qbPendingCount > 0 ? 'amber' : 'green'}" onclick="window.jumpToFilter('qb_pending')" style="cursor:pointer;" title="${en ? 'Click to see the QB Pending tab' : 'Click para ver la pestaña QB Pending'}">
        <div class="dash-label"><span>${en ? 'QB Pending (paid · not in QB yet)' : 'QB Pendiente (pagadas · falta entrar en QB)'}</span></div>
        <div class="dash-value">${k.qbPendingCount}</div>
        <div class="dash-meta">${k.qbPendingCount > 0
          ? (en ? `${fmtCurrency(k.qbPendingTotal)} · enter in QuickBooks Desktop` : `${fmtCurrency(k.qbPendingTotal)} · entrar en QuickBooks Desktop`)
          : (en ? '✓ All paid invoices recorded in QB' : '✓ Todas las pagadas registradas en QB')}</div>
      </div>
    </div>
    <div class="dash-section-title">🏆 ${en ? 'Top 5 customers · most outstanding' : 'Top 5 clientes · más pendiente'}</div>
  `;

  // ─── TOP 5 CUSTOMERS LIST ───
  if (k.topCustomers.length === 0) {
    html += `<div class="dash-empty">🎉 ${en ? 'No outstanding balances — all caught up!' : 'Sin saldos pendientes — todo al día!'}</div>`;
  } else {
    html += `<div class="dash-top-list">`;
    k.topCustomers.forEach((c, idx) => {
      // Escape for HTML attribute + JS string literal (same pattern as renderProblemView)
      const safeName = escapeHtml(c.name).replace(/'/g, "\\'");
      const countLabel = en
        ? `${c.count} open invoice${c.count !== 1 ? 's' : ''}`
        : `${c.count} factura${c.count !== 1 ? 's' : ''} abierta${c.count !== 1 ? 's' : ''}`;
      html += `
        <div class="dash-top-row" onclick="window.openCustomerDetail('${safeName}')">
          <div class="dash-top-rank">${idx + 1}</div>
          <div class="dash-top-info">
            <div class="dash-top-name">${escapeHtml(c.name)}</div>
            <div class="dash-top-meta">${countLabel}</div>
          </div>
          <div class="dash-top-amount">${fmtCurrency(c.total)}</div>
        </div>
      `;
    });
    html += `</div>`;
  }

  list.innerHTML = html;
}

// ════════════════════════════════════════════════════════════
// TECHS PERFORMANCE DASHBOARD — per-technician stats
// ════════════════════════════════════════════════════════════
function renderTechsView() {
  const list = document.getElementById('invoiceList');
  const en = currentLang === 'en';
  
  // Aggregate stats per tech
  const techMap = new Map();
  allInvoices.forEach(inv => {
    const tech = (inv.technician || (en ? '(no tech)' : '(sin técnico)')).trim();
    if (!techMap.has(tech)) techMap.set(tech, {
      tech, count: 0, totalInvoiced: 0, totalCollected: 0, totalPending: 0,
      ccIssues: 0, fastestPaid: Infinity, avgDaysToPay: 0, daysSum: 0, paidCount: 0
    });
    const t = techMap.get(tech);
    const amt = inv.amount || 0;
    const status = deriveStatus(inv);
    t.count++;
    t.totalInvoiced += amt;
    if (status === 'paid') {
      t.totalCollected += amt;
      if (inv.sentAt && inv.paidAt) {
        const days = Math.max(0, (inv.paidAt - inv.sentAt) / 86400000);
        t.daysSum += days;
        t.paidCount++;
        if (days < t.fastestPaid) t.fastestPaid = days;
      }
    } else if (status !== 'pending') {
      t.totalPending += amt;
    }
    if (inv.paymentReason && status !== 'paid') t.ccIssues++;
  });
  
  techMap.forEach(t => {
    if (t.paidCount > 0) t.avgDaysToPay = Math.round(t.daysSum / t.paidCount);
  });
  
  const techs = Array.from(techMap.values()).sort((a, b) => b.totalInvoiced - a.totalInvoiced);
  
  if (techs.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">👷</div><div class="empty-title">${en ? 'No technicians yet' : 'Sin técnicos aún'}</div></div>`;
    return;
  }
  
  // Render leaderboard
  const maxInvoiced = Math.max(...techs.map(t => t.totalInvoiced), 1);
  let html = `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-soft);margin-bottom:12px;">${en ? 'Tech Leaderboard — sorted by revenue' : 'Leaderboard de Técnicos — ordenado por revenue'}</div>`;
  
  techs.forEach((t, i) => {
    const collectionRate = t.totalInvoiced > 0 ? Math.round((t.totalCollected / t.totalInvoiced) * 100) : 0;
    const barPct = (t.totalInvoiced / maxInvoiced) * 100;
    const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `#${i + 1}`));
    
    html += `<div style="background:white;border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="font-size:20px;">${medal}</span>
        <div style="flex:1;">
          <div style="font-size:15px;font-weight:700;color:var(--text);">👷 ${escapeHtml(t.tech)}</div>
          <div style="font-size:11px;color:var(--text-mute);">${t.count} ${en ? (t.count === 1 ? 'service' : 'services') : (t.count === 1 ? 'servicio' : 'servicios')}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:18px;font-weight:800;font-family:'SF Mono',ui-monospace,monospace;color:var(--text);">${fmtCurrency(t.totalInvoiced)}</div>
          <div style="font-size:11px;color:var(--text-mute);">${en ? 'invoiced total' : 'facturado total'}</div>
        </div>
      </div>
      <div style="height:6px;background:#F1F5F9;border-radius:3px;overflow:hidden;margin-bottom:10px;">
        <div style="height:100%;width:${barPct}%;background:linear-gradient(90deg,#2E8B57,#2E8B57);border-radius:3px;"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:11px;">
        <div style="background:#DCFCE7;padding:6px 10px;border-radius:6px;">
          <div style="color:#2E8B57;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:0.06em;">${en ? 'Collected' : 'Cobrado'}</div>
          <div style="font-size:13px;font-weight:700;color:#134A63;">${fmtCurrency(t.totalCollected)}</div>
          <div style="font-size:11px;color:#2E8B57;">${collectionRate}% ${en ? 'rate' : 'tasa'}</div>
        </div>
        <div style="background:#FEF9C3;padding:6px 10px;border-radius:6px;">
          <div style="color:#854D0E;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:0.06em;">${en ? 'Pending' : 'Pendiente'}</div>
          <div style="font-size:13px;font-weight:700;color:#134A63;">${fmtCurrency(t.totalPending)}</div>
        </div>
        <div style="background:${t.ccIssues > 0 ? '#FEE2E2' : '#F1F5F9'};padding:6px 10px;border-radius:6px;">
          <div style="color:${t.ccIssues > 0 ? '#991B1B' : '#475569'};font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:0.06em;">${en ? 'CC Issues' : 'Alertas CC'}</div>
          <div style="font-size:13px;font-weight:700;color:#134A63;">${t.ccIssues}</div>
        </div>
        <div style="background:#DBEAFE;padding:6px 10px;border-radius:6px;">
          <div style="color:#1E40AF;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:0.06em;">${en ? 'Avg pay' : 'Pago prom'}</div>
          <div style="font-size:13px;font-weight:700;color:#134A63;">${t.paidCount > 0 ? t.avgDaysToPay + 'd' : '—'}</div>
        </div>
      </div>
    </div>`;
  });
  
  list.innerHTML = html;
}

// ════════════════════════════════════════════════════════════
// TODAY'S REVENUE + 7-DAY MINI CHART
// ════════════════════════════════════════════════════════════
function renderTodayRevenue() {
  const card = document.getElementById('todayRevenueCard');
  if (!card) return;
  
  // Calculate revenue per day for last 7 days (using createdAt)
  const dayBuckets = []; // [{ label, total, count, ts }]
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const start = d.getTime();
    const end = start + 86400000;
    let total = 0, count = 0;
    allInvoices.forEach(inv => {
      const created = inv.createdAt || 0;
      if (created >= start && created < end) {
        total += (inv.amount || 0);
        count++;
      }
    });
    dayBuckets.push({ start, total, count, label: d.toLocaleDateString('en-US', { weekday: 'short' }) });
  }
  
  const today = dayBuckets[6];
  const yesterday = dayBuckets[5];
  const todayTotal = today.total;
  const yesterdayTotal = yesterday.total;
  
  // Show card only if there's any activity in last 7 days
  const anyActivity = dayBuckets.some(d => d.count > 0);
  if (!anyActivity) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';
  
  document.getElementById('todayRevAmount').textContent = fmtCurrency(todayTotal);
  document.getElementById('todayRevCount').textContent = `${today.count} ${currentLang === 'en' ? (today.count === 1 ? 'invoice' : 'invoices') : (today.count === 1 ? 'factura' : 'facturas')}`;
  document.getElementById('yesterdayRevAmount').textContent = fmtCurrency(yesterdayTotal);
  document.getElementById('yesterdayRevCount').textContent = `${yesterday.count} ${currentLang === 'en' ? (yesterday.count === 1 ? 'invoice' : 'invoices') : (yesterday.count === 1 ? 'factura' : 'facturas')}`;
  
  // Delta vs yesterday
  const deltaEl = document.getElementById('todayRevDelta');
  if (yesterdayTotal > 0) {
    const pct = Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100);
    if (pct > 0) {
      deltaEl.textContent = `↑ +${pct}%`;
      deltaEl.style.color = '#86EFAC';
    } else if (pct < 0) {
      deltaEl.textContent = `↓ ${pct}%`;
      deltaEl.style.color = '#FCA5A5';
    } else {
      deltaEl.textContent = `= ${pct}%`;
      deltaEl.style.color = '#CBD5E1';
    }
  } else if (todayTotal > 0) {
    deltaEl.textContent = currentLang === 'en' ? '↑ NEW' : '↑ NUEVO';
    deltaEl.style.color = '#86EFAC';
  } else {
    deltaEl.textContent = '';
  }
  
  // 7-day mini bar chart
  const chart = document.getElementById('weeklyMiniChart');
  const maxDay = Math.max(...dayBuckets.map(d => d.total), 1);
  chart.innerHTML = dayBuckets.map((d, i) => {
    const heightPct = Math.max((d.total / maxDay) * 100, 2);
    const isToday = i === 6;
    const bg = isToday ? '#2E8B57' : (d.total > 0 ? '#94A3B8' : '#475569');
    const tooltip = `${d.label}: ${fmtCurrency(d.total)} (${d.count})`;
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;" title="${escapeHtml(tooltip)}">
      <div style="width:100%;height:32px;display:flex;align-items:flex-end;">
        <div style="width:100%;height:${heightPct}%;background:${bg};border-radius:3px 3px 0 0;${isToday ? 'box-shadow:0 -2px 8px rgba(34,197,94,0.4);' : ''}"></div>
      </div>
      <div style="font-size:11px;font-weight:600;color:${isToday ? '#86EFAC' : '#94A3B8'};text-transform:uppercase;letter-spacing:0.04em;">${d.label.slice(0, 3)}</div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════════
// UNCONFIRMED ALERTS BANNER — shows when there are alerts >24h old not confirmed
// ════════════════════════════════════════════════════════════
function updateUnconfirmedBanner() {
  const banner = document.getElementById('unconfirmedBanner');
  if (!banner) return;
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);
  let unconfirmedCount = 0;
  allInvoices.forEach(inv => {
    (inv.history || []).forEach(h => {
      if ((h.action === 'alert_collections' || h.action === 'alert_check') && !h.confirmed && h.ts < cutoff) {
        unconfirmedCount++;
      }
    });
  });
  if (unconfirmedCount === 0) {
    banner.style.display = 'none';
    return;
  }
  banner.style.display = 'flex';
  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:20px;">⏰</span>
      <span>${escapeHtml(t('unconfirmed.banner', unconfirmedCount))}</span>
    </div>
    <button class="btn btn-sm" style="background:#CA8A04;color:white;border:0;padding:6px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px;" onclick="window.viewUnconfirmed()">${escapeHtml(t('unconfirmed.review'))} →</button>`;
}

window.viewUnconfirmed = function() {
  currentFilter = 'unconfirmed';
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  computeAndRender();
  // Scroll to invoice list so user sees the filtered results
  const list = document.getElementById('invoiceList');
  if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
// ════════════════════════════════════════════════════════════
// Generates a CSV in QuickBooks Receive Payment import format.
// Headers compatible with QB import wizard:
//   Customer, Invoice #, Amount, Date, Payment Method, Reference No, Memo
// ════════════════════════════════════════════════════════════
// BULK SEND MODE — generate multiple .eml at once
// ════════════════════════════════════════════════════════════
let bulkMode = false;
let bulkSelectedIds = new Set();

window.toggleBulkMode = function() {
  bulkMode = !bulkMode;
  bulkSelectedIds.clear();
  const btn = document.getElementById('bulkToggleBtn');
  if (btn) {
    btn.textContent = bulkMode 
      ? (currentLang === 'en' ? '✕ Exit bulk' : '✕ Salir bulk') 
      : (currentLang === 'en' ? '📦 Bulk send' : '📦 Bulk send');
    btn.style.background = bulkMode ? '#0284C7' : '';
    btn.style.color = bulkMode ? 'white' : '';
  }
  computeAndRender();
  let bar = document.getElementById('bulkActionBar');
  if (bulkMode) {
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'bulkActionBar';
      bar.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#134A63;color:white;padding:14px 20px;border-radius:14px;display:flex;align-items:center;gap:14px;z-index:999;box-shadow:0 12px 40px rgba(0,0,0,0.35);';
      document.body.appendChild(bar);
    }
    updateBulkBar();
  } else {
    if (bar) bar.remove();
  }
};

window.toggleBulkSelect = function(id) {
  if (bulkSelectedIds.has(id)) bulkSelectedIds.delete(id);
  else bulkSelectedIds.add(id);
  updateBulkBar();
};

function updateBulkBar() {
  const bar = document.getElementById('bulkActionBar');
  if (!bar) return;
  const count = bulkSelectedIds.size;
  const en = currentLang === 'en';
  bar.innerHTML = `
    <div style="font-size:14px;font-weight:600;">${count} ${en ? 'selected' : 'seleccionadas'}</div>
    <button onclick="bulkGenerateEml()" ${count === 0 ? 'disabled' : ''} style="background:#2E8B57;color:white;border:0;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:${count === 0 ? 'not-allowed' : 'pointer'};opacity:${count === 0 ? '0.5' : '1'};">📎 ${en ? 'Generate ' : 'Generar '}${count} .eml</button>
    <button onclick="toggleBulkMode()" style="background:#475569;color:white;border:0;padding:10px 14px;border-radius:8px;font-size:13px;cursor:pointer;">${en ? 'Cancel' : 'Cancelar'}</button>`;
}

/* v2.61.0 — EL LOTE AHORA DEJA RASTRO.
   Antes generaba y descargaba y nada mas: no escribia historial, no marcaba
   sentAt y no avanzaba la etapa. La tarjeta seguia diciendo "No outreach
   recorded" y, como la etapa nunca subia, al cliente le llegaba LA MISMA carta
   cordial de primer aviso semana tras semana.
   El envio individual pregunta despues "¿le diste Send en Outlook?" y solo
   entonces registra. Para un lote no se pueden abrir N modales, asi que se
   pregunta UNA vez al final — y si la respuesta es "todavia no", se registra el
   INTENTO (sin sentAt, sin subir de etapa) en vez de mentir diciendo enviado. */
window.bulkGenerateEml = function() {
  if (bulkSelectedIds.size === 0) return;
  const en = currentLang === 'en';
  const ids = Array.from(bulkSelectedIds);
  if (!confirm(en
    ? `Generate ${ids.length} .eml files?\n\nThey download to your Downloads folder. Chrome asks permission the first time several files download at once — allow it, or only the first one arrives.`
    : `¿Generar ${ids.length} archivos .eml?\n\nSe descargan a Downloads. Chrome pide permiso la primera vez que bajan varios archivos juntos — aceptalo, o solo llega el primero.`)) return;

  const hechos = [];
  let i = 0;
  const interval = setInterval(() => {
    if (i >= ids.length) {
      clearInterval(interval);
      bulkSelectedIds.clear();
      toggleBulkMode();
      if (hechos.length) {
        window.askConfirmBulkSend(hechos);
      } else {
        toast(en ? 'No file could be generated' : 'No se pudo generar ningún archivo', 'error');
      }
      return;
    }
    const inv = allInvoices.find(x => x.id === ids[i]);
    if (inv) {
      const stage = suggestEmailStage(inv);
      const pdfBase64 = inv.pdfBase64 || null;
      const pdfFilename = inv.pdfFilename || `Invoice_${inv.invoiceNumber}.pdf`;
      const emlContent = buildEmlFile(inv, pdfBase64, pdfFilename, stage);
      const blob = new Blob([emlContent], { type: 'message/rfc822' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stageSuffix = stage === 1 ? '' : (stage === 2 ? '_reminder' : (stage === 3 ? '_pastdue' : '_receipt'));
      a.download = `Invoice_${inv.invoiceNumber}_for_${(inv.customerName || 'customer').replace(/[^a-zA-Z0-9]/g, '_')}${stageSuffix}.eml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      hechos.push({ id: inv.id, stage: stage, name: inv.customerName || '', num: inv.invoiceNumber || '' });
    }
    i++;
  }, 400);
};

/* v2.61.0 — una sola pregunta para todo el lote. */
window.askConfirmBulkSend = function(hechos) {
  const en = currentLang === 'en';
  const lista = hechos.slice(0, 8).map(h => '#' + escapeHtml(String(h.num)) + ' · ' + escapeHtml(h.name)).join('<br>')
    + (hechos.length > 8 ? '<br>' + (en ? `…and ${hechos.length - 8} more` : `…y ${hechos.length - 8} más`) : '');
  const ov = document.createElement('div');
  ov.id = 'confirmBulkOverlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML = `
    <div style="background:white;border-radius:16px;max-width:460px;width:100%;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.3)">
      <div style="font-size:36px;text-align:center;margin-bottom:8px">📦</div>
      <h3 style="margin:0 0 12px;text-align:center;font-size:18px;color:#134A63">${en ? `${hechos.length} emails generated` : `${hechos.length} emails generados`}</h3>
      <div style="font-size:13px;color:#475569;background:#F1F5F9;border-radius:8px;padding:10px 12px;margin-bottom:16px;max-height:150px;overflow:auto;line-height:1.6">${lista}</div>
      <p style="margin:0 0 18px;text-align:center;font-size:14px;color:#475569;line-height:1.5">
        ${en ? 'In Outlook, did you click <strong>Send</strong> on all of them?' : 'En Outlook, ¿le diste <strong>Send</strong> a todos?'}
      </p>
      <div style="display:flex;gap:8px;flex-direction:column">
        <button onclick="window.confirmBulkSendYes()" style="background:#2E8B57;color:#fff;border:0;padding:12px 16px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">
          ✅ ${en ? 'Yes — mark all as sent' : 'Sí — marcar todas como enviadas'}
        </button>
        <button onclick="window.confirmBulkSendNo()" style="background:#F1F5F9;color:#475569;border:0;padding:12px 16px;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer">
          ⏰ ${en ? "Not yet — just record the attempt" : 'Todavía no — registrar solo el intento'}
        </button>
      </div>
      <p style="font-size:11px;color:#94A3B8;text-align:center;margin:14px 0 0;font-style:italic">
        ${en ? 'If some file did not download, select those cases again.' : 'Si algún archivo no bajó, volvé a seleccionar esos casos.'}
      </p>
    </div>`;
  ov._hechos = hechos;
  document.body.appendChild(ov);
};

async function _bulkRecord(confirmado) {
  const ov = document.getElementById('confirmBulkOverlay');
  const hechos = (ov && ov._hechos) || [];
  if (ov) ov.remove();
  const en = currentLang === 'en';
  let ok = 0;
  for (const h of hechos) {
    try {
      const inv = allInvoices.find(x => x.id === h.id);
      if (!inv) continue;
      const now = Date.now();
      if (confirmado) {
        const history = [...(inv.history || []), { ts: now, action: 'sent', stage: h.stage, confirmed: true, bulk: true }];
        const updates = inv.status === 'paid'
          ? { history, lastEmailStage: h.stage }
          : { status: 'sent', sentAt: now, history, lastEmailStage: h.stage };
        await updateInvoiceData(h.id, updates);
      } else {
        /* Se registra el intento y NADA MAS: sin sentAt y sin subir de etapa,
           porque nadie confirmo que el email saliera. */
        const history = [...(inv.history || []), { ts: now, action: 'eml_generated', stage: h.stage, confirmed: false, bulk: true }];
        await updateInvoiceData(h.id, { history });
      }
      ok++;
    } catch (e) { console.warn('[bulk] no se pudo registrar', h.id, e); }
  }
  const falta = hechos.length - ok;
  toast(confirmado
    ? (en ? `✓ ${ok} marked as sent` : `✓ ${ok} marcadas como enviadas`)
    : (en ? `${ok} attempts recorded — not marked as sent` : `${ok} intentos registrados — no se marcaron como enviadas`),
    falta ? 'warn' : 'success');
  if (falta) toast(en ? `${falta} could not be recorded — check the connection` : `${falta} no se pudieron registrar — revisá la conexión`, 'error');
}
window.confirmBulkSendYes = () => _bulkRecord(true);
window.confirmBulkSendNo  = () => _bulkRecord(false);

// ════════════════════════════════════════════════════════════
// WEEKLY REPORT — Multi-section CSV for Tom & Sam
// Opens in Excel; includes summary, by-tech, and pending lists
// ════════════════════════════════════════════════════════════
window.exportWeeklyReport = function() {
  const en = currentLang === 'en';
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  
  const weekInvoices = allInvoices.filter(i => (i.createdAt || 0) >= weekStart.getTime());
  
  let csv = `${en ? 'Aspen Spas — Weekly Report' : 'Aspen Spas — Reporte Semanal'}\r\n`;
  csv += `${en ? 'Period' : 'Período'}: ${weekStart.toLocaleDateString()} - ${now.toLocaleDateString()}\r\n`;
  csv += `${en ? 'Generated' : 'Generado'}: ${now.toLocaleString()}\r\n\r\n`;
  
  const totalInvoiced = weekInvoices.reduce((s, i) => s + (i.amount || 0), 0);
  const totalPaid = weekInvoices.filter(i => deriveStatus(i) === 'paid').reduce((s, i) => s + (i.amount || 0), 0);
  const totalPending = totalInvoiced - totalPaid;
  const ccIssues = weekInvoices.filter(i => i.paymentReason && deriveStatus(i) !== 'paid').length;
  
  csv += `=== ${en ? 'SUMMARY' : 'RESUMEN'} ===\r\n`;
  csv += `${en ? 'Metric' : 'Métrica'},${en ? 'Value' : 'Valor'}\r\n`;
  csv += `${en ? 'Total invoices' : 'Total facturas'},${weekInvoices.length}\r\n`;
  csv += `${en ? 'Total invoiced' : 'Total facturado'},$${totalInvoiced.toFixed(2)}\r\n`;
  csv += `${en ? 'Total collected' : 'Total cobrado'},$${totalPaid.toFixed(2)}\r\n`;
  csv += `${en ? 'Total pending' : 'Total pendiente'},$${totalPending.toFixed(2)}\r\n`;
  csv += `${en ? 'Collection rate' : 'Tasa cobranza'},${totalInvoiced > 0 ? Math.round(totalPaid / totalInvoiced * 100) : 0}%\r\n`;
  csv += `${en ? 'CC issues' : 'Alertas CC'},${ccIssues}\r\n\r\n`;
  
  csv += `=== ${en ? 'BY TECHNICIAN' : 'POR TÉCNICO'} ===\r\n`;
  csv += `${en ? 'Tech' : 'Técnico'},${en ? '#Invoices' : '#Facturas'},${en ? 'Invoiced' : 'Facturado'},${en ? 'Collected' : 'Cobrado'},${en ? 'Pending' : 'Pendiente'},${en ? 'CC issues' : 'Alertas CC'}\r\n`;
  const techMap = new Map();
  weekInvoices.forEach(inv => {
    const tech = inv.technician || (en ? '(none)' : '(ninguno)');
    if (!techMap.has(tech)) techMap.set(tech, { count: 0, invoiced: 0, paid: 0, pending: 0, cc: 0 });
    const t = techMap.get(tech);
    t.count++;
    t.invoiced += inv.amount || 0;
    if (deriveStatus(inv) === 'paid') t.paid += inv.amount || 0;
    else t.pending += inv.amount || 0;
    if (inv.paymentReason && deriveStatus(inv) !== 'paid') t.cc++;
  });
  Array.from(techMap.entries()).sort((a, b) => b[1].invoiced - a[1].invoiced).forEach(([tech, t]) => {
    csv += `${tech},${t.count},$${t.invoiced.toFixed(2)},$${t.paid.toFixed(2)},$${t.pending.toFixed(2)},${t.cc}\r\n`;
  });
  csv += '\r\n';
  
  csv += `=== ${en ? 'PENDING / NEEDS ATTENTION' : 'PENDIENTES / ATENCIÓN'} ===\r\n`;
  csv += `${en ? 'Invoice' : 'Factura'},${en ? 'Customer' : 'Cliente'},${en ? 'Amount' : 'Monto'},${en ? 'Status' : 'Estado'},${en ? 'Tech' : 'Técnico'},${en ? 'Service Date' : 'Fecha'},${en ? 'Reason' : 'Razón'}\r\n`;
  weekInvoices.filter(i => deriveStatus(i) !== 'paid').sort((a, b) => (b.amount || 0) - (a.amount || 0)).forEach(inv => {
    const reason = inv.paymentReason ? paymentReasonLabel(inv.paymentReason).replace(/[^\w\s]/g, '').trim() : '';
    csv += `${inv.invoiceNumber},"${(inv.customerName || '').replace(/"/g, '""')}",$${(inv.amount || 0).toFixed(2)},${deriveStatus(inv)},${inv.technician || ''},${inv.serviceDate || ''},${reason}\r\n`;
  });
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Aspen_Weekly_Report_${weekStart.toISOString().slice(0, 10)}_to_${now.toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  
  toast(en ? '📑 Weekly report downloaded — open in Excel' : '📑 Reporte semanal descargado — abre en Excel', 'success');
};

window.exportQbCsv = function() {
  const paid = allInvoices.filter(i => deriveStatus(i) === 'paid' && i.paymentMethod);
  if (paid.length === 0) {
    toast(t('toast.qbNoPayments'), 'error');
    return;
  }
  const fmtQbDate = (ts) => {
    const d = new Date(ts);
    return `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}/${d.getFullYear()}`;
  };
  const qbMethodMap = {
    check: 'Check', cash: 'Cash', paytrace: 'Credit Card', credit_card: 'Credit Card', auth_net: 'Credit Card', ipospays: 'Credit Card', ach: 'ACH',
    zelle: 'Zelle', venmo: 'Venmo', square: 'Credit Card', other: 'Other'
  };
  const headers = ['Customer', 'Invoice #', 'Amount', 'Date', 'Payment Method', 'Reference No', 'Memo'];
  const rows = paid.map(i => [
    i.customerName,
    i.invoiceNumber,
    Number(i.amount).toFixed(2),
    fmtQbDate(i.paidAt || i.sentAt || i.createdAt),
    qbMethodMap[i.paymentMethod] || 'Other',
    i.paymentRef || '',
    i.paymentNote || ''
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const today = new Date();
  a.download = `qb_payments_${today.toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(t('toast.qbExported', paid.length), 'success');
};

// ════════════════════════════════════════════════════════════
// EXPORT CSV
// ════════════════════════════════════════════════════════════
window.exportCSV = function() {
  if (allInvoices.length === 0) {
    toast('No hay facturas para exportar', 'error');
    return;
  }
  const headers = ['Invoice #', 'Customer', 'Email', 'Amount', 'Status', 'Service Date', 'Technician', 'Created', 'Sent', 'Paid'];
  const rows = allInvoices.map(i => {
    const s = deriveStatus(i);
    return [
      i.invoiceNumber, i.customerName, i.customerEmail, i.amount,
      statusLabel(s), i.serviceDate || '', i.technician || '',
      i.createdAt ? new Date(i.createdAt).toLocaleDateString() : '',
      i.sentAt ? new Date(i.sentAt).toLocaleDateString() : '',
      i.paidAt ? new Date(i.paidAt).toLocaleDateString() : ''
    ];
  });
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aspen-invoices-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV exportado', 'success');
};

// ════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ════════════════════════════════════════════════════════════
let toastTimer;
function _hoyLocal(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
// v2.64.0: one toast for the whole app — the tracker's messages now use the app's toast (same look, position and safe-area on iPhone)
function toast(msg, type = '') {
  if(typeof window.toast==='function'){ window.toast(msg, type==='error'?'err':(type==='warn'||type==='warning')?'warn':''); return; }
  const t = document.getElementById('itkToast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ════════════════════════════════════════════════════════════
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    computeAndRender();
  });
});

document.getElementById('searchInput').addEventListener('input', (e) => {
  searchTerm = e.target.value;
  computeAndRender();
});

document.querySelectorAll('.modal-backdrop').forEach(m => {
  m.addEventListener('click', (e) => {
    if (e.target === m) m.classList.remove('open');
  });
});

document.getElementById('fCustomerName').addEventListener('blur', (e) => {
  const greetingField = document.getElementById('fGreetingName');
  if (!greetingField.value) {
    greetingField.placeholder = 'Auto: ' + (deriveGreetingName(e.target.value) || '—');
  }
});

// Clear validation error highlight as soon as user types in a required field
['fInvoiceNumber', 'fAmount', 'fCustomerName', 'fCustomerEmail'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', () => {
      el.classList.remove('field-err');
      const errEl = document.getElementById('formErrorMsg');
      if (errEl) errEl.style.display = 'none';
    });
  }
});

// ════════════════════════════════════════════════════════════
// START
// ════════════════════════════════════════════════════════════
applyI18n();  // Apply current language to all data-i18n elements
initFirebase();
wirePaymentReasonRadios();
updateUserPickerButton();  // Show current user (Alberto/Nela/Celia) or red "set me" state
startCrossAppResolvePolling();  // Listen for TECH-TICKETS resolves and reflect them locally
startAutoEscalation();  // Background check every 5 min for alerts open > 24h
// Update inbox badge after invoices load (initFirebase loads asynchronously, so refresh once data is in)
setTimeout(() => { try { updateCrossAppInboxBadge(); } catch(_e){} }, 2500);
window.itkToast = toast;   /* renombrado: TECH-TICKETS ya tiene su propio toast global */

// Restart notif checker if it was previously enabled
if (localStorage.getItem('aspenNotifEnabled') === '1' && 'Notification' in window && Notification.permission === 'granted') {
  // Register SW first, then start checker — order matters so background notifs work
  registerNotifSW().then(() => {
    startNotifChecker();
  });
}
updateNotifButton();

// ═══ ASPEN OPS — water ripple on button clicks ═══
document.addEventListener('click', function(e){
  const host = e.target.closest('button, .btn, [role=button]');
  if(!host) return;
  /* v2.45.2 — el ripple es del Invoice Tracker y su CSS vive bajo #pg15
     (bloque itkStyles). Al portarlo, el escuchador quedo colgado de document.
     Fuera de pg15 el span no recibe NINGUN estilo: no es position:absolute, y
     dentro de un boton inline-flex se vuelve un hijo flex que ocupa sitio real
     (Save Changes pasaba de 162 a 526 px durante 0,75 s). Delimitarlo aqui
     restaura la intencion original y de paso corta el getComputedStyle y los
     estilos inline residuales en cada clic del resto de la app.
     Quitar esta linea devuelve el comportamiento de 2.45.1. */
  if(!host.closest('#pg15')) return;
  const cs = getComputedStyle(host);
  if(cs.position === 'static') host.style.position = 'relative';
  if(cs.overflow !== 'hidden') host.style.overflow = 'hidden';
  try{
    const rect = host.getBoundingClientRect();
    const wave = document.createElement('span');
    wave.className = 'ops-ripple-wave';
    const size = Math.max(rect.width, rect.height) * 2.2;
    wave.style.width = wave.style.height = size + 'px';
    wave.style.left = (e.clientX - rect.left) + 'px';
    wave.style.top  = (e.clientY - rect.top) + 'px';
    host.appendChild(wave);
    setTimeout(()=>wave.remove(), 750);
  }catch(err){}
}, {passive:true});

/* ══════════════════════════════════════════════════════════════════════
   PUENTE CON TECH-TICKETS  (añadido al portar, v2.25.0)
   Este módulo ya abrió su propia conexión al RTDB de facturas, así que
   AspenInv apunta a ESA. Antes había una segunda conexión aparte: se
   eliminó para no tener dos apps Firebase ni dos sesiones anónimas
   contra el mismo proyecto.
   ══════════════════════════════════════════════════════════════════════ */
window.AspenInv = {
  db, ref, get, set, update, push, remove, onValue,
  paths: { inv:'invoiceTracker/invoices', cust:'invoiceTracker/customers', rec:'invoiceTracker/meta/lastReconcile' },
  async ping(){
    try{
      const s = await get(ref(db,'invoiceTracker/invoices'));
      const c = await get(ref(db,'invoiceTracker/customers'));
      return { ok:true, facturas:Object.keys(s.val()||{}).length, clientes:Object.keys(c.val()||{}).length };
    }catch(e){ return { ok:false, error:(e&&e.code||'')+' '+(e&&e.message||e) }; }
  }
};

/* TECH-TICKETS llama esto al abrir la pestaña Invoices (showTab(15)).
   El módulo ya pinta solo al cargar; esto es un repintado por si los
   datos cambiaron mientras la pestaña estaba oculta. */
window.itkOnEnter = function(){
  try{ if(typeof computeAndRender==='function') computeAndRender(); }catch(e){ console.warn('[Invoices]',e); }
};
console.log('[Invoices] Invoice Tracker portado ✓');
