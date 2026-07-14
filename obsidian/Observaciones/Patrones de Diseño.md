---
tags:
  - observacion
  - patrones
---
# Patrones de Diseño

## Patrones Identificados en el Código

### Container/Presentational
**Dónde:** `Wizard.tsx` (container) + Step components (presentational)
**Cómo:** Wizard mantiene estado compartido y callbacks; cada Step recibe props y eventos.
```typescript
// Wizard.tsx — container
const [company, setCompany] = useState<Company | null>(null);
const handleCompanyComplete = (c: Company, w: Workspace) => { ... };

// CompanyStep.tsx — presentational
interface Props {
  onComplete: (company: Company, workspace: Workspace) => void;
}
```

### State Machine (Contextual)
**Dónde:** `Wizard.tsx` — `currentStep` state (1-6)
**Cómo:** Transiciones lineales con validación en cada paso. Soporta navegación hacia atrás en pasos completados.

### Lazy Singleton
**Dónde:** `src/lib/db.ts` — Database pool
**Cómo:** El pool de PostgreSQL se crea en el primer acceso, no al importar el módulo.

### Repository (Simplificado)
**Dónde:** API Routes → direct SQL queries via `lib/db.ts`
**Cómo:** Sin capa de repositorio separada. Cada API route hace sus queries directamente con helpers.

### Strategy (Implícito)
**Dónde:** `src/domain/classification.ts`
**Cómo:** Cada regla de clasificación es una estrategia evaluada en orden de prioridad.

### Unit of Work
**Dónde:** `lib/db.ts` → `withTransaction()`
**Cómo:** Las operaciones de import ejecutan statement + transactions + classifications en una transacción atómica.

### Active Record (Simplificado)
**Dónde:** Domain types (`types.ts`) + queries directas
**Cómo:** Los tipos del dominio NO tienen métodos. Son interfaces planas (Data Transfer Objects).

## Anti-Patrones a Evitar

- **God Object en Wizard.tsx** — El estado compartido crece con cada paso. Peligro de tener demasiado estado en un solo componente.
- **Sin validación compartida** — Las validaciones existen duplicadas (cliente y servidor) pero sin un schema unificado.
- **Query strings en API** — Los filtros se pasan como query params sin tipado fuerte.

## 🔗 Enlaces Relacionados

- [[Arquitectura]]
- [[Deuda Técnica]]
- [[Decisiones Técnicas]]
