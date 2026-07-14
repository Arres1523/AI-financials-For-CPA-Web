---
tags:
  - error
  - edge-case
---
# Edge Cases

## 🧪 Casos Borde Conocidos

### Importación

| Caso | Comportamiento Actual | Recomendación |
|------|----------------------|---------------|
| Archivo XLSX vacío | Error: "no data rows found" ✅ | Testeado |
| Archivo con 1 sola fila | Importa 1 transacción | Verificar que el flujo completo funciona |
| Archivo con >1000 filas | Importa todas (sin límite) | Monitorear performance en Vercel (timeout 10s) |
| Fechas fuera del año fiscal | Rechazadas por fila | El summary muestra cuántas se rechazaron |
| Descripciones con caracteres especiales | Unicode soportado | No testeado exhaustivamente |
| Decimales con coma (europeo) | NO soportado — parsea como string | Podría fallar el parseo de amount |
| Montos en paréntesis (formato contable) | Soportado (se parsea como negativo) | ✅ |
| Montos con en-dash (–) | Soportado | ✅ |
| SHA-256 collision (teórico) | Extremadamente improbable | Riesgo aceptable |

### Clasificación

| Caso | Comportamiento Actual | Riesgo |
|------|----------------------|--------|
| Descripción en mayúsculas vs minúsculas | Regex case-insensitive → no hay problema | ✅ |
| Descripciones multi-idioma | Solo español/inglés en reglas actuales | Nuevos patrones necesarios |
| Transacciones sin clasificar | Fallback a "Transfer Clearing" (low confidence) | ⚠️ Pueden quedar ocultas |
| Owner Contributions recurrentes | Clasificadas como Balance Sheet (HIGH) | Verificar que no haya falsos positivos |
| Pagos de tarjeta de crédito no-AMEX | Si no matchea "AMEX" o "CC PAYMENT", no se clasifica como CC Liability | ⚠️ Falso negativo potencial |

### Reconciliación

| Caso | Comportamiento Actual | Riesgo |
|------|----------------------|--------|
| Variación > $0.01 pero < $1.00 | Se marca como "unreconciled" | ⚠️ Podría ser error de redondeo |
| Cuenta con saldo cero | Se muestra con balance check OK | Sin riesgo |
| Múltiples cuentas | Cada una se reconcilia independientemente | ✅ |
| Sin transacciones para una cuenta | Movement = $0, Expected = Opening | Comportamiento correcto |

### Exportación

| Caso | Comportamiento Actual | Riesgo |
|------|----------------------|--------|
| Sin transacciones aprobadas | Workbook con sheets vacíos | Podría generar archivos confusos |
| Solo Balance Sheet items | P&L vacío | Comportamiento correcto (disclaimer presente) |
| Balance Check no-zero | Se muestra en rojo | ⚠️ Requiere explicación en CPA memo |

## 🔗 Enlaces Relacionados

- [[Errores Conocidos]]
- [[Deuda Técnica]]
- [[Optimizaciones]]
