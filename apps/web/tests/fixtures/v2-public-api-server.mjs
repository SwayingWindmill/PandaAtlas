import http from "node:http";

const host = "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_V2_API_PORT ?? "3300");

const release = {
  releaseId: "00000000-0000-4000-8000-000000000001",
  version: "2026.08.12.1",
};

const ids = {
  xiLun: "00000000-0000-4000-8000-000000000101",
  meiXiang: "2939c16f-1938-5629-928c-b36b1d5cd6ed",
  riRi: "57c0a1bd-cc44-5a08-ba48-f224e9956064",
  atlanta: "00000000-0000-4000-8000-000000000201",
  washington: "00000000-0000-4000-8000-000000000202",
  ueno: "00000000-0000-4000-8000-000000000203",
};

function names(zh, en) {
  return [
    { languageTag: "zh-Hans", nameKind: "official", value: zh, isPrimary: true },
    { languageTag: "en", nameKind: "official", value: en, isPrimary: true },
  ];
}

function facts(birthDate, sex, status = "alive") {
  return [
    { fieldKey: "birth_date", value: birthDate, status: "confirmed", lastVerifiedOn: "2026-08-12", conclusionVersion: 1 },
    { fieldKey: "sex", value: sex, status: "confirmed", lastVerifiedOn: "2026-08-12", conclusionVersion: 1 },
    { fieldKey: "life_status", value: status, status: "confirmed", lastVerifiedOn: "2026-08-12", conclusionVersion: 1 },
    { fieldKey: "data_quality", value: "reviewed", status: "confirmed", lastVerifiedOn: "2026-08-12", conclusionVersion: 1 },
  ];
}

// Mirrors the API: the list and profile relatives carry listing facts only.
const listingFactKeys = new Set(["sex", "life_status", "birth_date", "death_date"]);
function listing(panda) {
  return { ...panda, facts: panda.facts.filter((fact) => listingFactKeys.has(fact.fieldKey)) };
}

const pandas = [
  {
    pandaId: ids.xiLun,
    canonicalSlug: "xi-lun",
    legacySlugs: [],
    names: names("喜伦", "Xi Lun"),
    facts: facts("2016-09-03", "female"),
  },
  {
    pandaId: ids.meiXiang,
    canonicalSlug: "mei-xiang",
    legacySlugs: ["meixiang"],
    names: names("美香", "Mei Xiang"),
    facts: facts("1998-07-22", "female"),
  },
  {
    pandaId: ids.riRi,
    canonicalSlug: "ri-ri",
    legacySlugs: [],
    names: names("力力", "Ri Ri"),
    facts: facts("2005-08-16", "male"),
  },
];

const places = [
  {
    placeId: ids.atlanta,
    slug: "zoo-atlanta",
    placeType: "zoo",
    nameZh: "亚特兰大动物园",
    nameEn: "Zoo Atlanta",
    countryCode: "US",
    region: "Atlanta",
  },
  {
    placeId: ids.washington,
    slug: "smithsonian-national-zoo",
    placeType: "zoo",
    nameZh: "史密森国家动物园",
    nameEn: "Smithsonian's National Zoo",
    countryCode: "US",
    region: "Washington, DC",
  },
  {
    placeId: ids.ueno,
    slug: "ueno-zoo",
    placeType: "zoo",
    nameZh: "上野动物园",
    nameEn: "Ueno Zoo",
    countryCode: "JP",
    region: "Tokyo",
  },
];

const residencies = [
  {
    residencyId: "fixture-residency-xi-lun",
    pandaId: ids.xiLun,
    placeId: ids.atlanta,
    residencyType: "managed_care",
    startOn: "2016-09-03",
    startPrecision: "day",
    status: "confirmed",
    sourceIds: [],
  },
  {
    residencyId: "fixture-residency-mei-xiang",
    pandaId: ids.meiXiang,
    placeId: ids.washington,
    residencyType: "managed_care",
    startOn: "2000-12-06",
    startPrecision: "day",
    endOn: "2023-11-08",
    endPrecision: "day",
    status: "confirmed",
    sourceIds: [],
  },
  {
    residencyId: "fixture-residency-ri-ri",
    pandaId: ids.riRi,
    placeId: ids.ueno,
    residencyType: "managed_care",
    startOn: "2011-02-21",
    startPrecision: "day",
    status: "confirmed",
    sourceIds: [],
  },
];

const lifeEvents = [
  {
    eventId: "fixture-birth-xi-lun",
    eventType: "birth",
    eventStatus: "completed",
    occurredOn: "2016-09-03",
    occurredPrecision: "day",
    participantIds: [ids.xiLun],
    sourceIds: [],
  },
  {
    eventId: "fixture-arrival-xi-lun",
    eventType: "arrival",
    eventStatus: "completed",
    occurredOn: "2016-09-03",
    occurredPrecision: "day",
    toPlaceId: ids.atlanta,
    participantIds: [ids.xiLun],
    sourceIds: [],
  },
  {
    eventId: "fixture-birth-mei-xiang",
    eventType: "birth",
    eventStatus: "completed",
    occurredOn: "1998-07-22",
    occurredPrecision: "day",
    participantIds: [ids.meiXiang],
    sourceIds: [],
  },
  {
    eventId: "fixture-birth-ri-ri",
    eventType: "birth",
    eventStatus: "completed",
    occurredOn: "2005-08-16",
    occurredPrecision: "day",
    participantIds: [ids.riRi],
    sourceIds: [],
  },
  // Referenced by the curated "smithsonian-generations" family story.
  {
    eventId: "event-smithsonian-departure-2023",
    eventType: "transfer",
    eventStatus: "completed",
    occurredOn: "2023-11-08",
    occurredPrecision: "day",
    fromPlaceId: ids.washington,
    participantIds: [ids.meiXiang],
    sourceIds: ["src_smithsonian_history"],
  },
];

const lineage = [];

const evidence = [
  {
    sourceId: "src_smithsonian_history",
    publisher: "Smithsonian National Zoo and Conservation Biology Institute",
    title: "History of Giant Pandas at the Smithsonian's National Zoo",
    url: "https://nationalzoo.si.edu/animals/history-giant-pandas-zoo",
    lastVerifiedOn: "2026-07-23",
    languageTag: "en",
    accessState: "accessible",
  },
];

// One licensed cover per fixture panda, served from this fixture so browser tests stay offline.
const coverImage = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const covers = pandas.map((panda, index) => ({
  assetId: `00000000-0000-4000-8000-0000000003${String(index + 1).padStart(2, "0")}`,
  pandaId: panda.pandaId,
  usageRole: "cover",
  displayOrder: 0,
  objectKey: `http://${host}:${port}/media/pandas/photos/${panda.canonicalSlug}.png`,
  contentSha256: "a".repeat(64),
  mediaType: "image/png",
  title: `${panda.names[1].value} at rest`,
  creator: "Fixture Photographer",
  license: "CC-BY-4.0",
  attributionText: "Fixture Photographer / CC BY 4.0",
}));

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

// Mirrors the API's family circle: parents, children, siblings and grandparents.
function relativesOf(pandaId) {
  const parentsOf = (id) => lineage.filter((item) => item.childId === id).map((item) => item.parentId);
  const childrenOf = (id) => lineage.filter((item) => item.parentId === id).map((item) => item.childId);
  const ids = new Set(childrenOf(pandaId));
  for (const parentId of parentsOf(pandaId)) {
    ids.add(parentId);
    for (const siblingId of childrenOf(parentId)) ids.add(siblingId);
    for (const grandparentId of parentsOf(parentId)) ids.add(grandparentId);
  }
  ids.delete(pandaId);
  return pandas.filter((item) => ids.has(item.pandaId)).map(listing);
}

function pandaDetail(reference) {
  const panda = pandas.find((item) =>
    item.canonicalSlug === reference || item.pandaId === reference || item.legacySlugs.includes(reference));
  if (!panda) return null;
  return {
    release,
    panda,
    relatives: relativesOf(panda.pandaId),
    lineage: lineage.filter((item) => item.childId === panda.pandaId || item.parentId === panda.pandaId),
    residencies: residencies.filter((item) => item.pandaId === panda.pandaId),
    events: lifeEvents.filter((item) => item.participantIds.includes(panda.pandaId)),
    media: [],
    evidence: [],
  };
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);

  if (request.method !== "GET") {
    sendJson(response, 405, { title: "Method Not Allowed", status: 405 });
    return;
  }

  if (url.pathname === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }
  if (url.pathname === "/api/v2/pandas") {
    sendJson(response, 200, { release, items: pandas.map(listing) });
    return;
  }
  if (url.pathname === "/api/v2/places") {
    sendJson(response, 200, { release, items: places });
    return;
  }
  if (url.pathname === "/api/v2/residencies") {
    sendJson(response, 200, { release, items: residencies });
    return;
  }
  if (url.pathname === "/api/v2/life-events") {
    sendJson(response, 200, { release, items: lifeEvents });
    return;
  }
  if (url.pathname === "/api/v2/lineage") {
    sendJson(response, 200, { release, items: lineage });
    return;
  }
  if (url.pathname === "/api/v2/panda-covers") {
    const ids = new Set((url.searchParams.get("ids") ?? "").split(",").filter(Boolean));
    if (ids.size === 0) {
      sendJson(response, 400, { title: "Bad Request", status: 400 });
      return;
    }
    sendJson(response, 200, { release, items: covers.filter((cover) => ids.has(cover.pandaId)) });
    return;
  }
  if (url.pathname.startsWith("/media/pandas/photos/")) {
    response.writeHead(200, { "content-type": "image/png", "content-length": coverImage.length });
    response.end(coverImage);
    return;
  }
  if (url.pathname.startsWith("/api/v2/evidence/")) {
    const sourceId = decodeURIComponent(url.pathname.slice("/api/v2/evidence/".length));
    const source = evidence.find((item) => item.sourceId === sourceId);
    if (source) sendJson(response, 200, { release, source });
    else sendJson(response, 404, { title: "Not Found", status: 404 });
    return;
  }
  if (url.pathname.startsWith("/api/v2/pandas/")) {
    const reference = decodeURIComponent(url.pathname.slice("/api/v2/pandas/".length));
    const detail = pandaDetail(reference);
    if (detail) {
      sendJson(response, 200, detail);
    } else {
      sendJson(response, 404, { type: "about:blank", title: "Panda not found", status: 404 });
    }
    return;
  }

  sendJson(response, 404, { type: "about:blank", title: "Not found", status: 404 });
});

server.listen(port, host, () => {
  console.log(`[v2-public-api-fixture] listening on http://${host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
