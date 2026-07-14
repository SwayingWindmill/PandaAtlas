// Generated from contracts/golden-dataset/mei-xiang-family.v1.json.
// Run npm run generate:trusted-identity-aliases after changing trusted identity data.

import type { PandaDetail, PandaLineageEdge, PandaLineageNode } from "@/lib/types";

export interface TrustedPandaReference {
  id: string;
  slug: string;
}

export const TRUSTED_PANDA_REFERENCES: Readonly<Record<string, TrustedPandaReference>> = {
  "mei_xiang": {
    "id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "slug": "mei-xiang"
  },
  "mei-xiang": {
    "id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "slug": "mei-xiang"
  },
  "meixiang": {
    "id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "slug": "mei-xiang"
  },
  "tian_tian": {
    "id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "slug": "tian-tian"
  },
  "tian-tian": {
    "id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "slug": "tian-tian"
  },
  "tiantian": {
    "id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "slug": "tian-tian"
  }
};

export const TRUSTED_PANDA_DETAILS: PandaDetail[] = [
  {
    "id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "slug": "mei-xiang",
    "name_zh": "美香",
    "name_en": "Mei Xiang",
    "gender": "female",
    "status": "alive",
    "birth_date": "1998-07-22",
    "current_location": "China",
    "cover_image_url": null,
    "search_terms": [
      "mei-xiang",
      "美香",
      "Mei Xiang",
      "Měixiāng",
      "Mei-Xiang",
      "meixiang",
      "mei_xiang",
      "smithsonian_history_key:mei-xiang"
    ],
    "intro": "曾生活于史密森国家动物园的雌性大熊猫，是泰山、宝宝、贝贝和小奇迹的母亲。",
    "birthplace": null,
    "tags": [
      "trusted-identity",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": null,
    "habitats": [],
    "media": [],
    "identity": {
      "stable_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
      "canonical_slug": "mei-xiang",
      "names": [
        {
          "value": "美香",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_smithsonian_history"
          ]
        },
        {
          "value": "Mei Xiang",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_smithsonian_history"
          ]
        },
        {
          "value": "Měixiāng",
          "language": "pinyin",
          "kind": "pinyin",
          "primary": true,
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ],
      "aliases": [
        {
          "value": "Mei-Xiang",
          "language": "en",
          "kind": "historic_spelling",
          "primary": false,
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ],
      "legacy_slugs": [
        {
          "value": "meixiang",
          "source_ids": [
            "src_smithsonian_history"
          ]
        },
        {
          "value": "mei_xiang",
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ],
      "external_identifiers": [
        {
          "system": "smithsonian_history_key",
          "value": "mei-xiang",
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ]
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "1998-07-22",
        "status": "confirmed",
        "last_verified_at": "2026-05-09",
        "assertion_ids": [
          "fact-mei-xiang-birth-date"
        ],
        "source_ids": [
          "src_smithsonian_agreement_2020"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "China",
        "status": "confirmed",
        "last_verified_at": "2026-05-09",
        "assertion_ids": [
          "fact-mei-xiang-current-place"
        ],
        "source_ids": [
          "src_smithsonian_history"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "female",
        "status": "confirmed",
        "last_verified_at": "2026-05-09",
        "assertion_ids": [
          "fact-mei-xiang-sex"
        ],
        "source_ids": [
          "src_smithsonian_history"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_smithsonian_agreement_2020",
        "publisher": "Smithsonian National Zoo and Conservation Biology Institute",
        "title": "Smithsonian extends giant panda agreement",
        "url": "https://nationalzoo.si.edu/news/smithsonians-national-zoo-and-conservation-biology-institute-extends-giant-panda-agreement",
        "published_at": "2020-12-07",
        "last_verified_at": "2026-05-09",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_smithsonian_history",
        "publisher": "Smithsonian National Zoo and Conservation Biology Institute",
        "title": "History of Giant Pandas at the Smithsonian's National Zoo and Conservation Biology Institute",
        "url": "https://nationalzoo.si.edu/animals/history-giant-pandas-zoo",
        "published_at": null,
        "last_verified_at": "2026-05-09",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": {
      "facility_id": null,
      "coarse_location": "China",
      "status": "confirmed_country_level"
    },
    "residencies": [
      {
        "id": "res-mei-xiang-smithsonian",
        "facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "2000-12-06",
        "start_precision": "day",
        "end_date": "2023-11-08",
        "end_precision": "day",
        "status": "confirmed",
        "source_ids": [
          "src_smithsonian_history"
        ]
      },
      {
        "id": "res-mei-xiang-china",
        "facility_id": null,
        "coarse_location": "China",
        "residency_type": "primary",
        "start_date": "2023-11-08",
        "start_precision": "day",
        "end_date": null,
        "end_precision": null,
        "status": "confirmed_country_level",
        "source_ids": [
          "src_smithsonian_history"
        ]
      }
    ],
    "events": [
      {
        "id": "event-smithsonian-return-plan-2020",
        "event_type": "transfer",
        "event_status": "announced",
        "event_date": "2020-12-07",
        "event_date_precision": "day",
        "participants": [
          "2939c16f-1938-5629-928c-b36b1d5cd6ed",
          "38cd1cad-3e34-5511-bc35-a091ece74e11",
          "926abc78-1e79-55c6-b24a-d33b4e5f6443"
        ],
        "from_facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "China",
        "source_ids": [
          "src_smithsonian_agreement_2020"
        ],
        "changes_current_residency": false
      },
      {
        "id": "event-smithsonian-departure-2023",
        "event_type": "transfer",
        "event_status": "completed",
        "event_date": "2023-11-08",
        "event_date_precision": "day",
        "participants": [
          "2939c16f-1938-5629-928c-b36b1d5cd6ed",
          "38cd1cad-3e34-5511-bc35-a091ece74e11",
          "926abc78-1e79-55c6-b24a-d33b4e5f6443"
        ],
        "from_facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "China",
        "source_ids": [
          "src_smithsonian_history"
        ],
        "changes_current_residency": true
      }
    ],
    "record_tier": "complete_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "曾生活于史密森国家动物园的雌性大熊猫，是泰山、宝宝、贝贝和小奇迹的母亲。"
      },
      {
        "locale": "en",
        "summary": "Former Smithsonian female and mother of Tai Shan, Bao Bao, Bei Bei, and Xiao Qi Ji."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.14.1",
      "public_schema_version": "1.0.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "完成身份、出生日期、居住记录、迁移事件与公开来源的首轮整理。"
        },
        {
          "locale": "en",
          "summary": "First public review of identity, birth date, residencies, transfer events, and sources."
        }
      ]
    }
  },
  {
    "id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "slug": "tian-tian",
    "name_zh": "添添",
    "name_en": "Tian Tian",
    "gender": "male",
    "status": "alive",
    "birth_date": "1997-08-27",
    "current_location": "China",
    "cover_image_url": null,
    "search_terms": [
      "tian-tian",
      "添添",
      "Tian Tian",
      "Tiāntiān",
      "Tian-Tian",
      "tiantian",
      "tian_tian",
      "smithsonian_history_key:tian-tian"
    ],
    "intro": "曾生活于史密森国家动物园的雄性大熊猫，是泰山、宝宝、贝贝和小奇迹的父亲。",
    "birthplace": null,
    "tags": [
      "trusted-identity",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": null,
    "habitats": [],
    "media": [],
    "identity": {
      "stable_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
      "canonical_slug": "tian-tian",
      "names": [
        {
          "value": "添添",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_smithsonian_history"
          ]
        },
        {
          "value": "Tian Tian",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_smithsonian_history"
          ]
        },
        {
          "value": "Tiāntiān",
          "language": "pinyin",
          "kind": "pinyin",
          "primary": true,
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ],
      "aliases": [
        {
          "value": "Tian-Tian",
          "language": "en",
          "kind": "historic_spelling",
          "primary": false,
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ],
      "legacy_slugs": [
        {
          "value": "tiantian",
          "source_ids": [
            "src_smithsonian_history"
          ]
        },
        {
          "value": "tian_tian",
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ],
      "external_identifiers": [
        {
          "system": "smithsonian_history_key",
          "value": "tian-tian",
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ]
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "1997-08-27",
        "status": "confirmed",
        "last_verified_at": "2026-05-09",
        "assertion_ids": [
          "fact-tian-tian-birth-date"
        ],
        "source_ids": [
          "src_smithsonian_agreement_2020"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "China",
        "status": "confirmed",
        "last_verified_at": "2026-05-09",
        "assertion_ids": [
          "fact-tian-tian-current-place"
        ],
        "source_ids": [
          "src_smithsonian_history"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_smithsonian_agreement_2020",
        "publisher": "Smithsonian National Zoo and Conservation Biology Institute",
        "title": "Smithsonian extends giant panda agreement",
        "url": "https://nationalzoo.si.edu/news/smithsonians-national-zoo-and-conservation-biology-institute-extends-giant-panda-agreement",
        "published_at": "2020-12-07",
        "last_verified_at": "2026-05-09",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_smithsonian_history",
        "publisher": "Smithsonian National Zoo and Conservation Biology Institute",
        "title": "History of Giant Pandas at the Smithsonian's National Zoo and Conservation Biology Institute",
        "url": "https://nationalzoo.si.edu/animals/history-giant-pandas-zoo",
        "published_at": null,
        "last_verified_at": "2026-05-09",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": {
      "facility_id": null,
      "coarse_location": "China",
      "status": "confirmed_country_level"
    },
    "residencies": [
      {
        "id": "res-tian-tian-smithsonian",
        "facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "2000-12-06",
        "start_precision": "day",
        "end_date": "2023-11-08",
        "end_precision": "day",
        "status": "confirmed",
        "source_ids": [
          "src_smithsonian_history"
        ]
      },
      {
        "id": "res-tian-tian-china",
        "facility_id": null,
        "coarse_location": "China",
        "residency_type": "primary",
        "start_date": "2023-11-08",
        "start_precision": "day",
        "end_date": null,
        "end_precision": null,
        "status": "confirmed_country_level",
        "source_ids": [
          "src_smithsonian_history"
        ]
      }
    ],
    "events": [
      {
        "id": "event-smithsonian-return-plan-2020",
        "event_type": "transfer",
        "event_status": "announced",
        "event_date": "2020-12-07",
        "event_date_precision": "day",
        "participants": [
          "2939c16f-1938-5629-928c-b36b1d5cd6ed",
          "38cd1cad-3e34-5511-bc35-a091ece74e11",
          "926abc78-1e79-55c6-b24a-d33b4e5f6443"
        ],
        "from_facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "China",
        "source_ids": [
          "src_smithsonian_agreement_2020"
        ],
        "changes_current_residency": false
      },
      {
        "id": "event-smithsonian-departure-2023",
        "event_type": "transfer",
        "event_status": "completed",
        "event_date": "2023-11-08",
        "event_date_precision": "day",
        "participants": [
          "2939c16f-1938-5629-928c-b36b1d5cd6ed",
          "38cd1cad-3e34-5511-bc35-a091ece74e11",
          "926abc78-1e79-55c6-b24a-d33b4e5f6443"
        ],
        "from_facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "China",
        "source_ids": [
          "src_smithsonian_history"
        ],
        "changes_current_residency": true
      }
    ],
    "record_tier": "complete_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "曾生活于史密森国家动物园的雄性大熊猫，是泰山、宝宝、贝贝和小奇迹的父亲。"
      },
      {
        "locale": "en",
        "summary": "Former Smithsonian male and father of Tai Shan, Bao Bao, Bei Bei, and Xiao Qi Ji."
      }
    ],
    "media_release": {
      "license_state": "source_link_only",
      "display_mode": "link_to_source",
      "source_ids": [
        "src_smithsonian_history"
      ]
    },
    "public_revision": {
      "data_version": "2026.07.14.1",
      "public_schema_version": "1.0.0",
      "summaries": []
    }
  }
];

export const TRUSTED_LINEAGE_NODES: PandaLineageNode[] = [
  {
    "id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "slug": "mei-xiang",
    "name_zh": "美香",
    "name_en": "Mei Xiang",
    "gender": "female",
    "status": "alive",
    "birth_date": "1998-07-22",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [],
    "intro": null,
    "tags": [
      "trusted-archive",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": null
  },
  {
    "id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "slug": "tian-tian",
    "name_zh": "添添",
    "name_en": "Tian Tian",
    "gender": "male",
    "status": "alive",
    "birth_date": "1997-08-27",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [],
    "intro": null,
    "tags": [
      "trusted-archive",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": null
  },
  {
    "id": "96d00a39-7865-55db-b5c2-f339ef692258",
    "slug": "tai-shan",
    "name_zh": "泰山",
    "name_en": "Tai Shan",
    "gender": "male",
    "status": "alive",
    "birth_date": null,
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [],
    "intro": null,
    "tags": [
      "trusted-archive",
      "golden-dataset"
    ],
    "father_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "mother_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed"
  },
  {
    "id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6",
    "slug": "bao-bao",
    "name_zh": "宝宝",
    "name_en": "Bao Bao",
    "gender": "female",
    "status": "alive",
    "birth_date": null,
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [],
    "intro": null,
    "tags": [
      "trusted-archive",
      "golden-dataset"
    ],
    "father_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "mother_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed"
  },
  {
    "id": "1a05a5dc-1926-5355-9d81-c2a43189d50b",
    "slug": "bei-bei",
    "name_zh": "贝贝",
    "name_en": "Bei Bei",
    "gender": "male",
    "status": "alive",
    "birth_date": null,
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [],
    "intro": null,
    "tags": [
      "trusted-archive",
      "golden-dataset"
    ],
    "father_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "mother_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed"
  },
  {
    "id": "926abc78-1e79-55c6-b24a-d33b4e5f6443",
    "slug": "xiao-qi-ji",
    "name_zh": "小奇迹",
    "name_en": "Xiao Qi Ji",
    "gender": "male",
    "status": "alive",
    "birth_date": null,
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [],
    "intro": null,
    "tags": [
      "trusted-archive",
      "golden-dataset"
    ],
    "father_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "mother_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed"
  },
  {
    "id": "434e10e3-7ba0-5de7-a59e-d3984524c58c",
    "slug": "bao-li",
    "name_zh": "宝力",
    "name_en": "Bao Li",
    "gender": "male",
    "status": "alive",
    "birth_date": null,
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [],
    "intro": null,
    "tags": [
      "trusted-archive",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6"
  }
];

export const TRUSTED_LINEAGE_EDGES: PandaLineageEdge[] = [
  {
    "parent_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "child_id": "96d00a39-7865-55db-b5c2-f339ef692258"
  },
  {
    "parent_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "child_id": "96d00a39-7865-55db-b5c2-f339ef692258"
  },
  {
    "parent_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "child_id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6"
  },
  {
    "parent_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "child_id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6"
  },
  {
    "parent_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "child_id": "1a05a5dc-1926-5355-9d81-c2a43189d50b"
  },
  {
    "parent_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "child_id": "1a05a5dc-1926-5355-9d81-c2a43189d50b"
  },
  {
    "parent_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "child_id": "926abc78-1e79-55c6-b24a-d33b4e5f6443"
  },
  {
    "parent_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "child_id": "926abc78-1e79-55c6-b24a-d33b4e5f6443"
  },
  {
    "parent_id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6",
    "child_id": "434e10e3-7ba0-5de7-a59e-d3984524c58c"
  }
];
