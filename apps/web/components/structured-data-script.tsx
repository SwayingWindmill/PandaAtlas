import { serializeStructuredData, type StructuredData } from "@/lib/structured-data";

export function StructuredDataScript({ data, testId }: { data: StructuredData; testId: string }) {
  return (
    <script
      type="application/ld+json"
      data-testid={testId}
      dangerouslySetInnerHTML={{ __html: serializeStructuredData(data) }}
    />
  );
}
