# Spec & Prompt : Réécriture de la détection d'aire (Area Region Detection)

## Contexte

L'éditeur de graphiques de Correcta (`components/exams/graph-editor/`) permet de dessiner des fonctions, lignes, segments et courbes sur un canvas Konva. Une feature "Aire" permet de drop un point de contrôle sur le canvas, et l'aire doit automatiquement détecter la **région fermée** entourant ce point, puis la remplir d'une couleur translucide.

### Problèmes actuels

1. **Le quadrillage est compté comme frontière** — la détection ne filtre pas les éléments du grid
2. **L'aire déborde au-delà des intersections** — quand deux courbes se croisent, l'aire continue au-delà du point d'intersection au lieu de s'arrêter
3. **L'extension aux zones adjacentes échoue** — le mécanisme `ignoredBoundaries` ne recalcule pas correctement les nouvelles frontières
4. **L'approche est un patchwork de cas spéciaux** — le code traite séparément "2 fonctions", "fonction + ligne verticale", "fonction + axe x", etc., ce qui est impossible à maintenir

### Stratégie : réécriture ciblée

On **SUPPRIME ET RÉÉCRIT** uniquement :
- `region-detection/boundary-tracer.ts` → nouveau module `region-detection/region-finder.ts`
- La logique `handleDragEnd` dans `EditableArea.tsx` → appel propre au nouveau détecteur
- La logique `handleBoundaryToggle` dans `EditableArea.tsx` → utilise le même détecteur avec `ignoredBoundaries`

On **GARDE INTACT** :
- `region-detection/intersection-solver.ts` (les fonctions d'intersection marchent bien)
- Toute la partie UI/rendu de `EditableArea.tsx` (Konva, le drag, les boutons +/−, le label)
- `types.ts`, `coordinate-utils.ts`, `snapping-utils.ts`
- `AreaPropertiesPanel.tsx`
- `ShapePalette.tsx` et `predefinedShapes.ts`
- Le type `GraphArea` dans `types/exams.ts`
- `graph-utils.ts` (compileExpression, etc.)

---

## Architecture du nouveau module

### Fichier : `region-detection/region-finder.ts`

Ce fichier remplace `boundary-tracer.ts` et exporte UNE fonction principale :

```typescript
export function findEnclosingRegion(
  dropPoint: { x: number; y: number },
  elements: RegionElement[],
  axes: GraphAxes,
  ignoredBoundaryIds?: string[]
): RegionResult | null
```

### Types

```typescript
/** Un élément qui peut servir de frontière */
export type RegionElement =
  | { type: 'function'; id: string; element: GraphFunction }
  | { type: 'line'; id: string; element: GraphLine }
  // PAS d'axes automatiques — les axes ne sont des frontières que si 
  // l'utilisateur les ajoute explicitement

/** Résultat de la détection */
export interface RegionResult {
  /** Le polygone fermé de la région (liste de points) */
  polygon: Array<{ x: number; y: number }>
  /** IDs des éléments qui forment la frontière de cette région */
  boundaryIds: string[]
  /** Domaine X de la région */
  domain: { min: number; max: number }
}
```

### Algorithme : "Sweep-line Region Detection"

L'idée est de **discrétiser le plan** en segments verticaux fins, et pour chaque x, trouver la bande verticale contenant le point de drop.

#### Étape 1 : Collecter toutes les courbes comme polylignes

```
Pour chaque élément (sauf ceux dans ignoredBoundaryIds) :
  - Si c'est une fonction → échantillonner en N points sur [axes.xMin, axes.xMax]
  - Si c'est une ligne (kind='line') → 2 points aux bords du canvas
  - Si c'est un segment (kind='segment') → 2 points (start, end)
  - Si c'est un ray → start + point au bord du canvas dans la direction du ray
  
  Chaque polyligne a son ID d'élément associé.
```

#### Étape 2 : Trouver TOUTES les intersections

```
Pour chaque paire de polylignes :
  Utiliser les fonctions existantes de intersection-solver.ts :
  - findFunctionIntersections (entre 2 fonctions)
  - findLineFunctionIntersection (ligne + fonction)
  - findLineLineIntersection (2 lignes)
  
  Stocker les x des intersections.
```

#### Étape 3 : Identifier le "couloir vertical" contenant le drop point

```
Trier toutes les x d'intersection.
Trouver le segment [xLeft, xRight] tel que :
  xLeft ≤ dropPoint.x ≤ xRight
  Il n'y a aucune intersection entre xLeft et xRight pour les courbes
  qui sont juste au-dessus et juste en-dessous du drop point.

Si le drop est avant la première intersection : xLeft = axes.xMin
Si le drop est après la dernière intersection : xRight = axes.xMax
```

#### Étape 4 : Trouver les courbes "au-dessus" et "en-dessous"

```
Au x du drop point :
  Évaluer toutes les polylignes à ce x.
  
  curveAbove = la polyligne la plus proche AU-DESSUS du drop point (plus petit y > dropPoint.y)
  curveBelow = la polyligne la plus proche EN-DESSOUS du drop point (plus grand y < dropPoint.y)
  
  Si l'une des deux est absente → la région n'est pas fermée verticalement → return null
  
  NOTE : "au-dessus" et "en-dessous" sont en coordonnées graphiques (y croissant vers le haut)
```

#### Étape 5 : Affiner le domaine avec les intersections de ces 2 courbes

```
Parmi toutes les intersections entre curveAbove et curveBelow :
  Trouver la plus grande intersection < dropPoint.x → c'est xLeft
  Trouver la plus petite intersection > dropPoint.x → c'est xRight

IMPORTANT : Vérifier aussi que dans [xLeft, xRight], les deux courbes
restent respectivement au-dessus et en-dessous. Si elles se croisent
avec une AUTRE courbe qui passe entre les deux, il faut couper le domaine.
```

#### Étape 6 : Vérifier la fermeture latérale

```
Aux x = xLeft et x = xRight :
  Vérifier que curveAbove et curveBelow se rejoignent (intersection)
  OU qu'une frontière verticale (segment vertical, bord du canvas) ferme la région.
  
  Si la région n'est pas fermée → return null
```

#### Étape 7 : Générer le polygone

```
Échantillonner curveAbove de xLeft à xRight → points du haut (gauche→droite)
Échantillonner curveBelow de xLeft à xRight → points du bas (droite→gauche, inversés)
Concaténer → polygone fermé

Si des segments verticaux ferment les côtés, ajouter les points de jonction.
```

#### Étape 8 : Clipper par les segments obliques

```
S'il y a des segments obliques (ni verticaux ni horizontaux) dans la zone :
  Utiliser l'algorithme de Sutherland-Hodgman existant (clipPolygonBySegments)
  pour découper le polygone.
  Garder le côté contenant le dropPoint.
```

### Détail important : échantillonnage des fonctions

```typescript
function sampleElement(
  element: RegionElement,
  axes: GraphAxes,
  numSamples: number = 200  // Plus que l'actuel 60 pour plus de précision
): Array<{ x: number; y: number }> {
  // ...
  // IMPORTANT : pour les fonctions avec offsetX, offsetY, scaleY,
  // appliquer les transformations comme dans le code existant :
  // y = scaleY * f(x - offsetX) + offsetY
}
```

### Détail important : filtrage du grid

Le grid n'est **jamais** un élément de `RegionElement[]`. Seuls les éléments explicitement ajoutés par l'utilisateur (fonctions, lignes, segments, courbes) sont passés au détecteur. Le filtrage se fait dans `EditableArea.tsx` en construisant la liste `elements` à partir de `props.functions` et `props.lines`.

---

## Modifications dans `EditableArea.tsx`

### Nouveau `handleDragEnd` (remplace les ~200 lignes actuelles)

```typescript
const handleDragEnd = useCallback((e: any) => {
  const node = e.target
  const newPos = pixelToGraph({ x: node.x(), y: node.y() }, axes, width, height)

  // 1. Construire la liste des éléments (PAS le grid, PAS les axes auto)
  const elements: RegionElement[] = [
    ...functions.map(fn => ({ type: 'function' as const, id: fn.id, element: fn })),
    ...lines.map(ln => ({ type: 'line' as const, id: ln.id, element: ln })),
  ]

  // 2. Appeler le détecteur
  const result = findEnclosingRegion(
    newPos,
    elements,
    axes,
    area.ignoredBoundaries
  )

  // 3. Mettre à jour l'aire
  if (result && result.polygon.length >= 3) {
    const newPoints: GraphAnchor[] = result.polygon.map(pt => ({
      type: 'coord' as const,
      x: pt.x,
      y: pt.y,
    }))

    onUpdate({
      ...area,
      mode: 'bounded-region',
      boundaryIds: result.boundaryIds,
      domain: result.domain,
      points: newPoints,
      labelPos: newPos,
    })
  } else {
    // Pas de région fermée trouvée, juste déplacer le control point
    onUpdate({
      ...area,
      labelPos: newPos,
    })
  }

  setDragPos(null)
}, [area, functions, lines, axes, width, height, onUpdate])
```

### Nouveau `handleBoundaryToggle` (simplifié)

```typescript
const handleBoundaryToggle = useCallback((boundaryId: string) => {
  const isCurrentlyIgnored = area.ignoredBoundaries?.includes(boundaryId) || false
  
  const newIgnored = isCurrentlyIgnored
    ? (area.ignoredBoundaries || []).filter(id => id !== boundaryId)
    : [...(area.ignoredBoundaries || []), boundaryId]

  // Recalculer avec le nouveau set de boundaries ignorées
  const elements: RegionElement[] = [
    ...functions.map(fn => ({ type: 'function' as const, id: fn.id, element: fn })),
    ...lines.map(ln => ({ type: 'line' as const, id: ln.id, element: ln })),
  ]

  const result = findEnclosingRegion(
    controlPoint,  // Utiliser la position actuelle du control point
    elements,
    axes,
    newIgnored
  )

  if (result && result.polygon.length >= 3) {
    onUpdate({
      ...area,
      mode: 'bounded-region',
      boundaryIds: result.boundaryIds,
      domain: result.domain,
      points: result.polygon.map(pt => ({ type: 'coord' as const, x: pt.x, y: pt.y })),
      ignoredBoundaries: newIgnored,
    })
  } else {
    onUpdate({
      ...area,
      ignoredBoundaries: newIgnored,
    })
  }
}, [area, controlPoint, functions, lines, axes, onUpdate])
```

### Fonctions à SUPPRIMER de `EditableArea.tsx`

Supprimer ces fonctions locales qui sont remplacées par `region-finder.ts` :
- `sampleFunctionInDomain` (la locale, pas celle de boundary-tracer)
- `sampleLineInDomain`
- `findNearestFunction`
- `findNearestLine`
- `isVerticalLine`
- `getVisibleAxes`
- `isHorizontalLine`
- `getLineYAtX`
- `isPointNearSegment`
- `pointLineSide`
- `segmentIntersection`
- `clipPolygonBySegments`
- `resolveAnchorX`
- `resolveAnchorY`
- `generatePolygonBetweenLineAndFunction`
- `generatePolygonUnderFunction`

Si certaines sont utilisées par les `boundaryButtons` (le useMemo pour afficher les boutons +/−), les déplacer dans un utilitaire ou simplifier.

---

## Mise à jour de `region-detection/index.ts`

```typescript
// Intersection solver exports (INCHANGÉ)
export {
  findFunctionIntersections,
  findLineFunctionIntersection,
  findLineLineIntersection,
} from './intersection-solver'

// Region finder (NOUVEAU, remplace boundary-tracer)
export {
  findEnclosingRegion,
} from './region-finder'

export type { RegionElement, RegionResult } from './region-finder'
```

### Supprimer le fichier `boundary-tracer.ts`

Supprimer entièrement `region-detection/boundary-tracer.ts`. Son contenu est remplacé par `region-finder.ts`.

### Mettre à jour `boundary-tracer.test.ts` → `region-finder.test.ts`

Réécrire les tests pour tester `findEnclosingRegion` avec les cas suivants :

```typescript
// Test 1 : Région entre x² et x (les deux fonctions se croisent en x=0 et x=1)
// Drop point à (0.5, 0.3) → doit retourner un polygone dans [0, 1]

// Test 2 : Région entre x² et une droite y = 2x - 1
// Drop point entre les intersections

// Test 3 : Région fermée par un segment vertical
// Fonction x² + segment vertical à x=1 + axe x=0 implicite

// Test 4 : Pas de région fermée (drop dans le vide)
// Une seule courbe, pas de frontière opposée → retourne null

// Test 5 : ignoredBoundaries 
// 3 fonctions, ignorer celle du milieu → la région s'étend

// Test 6 : Segments obliques
// Fonction + segment diagonal → le polygone est correctement clippé
```

---

## Fichiers à modifier (résumé)

| Fichier | Action |
|---------|--------|
| `region-detection/boundary-tracer.ts` | **SUPPRIMER** |
| `region-detection/boundary-tracer.test.ts` | **RENOMMER** → `region-finder.test.ts`, réécrire |
| `region-detection/region-finder.ts` | **CRÉER** (nouveau module) |
| `region-detection/index.ts` | **MODIFIER** (changer les exports) |
| `canvas/shapes/EditableArea.tsx` | **MODIFIER** (remplacer handleDragEnd, handleBoundaryToggle, supprimer fonctions locales) |

## Fichiers à NE PAS TOUCHER

| Fichier | Raison |
|---------|--------|
| `region-detection/intersection-solver.ts` | Fonctionne correctement |
| `region-detection/intersection-solver.test.ts` | Tests existants valides |
| `types.ts` | Pas de changement de types nécessaire |
| `coordinate-utils.ts` | Utilitaires de conversion OK |
| `snapping-utils.ts` | Système de snap indépendant |
| `AreaPropertiesPanel.tsx` | UI des propriétés, pas impactée |
| `ShapePalette.tsx` | Palette de formes, pas impactée |
| `templates/` | Templates prédéfinis, pas impactés |
| `GraphCanvas.tsx` | Rendu canvas, pas impacté |
| `SimpleGraphEditor.tsx` | Éditeur simple, pas impacté |
| `AdvancedGraphEditor.tsx` | Éditeur avancé, pas impacté |
| `GraphEditorPopup.tsx` | Popup wrapper, pas impacté |
| `GraphEditorWrapper.tsx` | Wrapper de mode, pas impacté |
| `types/exams.ts` | Type GraphArea inchangé |
| `graph-utils.ts` | compileExpression etc. inchangé |

---

## Contraintes techniques

- **Framework** : React + TypeScript + Konva (react-konva)
- **Évaluation des fonctions** : utiliser `compileExpression` de `@/components/exams/graph-utils` (retourne `(x: number) => number | null`)
- **Transformations des fonctions** : `y = scaleY * f(x - offsetX) + offsetY`
- **Coordonnées** : y croissant vers le haut (coordonnées graphiques), PAS les coordonnées pixel
- **Performance** : le calcul se fait au `dragEnd`, pas en temps réel. Mais il doit être < 50ms pour un graphe avec ~10 éléments
- **Précision** : échantillonner à 200 points minimum. Tolérance d'intersection = 0.0001
- **Lignes** : une `GraphLine` a un `kind` ('segment' | 'line' | 'ray'). Les 'line' sont infinies, les 'segment' ont deux extrémités, les 'ray' partent d'un point dans une direction

## Cas limites à gérer

1. **Drop point exactement sur une courbe** → pas de région fermée, return null
2. **Deux courbes qui ne se croisent jamais** → la région est ouverte latéralement, besoin de segments verticaux ou bords du canvas pour fermer
3. **Fonction avec des discontinuités** (ex: 1/x) → échantillonner proprement, skip les NaN/Infinity
4. **Segment qui ne couvre qu'une partie du domaine** → ne forme une frontière que dans sa zone
5. **Plusieurs régions possibles** (ex: sin(x) crée plusieurs poches) → retourner SEULEMENT celle contenant le drop point
