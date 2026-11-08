# Reglas del Repositorio para Agentes (Antigravity, Gemini, etc.)

## 🚀 Sincronización y Git: Pushear Siempre a Main
- **Regla estricta**: Tras completar cualquier tarea, refactorización, corrección de errores o nueva característica, y tras verificar el proyecto con `node scripts/check-project.js`:
  1. Agrega todos los cambios: `git add -A`
  2. Haz commit con mensaje descriptivo en español: `git commit -m "..."`
  3. Rebasea si hay cambios remotos: `git pull --rebase -X theirs origin main`
  4. **Pushea siempre a `main` y `gh-pages`**: `git push origin main gh-pages`
- **Nunca dejes cambios de código sin pushear** al finalizar una interacción si el trabajo está terminado y probado.
