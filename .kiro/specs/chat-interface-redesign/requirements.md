# Requirements Document

## Introduction

This document covers the redesign of the LearnMate chat interface — a Next.js 16 / React 19 application using Tailwind CSS v4 and shadcn/ui primitives. The goal is to transform the current flat, monochrome dark UI into a modern, premium-feeling chat experience with deliberate typography, a rich layered dark theme, polished motion, and full accessibility. The redesign builds on the existing component architecture (`components/chat/`, `app/globals.css` CSS-custom-property token system) and adds `framer-motion` for animation. Implementation proceeds in five sequential passes: (1) global theme, (2) layout shell, (3) message thread, (4) motion, (5) accessibility and polish.

---

## Glossary

- **Design_System**: The set of CSS custom property tokens, typography variables, and Tailwind utility mappings defined in `app/globals.css` and consumed throughout the app.
- **Theme_Pass**: Pass 1 — updates to `globals.css` tokens, font loading in `layout.tsx`, and dark-mode wiring.
- **Layout_Pass**: Pass 2 — structural changes to `app/page.tsx`, `components/chat/sidebar.tsx`, and `components/chat/chat-window.tsx`.
- **Thread_Pass**: Pass 3 — changes to `components/chat/chat-message.tsx`, `components/chat/input-bar.tsx`, and `components/chat/empty-state.tsx`.
- **Motion_Pass**: Pass 4 — `framer-motion` integration across all animated elements.
- **Polish_Pass**: Pass 5 — `prefers-reduced-motion`, focus rings, WCAG AA contrast audit.
- **Composer**: The `InputBar` component — the multi-line textarea + send button + attachment button at the bottom of the chat.
- **Sidebar**: The `Sidebar` component — the conversation list panel on the left.
- **Message_Thread**: The scrollable list of `ChatMessage` instances rendered inside `ChatWindow`.
- **Signature_Detail**: The single distinctive UI element chosen to be uniquely memorable — defined in Requirement 2.
- **Token**: A named CSS custom property used as a design value (e.g., `--surface-1`, `--accent`).
- **Accent**: The single non-neutral color used for interactive emphasis — must not be neon.
- **Streaming_Reveal**: The smooth character-by-character or chunk-by-chunk text appearance of an assistant response.
- **New_Messages_Pill**: A floating button that appears when the user has scrolled up, offering one-click scroll-to-bottom.
- **prefers-reduced-motion**: A CSS/JS media query that must disable or minimise all animations for users who have requested reduced motion in their OS settings.

---

## Requirements

### Requirement 1: Color Token System

**User Story:** As a designer reviewing the UI, I want a deliberate, named color palette rather than hardcoded `slate-*` values, so that the entire interface can be re-themed from a single source of truth.

#### Acceptance Criteria

1. THE Design_System SHALL define exactly seven semantic color tokens as CSS custom properties in the `.dark` block of `app/globals.css`: `--background`, `--surface-1`, `--surface-2`, `--foreground`, `--muted-foreground`, `--accent`, and `--border`.
2. WHEN the `.dark` class is applied to the `<html>` element, THE Design_System SHALL set `--background` to an OKLCH lightness in the range 0.13–0.20 and an OKLCH chroma greater than 0.005.
3. THE Design_System SHALL define `--accent` with an OKLCH chroma in the range 0.08–0.18.
4. THE Design_System SHALL define `--border` with an OKLCH lightness in the range 0.22–0.30.
5. WHEN the computed CSS value of `--muted-foreground` and the computed CSS value of `--background` are measured with `.dark` applied to `<html>`, the contrast ratio between the two values SHALL be at least 4.5:1.
6. THE Design_System SHALL expose all seven tokens via the `@theme inline` block such that each Tailwind v4 utility class (e.g., `bg-background`, `text-muted-foreground`) resolves to the same value as its corresponding CSS custom property defined in the `.dark` block.

---

### Requirement 2: Signature Detail — Composer Highlight Line

**User Story:** As a user composing a message, I want the input area to have one striking, memorable visual detail, so that the interface feels crafted rather than generic.

#### Acceptance Criteria

1. WHEN the Composer textarea receives focus, THE Composer SHALL display a 2 px highlight line along the top edge of the input container that transitions from opacity 0 to opacity 1 over 200–300 ms using an ease-out curve, using the `--accent` token color.
2. WHEN the Composer textarea loses focus, THE Composer SHALL transition the highlight from opacity 1 to opacity 0 over 150–200 ms using an ease-in curve, returning to the default border state.
3. WHILE the Composer is in the focused state, THE Composer SHALL render the highlight at an opacity of at least 0.7 and no more than 1.0 so that it is clearly visible without overpowering the text content.
4. IF the user has `prefers-reduced-motion` set, THEN THE Composer SHALL display the focused highlight at full opacity (1.0) with no transition animation applied.
5. THE Composer highlight SHALL reference `var(--accent)` — not a hardcoded hex value — so that it participates in any future re-theming.

---

### Requirement 3: Typography Pairing

**User Story:** As a user reading responses, I want distinct, high-quality typefaces for different content types, so that the interface feels intentional and is easy to read.

#### Acceptance Criteria

1. THE Theme_Pass SHALL load exactly three typefaces via `next/font/google`: one display/heading face (e.g., Playfair Display or DM Serif Display) for the wordmark and empty-state heading, one body face (e.g., DM Sans or Plus Jakarta Sans — explicitly not Inter) for message content and UI chrome, and one monospace face (e.g., JetBrains Mono or Fira Code) for code blocks and inline code.
2. THE Theme_Pass SHALL NOT use Inter as the body face.
3. WHEN loading fonts, THE Theme_Pass SHALL configure each `next/font/google` instance with `display: 'swap'` and apply all three resulting CSS variables to the `<body>` element via `className` (e.g., `className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}`).
4. THE Design_System SHALL define `--font-display`, `--font-body`, and `--font-mono` in the `@theme inline` block mapping to the CSS variables emitted by the three `next/font/google` instances respectively, such that `font-family: var(--font-display)` resolves to the loaded display face.
5. WHEN a message contains a fenced code block or inline code, THE Message_Thread SHALL apply `font-family: var(--font-mono)` to that element.
6. WHEN the empty-state heading is rendered, THE Thread_Pass SHALL apply `font-family: var(--font-display)` to that element.

---

### Requirement 4: Layout Shell

**User Story:** As a user on any device, I want a stable, well-proportioned layout with sidebar, header, message thread, and composer, so that the interface is easy to navigate.

#### Acceptance Criteria

1. THE Layout_Pass SHALL implement the main layout as a full-viewport flex row: a Sidebar with open/closed state on the left and a flex-column main area (header strip + Message_Thread + Composer) on the right. The Sidebar SHALL be open by default on desktop and closed by default on mobile.
2. WHEN the viewport width is 768 px or wider, THE Layout_Pass SHALL render the Sidebar as a persistent inline panel with a fixed width of 260 px.
3. IF the viewport width is below 768 px AND the Sidebar open state is `true`, THEN THE Sidebar SHALL render as an overlay drawer with `position: fixed`, `top: 0`, `left: 0`, `height: 100vh`, `z-index` above the main content, so that the main chat area is not compressed.
4. WHILE the Sidebar is open on mobile, THE Layout_Pass SHALL render a backdrop element with `position: fixed`, `inset: 0`, and opacity between 0.4 and 0.6 that, when clicked, sets the Sidebar open state to `false`.
5. THE Layout_Pass SHALL implement a consistent vertical spacing rhythm using an 8 px base unit — specifically: 8 px, 16 px, 24 px, 32 px increments — for padding and gap values within the layout shell.
6. THE Layout_Pass SHALL separate sections (sidebar header / session list / footer; chat header / thread / composer) using `--border` token dividers rather than background color changes alone.
7. WHEN the viewport width is below 768 px, THE Layout_Pass SHALL render a visible toggle button in the chat header that sets the Sidebar open state to `true`.

---

### Requirement 5: Message Thread Bubble Treatment

**User Story:** As a user reading the conversation, I want user and assistant messages to be visually distinct and well-spaced, so that I can scan the thread quickly.

#### Acceptance Criteria

1. THE Thread_Pass SHALL right-align user messages and left-align assistant messages within the Message_Thread.
2. WHEN rendering a user message, THE Thread_Pass SHALL apply `var(--accent)` as the bubble background with `var(--accent-foreground)` as the text color, and omit a leading avatar.
3. WHEN rendering an assistant message, THE Thread_Pass SHALL apply `var(--surface-2)` as the bubble background with a 24×24 px circular avatar or icon on the left side, and use `var(--foreground)` for the content text color.
4. THE Thread_Pass SHALL apply a `box-shadow` of `0 1px 3px 0 var(--border)` to assistant bubbles to create depth without blur-heavy glassmorphism.
5. WHEN a user hovers or focuses a message bubble, THE Thread_Pass SHALL transition the action icon row from opacity 0 to opacity 1 over 150 ms, showing copy and regenerate icons for assistant messages and an edit icon for user messages.
6. IF the user has `prefers-reduced-motion` set, THEN THE Thread_Pass SHALL display message action icons at a static opacity of 0.6 rather than fading in on hover.
7. THE Thread_Pass SHALL render timestamps using `var(--muted-foreground)` below each bubble, formatted using the existing `formatTimestamp` utility in `lib/chat-utils.ts`.

---

### Requirement 6: Composer (Input Bar) Refinement

**User Story:** As a user composing a message, I want the input area to feel polished and responsive, so that writing feels like a first-class experience.

#### Acceptance Criteria

1. WHILE the Composer is rendered, THE Composer SHALL apply `background: var(--surface-1)` and `border: 1px solid var(--border)` to the textarea container, replacing the current `slate-800/50` background.
2. WHEN the send button is clicked and a message is dispatched, THE Composer SHALL animate the send icon with a scale from 0.92 to 1.0 over 120 ms using an ease-out curve.
3. IF the Composer textarea value contains no non-whitespace characters OR the `disabled` prop is `true`, THEN THE Composer SHALL render the send button at opacity 0.4 with `cursor: not-allowed` and SHALL NOT dispatch a message on click.
4. WHEN the user presses Enter without Shift and the textarea contains at least one non-whitespace character, THE Composer SHALL submit the message. WHEN the user presses Shift+Enter, THE Composer SHALL insert a newline without submitting.
5. WHEN a file is attached, THE Composer SHALL display a dismissible chip above the textarea showing the filename and a file-type icon; clicking the dismiss control SHALL remove the chip, discard the attachment, and reset the file input to an empty state.
6. IF an attached file exceeds 20 MB or has an unsupported MIME type, THEN THE Composer SHALL display an inline error message below the textarea using `color: var(--destructive)`, replace the `alert()` call, reset the file input, and keep the error visible until the user selects a new file or manually clears it.

---

### Requirement 7: Typing / Loading Indicator Replacement

**User Story:** As a user waiting for a response, I want a refined loading indicator instead of bouncing dots, so that the waiting state feels consistent with the overall premium design.

#### Acceptance Criteria

1. THE LoadingIndicator SHALL render exactly three thin vertical bars (2–3 px wide, 4–16 px height range) that animate through a breathing/pulsing height cycle over an 800 ms loop using `var(--accent)` as the fill color.
2. WHEN the waveform indicator is active, THE LoadingIndicator SHALL stagger the bar animations at 0 ms, 100 ms, and 200 ms offsets within the 800 ms cycle, producing a ripple-like rhythm.
3. THE waveform bars SHALL use `color: var(--accent)` and a `box-shadow` of `0 0 4px–8px 0 var(--accent)` at opacity ≤ 0.3 (i.e., the shadow color shall be the accent at no more than 30% opacity).
4. IF the user has `prefers-reduced-motion` set, THEN THE LoadingIndicator SHALL render a static ellipsis character ("…") styled with `color: var(--muted-foreground)` and `font-size: 0.875rem` instead of the animated bars.
5. WHILE the LoadingIndicator is displayed, THE LoadingIndicator SHALL be contained within an assistant bubble container using the same `max-w-2xl`, `px-4 py-3`, `bg-[var(--surface-2)]`, and `border border-[var(--border)]` classes as regular assistant message bubbles, left-aligned in the Message_Thread.

---

### Requirement 8: Message Arrival Animation

**User Story:** As a user watching responses appear, I want new messages to enter the thread smoothly, so that the interface feels alive without being distracting.

#### Acceptance Criteria

1. WHEN a new message is added to the Message_Thread, THE Motion_Pass SHALL animate it in with a combined vertical translate (from `translateY(12px)` to `translateY(0)`) and opacity (from 0 to 1) over 280 ms using `cubic-bezier(0, 0, 0.2, 1)`.
2. WHEN 2 or more messages are added within the same render cycle, THE Motion_Pass SHALL stagger the entrance animations with a 60 ms delay between each message; messages beyond the 8th in the batch SHALL use the same 480 ms delay as the 8th.
3. THE Motion_Pass SHALL ensure that exit animations complete before the element is removed from the DOM, and that entry animations begin after the element is mounted, so enter and exit do not overlap destructively.
4. WHEN a message is removed from the Message_Thread, THE Motion_Pass SHALL animate it out from opacity 1 to opacity 0 with no positional translation over 200 ms.
5. IF the user has `prefers-reduced-motion` set, THEN THE Motion_Pass SHALL render all messages instantly at `translateY(0)` and opacity 1, with no entrance delay or stagger applied.

---

### Requirement 9: Sidebar Animations

**User Story:** As a user toggling the sidebar or switching conversations, I want smooth transitions, so that the navigation feels fluid.

#### Acceptance Criteria

1. WHEN the Sidebar opens on desktop, THE Motion_Pass SHALL animate the sidebar width from 0 to 260 px over 240 ms using an ease-in-out curve.
2. WHEN the Sidebar closes on desktop, THE Motion_Pass SHALL animate the sidebar width from 260 px to 0 over 200 ms using an ease-in-out curve.
3. WHEN the Sidebar opens on mobile, THE Motion_Pass SHALL translate the drawer from `translateX(-100%)` to `translateX(0)` over 240 ms; the backdrop SHALL simultaneously animate from opacity 0 to opacity 0.5 over the same 240 ms duration.
4. WHEN a conversation item in the Sidebar is hovered, THE Motion_Pass SHALL transition the item's background from transparent to `var(--surface-1)` over 100 ms.
5. WHEN a conversation item is selected, THE Sidebar SHALL display a 2 px wide left-edge bar using `background: var(--accent)` as the active indicator, in addition to the `var(--surface-2)` background state.
6. IF the user has `prefers-reduced-motion` set, THEN THE Motion_Pass SHALL render the Sidebar at its final open or closed state within ≤ 16 ms, skipping all width, translate, backdrop, and hover transition animations.

---

### Requirement 10: Scroll Behavior and New Messages Pill

**User Story:** As a user who has scrolled up to read earlier messages, I want to know when new messages arrive and return to the bottom easily, so that I never miss a response.

#### Acceptance Criteria

1. WHEN the Message_Thread receives a new message and the user is within 100 px of the bottom, THE Layout_Pass SHALL auto-scroll to the bottom using a 300 ms ease-out transition.
2. WHEN the Message_Thread receives a new message and the user is more than 100 px above the bottom, THE Layout_Pass SHALL NOT auto-scroll, and SHALL instead display the New_Messages_Pill.
3. WHEN the New_Messages_Pill is displayed, THE Layout_Pass SHALL animate it in with a slide-up from `translateY(8px)` and opacity 0 → 1 over 200 ms, anchored to the bottom-center of the Message_Thread container, and SHALL display the label "New messages".
4. WHEN the user clicks the New_Messages_Pill, THE Layout_Pass SHALL scroll to the bottom of the Message_Thread and dismiss the pill with an opacity fade from 1 to 0 over 150 ms.
5. WHEN the user manually scrolls to within 100 px of the bottom, THE Layout_Pass SHALL dismiss the New_Messages_Pill automatically.
6. IF the user has `prefers-reduced-motion` set, THEN THE Layout_Pass SHALL display and dismiss the New_Messages_Pill without animation, and SHALL perform auto-scroll in C1 instantly (no transition).

---

### Requirement 11: Streaming Text Reveal

**User Story:** As a user watching an assistant response generate in real time, I want the text to appear smoothly rather than in jarring re-renders, so that the experience feels fluid.

#### Acceptance Criteria

1. WHEN the assistant message has `status: 'chatting'`, THE Thread_Pass SHALL render a cursor character ("▋") appended to the current content that blinks at 500 ms visible / 500 ms hidden to signal active streaming.
2. WHEN the assistant message transitions from `status: 'chatting'` to `status: 'completed'`, THE Thread_Pass SHALL remove the cursor character without changing the rendered height or width of the message bubble.
3. THE Thread_Pass SHALL ensure the same component instance persists across all content chunk updates — it SHALL NOT unmount and remount the bubble on each chunk.
4. WHILE a streaming message is active, THE Message_Thread SHALL auto-scroll to follow the growing content, subject to the 100 px threshold rule in Requirement 10.
5. IF the user has `prefers-reduced-motion` set, THEN THE Thread_Pass SHALL render the cursor character at a static opacity of 1.0 without any blink animation.

---

### Requirement 12: Accessibility and Keyboard Navigation

**User Story:** As a user who navigates by keyboard or uses assistive technology, I want all interactive elements to be operable and clearly indicated, so that the interface is fully usable without a mouse.

#### Acceptance Criteria

1. THE Polish_Pass SHALL ensure every interactive element (buttons, Sidebar items, Composer controls) has a visible focus ring using the `--ring` token, with a minimum outline width of 2 px and a 2 px offset.
2. THE Polish_Pass SHALL ensure all button and link elements have an `aria-label` or visible text label that describes the action.
3. THE Polish_Pass SHALL ensure the Sidebar conversation list is navigable with arrow keys when the Sidebar has keyboard focus, following the ARIA `listbox` or `menu` pattern.
4. WHEN the Sidebar is open as a mobile overlay, THE Polish_Pass SHALL trap focus within the Sidebar until it is closed, and restore focus to the toggle button when dismissed.
5. THE Polish_Pass SHALL verify that the contrast ratio of all text — including muted/secondary text (`--muted-foreground` against `--background`) and accent-colored interactive text (`--accent` against `--surface-1`) — meets WCAG AA (4.5:1 for normal text, 3:1 for large text).
6. IF the user has `prefers-reduced-motion` set, THEN THE Polish_Pass SHALL disable or reduce ALL animations defined in Requirements 7–10, including CSS keyframe animations in `globals.css` that use `animate-bounce`, `animate-pulse`, and `animate-float`.

---

### Requirement 13: framer-motion Integration

**User Story:** As a developer implementing the motion pass, I want framer-motion installed and configured correctly, so that all animation requirements can be satisfied using a consistent API.

#### Acceptance Criteria

1. THE Motion_Pass SHALL add `framer-motion` to `package.json` with a version string containing no range specifiers (`^`, `~`, `*`, or `>`).
2. WHEN any file imports framer-motion exports that rely on hooks or browser APIs (e.g., `motion`, `AnimatePresence`, `useReducedMotion`), THE Motion_Pass SHALL add `'use client'` as the first line of that file.
3. THE Motion_Pass SHALL use `useReducedMotion()` from `framer-motion` as the only mechanism for detecting `prefers-reduced-motion` in component logic — `window.matchMedia` calls and `@media (prefers-reduced-motion)` blocks inside component files SHALL NOT be used.
4. WHEN `useReducedMotion()` returns `true`, THE Motion_Pass SHALL set all animation durations to `0` seconds so that all animated elements reach their final state immediately.
5. THE Motion_Pass SHALL wrap the message list in `AnimatePresence` with `mode="popLayout"` in `chat-window.tsx`, such that each `ChatMessage` instance is a direct child with a stable `key` prop.

---

### Requirement 14: Existing Theming Conflicts Resolution

**User Story:** As a developer maintaining the codebase, I want the existing broken or incomplete theming setup resolved before redesign changes are layered on, so that there is a clean foundation.

#### Acceptance Criteria

1. THE Theme_Pass SHALL wrap `{children}` in `app/layout.tsx` with `<ThemeProvider>` from `components/theme-provider.tsx`, passing `attribute="class"`, `defaultTheme="dark"`, and `forcedTheme="dark"` props.
2. THE Theme_Pass SHALL apply the CSS variables emitted by all loaded `next/font/google` instances to the `<body>` element via `className`, such that `document.body.style.fontFamily` or `getComputedStyle(document.body).fontFamily` reflects the loaded fonts at runtime.
3. THE Theme_Pass SHALL NOT render any light/dark mode toggle UI element unless explicitly requested by the user.
4. THE Theme_Pass SHALL preserve the following CSS custom property name groups in `app/globals.css` to avoid breaking shadcn/ui primitives: base (`--background`, `--foreground`), card (`--card`, `--card-foreground`), popover (`--popover`, `--popover-foreground`), primary (`--primary`, `--primary-foreground`), secondary (`--secondary`, `--secondary-foreground`), muted (`--muted`, `--muted-foreground`), accent (`--accent`, `--accent-foreground`), destructive (`--destructive`, `--destructive-foreground`), border/input/ring (`--border`, `--input`, `--ring`), and chart (`--chart-1` through `--chart-5`).

---

### Requirement 15: File Attachment — Multipart Send

**User Story:** As a user, I want to attach files to my messages and have them sent to the backend together with my text, so that the AI can read and reference my documents or images inline.

#### Acceptance Criteria

1. WHEN the user clicks Send with an attached file, THE Composer SHALL build a `FormData` object with `message` (the text) and one or more `attachments` (the file objects) and call `sendMessage(sessionId, message, [file])` from `lib/api.ts` — which already sends multipart/form-data when files are present.
2. THE `handleSendMessage` function in `app/page.tsx` SHALL accept an optional `File | undefined` second argument and forward it to `sendMessage` as a single-element files array when present.
3. THE `InputBar.onSend` prop signature SHALL be `(message: string, file?: File) => void` — the existing signature — and the call site in `app/page.tsx` SHALL pass the file through to the API layer.
4. THE `app/page.tsx` SHALL remove the dead `handleFileUpload` callback and the unused `isUploading` / `setIsUploading` state that currently causes a TypeScript compile error.
5. WHEN the send call returns, THE `MessageResponse` type in `lib/api.ts` SHALL be extended to include `attachments?: AttachmentMeta[]` where `AttachmentMeta` is `{ id: string; filename: string; type: 'document' | 'image'; mime_type: string; base64?: string }`, matching the backend response shape described in the backend contract.
6. THE `Message` type in `lib/chat-utils.ts` SHALL replace its current `attachments` field definition with `attachments?: AttachmentMeta[]` so that both the user message (populated client-side from the attached File) and the agent message (populated from the API response) use the same shape.
7. THE `createMessage` helper SHALL accept an optional `attachments` argument typed as `AttachmentMeta[] | undefined` and store it on the created `Message` object.

---

### Requirement 16: Attachment Rendering in Chat Bubbles

**User Story:** As a user reviewing the conversation, I want to see my attachments rendered inline in the chat thread — images as thumbnails and documents as labelled file cards — so that the context of each message is immediately visible.

#### Acceptance Criteria

1. WHEN a `Message` has a non-empty `attachments` array and at least one entry has `type === 'image'` and a non-empty `base64` string, THE `ChatMessage` component SHALL render that image as a thumbnail `<img>` element with `src="data:<mime_type>;base64,<base64>"`, bounded to a maximum width of 240 px and maximum height of 180 px, with `object-fit: cover` and rounded corners (`rounded-xl`), displayed above the text content in the bubble.
2. WHEN a `Message` has a non-empty `attachments` array and at least one entry has `type === 'document'`, THE `ChatMessage` component SHALL render a file card for that attachment showing a document icon, the `filename`, and the file type label (e.g. "PDF", "DOCX", "TXT") derived from the `mime_type`; the card SHALL use `bg-[var(--surface-2)] border-border rounded-xl` styling and appear above the text content in the bubble.
3. WHEN both image and document attachments are present in the same message, THE `ChatMessage` component SHALL render images first, then document cards, then text content.
4. THE attachment rendering area SHALL be accessible: each image SHALL have `alt={attachment.filename}` and each document card SHALL have an `aria-label` containing the filename and file type.
5. THE attachment section SHALL be rendered inside the bubble container, not outside it, and SHALL respect the existing `max-w-2xl` bubble constraint.

---

### Requirement 17: Session History Attachment Restoration

**User Story:** As a user returning to a previous session, I want attachments from earlier messages to be visible in the thread, so that I can see the full context of past conversations.

#### Acceptance Criteria

1. WHEN `GET /api/chat/session/{session_id}` returns messages, the `ChatMessageResponse` type in `lib/api.ts` SHALL include `attachments?: AttachmentMeta[]` so that messages loaded from the backend carry their attachment data.
2. THE `toMessage` mapper in `app/page.tsx` SHALL copy the `attachments` array from `ChatMessageResponse` to the resulting `Message` object when it is present.
3. WHEN a historical message has attachment data, `ChatMessage` SHALL render the attachments using the same rules as Requirement 16.
