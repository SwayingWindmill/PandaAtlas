import { ScreenState } from "@/components/screen-state";

/** A load failure: the sentence, and 重试. */
export function LoadFailed({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry: () => void;
  className?: string;
}) {
  return <ScreenState message={message} actionLabel="重试" onAction={onRetry} className={className} />;
}
