// Generated from contracts/golden-dataset/mei-xiang-family.v1.json.
// Run npm run generate:trusted-identity-aliases after changing trusted identity data.

import type { PandaDetail, PandaLineageEdge, PandaLineageNode } from "@/lib/types";

export interface TrustedPandaReference {
  id: string;
  slug: string;
}

export const TRUSTED_PANDA_REFERENCES: Readonly<Record<string, TrustedPandaReference>> = {
  "bao-bao": {
    "id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6",
    "slug": "bao-bao"
  },
  "bao-li": {
    "id": "434e10e3-7ba0-5de7-a59e-d3984524c58c",
    "slug": "bao-li"
  },
  "baobao-smithsonian": {
    "id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6",
    "slug": "bao-bao"
  },
  "baoli": {
    "id": "434e10e3-7ba0-5de7-a59e-d3984524c58c",
    "slug": "bao-li"
  },
  "bei-bei": {
    "id": "1a05a5dc-1926-5355-9d81-c2a43189d50b",
    "slug": "bei-bei"
  },
  "beibei": {
    "id": "1a05a5dc-1926-5355-9d81-c2a43189d50b",
    "slug": "bei-bei"
  },
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
  "tai-shan": {
    "id": "96d00a39-7865-55db-b5c2-f339ef692258",
    "slug": "tai-shan"
  },
  "taishan": {
    "id": "96d00a39-7865-55db-b5c2-f339ef692258",
    "slug": "tai-shan"
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
  },
  "xiao_qi_ji": {
    "id": "926abc78-1e79-55c6-b24a-d33b4e5f6443",
    "slug": "xiao-qi-ji"
  },
  "xiao-qi-ji": {
    "id": "926abc78-1e79-55c6-b24a-d33b4e5f6443",
    "slug": "xiao-qi-ji"
  },
  "xiaoqiji": {
    "id": "926abc78-1e79-55c6-b24a-d33b4e5f6443",
    "slug": "xiao-qi-ji"
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
      "data_version": "2026.07.14.2",
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
      },
      {
        "field": "sex",
        "value": "male",
        "status": "confirmed",
        "last_verified_at": "2026-05-09",
        "assertion_ids": [
          "fact-tian-tian-sex"
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
      "data_version": "2026.07.14.2",
      "public_schema_version": "1.0.0",
      "summaries": []
    }
  },
  {
    "id": "96d00a39-7865-55db-b5c2-f339ef692258",
    "slug": "tai-shan",
    "name_zh": "泰山",
    "name_en": "Tai Shan",
    "gender": "male",
    "status": "alive",
    "birth_date": "2005-07-09",
    "current_location": "China",
    "cover_image_url": null,
    "search_terms": [
      "tai-shan",
      "泰山",
      "Tai Shan",
      "Tàishān",
      "taishan",
      "smithsonian_history_key:tai-shan"
    ],
    "intro": "美香与添添之子，2005 年出生于史密森国家动物园，现有公开证据仅确认其已返回中国。",
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
      "stable_id": "96d00a39-7865-55db-b5c2-f339ef692258",
      "canonical_slug": "tai-shan",
      "names": [
        {
          "value": "泰山",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_smithsonian_history"
          ]
        },
        {
          "value": "Tai Shan",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_smithsonian_history"
          ]
        },
        {
          "value": "Tàishān",
          "language": "pinyin",
          "kind": "pinyin",
          "primary": true,
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [
        {
          "value": "taishan",
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ],
      "external_identifiers": [
        {
          "system": "smithsonian_history_key",
          "value": "tai-shan",
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ]
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2005-07-09",
        "status": "confirmed",
        "last_verified_at": "2026-05-09",
        "assertion_ids": [
          "fact-tai-shan-birth-date"
        ],
        "source_ids": [
          "src_smithsonian_history"
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
          "fact-tai-shan-current-place"
        ],
        "source_ids": [
          "src_smithsonian_history"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "male",
        "status": "confirmed",
        "last_verified_at": "2026-05-09",
        "assertion_ids": [
          "fact-tai-shan-sex"
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
        "id": "res-tai-shan-china-country-level",
        "facility_id": null,
        "coarse_location": "China",
        "residency_type": "primary",
        "start_date": "2010-02-04",
        "start_precision": "day",
        "end_date": null,
        "end_precision": null,
        "status": "confirmed_country_level",
        "source_ids": [
          "src_smithsonian_history"
        ]
      }
    ],
    "events": [],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "美香与添添之子，2005 年出生于史密森国家动物园，现有公开证据仅确认其已返回中国。"
      },
      {
        "locale": "en",
        "summary": "Son of Mei Xiang and Tian Tian, born at the Smithsonian in 2005; current public evidence confirms only his return to China."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.14.2",
      "public_schema_version": "1.0.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "完成身份、亲本、出生日期与国家级现居记录的公开整理。"
        },
        {
          "locale": "en",
          "summary": "Public review of identity, parentage, birth date, and country-level current residency."
        }
      ]
    }
  },
  {
    "id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6",
    "slug": "bao-bao",
    "name_zh": "宝宝",
    "name_en": "Bao Bao",
    "gender": "female",
    "status": "alive",
    "birth_date": "2013-08-23",
    "current_location": "China",
    "cover_image_url": null,
    "search_terms": [
      "bao-bao",
      "宝宝",
      "Bao Bao",
      "Bǎobǎo",
      "baobao-smithsonian",
      "smithsonian_history_key:bao-bao"
    ],
    "intro": "美香与添添之女，2013 年出生于史密森国家动物园，也是宝力的母亲。",
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
      "stable_id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6",
      "canonical_slug": "bao-bao",
      "names": [
        {
          "value": "宝宝",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_smithsonian_history"
          ]
        },
        {
          "value": "Bao Bao",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_smithsonian_history"
          ]
        },
        {
          "value": "Bǎobǎo",
          "language": "pinyin",
          "kind": "pinyin",
          "primary": true,
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [
        {
          "value": "baobao-smithsonian",
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ],
      "external_identifiers": [
        {
          "system": "smithsonian_history_key",
          "value": "bao-bao",
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ]
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2013-08-23",
        "status": "confirmed",
        "last_verified_at": "2026-05-09",
        "assertion_ids": [
          "fact-bao-bao-birth-date"
        ],
        "source_ids": [
          "src_smithsonian_history"
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
          "fact-bao-bao-current-place"
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
          "fact-bao-bao-sex"
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
        "id": "res-bao-bao-china-country-level",
        "facility_id": null,
        "coarse_location": "China",
        "residency_type": "primary",
        "start_date": "2017-02-21",
        "start_precision": "day",
        "end_date": null,
        "end_precision": null,
        "status": "confirmed_country_level",
        "source_ids": [
          "src_smithsonian_history"
        ]
      }
    ],
    "events": [],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "美香与添添之女，2013 年出生于史密森国家动物园，也是宝力的母亲。"
      },
      {
        "locale": "en",
        "summary": "Daughter of Mei Xiang and Tian Tian, born at the Smithsonian in 2013, and mother of Bao Li."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.14.2",
      "public_schema_version": "1.0.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "完成身份、亲本、出生日期、子代关系与国家级现居记录的公开整理。"
        },
        {
          "locale": "en",
          "summary": "Public review of identity, parentage, birth date, offspring relationship, and country-level current residency."
        }
      ]
    }
  },
  {
    "id": "1a05a5dc-1926-5355-9d81-c2a43189d50b",
    "slug": "bei-bei",
    "name_zh": "贝贝",
    "name_en": "Bei Bei",
    "gender": "male",
    "status": "alive",
    "birth_date": "2015-08-22",
    "current_location": "中国大熊猫保护研究中心卧龙神树坪基地",
    "cover_image_url": null,
    "search_terms": [
      "bei-bei",
      "贝贝",
      "Bei Bei",
      "Bèibèi",
      "beibei",
      "smithsonian_history_key:bei-bei"
    ],
    "intro": "美香与添添之子，2015 年出生于史密森国家动物园，现居卧龙神树坪基地。",
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
      "stable_id": "1a05a5dc-1926-5355-9d81-c2a43189d50b",
      "canonical_slug": "bei-bei",
      "names": [
        {
          "value": "贝贝",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_smithsonian_history"
          ]
        },
        {
          "value": "Bei Bei",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_smithsonian_history"
          ]
        },
        {
          "value": "Bèibèi",
          "language": "pinyin",
          "kind": "pinyin",
          "primary": true,
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [
        {
          "value": "beibei",
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ],
      "external_identifiers": [
        {
          "system": "smithsonian_history_key",
          "value": "bei-bei",
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ]
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2015-08-22",
        "status": "confirmed",
        "last_verified_at": "2026-05-09",
        "assertion_ids": [
          "fact-bei-bei-birth-date"
        ],
        "source_ids": [
          "src_smithsonian_history"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "Wolong Shenshuping Base",
        "status": "confirmed",
        "last_verified_at": "2026-05-10",
        "assertion_ids": [
          "fact-bei-bei-current-place"
        ],
        "source_ids": [
          "src_ccrcgp_2025_birthday_season"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "male",
        "status": "confirmed",
        "last_verified_at": "2026-05-09",
        "assertion_ids": [
          "fact-bei-bei-sex"
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
        "id": "src_smithsonian_history",
        "publisher": "Smithsonian National Zoo and Conservation Biology Institute",
        "title": "History of Giant Pandas at the Smithsonian's National Zoo and Conservation Biology Institute",
        "url": "https://nationalzoo.si.edu/animals/history-giant-pandas-zoo",
        "published_at": null,
        "last_verified_at": "2026-05-09",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_ccrcgp_2025_birthday_season",
        "publisher": "China.org.cn / Xinhua",
        "title": "前方高萌 卧龙神树坪基地举办大熊猫集体生日会",
        "url": "https://www.china.org.cn/2025-07/18/content_117984485_4.shtml",
        "published_at": "2025-07-18",
        "last_verified_at": "2026-05-10",
        "language": "zh-Hans",
        "access_state": "accessible"
      }
    ],
    "current_place": {
      "facility_id": "89f620b2-37d0-51ba-aafa-6844404a5b2c",
      "coarse_location": null,
      "status": "confirmed"
    },
    "residencies": [
      {
        "id": "res-bei-bei-shenshuping",
        "facility_id": "89f620b2-37d0-51ba-aafa-6844404a5b2c",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "2019-11-19",
        "start_precision": "day",
        "end_date": null,
        "end_precision": null,
        "status": "confirmed",
        "source_ids": [
          "src_ccrcgp_2025_birthday_season"
        ]
      }
    ],
    "events": [],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "美香与添添之子，2015 年出生于史密森国家动物园，现居卧龙神树坪基地。"
      },
      {
        "locale": "en",
        "summary": "Son of Mei Xiang and Tian Tian, born at the Smithsonian in 2015 and currently recorded at Wolong Shenshuping Base."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.14.2",
      "public_schema_version": "1.0.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "完成身份、亲本、出生日期与现居基地的公开整理。"
        },
        {
          "locale": "en",
          "summary": "Public review of identity, parentage, birth date, and current facility."
        }
      ]
    }
  },
  {
    "id": "926abc78-1e79-55c6-b24a-d33b4e5f6443",
    "slug": "xiao-qi-ji",
    "name_zh": "小奇迹",
    "name_en": "Xiao Qi Ji",
    "gender": "male",
    "status": "alive",
    "birth_date": "2020-08-21",
    "current_location": "中国大熊猫保护研究中心卧龙神树坪基地",
    "cover_image_url": null,
    "search_terms": [
      "xiao-qi-ji",
      "小奇迹",
      "Xiao Qi Ji",
      "Xiǎoqíjì",
      "xiaoqiji",
      "xiao_qi_ji",
      "smithsonian_history_key:xiao-qi-ji"
    ],
    "intro": "美香与添添之子，2020 年出生于史密森国家动物园，并于 2023 年随父母返回中国。",
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
      "stable_id": "926abc78-1e79-55c6-b24a-d33b4e5f6443",
      "canonical_slug": "xiao-qi-ji",
      "names": [
        {
          "value": "小奇迹",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_smithsonian_history"
          ]
        },
        {
          "value": "Xiao Qi Ji",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_smithsonian_history"
          ]
        },
        {
          "value": "Xiǎoqíjì",
          "language": "pinyin",
          "kind": "pinyin",
          "primary": true,
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [
        {
          "value": "xiaoqiji",
          "source_ids": [
            "src_smithsonian_history"
          ]
        },
        {
          "value": "xiao_qi_ji",
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ],
      "external_identifiers": [
        {
          "system": "smithsonian_history_key",
          "value": "xiao-qi-ji",
          "source_ids": [
            "src_smithsonian_history"
          ]
        }
      ]
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2020-08-21",
        "status": "confirmed",
        "last_verified_at": "2026-05-09",
        "assertion_ids": [
          "fact-xiao-qi-ji-birth-date"
        ],
        "source_ids": [
          "src_smithsonian_history"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "Wolong Shenshuping Base",
        "status": "confirmed",
        "last_verified_at": "2026-05-10",
        "assertion_ids": [
          "fact-xiao-qi-ji-current-place"
        ],
        "source_ids": [
          "src_ccrcgp_2025_birthday_season"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "male",
        "status": "confirmed",
        "last_verified_at": "2026-05-09",
        "assertion_ids": [
          "fact-xiao-qi-ji-sex"
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
      },
      {
        "id": "src_ccrcgp_2025_birthday_season",
        "publisher": "China.org.cn / Xinhua",
        "title": "前方高萌 卧龙神树坪基地举办大熊猫集体生日会",
        "url": "https://www.china.org.cn/2025-07/18/content_117984485_4.shtml",
        "published_at": "2025-07-18",
        "last_verified_at": "2026-05-10",
        "language": "zh-Hans",
        "access_state": "accessible"
      }
    ],
    "current_place": {
      "facility_id": "89f620b2-37d0-51ba-aafa-6844404a5b2c",
      "coarse_location": null,
      "status": "confirmed"
    },
    "residencies": [
      {
        "id": "res-xiao-qi-ji-shenshuping",
        "facility_id": "89f620b2-37d0-51ba-aafa-6844404a5b2c",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "2023-11-08",
        "start_precision": "day",
        "end_date": null,
        "end_precision": null,
        "status": "confirmed",
        "source_ids": [
          "src_ccrcgp_2025_birthday_season",
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
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "美香与添添之子，2020 年出生于史密森国家动物园，并于 2023 年随父母返回中国。"
      },
      {
        "locale": "en",
        "summary": "Son of Mei Xiang and Tian Tian, born at the Smithsonian in 2020 and returned to China with his parents in 2023."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.14.2",
      "public_schema_version": "1.0.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "完成身份、亲本、出生日期、多人回国事件与现居基地的公开整理。"
        },
        {
          "locale": "en",
          "summary": "Public review of identity, parentage, birth date, shared return event, and current facility."
        }
      ]
    }
  },
  {
    "id": "434e10e3-7ba0-5de7-a59e-d3984524c58c",
    "slug": "bao-li",
    "name_zh": "宝力",
    "name_en": "Bao Li",
    "gender": "male",
    "status": "alive",
    "birth_date": "2021-08-04",
    "current_location": "史密森国家动物园",
    "cover_image_url": null,
    "search_terms": [
      "bao-li",
      "宝力",
      "Bao Li",
      "Bǎolì",
      "baoli",
      "smithsonian_faq_key:bao-li"
    ],
    "intro": "宝宝之子，是美香与添添的外孙，现居史密森国家动物园。",
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
      "stable_id": "434e10e3-7ba0-5de7-a59e-d3984524c58c",
      "canonical_slug": "bao-li",
      "names": [
        {
          "value": "宝力",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_smithsonian_giant_panda_faq"
          ]
        },
        {
          "value": "Bao Li",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_smithsonian_giant_panda_faq"
          ]
        },
        {
          "value": "Bǎolì",
          "language": "pinyin",
          "kind": "pinyin",
          "primary": true,
          "source_ids": [
            "src_smithsonian_giant_panda_faq"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [
        {
          "value": "baoli",
          "source_ids": [
            "src_smithsonian_giant_panda_faq"
          ]
        }
      ],
      "external_identifiers": [
        {
          "system": "smithsonian_faq_key",
          "value": "bao-li",
          "source_ids": [
            "src_smithsonian_giant_panda_faq"
          ]
        }
      ]
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2021-08-04",
        "status": "confirmed",
        "last_verified_at": "2026-05-09",
        "assertion_ids": [
          "fact-bao-li-birth-date"
        ],
        "source_ids": [
          "src_smithsonian_giant_panda_faq"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "Smithsonian's National Zoo",
        "status": "confirmed",
        "last_verified_at": "2026-05-09",
        "assertion_ids": [
          "fact-bao-li-current-place"
        ],
        "source_ids": [
          "src_smithsonian_giant_panda_faq"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "male",
        "status": "confirmed",
        "last_verified_at": "2026-05-09",
        "assertion_ids": [
          "fact-bao-li-sex"
        ],
        "source_ids": [
          "src_smithsonian_giant_panda_faq"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_smithsonian_giant_panda_faq",
        "publisher": "Smithsonian National Zoo and Conservation Biology Institute",
        "title": "Giant Panda FAQs",
        "url": "https://nationalzoo.si.edu/animals/giant-panda-faqs",
        "published_at": null,
        "last_verified_at": "2026-05-09",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": {
      "facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
      "coarse_location": null,
      "status": "confirmed"
    },
    "residencies": [
      {
        "id": "res-bao-li-smithsonian",
        "facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "2024-10-15",
        "start_precision": "day",
        "end_date": null,
        "end_precision": null,
        "status": "confirmed",
        "source_ids": [
          "src_smithsonian_giant_panda_faq"
        ]
      }
    ],
    "events": [],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "宝宝之子，是美香与添添的外孙，现居史密森国家动物园。"
      },
      {
        "locale": "en",
        "summary": "Son of Bao Bao and grandson of Mei Xiang and Tian Tian, currently living at the Smithsonian's National Zoo."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.14.2",
      "public_schema_version": "1.0.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "完成三代身份、母系亲缘与现居机构的公开整理。"
        },
        {
          "locale": "en",
          "summary": "Public review of third-generation identity, maternal lineage, and current institution."
        }
      ]
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
    "birth_date": "2005-07-09",
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
    "birth_date": "2013-08-23",
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
    "birth_date": "2015-08-22",
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
    "birth_date": "2020-08-21",
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
    "birth_date": "2021-08-04",
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
