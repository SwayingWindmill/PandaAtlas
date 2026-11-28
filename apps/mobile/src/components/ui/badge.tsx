import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { Slot } from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { View } from 'react-native';

/**
 * React Native Reusables' Badge (shadcn registry), restyled to the app's tokens: a footnote
 * capsule that marks a state, never an action. `tint` is a selected or confirmed state on the
 * tinted fill (今天, 新); `neutral` is a plain count or category.
 */
const badgeVariants = cva(
  'shrink-0 flex-row items-center justify-center gap-hair-gap self-start overflow-hidden rounded-pill px-stack-tight py-hair-gap',
  {
    variants: {
      variant: {
        neutral: 'bg-secondary',
        tint: 'bg-highlight-soft',
        destructive: 'bg-destructive',
        outline: 'border border-border',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
);

const badgeTextVariants = cva('text-footnote font-semibold', {
  variants: {
    variant: {
      neutral: 'text-foreground',
      tint: 'text-primary',
      destructive: 'text-on-media',
      outline: 'text-foreground',
    },
  },
  defaultVariants: { variant: 'neutral' },
});

type BadgeProps = React.ComponentProps<typeof View> &
  React.RefAttributes<View> & {
    asChild?: boolean;
  } & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, asChild, ...props }: BadgeProps) {
  const Component = asChild ? Slot : View;
  return (
    <TextClassContext.Provider value={badgeTextVariants({ variant })}>
      <Component className={cn(badgeVariants({ variant }), className)} {...props} />
    </TextClassContext.Provider>
  );
}

export { Badge, badgeTextVariants, badgeVariants };
export type { BadgeProps };
