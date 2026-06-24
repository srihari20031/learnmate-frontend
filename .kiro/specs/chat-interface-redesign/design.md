# Design Document — Chat Interface Redesign

## Overview

The LearnMate chat interface redesign transforms the current flat, monochrome dark UI (built with
`bg-slate-*` hardcoded values and `animate-bounce` indicators) into a premium, accessible chat
experience. The work is structured into five sequential implementation passes:

| Pass | Label | Scope |
|------|-------|-------|
| 1 | Theme_Pass | `app/globals.css`, `app/layout.tsx` — tokens + fonts |
| 2 | Layout_Pass | `app/page.tsx`, `sidebar.tsx`, `chat-window.tsx` — shell + scroll + pill |
| 3 | Thread_Pass | `chat-message.tsx`, `input-bar.tsx`, `empty-state.tsx` — bubbles + composer |
| 4 | Motion_Pass | framer-motion wiring across all animated elements |
| 5 | Polish_Pass | focus rings, ARIA, WCAG AA audit, reduced-motion final sweep |

The redesign is a **brownfield refactor** — no new pages or routes are added, and all existing
backend contracts (`lib/api.ts`) and data types (`lib/chat-utils.ts`) are preserved unchanged.

---

## Architecture

### High-Level Component Tree (After Redesign)

```
app/layout.tsx
 └── <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
      └── <body className="{displayFont.variable} {bodyFont.variable} {monoFont.variable}">
           └── app/page.tsx  (ChatPage — 'use client')
                ├── <Sidebar>          (overlay on mobile, inline on desktop)
                │    ├── SidebarHeader  (New Chat button + close button)
                │    ├── SessionList    (role="listbox", arrow-key nav)
                │    │    └── SessionItem × N  (active indicator bar)
                │    ├── <NotionSettings />
                │    └── SidebarFooter
                └── MainArea (flex-col)
                     ├── ChatHeader     (toggle button on mobile, user avatar, logout)
                     └── <ChatWindow>
                          ├── MessageThread  (scroll container)
                          │    ├── <AnimatePresence mode="popLayout">
                          │    │    └── <ChatMessage key={message.id} /> × N
                          │    ├── <LoadingIndicator />  (within assistant bubble)
                          │    └── <NewMessagesPill />   (floating, conditional)
                          └── <InputBar>  (Composer)
                               ├── AttachmentChip  (conditional, dismissible)
                               ├── FileInput       (hidden)
                               ├── AttachButton
                               ├── Textarea        (auto-resize)
                               └── SendButton
```

### State Ownership

All state lives in `app/page.tsx` (the existing pattern is preserved):

| State | Type | Owner |
|-------|------|-------|
| `sidebarOpen` | `boolean` | `ChatPage` |
| `messages` | `Message[]` | `ChatPage` |
| `isSending` | `boolean` | `ChatPage` |
| `activeSessionId` | `string` | `ChatPage` |
| `sessions` | `ChatSession[]` | `ChatPage` |
| `isScrolledUp` | `boolean` | `ChatWindow` (local) |
| `showPill` | `boolean` | `ChatWindow` (local) |
| `attachedFile` | `File \| null` | `InputBar` (local) |
| `fileError` | `string \| null` | `InputBar` (local) |
| `isFocused` | `boolean` | `InputBar` (local) |

### New Custom Hooks

Two new hooks are extracted to keep components lean:

**`hooks/use-scroll-anchor.ts`** — encapsulates scroll-to-bottom logic and the 100 px threshold
detection for the New Messages Pill:

```ts
interface UseScrollAnchorReturn {
  messagesEndRef: RefObject<HTMLDivElement>;
  containerRef: RefObject<HTMLDivElement>;
  isScrolledUp: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}
```

**`hooks/use-focus-trap.ts`** — traps focus within a given container ref; used by the mobile
Sidebar overlay:

```ts
interface UseFocusTrapOptions {
  enabled: boolean;
  onEscape?: () => void;
}
```

### framer-motion Boundaries

Every file that imports from `framer-motion` must have `'use client'` as its first line. The
affected files after the redesign are:

- `components/chat/chat-message.tsx`
- `components/chat/chat-window.tsx`
- `components/chat/sidebar.tsx`
- `components/chat/loading-indicator.tsx`
- `components/chat/input-bar.tsx`

`useReducedMotion()` is called once at the top of each of these files and passed down or used
inline — no `window.matchMedia` or CSS `@media` blocks inside component code.

---

## Components and Interfaces

### 1. `app/layout.tsx` — Theme_Pass changes

**Current**: loads Geist + Geist_Mono, no `<ThemeProvider>`, no font CSS variables on `<body>`.

**After**:
- Imports three `next/font/google` instances: `displayFont` (DM Serif Display), `bodyFont`
  (Plus Jakarta Sans), `monoFont` (JetBrains Mono), each with `display: 'swap'`.
- Wraps `{children}` in `<ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">`.
- Applies all three `.variable` class names to `<body>`:

```tsx
<body className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} antialiased bg-background text-foreground`}>
  <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
    {children}
  </ThemeProvider>
</body>
```

### 2. `app/globals.css` — Theme_Pass changes

**Seven semantic tokens** added/updated in the `.dark` block:

| Token | Value (OKLCH) | Purpose |
|-------|---------------|---------|
| `--background` | `oklch(0.16 0.008 250)` | Page + chat bg |
| `--surface-1` | `oklch(0.20 0.008 250)` | Sidebar, cards |
| `--surface-2` | `oklch(0.24 0.007 250)` | Assistant bubbles |
| `--foreground` | `oklch(0.95 0.005 250)` | Primary text |
| `--muted-foreground` | `oklch(0.65 0.010 250)` | Timestamps, hints |
| `--accent` | `oklch(0.72 0.15 255)` | Interactive emphasis (periwinkle-blue) |
| `--border` | `oklch(0.27 0.008 250)` | Dividers, bubble borders |

`--accent` chroma 0.15 satisfies the 0.08–0.18 range in Requirement 1.3. `--border` lightness
0.27 is within 0.22–0.30. `--muted-foreground` at L=0.65 against `--background` at L=0.16
yields a contrast ratio of approximately 5.2:1, meeting WCAG AA.

The `@theme inline` block gains three font variables and the two new surface tokens:

```css
@theme inline {
  /* … existing mappings … */
  --font-display: var(--font-dm-serif-display);
  --font-body:    var(--font-plus-jakarta-sans);
  --font-mono:    var(--font-jetbrains-mono);
  --color-surface-1: var(--surface-1);
  --color-surface-2: var(--surface-2);
}
```

All existing shadcn/ui token names (`--card`, `--popover`, `--primary`, `--secondary`,
`--muted`, `--destructive`, `--input`, `--ring`, `--chart-1` through `--chart-5`) are preserved
with their existing names; only their values may be updated for consistency.

CSS keyframe animations in `globals.css` that use `animate-bounce`, `animate-pulse`, and
`animate-float` are wrapped with a `@media (prefers-reduced-motion: no-preference)` guard so they
only run when the user has not opted out of motion. This satisfies Requirement 12.6.

### 3. `components/chat/sidebar.tsx` — Layout_Pass + Motion_Pass changes

**Props interface** (unchanged externally):
```ts
interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onToggle: () => void;
  isMobile: boolean;   // NEW — passed from page.tsx via useIsMobile hook
}
```

**Desktop layout**: `<motion.aside>` with `animate={{ width: isOpen ? 260 : 0 }}`,
`transition={{ duration: 0.24, ease: 'easeInOut' }}` when opening,
`transition={{ duration: 0.20, ease: 'easeInOut' }}` when closing.

**Mobile layout**: `position: fixed`, `height: 100vh`, `z-index: 50`, `translateX` animation.
A sibling backdrop `<motion.div>` animates from `opacity: 0` to `opacity: 0.5` simultaneously.
Focus is trapped via `useFocusTrap({ enabled: isMobile && isOpen })`.

**Session list**: rendered as `role="listbox"` with each item as `role="option"`. Arrow-key
navigation is implemented with a local `focusedIndex` state and `onKeyDown` handler.

**Active indicator**: each `SessionItem` renders a `<span>` with
`className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent rounded-r"` when
`session.id === activeSessionId`.

**Hover transition**: `whileHover={{ backgroundColor: 'var(--surface-1)' }}` with
`transition={{ duration: 0.10 }}`.

**Reduced motion**: `const reducedMotion = useReducedMotion()`. When `true`, all motion component
`transition.duration` values are set to `0`.

### 4. `app/page.tsx` — Layout_Pass changes

- Imports `useIsMobile` from `hooks/use-mobile.ts` (already exists).
- `sidebarOpen` initial value becomes `!isMobile` (open on desktop, closed on mobile).
- Passes `isMobile` to `<Sidebar>`.
- Renders backdrop `<div>` when `isMobile && sidebarOpen`, clicking it calls
  `setSidebarOpen(false)`.
- The existing hamburger button is given `aria-label="Open sidebar"` and `aria-expanded={sidebarOpen}`.

### 5. `components/chat/chat-window.tsx` — Layout_Pass + Motion_Pass changes

**Scroll anchor logic** is moved into `useScrollAnchor` hook.

**New Messages Pill** is a new sub-component `<NewMessagesPill>` defined in the same file or
extracted to `components/chat/new-messages-pill.tsx`:

```tsx
interface NewMessagesPillProps {
  visible: boolean;
  onClick: () => void;
}
```

It is absolutely positioned at `bottom-4 left-1/2 -translate-x-1/2` within the
message thread container (which is `position: relative`).

**AnimatePresence wrapper**:

```tsx
<AnimatePresence mode="popLayout">
  {messages.map((msg) => (
    <ChatMessage key={msg.id} message={msg} />
  ))}
</AnimatePresence>
```

**Loading indicator placement**: the `isLoading` sentinel message is replaced with a direct
`<LoadingIndicator />` rendered inside an assistant-style bubble container div to avoid the
fake-message anti-pattern.

### 6. `components/chat/chat-message.tsx` — Thread_Pass + Motion_Pass changes

The component is wrapped in `motion.div` with entrance animation:

```tsx
<motion.div
  initial={reducedMotion ? false : { opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  exit={reducedMotion ? {} : { opacity: 0 }}
  transition={reducedMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0, 0, 0.2, 1] }}
>
```

Stagger is applied via `custom` prop and `variants` with `delay: index * 0.06` (capped at
`Math.min(index, 8) * 0.06` = max 480 ms).

**User bubble**: `bg-accent text-accent-foreground rounded-3xl rounded-br-sm`, no avatar.

**Assistant bubble**:
- `bg-[var(--surface-2)] text-foreground border border-border shadow-[0_1px_3px_0_var(--border)] rounded-3xl rounded-bl-sm`
- 24×24 px circular avatar/icon on the left.

**Streaming cursor**: when `message.status === 'chatting'`, append `▋` character in a `<span>`
with CSS `animation: blink 1s step-end infinite` (500 ms on / 500 ms off). When reduced motion,
the span uses `opacity: 1` with no animation. The cursor span is removed when status transitions
to `'completed'` without layout shift (the char is inline, same font size).

**Action icon row**: `<div>` with `opacity: 0`, transitions to `opacity: 1` on group hover.
When reduced motion, static `opacity: 0.6`. Copy and regenerate icons for assistant messages,
edit icon for user messages. Each icon button has an `aria-label`.

**Timestamp**: `<span className="text-muted-foreground text-xs mt-1">` using `formatTimestamp(message.timestamp)`.

**Code blocks**: `font-mono` (maps to `var(--font-mono)`), inline code uses `font-mono text-xs`.
The display font is not used in message bubbles.

### 7. `components/chat/input-bar.tsx` — Thread_Pass + Motion_Pass changes

**Container structure**:

```
<div className="px-4 py-4 border-t border-border">          ← outer wrapper
  <div className="max-w-4xl mx-auto">
    {fileError && <ErrorMessage />}                           ← inline error (Req 6.6)
    {attachedFile && <AttachmentChip file={attachedFile} />} ← file chip (Req 6.5)
    <div className="relative rounded-xl border border-border bg-surface-1">
      <HighlightLine focused={isFocused} />                  ← signature detail (Req 2)
      <div className="flex items-end gap-2 px-3 py-3">
        <AttachButton />
        <Textarea />
        <SendButton />
      </div>
    </div>
  </div>
</div>
```

**Highlight Line** (Req 2 — Signature Detail):

```tsx
// Absolutely positioned 2px top line inside the input container
<div
  className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl"
  style={{
    background: 'var(--accent)',
    opacity: isFocused ? 1 : 0,
    transition: reducedMotion
      ? 'none'
      : isFocused
        ? 'opacity 250ms ease-out'
        : 'opacity 175ms ease-in',
  }}
/>
```

Opacity is 1.0 when focused (satisfies ≥ 0.7 ≤ 1.0), 0 when blurred. When reduced motion, the
element is rendered at full opacity with no transition.

**Send button animation**: uses `motion.button` with `whileTap={{ scale: 0.92 }}`,
`transition={{ duration: 0.12, ease: 'easeOut' }}`.

**Disabled state**: when `!message.trim() || disabled`, send button gets
`opacity-40 cursor-not-allowed pointer-events-none`.

**File validation error**: replaces the existing `alert()` calls with an `<ErrorMessage>` inline
element styled with `color: var(--destructive)`. Error persists until user selects a new file or
clears it manually. File input is reset on error.

**Attachment chip**: `<div>` showing filename + file-type icon + `×` dismiss button.
Clicking dismiss: clears `attachedFile`, resets `fileInputRef.current.value`.

**Enter/Shift+Enter**: existing behavior in `handleKeyDown` is preserved.

### 8. `components/chat/loading-indicator.tsx` — Thread_Pass + Motion_Pass changes

Replaced entirely with a three-bar waveform:

```tsx
export function LoadingIndicator() {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return (
      <span className="text-muted-foreground text-sm">…</span>
    );
  }

  return (
    <div className="flex items-end gap-[3px] h-4" aria-label="Thinking">
      {[0, 100, 200].map((delay) => (
        <motion.span
          key={delay}
          className="w-[2.5px] rounded-full bg-accent"
          style={{ boxShadow: '0 0 6px 0 color-mix(in oklch, var(--accent) 30%, transparent)' }}
          animate={{ height: ['4px', '16px', '4px'] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: delay / 1000,
          }}
        />
      ))}
    </div>
  );
}
```

The indicator is **not** wrapped in a `<ChatMessage>` with a fake loading message. Instead,
`chat-window.tsx` renders it directly inside an assistant-style bubble container:

```tsx
{isLoading && (
  <div className="flex justify-start mb-4">
    <div className="flex items-start gap-3">
      <AssistantAvatar />
      <div className="max-w-2xl px-4 py-3 bg-[var(--surface-2)] border border-border rounded-3xl rounded-bl-sm shadow-[0_1px_3px_0_var(--border)]">
        <LoadingIndicator />
      </div>
    </div>
  </div>
)}
```

### 9. `components/chat/empty-state.tsx` — Thread_Pass changes

- The `<h1>` wordmark receives `font-family: var(--font-display)` via `className="font-display ..."`.
- The gradient blob background animations are guarded:
  `@media (prefers-reduced-motion: no-preference)` in globals.css.
- Suggestion chips use `bg-surface-1 border-border hover:bg-surface-2` instead of hardcoded
  `blue-500/10`.
- The avatar icon circle uses `bg-surface-2 border-border`.

### 10. `components/chat/new-messages-pill.tsx` — new component

```tsx
interface NewMessagesPillProps {
  visible: boolean;
  onClick: () => void;
  reducedMotion: boolean;
}
```

Rendered inside `ChatWindow`'s message thread container at `absolute bottom-4 left-1/2
-translate-x-1/2 z-10`. Uses `AnimatePresence` for mount/unmount. When `visible`:

```tsx
<motion.button
  initial={reducedMotion ? false : { opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={reducedMotion ? {} : { opacity: 0 }}
  transition={{ duration: reducedMotion ? 0 : 0.2 }}
  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-xs font-medium shadow-md"
  aria-live="polite"
  aria-label="Scroll to new messages"
>
  <ArrowDown className="w-3 h-3" /> New messages
</motion.button>
```

Dismiss on `exit` uses `opacity: 0` over 150 ms.

---

## Data Models

No new data types are introduced. All existing types in `lib/chat-utils.ts` are used as-is:

```ts
// Unchanged
interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  status?: 'chatting' | 'completed';
  notionUrls?: string[];
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  messageCount: number;
}
```

### Derived UI State

The following UI-only state shapes are used locally in components (not stored in
`lib/chat-utils.ts`):

```ts
// InputBar local state
interface InputBarState {
  message: string;
  attachedFile: File | null;
  fileError: string | null;
  isFocused: boolean;
}

// ChatWindow scroll state (managed by useScrollAnchor hook)
interface ScrollAnchorState {
  isScrolledUp: boolean;    // true when > 100px from bottom
  showPill: boolean;        // true when scrolledUp AND new message arrived
}
```

### Animation Variant Maps

These are pure constant objects used by framer-motion — not persisted or transmitted:

```ts
// chat-message.tsx
const messageVariants = {
  initial: (reducedMotion: boolean) => ({
    opacity: reducedMotion ? 1 : 0,
    y: reducedMotion ? 0 : 12,
  }),
  animate: { opacity: 1, y: 0 },
  exit: (reducedMotion: boolean) => ({
    opacity: reducedMotion ? 1 : 0,
  }),
};

// Per-message stagger delay (ms → seconds, capped at index 8)
const staggerDelay = (index: number): number =>
  Math.min(index, 8) * 0.06;
```

---

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

### Property 1: Code content always rendered in mono font

*For any* `Message` whose `content` string contains a fenced code block (` ``` `) or inline code
(`` ` ``), rendering `ChatMessage` SHALL produce DOM elements for those code spans that have
`font-family` resolving to `var(--font-mono)`.

**Validates: Requirements 3.5**

---

### Property 2: Message alignment is determined entirely by role

*For any* `Message` object, regardless of content or timestamp, when rendered inside
`ChatMessage`:
- If `message.role === 'user'`, the outermost wrapper SHALL have a CSS class that produces
  `justify-content: flex-end` (e.g. `justify-end`).
- If `message.role === 'agent'`, the outermost wrapper SHALL have a CSS class that produces
  `justify-content: flex-start` (e.g. `justify-start`).

**Validates: Requirements 5.1**

---

### Property 3: Bubble visual treatment matches role

*For any* `Message` object rendered by `ChatMessage`:
- **User bubble**: background resolves to `var(--accent)`, text color resolves to
  `var(--accent-foreground)`, and no avatar element is present in the subtree.
- **Assistant bubble**: background resolves to `var(--surface-2)`, text color resolves to
  `var(--foreground)`, a 24×24 px avatar/icon element is present as the first child of the
  row container, and the bubble container includes a `box-shadow` of
  `0 1px 3px 0 var(--border)`.

Both conditions must hold regardless of message content length, presence of Notion URLs, or
streaming status.

**Validates: Requirements 5.2, 5.3, 5.4**

---

### Property 4: Action icon set matches role

*For any* `Message` rendered by `ChatMessage`, on hover or focus of the bubble:
- If `message.role === 'agent'`, the revealed action row SHALL contain a copy icon and a
  regenerate icon.
- If `message.role === 'user'`, the revealed action row SHALL contain an edit icon.
No extra role-mismatched icons shall appear in either case.

**Validates: Requirements 5.5**

---

### Property 5: Timestamp always rendered in muted-foreground

*For any* `Message` with any numeric `timestamp` value, rendering `ChatMessage` SHALL produce
a text element whose CSS color resolves to `var(--muted-foreground)`, with text content equal
to the result of `formatTimestamp(message.timestamp)`.

**Validates: Requirements 5.7**

---

### Property 6: Whitespace-only or empty input disables send

*For any* string value of the Composer textarea where `value.trim() === ''` (including the empty
string and all strings composed entirely of whitespace characters), the send button SHALL:
- Have an opacity of 0.4 (via `opacity-40` or equivalent).
- Have `cursor: not-allowed` (via `cursor-not-allowed` or `pointer-events-none`).
- NOT invoke the `onSend` callback when clicked.

**Validates: Requirements 6.3**

---

### Property 7: Enter/Shift+Enter submit behaviour

*For any* textarea value containing at least one non-whitespace character:
- Pressing `Enter` (without `Shift`) SHALL call `onSend` with the trimmed message and clear
  the textarea.
- Pressing `Shift+Enter` SHALL append a `\n` to the textarea value and NOT call `onSend`.

**Validates: Requirements 6.4**

---

### Property 8: File validation error for any invalid attachment

*For any* `File` object where `file.size > 20 * 1024 * 1024` OR
`ALLOWED_TYPES.includes(file.type) === false`, selecting that file in the Composer SHALL:
- Display an inline error element (`<ErrorMessage>`) containing a non-empty error string.
- NOT call `window.alert()`.
- Reset the file `<input>` element to an empty state.

This must hold for any combination of file size and MIME type that fails validation.

**Validates: Requirements 6.6**

---

### Property 9: Stagger delay function is bounded and monotone

*For any* non-negative integer `index` representing the position of a message in a batch
arrival, the stagger delay SHALL equal `Math.min(index, 8) * 60` milliseconds. Specifically:
- The result SHALL be in the range `[0, 480]` ms.
- For indices 0–8, the result SHALL increase monotonically by 60 ms per step.
- For any index ≥ 8, the result SHALL equal exactly 480 ms.

**Validates: Requirements 8.2**

---

### Property 10: Scroll-anchor threshold governs auto-scroll and pill visibility

*For any* scroll state of the `ChatWindow` message container and for any new message arrival:
- If the current scroll offset from the bottom is ≤ 100 px, the container SHALL auto-scroll to
  the bottom and the New Messages Pill SHALL NOT be shown.
- If the current scroll offset from the bottom is > 100 px, the container SHALL NOT auto-scroll
  and the New Messages Pill SHALL be displayed.
- When the user manually scrolls to within 100 px of the bottom, the New Messages Pill SHALL
  be dismissed.

This property subsumes the streaming auto-scroll behavior (Req 11.4) and pill auto-dismiss
(Req 10.5).

**Validates: Requirements 10.1, 10.2, 10.5, 11.4**

---

### Property 11: Streaming cursor present for any chatting message

*For any* `Message` with `status === 'chatting'` and any value of `content` (including empty
string and long markdown strings), rendering `ChatMessage` SHALL produce a DOM node containing
the character `▋` as a direct descendant of the content area.

**Validates: Requirements 11.1**

---

### Property 12: Every interactive element has a visible focus ring

*For any* interactive element (button, anchor, textarea, listbox option) rendered anywhere in
the chat interface, receiving keyboard focus SHALL produce a visible outline that:
- Has a width of at least 2 px.
- Has an offset of 2 px.
- Uses a color that resolves to `var(--ring)`.

**Validates: Requirements 12.1**

---

### Property 13: Every button and link has an accessible label

*For any* `<button>` or `<a>` element rendered in the chat interface, the element SHALL have
either non-empty visible text content or a non-empty `aria-label` attribute. No button or link
may be present without one of these.

**Validates: Requirements 12.2**

---

### Property 14: Reduced motion sets all animation durations to zero

*For any* animated component in the chat interface (ChatMessage motion wrapper, Sidebar width
animation, NewMessagesPill, LoadingIndicator bars, InputBar highlight line), when
`useReducedMotion()` returns `true`, all `transition.duration` values in motion component
props SHALL equal `0` seconds, so that all animated elements reach their final state
immediately.

**Validates: Requirements 13.4**

---

## Error Handling

### File Attachment Validation

The current `InputBar` uses `window.alert()` for file errors. After the redesign:

- A local `fileError: string | null` state replaces the alert.
- On invalid MIME type: sets `fileError` to `"Unsupported file type. Allowed: PDF, DOCX, DOC, TXT, and images."`.
- On file exceeding 20 MB: sets `fileError` to `"File exceeds 20 MB limit."`.
- The error is rendered as an inline `<p>` element above the composer using
  `color: var(--destructive)` and `font-size: 0.875rem`.
- The error is cleared when the user selects a new file (on next `handleFileSelect` call) or
  clicks a clear button in the error message.
- The file `<input>` is reset via `fileInputRef.current.value = ''` on every validation failure.

### Network Errors

Network error handling in `lib/api.ts` and `app/page.tsx` is unchanged. Errors are logged to
`console.error` and the UI returns to an interactive state via the `finally` block in
`handleSendMessage`.

### Streaming Interruption

If an assistant message is added with `status: 'chatting'` but never transitions to
`'completed'` (e.g. a dropped connection), the blinking cursor remains visible. This is an
acceptable degraded state — the `ChatWindow` will show the partial response with the cursor.
Future work may add a timeout that forces `status: 'completed'` after a configurable duration.

### AnimatePresence Exit Race

`AnimatePresence mode="popLayout"` guarantees that exit animations run to completion before
element removal. The `chat-window.tsx` MUST NOT programmatically remove a message from the
`messages` array during its exit animation (200 ms). Since message deletion is user-initiated
(via `handleDeleteSession`) rather than automatic, this is not an issue in normal operation.

---

## Testing Strategy

### Overview

The redesign is a **UI refactor with no new backend logic**. The testing strategy therefore
emphasises:
1. **Property-based tests** for pure logic (stagger delay, scroll threshold, input validation).
2. **Component render tests** for visual invariants (bubble styles by role, focus rings, ARIA labels).
3. **Example/integration tests** for specific interactions (hover, keyboard navigation, mobile overlay).
4. **Smoke tests** for static configuration (CSS tokens, font setup, package.json).

Property-based testing IS appropriate here because several behaviors (bubble styles, alignment,
stagger delay, scroll threshold, input validation) are pure functions or universal invariants
over a meaningful input space.

### Property-Based Testing Library

Use **fast-check** (`fast-check` on npm, version pinned without range specifiers) — the
standard PBT library for TypeScript/JavaScript projects. Minimum 100 iterations per property.

### Unit / Component Tests

Use **Vitest** (already available or easily added to Next.js 16 projects) with
**@testing-library/react** for component rendering and interaction tests.

### Test File Layout

```
__tests__/
  unit/
    stagger-delay.test.ts          ← Property 9
    scroll-threshold.test.ts       ← Property 10 (pure threshold logic)
    input-validation.test.ts       ← Properties 6, 7, 8
  component/
    chat-message.test.tsx          ← Properties 2, 3, 4, 5, 11, 14
    input-bar.test.tsx             ← Properties 6, 7, 8 (component level)
    loading-indicator.test.tsx     ← Req 7 smoke tests
    sidebar.test.tsx               ← Properties 4 (session items), 12, 13
    chat-window.test.tsx           ← Properties 10, 12, 13
    empty-state.test.tsx           ← Req 3.6 example
  smoke/
    css-tokens.test.ts             ← Requirements 1.x, 12.5, 14.4
    font-setup.test.ts             ← Requirements 3.x, 14.1, 14.2
    package-deps.test.ts           ← Requirements 13.1, 13.2, 13.3, 13.5
```

### Property Test Tag Format

Each property test must include a comment:

```ts
// Feature: chat-interface-redesign, Property N: <property_text>
```

### Property Test Implementations (Sketches)

**Property 2 — Alignment by role:**
```ts
// Feature: chat-interface-redesign, Property 2: Message alignment is determined entirely by role
fc.assert(fc.property(
  fc.record({
    id: fc.uuid(),
    role: fc.constantFrom('user', 'agent') as fc.Arbitrary<'user' | 'agent'>,
    content: fc.string(),
    timestamp: fc.integer({ min: 0 }),
  }),
  (message) => {
    const { container } = render(<ChatMessage message={message} />);
    const wrapper = container.firstChild as HTMLElement;
    if (message.role === 'user') {
      expect(wrapper).toHaveClass('justify-end');
    } else {
      expect(wrapper).toHaveClass('justify-start');
    }
  }
), { numRuns: 100 });
```

**Property 9 — Stagger delay:**
```ts
// Feature: chat-interface-redesign, Property 9: Stagger delay function is bounded and monotone
fc.assert(fc.property(
  fc.nat(50),
  (index) => {
    const delay = staggerDelay(index);
    expect(delay).toBe(Math.min(index, 8) * 0.06);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(0.48);
  }
), { numRuns: 100 });
```

**Property 10 — Scroll threshold:**
```ts
// Feature: chat-interface-redesign, Property 10: Scroll-anchor threshold governs auto-scroll
fc.assert(fc.property(
  fc.integer({ min: 0, max: 5000 }),  // scrollDistanceFromBottom
  (offset) => {
    const result = shouldAutoScroll(offset);  // extracted pure function
    if (offset <= 100) {
      expect(result).toBe(true);
    } else {
      expect(result).toBe(false);
    }
  }
), { numRuns: 500 });
```

**Property 6 — Whitespace disables send:**
```ts
// Feature: chat-interface-redesign, Property 6: Whitespace-only or empty input disables send
fc.assert(fc.property(
  fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r')),  // whitespace-only strings
  (whitespaceInput) => {
    const onSend = vi.fn();
    const { getByRole } = render(<InputBar onSend={onSend} />);
    // Type whitespace input
    fireEvent.change(getByRole('textbox'), { target: { value: whitespaceInput } });
    const btn = getByRole('button', { name: /send/i });
    expect(btn).toHaveClass('opacity-40');
    fireEvent.click(btn);
    expect(onSend).not.toHaveBeenCalled();
  }
), { numRuns: 100 });
```

### Reduced Motion Mocking

All tests that check reduced-motion behavior mock `framer-motion`'s `useReducedMotion`:

```ts
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: vi.fn().mockReturnValue(true) };
});
```

### Smoke Tests

The CSS token smoke tests parse `app/globals.css` as a string and use regex to extract OKLCH
component values. OKLCH-to-sRGB conversion uses the standard matrix transformation. No browser
is required — these run in the Node.js Vitest environment.

The package.json smoke test reads the file and asserts:
1. `framer-motion` key is present.
2. The value string contains none of `^`, `~`, `*`, `>`.

### What Is NOT Tested with PBT

The following requirements are explicitly excluded from property-based testing:
- **CSS animation timing** (Req 8.1, 9.1, 9.2, 9.3): tested by inspecting motion component
  props in component render tests — framer-motion's correctness is trusted.
- **Focus trap behavior** (Req 12.4): tested with a specific keyboard interaction example.
- **ARIA listbox arrow-key navigation** (Req 12.3): tested with a specific interaction example.
- **Visual aesthetics** (signature detail opacity transitions, bar shadow glow): example-based
  style assertion tests.

---

## Pass 6 — Attachment Support

This pass wires up the completed backend multipart API into the frontend, adds inline attachment rendering to chat bubbles, and cleans up the stale upload code left over from the prior architecture.

### 6.1 Data Model Changes

#### `lib/chat-utils.ts`

Add a shared `AttachmentMeta` interface and update `Message` to use it:

```ts
export interface AttachmentMeta {
  id: string;
  filename: string;
  type: 'document' | 'image';
  mime_type: string;
  base64?: string; // populated for images only
}

export interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  status?: 'chatting' | 'completed';
  notionUrls?: string[];
  attachments?: AttachmentMeta[]; // replaces the previous looser array type
}
```

`createMessage` gains an optional `attachments?: AttachmentMeta[]` parameter (already present in the current implementation; just needs the updated type).

#### `lib/api.ts`

1. Export `AttachmentMeta` (or import it from `chat-utils`) and add it to:
   - `ChatMessageResponse.attachments?: AttachmentMeta[]` — so history loads carry attachment data
   - `MessageResponse.attachments?: AttachmentMeta[]` — so the send response carries the stored attachment objects back

The `sendMessage` function already handles multipart correctly when `files` is non-empty; no body change needed.

### 6.2 `app/page.tsx` Changes

**Remove dead code:**
- Remove `handleFileUpload` callback.
- Remove `isUploading` / `setIsUploading` state (was never declared but referenced — source of TS errors).
- Remove `isUploading` prop passed to `<ChatWindow>` (the prop doesn't exist on `ChatWindowProps`).
- Remove unused `uploadFile`, `UploadResponse`, and `UpdateChatTitleResponse` imports.

**Update `handleSendMessage` signature:**
```ts
const handleSendMessage = useCallback(
  async (userMessage: string, file?: File) => {
    if (!userMessage.trim() || !activeSessionId) return;
    try {
      // Build client-side attachment metadata for the user message bubble
      const userAttachments: AttachmentMeta[] | undefined = file
        ? [{ id: crypto.randomUUID(), filename: file.name, type: file.type.startsWith('image/') ? 'image' : 'document', mime_type: file.type }]
        : undefined;

      const userMsg = createMessage(userMessage, 'user', undefined, undefined, userAttachments);
      setMessages((prev) => [...prev, userMsg]);
      setIsSending(true);

      const files = file ? [file] : undefined;
      const data = await sendMessage(activeSessionId, userMessage, files);

      const agentMsg = createMessage(
        data.response,
        'agent',
        'completed',
        data.notion_urls,
        data.attachments, // echo back server-stored attachments if present
      );
      setMessages((prev) => [...prev, agentMsg]);
      // ... title update logic unchanged ...
    } catch (error) {
      console.error('[API]', error);
    } finally {
      setIsSending(false);
    }
  },
  [activeSessionId]
);
```

**Update `toMessage` mapper** to carry attachments from history:
```ts
const toMessage = (message: ChatMessageResponse, index: number): Message => {
  // ... existing timestamp/role logic ...
  return {
    id: `${role}-${index}-${timestamp}`,
    role,
    content: message.content,
    timestamp,
    status: role === 'agent' ? 'completed' : undefined,
    notionUrls: message.notion_urls,
    attachments: message.attachments, // new
  };
};
```

### 6.3 `components/chat/chat-message.tsx` Changes

Add an `<AttachmentSection>` sub-component rendered inside each bubble container, above the text content:

```tsx
function AttachmentSection({ attachments }: { attachments: AttachmentMeta[] }) {
  const images = attachments.filter((a) => a.type === 'image' && a.base64);
  const docs   = attachments.filter((a) => a.type === 'document');

  return (
    <div className="flex flex-col gap-2 mb-2">
      {images.map((img) => (
        <img
          key={img.id}
          src={`data:${img.mime_type};base64,${img.base64}`}
          alt={img.filename}
          className="rounded-xl object-cover max-w-[240px] max-h-[180px]"
        />
      ))}
      {docs.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-border text-sm"
          aria-label={`Attachment: ${doc.filename} (${mimeToLabel(doc.mime_type)})`}
        >
          <FileIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
          <span className="truncate max-w-[180px] text-foreground">{doc.filename}</span>
          <span className="text-muted-foreground text-xs flex-shrink-0">
            {mimeToLabel(doc.mime_type)}
          </span>
        </div>
      ))}
    </div>
  );
}

// Pure helper — derives a human-readable label from a MIME type
function mimeToLabel(mime: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/msword': 'DOC',
    'text/plain': 'TXT',
  };
  return map[mime] ?? mime.split('/')[1]?.toUpperCase() ?? 'FILE';
}
```

`AttachmentSection` is rendered at the top of the bubble's content area when `message.attachments?.length > 0`.

### 6.4 Component Tree After Pass 6

```
<ChatMessage>
  <motion.div>          ← existing entrance animation wrapper
    {isUser ? (
      <UserBubble>
        {attachments && <AttachmentSection attachments={attachments} />}
        <ReactMarkdown>{content}</ReactMarkdown>
      </UserBubble>
    ) : (
      <AssistantRow>
        <AssistantAvatar />
        <AssistantBubble>
          {attachments && <AttachmentSection attachments={attachments} />}
          <ReactMarkdown>{content}</ReactMarkdown>
          {isChatting && <StreamingCursor />}
          {notionUrls && <NotionCards />}
        </AssistantBubble>
      </AssistantRow>
    )}
  </motion.div>
</ChatMessage>
```

### 6.5 Error Handling

- If `data.attachments` is absent from the `MessageResponse`, the agent message is created with `attachments: undefined` — no change in rendering.
- If a historical message has `attachments` with an image but the `base64` field is absent (e.g. a doc-only message), the `images` filter in `AttachmentSection` returns an empty array and only the doc card renders — no broken `<img>` tags.
- The `InputBar` already handles file validation errors inline (Req 6.6) and the `onSend` callback already passes the file. No additional error handling is needed here.

### 6.6 TypeScript Compile Errors Fixed by This Pass

| File | Error | Fix |
|------|-------|-----|
| `app/page.tsx` | `Cannot find name 'setIsUploading'` | Remove `handleFileUpload` and all `isUploading` references |
| `app/page.tsx` | `Property 'isUploading' does not exist on type 'ChatWindowProps'` | Remove the prop from the `<ChatWindow>` call |
| `app/page.tsx` | `RefObject<HTMLButtonElement \| null>` not assignable | Fix by typing `toggleButtonRef` as `RefObject<HTMLButtonElement>` (non-null assertion via initial value or type cast in `useFocusTrap`) |
