import { Icon } from '@/components/icon';
import { ChevronDown } from '@/components/icons';
import { TextClassContext } from '@/components/ui/text';
import { EASE_MOVE, EASE_OUT } from '@/design/motion';
import { component, semantic } from '@/design/tokens';
import { cn } from '@/lib/utils';
import * as AccordionPrimitive from '@rn-primitives/accordion';
import { Platform, Pressable, View } from 'react-native';
import Animated, {
  FadeOutUp,
  LayoutAnimationConfig,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * React Native Reusables' Accordion (shadcn registry, @rn-primitives/accordion), on the app's
 * tokens: a headline-weight trigger at least 44pt tall, the app's ChevronDown, `move` for the
 * height change and `exit` for the content leaving. Reduce Motion drops the movement (the
 * primitives' ReduceMotion.System) and keeps the state change. For long, optional detail on a
 * page (参观须知, 资料说明), never for the first thing a fan came for.
 */
const MOVE = semantic.motion.move.duration;
const EXIT = semantic.motion.exit.duration;

function Accordion({
  children,
  ref,
  ...props
}: Omit<React.ComponentProps<typeof AccordionPrimitive.Root>, 'asChild'>) {
  return (
    <LayoutAnimationConfig skipEntering>
      <AccordionPrimitive.Root
        {...(props as AccordionPrimitive.RootProps)}
        asChild={Platform.OS !== 'web'}>
        <Animated.View layout={LinearTransition.duration(MOVE).easing(EASE_MOVE).reduceMotion(ReduceMotion.System)}>{children}</Animated.View>
      </AccordionPrimitive.Root>
    </LayoutAnimationConfig>
  );
}

function AccordionItem({
  children,
  className,
  value,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      className={cn(
        'border-border border-b-hairline',
        Platform.select({ web: 'last:border-b-0' }),
        className
      )}
      value={value}
      asChild
      {...props}>
      <Animated.View
        className="native:overflow-hidden"
        layout={Platform.select({ native: LinearTransition.duration(MOVE).easing(EASE_MOVE).reduceMotion(ReduceMotion.System) })}>
        {children}
      </Animated.View>
    </AccordionPrimitive.Item>
  );
}

const Trigger = Platform.OS === 'web' ? View : Pressable;

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger> & {
  children?: React.ReactNode;
}) {
  const { isExpanded } = AccordionPrimitive.useItemContext();

  const progress = useDerivedValue(
    () => (isExpanded
        ? withTiming(1, { duration: MOVE, easing: EASE_OUT, reduceMotion: ReduceMotion.System })
        : withTiming(0, { duration: EXIT, easing: EASE_OUT, reduceMotion: ReduceMotion.System })),
    [isExpanded]
  );
  const chevronStyle = useAnimatedStyle(
    () => ({
      transform: [{ rotate: `${progress.value * 180}deg` }],
    }),
    [progress]
  );

  return (
    <TextClassContext.Provider
      value={cn(
        'text-left text-body font-semibold text-foreground'
      )}>
      <AccordionPrimitive.Header>
        <AccordionPrimitive.Trigger {...props} asChild={Platform.OS !== 'web'}>
          <Trigger
            className={cn(
              'flex-row items-center justify-between gap-row py-stack-tight active:opacity-60 disabled:opacity-50',
              Platform.select({
                web: 'focus-visible:ring-ring flex flex-1 rounded-control outline-none focus-visible:ring-2 disabled:pointer-events-none',
              }),
              className
            )}
            style={{ minHeight: component.hitTarget }}>
            <>{children}</>
            <Animated.View style={chevronStyle}>
              <Icon icon={ChevronDown} size={component.icon.chevron} tone="tertiary" strokeWidth={component.iconStroke.bold} />
            </Animated.View>
          </Trigger>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
    </TextClassContext.Provider>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <TextClassContext.Provider value="text-body text-foreground">
      <AccordionPrimitive.Content
        className="overflow-hidden"
        {...props}>
        <Animated.View
          exiting={Platform.select({
            native: FadeOutUp.duration(EXIT).reduceMotion(ReduceMotion.System),
          })}
          className={cn('pb-row', className)}>
          {children}
        </Animated.View>
      </AccordionPrimitive.Content>
    </TextClassContext.Provider>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
