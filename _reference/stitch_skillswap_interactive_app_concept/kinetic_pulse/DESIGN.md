# Design System Specification: The Kinetic Exchange

## 1. Overview & Creative North Star: The Kinetic Exchange
This design system is built to move. It rejects the static, boxy constraints of traditional community platforms in favor of a "Kinetic Exchange" philosophy. We are creating a digital environment that feels as fast-paced and energetic as the skill-sharing it facilitates.

**The Creative North Star: The Kinetic Exchange**
Our aesthetic is defined by "Sophisticated Energy." We break the "template" look through intentional asymmetry, overlapping elements that suggest a parallax depth, and an editorial typography scale. We do not use borders to define space; we use light, shadow, and tonal shifts to create a frictionless flow of information. This system should feel like a high-end magazine met a futuristic workspace—breathable, premium, and human-centric.

---

## 2. Colors & Tonal Depth
The palette is anchored by a high-voltage primary blue and supported by a deep, sophisticated violet-tinted neutral.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning or containment. Boundaries must be defined solely through background color shifts or subtle tonal transitions. 
*   *Example:* A `surface_container_low` section sitting on a `surface` background provides all the definition a user needs without the visual clutter of a line.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of semi-transparent layers. Use the `surface_container` tiers to create depth:
*   **Base Layer:** `surface` (#faf4ff)
*   **Subtle Recess:** `surface_container_low` (#f4eeff)
*   **Elevated Content:** `surface_container_highest` (#e1d8ff) or `surface_container_lowest` (#ffffff) for maximum "lift."
*   **Nesting:** To highlight a specific card within a feed, place a `surface_container_lowest` card inside a `surface_container_high` section. This "paper-on-paper" stacking creates a premium feel without traditional shadows.

### The "Glass & Gradient" Rule
To achieve the "glowing" vibe requested for SkillSwap, use **Glassmorphism** for floating elements (e.g., navigation bars, pop-overs). 
*   **Execution:** Use `surface` at 80% opacity with a `backdrop-blur` of 20px.
*   **Signature Textures:** Main CTAs should never be flat. Use a linear gradient from `primary` (#4647d3) to `primary_container` (#9396ff) at a 135-degree angle to provide "soul" and professional polish.

---

## 3. Typography: Editorial Authority
We use a dual-typeface system to balance technical precision with human warmth.

*   **Display & Headlines (Plus Jakarta Sans):** Our "Voice." Use `display-lg` and `headline-lg` with generous tracking and tight leading to create a bold, editorial impact. This font’s geometric nature conveys modernism and speed.
*   **Body & UI (Inter):** Our "Utility." Inter provides maximum readability at smaller scales. Use `body-md` for general content and `label-sm` for micro-copy. 

**Visual Hierarchy Tip:** Create high contrast between sizes. Don't be afraid to pair a `display-sm` headline with a `label-md` subheader to create an asymmetric, intentional layout that guides the eye.

---

## 4. Elevation & Depth: Tonal Layering
Depth is not just about shadows; it’s about the relationship between light and surface.

### The Layering Principle
Achieve hierarchy by "stacking" tiers. For SkillSwap, the most interactive elements should feel like they are floating closest to the user.
*   **Level 0:** `surface_dim` (The foundation).
*   **Level 1:** `surface` (The general workspace).
*   **Level 2:** `surface_container_highest` (Interactive cards/modals).

### Ambient Shadows
When a floating effect is required (e.g., for a "parallax" hover state), use **Ambient Shadows**:
*   **Color:** Use `on_surface` (#302950) at 6% opacity.
*   **Settings:** Blur: 32px, Y-offset: 16px. This mimics natural light and avoids the "dirty" look of standard grey shadows.

### The "Ghost Border" Fallback
If accessibility requirements demand a container edge, use a **Ghost Border**:
*   **Token:** `outline_variant` (#b0a7d6) at 15% opacity. Never use 100% opacity for borders.

---

## 5. Component Logic

### Buttons (The "Power Pulse")
*   **Primary:** A gradient of `primary` to `primary_container`. Add a `primary_dim` outer glow (8px blur) on hover. Roundedness: `full`.
*   **Secondary:** `surface_container_lowest` background with `primary` text. No border.
*   **Tertiary:** Transparent background, `primary` text, `label-md` (All caps, 0.05em tracking).

### Cards & Skill Lists
*   **Constraint:** Forbid the use of divider lines. 
*   **Separation:** Use 24px - 32px of vertical white space or shift the background from `surface` to `surface_container_low`.
*   **Corner Radius:** Standardize on `xl` (1.5rem) for main cards to emphasize the "friendly/trustworthy" vibe.

### Input Fields
*   **Style:** Use `surface_container_low` for the field background. On focus, transition to `surface_container_lowest` with a 2px "Ghost Border" of `primary`.
*   **Typography:** Labels must use `label-md` in `on_surface_variant`.

### Special Component: The "Skill Chip"
*   **Logic:** For a fast-paced app like SkillSwap, chips need to be dynamic. Use `secondary_container` (#65e1ff) for active filters and `surface_variant` (#e1d8ff) for inactive ones. 

---

## 6. Do’s and Don’ts

### Do:
*   **Use Asymmetry:** Place a large headline on the left with a smaller, secondary action floating on the right to create "dynamic tension."
*   **Embrace Breathing Room:** Increase margins by 20% more than you think you need. High-end design thrives on whitespace.
*   **Use Tonal Shifts:** Use `surface_bright` to highlight the most important area of a screen.

### Don't:
*   **No "Box-in-a-Box":** Avoid nesting borders. Use background colors to differentiate zones.
*   **No Pure Black:** Never use #000000 for text or shadows. Use `on_background` (#302950) to maintain the violet-infused warmth of the system.
*   **No Standard Grids:** While the underlying math should be solid, visually break the grid by allowing images or illustrations to "bleed" across surface containers.