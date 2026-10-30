import { cn } from '@/lib/utils';
import { View } from 'react-native';
import * as React from 'react';

// Static placeholder blocks: the design system adds no shimmer or pulse while loading.
function Skeleton({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return <View className={cn('bg-secondary rounded-group', className)} {...props} />;
}

export { Skeleton };
