# Implementation Plan: Chat Interface Redesign

## Overview

Incremental five-pass refactor of the LearnMate chat interface. Each pass is independently shippable and builds on the previous one. No new routes or backend contracts are introduced — the work is entirely within `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, and the `components/chat/` tree. `framer-motion` is added as the only new dependency.

---

## Tasks

- [x] 1. Pass 1 — Theme: tokens, fonts, and ThemeProvider wiring
  - [x] 1.1 Update `app/globals.css` with the seven semantic OKLCH color tokens and `@theme inline` font/surface mappings
    - Define `--background`, `--surface-1`, `--surface-2`, `--foreground`, `--muted-foreground`, `--accent`, `--border` in the `.dark` block with the OKLCH values from the design
    - Add `--color-surface-1` and `--color-surface-2` mappings to `@theme inline`
    - Add `--font-display`, `--font-body`, `--font-mono` to `@theme inline` referencing the `next/font/google` CSS variables
    - Wrap `animate-bounce`, `animate-pulse`, and `animate-float` keyframe rules in `@media (prefers-reduced-motion: no-preference)`
    - Preserve all existing shadcn/ui token names (`--card`, `--popover`, `--primary`, etc.)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.4, 12.6, 14.4_

  - [x] 1.2 Update `app/layout.tsx` to load three `next/font/google` instances and wrap children in `<ThemeProvider>`
    - Import `DM_Serif_Display`, `Plus_Jakarta_Sans`, and `JetBrains_Mono` each with `display: 'swap'` and `variable` option
    - Apply all three `.variable` class names plus `antialiased bg-background text-foreground` to `<body>`
    - Wrap children with `<ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">`
    - _Requirements: 3.1, 3.2, 3.3, 14.1, 14.2, 14.3_

  - [ ]* 1.3 Write smoke tests for CSS token values and font setup
    - Parse `app/globals.css` as a string; assert all seven tokens exist in the `.dark` block with OKLCH lightness/chroma values within the specified ranges
    - Assert that `--muted-foreground` against `--background` contrast ratio is ≥ 4.5:1 (Node-only OKLCH → sRGB conversion)
    - Assert `@theme inline` contains `--font-display`, `--font-body`, `--font-mono`, `--color-surface-1`, `--color-surface-2`
    - Parse `app/layout.tsx` AST or text; assert `ThemeProvider` is present with correct props and three font variables are applied to `<body>`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 3.2, 3.3, 3.4, 14.1, 14.2_

- [x] 2. Pass 2 — Layout: shell, sidebar modes, and scroll infrastructure
  - [x] 2.1 Create `hooks/use-scroll-anchor.ts`
    - Implement `containerRef` and `messagesEndRef` refs
    - Track `isScrolledUp` boolean: `true` when scroll offset from bottom > 100 px
    - Expose `scrollToBottom(behavior?)` that calls `messagesEndRef.current?.scrollIntoView`
    - Export the `UseScrollAnchorReturn` interface
    - _Requirements: 10.1, 10.2, 10.5_

  - [x] 2.2 Create `hooks/use-focus-trap.ts`
    - Accept `UseFocusTrapOptions { enabled: boolean; onEscape?: () => void }`
    - When `enabled` is `true`, collect all focusable elements within the container ref and intercept Tab / Shift+Tab to cycle within that set; call `onEscape` on Escape key
    - _Requirements: 12.4_

  - [x] 2.3 Update `app/page.tsx` for mobile-aware sidebar state and backdrop
    - Import `useIsMobile` and set `sidebarOpen` initial value to `!isMobile`
    - Pass `isMobile` prop to `<Sidebar>`
    - Render a fixed backdrop `<div>` when `isMobile && sidebarOpen`; clicking it sets `sidebarOpen(false)`
    - Add `aria-label="Open sidebar"` and `aria-expanded={sidebarOpen}` to the hamburger button
    - _Requirements: 4.1, 4.3, 4.4, 4.7, 12.2_

  - [x] 2.4 Refactor `components/chat/sidebar.tsx` for desktop inline vs mobile overlay layout
    - Add `isMobile` to the `SidebarProps` interface
    - Desktop: `<motion.aside>` with `animate={{ width: isOpen ? 260 : 0 }}`, 240 ms open / 200 ms close ease-in-out
    - Mobile: `position: fixed`, `height: 100vh`, `z-index: 50`, `translateX` animation; sibling backdrop animates opacity 0→0.5
    - Integrate `useFocusTrap({ enabled: isMobile && isOpen, onEscape: onToggle })`
    - Render session list as `role="listbox"` with `role="option"` items and arrow-key `focusedIndex` navigation
    - Add active indicator `<span>` with `bg-accent` left-edge bar when `session.id === activeSessionId`
    - Add `aria-label` to the New Chat and close buttons
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 9.5, 12.2, 12.3, 12.4_

  - [x] 2.5 Create `components/chat/new-messages-pill.tsx`
    - Accept `NewMessagesPillProps { visible: boolean; onClick: () => void; reducedMotion: boolean }`
    - Use `AnimatePresence` for mount/unmount; `motion.button` with `initial={{ opacity: 0, y: 8 }}`, `animate={{ opacity: 1, y: 0 }}`, exit fade 150 ms
    - Position absolute `bottom-4 left-1/2 -translate-x-1/2 z-10` inside the thread container
    - `aria-live="polite"`, `aria-label="Scroll to new messages"`, label "New messages" with `ArrowDown` icon
    - When `reducedMotion` is `true`, skip all animation durations (set to 0)
    - _Requirements: 10.3, 10.4, 10.6, 12.2_

  - [x] 2.6 Update `components/chat/chat-window.tsx` to use `useScrollAnchor`, `AnimatePresence`, and `NewMessagesPill`
    - Replace inline scroll logic with `useScrollAnchor`; derive `showPill` from `isScrolledUp && hasNewMessages`
    - Wrap message list in `<AnimatePresence mode="popLayout">` with stable `key={msg.id}` per child
    - Render `<NewMessagesPill>` at the bottom of the thread container
    - Replace fake loading `Message` sentinel with a direct `<LoadingIndicator />` inside an assistant-style bubble container
    - Apply 8 px base-unit spacing rhythm and `--border` divider between header/thread/composer
    - _Requirements: 4.5, 4.6, 10.1, 10.2, 10.3, 10.4, 10.5, 13.5_

  - [ ]* 2.7 Write unit tests for `use-scroll-anchor` threshold logic
    - Extract `shouldAutoScroll(offsetFromBottom: number): boolean` as a pure function
    - **Property 10: Scroll-anchor threshold governs auto-scroll and pill visibility**
    - **Validates: Requirements 10.1, 10.2, 10.5, 11.4**

- [x] 3. Checkpoint — Pass 2 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Pass 3 — Thread: message bubbles, composer, empty state, and loading indicator
  - [x] 4.1 Refactor `components/chat/chat-message.tsx` for role-based bubble treatment, timestamps, and streaming cursor
    - Apply `justify-end` for user messages, `justify-start` for assistant messages (outermost wrapper)
    - User bubble: `bg-accent text-accent-foreground rounded-3xl rounded-br-sm`, no avatar
    - Assistant bubble: `bg-[var(--surface-2)] text-foreground border border-border shadow-[0_1px_3px_0_var(--border)] rounded-3xl rounded-bl-sm` + 24×24 px avatar on the left
    - Render timestamp `<span className="text-muted-foreground text-xs mt-1">` using `formatTimestamp(message.timestamp)`
    - When `message.status === 'chatting'`, append `▋` in a `<span>` with `animation: blink 1s step-end infinite`; remove span (not character) when status becomes `'completed'`
    - When `prefers-reduced-motion`, render cursor at `opacity: 1` with no blink animation
    - Apply `font-mono` to fenced code block and inline code elements
    - Add action icon row (`opacity-0 group-hover:opacity-100 transition-opacity duration-150`): copy + regenerate for assistant, edit for user; each with `aria-label`
    - When `prefers-reduced-motion`, set action icons to static `opacity-[0.6]`
    - Add `'use client'` directive (first line)
    - _Requirements: 3.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 11.1, 11.2, 11.3, 11.5_

  - [ ]* 4.2 Write property tests for `chat-message.tsx` — alignment and bubble treatment
    - **Property 2: Message alignment is determined entirely by role**
    - **Validates: Requirements 5.1**
    - **Property 3: Bubble visual treatment matches role**
    - **Validates: Requirements 5.2, 5.3, 5.4**
    - **Property 4: Action icon set matches role**
    - **Validates: Requirements 5.5**
    - **Property 5: Timestamp always rendered in muted-foreground**
    - **Validates: Requirements 5.7**
    - **Property 11: Streaming cursor present for any chatting message**
    - **Validates: Requirements 11.1**
    - **Property 14: Reduced motion sets all animation durations to zero**
    - **Validates: Requirements 13.4**

  - [ ]* 4.3 Write property tests for `chat-message.tsx` — code font
    - **Property 1: Code content always rendered in mono font**
    - **Validates: Requirements 3.5**

  - [x] 4.4 Rewrite `components/chat/loading-indicator.tsx` as three-bar waveform
    - Add `'use client'` directive
    - Call `useReducedMotion()`; when `true`, render `<span className="text-muted-foreground text-sm">…</span>`
    - When `false`, render three `<motion.span>` bars: `w-[2.5px] rounded-full bg-accent`, `animate={{ height: ['4px','16px','4px'] }}`, duration 0.8 s, repeat Infinity, ease `easeInOut`, delays 0/100/200 ms
    - Apply `boxShadow: '0 0 6px 0 color-mix(in oklch, var(--accent) 30%, transparent)'`
    - Wrap in `<div className="flex items-end gap-[3px] h-4" aria-label="Thinking">`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 13.2_

  - [x] 4.5 Refactor `components/chat/input-bar.tsx` for surface tokens, highlight line, file chip, and inline errors
    - Add `'use client'` directive
    - Replace `slate-800/50` background with `bg-surface-1 border border-border` on the textarea container
    - Add `isFocused` state; set on `onFocus`/`onBlur` of textarea
    - Render `<HighlightLine focused={isFocused} reducedMotion={reducedMotion} />`: 2 px `bg-accent` top line inside container, opacity 0→1 (250 ms ease-out) on focus, 1→0 (175 ms ease-in) on blur; reduced motion: full opacity, no transition
    - Wrap send button in `motion.button` with `whileTap={{ scale: 0.92 }}`, `transition={{ duration: 0.12, ease: 'easeOut' }}`
    - Disable send when `!message.trim() || disabled`: `opacity-40 cursor-not-allowed pointer-events-none`
    - Add `attachedFile` + `fileError` local state; replace `alert()` with inline `<ErrorMessage>` styled `color: var(--destructive) text-sm`
    - Render `<AttachmentChip>` when `attachedFile` is set; dismiss clears state and resets `fileInputRef.current.value`
    - Validate file on selection: size > 20 MB → error; unsupported MIME → error; reset input on both paths
    - Preserve `Enter`/`Shift+Enter` behavior
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 13.2_

  - [ ]* 4.6 Write property tests for `input-bar.tsx` — send guard and file validation
    - **Property 6: Whitespace-only or empty input disables send**
    - **Validates: Requirements 6.3**
    - **Property 7: Enter/Shift+Enter submit behaviour**
    - **Validates: Requirements 6.4**
    - **Property 8: File validation error for any invalid attachment**
    - **Validates: Requirements 6.6**

  - [x] 4.7 Update `components/chat/empty-state.tsx` for display font, surface tokens, and suggestion chip styles
    - Apply `font-display` (or `className` equivalent) to the `<h1>` wordmark
    - Replace hardcoded `blue-500/10` on suggestion chips with `bg-surface-1 border-border hover:bg-surface-2`
    - Replace hardcoded colors on the avatar icon circle with `bg-surface-2 border-border`
    - Ensure gradient blob animations in `globals.css` are already guarded by `@media (prefers-reduced-motion: no-preference)` (coordinate with task 1.1)
    - _Requirements: 3.6_

- [x] 5. Checkpoint — Pass 3 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Pass 4 — Motion: framer-motion installation and animation wiring
  - [x] 6.1 Add `framer-motion` to `package.json` with an exact version (no `^`, `~`, `*`, or `>`)
    - Run `npm install framer-motion@<exact-version>` and verify the entry in `package.json` has no range prefix
    - _Requirements: 13.1_

  - [ ]* 6.2 Write a smoke test asserting `framer-motion` version string in `package.json` contains no range specifiers
    - Read `package.json` as JSON; assert `dependencies['framer-motion']` exists and its value matches `/^[0-9]/` (starts with a digit)
    - _Requirements: 13.1_

  - [x] 6.3 Wire entrance/exit animations in `components/chat/chat-message.tsx` using `motion.div` and `messageVariants`
    - Add `useReducedMotion()` at the top of the component
    - Wrap outermost div in `motion.div` with `initial`, `animate`, `exit`, and `transition` from the design's `messageVariants` object
    - Apply per-message stagger via `custom={index}` prop and `delay: Math.min(index, 8) * 0.06`
    - When `reducedMotion` is `true`, set all transition durations to `0`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 13.2, 13.3, 13.4_

  - [ ]* 6.4 Write unit test for the `staggerDelay` pure function
    - **Property 9: Stagger delay function is bounded and monotone**
    - **Validates: Requirements 8.2**

  - [x] 6.5 Wire sidebar width/translate animations in `components/chat/sidebar.tsx`
    - Replace the static `<aside>` with `<motion.aside>` using `animate={{ width: isOpen ? 260 : 0 }}` on desktop
    - Mobile: `animate={{ x: isOpen ? 0 : '-100%' }}`, `transition={{ duration: 0.24 }}`
    - Backdrop: sibling `<motion.div>` with `animate={{ opacity: isOpen ? 0.5 : 0 }}`
    - Session item hover: `motion.div` with `whileHover={{ backgroundColor: 'var(--surface-1)' }}`, `transition={{ duration: 0.10 }}`
    - When `reducedMotion` is `true`, set all transition durations to `0`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6, 13.2, 13.3, 13.4_

- [x] 7. Checkpoint — Pass 4 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Pass 5 — Polish: focus rings, ARIA audit, and reduced-motion final sweep
  - [x] 8.1 Add global focus ring styles in `app/globals.css` and apply to all interactive elements
    - Add a universal rule: `*:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }`
    - Verify all `<button>`, `<a>`, `<textarea>`, and `role="option"` elements do not suppress focus-visible
    - _Requirements: 12.1_

  - [x] 8.2 Audit and fix all `aria-label` / visible text labels across `components/chat/`
    - Confirm every icon-only button has an `aria-label`: New Chat, Close Sidebar, Toggle Sidebar, Send, Attach, Dismiss Chip, Copy, Regenerate, Edit
    - Add missing `aria-label` attributes where absent
    - _Requirements: 12.2_

  - [x] 8.3 Implement ARIA `listbox` keyboard navigation in `components/chat/sidebar.tsx`
    - Ensure `role="listbox"` on the session list container and `role="option"` on each item
    - Implement `focusedIndex` state with ArrowUp/ArrowDown/Enter/Home/End `onKeyDown` handler on the list
    - Set `aria-selected={session.id === activeSessionId}` on each option
    - _Requirements: 12.3_

  - [x] 8.4 Verify and fix focus trap behavior in the mobile sidebar overlay (`hooks/use-focus-trap.ts`)
    - Confirm `useFocusTrap` is activated when `isMobile && sidebarOpen` in `sidebar.tsx`
    - Confirm focus restores to the hamburger toggle button when the sidebar is dismissed
    - Add `ref` forwarding if needed to target the toggle button
    - _Requirements: 12.4_

  - [ ]* 8.5 Write component tests for focus ring visibility and accessible labels
    - **Property 12: Every interactive element has a visible focus ring**
    - **Validates: Requirements 12.1**
    - **Property 13: Every button and link has an accessible label**
    - **Validates: Requirements 12.2**

  - [ ]* 8.6 Write reduced-motion integration test across animated components
    - Mock `useReducedMotion()` to return `true`; render `ChatMessage`, `Sidebar`, `NewMessagesPill`, `LoadingIndicator`, and `InputBar`
    - **Property 14: Reduced motion sets all animation durations to zero**
    - **Validates: Requirements 13.4**

- [x] 9. Final Checkpoint — All passes complete
  - Ensure all tests pass across all five passes, ask the user if questions arise.

- [ ] 10. Pass 6 — Attachment Support: multipart send, inline rendering, and type cleanup
  - [ ] 10.1 Update type definitions for attachment metadata
    - Export `AttachmentMeta` interface from `lib/chat-utils.ts`: `{ id: string; filename: string; type: 'document' | 'image'; mime_type: string; base64?: string }`
    - Replace the existing loose `attachments` array type on `Message` with `attachments?: AttachmentMeta[]`
    - Ensure `createMessage` accepts and stores the updated `attachments?: AttachmentMeta[]` parameter
    - Add `attachments?: AttachmentMeta[]` to `ChatMessageResponse` and `MessageResponse` in `lib/api.ts`
    - _Requirements: 15.5, 15.6, 15.7, 17.1_

  - [ ] 10.2 Fix `app/page.tsx` compile errors and wire the file through to `sendMessage`
    - Remove the dead `handleFileUpload` callback and all references to `isUploading` / `setIsUploading`
    - Remove unused `uploadFile`, `UploadResponse`, `UpdateChatTitleResponse` imports
    - Remove the `isUploading` prop from the `<ChatWindow>` JSX call
    - Fix the `toggleButtonRef` type so it satisfies `useFocusTrap`'s `RefObject<HTMLElement>` parameter
    - Update `handleSendMessage` to accept `(userMessage: string, file?: File)`, build a client-side `AttachmentMeta` from the file for the user bubble, pass `[file]` to `sendMessage`, and copy `data.attachments` onto the agent message
    - Update the `toMessage` mapper to copy `message.attachments` to the resulting `Message`
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 17.2_

  - [ ] 10.3 Render inline attachments in `components/chat/chat-message.tsx`
    - Add a pure `mimeToLabel(mime: string): string` helper that maps common MIME types to short labels (PDF, DOCX, DOC, TXT) and falls back to the subtype in uppercase
    - Add an `AttachmentSection` sub-component that renders image attachments as `<img src="data:..." alt={filename} className="rounded-xl object-cover max-w-[240px] max-h-[180px]">` and document attachments as styled file cards using `bg-[var(--surface-2)] border-border rounded-xl`
    - Render images first, then document cards, in the order described in Requirement 16.3
    - Place `<AttachmentSection>` at the top of the bubble content area, before `<ReactMarkdown>`, for both user and assistant bubbles
    - Each image must have `alt={attachment.filename}`; each document card must have `aria-label` containing filename and type label
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 17.3_

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery.
- Each task references specific requirements for traceability.
- The five checkpoints (tasks 3, 5, 7, 9) provide clear integration gates between passes.
- Property tests use **fast-check** (exact pinned version, no range specifiers).
- Component and unit tests use **Vitest** + **@testing-library/react**.
- All files importing framer-motion hooks must have `'use client'` as their first line.
- No new routes, pages, or backend contracts are introduced — this is a pure UI refactor.
- Reduced-motion behavior is controlled exclusively via `useReducedMotion()` from framer-motion; no `window.matchMedia` calls or CSS `@media` blocks in component code.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "2.2", "6.1"] },
    { "id": 1, "tasks": ["1.3", "2.3", "2.4", "2.5", "4.7", "6.2"] },
    { "id": 2, "tasks": ["2.6", "4.1", "4.4", "4.5", "6.3", "6.5"] },
    { "id": 3, "tasks": ["2.7", "4.2", "4.3", "4.6", "6.4", "8.1", "8.2", "8.3", "8.4"] },
    { "id": 4, "tasks": ["8.5", "8.6"] },
    { "id": 5, "tasks": ["10.1"] },
    { "id": 6, "tasks": ["10.2", "10.3"] }
  ]
}
```
