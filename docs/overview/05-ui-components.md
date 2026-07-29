# UI Component Library Implementation

## Design Philosophy

astro-koharu's UI component library follows the design philosophy of **shadcn/ui**:

1. **Components as Code**: Components reside directly in the project and can be fully customized.
2. **CVA Variant System**: Uses class-variance-authority to manage style variants.
3. **Radix UI Foundation**: Built on top of unstyled Radix UI primitives.
4. **Tailwind Styling**: Uses Tailwind CSS atomic classes to define styles.
5. **Type Safety**: Complete TypeScript support.

```plain
┌─────────────────────────────────────────────────────────────┐
│                 Component Hierarchy Structure               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Business Components                                       │
│   ├── DropdownNav                                           │
│   ├── SearchDialog                                          │
│   └── SeriesNavigation                                      │
│              │                                              │
│              ▼                                              │
│   UI Components (src/components/ui/)                        │
│   ├── Button  ─────────┬──→ CVA Variant System              │
│   ├── Popover ─────────┼──→ Floating UI                     │
│   ├── Card    ─────────┼──→ Compound Components             │
│   └── Dialog  ─────────┼──→ Radix UI                        │
│              │         │                                    │
│              ▼         ▼                                    │
│   Utility Functions                                         │
│   └── cn() ← clsx + tailwind-merge                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Utility Functions

### `cn()` Function

```typescript
// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Function Description**:

1. **`clsx`**: Merges multiple class names, supporting conditional class names.
2. **`twMerge`**: Intelligently merges Tailwind classes, avoiding conflicts.

**Usage Examples**:

```tsx
// Basic merge
cn('px-4 py-2', 'text-white')
// → 'px-4 py-2 text-white'

// Conditional class names
cn('base-class', {
  'active-class': isActive,
  'disabled-class': isDisabled,
})
// → 'base-class active-class' (when isActive is true)

// Conflict resolution (role of twMerge)
cn('px-4', 'px-6')  // → 'px-6' (latter overrides former)
cn('text-red-500', 'text-blue-500')  // → 'text-blue-500'

// Practical usage
<button className={cn(
  'px-4 py-2 rounded',
  variant === 'primary' && 'bg-blue-500 text-white',
  className  // Allows external overriding
)}>
```

---

## Button Component

### CVA Variant System

```tsx
// src/components/ui/button.tsx
import { cva, type VariantProps } from 'class-variance-authority';

// Define variants
const buttonVariants = cva(
  // Base styles (shared by all variants)
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      // Appearance variants
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        'gradient-shoka': 'bg-gradient-shoka-button text-primary-foreground',
      },
      // Size variants
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    // Default variants
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
```

### Component Implementation

```tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * When asChild is true, Button styles are applied to the child element
   * Commonly used to wrap Link components
   */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // When asChild is true, use Slot to render child elements
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

### Usage Examples

```tsx
// Basic usage
<Button variant="default" size="md">
  Click me
</Button>

// Different variants
<Button variant="outline">Outlined</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button variant="gradient-shoka">Gradient Button</Button>

// Different sizes
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>

// asChild mode (wrapping Link)
<Button asChild>
  <a href="/about">About</a>
</Button>

// Disabled state
<Button disabled>Disabled</Button>
```

---

## Popover Component

### Core Features

Popover is a complex floating UI component integrating multiple libraries:

- **Floating UI**: Precise positioning
- **Motion**: Animation effects
- **Custom Hooks**: State management

### Complete Implementation

```tsx
// src/components/ui/popover.tsx
import {
  FloatingFocusManager,
  FloatingPortal,
  useClick,
  useDismiss,
  useHover,
  useInteractions,
  useRole,
  type Placement,
} from '@floating-ui/react';
import { useControlledState } from '@hooks/useControlledState';
import { useFloatingUI } from '@hooks/useFloatingUI';
import { AnimatePresence, motion, type MotionProps } from 'motion/react';
import React, { cloneElement } from 'react';
import { animation } from '@constants/design-tokens';
import { withFloatingErrorBoundary } from '@components/common/FloatingErrorBoundary';

type PopoverProps = {
  /** Controlled mode: whether open */
  open?: boolean;
  /** State change callback */
  onOpenChange?: (open: boolean) => void;
  /** Render popover content */
  render: (data: { close: () => void }) => React.ReactNode;
  /** Positioning placement */
  placement?: Placement;
  /** Trigger element */
  children: React.JSX.Element;
  /** Custom styles */
  className?: string;
  /** Offset distance */
  offset?: number;
  /** Custom animation */
  motionProps?: MotionProps;
  /** Trigger method */
  trigger?: 'click' | 'hover';
};

function Popover({
  children,
  render,
  open: passedOpen,
  placement,
  onOpenChange,
  className,
  offset: offsetNum = 10,
  motionProps,
  trigger = 'click',
}: React.PropsWithChildren<PopoverProps>) {
  // 1. State management (supports controlled/uncontrolled)
  const [isOpen, setIsOpen] = useControlledState({
    value: passedOpen,
    defaultValue: false,
    onChange: onOpenChange,
  });

  // 2. Floating positioning
  const { refs, floatingStyles, context } = useFloatingUI({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement,
    offset: offsetNum,
    transform: false,
  });

  // 3. Interaction handling
  const hover = useHover(context, {
    enabled: trigger === 'hover',
    delay: { open: 0, close: animation.duration.fast },
  });
  const click = useClick(context, {
    enabled: trigger === 'click',
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    click,
    useDismiss(context),  // Close on clicking outside
    useRole(context),     // ARIA role
  ]);

  return (
    <>
      {/* 4. Trigger element */}
      {cloneElement(
        children,
        getReferenceProps({ ref: refs.setReference, ...children.props })
      )}

      {/* 5. Popover content (with animation) */}
      <AnimatePresence>
        {isOpen && (
          <FloatingPortal>
            <FloatingFocusManager context={context} modal={false}>
              <motion.div
                className={cn(
                  'z-10 rounded-ss-2xl rounded-ee-2xl bg-black/30 backdrop-blur-sm',
                  className
                )}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1, originY: 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={animation.spring.popoverContent}
                style={{ ...floatingStyles }}
                {...motionProps}
                {...getFloatingProps({ ref: refs.setFloating })}
              >
                {render({ close: () => setIsOpen(false) })}
              </motion.div>
            </FloatingFocusManager>
          </FloatingPortal>
        )}
      </AnimatePresence>
    </>
  );
}

// 6. Error boundary wrapper + memo optimization
const PopoverWithErrorBoundary = withFloatingErrorBoundary(Popover, 'Popover');
export default React.memo(PopoverWithErrorBoundary);
```

### Architecture Layering

```plain
┌─────────────────────────────────────────────────────────────┐
│                      Popover Component                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  State Layer                                                │
│  └── useControlledState ─→ Supports controlled/uncontrolled │
│                                                             │
│  Positioning Layer                                          │
│  └── useFloatingUI ─→ Floating UI configuration             │
│      ├── Auto flip                                          │
│      ├── Boundary detection                                 │
│      └── Offset calculation                                 │
│                                                             │
│  Interaction Layer                                          │
│  └── useInteractions                                        │
│      ├── useHover ─→ hover trigger                          │
│      ├── useClick ─→ click trigger                          │
│      ├── useDismiss ─→ close on click outside               │
│      └── useRole ─→ ARIA role                               │
│                                                             │
│  Rendering Layer                                            │
│  ├── FloatingPortal ─→ Portals to body                      │
│  ├── FloatingFocusManager ─→ Focus management               │
│  └── motion.div ─→ Animation effects                        │
│                                                             │
│  Safety Layer                                               │
│  └── withFloatingErrorBoundary ─→ Error isolation           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Usage Examples

```tsx
// Dropdown menu triggered by Hover
<Popover
  trigger="hover"
  placement="bottom-start"
  render={({ close }) => (
    <div className="flex flex-col">
      <a href="/about" onClick={close}>About</a>
      <a href="/contact" onClick={close}>Contact</a>
    </div>
  )}
>
  <button>Menu</button>
</Popover>

// Popover triggered by Click
<Popover
  trigger="click"
  placement="bottom"
  offset={15}
  render={({ close }) => (
    <div className="p-4">
      <p>Popover content</p>
      <Button onClick={close}>Close</Button>
    </div>
  )}
>
  <Button>Open Popover</Button>
</Popover>

// Controlled mode
const [isOpen, setIsOpen] = useState(false);

<Popover
  open={isOpen}
  onOpenChange={setIsOpen}
  render={() => <div>Content</div>}
>
  <Button>Trigger</Button>
</Popover>
```

---

## Card Component

### Compound Component Pattern

Card adopts the compound component pattern, splitting a complex component into multiple child components:

```tsx
// src/components/ui/card.tsx
import * as React from 'react';
import { cn } from '@lib/utils';

// Main container
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-card text-card-foreground rounded-lg border shadow-xs',
        className
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

// Header area
const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      {...props}
    />
  ),
);
CardHeader.displayName = 'CardHeader';

// Title
const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'text-2xl leading-none font-semibold tracking-tight',
        className
      )}
      {...props}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

// Description
const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  ),
);
CardDescription.displayName = 'CardDescription';

// Content area
const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

// Footer area
const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center p-6 pt-0', className)}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
```

### Usage Examples

```tsx
// Complete card
<Card>
  <CardHeader>
    <CardTitle>Post Title</CardTitle>
    <CardDescription>This is a short description of the post</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Post content goes here...</p>
  </CardContent>
  <CardFooter>
    <Button>Read More</Button>
  </CardFooter>
</Card>

// Simple card
<Card>
  <CardContent className="pt-6">
    <p>Simple content</p>
  </CardContent>
</Card>

// Custom styling
<Card className="border-primary">
  <CardHeader className="bg-primary/10">
    <CardTitle className="text-primary">Featured Card</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Content</p>
  </CardContent>
</Card>
```

---

## useControlledState Hook

### Controlled/Uncontrolled Mode Unification

```tsx
// src/hooks/useControlledState.ts

export interface UseControlledStateOptions<T> {
  /** Controlled value */
  value?: T;
  /** Uncontrolled default value */
  defaultValue?: T;
  /** Value change callback */
  onChange?: (value: T) => void;
}

export function useControlledState<T>({
  value: controlledValue,
  defaultValue,
  onChange,
}: UseControlledStateOptions<T>): [T | undefined, (value: T) => void] {
  // Determine if controlled mode
  const isControlled = controlledValue !== undefined;
  const isControlledRef = useRef(isControlled);

  // Dev environment warning: mode switching
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      if (isControlled !== isControlledRef.current) {
        console.warn(
          'useControlledState: Component switched from ' +
          `${isControlledRef.current ? 'controlled' : 'uncontrolled'} to ` +
          `${isControlled ? 'controlled' : 'uncontrolled'} mode, which is an anti-pattern.`
        );
      }
    }
    isControlledRef.current = isControlled;
  }, [isControlled]);

  // Internal state for uncontrolled mode
  const [internalValue, setInternalValue] = useState(defaultValue);

  // Returned value
  const value = isControlled ? controlledValue : internalValue;

  // Function to set value
  const setValue = useCallback(
    (newValue: T) => {
      // Uncontrolled mode: update internal state
      if (!isControlled) {
        setInternalValue(newValue);
      }
      // Call onChange in both modes
      onChange?.(newValue);
    },
    [isControlled, onChange],
  );

  return [value, setValue];
}
```

### Usage Scenarios

```tsx
// Component supporting both modes
function Dropdown({ value, defaultValue, onChange }) {
  const [selectedValue, setSelectedValue] = useControlledState({
    value,
    defaultValue,
    onChange,
  });

  return (
    <select
      value={selectedValue}
      onChange={(e) => setSelectedValue(e.target.value)}
    >
      {/* options */}
    </select>
  );
}

// Uncontrolled usage
<Dropdown defaultValue="option1" />

// Controlled usage
const [value, setValue] = useState('option1');
<Dropdown value={value} onChange={setValue} />
```

---

## Component Design Principles

### 1. forwardRef Pattern

All UI components use `forwardRef` to forward refs:

```tsx
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    return <button ref={ref} {...props} />;
  }
);
```

### 2. displayName Setting

Facilitates DevTools debugging:

```tsx
Button.displayName = 'Button';
```

### 3. Type Exports

Export Props types for external use:

```tsx
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline';
}

export { Button, type ButtonProps };
```

### 4. Default Value Handling

Use `??` or `defaultVariants` for default values:

```tsx
const Comp = asChild ? Slot : 'button';
const offset = offsetNum ?? 10;
```

---

## UI Component List

```plain
src/components/ui/
├── button.tsx      # Button component (CVA variant example)
├── card.tsx        # Card component (compound component example)
├── popover.tsx     # Popover (Floating UI example)
├── tooltip.tsx     # Tooltip
├── badge.tsx       # Badge
├── avatar.tsx      # Avatar
├── divider.tsx     # Divider
├── segmented.tsx   # Segmented control
├── MenuIcon.tsx    # Menu icon (animated)
├── dialog/         # Dialog
├── cover/          # Cover components
├── loading/        # Loading components
├── navigator/      # Navigator components
└── segmented/      # Segmented controls
```

---

## Key Takeaways

1. **CVA Variant System**: Uses class-variance-authority to manage style variants.
2. **cn() Function**: clsx + tailwind-merge intelligently merges class names.
3. **Compound Component Pattern**: Card is split into multiple child components for flexible composition.
4. **Controlled/Uncontrolled Unification**: useControlledState enables components to support both modes.
5. **Floating UI Integration**: Popover demonstrates best practices for floating positioning.
6. **forwardRef**: All UI components should forward refs.
7. **Error Boundaries**: Floating components use withFloatingErrorBoundary to isolate errors.

---

## Related Files

| File | Description |
|------|-------------|
| `src/components/ui/button.tsx` | Button Component |
| `src/components/ui/card.tsx` | Card Component |
| `src/components/ui/popover.tsx` | Popover Component |
| `src/lib/utils.ts` | cn() Utility Function |
| `src/hooks/useControlledState.ts` | Controlled State Hook |
| `src/hooks/useFloatingUI.ts` | Floating Positioning Hook |
| `src/constants/design-tokens.ts` | Design Tokens |
