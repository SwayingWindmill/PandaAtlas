import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  setTheme: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({ default: mocks }));
vi.mock("uniwind", () => ({ Uniwind: { setTheme: mocks.setTheme } }));
vi.mock("react", () => ({
  useState: (initial: unknown) => [initial, vi.fn()],
  useEffect: (effect: () => void) => effect(),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

test("a late startup read cannot undo a choice and writes preserve selection order", async () => {
  let finishRead!: (value: string) => void;
  let finishWrite!: () => void;
  const read = new Promise<string>((resolve) => { finishRead = resolve; });
  mocks.getItem.mockReturnValue(read);
  mocks.setItem.mockImplementationOnce(() => new Promise<void>((resolve) => { finishWrite = resolve; }));
  mocks.setItem.mockResolvedValue(undefined);
  const { applyStoredAppearance, useAppearance } = await import("./appearance");
  const startup = applyStoredAppearance();
  const [, choose] = useAppearance();
  choose("dark");
  choose("light");
  finishRead("system");
  await startup;
  await Promise.resolve();
  expect(mocks.setTheme.mock.calls).toEqual([["dark"], ["light"]]);
  expect(mocks.setItem).toHaveBeenCalledTimes(1);
  finishWrite();
  await vi.waitFor(() => expect(mocks.setItem.mock.calls).toEqual([["appearance", "dark"], ["appearance", "light"]]));
  expect(useAppearance()[0]).toBe("light");
});
