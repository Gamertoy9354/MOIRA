# 🎓 Complete Frontend Deep-Dive — Orchestral MCP Gateway

> **Target reader**: Someone who has never written a line of code but needs to be able to answer any deep question about this frontend.

---

## Table of Contents

1. [What is "Frontend" anyway?](#1-what-is-frontend-anyway)
2. [Languages Used and Why](#2-languages-used-and-why)
3. [Why React — Not Node.js, Not Vue, Not Angular](#3-why-react--not-nodejs-not-vue-not-angular)
4. [The Build Tool Chain (Vite + TypeScript)](#4-the-build-tool-chain-vite--typescript)
5. [Project Folder Structure — Every File Explained](#5-project-folder-structure--every-file-explained)
6. [How the App Boots — Step by Step](#6-how-the-app-boots--step-by-step)
7. [Component Architecture — What Each Screen Piece Does](#7-component-architecture--what-each-screen-piece-does)
8. [The Data Flow — From Keystroke to WebSocket and Back](#8-the-data-flow--from-keystroke-to-websocket-and-back)
9. [The Service Layer — Mock vs Live Backend](#9-the-service-layer--mock-vs-live-backend)
10. [Every Library Used — Why It Was Chosen, What the Alternative Was](#10-every-library-used--why-it-was-chosen-what-the-alternative-was)
11. [Styling System — Tailwind + CSS Variables](#11-styling-system--tailwind--css-variables)
12. [State Management — How Data Lives and Changes](#12-state-management--how-data-lives-and-changes)
13. [The DAG Viewer — Visualising Workflows](#13-the-dag-viewer--visualising-workflows)
14. [Performance Techniques Used](#14-performance-techniques-used)
15. [FAQ — Tough Questions You Will Be Asked](#15-faq--tough-questions-you-will-be-asked)

---

## 1. What is "Frontend" anyway?

Think of a website like a restaurant.

| Layer | Restaurant Analogy | This Project |
|---|---|---|
| **Frontend** | The dining room, menus, chairs — what the customer sees and touches | The browser UI you open at `http://localhost:5173` |
| **Backend** | The kitchen — where food is actually cooked | Python FastAPI server at `http://127.0.0.1:8001` |
| **Database** | The pantry / freezer | PostgreSQL + Redis |

**Frontend = everything that runs inside your browser.**

The browser can only understand three things natively:
- **HTML** — structure ("put a button here")
- **CSS** — appearance ("make it purple")
- **JavaScript** — behaviour ("when clicked, send a message")

Everything else (React, TypeScript, Tailwind) is a tool that eventually gets converted into those three things.

---

## 2. Languages Used and Why

### 2.1 TypeScript (`.ts` / `.tsx`)

**What it is**: TypeScript is JavaScript with a "type system" added on top. A type system means you tell the computer what kind of data a variable holds.

**Example without TypeScript (JavaScript)**:
```js
let name = "Dev";
name = 42; // No error! But this will probably break your app later.
```

**Example with TypeScript**:
```ts
let name: string = "Dev";
name = 42; // ❌ ERROR immediately — "42 is not a string"
```

**Why used here**: This project handles real-time workflow data with many different shapes: `DAGNode`, `Message`, `AuditEntry`, `TerminalLine`. Without TypeScript, a typo like `node.staus` instead of `node.status` would only be discovered when a user runs the app and sees a blank screen. TypeScript catches this instantly.

**Why not plain JavaScript**: In a project with 10+ files and 5,000+ lines of code, JavaScript becomes a guessing game. TypeScript is the professional standard.

### 2.2 JSX / TSX

**What it is**: JSX (or TSX = JSX with TypeScript) is a special syntax that lets you write HTML inside JavaScript.

```tsx
// This is TSX — looks like HTML, but IS JavaScript
function Button() {
    return <button className="purple-btn">Click Me</button>;
}
```

This gets compiled (converted) to:
```js
React.createElement("button", { className: "purple-btn" }, "Click Me")
```

JSX is not a separate language — it's just a shortcut syntax. The `.tsx` extension = TypeScript + JSX.

### 2.3 CSS

Used for styles. This project uses **Tailwind CSS utility classes** (e.g., `flex`, `h-screen`, `text-white`) plus **custom CSS** in the `styles/` folder for things Tailwind can't express easily (animations, scrollbars, glow effects).

---

## 3. Why React — Not Node.js, Not Vue, Not Angular

This is the **most commonly asked question**. Let's settle it clearly.

### "Why not Node.js?"

> Node.js IS NOT a frontend framework. This is a fundamental misunderstanding.

| | Node.js | React |
|---|---|---|
| **Runs in** | Server (your computer, a cloud VM) | Browser (the user's Chrome/Firefox) |
| **Purpose** | Run JavaScript on servers — build APIs, file processing, databases | Build interactive UIs in the browser |
| **This project** | The **backend** (`/backend` folder) uses Python, not even Node.js | The **frontend** (`/frontend` folder) uses React |

**Analogy**: Asking "why React and not Node.js" is like asking "why use a dining room and not a kitchen?" They do completely different things.

Node.js is already involved in this project, but only as the **runtime that powers Vite** (the build tool) — not as the application itself.

### "Why React and not Vue?"

| | React | Vue.js |
|---|---|---|
| **Made by** | Meta (Facebook) | Independent (Evan You) |
| **Market share** | ~40% of all JS projects | ~18% |
| **Jobs** | Much higher demand | Less demand |
| **Learning curve** | Steeper (more freedom, more decisions) | Easier (more opinionated) |
| **Ecosystem** | Massive — almost every library has React support first | Smaller but growing |

**This project uses React** because:
1. The **React Flow** library (`@xyflow/react`) for the DAG graph visualisation only has first-class React support.
2. The team's existing knowledge.
3. The `motion/react` animation library is built specifically for React.

### "Why React and not Angular?"

| | React | Angular |
|---|---|---|
| **Made by** | Meta | Google |
| **Type** | Library (UI only) | Full Framework (routing, forms, HTTP, everything) |
| **Language** | JavaScript/TypeScript | TypeScript (mandatory) |
| **Size** | Small, flexible | Large, opinionated |
| **Use case** | SPAs, dashboards, dynamic UIs | Enterprise, large teams, strict structure |
| **Speed** | Faster to start, very flexible | Slower to set up, more structure |

**This project chose React** because it's a focused dashboard, not an enterprise ERP system. Angular would be overkill.

### "Why React and not plain HTML + JavaScript?"

Plain HTML with `<button onclick="...">` works for simple pages. But this project:
- Has **real-time data that changes every second** (DAG nodes update as workflow runs)
- Has **complex state**: which model is selected? Is the sidebar open? Is a message being typed?
- Has **dozens of reusable UI pieces** (buttons, panels, dialogs)

With plain HTML, you'd need to manually find DOM elements and update them (`document.getElementById('node-1').style.background = 'green'`). React does all of that automatically when data changes — this is called **reactive rendering**.

---

## 4. The Build Tool Chain (Vite + TypeScript)

### What is Vite?

Vite is the **build tool**. The browser cannot directly run `.tsx` files. Vite:
1. Takes your `.tsx` files
2. Converts JSX → JavaScript
3. Converts TypeScript → JavaScript
4. Bundles all files into one or a few optimised `.js` files
5. Also runs a **development server** with hot reload (instant refresh when you save a file)

**Why Vite and not Webpack (the old standard)?**

| | Vite | Webpack |
|---|---|---|
| **Dev server start** | ~300ms | 10–60 seconds |
| **Hot reload** | Near-instant | Seconds |
| **Config** | Near-zero config needed | Complex config files |
| **2024 standard** | Yes | Being replaced by Vite |

Vite uses native browser ES Modules for development, meaning it doesn't bundle anything during dev — it just serves files as-is. This is why it's so fast.

### `vite.config.ts` — explained line by line

```ts
import { defineConfig } from 'vite'           // Vite's config helper
import path from 'path'                        // Node.js module for file paths
import tailwindcss from '@tailwindcss/vite'   // Tailwind CSS plugin for Vite
import react from '@vitejs/plugin-react'       // React/JSX transformation plugin

export default defineConfig({
    plugins: [
        react(),        // Activates JSX → JS transformation, React Fast Refresh
        tailwindcss(),  // Activates Tailwind class scanning and CSS generation
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'), 
            // Now you can write: import X from '@/services/types'
            // instead of: import X from '../../services/types'
        },
    },
    assetsInclude: ['**/*.svg', '**/*.csv'], // Tell Vite to handle these as assets
})
```

### `tsconfig.json`

Tells TypeScript how strict to be, which files to include, and what JavaScript version to target. You don't need to touch it normally.

### `package.json` — the project manifest

This is like a recipe card for the project:
```json
{
  "scripts": {
    "dev": "vite",           // npm run dev → starts the dev server
    "build": "vite build",   // npm run build → creates production bundle
    "preview": "vite preview" // Preview the production build locally
  }
}
```

The `dependencies` section lists everything the app needs to run. The `devDependencies` lists tools only needed during development.

---

## 5. Project Folder Structure — Every File Explained

```
frontend/
├── index.html              ← THE entry point (the only HTML file)
├── package.json            ← Project manifest (dependencies, scripts)
├── package-lock.json       ← Exact locked versions of every dependency
├── vite.config.ts          ← Build tool configuration
├── tsconfig.json           ← TypeScript configuration
├── postcss.config.mjs      ← CSS processing (Tailwind post-processor)
├── node_modules/           ← All installed libraries (never edit this)
└── src/                    ← ALL your source code lives here
    ├── main.tsx            ← JavaScript entry point — mounts React into HTML
    ├── config.ts           ← App-wide settings (API URL, mode: mock/live)
    ├── vite-env.d.ts       ← TypeScript type declarations for Vite
    ├── app/
    │   ├── app.tsx         ← Root component — the whole page layout
    │   └── components/
    │       ├── ChatArea.tsx      ← Message list + DAG viewer area
    │       ├── DAGviewer.tsx     ← Workflow graph visualisation
    │       ├── InputArea.tsx     ← Text input + send button
    │       ├── MeshBackground.tsx← Animated purple dot grid background
    │       ├── Sidebar.tsx       ← Left panel with history
    │       ├── TerminalPanel.tsx ← Floating terminal log panel
    │       └── ui/               ← 48 reusable primitive components (buttons, dialogs, etc.)
    ├── hooks/
    │   └── useOrchestration.ts  ← Custom hook: brain of the app's logic
    ├── services/
    │   ├── orchestration.ts     ← Service singleton (chooses mock vs live)
    │   ├── types.ts             ← ALL TypeScript type definitions
    │   ├── ws-provider.ts       ← Real WebSocket + REST API implementation
    │   └── mock-provider.ts     ← Simulated data for offline development
    └── styles/
        ├── index.css            ← Main CSS import file
        ├── app-theme.css        ← App-specific custom styles
        ├── fonts.css            ← Font imports
        ├── tailwind.css         ← Tailwind directives
        └── theme.css            ← CSS variables (color tokens, etc.)
```

---

## 6. How the App Boots — Step by Step

When you open the browser at `http://localhost:5173`, here is **exactly** what happens:

### Step 1: Browser loads `index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <link href="https://fonts.googleapis.com/css2?family=Inter..." rel="stylesheet" />
    <title>MCP Orchestration Gateway</title>
  </head>
  <body>
    <div id="root"></div>  ← This is where React will inject everything
    <script type="module" src="/src/main.tsx"></script>  ← Load React app
  </body>
</html>
```

The `<div id="root">` is empty at first. React will fill it.

### Step 2: `main.tsx` runs
```tsx
import ReactDOM from 'react-dom/client';
import App from './app/app';
import './styles/index.css';           // Load all CSS
import { Toaster } from 'sonner';      // Toast notification system

// Find the <div id="root"> and inject the React app into it
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>     // Extra warnings during development
        <App />            // The entire application
        <Toaster ... />    // Toast notifications (bottom-right popups)
    </React.StrictMode>,
);
```

**What is `React.StrictMode`?** It's a wrapper that runs your components twice in development to catch bugs. Has zero effect in production.

### Step 3: `app.tsx` renders
The `<App />` component renders the full page layout: Sidebar + Header + ChatArea + InputArea + TerminalPanel + MeshBackground.

### Step 4: `useOrchestration` hook runs
Inside `App`, the hook `useOrchestration()` is called. This:
1. Connects to the backend (WebSocket or Mock)
2. Sets up event listeners
3. Returns state variables (`messages`, `dagNodes`, etc.) and action functions (`sendMessage`, `startNewRun`)

### Step 5: The page is live
React renders the UI. When data changes (e.g., a new message arrives), React automatically re-renders just the parts of the UI that changed.

---

## 7. Component Architecture — What Each Screen Piece Does

### What is a "Component"?

A component is a **reusable, self-contained piece of UI**. Think of it like a custom HTML tag that you define yourself.

```tsx
// Defining a component
function PurpleButton({ label }: { label: string }) {
    return <button style={{ color: 'purple' }}>{label}</button>;
}

// Using it (just like an HTML tag)
<PurpleButton label="Send" />
<PurpleButton label="Cancel" />
```

### `app.tsx` — The Root Layout

**Role**: The skeleton of the entire page. Decides what goes where.

**What it does**:
- Holds the list of AI models (`MODELS` array with Kimi K2.5, Qwen3, Llama 3.3)
- Manages which model is selected (`useState`)
- Manages whether sidebar is open (`useState`)
- Manages whether the terminal is open (`useState`)
- Calls `useOrchestration()` to get all shared data
- Renders: `MeshBackground | Sidebar | (Header + ChatArea + InputArea) | TerminalPanel`

**Key code explained**:
```tsx
const [isSidebarOpen, setIsSidebarOpen] = useState(true);
// useState creates a "state variable". 
// isSidebarOpen = current value (true = open)
// setIsSidebarOpen = function to change it
// When you call setIsSidebarOpen(false), React automatically re-renders the UI
```

```tsx
useEffect(() => {
    const check = () => { if (window.innerWidth < 1024) setIsSidebarOpen(false); };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
}, []);
// useEffect runs code AFTER React renders.
// This one: auto-closes sidebar on small screens.
// The [] at the end means "run only once when the component first appears".
// The return function is a "cleanup" — runs when component disappears.
```

### `MeshBackground.tsx` — The Animated Background

**Role**: The beautiful purple dotted-grid background with a cursor spotlight effect.

**How it works**:
1. A static CSS dot grid is painted (tiny purple dots every 32px)
2. A "bright dots" layer sits on top — hidden except where the cursor is
3. The cursor spotlight moves using `requestAnimationFrame` (GPU-smooth 60fps animation)
4. Four glowing "orbs" float in corners using pure CSS animations

**Key concept — `useRef`**:
```tsx
const spotlightRef = useRef<HTMLDivElement>(null);
// useRef gives you a direct reference to a DOM element.
// You use it to directly manipulate the element WITHOUT causing a re-render.
// Perfect for animations — re-rendering 60 times/second would be too slow.
```

**Key concept — Lerp (Linear Interpolation)**:
```tsx
const lerp = (a, b, t) => a + (b - a) * t;
// Makes the spotlight smoothly "follow" the mouse instead of snapping instantly.
// t=0.09 means it moves 9% of the remaining distance each frame → smooth lag effect
```

**Why no `filter: blur()`?** The code comments explain: `filter: blur()` forces the GPU to do expensive repaints. Instead, they use soft `radial-gradient` which achieves the same look with zero cost.

### `ChatArea.tsx` — The Message Display

**Role**: Shows all chat messages (user + assistant) and the DAG workflow graph.

**What it renders**:
- **Empty state**: When no messages exist, shows the "How can I orchestrate today?" screen with suggestion chips
- **Messages**: Loops through `messages` array and renders each one differently based on `msg.role` ('user' = right-aligned bubble, 'assistant' = left-aligned with sparkles icon)
- **DAG Viewer**: If a message `hasDAG: true` and `dagNodes.length > 0`, renders the workflow graph
- **Typing Indicator**: Three animated dots when AI is responding
- **Audit Log Dialog**: A popup table showing all tool calls and their statuses

**Key code — conditional rendering**:
```tsx
{messages.length === 0 && (
    <motion.div>...</motion.div>  // Only shows if NO messages exist
)}
```

**Key code — list rendering**:
```tsx
{messages.map((msg) => (
    <motion.div key={msg.id}>  // key= is REQUIRED — React uses it to track items
        ...
    </motion.div>
))}
// .map() = "for each message, return a JSX element"
```

**Audit Log** — when "View Full Audit Log" is clicked:
1. It calls `fetch()` to get data from `GET /api/v1/workflows/{id}/audit`
2. Shows a loading spinner while waiting
3. Renders a table of all tool calls with timestamps, connectors, statuses

### `DAGviewer.tsx` — The Workflow Graph

**Role**: Renders the visual flowchart of workflow steps (Start → Step 1 → Step 2 → End).

**Key concepts**:

**DAG** = Directed Acyclic Graph. A diagram where:
- **Directed**: arrows go one way
- **Acyclic**: no loops (you can't go back)
- **Graph**: nodes connected by edges

**Node types**: 
- `StartNode` — "LLM Planning" (purple brain icon, pulses while planning)
- `StepNode` — each workflow step (shows connector, tool, status, latency)
- `EndNode` — "Completed" or "Failed" (green or red)

**Layout algorithm** (`dagre` library):
```ts
const g = new dagre.graphlib.Graph();
g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 70 }); // Top-to-Bottom layout
// dagre automatically calculates X,Y positions for each node
// so they don't overlap
dagre.layout(g);
```

**Status colour coding**:
```ts
success  → green (#10b981)
running  → blue (#3b82f6) + animated edges
failed   → red (#ef4444)
retrying → amber (#f59e0b)
pending  → dim white
```

**Real-time updates**: When the backend sends a `dag:node-update` event, the hook calls `setDagNodes(prev => prev.map(node => node.id === event.nodeId ? {...node, ...event.updates} : node))`. React detects the change and re-renders just that node.

### `InputArea.tsx` — The Message Input

**Role**: The text input at the bottom where users type messages.

**What it does**:
- Auto-grows textarea as you type (up to 200px height)
- `Enter` sends the message, `Shift+Enter` adds a new line
- Disables the send button and input while AI is responding (`disabled={isTyping}`)
- The send button has a glowing purple gradient when active, dim when inactive
- File attachment UI (for future image upload feature)

**Glow effect**: The input box has a "spectrum border" — a gradient border ring that intensifies when focused. This is done with CSS classes `spectrum-border` and `input-glow--focused`.

### `Sidebar.tsx` — The Left Panel

**Role**: History of past workflow runs, navigation, and export options.

**Behaviour**:
- Animates in/out with spring physics (`type: 'spring', bounce: 0`)
- Shows "Today" and "Previous" history groups
- Footer buttons: Export PDF, Open Google Sheet, MCP Settings
- Editable username input at the bottom ("Local User" — click to rename)

**When closed**: Shows a small arrow button in the top-left to re-open it.

**Auto-close on mobile**: In `app.tsx`, a `useEffect` watches window width and auto-closes the sidebar on screens smaller than 1024px.

### `TerminalPanel.tsx` — The Floating Log Console

**Role**: A floating terminal-like panel that shows real-time backend logs.

**Colours by log level**:
```ts
info    → purple (#C084FC)
success → green (#34d399)
error   → red (#f87171)
warn    → amber (#fbbf24)
dim     → faded white
```

**Auto-scroll**: Uses `useRef` on a `<div ref={bottomRef} />` at the end of the log list, and calls `bottomRef.current?.scrollIntoView()` whenever new lines arrive — so it always scrolls to the latest log.

**How lines arrive**: The backend WebSocket sends events → `ws-provider.ts` calls `this.termLog(...)` → emits `terminal:log` event → `useOrchestration` hook calls `setTerminalLines` → React re-renders the panel.

---

## 8. The Data Flow — From Keystroke to WebSocket and Back

Here is the complete journey of a user typing "Audit access permissions" and pressing Enter:

```
1. USER types in <InputArea>
   └─ useState('text') stores the text

2. USER presses Enter
   └─ handleSend() is called
   └─ onSend(text) prop is called → this is app.tsx's sendMessage

3. app.tsx: sendMessage (from useOrchestration hook)
   └─ setDagNodes([])           ← clear old graph
   └─ setTerminalLines([])      ← clear old logs
   └─ setIsPlanning(true)       ← show "LLM Planning" state on DAG
   └─ orchestrationService.sendMessage(text)

4. orchestrationService.sendMessage()
   └─ Lives in ws-provider.ts
   └─ Emits message:new event → ChatArea shows user's message bubble
   └─ Emits message:typing → shows animated dots
   └─ POST /api/v1/workflows { user_request: "Audit access permissions" }
   └─ Backend responds: { workflow_id: "wf-abc123" }
   └─ Connects to WebSocket: ws://127.0.0.1:8001/ws/wf-abc123

5. BACKEND processes the request:
   └─ LLM plans the workflow (creates DAG)
   └─ Sends WebSocket events:
      - workflow_started (with dag.steps)
      - step_started (for each step)
      - step_completed / step_failed / step_retrying
      - workflow_completed

6. ws-provider.ts receives WebSocket messages
   └─ mapAndEmit() translates backend events → frontend events
   └─ e.g. "workflow_started" → dag:init, message:typing=false, message:new
   └─ e.g. "step_completed"  → dag:node-update (status='success', latencyMs=...)

7. useOrchestration hook receives events via handleEvent()
   └─ Updates state: setDagNodes, setMessages, setTerminalLines, etc.

8. React detects state changes
   └─ Re-renders ONLY the components that need to change
   └─ ChatArea re-renders with new message
   └─ DAGviewer re-renders with updated nodes
   └─ TerminalPanel re-renders with new log line

9. USER sees the result
   └─ Workflow graph appears and updates in real-time
   └─ Messages appear in chat
   └─ Terminal shows step-by-step logs
```

---

## 9. The Service Layer — Mock vs Live Backend

### `config.ts`

The single config switch:
```ts
mode: 'live' as 'mock' | 'live'
```

- `'mock'` → Uses `MockProvider` (simulated data, no backend needed)
- `'live'` → Uses `WebSocketProvider` (real backend at `ws://127.0.0.1:8001`)

### `orchestration.ts` — The Singleton

```ts
class OrchestrationService {
    private provider: OrchestrationProvider;
    constructor() {
        this.provider = config.mode === 'live' ? new WebSocketProvider() : new MockProvider();
    }
    // All methods delegate to the provider
}
export const orchestrationService = new OrchestrationService();
```

**Singleton pattern**: Only ONE instance of this class ever exists. Everywhere in the code that imports `orchestrationService` gets the exact same object.

**Why this design?** The rest of the app (hook, components) never knows if they're talking to a real backend or a fake one. They always just call `orchestrationService.sendMessage()`. This means you can develop the frontend entirely offline by flipping one config value.

### `ws-provider.ts` — The Live Backend Bridge

**What it does**:
1. `sendMessage()` → `POST /api/v1/workflows` → gets `workflow_id` back
2. Opens a WebSocket connection to `ws://127.0.0.1:8001/ws/{workflow_id}`
3. For every incoming WebSocket message, calls `mapAndEmit()` which translates the backend's event format into the frontend's event format
4. The frontend never directly handles raw backend events — it only handles its own typed `OrchestrationEvent` union

**Event translation example**:
```ts
// BACKEND sends:
{ event_type: 'step_completed', step_id: 'github_create_issue', latency_ms: 342.5 }

// ws-provider translates to:
{ type: 'dag:node-update', nodeId: 'github_create_issue', updates: { status: 'success', latencyMs: 343 } }
// AND:
{ type: 'terminal:log', line: { text: '✓ github_create_issue — completed (343ms)', level: 'success' } }
```

### `types.ts` — The Shared Contract

Defines TypeScript types used by both the service layer and UI components:

```ts
export interface DAGNode {
    id: string;
    label: string;
    status: NodeStatus;      // 'pending' | 'running' | 'success' | 'failed' | 'retrying'
    connector?: string;      // 'github', 'slack', 'jira', 'sheets'
    tool?: string;           // e.g. 'create_issue'
    latencyMs?: number;
    dependsOn?: string[];    // IDs of nodes this one waits for
    errorType?: ErrorType;   // 'minor' | 'major' | 'sensitive'
    retryCount?: number;
    subDag?: DAGNode[];      // Nested recovery steps
}
```

The `?` means the field is optional.

---

## 10. Every Library Used — Why It Was Chosen, What the Alternative Was

### Core Framework

| Library | Version | Why Used | Alternative |
|---|---|---|---|
| `react` | 18.3.1 | UI framework, reactive rendering | Vue.js, Svelte, Angular |
| `react-dom` | 18.3.1 | Renders React into the browser DOM | (must use with react) |
| `typescript` | ^5.5 | Type safety, better IDE support | Plain JavaScript |

### Build & Dev Tools

| Library | Version | Why Used | Alternative |
|---|---|---|---|
| `vite` | 6.3.5 | Fast dev server + bundler | Webpack (slow), Parcel |
| `@vitejs/plugin-react` | 4.7.0 | React/JSX support in Vite | Babel separately |

### Animations

| Library | Why Used | Alternative |
|---|---|---|
| `motion` (Framer Motion) 12.23 | Declarative spring animations, `AnimatePresence` for mount/unmount, `whileHover`/`whileTap` | CSS transitions (less powerful), GSAP (complex API) |

**Why Framer Motion over CSS animations?**
- CSS can't animate elements as they are removed from the DOM. `AnimatePresence` can.
- `whileHover={{ scale: 1.1 }}` is 1 line vs 10 lines of CSS.
- Spring physics feel more natural than CSS cubic-bezier curves.

### DAG (Workflow Graph)

| Library | Why Used | Alternative |
|---|---|---|
| `@xyflow/react` 12.10 | Interactive flowchart rendering with pan/zoom/drag | D3.js (lower-level, complex), Cytoscape.js |
| `dagre` 0.8.5 | Automatic graph layout algorithm (calculates X/Y positions) | Manual positioning (impossible at scale) |

**Why React Flow (`@xyflow/react`)?**
- It's the industry standard for node-based UIs in React
- Handles zoom, pan, minimap, controls out of the box
- Custom node types (our `StepNode`, `StartNode`, `EndNode`) slot in cleanly

### UI Component Primitives

| Library | Why Used | Alternative |
|---|---|---|
| `@radix-ui/*` (20+ packages) | Accessible, unstyled primitives (Dialog, DropdownMenu, etc.) | Headless UI, Chakra UI |
| `lucide-react` 0.487 | 1000+ beautiful SVG icons as React components | FontAwesome, Heroicons, Material Icons |
| `@mui/material` + `@emotion/*` | Material UI components | Ant Design, Chakra UI |

**Why Radix UI?**
- Radix handles all accessibility (keyboard navigation, ARIA attributes) automatically
- It's "headless" = no built-in styles, so you can style it exactly how you want with Tailwind
- Used heavily by shadcn/ui (the `ui/` folder components are based on shadcn/ui patterns)

**Why Lucide and not FontAwesome?**
- Lucide icons are React components — they participate in React's tree
- FontAwesome requires loading external icon fonts or multiple CSS files
- Lucide icons are smaller (tree-shakeable — only included icons are bundled)

### Styling

| Library | Why Used | Alternative |
|---|---|---|
| `tailwindcss` 4.1.12 | Utility-first CSS classes | Pure CSS, Styled-Components, CSS Modules |
| `tailwind-merge` | Merges conflicting Tailwind classes cleanly | Manual class string management |
| `class-variance-authority` | Manages component style variants | Custom conditional logic |
| `clsx` | Conditionally joins CSS class strings | Template literals |
| `tw-animate-css` | Pre-built Tailwind animation utilities | Custom CSS keyframes |

### Export & PDF

| Library | Why Used | Alternative |
|---|---|---|
| `jspdf` | Generate PDF files in the browser | Server-side PDF generation (adds complexity) |
| `html2canvas` | Capture DOM elements as images | Puppeteer (server-side), `getComputedStyle` |

### Notifications

| Library | Why Used | Alternative |
|---|---|---|
| `sonner` | Beautiful, animated toast notifications | React-Toastify, Notistack |

**Why Sonner?** It's the most aesthetically premium toast library — supports dark themes, custom styles, promise-based toasts (`toast.loading` → `toast.success`).

### Date Handling

| Library | Why Used | Alternative |
|---|---|---|
| `date-fns` | Minimal date manipulation utilities | Moment.js (deprecated), Luxon |

**Used for**: `isToday(item.date)` in `Sidebar.tsx` — to separate "Today" from "Previous" history.

### Forms

| Library | Why Used | Alternative |
|---|---|---|
| `react-hook-form` | Performant form state + validation | Formik, controlled inputs |

### Other Notable Libraries

| Library | Why Used |
|---|---|
| `react-resizable-panels` | Drag-to-resize panel layouts |
| `recharts` | Charts/graphs (available but not currently used in main UI) |
| `canvas-confetti` | Celebration confetti animation |
| `next-themes` | Dark/light theme switching with SSR support |
| `react-router` 7.x | Client-side routing (navigation between pages) |
| `embla-carousel-react` | Touch-friendly carousels |
| `cmdk` | Command palette (Cmd+K search) |
| `vaul` | Drawer/bottom sheet component |

---

## 11. Styling System — Tailwind + CSS Variables

### How Tailwind Works

Tailwind is a **utility-first CSS framework**. Instead of writing:
```css
.send-button {
    display: flex;
    align-items: center;
    padding: 0.375rem 0.75rem;
    border-radius: 0.75rem;
}
```

You write class names directly in HTML/JSX:
```tsx
<button className="flex items-center px-3 py-1.5 rounded-xl">
```

Each class does one thing. Tailwind scans all your `.tsx` files, finds every class you used, and generates a CSS file with only those classes. This means the final CSS file is tiny.

### Custom CSS Files

The `styles/` folder has custom CSS for things Tailwind can't express:

**`app-theme.css`**: Custom button styles (`purple-new-btn`, `purple-icon-btn`), animated orb keyframes (`mesh-orb-1` through `4`), input glow effects (`input-glow`, `spectrum-border`), custom scrollbar styling.

**`theme.css`**: CSS custom properties (variables):
```css
:root {
    --color-primary: #C084FC;
    --color-background: #06040F;
    /* ...etc */
}
```

### Why Dark Purple Theme?

The design uses a dark (`#06040F`) background with purple accents (`#C084FC`, `#E879F9`, `#7C3AED`). This is:
1. Same aesthetic language as AI-driven tools (OpenAI, Anthropic use dark UIs)
2. The purple/violet spectrum is associated with creativity and intelligence
3. Dark background reduces eye strain for power users who stare at it all day

---

## 12. State Management — How Data Lives and Changes

### What is "State"?

State = data that can change over time and causes the UI to update.

Examples:
- `messages: Message[]` — the list of chat messages (grows as conversation continues)
- `isTyping: boolean` — whether the AI is currently generating a response
- `dagNodes: DAGNode[]` — the current workflow graph nodes

### `useState` — Component-level state

```tsx
const [isSidebarOpen, setIsSidebarOpen] = useState(true);
```

- Lives inside one component
- When `setIsSidebarOpen(false)` is called, React re-renders that component with `isSidebarOpen = false`
- Components below it (that receive `isSidebarOpen` as a prop) also re-render

### `useCallback` — Memoised functions

```tsx
const sendMessage = useCallback((text: string) => {
    orchestrationService.sendMessage(text);
}, []);
// The [] means: this function never changes between re-renders.
// Without useCallback, a new function object would be created every render.
// This matters for performance when passed as props to child components.
```

### Why not Redux / Zustand / Jotai?

Those are state management libraries needed when:
- State needs to be shared between many deeply-nested components
- State is very complex (complex update logic)

This project's state lives in `useOrchestration` and gets passed down as props 1-2 levels. That's simple enough that `useState` + `useCallback` is sufficient. Adding Redux here would be massive over-engineering.

---

## 13. The DAG Viewer — Visualising Workflows

The `DAGviewer.tsx` is the most technically complex component. Here's how it all fits:

### Three Custom Node Types

```ts
const nodeTypes = { step: StepNode, start: StartNode, end: EndNode };
```

When React Flow renders a node with `type: 'step'`, it uses our `StepNode` component. Same for `start` and `end`.

### Edge Building Algorithm

```ts
function buildEdges(nodes: DAGNode[], workflowDone: boolean): Edge[] {
    // 1. START → nodes that have NO dependencies (root nodes)
    // 2. NodeA → NodeB for every "dependsOn" relationship
    // 3. Leaf nodes (nothing depends on them) → END
    // 4. Fallback: if no deps at all, chain sequentially
}
```

### Auto-Layout with Dagre

Given a list of nodes and edges, Dagre automatically calculates X/Y positions so they don't overlap. The result is a top-to-bottom flow: Start at top, End at bottom, steps in between.

### Live Updates

When a step transitions from `pending` → `running`:
1. Backend sends `step_started` WebSocket event
2. `ws-provider` emits `dag:node-update` with `{ status: 'running' }`
3. `useOrchestration` calls `setDagNodes(prev => prev.map(n => n.id === event.nodeId ? {...n, ...updates} : n))`
4. React detects `dagNodes` changed → re-renders `DAGFlow`
5. The `relayout()` function runs (wrapped in `useCallback`) → re-computes positions → `setNodes()` → React Flow re-renders

The edge arrows for `running`/`retrying` nodes become **animated** (dashed, flowing animation).

---

## 14. Performance Techniques Used

| Technique | Where | Why |
|---|---|---|
| `useCallback` | Hook, all action functions | Prevents unnecessary re-renders of child components |
| `requestAnimationFrame` | MeshBackground cursor tracking | Exactly 60fps, no layout thrashing |
| `will-change: transform` | Orbs and spotlight | Promotes elements to GPU layer |
| `transform: translate3d()` | Spotlight movement | GPU-composited, never triggers layout |
| `contain: strict` on background | MeshBackground | Prevents background repaints from affecting main UI |
| `passive: true` event listeners | Mouse move handler | Browser can optimise scroll performance |
| Soft `radial-gradient` instead of `filter: blur()` | Orbs | `blur()` triggers expensive GPU recompositing |
| `mask-position` for dot reveal | Bright dots layer | More performant than clipPath or opacity |
| Trim terminal to last 500 lines | TerminalPanel | `prev.slice(-499)` — prevents unbounded memory growth |
| `AnimatePresence` + lazy | TerminalPanel, Dropdown | Panel only in DOM when open |

---

## 15. FAQ — Tough Questions You Will Be Asked

**Q: What is the difference between `useEffect` and `useCallback`?**

`useEffect` = "run this code as a side-effect after rendering" (e.g., connect to WebSocket, add event listeners)
`useCallback` = "memoize (cache) this function so it doesn't get recreated every render"

---

**Q: What is WebSocket and why not use regular HTTP requests?**

HTTP = ask → wait → response → connection closes. You have to keep asking.
WebSocket = open a persistent connection → both sides can send data at any time.

Workflow logs and step updates arrive continuously. Using HTTP would mean polling (asking every 100ms "any updates?") which is wasteful. WebSocket lets the backend push updates instantly as they happen.

---

**Q: What does `export const orchestrationService = new OrchestrationService()` mean?**

It creates the service object once when the file is first imported. Every other file that imports it gets the SAME instance. This is the **Singleton pattern** — guarantees there is only one WebSocket connection open at a time.

---

**Q: Why are there 48 files in the `ui/` folder?**

These are based on **shadcn/ui** — a collection of pre-built, accessible, customisable components built on top of Radix UI. They're not a library you install — they're copied into your project so you can edit them directly. This project includes them all even if not all are actively used (some like `recharts`-based `chart.tsx` are available for future use).

---

**Q: How does clicking a suggestion chip send a message?**

In `ChatArea.tsx`:
```tsx
<motion.button onClick={() => onSend(s)}>Audit access permissions</motion.button>
```
`onSend` is the `sendMessage` function passed from `app.tsx` via the `useOrchestration` hook. Clicking calls `sendMessage("Audit access permissions")` directly — exactly the same as typing it.

---

**Q: Why two different font sizes for `text-sm` and inline `style={{ fontSize: '...' }}`?**

`text-sm` is a Tailwind class. The inline `style` overrides exist when the designer wanted a specific value (like `0.9375rem` = 15px) that doesn't have an exact Tailwind equivalent. This is normal in real projects — Tailwind and inline styles coexist.

---

**Q: What happens if the backend is offline?**

In `ws-provider.ts` `sendMessage()`:
```ts
} catch (err) {
    this.emit({ type: 'message:new', message: { content: 'Error: Could not connect...' } });
}
```
The user sees an error message in the chat instead of a silent failure.

---

**Q: What is `(window as any).__currentWorkflowId`?**

A quick hack: `ws-provider` stores the current workflow ID on the global `window` object so `ChatArea.tsx` can access it without prop-drilling. The `(window as any)` bypasses TypeScript's check because `window` doesn't have this property in its type definition. In a larger codebase, this would be a Context or a shared service method.

---

**Q: How does PDF export work?**

In `useOrchestration.ts`'s `exportAudit('pdf')` function:
1. Fetches all workflows from `GET /api/v1/workflows`
2. Dynamically imports `jsPDF` (lazy loading — only loaded when needed)
3. Uses the `jsPDF` API to draw text, rectangles, and tables onto a virtual A4 page
4. Calls `pdf.save(filename)` which triggers a browser file download

---

**Q: What does `<React.StrictMode>` do?**

In development only: it renders every component twice to help find bugs (like missing cleanup in effects). Second render is invisible to the user. In production, it has zero effect and zero performance cost.

---

**Q: Why is the DAG viewer wrapped in `<ReactFlowProvider>`?**

`ReactFlowProvider` creates a React Context that all React Flow internal hooks (like `useReactFlow()`) need to access. Without it, `useReactFlow()` would throw an error because it can't find the context. The provider must be an ancestor of any component that uses React Flow hooks.

---

**Q: What is `lerp` and why is it used for the cursor spotlight?**

`lerp(a, b, t)` = Linear Interpolation = `a + (b - a) * t`

Instead of jumping instantly to cursor position, the spotlight moves 9% of the remaining distance each animation frame. This creates a smooth "lag" effect that feels much more premium than snapping. The value `0.09` was tuned by feel — smaller = more lag, larger = more direct.

---

*This document covers every file, every library, every pattern, and every concept in the Orchestral MCP frontend. Armed with this, you can answer deep technical questions with confidence.*
