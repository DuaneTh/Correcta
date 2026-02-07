# Phase 9: Graph Editor Overhaul - Research

**Researched:** 2026-02-02
**Domain:** Interactive canvas-based graph editor with drag-and-drop UI and mathematical function support
**Confidence:** MEDIUM-HIGH

## Summary

This research investigated how to build a dual-mode graph editor (simple drag-and-drop + advanced function-based) for mathematical graphs in React. The current system has a fully functional graph renderer and data model but uses form-heavy UX. The goal is to add PowerPoint-like manipulation for predefined shapes while maintaining the existing function-based editing as an "advanced mode."

**Key findings:**
- **Canvas library choice**: react-konva is the standard for React canvas manipulation with drag-and-drop, offering better performance than SVG for many interactive objects and excellent React integration
- **Architecture pattern**: Dual-mode editors use a mode switcher (dropdown/tabs) with shared state, where simple mode provides direct manipulation of predefined templates and advanced mode exposes full configuration
- **Critical insight**: The existing graph data model (GraphSegment types) is excellent and should be preserved. Build the new UI on top of it, not replace it.

**Primary recommendation:** Use react-konva for the simple drag-and-drop mode canvas, integrate dnd-kit for shape palette drag-and-drop, keep the existing form-based editor as "advanced mode", and share the same GraphSegment state model between both modes.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-konva | 18.x | Canvas manipulation in React | Official React bindings for Konva.js, declarative API, excellent performance for interactive graphics, built-in drag-and-drop support |
| konva | 9.x | HTML5 Canvas rendering | High-performance 2D canvas library, optimized for animations and frequent updates, excellent event handling, mobile support |
| dnd-kit | 6.x | Drag and drop from palette | Modern, accessible drag-and-drop toolkit for React, lightweight, smooth performance, flexible architecture |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | 5.x (already installed) | State management | Already in use for exam editor state, suitable for managing graph editor mode and canvas state |
| math.js | 11.x | Expression parsing/evaluation | Alternative to custom LaTeX→JS parser if replacing current system (though current system works) |
| interact.js | 1.10.x | Multi-touch gestures, resizing | If adding resize handles, rotation, or multi-touch support to shapes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-konva | fabric.js + react-fabric | Fabric has more built-in shape library but heavier bundle, less React-idiomatic |
| react-konva | Pure SVG with react-draggable-svg | SVG better for few objects, worse performance with many objects (>100), but easier DOM integration |
| dnd-kit | react-dnd | react-dnd is older, dnd-kit is more modern with better accessibility and performance |

**Installation:**
```bash
npm install react-konva konva dnd-kit@latest
```

## Architecture Patterns

### Recommended Project Structure
```
components/exams/
├── graph-editor/
│   ├── GraphEditorWrapper.tsx        # Mode switcher, state coordination
│   ├── SimpleGraphEditor.tsx          # Drag-and-drop canvas mode
│   ├── AdvancedGraphEditor.tsx        # Current form-based editor (refactored from SegmentedMathField)
│   ├── ShapePalette.tsx               # Draggable predefined shapes library
│   ├── canvas/
│   │   ├── GraphCanvas.tsx            # react-konva Stage/Layer
│   │   ├── shapes/
│   │   │   ├── EditablePoint.tsx      # Draggable point with handles
│   │   │   ├── EditableLine.tsx       # Draggable line with endpoints
│   │   │   ├── EditableCurve.tsx      # Bezier curve with control points
│   │   │   ├── EditableFunction.tsx   # Function plot with domain handles
│   │   │   └── EditableArea.tsx       # Area fill with boundary points
│   │   └── transforms/
│   │       ├── DragHandle.tsx         # Reusable drag handle component
│   │       └── SelectionBox.tsx       # Multi-select box
│   └── templates/
│       ├── predefinedShapes.ts        # Library of common shapes
│       └── shapeCategories.ts         # Categorized shape templates
```

### Pattern 1: Dual-Mode Editor with Shared State

**What:** Two distinct UI modes (simple/advanced) that operate on the same underlying data model (GraphSegment). Mode switcher at top, shared state managed by zustand or React context.

**When to use:** When you need beginner-friendly UI for common tasks but expert users need full control. User switches modes explicitly via dropdown/tabs.

**Example:**
```typescript
// Shared state model (already exists in types/exams.ts)
type GraphSegment = {
  id: string
  type: 'graph'
  axes: GraphAxes
  points: GraphPoint[]
  lines: GraphLine[]
  curves: GraphCurve[]
  functions: GraphFunction[]
  areas: GraphArea[]
  texts: GraphText[]
  width?: number
  height?: number
  background?: string
}

// Mode management
type EditorMode = 'simple' | 'advanced'

function GraphEditorWrapper({ value, onChange }: GraphEditorProps) {
  const [mode, setMode] = useState<EditorMode>('simple')
  const [graph, setGraph] = useState<GraphSegment>(normalizeGraphPayload(value))

  // Both modes share this handler
  const handleGraphChange = (updated: GraphSegment) => {
    setGraph(updated)
    onChange(updated)
  }

  return (
    <div>
      <select value={mode} onChange={(e) => setMode(e.target.value as EditorMode)}>
        <option value="simple">Mode simple</option>
        <option value="advanced">Mode avancé</option>
      </select>

      {mode === 'simple' ? (
        <SimpleGraphEditor graph={graph} onChange={handleGraphChange} />
      ) : (
        <AdvancedGraphEditor graph={graph} onChange={handleGraphChange} />
      )}
    </div>
  )
}
```

### Pattern 2: Template-Based Shape Insertion

**What:** Predefined shape templates (parabolas, circles, common functions) that users drag onto canvas. Template creates GraphSegment elements with sensible defaults.

**When to use:** Simple mode. User drags "parabola" icon, system creates a GraphFunction with expression "x^2" and appropriate domain.

**Example:**
```typescript
// templates/predefinedShapes.ts
export const SHAPE_TEMPLATES = {
  parabola: {
    type: 'function' as const,
    expression: 'x^2',
    domain: { min: -5, max: 5 },
    style: { color: '#2563eb', width: 2 }
  },
  circle: {
    type: 'curve' as const,
    // Use parametric representation or multiple curves
    // OR: Generate multiple curve segments to approximate circle
  },
  line: {
    type: 'line' as const,
    start: { type: 'coord' as const, x: -3, y: -2 },
    end: { type: 'coord' as const, x: 3, y: 2 },
    kind: 'line' as const,
    style: { color: '#111827', width: 1.5 }
  }
}

// User drags "parabola" from palette
function handleShapeDrop(templateKey: string, position: { x: number, y: number }) {
  const template = SHAPE_TEMPLATES[templateKey]
  const newElement = {
    id: createId(),
    ...template,
    // Adjust position based on canvas coordinates
  }

  if (template.type === 'function') {
    setGraph(prev => ({
      ...prev,
      functions: [...prev.functions, newElement as GraphFunction]
    }))
  }
  // Similar for other types
}
```

### Pattern 3: react-konva Shape with Drag Handles

**What:** Konva shapes (Circle, Line, Path) wrapped in React components with draggable behavior. Sync Konva state changes back to GraphSegment data model.

**When to use:** Simple mode canvas. Each graph element becomes a Konva shape with drag/transform handles.

**Example:**
```typescript
// canvas/shapes/EditablePoint.tsx
import { Circle } from 'react-konva'

function EditablePoint({
  point,
  axes,
  canvasWidth,
  canvasHeight,
  onUpdate
}: EditablePointProps) {
  const pixelCoords = graphToPixel(point, axes, canvasWidth, canvasHeight)

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const newPixelX = e.target.x()
    const newPixelY = e.target.y()
    const newGraphCoords = pixelToGraph({ x: newPixelX, y: newPixelY }, axes, canvasWidth, canvasHeight)

    onUpdate({
      ...point,
      x: newGraphCoords.x,
      y: newGraphCoords.y
    })
  }

  return (
    <Circle
      x={pixelCoords.x}
      y={pixelCoords.y}
      radius={point.size || 4}
      fill={point.filled ? point.color : 'white'}
      stroke={point.color || '#111827'}
      strokeWidth={1.5}
      draggable
      onDragEnd={handleDragEnd}
    />
  )
}

// Coordinate conversion helpers
function graphToPixel(point: {x: number, y: number}, axes: GraphAxes, width: number, height: number) {
  const xRange = axes.xMax - axes.xMin
  const yRange = axes.yMax - axes.yMin
  return {
    x: ((point.x - axes.xMin) / xRange) * width,
    y: height - ((point.y - axes.yMin) / yRange) * height
  }
}

function pixelToGraph(pixel: {x: number, y: number}, axes: GraphAxes, width: number, height: number) {
  const xRange = axes.xMax - axes.xMin
  const yRange = axes.yMax - axes.yMin
  return {
    x: (pixel.x / width) * xRange + axes.xMin,
    y: ((height - pixel.y) / height) * yRange + axes.yMin
  }
}
```

### Pattern 4: Shape Palette with dnd-kit

**What:** Sidebar or toolbar with draggable shape icons. Uses dnd-kit's useDraggable for palette items and custom drop handler for canvas.

**When to use:** Simple mode shape insertion. Alternative to click-to-add buttons.

**Example:**
```typescript
// ShapePalette.tsx
import { useDraggable } from '@dnd-kit/core'

function ShapePaletteItem({ template }: { template: ShapeTemplate }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `palette-${template.id}`,
    data: { template }
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`
  } : undefined

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <ShapeIcon template={template} />
      <span>{template.label}</span>
    </div>
  )
}

// In canvas component
import { useDroppable } from '@dnd-kit/core'

function GraphCanvas() {
  const { setNodeRef } = useDroppable({ id: 'graph-canvas' })

  const handleDrop = (event: DragEndEvent) => {
    const { active, over } = event
    if (over?.id === 'graph-canvas') {
      const template = active.data.current.template
      const canvasRect = canvasRef.current.getBoundingClientRect()
      const dropPosition = {
        x: event.activatorEvent.clientX - canvasRect.left,
        y: event.activatorEvent.clientY - canvasRect.top
      }
      insertShapeFromTemplate(template, dropPosition)
    }
  }

  return (
    <DndContext onDragEnd={handleDrop}>
      <div ref={setNodeRef}>
        {/* Konva Stage */}
      </div>
    </DndContext>
  )
}
```

### Anti-Patterns to Avoid

- **Don't replace GraphSegment types**: The current data model is excellent (supports anchoring, functions, areas, etc.). Build UI on top of it, don't create parallel state.
- **Don't manipulate DOM directly in React**: Use Konva's declarative API via react-konva, not imperative Konva API. Let React manage component lifecycle.
- **Don't ignore coordinate systems**: Always convert between pixel coordinates (canvas) and graph coordinates (mathematical). Easy to get wrong.
- **Don't update on every mousemove**: Update preview visually, but only commit to state on dragEnd/click to avoid performance issues.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Canvas drag-and-drop | Custom mouse event handlers with transform calculations | react-konva's draggable prop | Handles edge cases: touch events, boundaries, event bubbling, transform composition. Very tricky to get right. |
| Drag from palette to canvas | Custom mouse tracking across elements | dnd-kit's useDraggable + useDroppable | Handles accessibility (keyboard navigation), screen readers, pointer events vs mouse events, multi-touch. |
| Shape resize handles | Custom corner drag logic | interact.js or Konva Transformer | Handles aspect ratio, min/max constraints, rotation, multi-select resizing. Complex math. |
| Coordinate conversion | Manual pixel↔graph calculations everywhere | Centralized conversion utilities | Easy to introduce bugs with inconsistent conversions, especially with non-uniform scaling. |
| Function plotting | Sample points with for loop | Existing graph-utils.ts sampleFunction | Already handles domain limiting, discontinuities, error handling. Don't duplicate. |
| Expression parsing | Regex-based string parsing | Existing convertLatexToExpression in graph-utils.ts OR math.js parser | LaTeX parsing is full of edge cases (nested braces, commands, implicit multiplication). Current system works. |

**Key insight:** Canvas manipulation looks simple in demos but production-ready implementations need touch support, accessibility, undo/redo, selection, transform composition, and edge cases. Libraries exist because this is hard.

## Common Pitfalls

### Pitfall 1: SVG vs Canvas Performance Cliff

**What goes wrong:** Using SVG with many interactive elements (>50 shapes) causes janky drag performance. Each SVG element is a DOM node with React component lifecycle overhead.

**Why it happens:** SVG integrates with HTML/CSS (good for styling) but every element produces DOM nodes React must manage, attach event handlers, and update. With 100+ shapes, this becomes expensive.

**How to avoid:**
- Use Canvas (via react-konva) for the interactive editor where performance matters
- Continue using SVG for static rendering (current graph-utils.ts renderer) in read-only views
- Rule of thumb: <20 shapes → SVG fine, 20-100 → Canvas better, >100 → Canvas strongly recommended

**Warning signs:** Drag operations feel laggy, mousemove events lag behind cursor, browser DevTools show long React reconciliation times.

### Pitfall 2: Coordinate System Confusion

**What goes wrong:** Mixing pixel coordinates (canvas space) and graph coordinates (mathematical space) leads to shapes appearing in wrong positions, especially when canvas resizes or axes change.

**Why it happens:**
- Canvas uses (0,0) at top-left, Y increases downward
- Graph uses (xMin, yMin) at bottom-left, Y increases upward
- Different scaling on X and Y axes
- Canvas can be resized, changing pixel-per-unit ratio

**How to avoid:**
- Always store data in graph coordinates (GraphPoint has x,y in graph space)
- Convert to pixel coordinates only for rendering
- Create centralized graphToPixel() and pixelToGraph() utilities
- Update pixel positions when axes or canvas size changes
- Never store pixel coordinates in state

**Warning signs:** Shapes jump when axes change, aspect ratio looks wrong, drag operations don't follow cursor precisely.

### Pitfall 3: React Re-render Performance with Canvas

**What goes wrong:** Every state change re-renders entire canvas, causing all Konva shapes to recreate. With 100+ shapes, this causes stuttering.

**Why it happens:** React's default behavior reconciles entire component tree on state change. Each Konva shape is a React component, so all re-render even if only one shape changed.

**How to avoid:**
- Use React.memo on individual shape components
- Pass stable references (useCallback for event handlers, useMemo for computed props)
- Structure state to minimize affected components (don't store all shapes in one array if possible)
- Use Konva's caching API for complex shapes that don't change often
- Consider Zustand subscriptions for granular updates (already used in codebase)

**Warning signs:** DevTools React Profiler shows many components re-rendering on single drag, FPS drops during interaction, delayed state updates.

### Pitfall 4: Forgetting Undo/Redo for Visual Editors

**What goes wrong:** Users expect Ctrl+Z to undo shape movements/additions but it's not implemented. Frustrating when they accidentally drag something wrong.

**Why it happens:** Easy to forget when building UI incrementally. Undo/redo requires state history tracking from the start.

**How to avoid:**
- Plan state management architecture to support history from day one
- Use libraries like use-undo or zustand middleware for time-travel
- Store immutable state snapshots on each action (add shape, drag end, modify property)
- Limit history size (e.g., last 50 actions) to avoid memory issues
- Common pattern: Keep history array, current index, push on action, slice on undo

**Warning signs:** User testing reveals confusion about missing undo, accidental modifications are permanent, users avoid experimentation fearing mistakes.

### Pitfall 5: Ignoring Mobile/Touch Support

**What goes wrong:** Drag-and-drop works on desktop but fails on touch devices (tablets, touchscreens). Events don't fire or behave differently.

**Why it happens:** Mouse events (mousedown, mousemove, mouseup) don't exist on touch devices. Need touch events (touchstart, touchmove, touchend) or pointer events (unified API).

**How to avoid:**
- Use libraries that handle both mouse and touch (react-konva does this automatically)
- If custom handlers, use PointerEvent API (not MouseEvent), supported by modern browsers
- Test on touch devices early, not at the end
- Consider touch-specific UX: larger drag handles (44x44px minimum), pinch-to-zoom

**Warning signs:** Works on development laptop but not on iPad, user complaints about touch not working, GitHub issues about mobile support.

## Code Examples

Verified patterns from research and existing codebase:

### Konva Basic Setup in React

```typescript
// GraphCanvas.tsx
import { Stage, Layer, Circle, Line, Path } from 'react-konva'

function GraphCanvas({
  graph,
  onUpdate
}: {
  graph: GraphSegment
  onUpdate: (updated: GraphSegment) => void
}) {
  const width = graph.width || 480
  const height = graph.height || 280

  return (
    <Stage width={width} height={height}>
      <Layer>
        {/* Background */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={graph.background || 'white'}
        />

        {/* Grid (if enabled) */}
        {graph.axes.showGrid && <GridLines axes={graph.axes} width={width} height={height} />}

        {/* Graph elements */}
        {graph.points.map(point => (
          <EditablePoint
            key={point.id}
            point={point}
            axes={graph.axes}
            canvasWidth={width}
            canvasHeight={height}
            onUpdate={(updated) => {
              onUpdate({
                ...graph,
                points: graph.points.map(p => p.id === updated.id ? updated : p)
              })
            }}
          />
        ))}

        {/* Lines, curves, functions, areas similarly */}
      </Layer>
    </Stage>
  )
}
```

### Draggable Function with Domain Handles

```typescript
// EditableFunction.tsx
function EditableFunction({
  func,
  axes,
  width,
  height,
  onUpdate
}: EditableFunctionProps) {
  // Use existing sampleFunction from graph-utils.ts
  const samples = sampleFunction(func, axes)
  const pathData = samples.map((pt, i) => {
    const pixel = graphToPixel(pt, axes, width, height)
    return i === 0 ? `M ${pixel.x} ${pixel.y}` : `L ${pixel.x} ${pixel.y}`
  }).join(' ')

  // Domain handles
  const minX = func.domain?.min ?? axes.xMin
  const maxX = func.domain?.max ?? axes.xMax
  const evaluator = compileExpression(func.expression)
  const leftHandle = graphToPixel({ x: minX, y: evaluator(minX) }, axes, width, height)
  const rightHandle = graphToPixel({ x: maxX, y: evaluator(maxX) }, axes, width, height)

  const handleDomainChange = (side: 'min' | 'max', newX: number) => {
    onUpdate({
      ...func,
      domain: {
        ...func.domain,
        [side]: newX
      }
    })
  }

  return (
    <Group>
      {/* Function curve */}
      <Path
        data={pathData}
        stroke={func.style?.color || '#7c3aed'}
        strokeWidth={func.style?.width || 1.5}
      />

      {/* Left domain handle */}
      <Circle
        x={leftHandle.x}
        y={leftHandle.y}
        radius={6}
        fill="#7c3aed"
        opacity={0.7}
        draggable
        dragBoundFunc={(pos) => {
          // Constrain to horizontal movement only
          return { x: pos.x, y: leftHandle.y }
        }}
        onDragEnd={(e) => {
          const newPixelX = e.target.x()
          const newGraphX = pixelToGraph({ x: newPixelX, y: 0 }, axes, width, height).x
          handleDomainChange('min', newGraphX)
        }}
      />

      {/* Right domain handle */}
      <Circle
        x={rightHandle.x}
        y={rightHandle.y}
        radius={6}
        fill="#7c3aed"
        opacity={0.7}
        draggable
        dragBoundFunc={(pos) => {
          return { x: pos.x, y: rightHandle.y }
        }}
        onDragEnd={(e) => {
          const newPixelX = e.target.x()
          const newGraphX = pixelToGraph({ x: newPixelX, y: 0 }, axes, width, height).x
          handleDomainChange('max', newGraphX)
        }}
      />
    </Group>
  )
}
```

### Shape Template Library

```typescript
// templates/predefinedShapes.ts
export type ShapeCategory = 'functions' | 'lines' | 'points' | 'areas'

export type ShapeTemplate = {
  id: string
  category: ShapeCategory
  label: string
  icon: string // emoji or icon name
  description: string
  createElements: (position: {x: number, y: number}, axes: GraphAxes) => Partial<GraphSegment>
}

export const PREDEFINED_SHAPES: ShapeTemplate[] = [
  {
    id: 'parabola-up',
    category: 'functions',
    label: 'Parabole',
    icon: '⌣',
    description: 'Parabole y = x²',
    createElements: (pos, axes) => ({
      functions: [{
        id: createId(),
        expression: 'x^2',
        domain: { min: axes.xMin, max: axes.xMax },
        style: { color: '#2563eb', width: 2 }
      }]
    })
  },
  {
    id: 'sine-wave',
    category: 'functions',
    label: 'Sinusoïde',
    icon: '∿',
    description: 'Fonction y = sin(x)',
    createElements: (pos, axes) => ({
      functions: [{
        id: createId(),
        expression: 'sin(x)',
        domain: { min: axes.xMin, max: axes.xMax },
        style: { color: '#7c3aed', width: 2 }
      }]
    })
  },
  {
    id: 'linear',
    category: 'functions',
    label: 'Fonction linéaire',
    icon: '⁄',
    description: 'Fonction y = x',
    createElements: (pos, axes) => ({
      functions: [{
        id: createId(),
        expression: 'x',
        domain: { min: axes.xMin, max: axes.xMax },
        style: { color: '#059669', width: 2 }
      }]
    })
  },
  {
    id: 'exponential',
    category: 'functions',
    label: 'Exponentielle',
    icon: 'eˣ',
    description: 'Fonction y = exp(x)',
    createElements: (pos, axes) => ({
      functions: [{
        id: createId(),
        expression: 'exp(x)',
        domain: { min: axes.xMin, max: axes.xMax },
        style: { color: '#dc2626', width: 2 }
      }]
    })
  },
  {
    id: 'point',
    category: 'points',
    label: 'Point',
    icon: '•',
    description: 'Point simple',
    createElements: (pos, axes) => {
      const graphPos = pixelToGraph(pos, axes, 480, 280) // Use actual canvas dims
      return {
        points: [{
          id: createId(),
          x: Math.round(graphPos.x),
          y: Math.round(graphPos.y),
          size: 4,
          filled: true,
          color: '#111827'
        }]
      }
    }
  },
  {
    id: 'vertical-line',
    category: 'lines',
    label: 'Asymptote verticale',
    icon: '│',
    description: 'Ligne verticale',
    createElements: (pos, axes) => {
      const graphX = pixelToGraph(pos, axes, 480, 280).x
      return {
        lines: [{
          id: createId(),
          kind: 'line',
          start: { type: 'coord', x: graphX, y: axes.yMin },
          end: { type: 'coord', x: graphX, y: axes.yMax },
          style: { color: '#6b7280', width: 1.5, dashed: true }
        }]
      }
    }
  },
  {
    id: 'horizontal-line',
    category: 'lines',
    label: 'Asymptote horizontale',
    icon: '─',
    description: 'Ligne horizontale',
    createElements: (pos, axes) => {
      const graphY = pixelToGraph(pos, axes, 480, 280).y
      return {
        lines: [{
          id: createId(),
          kind: 'line',
          start: { type: 'coord', x: axes.xMin, y: graphY },
          end: { type: 'coord', x: axes.xMax, y: graphY },
          style: { color: '#6b7280', width: 1.5, dashed: true }
        }]
      }
    }
  }
]

// Group by category for UI
export const SHAPES_BY_CATEGORY = PREDEFINED_SHAPES.reduce((acc, shape) => {
  if (!acc[shape.category]) acc[shape.category] = []
  acc[shape.category].push(shape)
  return acc
}, {} as Record<ShapeCategory, ShapeTemplate[]>)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Form-only graph editors (input fields for coordinates) | Hybrid dual-mode editors (direct manipulation + form fallback) | ~2020-2024 | Users expect drag-and-drop like PowerPoint/Figma. Form-only feels dated and slows down simple tasks. |
| react-dnd for drag-and-drop | dnd-kit, pragmatic-drag-and-drop | ~2022-2024 | Modern libraries prioritize accessibility, performance, bundle size. dnd-kit has better React 18+ support. |
| fabric.js dominance for canvas | react-konva for React projects | ~2019-present | Konva's React integration is more idiomatic, better performance for dynamic updates. Fabric still good for static/editing use cases. |
| Custom LaTeX parsers | math.js, mathjs/expression-parser, or specialized parsers | Ongoing | Custom parsing is maintenance burden. Existing parsers handle edge cases better. Correcta's current parser works but could be replaced. |

**Deprecated/outdated:**
- **react-digraph, react-dag-editor**: Great for node-based workflow editors but not suitable for mathematical graphs. Wrong use case.
- **d3-drag directly**: D3 is powerful but lower-level. react-konva abstracts drag-and-drop better for React.
- **Desmos API embedding**: Desmos is excellent but proprietary, heavy embed, limited customization. Not suitable for building your own editor.

## Open Questions

Things that couldn't be fully resolved:

1. **Circle/Ellipse representation in current data model**
   - What we know: Current GraphSegment has curves (bezier), lines, and functions. No explicit circle type.
   - What's unclear: How to represent circles in simple mode? Options: (a) Use multiple bezier curves to approximate, (b) Add new GraphCircle type, (c) Treat as special case of GraphCurve with circular flag, (d) Use parametric function.
   - Recommendation: Start with (c) - add `circular: boolean` flag to GraphCurve with center and radius. Can be rendered as circle in canvas, exported as path in SVG. Evaluate if dedicated type needed later.

2. **Undo/Redo implementation strategy**
   - What we know: Users will expect undo in visual editor. Zustand is already used for exam state.
   - What's unclear: Best approach for graph editor history - (a) Add to existing exam undo system, (b) Separate graph-editor-only undo, (c) Use zustand middleware like zustand-middleware-computed-state.
   - Recommendation: Start with graph-editor-only undo (simpler scoping), integrate with exam-level undo later if needed. Store snapshots on dragEnd, not every mousemove.

3. **How much to port vs keep from current editor**
   - What we know: Current InlineGraphEditor (~500 lines) has working form-based UI for all graph elements. Need to preserve functionality.
   - What's unclear: Should we (a) Keep existing editor as-is for advanced mode, (b) Refactor and improve form UI, (c) Build both modes from scratch.
   - Recommendation: (a) Keep existing editor as advanced mode with minimal refactoring. Don't break what works. Focus effort on building simple mode. Can improve advanced mode later based on user feedback.

4. **Preset shape library scope**
   - What we know: User wants common shapes easily accessible. Too few = not useful, too many = overwhelming.
   - What's unclear: Which shapes to include in v1? Parabola, sine, line, point are obvious. What about hyperbola, logarithm, absolute value, piecewise functions, tangent lines?
   - Recommendation: Start with 10-12 most common shapes (linear, quadratic, exponential, sine, cosine, vertical/horizontal asymptote, point, segment). Add more based on usage analytics and teacher requests. Make templates easy to extend.

5. **Performance with complex functions**
   - What we know: Current sampleFunction() uses 80-200 samples. Works for most functions. Konva can handle hundreds of path points.
   - What's unclear: Will performance degrade with 10+ complex functions on canvas? What's the limit before we need optimization?
   - Recommendation: Test with realistic exam scenarios (5-8 functions typical). If performance issues appear, optimize: (a) Reduce sample count dynamically based on function complexity, (b) Use Konva caching API, (c) Throttle updates during drag. But don't pre-optimize without measuring.

## Sources

### Primary (HIGH confidence)
- Konva.js official documentation - Drag and drop tutorials, React integration guide
- react-konva GitHub repository - Current implementation patterns
- Correcta existing codebase - graph-utils.ts (857 lines), types/exams.ts GraphSegment types, InlineGraphEditor implementation (proven to work)

### Secondary (MEDIUM confidence)
- [React: Comparison of JS Canvas Libraries (Konvajs vs Fabricjs)](https://dev.to/lico/react-comparison-of-js-canvas-libraries-konvajs-vs-fabricjs-1dan) - Performance and architecture comparison verified by multiple sources
- [Konva.js vs Fabric.js: In-Depth Technical Comparison](https://medium.com/@www.blog4j.com/konva-js-vs-fabric-js-in-depth-technical-comparison-and-use-case-analysis-9c247968dd0f) - Technical trade-offs
- [Top 5 Drag-and-Drop Libraries for React in 2026](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) - dnd-kit recommendation verified
- [SVG vs Canvas Animation: Best Choice for Modern Frontends](https://www.augustinfotech.com/blogs/svg-vs-canvas-animation-what-modern-frontends-should-use-in-2026/) - Performance considerations
- [React Performance Pitfalls: Avoiding Common Mistakes](https://dev.to/kigazon/react-performance-pitfalls-avoiding-common-mistakes-2pdd) - Re-render optimization
- [State Management in 2026: Redux, Context API, and Modern Patterns](https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns) - Zustand usage patterns

### Tertiary (LOW confidence - verify during implementation)
- WebSearch results about dual-mode editor patterns - AI document editor patterns not directly verified for graph editors
- WebSearch about predefined shape libraries - General concepts but not graph-specific
- npm package versions from WebSearch - Should verify actual current versions during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-konva is clearly the standard for React canvas manipulation based on documentation, community usage, and comparison articles. dnd-kit is the modern successor to react-dnd with better architecture.
- Architecture: MEDIUM-HIGH - Dual-mode pattern is established for editor UIs, coordinate conversion patterns are proven. Template-based insertion is common but specific implementation for mathematical graphs needs validation.
- Pitfalls: HIGH - SVG vs Canvas performance, coordinate confusion, and React re-render issues are well-documented with consensus across sources. Mobile/touch and undo/redo are standard considerations.

**Research date:** 2026-02-02
**Valid until:** ~30 days (stable domain - canvas libraries don't change rapidly, but check for major version releases)
