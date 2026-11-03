import { cn } from '@/lib/utils';
import { Slot } from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Text as RNText, type Role } from 'react-native';

// Text styles, named by purpose like iOS text styles. Each binds size, line height, weight and
// tracking (0: Chinese is never tracked); sizes and line heights come from src/design/tokens.ts.
// A new or redesigned screen uses only these:
//   display      34/41 bold      the one title on a screen, and the featured 今天 card
//   title        22/28 bold      a section, a card title; `stat` is title with tabular figures
//   headline     17/24 semibold  a name that leads a row or chip, emphasis at body size
//   body         17/26           sentences, row titles, buttons
//   subheadline  15/22           a second line in a dense row, when footnote is too small for Chinese
//   footnote     13/18           group headers, captions, credits, the date (the floor)
// The 科普 reading column has its own set (reading*), used only there.
// Hierarchy inside a size comes from weight and color, not from a size in between.
// Everything under "Deprecated" stays for screens that have not been redesigned yet; see DESIGN.md.
const BALANCE = Platform.select({ web: 'text-balance' });

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
        display: cn('text-display font-bold', BALANCE),
        title: cn('text-title font-bold', BALANCE),
        stat: 'text-title font-bold tabular-nums',
        headline: 'text-headline font-semibold',
        body: 'text-body',
        subheadline: 'text-subheadline',
        footnote: 'text-footnote',
        // 科普 reading column.
        readingTitle: cn('text-reading-title font-bold', BALANCE),
        readingHeading: cn('text-reading-heading font-bold', BALANCE),
        readingLead: 'text-reading-lead text-muted-foreground',
        readingBody: 'text-reading-body',
        readingCaption: 'text-reading-caption text-muted-foreground',
        // Deprecated: kept so older screens render. Replacement in brackets.
        /** @deprecated Use `display`. */
        largeTitle: cn('text-large-title font-bold', BALANCE),
        /** @deprecated Use `display`, or `readingTitle` in 科普. */
        title1: cn('text-title1 font-bold', BALANCE),
        /** @deprecated Use `title`. */
        title2: cn('text-title2 font-bold', BALANCE),
        /** @deprecated Use `title` or `headline`. */
        title3: 'text-title3 font-semibold',
        /** @deprecated Use `body`. */
        callout: 'text-callout',
        /** @deprecated Use `subheadline`. */
        subhead: 'text-subhead',
        /** @deprecated Use `footnote`; 12pt is too small for Chinese. */
        caption: 'text-caption',
        /** @deprecated Use `display`. */
        h1: cn('text-large-title font-bold', BALANCE),
        /** @deprecated Use `title`. */
        h2: cn('text-title2 font-bold', BALANCE),
        /** @deprecated Use `headline`. */
        h3: 'text-headline font-semibold',
        /** @deprecated Use `body`. */
        p: 'text-body',
        /** @deprecated Use `footnote` with `text-muted-foreground`. */
        muted: 'text-footnote text-muted-foreground',
        /** @deprecated Use `footnote`. */
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
  display: 'heading',
  title: 'heading',
  readingTitle: 'heading',
  readingHeading: 'heading',
  largeTitle: 'heading',
  title1: 'heading',
  title2: 'heading',
  title3: 'heading',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  display: '1',
  title: '2',
  readingTitle: '1',
  readingHeading: '2',
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
      // A small-text heading (a grouped section's footnote title, a card's headline) gets a level too, so
      // the web does not read it as a page's h1: 2 for a section, 3 for a card's own title.
      aria-level={(variant ? ARIA_LEVEL[variant] : undefined) ?? (props.role === 'heading' ? (variant === 'headline' ? '3' : '2') : undefined)}
      // Dynamic Type: every text style follows the system text size. Layouts that would
      // clip at accessibility sizes read useWindowDimensions().fontScale and restack.
      allowFontScaling
      {...props}
    />
  );
}

export { Text, TextClassContext };
