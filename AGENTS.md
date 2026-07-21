# Portfolio OS Engineering Principles

All future features and modules implemented in Portfolio OS must adhere strictly to the following modular architecture:

## Architectural Blueprint
```
Feature Module
├── UI Components     (Pure rendering, small, reusable, and highly composable)
├── Business Logic    (Custom hooks, state helpers, decoupled from UI)
├── Data Model        (Schema definitions, DB blueprints, seed structures)
├── Service Layer     (Decoupled engines handling storage, API/AI endpoints, cloud databases)
├── Validation        (Input constraints, boundary checks, file types validation)
├── Types             (TypeScript types, interfaces, and enums in src/types.ts or local modules)
└── Tests             (When applicable)
```

## Core Guidelines

1. **Decoupled Business Logic**: Business logic must never live directly inside UI components. Components should focus purely on visual presentation and user interactions.
2. **Service-Driven Integration**: All persistence, state synchronization, external APIs, AI capabilities, and future database connectors (such as Firebase Firestore or Cloud SQL) must reside in dedicated services under `src/services/` (e.g., `src/services/storageService.ts`).
3. **Small, Reusable & Composable Components**: Avoid bloating components. If any UI component grows too complex or handles multiple distinct visual sections, refactor and split it into dedicated child elements.
4. **Authenticity First**: Never fabricate career history, metrics, locations, or projects. Always use authentic user information or clear, easy-to-replace marked placeholders to maintain strict profile integrity.
