# SMART App — Template

## Cara Memulai

```bash
# 1. Copy template
cp -r apps/_template apps/my-app-name

# 2. Install dependencies
cd apps/my-app-name
npm install

# 3. Jalankan development server
npm run dev
```

## Struktur

```
src/
├── main.js        ← Entry point (import dari @smart/core + @smart/ui)
├── app.js         ← App configuration
├── config/
│   └── menu.js    ← Navigation menu
├── router/
│   └── index.js   ← Routes + pages
├── pages/         ← Page components
└── css/
    └── main.css   ← Global styles (gunakan design tokens!)

workspace/
└── workspace.json ← Workspace customization
```

## Dependencies

- `@smart/core` — Business engine (auth, permission, institution)
- `@smart/ui` — UI framework (tokens, components, layouts, workspaces)
