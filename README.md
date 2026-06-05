# Finnegans BI Dashboard

Panel de control interno para seguimiento de facturación, cuentas corrientes y composición de saldos, construido sobre datos exportados desde Finnegans ERP.

---

## Configuración en Railway (primer deploy)

### Paso 1 — Crear el proyecto
1. Ingresá a [railway.app](https://railway.app) e iniciá sesión
2. Hacé clic en **New Project → Deploy from GitHub repo**
3. Seleccioná el repositorio `dashboard_facturacion`
4. Railway detecta el `railway.toml` y configura el build automáticamente

### Paso 2 — Agregar la base de datos
1. Dentro del proyecto, hacé clic en el botón **+** (Add Service)
2. Seleccioná **Database → PostgreSQL**
3. La variable `DATABASE_URL` se inyecta automáticamente al servicio de la app

### Paso 3 — Configurar variables de entorno
En el servicio de la app (no en el de PostgreSQL), ir a **Variables** y agregar:

| Variable | Valor | Descripción |
|---|---|---|
| `JWT_SECRET` | cualquier string largo y aleatorio | Clave para firmar los tokens de sesión. Ej: `mi-clave-super-secreta-2024` |
| `NODE_ENV` | `production` | Activa modo producción (SSL en DB, etc.) |

> `DATABASE_URL` **no** hace falta agregarla manualmente — Railway la inyecta sola.

### Paso 4 — Primer deploy
1. Hacé clic en **Deploy** (o simplemente esperá — Railway despliega automáticamente al detectar el repo)
2. El proceso tarda ~3-5 minutos la primera vez
3. Una vez que el health check `/api/health` responda OK, la app está lista

### Paso 5 — Crear el usuario administrador
1. Abrí la URL del deploy (ej: `https://dashboard-facturacion.up.railway.app/setup`)
2. Ingresá un **nombre de usuario** y **contraseña** para el administrador
3. Este es el único usuario con acceso total y gestión de otros usuarios
4. **Guardá estas credenciales** — no hay recuperación de contraseña por email

### Paso 6 — Cargar los datos iniciales
1. Iniciá sesión con el admin creado
2. Ir a cada sección y subir los Excel exportados desde Finnegans:
   - **Facturación**: exportar el informe de facturas emitidas
   - **Cuenta Corriente**: exportar el estado de cuenta por cliente
   - **Composición de saldos**: exportar el detalle de comprobantes abiertos
3. Los datos se actualizan cada vez que se sube un archivo nuevo

---

## Módulos del sistema

### 🏠 Facturación
**Qué muestra:** Evolución mensual de ventas, desglose por empresa (local/internacional), ranking de clientes y mix por Nivel 1 y Centro de costo.

**Cómo usar:**
- Usá los filtros globales (barra superior) para acotar por período, Nivel 1, Centro de costo o cliente específico
- Hacé clic en cualquier **barra del gráfico** para ver el detalle de ese mes
- Hacé clic en cualquier **cliente** en la tabla para abrir su ficha completa, que incluye:
  - Totales por empresa (ARS y USD)
  - Evolución mensual propia
  - Mix por segmento
  - Listado de comprobantes con número, fecha e importe

**Archivo Excel esperado:** Informe de facturas emitidas de Finnegans. Columnas clave: `Documento`, `Comprobante`, `Fecha`, `Cliente`, `Empresa`, `Moneda`, `Importe mon. principal`, `Nivel 1 dimensión`, `Dim. valor`.

---

### 💳 Cuenta Corriente
**Qué muestra:** Estado de cuenta de todos los clientes con saldo pendiente, y el detalle de movimientos de cada uno.

**Cómo usar:**
- Panel izquierdo: lista de clientes con su saldo. Usá la búsqueda para filtrar.
- Hacé clic en un cliente para ver sus **movimientos** (debe/haber) en el panel derecho.
- Los filtros globales (Nivel 1, Centro de costo, Cliente) filtran la lista de clientes mostrando solo los habilitados.

**Archivo Excel esperado:** Estado de cuenta corriente de Finnegans. Columnas clave: `Cliente`, `Tipo`, `Fecha`, `Debe`, `Haber`, `Saldo`.

---

### 📊 Composición de saldos
**Qué muestra:** Desglose detallado de la deuda abierta por comprobante, con aging (antigüedad de la deuda).

**Cómo usar:**
- La tabla principal muestra todos los **clientes con deuda**, ordenados por monto.
- Hacé clic en la flecha (▶) o en el nombre del cliente para expandir sus comprobantes.
- **Seleccioná múltiples clientes** con los checkboxes para ver la **deuda combinada** al final de la página, con resumen por aging (verde = al día, rojo = muy vencida).
- El badge de color en "Aging máx." indica la antigüedad máxima de la deuda del cliente.

**Archivo Excel esperado:** Composición de saldos de Finnegans. Columnas clave: `Cliente`, `Comprobante`, `Importe ppal`, `Dimension valor`.

---

### 👥 Clientes
**Qué muestra:** (En desarrollo) Vista consolidada por cliente.

---

### ⚙️ Admin *(solo administradores)*
**Qué muestra:** Gestión de usuarios y sincronización con Google Drive.

**Cómo usar:**
- **Crear usuario:** completá usuario, contraseña y rol (Usuario o Admin). Los admins tienen acceso total; los usuarios normales solo ven lo que el admin les permite.
- **Permisos por usuario (ícono 🛡):** al hacer clic, se abre un panel donde el admin define qué **Nivel 1**, **Centro de costo** y **Clientes** puede ver ese usuario. Dejarlo todo vacío = acceso total.
- **Cambiar contraseña (ícono 🔑):** cambia la contraseña de cualquier usuario.
- **Eliminar usuario (ícono 🗑):** elimina el usuario permanentemente.

> Nota: cuando se modifican los permisos de un usuario, ese usuario necesita cerrar sesión y volver a ingresar para que los cambios tomen efecto.

---

## Filtros globales

La barra de filtros en la parte superior de cada página aplica a **todas las secciones** simultáneamente:

| Filtro | Descripción |
|---|---|
| **Desde / Hasta** | Período de facturación a visualizar (por mes) |
| **Nivel 1** | Segmento comercial (ej: Z_especiales). Modos: "Solo estos" u "Ocultar estos" |
| **Centro de costo** | Dimensión valor del ERP. Modos: "Solo estos" u "Ocultar estos" |
| **Cliente** | Filtro por cliente específico con búsqueda interna |

Los filtros de Nivel 1 y Centro de costo también aplican a Cuenta Corriente y Composición, mostrando solo los clientes que tienen facturas en esos segmentos.

---

## Actualización de datos

Los datos **no se actualizan solos** — requieren subir manualmente el Excel exportado desde Finnegans. Para actualizar:

1. Exportá el informe desde Finnegans
2. En la sección correspondiente, arrastrá el archivo al **área de carga** en el sidebar izquierdo (o hacé clic para seleccionarlo)
3. El sistema procesa y reemplaza todos los datos anteriores
4. La fecha de última actualización se muestra en el sidebar

---

## Estructura técnica

```
finnegans_bi_react/
├── backend/          Express + TypeScript (API + ETL)
│   └── src/
│       ├── routes/   Endpoints: auth, data, etl, admin
│       ├── services/ Procesamiento de Excel (Finnegans)
│       └── db.ts     Conexión PostgreSQL + migraciones
├── frontend/         React + Vite + Tailwind
│   └── src/
│       ├── pages/    Facturacion, CuentasCorrientes, Composicion, Admin
│       ├── components/ Layout, GlobalFilterBar, KpiCard
│       └── hooks/    useAuth, useGlobalFilters, useUploadSlot
└── railway.toml      Configuración de deploy
```
