import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as TogglePrimitive from '@rn-primitives/toggle';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform } from 'react-native';

const toggleVariants = cva(
  cn(
    'group flex flex-row items-center justify-center gap-2 rounded-full active:bg-accent',
    Platform.select({
      web: 'focus-visible:ring-ring inline-flex cursor-default whitespace-nowrap outline-none focus-visible:ring-2 disabled:pointer-events-none',
    })
  ),
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border-hairline border-input bg-transparent',
      },
      size: {
        default: 'h-11 min-w-11 px-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

/** Selected chip takes the tint. Unselected stays a quiet outline. */
const toggleSelected = 'border-transparent bg-primary';

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TextClassContext.Provider value={cn('text-base text-foreground', props.pressed && 'font-semibold text-primary-foreground')}>
      <TogglePrimitive.Root
        // The web primitive renders a plain button; expose its state as native does.
        aria-pressed={props.pressed}
        className={cn(
          toggleVariants({ variant, size }),
          props.disabled && 'opacity-50',
          props.pressed && toggleSelected,
          className
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

export { Toggle, toggleSelected, toggleVariants };
