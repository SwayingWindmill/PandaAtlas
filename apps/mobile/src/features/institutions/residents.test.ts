import { describe, expect, it } from "vitest";

import type { PandaListItem } from "@/features/pandas/pandas";

import { residentsOf } from "./residents";

const panda = (id: string, birthDate: string | null = null) => ({ id, slug: id, name: id, birthDate }) as PandaListItem;
const index = new Map([panda("a", "2013-08-23"), panda("b"), panda("c", "2000-01-01"), panda("d")].map((item) => [item.id, item]));

describe("residentsOf", () => {
  it("keeps a panda with an open stay as a resident even after an earlier closed one", () => {
    const { residents, former } = residentsOf(
      [
        { pandaId: "b", startOn: "2010-01-01", endOn: "2012-01-01" },
        { pandaId: "b", startOn: "2015-01-01" },
      ],
      index,
    );
    expect(residents.map((item) => item.id)).toEqual(["b"]);
    expect(former).toEqual([]);
  });

  it("gives former residents the span of their stays, newest departure first", () => {
    const { former } = residentsOf(
      [
        { pandaId: "c", startOn: "2000-12-06", endOn: "2005-01-01" },
        { pandaId: "c", startOn: "2008-01-01", endOn: "2023-11-08" },
        { pandaId: "a", startOn: "2013-08-23", endOn: "2017-02-21" },
        { pandaId: "d" },
      ],
      index,
    );
    expect(former.map(({ panda: item, from, to }) => [item.id, from, to])).toEqual([
      ["c", 2000, 2023],
      ["a", 2013, 2017],
    ]);
  });

  it("counts a panda as born here when a stay here starts on its birthday", () => {
    const { former, bornHere } = residentsOf(
      [
        { pandaId: "a", startOn: "2013-08-23", startPrecision: "day", endOn: "2017-02-21" },
        { pandaId: "c", startOn: "2000-12-06", startPrecision: "day", endOn: "2023-11-08" },
      ],
      index,
    );
    expect(bornHere).toBe(1);
    expect(former.find((item) => item.panda.id === "a")?.bornHere).toBe(true);
  });

  it("does not count a year-precise arrival that happens to match a 1 January birthday", () => {
    const { bornHere } = residentsOf([{ pandaId: "c", startOn: "2000-01-01", startPrecision: "year", endOn: "2005-01-01" }], index);
    expect(bornHere).toBe(0);
  });

  it("leaves out pandas that are not in the published index", () => {
    expect(residentsOf([{ pandaId: "zz", startOn: "2020-01-01" }], index)).toEqual({ residents: [], former: [], bornHere: 0 });
  });
});
