# GitHub Actions, Issues y Claude: cómo se combinan

Este documento explica, con los ejemplos reales de este repo (`MtAgia/claude-tetris`), qué es cada pieza y cómo trabajan juntas. Complementa a `GUIA-CLAUDE-GITHUB.md`, que cuenta la historia de la instalación inicial.

## 1. Las tres piezas

| Pieza | Qué es | Analogía |
|---|---|---|
| **Issue** | Un ticket dentro del repo: un bug, una idea o una pregunta. Tiene título, descripción, comentarios, labels y asignado. | Una tarea en un tablero |
| **GitHub Actions** | Sistema de automatización de GitHub. Ejecuta scripts (workflows) en máquinas virtuales de GitHub cuando ocurre un evento. | Un robot que reacciona a cosas que pasan en el repo |
| **Claude** | Un modelo de IA que, dentro de un workflow, puede leer el código, razonar y actuar (comentar, etiquetar, editar archivos, abrir PRs). | Un desarrollador que el robot "llama" cuando hace falta |

Idea central: **Issues generan eventos, Actions escucha esos eventos y ejecuta workflows, y un workflow puede invocar a Claude** para que haga trabajo que requiere entender código.

## 2. Issues

Un issue es la unidad de conversación del proyecto. Sirve para reportar bugs, proponer mejoras o hacer preguntas.

Partes importantes:

- **Título y descripción**: qué pasa y cómo reproducirlo.
- **Comentarios**: discusión. Cada comentario nuevo dispara el evento `issue_comment`.
- **Labels (etiquetas)**: clasifican el issue. Ejemplos de este repo: `bug`, `enhancement`, `area:rotation`, `priority:high`.
- **Assignees**: quién se encarga. Asignar un issue dispara el evento `issues` con tipo `assigned`.
- **Estado**: abierto o cerrado. Un PR puede cerrar un issue automáticamente si su descripción incluye `Closes #12`.

Eventos de issues que usan los workflows de este repo:

- `issues: opened` — se creó un issue.
- `issues: edited` — se editó el título o la descripción.
- `issues: assigned` — se asignó a alguien.
- `issue_comment: created` — alguien comentó (en un issue o en un PR).

## 3. GitHub Actions

### 3.1 Conceptos

- **Workflow**: un archivo YAML en `.github/workflows/`. Cada archivo es un workflow independiente.
- **Evento (`on:`)**: lo que dispara el workflow (un issue nuevo, un comentario, un PR, un push, un horario).
- **Job**: un grupo de pasos que corre en una máquina virtual (`runs-on: ubuntu-latest`).
- **Step**: un paso individual: ejecutar un comando (`run:`) o usar una acción ya hecha (`uses:`).
- **Action**: pieza reutilizable publicada por alguien. Ejemplos: `actions/checkout@v4` (descarga el repo) y `anthropics/claude-code-action@v1` (ejecuta Claude).
- **Secret**: valor sensible guardado en GitHub (Settings → Secrets and variables → Actions). Se lee con `${{ secrets.NOMBRE }}`. Nunca se escribe en el YAML.
- **Permissions**: qué puede hacer el token temporal del workflow (leer código, escribir issues, etc.). Conviene dar el mínimo necesario.

### 3.2 Estructura mínima de un workflow

```yaml
name: Nombre visible          # aparece en la pestaña Actions

on:                           # cuándo corre
  issues:
    types: [opened]

jobs:
  mi-job:
    if: condicion             # opcional: filtra si corre o no
    runs-on: ubuntu-latest    # máquina virtual
    permissions:              # permisos del token
      contents: read
      issues: write
    steps:
      - uses: actions/checkout@v4   # paso 1: descargar el repo
      - run: echo "hola"            # paso 2: ejecutar un comando
```

### 3.3 Regla importante sobre la rama

Para eventos como `issue_comment` o `issues`, GitHub usa **la versión del workflow que está en la rama por defecto (`main`)**. Si el YAML solo existe en otra rama, no se dispara. Por eso el instalador `/install-github-app` creó una rama y hubo que mergear el PR #2 para que funcionara (ver `GUIA-CLAUDE-GITHUB.md`).

Consecuencia práctica: **al modificar un workflow de issues, el cambio recién rige cuando se mergea a `main`.**

### 3.4 Dónde ver qué pasó

Pestaña **Actions** del repo: lista cada ejecución (run), con logs paso a paso. Si algo falla (token faltante, permisos, error de sintaxis), el motivo aparece ahí.

## 4. Cómo se combinan con Claude

La acción `anthropics/claude-code-action@v1` instala y ejecuta Claude Code dentro del runner de GitHub. Recibe:

- **Credenciales** (`claude_code_oauth_token` o `anthropic_api_key`) desde un secret.
- **Un prompt** (opcional). Si no hay prompt, Claude sigue las instrucciones del comentario donde lo mencionaron con `@claude`.
- **`claude_args`**: opciones del CLI, sobre todo `--allowedTools`, que limita qué herramientas puede usar.

Dentro del runner, Claude tiene el repo descargado, así que lee `CLAUDE.md` y el código igual que lo haría en tu terminal. Por eso `CLAUDE.md` debe estar commiteado: es el contexto que Claude lee también en GitHub.

Flujo general:

```
Evento en GitHub (issue, comentario, PR)
        |
        v
Workflow (.github/workflows/*.yml) evalúa `on:` e `if:`
        |
        v
Runner ubuntu-latest: checkout del repo
        |
        v
claude-code-action: Claude lee el contexto, razona y actúa
        |
        v
Resultado visible en GitHub: comentario, labels, commits, PR
```

## 5. Los tres workflows de este repo

### 5.1 `claude.yml` — Claude bajo demanda con `@claude`

- **Se dispara con**: comentarios en issues y PRs, reviews de PR, y issues nuevos o asignados.
- **Condición (`if:`)**: solo corre si el texto contiene `@claude`. Sin la mención, el workflow se omite y no gasta nada.
- **Qué hace**: ejecuta Claude con la instrucción que escribiste en el comentario.
- **Permisos**: lectura de contenido, PRs e issues, y lectura de resultados de CI (`actions: read`).
- **Ejemplos de uso**:
  - En un issue: `@claude analizá este bug y proponé un arreglo`.
  - En un PR: `@claude explicá qué cambia este PR`.
  - En un issue: `@claude implementá esto y abrí un PR`.

Para que Claude pueda modificar archivos y abrir PRs, los permisos de `contents` y `pull-requests` deben ser `write`. Hoy están en `read`, así que en la configuración actual Claude puede leer y comentar, pero no escribir código en el repo.

### 5.2 `claude-code-review.yml` — revisión automática de PRs

- **Se dispara con**: `pull_request` (abierto, nuevo commit, listo para review, reabierto).
- **Qué hace**: ejecuta el plugin `code-review`, que revisa el diff del PR y deja comentarios en línea.
- **No necesita `@claude`**: corre solo en cada PR.
- **Costo**: cada commit nuevo al PR (`synchronize`) vuelve a correr la revisión. Se puede limitar con el filtro `paths:` comentado en el YAML.

### 5.3 `claude-issue-triage.yml` — triage automático de issues

Este es el que une directamente issues, Actions y Claude.

- **Se dispara con**: `issues` en `opened` y `edited`.
- **Filtro (`if:`)**: ignora PRs y autores bot (`[bot]`) para evitar bucles infinitos.
- **`concurrency`**: si el mismo issue se edita varias veces seguidas, cancela la ejecución anterior y deja solo la última.
- **Paso 1 — labels**: un `run:` con `gh label create` crea los labels `area:*` y `priority:*` si no existen (el `|| true` evita fallar si ya existen).
- **Paso 2 — Claude**: recibe un prompt con reglas estrictas: no modificar archivos, no crear ramas ni PRs, no cerrar el issue. Su trabajo es:
  1. Leer el issue.
  2. Leer `CLAUDE.md` y el código relevante.
  3. Elegir labels de tipo, área y prioridad.
  4. Aplicarlos con `gh issue edit`.
  5. Publicar un único comentario de diagnóstico (con `--edit-last --create-if-none`, para actualizar el mismo comentario en vez de duplicarlo).
- **`--allowedTools`**: restringe a Claude a `gh issue view/edit/comment`, `gh label list`, `Read`, `Glob` y `Grep`. Aunque el prompt se lo pidiera, no podría ejecutar otros comandos ni editar archivos. Esta es la barrera real de seguridad; el prompt solo orienta.

Resultado: abrís un issue y en uno o dos minutos aparece clasificado con labels y con un comentario de diagnóstico que apunta a funciones concretas de `game.js`.

## 6. Los dos modos de usar Claude en GitHub

| | Automático (triage, review) | Bajo demanda (`@claude`) |
|---|---|---|
| Disparador | Evento de GitHub | Una persona lo menciona |
| Prompt | Fijo, escrito en el YAML | El texto del comentario |
| Control | Total sobre qué hace | Depende de lo que pidas |
| Costo | En cada evento que coincida | Solo cuando lo invocás |
| Ideal para | Tareas repetitivas y predecibles | Tareas puntuales y variadas |

Se pueden usar juntos: el triage clasifica el issue y diagnostica; después un humano comenta `@claude implementá la propuesta` para pasar a la acción.

## 7. Flujo completo de ejemplo

1. Abrís un issue: "La pieza I se sale del tablero al rotar junto a la pared".
2. Se dispara `claude-issue-triage.yml`. Claude lee `tryRotate()` en `game.js`, aplica `bug`, `area:rotation`, `priority:medium` y comenta el diagnóstico.
3. Leés el diagnóstico y, si estás de acuerdo, comentás `@claude implementá la solución y abrí un PR`.
4. Se dispara `claude.yml` (por la mención). Claude hace el cambio en una rama y abre un PR (requiere permisos `write`, ver 5.1).
5. Al abrirse el PR se dispara `claude-code-review.yml`, que deja comentarios de revisión en el diff.
6. Revisás, mergeás el PR y el issue se cierra si el PR incluía `Closes #N`.

## 8. Seguridad y costos

- **Secrets**: el token de Claude vive en `CLAUDE_CODE_OAUTH_TOKEN` (Settings → Secrets). Nunca lo pegues en un YAML ni en un issue.
- **Mínimo privilegio**: dar a cada workflow solo los `permissions` que necesita. El triage tiene `issues: write` y nada más de escritura.
- **Limitar herramientas**: usar `--allowedTools` en workflows automáticos. Un issue es texto de terceros; alguien podría escribir instrucciones maliciosas dentro (prompt injection). Con herramientas acotadas, el daño posible es mínimo.
- **Repos públicos**: cualquiera puede abrir un issue y disparar workflows de `issues`. La mención `@claude` en `claude.yml` solo actúa si quien comenta tiene permiso de escritura en el repo, pero el triage corre con cualquier issue. Vigilá el uso.
- **Costo**: cada ejecución consume cuota de tu cuenta de Claude y minutos de GitHub Actions. Los filtros `if:`, `paths:` y `concurrency:` reducen ejecuciones innecesarias.
- **Bucles**: un workflow que comenta o edita issues puede volver a dispararse a sí mismo. Por eso el triage filtra `[bot]` y usa un comentario único editable.

## 9. Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `@claude` no responde | El YAML no está en `main`, o el texto no contiene `@claude` | Verificar que el workflow esté en `main` y mirar la pestaña Actions |
| El run falla enseguida | Falta el secret `CLAUDE_CODE_OAUTH_TOKEN` | Crearlo en Settings → Secrets and variables → Actions |
| Claude dice que no puede ejecutar un comando | El comando no está en `--allowedTools` | Agregarlo a `claude_args` |
| Claude no puede hacer push ni abrir PR | `contents` y `pull-requests` en `read` | Cambiarlos a `write` en `claude.yml` |
| El triage no corre en un cambio nuevo | El cambio al YAML no está en `main` | Mergear el PR a `main` |
| El triage no etiqueta | El label no existe o no está en la lista del prompt | Revisar `gh label list` y el paso de creación de labels |
| Cambié el YAML y se rompió | Error de indentación o sintaxis | Mirar el log del run; el error indica la línea |

## 10. Glosario rápido

- **Runner**: la máquina virtual de GitHub que ejecuta el job.
- **Run**: una ejecución concreta de un workflow.
- **Trigger / evento**: lo que dispara el workflow.
- **Label**: etiqueta de clasificación en issues y PRs.
- **`gh`**: CLI oficial de GitHub; los workflows lo usan para leer y editar issues.
- **`GITHUB_TOKEN`**: token temporal que GitHub genera en cada run, con los permisos declarados en `permissions:`.
- **Prompt injection**: texto malicioso en una entrada (por ejemplo, un issue) que intenta darle órdenes a la IA.
