import { cn } from '@/lib/utils';
import { Slot } from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Text as RNText, type Role } from 'react-native';

// iOS text styles. Line heights are opened up so Chinese doesn't clip.
const textVariants = cva(
  cn(
    'text-body text-foreground',
    Platform.select({
      web: 'select-text',
    })
  ),
  {
    variants: {
      variant: {
        default: '',
        largeTitle: cn('text-large-title font-bold', Platform.select({ web: 'text-balance' })),
        title1: cn('text-title1 font-bold', Platform.select({ web: 'text-balance' })),
        title2: cn('text-title2 font-bold', Platform.select({ web: 'text-balance' })),
        title3: 'text-title3 font-semibold',
        headline: 'text-headline font-semibold',
        body: 'text-body',
        callout: 'text-callout',
        subhead: 'text-subhead',
        footnote: 'text-footnote',
        caption: 'text-caption',
        // Older names, mapped onto the same scale so existing screens pick it up.
        h1: cn('text-large-title font-bold', Platform.select({ web: 'text-balance' })),
        h2: cn('text-title2 font-bold', Platform.select({ web: 'text-balance' })),
        h3: 'text-headline font-semibold',
        p: 'text-body',
        muted: 'text-footnote text-muted-foreground',
        small: 'text-caption',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps['variant']>;

const ROLE: Partial<Record<TextVariant, Role>> = {
  largeTitle: 'heading',
  title1: 'heading',
  title2: 'heading',
  title3: 'heading',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  largeTitle: '1',
  title1: '2',
  h1: '1',
  title2: '2',
  h2: '2',
  title3: '3',
  h3: '3',
};

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({
  className,
  asChild = false,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof RNText> &
  React.RefAttributes<typeof RNText> &
  TextVariantProps & {
    asChild?: boolean;
  }) {
  const textClass = React.useContext(TextClassContext);
  const Component = asChild ? Slot : RNText;
  return (
    <Component
      className={cn(textVariants({ variant }), textClass, className)}
      role={variant ? ROLE[variant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      {...props}
    />
  );
}

export { Text, TextClassContext };
