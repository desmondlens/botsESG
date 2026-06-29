# Framework Update Procedure
## Botsfirm ESG Assessment Platform

### When this procedure applies

This procedure must be followed whenever any of the following change:
- GRI Standards (current: 2021)
- IFRS S1 or S2 (current: June 2023)
- BSE Sustainability Disclosure Guidance (current: August 2024)
- IFC Performance Standards (current: 2012 edition)
- UN SDG classifications
- Emission factors (DEFRA, IPCC AR6, BPC grid factor)

### Procedure

1. **Director review** — Founding Director reviews the updated framework against the current indicator library and identifies affected indicators, disclosures, and emission factors.

2. **Impact assessment** — Document which assessments are in progress and may be affected. Notify assigned consultants.

3. **New indicators** — Create new indicators with an incremented version number. Do not delete or overwrite existing indicators. Mark superseded indicators as `is_active = false`.

4. **Emission factor updates** — Add new emission factor records with updated source citation. Do not overwrite existing records — historical snapshots reference them by value not by ID.

5. **IFRS disclosure templates** — Add new templates with updated guidance. Mark old templates as `is_active = false`.

6. **Migration** — Write a numbered migration SQL file. Have it reviewed before running against production.

7. **Snapshot integrity** — Confirm that all existing report snapshots remain reproducible using their captured `methodology_context` which includes a full snapshot of indicators, emission factors, and scoring config at the time of generation.

8. **Audit log entry** — Record the framework update in the audit log with `source_module = 'framework_update'`.

9. **Client notification** — Notify clients with in-progress assessments of any changes that may affect their data.

10. **Documentation** — Update this file with the new framework version and effective date.

### Version history

| Framework | Version | Effective date | Updated by |
|---|---|---|---|
| GRI Standards | 2021 | January 2023 | Botsfirm Solidarity |
| IFRS S1 | June 2023 | January 2024 | Botsfirm Solidarity |
| IFRS S2 | June 2023 | January 2024 | Botsfirm Solidarity |
| BSE Guidance | August 2024 | August 2024 | Botsfirm Solidarity |
| DEFRA emission factors | 2023 | January 2024 | Botsfirm Solidarity |
| BPC grid factor | Estimated 2023 | January 2024 | Botsfirm Solidarity |

### Residual risk

Historical assessments reference indicator labels and emission factor values captured in the snapshot at report generation time. Changes to the indicator library do not affect historical snapshots. However, if an emission factor value is updated in the database without creating a new record, historical GHG calculations may no longer be reproducible from the database alone — the snapshot `methodology_context` remains the authoritative source.