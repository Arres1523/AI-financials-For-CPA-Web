---
tags:
  - referencia
  - base-de-datos
---
# Esquema de BD

## Diagrama de Relaciones

```
companies
    │
    ├── workspaces (1:N)
    │       │
    │       ├── uploaded_statements (1:N)
    │       │       │
    │       │       └── transactions (1:N)
    │       │               │
    │       │               └── classifications (1:1)
    │       │                       │
    │       │                       └── review_events (1:N)
    │       │
    │       └── report_exports (1:N)
    │
    ├── bank_accounts (1:N)
    │       │
    │       └── transactions (1:N)
    │
    └── classification_rules (1:N)
```

## Tablas

### companies
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| legal_name | TEXT | NOT NULL, UNIQUE |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### workspaces
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| company_id | UUID | NOT NULL, FK → companies(id) |
| tax_year | INTEGER | NOT NULL |
| status | TEXT | NOT NULL, DEFAULT 'in_progress' |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |
| | UNIQUE | (company_id, tax_year) |

### bank_accounts
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| company_id | UUID | NOT NULL, FK → companies(id) |
| account_name | TEXT | NOT NULL |
| bank_name | TEXT | NOT NULL |
| last_four | TEXT | NOT NULL |
| account_type | TEXT | NOT NULL |
| opening_balance | NUMERIC | NOT NULL |
| closing_balance | NUMERIC | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### uploaded_statements
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| workspace_id | UUID | NOT NULL, FK → workspaces(id) |
| bank_account_id | UUID | NOT NULL, FK → bank_accounts(id) |
| file_name | TEXT | NOT NULL |
| sheet_name | TEXT | NOT NULL |
| total_rows | INTEGER | NOT NULL |
| imported_rows | INTEGER | NOT NULL |
| file_hash | TEXT | — |
| uploaded_at | TIMESTAMPTZ | DEFAULT now() |

### transactions
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| workspace_id | UUID | NOT NULL, FK → workspaces(id) |
| bank_account_id | UUID | NOT NULL, FK → bank_accounts(id) |
| statement_id | UUID | NOT NULL, FK → uploaded_statements(id) |
| date | DATE | NOT NULL |
| description | TEXT | NOT NULL |
| amount | NUMERIC | NOT NULL |
| balance | NUMERIC | — |
| original_row_index | INTEGER | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### classifications
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| transaction_id | UUID | NOT NULL, UNIQUE, FK → transactions(id) |
| final_category | TEXT | NOT NULL |
| report_type | TEXT | NOT NULL |
| confidence | TEXT | NOT NULL |
| rule_used | TEXT | — |
| review_status | TEXT | NOT NULL, DEFAULT 'pending' |
| is_manual_correction | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### classification_rules (reservada - sin uso)
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| company_id | UUID | FK → companies(id) |
| pattern | TEXT | NOT NULL |
| category | TEXT | NOT NULL |
| report_type | TEXT | NOT NULL |
| priority | INTEGER | DEFAULT 0 |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### review_events
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| transaction_id | UUID | NOT NULL, FK → transactions(id) |
| action | TEXT | NOT NULL |
| previous_category | TEXT | — |
| new_category | TEXT | — |
| note | TEXT | — |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### report_exports
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| workspace_id | UUID | NOT NULL, FK → workspaces(id) |
| export_type | TEXT | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |

## Índices

```sql
-- v1_initial: PKs y FKs (implícitos en UUID PK + FK constraints)
-- v2_duplicate_fingerprint:
CREATE INDEX IF NOT EXISTS idx_uploaded_statements_hash
  ON uploaded_statements(file_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_fingerprint
  ON transactions(workspace_id, date, description, amount);
```

## 🔗 Enlaces Relacionados

- [[Base de Datos]]
- [[API Endpoints]]
- [[Decisiones Técnicas]]
