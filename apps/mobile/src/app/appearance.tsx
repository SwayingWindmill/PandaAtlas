import { ListCell, ListSection } from "@/components/grouped-list";
import { Page } from "@/components/page";
import { APPEARANCES, useAppearance } from "@/features/appearance/appearance";
import { selectionHaptic } from "@/lib/haptics";

/** 外观: a picker list, as Settings chooses a value on its own page. */
export default function AppearanceScreen() {
  const [appearance, setAppearance] = useAppearance();
  return (
    <Page title="外观">
      <ListSection>
        {APPEARANCES.map((option, index) => (
          <ListCell
            key={option.value}
            label={option.label}
            checked={appearance === option.value}
            onPress={() => {
              selectionHaptic();
              setAppearance(option.value);
            }}
            last={index === APPEARANCES.length - 1}
          />
        ))}
      </ListSection>
    </Page>
  );
}
