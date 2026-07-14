# Prompt final: Auditoría, corrección y validación del motor de clasificación

Actúa como un **QA Engineer senior y desarrollador TypeScript especializado en sistemas financieros, contabilidad y motores deterministas de clasificación**.

Tu misión es auditar, corregir y validar **AI Financials for CPA Web** en sus dos superficies:

1. **Repositorio:** parser, normalización, motor de reglas, persistencia, revisión, reconciliación, reportes y tests.
2. **Aplicación desplegada:** comportamiento real del flujo completo en la interfaz.

El repositorio y la URL representan el mismo producto, pero no asumas que el código local y el despliegue están sincronizados. Debes medir ambos, comparar sus resultados y demostrar cualquier diferencia con evidencia.

## Objetivo

Determina y mejora:

- la precisión de la clasificación;
- la separación correcta entre P&L y Balance Sheet;
- la calibración de `confidence` y `reviewStatus`;
- el soporte de exports de QuickBooks;
- el tratamiento de duplicados, montos cero y descripciones incompletas;
- la consistencia entre ejecución directa, interfaz y exportaciones;
- la seguridad contable de las aprobaciones automáticas.

No te limites a recomendar cambios: reproduce los problemas, crea tests que fallen, implementa las correcciones, vuelve a ejecutar las pruebas y presenta métricas antes y después.

---

# Recursos

## Aplicación desplegada

`https://ai-financials-for-cpa-q4fltcvhx-arres1523.vercel.app`

Flujo esperado:

1. Company & Year
2. Bank Accounts
3. Upload Statements
4. Review Exceptions
5. Reconciliation
6. Results & Export

## Repositorio

Proyecto: `AI Financials for CPA Web`

Archivos principales:

- `src/domain/classification.ts`
- `src/domain/types.ts`
- `src/domain/reporting.ts`
- `tests/domain/classification.test.ts`
- `tests/qa-real-data-report.test.ts`

Localiza e inspecciona también:

- parser e importador XLSX;
- detección y mapeo de columnas;
- normalización de fechas, texto y montos;
- deduplicación;
- persistencia de clasificaciones;
- revisión manual;
- reconciliación;
- generación y exportación de P&L y Balance Sheet.

## Datos reales

### Extracto fuente

`valoris/Valoris capital partners LLC/tmp_vcp_reconcile/Register Chase valoris capital partners LLC.xlsx`

Cuenta: `Chase Operating Chk (2978) — Valoris Capital Partners LLC`.

Es un export de QuickBooks con columnas como:

- Date
- Ref No.
- Payee
- Memo
- Payment
- Deposit
- Reconciliation Status
- Balance
- Type
- Account

### Clasificación oficial del CPA

`valoris/LLCs/outputs/Valoris_Capital_Partners_Financial_Statements_Bank_2024_2025_V2.xlsx`

Hojas relevantes:

- `Transactions`
- `P&L 2025`

### P&L consolidado

`valoris/LLCs/outputs/Valoris_Capital_Partners_Consolidated_PL_All_Bank_Activity_2025.xlsx`

### Documentación

- `obsidian/Metodología/Clasificación de Transacciones.md`
- `obsidian/Errores y Problemas/Edge Cases.md`
- `obsidian/Errores y Problemas/Errores Conocidos.md`

---

# Jerarquía de fuentes

Si encuentras contradicciones, usa este orden de autoridad:

1. Comportamiento demostrado por el código actual ejecutado.
2. Clasificaciones del XLSX oficial del CPA.
3. Extracto bancario fuente.
4. Tests automatizados.
5. Documentación del proyecto.
6. Tablas o resúmenes escritos manualmente.
7. Suposiciones.

No alteres silenciosamente los datos esperados para hacer pasar los tests. Documenta cada contradicción, la fuente escogida y la justificación.

---

# Restricciones

- Conserva los cambios existentes que no pertenezcan a esta tarea.
- No modifiques archivos financieros originales.
- Trabaja con copias o fixtures sanitizados cuando sea necesario.
- No inventes resultados si no puedes abrir la URL, ejecutar el repositorio o leer un XLSX.
- No declares que una prueba pasó sin mostrar evidencia reciente.
- No amplíes regex sin analizar falsos positivos y colisiones.
- No conviertas una decisión contable incierta en aprobación automática.
- No despliegues directamente a producción.
- Si tienes acceso de despliegue, utiliza un entorno de preview.
- Si no tienes acceso, entrega los cambios locales y explica qué falta para validar el despliegue.
- En la aplicación usa una entidad aislada, por ejemplo `QA Classification Evaluation 2025`; no modifiques compañías existentes.

---

# Fase 1: establecer la línea base

Antes de cambiar código:

1. Revisa el estado del repositorio y los cambios existentes.
2. Inspecciona el motor real; no dependas de un resumen de sus reglas.
3. Ejecuta la suite relacionada con clasificación, importación y reporting.
4. Ejecuta typecheck y lint si están configurados.
5. Registra comandos, resultados, errores y versiones relevantes.
6. Ejecuta `classifyTransaction()` directamente sobre el dataset reconciliado.
7. Prueba el flujo actual de la URL sin modificar entidades existentes.

La línea base debe conservarse para poder comparar antes y después.

---

# Fase 2: reconciliar el dataset

Investiga primero esta posible inconsistencia:

- el extracto contiene aproximadamente 26 filas de 2025;
- el resultado oficial contiene 24 transacciones clasificadas;
- puede existir una transacción de monto `0.00`;
- puede existir una transferencia duplicada de `12,969.65`;
- algunas fechas del extracto y del resultado oficial pueden diferir;
- la posición o numeración manual no es un identificador estable.

Crea una tabla:

| Campo | Contenido |
|---|---|
| sourceRow | Fila del extracto |
| sourceDate | Fecha original |
| normalizedDate | Fecha usada por el sistema |
| amount | Monto con signo |
| memo | Memo original |
| payee | Payee original |
| qbType | Tipo QuickBooks |
| expectedRow | Fila correspondiente del resultado CPA |
| matchMethod | ID, fecha+monto+texto u otro método |
| status | matched, duplicate, zero-value, excluded, ambiguous o missing |
| notes | Evidencia y explicación |

Reglas:

1. No emparejes únicamente por posición.
2. No elimines duplicados sin demostrar que lo son.
3. No excluyas montos cero sin una regla de negocio explícita.
4. Marca como ambiguo cualquier emparejamiento no demostrable.
5. Reporta métricas sobre:
   - las 24 clasificaciones oficiales;
   - todas las filas importables;
   - el subconjunto emparejado sin ambigüedad.

---

# Fase 3: auditoría del repositorio

## Parser e importación

Verifica:

- reconocimiento de `Payment` como egreso;
- reconocimiento de `Deposit` como ingreso;
- comportamiento cuando ambas columnas están vacías o tienen valor;
- formatos y serialización de fechas de QuickBooks;
- montos cero;
- filas incompletas;
- duplicados dentro del archivo y entre cargas;
- uso de `Memo`, `Payee`, `Type` y `Account`;
- descripción final enviada al clasificador;
- caracteres especiales, espacios repetidos y texto truncado.

## Motor de clasificación

Verifica:

- orden exacto de reglas;
- comportamiento `first-match-wins`;
- colisiones entre patrones;
- condiciones por signo del monto;
- taxonomía de categorías;
- asignación de `reportType`;
- cálculo de `confidence`;
- asignación de `reviewStatus`;
- fallback;
- trazabilidad mediante `ruleUsed`.

Evalúa expresamente:

- `WIRE TRANSFER`;
- `DOMESTIC WIRE TRANSFER`;
- `Online Transfer from CHK`;
- `Online Transfer to CHK`;
- `AUTOPAY...AUTO-PMT`;
- `CITI AUTOPAY`;
- `ORIG CO NAME:INTUIT...TRAN FEE`;
- `SERVICE CHARGES FOR THE MONTH OF`;
- ingresos y egresos ACH;
- transacciones sin memo pero con payee;
- duplicados;
- montos cero.

No asumas que:

- `AUTOPAY` siempre significa tarjeta de crédito;
- `WIRE TRANSFER` siempre significa intercompany;
- `Online Transfer from/to CHK` identifica por sí solo la naturaleza contable;
- un monto positivo es ingreso;
- un monto negativo es gasto;
- el fallback `Transfer Clearing` es una clasificación válida.

## Reporting

Confirma que:

- solo las transacciones elegibles llegan a los reportes;
- los pendientes no se incluyen o se manejan según la regla de negocio documentada;
- P&L y Balance Sheet usan el signo correctamente;
- los totales exportados coinciden con los datos persistidos;
- la reconciliación no oculta errores de clasificación.

---

# Fase 4: tabla de comparación por transacción

Produce una fila por transacción:

| Campo | Descripción |
|---|---|
| transactionKey | Identificador reproducible |
| date | Fecha usada |
| amount | Monto |
| normalizedText | Texto exacto recibido por el motor |
| matchedRule | Regla ganadora |
| repositoryCategory | Categoría por ejecución directa |
| repositoryReportType | P&L o Balance Sheet |
| repositoryConfidence | high, medium o low |
| repositoryReviewStatus | approved o pending |
| deployedCategory | Resultado observado en la URL |
| expectedCategory | Categoría oficial CPA |
| expectedReportType | P&L o Balance Sheet |
| categoryFamily | Familia contable normalizada |
| categoryMatch | exact, semantic, partial o no-match |
| reportTypeMatch | Sí/No |
| analysis | Causa y riesgo |

---

# Fase 5: equivalencia de categorías

Las categorías CPA y las internas pueden tener nombres diferentes. Antes de medir, construye una tabla explícita:

| Categoría CPA | Categoría del sistema | Familia normalizada | Equivalencia | Justificación |
|---|---|---|---|---|

Considera casos como:

- `Bank Fees` frente a `Bank service charges`;
- `Credit Card Liability` frente a `Credit card clearing / due from support`;
- `Transfer Clearing` frente a transferencias intercompany;
- `Other Income` frente a `Other ACH income`.

Calcula por separado:

1. coincidencia exacta de categoría;
2. coincidencia semántica demostrable;
3. coincidencia de familia contable;
4. coincidencia de reportType;
5. coincidencia del estado de revisión.

No ocultes una taxonomía incompatible dentro de la métrica semántica.

---

# Fase 6: métricas

## Clasificación

Calcula:

- exact category accuracy;
- semantic category accuracy;
- report-type accuracy;
- fallback rate;
- ambiguous/unclassified rate;
- high-confidence error rate;
- porcentaje enviado a revisión;
- porcentaje de errores capturados por revisión;
- monto absoluto afectado por clasificaciones incorrectas.

## P&L y Balance Sheet

Usa las definiciones estadísticas correctas:

- precision, recall y F1 de P&L;
- precision, recall y F1 de Balance Sheet.

Muestra fórmulas, numeradores y denominadores. No llames “precision” a accuracy condicionada o recall.

## Confianza

Para `high`, `medium` y `low`, reporta:

- número de predicciones;
- número correcto;
- accuracy;
- errores;
- impacto financiero absoluto de los errores.

Destaca:

- errores con confianza alta;
- errores aprobados automáticamente;
- aciertos enviados innecesariamente a revisión;
- movimientos incorrectamente enviados a P&L o Balance Sheet.

Aclara que una muestra cercana a 24 transacciones no demuestra calibración estadística robusta.

## Matrices de confusión

Incluye:

1. P&L frente a Balance Sheet;
2. categoría exacta;
3. familia contable normalizada.

---

# Fase 7: impacto contable y financiero

Calcula:

- monto absoluto total clasificado incorrectamente;
- monto enviado incorrectamente a P&L;
- monto enviado incorrectamente a Balance Sheet;
- efecto potencial sobre ingresos;
- efecto potencial sobre gastos;
- efecto potencial sobre activos, pasivos y equity.

Prioriza materialidad financiera, no solo cantidad de errores. Un error de USD 200,000 puede ser más grave que varios errores pequeños.

Identifica qué decisiones necesitan confirmación de un CPA y no pueden resolverse de manera segura solo mediante regex.

---

# Fase 8: prueba de la aplicación desplegada

Prueba el flujo completo en:

`https://ai-financials-for-cpa-q4fltcvhx-arres1523.vercel.app`

Usa una compañía y cuenta aisladas para QA.

Valida:

1. creación o selección de compañía QA;
2. año fiscal 2025;
3. creación de cuenta bancaria QA;
4. carga del XLSX sanitizado;
5. preview y detección de columnas;
6. mapeo de Payment/Deposit;
7. fechas, signos, cantidad de filas y totales;
8. duplicados y montos cero;
9. clasificaciones y reglas mostradas;
10. Review Exceptions;
11. persistencia después de recargar;
12. reconciliación;
13. P&L y Balance Sheet;
14. exportación.

Revisa también:

- errores visibles;
- estados de carga;
- mensajes de validación;
- navegación entre pasos;
- pérdida de información;
- consola del navegador;
- requests fallidos, si están disponibles.

Compara:

| Nivel | Fuente |
|---|---|
| Expected | Clasificación oficial CPA |
| Repository | Ejecución directa del motor |
| Deployed UI | Resultado observado en la URL |

Clasifica cada discrepancia como:

- parser/importación;
- motor;
- persistencia/API;
- interfaz;
- reporting/exportación;
- dataset esperado;
- ambiente o despliegue.

No apruebes la prueba web únicamente porque la página carga.

---

# Fase 9: recomendaciones priorizadas

Clasifica los hallazgos:

- **P0:** riesgo de estados financieros materialmente incorrectos.
- **P1:** error frecuente, error de alto impacto o error aprobado con confianza alta.
- **P2:** cobertura, mantenibilidad o experiencia de revisión.
- **P3:** mejora deseable sin riesgo inmediato.

Para cada hallazgo presenta:

| Campo | Contenido |
|---|---|
| Prioridad | P0–P3 |
| Problema | Qué falla |
| Evidencia | Código, transacciones o UI |
| Causa raíz | Por qué ocurre |
| Impacto | Contable, técnico o UX |
| Solución | Cambio mínimo concreto |
| Esfuerzo | Bajo, medio o alto |
| Riesgo | Falsos positivos o regresiones |
| Test | Caso de regresión requerido |
| Métrica objetivo | Mejora esperada |

Evalúa si conviene separar:

1. normalización;
2. extracción de señales;
3. tipo de movimiento;
4. identificación de contraparte;
5. asignación contable;
6. confianza;
7. decisión de revisión;
8. evidencia y versión de regla.

Considera reglas por entidad, taxonomía canónica, subcategorías, versionado y aprendizaje basado en correcciones del CPA. No agregues complejidad que no esté justificada por los hallazgos.

---

# Fase 10: implementar las correcciones

Implementa los problemas confirmados, empezando por P0 y P1.

Como mínimo investiga y resuelve, cuando la evidencia confirme el defecto:

- QuickBooks `Payment` y `Deposit`;
- combinación controlada de `Memo` y `Payee`;
- `AUTOPAY...AUTO-PMT`;
- `CITI AUTOPAY`;
- transferencias online hacia y desde CHK;
- wires domésticos;
- `INTUIT...TRAN FEE`;
- `SERVICE CHARGES FOR THE MONTH OF`;
- ingresos ACH;
- transacciones sin memo;
- filas de monto cero;
- duplicados;
- fallback excesivo a `Transfer Clearing`;
- diferencias entre taxonomía CPA e interna;
- errores de confianza alta aprobados automáticamente.

No presupongas que todos son bugs. Distingue entre:

- bug confirmado;
- regla de negocio faltante;
- dato ambiguo que requiere revisión;
- decisión contable que requiere CPA.

## Flujo obligatorio por corrección

1. Reproduce el problema.
2. Crea un test que falle por la razón esperada.
3. Identifica la causa raíz.
4. Implementa el cambio mínimo.
5. Ejecuta el test específico.
6. Ejecuta las pruebas relacionadas.
7. Ejecuta la suite completa.
8. Ejecuta typecheck y lint.
9. Comprueba colisiones entre reglas.
10. Documenta antes y después.

No cambies los resultados oficiales del CPA para hacer pasar los tests. Conserva el comportamiento correcto existente y evita refactorizaciones no relacionadas.

---

# Fase 11: validación posterior

Después de implementar:

1. Ejecuta nuevamente todo el dataset reconciliado.
2. Recalcula las métricas.
3. Compara antes y después.
4. Reporta cualquier regresión.
5. Verifica el impacto financiero restante.
6. Ejecuta unit, integration, E2E, typecheck, lint y build disponibles.
7. Confirma que los reportes y exportaciones permanecen consistentes.

Presenta:

| Métrica | Antes | Después | Cambio |
|---|---:|---:|---:|
| Exact category accuracy | | | |
| Semantic category accuracy | | | |
| Report-type accuracy | | | |
| High-confidence error rate | | | |
| Fallback rate | | | |
| Monto incorrectamente enviado a P&L | | | |
| Monto incorrectamente enviado a Balance Sheet | | | |

No declares resuelto un problema únicamente porque compila o porque un test aislado pasa.

---

# Fase 12: preview y verificación final web

Si tienes autorización y acceso de despliegue:

1. Despliega la versión corregida a una URL de preview.
2. No reemplaces producción.
3. Repite el flujo QA completo en preview.
4. Compara la ejecución directa con la UI.
5. Confirma que preview y repositorio producen los mismos resultados.
6. Verifica consola, requests, persistencia, reconciliación y exportación.
7. Entrega la URL de preview y la evidencia.

Si no tienes autorización o acceso:

- no afirmes que la URL original quedó corregida;
- entrega los cambios locales y tests;
- explica los pasos pendientes para desplegar;
- conserva la comparación contra la URL original como línea base.

---

# Entregable final

Entrega el reporte en este orden:

## 1. Resumen ejecutivo

- veredicto;
- principales riesgos;
- exact category accuracy;
- semantic category accuracy;
- report-type accuracy;
- high-confidence error rate;
- monto afectado;
- diferencias entre repositorio, URL original y preview.

## 2. Alcance y limitaciones

Indica exactamente qué pudiste y no pudiste ejecutar.

## 3. Reconciliación del dataset

Explica 26 filas frente a 24 clasificaciones, fechas, duplicados, montos cero y exclusiones.

## 4. Evidencia de la línea base

Comandos, resultados, errores, screenshots o evidencia equivalente.

## 5. Tabla completa por transacción

Expected frente a repository frente a deployed UI.

## 6. Métricas y matrices de confusión

Incluye fórmulas y denominadores.

## 7. Gap analysis y auditoría de prioridad

Patrones ausentes, colisiones, falsas prioridades y fallback.

## 8. Impacto contable

Materialidad para P&L y Balance Sheet.

## 9. Evaluación crítica

### Cosas buenas

Patrones, arquitectura y decisiones que deben preservarse.

### Cosas malas

Brechas, riesgos y decisiones cuestionables.

## 10. Cambios implementados

- archivos modificados;
- explicación de cada cambio;
- tests agregados;
- problemas solucionados;
- decisiones que requieren CPA.

## 11. Resultados antes y después

Métricas, impacto monetario y regresiones.

## 12. Validación web

- URL original;
- URL de preview, si existe;
- diferencias observadas;
- evidencia del flujo completo.

## 13. Problemas pendientes

Incluye causa, riesgo, bloqueo y siguiente acción.

## 14. Recomendación final

Selecciona una:

- **Aprobado**
- **Aprobado con observaciones**
- **Requiere correcciones antes de uso contable**
- **No apto para producir estados financieros**

Justifica el veredicto con evidencia técnica, contable y de ejecución.

---

# Criterios de rechazo del reporte

El trabajo es insuficiente si:

- calcula métricas sin reconciliar el dataset;
- empareja filas solo por posición;
- compara categorías incompatibles sin equivalencias;
- presenta simulación manual como ejecución real;
- revisa solo el repositorio o solo la URL;
- ignora materialidad financiera;
- recomienda regex amplias sin analizar falsos positivos;
- no diferencia parser, motor, API, UI y reporting;
- implementa cambios sin tests de regresión;
- modifica expected outputs para mejorar métricas;
- afirma que producción fue corregida sin desplegar y verificar;
- oculta limitaciones o resultados negativos;
- declara éxito sin evidencia reciente de tests, build y validación funcional.
