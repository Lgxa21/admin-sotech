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

- **Finanzas** (Dirección y Administración): tasa del día (Bs. por USD), cobros con método y referencia, pagos a proveedores y freelancers, gastos por orden, por cobrar, por pagar, margen por orden y rentabilidad por cliente. Todo se reporta en USD; cada movimiento en bolívares guarda la tasa con la que se registró.
- **Cotizaciones** con líneas, vista para imprimir o guardar en PDF, y botón para convertirlas en orden.
- **Enlace de aprobación:** el cliente aprueba o pide cambios sin cuenta (`/aprobar/…`); la orden cambia de etapa sola y se cuentan las rondas.
- **Enlace de pedidos** por cliente (`/pedido/…`): cada pedido entra como orden nueva.
- **Igualas:** cada mes se crea sola la orden de cada iguala activa, con una tarea por entregable.

Pendiente: notificaciones push y por correo, calendario de publicaciones, reportes exportables e integraciones (Fase 2).

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

Variables necesarias: `DATABASE_URL`, `SESSION_SECRET` (cadena larga y aleatoria), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`. Opcional: `PUBLIC_URL` (la dirección pública, para los enlaces que se envían al cliente; si falta, se toma de la petición).
`npm run build` y `npm start` (aplica migraciones y crea la cuenta inicial si no hay usuarios).

### Si alguien de Dirección olvida su contraseña

Dirección cambia la contraseña de cualquier persona desde **Equipo**. Si la que la olvidó es la única cuenta de Dirección:

1. En Railway, agrega al servicio las variables `RESET_PASSWORD_EMAIL` (su correo) y `RESET_PASSWORD` (una contraseña temporal). El servicio se reinicia y la aplica.
2. Entra con la contraseña temporal y cámbiala en **Perfil**.
3. Borra las dos variables en Railway.

