import * as React from "react";
import { View } from "react-native";

import { Text, TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type ViewBoxProps = React.ComponentProps<typeof View>;

/** React Native Reusables Card restyled to the app's grouped card tokens. */
function Card({ className, style, ...props }: ViewBoxProps) {
  return (
    <TextClassContext.Provider value="text-card-foreground">
      <View
        className={cn("flex flex-col gap-row rounded-card bg-card p-inset", className)}
        style={[{ borderCurve: "continuous" }, style]}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function CardHeader({ className, ...props }: ViewBoxProps) {
  return <View className={cn("flex flex-col gap-hair-gap", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<typeof Text>) {
  return <Text variant="title" className={className} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<typeof Text>) {
  return <Text variant="footnote" className={cn("text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: ViewBoxProps) {
  return <View className={cn(className)} {...props} />;
}

function CardFooter({ className, ...props }: ViewBoxProps) {
  return <View className={cn("flex flex-row items-center", className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
