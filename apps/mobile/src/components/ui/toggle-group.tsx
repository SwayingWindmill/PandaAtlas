import { TextClassContext } from '@/components/ui/text';
import { toggleSelected, toggleVariants } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';
import * as ToggleGroupPrimitive from '@rn-primitives/toggle-group';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants> | null>(null);

/** Separate pill chips that wrap, rather than one joined segmented bar. */
function ToggleGroup({
  className,
  variant,
  size,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <ToggleGroupPrimitive.Root className={cn('flex flex-row flex-wrap gap-2', className)} {...props}>
      <ToggleGroupContext.Provider value={{ variant, size }}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function useToggleGroupContext() {
  const context = React.useContext(ToggleGroupContext);
  if (context === null) {
    throw new Error('ToggleGroup compound components cannot be rendered outside the ToggleGroup component');
  }
  return context;
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & VariantProps<typeof toggleVariants>) {
  const context = useToggleGroupContext();
  const { value, type } = ToggleGroupPrimitive.useRootContext();
  const selected = ToggleGroupPrimitive.utils.getIsSelected(value, props.value);

  return (
    <TextClassContext.Provider value={cn('text-base text-foreground', selected && 'font-bold')}>
      <ToggleGroupPrimitive.Item
        // The web primitive renders a plain button; give it the radio or checkbox semantics native already has.
        role={type === 'single' ? 'radio' : 'checkbox'}
        aria-checked={selected}
        className={cn(
          toggleVariants({ variant: context.variant || variant, size: context.size || size }),
          props.disabled && 'opacity-50',
          selected && toggleSelected,
          className
        )}
        {...props}>
        {children}
      </ToggleGroupPrimitive.Item>
    </TextClassContext.Provider>
  );
}

export { ToggleGroup, ToggleGroupItem };
