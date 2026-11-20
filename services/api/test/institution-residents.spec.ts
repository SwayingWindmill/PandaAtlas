import { describe, expect, it } from "vitest";

import { buildInstitutionResidents } from "../src/modules/public-read/application/institution-residents.js";
import type { PublicPandaSummary } from "../src/modules/public-read/application/public-read.application.js";

function panda(id: string, birthDate: string | null = null, slug = id): PublicPandaSummary {
  return {
    pandaId: id,
    canonicalSlug: slug,
    legacySlugs: [],
    names: [],
    facts:
      birthDate === null
        ? []
        : [
            {
              fieldKey: "birth_date",
              value: birthDate,
              status: "confirmed",
              lastVerifiedOn: "2026-10-28",
              conclusionVersion: 1,
            },
          ],
  };
}

const index = new Map(
  [panda("a", "2013-08-23"), panda("b"), panda("c", "2000-01-01"), panda("d")].map((item) => [item.pandaId, item]),
);

describe("buildInstitutionResidents", () => {
  it("keeps a panda with an open stay as a resident even after an earlier closed one", () => {
    const { residents, former } = buildInstitutionResidents(
      [
        { pandaId: "b", startOn: "2010-01-01", endOn: "2012-01-01" },
        { pandaId: "b", startOn: "2015-01-01" },
      ],
      index,
    );
    expect(residents.map((item) => item.pandaId)).toEqual(["b"]);
    expect(former).toEqual([]);
  });

  it("gives former residents the span of their stays, newest departure first", () => {
    const { former } = buildInstitutionResidents(
      [
        { pandaId: "c", startOn: "2000-12-06", endOn: "2005-01-01" },
        { pandaId: "c", startOn: "2008-01-01", endOn: "2023-11-08" },
        { pandaId: "a", startOn: "2013-08-23", endOn: "2017-02-21" },
        { pandaId: "d" },
      ],
      index,
    );
    expect(former.map(({ panda: item, fromYear, toYear }) => [item.pandaId, fromYear, toYear])).toEqual([
      ["c", 2000, 2023],
      ["a", 2013, 2017],
    ]);
  });

  it("counts a panda as born here when a stay here starts on its birthday", () => {
    const { former, bornHereCount } = buildInstitutionResidents(
      [
        { pandaId: "a", startOn: "2013-08-23", startPrecision: "day", endOn: "2017-02-21" },
        { pandaId: "c", startOn: "2000-12-06", startPrecision: "day", endOn: "2023-11-08" },
      ],
      index,
    );
    expect(bornHereCount).toBe(1);
    expect(former.find((item) => item.panda.pandaId === "a")?.bornHere).toBe(true);
  });

  it("does not count a year-precise arrival that happens to match a 1 January birthday", () => {
    const { bornHereCount } = buildInstitutionResidents(
      [{ pandaId: "c", startOn: "2000-01-01", startPrecision: "year", endOn: "2005-01-01" }],
      index,
    );
    expect(bornHereCount).toBe(0);
  });

  it("leaves out pandas that are not in the deliverable index and sorts residents and equal-year former pandas stably", () => {
    const customIndex = new Map([
      ["p1", panda("p1", null, "zeta")],
      ["p2", panda("p2", null, "alpha")],
      ["p3", panda("p3", null, "beta")],
      ["p4", panda("p4", null, "gamma")],
    ]);
    const result = buildInstitutionResidents(
      [
        { pandaId: "zz", startOn: "2020-01-01" },
        { pandaId: "p1" },
        { pandaId: "p2" },
        { pandaId: "p3", startOn: "2010-01-01", endOn: "2020-05-01" },
        { pandaId: "p4", startOn: "2012-01-01", endOn: "2020-02-01" },
      ],
      customIndex,
    );
    expect(result.residents.map((item) => item.canonicalSlug)).toEqual(["alpha", "zeta"]);
    expect(result.former.map((item) => item.panda.canonicalSlug)).toEqual(["beta", "gamma"]);
    expect(result.bornHereCount).toBe(0);
  });
});
