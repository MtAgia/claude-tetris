# Usar @claude en GitHub: qué pasó y cómo funciona

## Objetivo

Poder escribir `@claude` en un issue (o PR) del repo `MtAgia/claude-tetris` y que Claude responda y trabaje desde GitHub Actions.

## Cómo funciona

1. Escribís un comentario con `@claude` en un issue o PR.
2. GitHub detecta el evento (`issue_comment`, `issues`, etc.).
3. Se ejecuta el workflow `.github/workflows/claude.yml`.
4. Ese workflow corre la acción de Claude Code, que lee el issue, el código y responde o abre cambios.

Para que el paso 3 ocurra, **el archivo yml tiene que estar en la rama por defecto (`main`)**. GitHub solo dispara workflows de eventos como `issue_comment` usando la versión que está en `main`.

## Qué pasó

`/install-github-app` hizo dos cosas:

- Instaló la GitHub App de Claude en el repo.
- Creó los workflows, pero **en una rama nueva** (`add-claude-github-actions-1792554514230`), no en `main`. No abrió el Pull Request.

Resultado: el yml existía en GitHub, pero en una rama que nadie había mergeado. Por eso `@claude` no hacía nada y localmente no veías `.github/workflows/`.

Archivos creados:

- `.github/workflows/claude.yml`: responde a menciones `@claude` en issues y PRs.
- `.github/workflows/claude-code-review.yml`: revisión automática de PRs.

## Procedimiento con git

Cómo lo diagnostiqué:

```bash
git status --short              # solo CLAUDE.md sin trackear: el yml no estaba local
ls .github/workflows            # no existe en main
git remote -v                   # origin = github.com/MtAgia/claude-tetris
git branch -a                   # aparece remotes/origin/add-claude-github-actions-...
git fetch origin                # traer info actualizada del remoto
git diff --stat main origin/add-claude-github-actions-1792554514230
                                # muestra los 2 yml que difieren con main
gh pr list --state all          # vacío: nunca se abrió PR
```

Cómo se arregla:

```bash
# 1. Abrir el Pull Request de la rama del instalador hacia main
gh pr create --base main \
  --head add-claude-github-actions-1792554514230 \
  --title "Add Claude Code GitHub workflows"
# -> https://github.com/MtAgia/claude-tetris/pull/2

# 2. Mergearlo (también se puede con el botón "Merge pull request" en GitHub)
gh pr merge 2 --merge --delete-branch

# 3. Traer main actualizado a tu copia local
git checkout main
git pull origin main
ls .github/workflows            # ahora deberían aparecer los dos yml
```

## Conceptos clave

- **Rama (branch):** línea de trabajo paralela. Los cambios en una rama no afectan a `main` hasta que se mergean.
- **Pull Request (PR):** pedido para incorporar una rama a otra (acá, a `main`). Permite revisar antes de mergear.
- **Merge:** une los cambios de la rama en `main`.
- **`origin`:** nombre del repo remoto en GitHub.
- **`git fetch`:** baja información del remoto sin tocar tus archivos. **`git pull`:** fetch + merge en tu rama actual.
- **Rama por defecto:** la que GitHub usa para ejecutar workflows de ciertos eventos. Acá es `main`.

## Checklist para que funcione

1. Mergear el PR #2 a `main`.
2. Tener un secret en el repo: GitHub → Settings → Secrets and variables → Actions:
   - `ANTHROPIC_API_KEY`, o
   - `CLAUDE_CODE_OAUTH_TOKEN`.
   Sin esto el workflow falla.
3. Probar: crear un issue y comentar `@claude hola`.
4. Si no responde, mirar la pestaña **Actions** del repo para ver el error.

## Nota

`CLAUDE.md` sigue sin commitear (aparecía como `??` en `git status`). Si querés que Claude lo use también en GitHub, hay que subirlo:

```bash
git add CLAUDE.md
git commit -m "Add CLAUDE.md"
git push origin main
```
