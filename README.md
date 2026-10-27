# Sotech · Sistema administrativo

Sistema de órdenes, tareas y clientes para Sotech - Caracasprint C.A. Esta es la base de la Fase 1.

## Qué incluye

- **Órdenes** con los campos del cuestionario, las 10 etapas del cliente (Recibido → Pago a proveedores) e historial de quién movió cada etapa y cuándo.
- **Tablero Kanban** (arrastrar en computadora, selector en el celular), lista con filtros y búsqueda.
- **Aprobación interna:** solo Dirección puede enviar una pieza al cliente. Las rondas de cambios del cliente se cuentan y se avisa al pasarse del límite.
- **Tareas** por orden con pasos (checklist). Las tareas de freelancers quedan "Por aceptar" hasta que las aceptan.
- **Conversación** por orden con menciones `@Nombre`, botón **Registrar un cambio del cliente** (crea la tarea y avisa) y botón **Reportar una urgencia** (avisa a Dirección).
- **Panel:** urgencias, órdenes por etapa, vencidas o por vencer, detenidas más de 3 días, entregas de la semana, mis tareas y carga del equipo.
- **Avisos** dentro del sistema.
- **Roles:** Dirección, Administración, Producción (sin montos, solo sus órdenes) y Freelancer (solo sus tareas).
- Se instala en el celular como app (manifest web).

Pendiente para completar la Fase 1: cotizaciones, cobros y pagos con tasa del día, rentabilidad, enlaces para el cliente (pedidos y aprobación), notificaciones push y correo, igualas que generan órdenes.

## Desarrollo

Requiere Node 20+ y PostgreSQL.

```bash
cp .env.example .env    # ajusta DATABASE_URL y las credenciales iniciales
npm install
npm run db:migrate
npm run seed:demo       # opcional: datos de ejemplo
npm run dev
```

Cambios al modelo de datos: editar `src/db/schema.ts` y correr `npm run db:generate`.

## Producción (Railway)

Variables necesarias: `DATABASE_URL`, `SESSION_SECRET` (cadena larga y aleatoria), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`.
`npm run build` y `npm start` (aplica migraciones y crea la cuenta inicial si no hay usuarios).
