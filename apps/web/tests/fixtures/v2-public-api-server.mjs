import http from "node:http";

const host = "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_V2_API_PORT ?? "3300");

const release = {
  releaseId: "00000000-0000-4000-8000-000000000001",
  version: "2026.08.12.1",
};

const ids = {
  xiLun: "00000000-0000-4000-8000-000000000101",
  meiXiang: "00000000-0000-4000-8000-000000000102",
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
    { fieldKey: "identity.birth_date", value: birthDate, status: "confirmed", lastVerifiedOn: "2026-08-12", conclusionVersion: 1 },
    { fieldKey: "identity.sex", value: sex, status: "confirmed", lastVerifiedOn: "2026-08-12", conclusionVersion: 1 },
    { fieldKey: "life_status", value: status, status: "confirmed", lastVerifiedOn: "2026-08-12", conclusionVersion: 1 },
  ];
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
    legacySlugs: [],
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
];

const lineage = [];

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function pandaDetail(reference) {
  const panda = pandas.find((item) => item.canonicalSlug === reference || item.pandaId === reference);
  if (!panda) return null;
  return {
    release,
    panda,
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
    sendJson(response, 200, { release, items: pandas });
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
