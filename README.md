# PCT Inventarios e Inspección — Documentación del Sistema

## Visión general
Aplicación web ligera para capturar, evaluar y almacenar inspecciones de equipo (Codo, Tubería 1, Tubería 2). Funciona 100% en navegador, con opción de sincronizar en Firestore cuando se provee configuración.

## Características clave
- Registro de inspecciones con interfaz rápida y accesible.
- Columna única de datos: tabla simplificada a `#` y `Parámetro` (sin columnas duplicadas por producto).
- Selector de producto con estilo tipo badge (Codo, Tubería 1, Tubería 2).
- Componentes “badge” interactivos de selección única (Bueno/Malo/etc.) con soporte teclado/touch.
- Campo de detalle automático cuando se elige `Malo`.
- Entradas con unidad (cm, °) en “pills” para parámetros numéricos.
- Autoevaluación de la inspección: Aceptado/Rechazado según los parámetros seleccionados.
- Fecha/Hora automática al guardar.
- Geolocalización al guardar (permiso del dispositivo); guarda lat/lng/accuracy.
- Persistencia local (localStorage) y exportación de JSON.
- Integración opcional con Firestore (crea documentos con metadatos).
- UI responsiva para móviles y escritorio.

## Estructura del proyecto
- `index.html`: portada simple.
- `primaria.html`: captura de inspección primaria (principal).
- `ejmprueba.html`: render de inventario desde TSV a tabla HTML.
- `styles.css`: estilo base (tema claro, responsivo).
- `script.js`: lógica de UI, guardado local, exportación, reglas de validación y autoevaluación.
- `firebase-init.js`: inicialización Firebase + guardado en Firestore.
- `firebase-config.sample.js`: plantilla para exponer `window.firebaseConfig`.
- `firestore.rules`: reglas de seguridad (borrador).

## Flujo de trabajo (primaria)
1. Usuario selecciona `Producto` (Codo/Tubería 1/Tubería 2).
2. Completa parámetros en una sola columna `Parámetro` usando badges e inputs.
3. Al presionar Guardar:
   - Se aplica autoevaluación (si algún parámetro está `Malo` ⇒ `Rechazado`, si no ⇒ `Aceptado`).
   - Se genera `Fecha de Inspección` automáticamente.
   - Se solicita geolocalización al dispositivo y se añade a metadatos.
   - Se serializa y guarda en `localStorage` y descarga un `.json`.
   - Si Firestore está configurado, guarda el registro en la nube.

## Lógica implementada
- Badges
  - Un clic activa una única opción por celda.
  - Al elegir `Malo` se despliega un textarea para detalles.
- Autoevaluación (fila 20 — Evaluación)
  - Recorre el estado; si existe cualquier `Malo`, marca `Rechazado`. De lo contrario `Aceptado`.
- Fecha/Hora (fila 21 — Fecha de Inspección)
  - Se inserta un badge con timestamp local (YYYY-MM-DD HH:mm) al guardar.
- Geolocalización
  - `navigator.geolocation.getCurrentPosition` con `enableHighAccuracy`.
  - Guarda `{ lat, lng, accuracy, granted }` (o error si denegado).
- Serialización
  - Estructura base: `{ headers, rows }` para la tabla.
  - `script.js` agrega `meta` al guardar: `{ producto, createdAtLocal, evaluation, geo }`.
- Persistencia local y exportación
  - `localStorage` con clave `primariaStateV1`.
  - Exportación a JSON (descarga automática con marca temporal).

## Integración con Firestore
- Requiere exponer `window.firebaseConfig` en `firebase-config.js` (copiar del sample y sin `<script>` tags).
- `firebase-init.js`
  - Inicializa `app` y `db`.
  - Expone `window.saveInspection(data)`.
  - Construye `payload`:
    ```js
    {
      createdAt: serverTimestamp(),
      createdAtLocal: now.toISOString(),
      headers,
      rows,
      meta // { producto, createdAtLocal, evaluation, geo }
    }
    ```
  - Si detecta un `itemId` intenta guardar en `items/{itemId}/inspections` y actualiza `items/{itemId}` con `updatedAt`.
  - Si no hay `itemId`, guarda en `inspections`.

## Páginas y utilidades
- `primaria.html`
  - Tabla de inspección simplificada a 2 columnas.
  - Controles de entrada tipo `pill` para unidades (cm/°).
  - Selector de producto estilizado con apariencia de badge.
  - Sección “Trabajo por Realizar” ubicada debajo de la tabla.
  - Diseño responsivo (breakpoint a 768px) para uso móvil.
- `ejmprueba.html`
  - Convierte texto TSV pegado en el archivo a una tabla HTML, tomando la primera fila como encabezados.

## Accesibilidad y UX
- Badges con `role=button` y navegación por teclado (Enter/Espacio).
- Focus visible en campos editables.
- Scroll horizontal en tablas en pantallas pequeñas.

## Cómo ejecutar en local
1. Instala un servidor estático simple o usa el Live Server del IDE.
2. Abre `primaria.html` en el navegador.
3. (Opcional) Configura Firebase:
   - Copia `firebase-config.sample.js` a `firebase-config.js`.
   - Sustituye con tus credenciales del proyecto Firebase.
   - Asegúrate de incluir `firebase-config.js` y `firebase-init.js` en `primaria.html`.

## Seguridad y privacidad
- Geolocalización: se solicita sólo al Guardar. Si el usuario deniega, se registra `{ granted: false }`.
- No se captura media por defecto. El roadmap contempla capturar foto solo desde cámara (sin carrete) en móviles mediante `<input accept="image/*" capture="environment">` o `getUserMedia`.

## Modificaciones recientes (resumen)
- Eliminación de `<script>` tags del sample de Firebase config (ahora puro JS).
- `primaria.html`:
  - Reemplazo de 3 columnas (Codo/Tubería 1/Tubería 2) por una sola columna de datos y selector de producto.
  - Ensanchado de columna `Parámetro` y uso de `colgroup`.
  - Reubicación de “Trabajo por Realizar” debajo de la tabla (corrección de `<div>` faltante en grid).
  - Estilización del selector con estilo tipo badge.
  - Inputs con unidades para Diámetro (cm) y Longitud/Ángulo (cm/°).
- `script.js`:
  - Autoevaluación de la inspección.
  - Fecha/Hora automática en la fila correspondiente.
  - Geolocalización al guardar y agregado de `meta`.
  - Persistencia local y exportación JSON.
- `firebase-init.js`:
  - Inclusión de `meta` en el payload a Firestore.

## Extensiones futuras (roadmap)
- Catálogo de `Figura` por producto (selector con chips).
- Reglas avanzadas de evaluación (ponderaciones por parámetro, tolerancias).
- Captura de foto solo desde cámara (bloqueo de carrete) con validaciones.
- Serialización orientada a valor por fila: `{ idx, parametro, value, detail }` para consumir más fácil en reportes.
- Validaciones por producto (mostrar/ocultar filas específicas).
- UI de historial y reimpresión de reportes.

## API / Métodos expuestos
- `window.saveInspection(data)`
  - Entrada: objeto serializado por `script.js` con `headers`, `rows`, y `meta`.
  - Salida: `{ ok: true, id? | itemId? }`.
- `localStorage` clave `primariaStateV1`.

## Notas
- El sistema está pensado para funcionar offline-first (captura y exportación local) y sincronizar cuando hay Firestore operativo.
- La estructura es modular y sin frameworks, lo que facilita su despliegue en entornos con restricciones.

## Seguridad pendiente (acciones)
- Migrar configuración de Firebase a variables de entorno (no exponer claves en el repo):
  - Usar `.env` + build (por ejemplo, Vite/Parcel) para inyectar `VITE_FIREBASE_*` en tiempo de compilación.
  - Alternativa sin bundler: servir `firebase-config.js` desde un origen privado o inyectarlo vía CI/CD como artefacto no versionado.
- Limitar dominios autorizados en Firebase Auth (incluye: producción y staging, elimina comodines).
- Reglas de Firestore (endurecer):
  - Solo lectura/escritura con sesión (`request.auth != null`).
  - Filtrar por propietario (p.ej., `resource.data.meta.user.uid == request.auth.uid`) donde aplique.
  - Crear índices mínimos necesarios; evitar consultas globales si no son requeridas.
- Roles/claims en Firebase Auth para Admin/Director/Inspector; evitar hardcode en el cliente.
- Activar App Check para Web (reCAPTCHA v3) para limitar abuso de Firestore/Storage.
- HSTS/HTTPS y CSP mínimos (si se despliega tras un proxy propio).

> Nota: Las claves públicas de Firebase no dan acceso por sí mismas, pero deben tratarse como configuración sensible. Las reglas y dominios autorizados son la primera línea de defensa.

## Próximas alertas (plan)
- Implementar lógica de alertas para equipos próximos a:
  - Mantenimiento preventivo/correctivo
  - Entrega/Recepción
  - Servicio/Retiro
- Fuentes de datos: `invsistejm.csv` + inspecciones de Firestore.
- Reglas iniciales propuestas:
  - Umbrales configurables (días o uso) por tipo de equipo.
  - Señalización en UI (amarillo/rojo) y listado priorizado.
  - Opcional: notificaciones por correo (Cloud Functions) o panel de alertas.
