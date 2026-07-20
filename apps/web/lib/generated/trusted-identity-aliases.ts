// Generated from reviewed Public Release 2026.07.20.1.
// Run npm run generate:trusted-identity-aliases after changing trusted identity data.

import type { PandaDetail, PandaLineageEdge, PandaLineageNode, PublicFacilitySummary, PublicInstitutionSummary, PublicParentageAssertionSummary, PublicPlaceSummary } from "@/lib/types";

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
  "lun-lun": {
    "id": "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
    "slug": "lun-lun"
  },
  "lunlun": {
    "id": "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
    "slug": "lun-lun"
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
  },
  "ya-lun": {
    "id": "fa8a0c14-b937-5de5-ae65-482cfd744482",
    "slug": "ya-lun"
  },
  "yalun": {
    "id": "fa8a0c14-b937-5de5-ae65-482cfd744482",
    "slug": "ya-lun"
  },
  "yang-yang": {
    "id": "db108e44-8893-54e1-8cb5-8c5238b75089",
    "slug": "yang-yang"
  },
  "yangyang": {
    "id": "db108e44-8893-54e1-8cb5-8c5238b75089",
    "slug": "yang-yang"
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
      "status": "confirmed_country_level",
      "last_verified_at": "2026-05-09"
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
        "last_verified_at": null,
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
        "last_verified_at": "2026-05-09",
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
      "data_version": "2026.07.20.1",
      "public_schema_version": "1.2.0",
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
      "status": "confirmed_country_level",
      "last_verified_at": "2026-05-09"
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
        "last_verified_at": null,
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
        "last_verified_at": "2026-05-09",
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
      "data_version": "2026.07.20.1",
      "public_schema_version": "1.2.0",
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
    "father_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "mother_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
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
      "status": "confirmed_country_level",
      "last_verified_at": "2026-05-09"
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
        "last_verified_at": "2026-05-09",
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
      "data_version": "2026.07.20.1",
      "public_schema_version": "1.2.0",
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
    "father_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "mother_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
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
      "status": "confirmed_country_level",
      "last_verified_at": "2026-05-09"
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
        "last_verified_at": "2026-05-09",
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
      "data_version": "2026.07.20.1",
      "public_schema_version": "1.2.0",
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
    "father_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "mother_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
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
      "status": "confirmed",
      "last_verified_at": "2026-05-10"
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
        "last_verified_at": "2026-05-10",
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
      "data_version": "2026.07.20.1",
      "public_schema_version": "1.2.0",
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
    "father_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "mother_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
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
      "status": "confirmed",
      "last_verified_at": "2026-05-10"
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
        "last_verified_at": "2026-05-10",
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
      "data_version": "2026.07.20.1",
      "public_schema_version": "1.2.0",
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
    "mother_id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6",
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
      "status": "confirmed",
      "last_verified_at": "2026-05-09"
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
        "last_verified_at": "2026-05-09",
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
      "data_version": "2026.07.20.1",
      "public_schema_version": "1.2.0",
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
  },
  {
    "id": "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
    "slug": "lun-lun",
    "name_zh": "伦伦",
    "name_en": "Lun Lun",
    "gender": "female",
    "status": "alive",
    "birth_date": "1997-08-25",
    "current_location": "成都大熊猫繁育研究基地",
    "cover_image_url": "https://api.zhipanda.com/media/releases/2026.07.20.1/media-lun-lun-a089c7f24bdfbc26-w1200.webp",
    "search_terms": [
      "lun-lun",
      "伦伦",
      "Lun Lun",
      "lunlun",
      "zoo_atlanta_profile_key:lun-lun"
    ],
    "intro": "曾生活于亚特兰大动物园的雌性大熊猫，是七只幼崽的母亲，2024 年返回成都基地。",
    "birthplace": null,
    "tags": [
      "trusted-identity",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": null,
    "habitats": [],
    "media": [
      {
        "id": "media-lun-lun-a089c7f24bdfbc26",
        "panda_id": "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
        "url": "https://api.zhipanda.com/media/releases/2026.07.20.1/media-lun-lun-a089c7f24bdfbc26-w1200.webp",
        "source_url": "https://commons.wikimedia.org/wiki/File:Lun_Lun_at_Zoo_Atlanta.jpg",
        "rights": "CC BY-SA 4.0",
        "credit": "O01326 / Wikimedia Commons",
        "alt_zh": "伦伦坐在亚特兰大动物园的木质栖架旁",
        "alt_en": "Lun Lun sitting beside a wooden habitat structure at Zoo Atlanta",
        "status": "available",
        "sha256": "a8e714b320935368572d87b1fb6bd7a754eabf906e4b537acf498ec13f8b63b1",
        "mime_type": "image/webp",
        "width": 1200,
        "height": 800,
        "bytes": 130622,
        "derivatives": [
          {
            "bytes": 34690,
            "height": 320,
            "kind": "width-480",
            "mime_type": "image/webp",
            "sha256": "be926c7f103a290d67c611c26b68e7249e1a7521a9a4f9cee39852f21a88d91c",
            "url": "https://api.zhipanda.com/media/releases/2026.07.20.1/media-lun-lun-a089c7f24bdfbc26-w480.webp",
            "width": 480
          },
          {
            "bytes": 130622,
            "height": 800,
            "kind": "width-1200",
            "mime_type": "image/webp",
            "sha256": "a8e714b320935368572d87b1fb6bd7a754eabf906e4b537acf498ec13f8b63b1",
            "url": "https://api.zhipanda.com/media/releases/2026.07.20.1/media-lun-lun-a089c7f24bdfbc26-w1200.webp",
            "width": 1200
          }
        ],
        "source_ids": [
          "src_commons_lun_lun_photo"
        ]
      }
    ],
    "identity": {
      "stable_id": "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
      "canonical_slug": "lun-lun",
      "names": [
        {
          "value": "伦伦",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_zooatlanta_lun_lun",
            "src_zooatlanta_arrival_china_2024"
          ]
        },
        {
          "value": "Lun Lun",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_zooatlanta_lun_lun",
            "src_zooatlanta_arrival_china_2024"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [
        {
          "value": "lunlun",
          "source_ids": [
            "src_zooatlanta_lun_lun"
          ]
        }
      ],
      "external_identifiers": [
        {
          "system": "zoo_atlanta_profile_key",
          "value": "lun-lun",
          "source_ids": [
            "src_zooatlanta_lun_lun"
          ]
        }
      ]
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "1997-08-25",
        "status": "confirmed",
        "last_verified_at": "2026-07-20",
        "assertion_ids": [
          "fact-lun-lun-birth-date"
        ],
        "source_ids": [
          "src_zooatlanta_lun_lun"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_facility",
        "value": "Chengdu Research Base of Giant Panda Breeding",
        "status": "confirmed",
        "last_verified_at": "2026-07-20",
        "assertion_ids": [
          "fact-lun-lun-current-place"
        ],
        "source_ids": [
          "src_zooatlanta_lun_lun",
          "src_zooatlanta_arrival_china_2024"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "female",
        "status": "confirmed",
        "last_verified_at": "2026-07-20",
        "assertion_ids": [
          "fact-lun-lun-sex"
        ],
        "source_ids": [
          "src_zooatlanta_lun_lun"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_commons_lun_lun_photo",
        "publisher": "Wikimedia Commons",
        "title": "Lun Lun at Zoo Atlanta",
        "url": "https://commons.wikimedia.org/wiki/File:Lun_Lun_at_Zoo_Atlanta.jpg",
        "published_at": "2022-02-08",
        "last_verified_at": "2026-07-20",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_zooatlanta_arrival_china_2024",
        "publisher": "Zoo Atlanta",
        "title": "Giant Pandas Have Arrived in China",
        "url": "https://zooatlanta.org/press-release/giant-pandas-have-arrived-in-china/",
        "published_at": "2024-10-13",
        "last_verified_at": "2026-07-20",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_zooatlanta_lun_lun",
        "publisher": "Zoo Atlanta",
        "title": "Lun Lun",
        "url": "https://zooatlanta.org/animal-legend/lun-lun/",
        "published_at": null,
        "last_verified_at": "2026-05-09",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_zooatlanta_yang_yang",
        "publisher": "Zoo Atlanta",
        "title": "Yang Yang",
        "url": "https://zooatlanta.org/animal-legend/yang-yang/",
        "published_at": null,
        "last_verified_at": "2026-05-09",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": {
      "facility_id": "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0",
      "coarse_location": null,
      "status": "confirmed",
      "last_verified_at": "2026-07-20"
    },
    "residencies": [
      {
        "id": "res-lun-lun-zoo-atlanta",
        "facility_id": "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "1999-11-05",
        "start_precision": "day",
        "end_date": "2024-10-12",
        "end_precision": "day",
        "status": "confirmed",
        "last_verified_at": null,
        "source_ids": [
          "src_zooatlanta_lun_lun"
        ]
      },
      {
        "id": "res-lun-lun-chengdu",
        "facility_id": "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "2024-10-13",
        "start_precision": "day",
        "end_date": null,
        "end_precision": null,
        "status": "confirmed",
        "last_verified_at": "2026-07-20",
        "source_ids": [
          "src_zooatlanta_lun_lun",
          "src_zooatlanta_arrival_china_2024"
        ]
      }
    ],
    "events": [
      {
        "id": "event-lun-lun-birth",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "1997-08-25",
        "event_date_precision": "day",
        "participants": [
          "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0",
        "to_coarse_location": null,
        "source_ids": [
          "src_zooatlanta_lun_lun"
        ],
        "changes_current_residency": false
      },
      {
        "id": "event-zoo-atlanta-pair-arrival-1999",
        "event_type": "arrival",
        "event_status": "completed",
        "event_date": "1999-11-05",
        "event_date_precision": "day",
        "participants": [
          "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
          "db108e44-8893-54e1-8cb5-8c5238b75089"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2",
        "to_coarse_location": null,
        "source_ids": [
          "src_zooatlanta_lun_lun",
          "src_zooatlanta_yang_yang"
        ],
        "changes_current_residency": false
      },
      {
        "id": "event-zoo-atlanta-return-2024",
        "event_type": "transfer",
        "event_status": "completed",
        "event_date": "2024-10-12",
        "event_date_precision": "day",
        "participants": [
          "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
          "db108e44-8893-54e1-8cb5-8c5238b75089",
          "fa8a0c14-b937-5de5-ae65-482cfd744482"
        ],
        "from_facility_id": "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2",
        "from_coarse_location": null,
        "to_facility_id": "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0",
        "to_coarse_location": null,
        "source_ids": [
          "src_zooatlanta_arrival_china_2024"
        ],
        "changes_current_residency": true
      }
    ],
    "record_tier": "complete_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "曾生活于亚特兰大动物园的雌性大熊猫，是七只幼崽的母亲，2024 年返回成都基地。"
      },
      {
        "locale": "en",
        "summary": "Former Zoo Atlanta female, mother of seven cubs; returned to Chengdu in 2024."
      }
    ],
    "media_release": {
      "license_state": "licensed",
      "display_mode": "gallery",
      "source_ids": [
        "src_commons_lun_lun_photo"
      ]
    },
    "public_revision": {
      "data_version": "2026.07.20.1",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "完成身份、出生、居住、事件、亲缘与授权照片的首轮公开整理。"
        },
        {
          "locale": "en",
          "summary": "Reviewed identity, birth, residency, events, lineage, and media."
        }
      ]
    }
  },
  {
    "id": "db108e44-8893-54e1-8cb5-8c5238b75089",
    "slug": "yang-yang",
    "name_zh": "洋洋",
    "name_en": "Yang Yang",
    "gender": "male",
    "status": "alive",
    "birth_date": "1997-09-09",
    "current_location": "成都大熊猫繁育研究基地",
    "cover_image_url": "https://api.zhipanda.com/media/releases/2026.07.20.1/media-yang-yang-8e30a6c81892cbde-w1200.webp",
    "search_terms": [
      "yang-yang",
      "洋洋",
      "Yang Yang",
      "yangyang",
      "zoo_atlanta_profile_key:yang-yang"
    ],
    "intro": "曾生活于亚特兰大动物园的雄性大熊猫，是七只幼崽的父亲，2024 年返回成都基地。",
    "birthplace": null,
    "tags": [
      "trusted-identity",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": null,
    "habitats": [],
    "media": [
      {
        "id": "media-yang-yang-8e30a6c81892cbde",
        "panda_id": "db108e44-8893-54e1-8cb5-8c5238b75089",
        "url": "https://api.zhipanda.com/media/releases/2026.07.20.1/media-yang-yang-8e30a6c81892cbde-w1200.webp",
        "source_url": "https://commons.wikimedia.org/wiki/File:Yang_Yang_at_Zoo_Atlanta.jpg",
        "rights": "CC BY-SA 4.0",
        "credit": "O01326 / Wikimedia Commons",
        "alt_zh": "洋洋在亚特兰大动物园的栖息地内休息",
        "alt_en": "Yang Yang resting in his habitat at Zoo Atlanta",
        "status": "available",
        "sha256": "27fc253e44cdc6b908e0d48b933de1bd0b078a4c511abcab1c681cc412148976",
        "mime_type": "image/webp",
        "width": 1200,
        "height": 800,
        "bytes": 106314,
        "derivatives": [
          {
            "bytes": 23356,
            "height": 320,
            "kind": "width-480",
            "mime_type": "image/webp",
            "sha256": "29994d619b7d21af748b2ce87af3fc8839797923facda6c115febfa9e9c239fa",
            "url": "https://api.zhipanda.com/media/releases/2026.07.20.1/media-yang-yang-8e30a6c81892cbde-w480.webp",
            "width": 480
          },
          {
            "bytes": 106314,
            "height": 800,
            "kind": "width-1200",
            "mime_type": "image/webp",
            "sha256": "27fc253e44cdc6b908e0d48b933de1bd0b078a4c511abcab1c681cc412148976",
            "url": "https://api.zhipanda.com/media/releases/2026.07.20.1/media-yang-yang-8e30a6c81892cbde-w1200.webp",
            "width": 1200
          }
        ],
        "source_ids": [
          "src_commons_yang_yang_photo"
        ]
      }
    ],
    "identity": {
      "stable_id": "db108e44-8893-54e1-8cb5-8c5238b75089",
      "canonical_slug": "yang-yang",
      "names": [
        {
          "value": "洋洋",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_zooatlanta_yang_yang",
            "src_zooatlanta_arrival_china_2024"
          ]
        },
        {
          "value": "Yang Yang",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_zooatlanta_yang_yang",
            "src_zooatlanta_arrival_china_2024"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [
        {
          "value": "yangyang",
          "source_ids": [
            "src_zooatlanta_yang_yang"
          ]
        }
      ],
      "external_identifiers": [
        {
          "system": "zoo_atlanta_profile_key",
          "value": "yang-yang",
          "source_ids": [
            "src_zooatlanta_yang_yang"
          ]
        }
      ]
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "1997-09-09",
        "status": "confirmed",
        "last_verified_at": "2026-07-20",
        "assertion_ids": [
          "fact-yang-yang-birth-date"
        ],
        "source_ids": [
          "src_zooatlanta_yang_yang"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_facility",
        "value": "Chengdu Research Base of Giant Panda Breeding",
        "status": "confirmed",
        "last_verified_at": "2026-07-20",
        "assertion_ids": [
          "fact-yang-yang-current-place"
        ],
        "source_ids": [
          "src_zooatlanta_yang_yang",
          "src_zooatlanta_arrival_china_2024"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "male",
        "status": "confirmed",
        "last_verified_at": "2026-07-20",
        "assertion_ids": [
          "fact-yang-yang-sex"
        ],
        "source_ids": [
          "src_zooatlanta_yang_yang"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_commons_yang_yang_photo",
        "publisher": "Wikimedia Commons",
        "title": "Yang Yang at Zoo Atlanta",
        "url": "https://commons.wikimedia.org/wiki/File:Yang_Yang_at_Zoo_Atlanta.jpg",
        "published_at": "2022-02-08",
        "last_verified_at": "2026-07-20",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_zooatlanta_arrival_china_2024",
        "publisher": "Zoo Atlanta",
        "title": "Giant Pandas Have Arrived in China",
        "url": "https://zooatlanta.org/press-release/giant-pandas-have-arrived-in-china/",
        "published_at": "2024-10-13",
        "last_verified_at": "2026-07-20",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_zooatlanta_lun_lun",
        "publisher": "Zoo Atlanta",
        "title": "Lun Lun",
        "url": "https://zooatlanta.org/animal-legend/lun-lun/",
        "published_at": null,
        "last_verified_at": "2026-05-09",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_zooatlanta_yang_yang",
        "publisher": "Zoo Atlanta",
        "title": "Yang Yang",
        "url": "https://zooatlanta.org/animal-legend/yang-yang/",
        "published_at": null,
        "last_verified_at": "2026-05-09",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": {
      "facility_id": "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0",
      "coarse_location": null,
      "status": "confirmed",
      "last_verified_at": "2026-07-20"
    },
    "residencies": [
      {
        "id": "res-yang-yang-zoo-atlanta",
        "facility_id": "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "1999-11-05",
        "start_precision": "day",
        "end_date": "2024-10-12",
        "end_precision": "day",
        "status": "confirmed",
        "last_verified_at": null,
        "source_ids": [
          "src_zooatlanta_yang_yang"
        ]
      },
      {
        "id": "res-yang-yang-chengdu",
        "facility_id": "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "2024-10-13",
        "start_precision": "day",
        "end_date": null,
        "end_precision": null,
        "status": "confirmed",
        "last_verified_at": "2026-07-20",
        "source_ids": [
          "src_zooatlanta_yang_yang",
          "src_zooatlanta_arrival_china_2024"
        ]
      }
    ],
    "events": [
      {
        "id": "event-yang-yang-birth",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "1997-09-09",
        "event_date_precision": "day",
        "participants": [
          "db108e44-8893-54e1-8cb5-8c5238b75089"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0",
        "to_coarse_location": null,
        "source_ids": [
          "src_zooatlanta_yang_yang"
        ],
        "changes_current_residency": false
      },
      {
        "id": "event-zoo-atlanta-pair-arrival-1999",
        "event_type": "arrival",
        "event_status": "completed",
        "event_date": "1999-11-05",
        "event_date_precision": "day",
        "participants": [
          "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
          "db108e44-8893-54e1-8cb5-8c5238b75089"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2",
        "to_coarse_location": null,
        "source_ids": [
          "src_zooatlanta_lun_lun",
          "src_zooatlanta_yang_yang"
        ],
        "changes_current_residency": false
      },
      {
        "id": "event-zoo-atlanta-return-2024",
        "event_type": "transfer",
        "event_status": "completed",
        "event_date": "2024-10-12",
        "event_date_precision": "day",
        "participants": [
          "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
          "db108e44-8893-54e1-8cb5-8c5238b75089",
          "fa8a0c14-b937-5de5-ae65-482cfd744482"
        ],
        "from_facility_id": "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2",
        "from_coarse_location": null,
        "to_facility_id": "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0",
        "to_coarse_location": null,
        "source_ids": [
          "src_zooatlanta_arrival_china_2024"
        ],
        "changes_current_residency": true
      }
    ],
    "record_tier": "complete_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "曾生活于亚特兰大动物园的雄性大熊猫，是七只幼崽的父亲，2024 年返回成都基地。"
      },
      {
        "locale": "en",
        "summary": "Former Zoo Atlanta male, father of seven cubs; returned to Chengdu in 2024."
      }
    ],
    "media_release": {
      "license_state": "licensed",
      "display_mode": "gallery",
      "source_ids": [
        "src_commons_yang_yang_photo"
      ]
    },
    "public_revision": {
      "data_version": "2026.07.20.1",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "完成身份、出生、居住、事件、亲缘与授权照片的首轮公开整理。"
        },
        {
          "locale": "en",
          "summary": "Reviewed identity, birth, residency, events, lineage, and media."
        }
      ]
    }
  },
  {
    "id": "fa8a0c14-b937-5de5-ae65-482cfd744482",
    "slug": "ya-lun",
    "name_zh": "雅伦",
    "name_en": "Ya Lun",
    "gender": "female",
    "status": "alive",
    "birth_date": "2016-09-03",
    "current_location": "成都大熊猫繁育研究基地",
    "cover_image_url": "https://api.zhipanda.com/media/releases/2026.07.20.1/media-ya-lun-4006c2e608f8e671-w1200.webp",
    "search_terms": [
      "ya-lun",
      "雅伦",
      "Ya Lun",
      "yalun",
      "zoo_atlanta_profile_key:ya-lun"
    ],
    "intro": "伦伦与洋洋之女，2016 年出生于亚特兰大动物园，2024 年返回成都基地。",
    "birthplace": null,
    "tags": [
      "trusted-identity",
      "golden-dataset"
    ],
    "father_id": "db108e44-8893-54e1-8cb5-8c5238b75089",
    "mother_id": "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
    "habitats": [],
    "media": [
      {
        "id": "media-ya-lun-4006c2e608f8e671",
        "panda_id": "fa8a0c14-b937-5de5-ae65-482cfd744482",
        "url": "https://api.zhipanda.com/media/releases/2026.07.20.1/media-ya-lun-4006c2e608f8e671-w1200.webp",
        "source_url": "https://commons.wikimedia.org/wiki/File:Ya_Lun_at_Zoo_Atlanta.jpg",
        "rights": "CC BY-SA 4.0",
        "credit": "O01326 / Wikimedia Commons",
        "alt_zh": "雅伦在亚特兰大动物园的栖息地内坐着",
        "alt_en": "Ya Lun sitting in her habitat at Zoo Atlanta",
        "status": "available",
        "sha256": "ed3da4dafc03ad635ca30302b4fad4aa5b0e00aca20b0fc5746d2946ec3a75ff",
        "mime_type": "image/webp",
        "width": 1200,
        "height": 800,
        "bytes": 113818,
        "derivatives": [
          {
            "bytes": 24312,
            "height": 320,
            "kind": "width-480",
            "mime_type": "image/webp",
            "sha256": "76fff6de4f34f0ba9b309990e4a2c744bab40fea27d1d1a38bae70343a7f2c7c",
            "url": "https://api.zhipanda.com/media/releases/2026.07.20.1/media-ya-lun-4006c2e608f8e671-w480.webp",
            "width": 480
          },
          {
            "bytes": 113818,
            "height": 800,
            "kind": "width-1200",
            "mime_type": "image/webp",
            "sha256": "ed3da4dafc03ad635ca30302b4fad4aa5b0e00aca20b0fc5746d2946ec3a75ff",
            "url": "https://api.zhipanda.com/media/releases/2026.07.20.1/media-ya-lun-4006c2e608f8e671-w1200.webp",
            "width": 1200
          }
        ],
        "source_ids": [
          "src_commons_ya_lun_photo"
        ]
      }
    ],
    "identity": {
      "stable_id": "fa8a0c14-b937-5de5-ae65-482cfd744482",
      "canonical_slug": "ya-lun",
      "names": [
        {
          "value": "雅伦",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_zooatlanta_cubs_birth",
            "src_zooatlanta_twins_names",
            "src_zooatlanta_arrival_china_2024"
          ]
        },
        {
          "value": "Ya Lun",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_zooatlanta_cubs_birth",
            "src_zooatlanta_twins_names",
            "src_zooatlanta_arrival_china_2024"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [
        {
          "value": "yalun",
          "source_ids": [
            "src_zooatlanta_cubs_birth"
          ]
        }
      ],
      "external_identifiers": [
        {
          "system": "zoo_atlanta_profile_key",
          "value": "ya-lun",
          "source_ids": [
            "src_zooatlanta_cubs_birth"
          ]
        }
      ]
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2016-09-03",
        "status": "confirmed",
        "last_verified_at": "2026-07-20",
        "assertion_ids": [
          "fact-ya-lun-birth-date"
        ],
        "source_ids": [
          "src_zooatlanta_cubs_birth",
          "src_zooatlanta_twins_names"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_facility",
        "value": "Chengdu Research Base of Giant Panda Breeding",
        "status": "confirmed",
        "last_verified_at": "2026-07-20",
        "assertion_ids": [
          "fact-ya-lun-current-place"
        ],
        "source_ids": [
          "src_zooatlanta_arrival_china_2024"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "female",
        "status": "confirmed",
        "last_verified_at": "2026-07-20",
        "assertion_ids": [
          "fact-ya-lun-sex"
        ],
        "source_ids": [
          "src_zooatlanta_twins_names"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_commons_ya_lun_photo",
        "publisher": "Wikimedia Commons",
        "title": "Ya Lun at Zoo Atlanta",
        "url": "https://commons.wikimedia.org/wiki/File:Ya_Lun_at_Zoo_Atlanta.jpg",
        "published_at": "2022-02-08",
        "last_verified_at": "2026-07-20",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_zooatlanta_2016_public_debut",
        "publisher": "Zoo Atlanta",
        "title": "Zoo Atlanta closes 2016",
        "url": "https://zooatlanta.org/press-release/zoo-atlanta-closes-2016/",
        "published_at": "2016-12-29",
        "last_verified_at": "2026-07-20",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_zooatlanta_arrival_china_2024",
        "publisher": "Zoo Atlanta",
        "title": "Giant Pandas Have Arrived in China",
        "url": "https://zooatlanta.org/press-release/giant-pandas-have-arrived-in-china/",
        "published_at": "2024-10-13",
        "last_verified_at": "2026-07-20",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_zooatlanta_cubs_birth",
        "publisher": "Zoo Atlanta",
        "title": "Lun Lun's Second Cub Has Been Born",
        "url": "https://zooatlanta.org/press-release/lun-luns-second-cub-has-been-born/",
        "published_at": "2016-09-03",
        "last_verified_at": "2026-05-09",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_zooatlanta_twins_names",
        "publisher": "Zoo Atlanta",
        "title": "Meet the Giant Panda Cub Twins",
        "url": "https://zooatlanta.org/meet-giant-panda-cub-twins-zoo-atlanta/",
        "published_at": "2017-04-03",
        "last_verified_at": "2026-05-09",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": {
      "facility_id": "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0",
      "coarse_location": null,
      "status": "confirmed",
      "last_verified_at": "2026-07-20"
    },
    "residencies": [
      {
        "id": "res-ya-lun-zoo-atlanta",
        "facility_id": "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "2016-09-03",
        "start_precision": "day",
        "end_date": "2024-10-12",
        "end_precision": "day",
        "status": "confirmed",
        "last_verified_at": null,
        "source_ids": [
          "src_zooatlanta_cubs_birth",
          "src_zooatlanta_twins_names"
        ]
      },
      {
        "id": "res-ya-lun-chengdu",
        "facility_id": "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "2024-10-13",
        "start_precision": "day",
        "end_date": null,
        "end_precision": null,
        "status": "confirmed",
        "last_verified_at": "2026-07-20",
        "source_ids": [
          "src_zooatlanta_arrival_china_2024"
        ]
      }
    ],
    "events": [
      {
        "id": "event-ya-lun-birth",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2016-09-03",
        "event_date_precision": "day",
        "participants": [
          "fa8a0c14-b937-5de5-ae65-482cfd744482"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2",
        "to_coarse_location": null,
        "source_ids": [
          "src_zooatlanta_cubs_birth",
          "src_zooatlanta_twins_names"
        ],
        "changes_current_residency": false
      },
      {
        "id": "event-ya-lun-public-debut",
        "event_type": "public_debut",
        "event_status": "completed",
        "event_date": "2016-12-27",
        "event_date_precision": "day",
        "participants": [
          "fa8a0c14-b937-5de5-ae65-482cfd744482"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2",
        "to_coarse_location": null,
        "source_ids": [
          "src_zooatlanta_2016_public_debut"
        ],
        "changes_current_residency": false
      },
      {
        "id": "event-zoo-atlanta-return-2024",
        "event_type": "transfer",
        "event_status": "completed",
        "event_date": "2024-10-12",
        "event_date_precision": "day",
        "participants": [
          "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
          "db108e44-8893-54e1-8cb5-8c5238b75089",
          "fa8a0c14-b937-5de5-ae65-482cfd744482"
        ],
        "from_facility_id": "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2",
        "from_coarse_location": null,
        "to_facility_id": "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0",
        "to_coarse_location": null,
        "source_ids": [
          "src_zooatlanta_arrival_china_2024"
        ],
        "changes_current_residency": true
      }
    ],
    "record_tier": "complete_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "伦伦与洋洋之女，2016 年出生于亚特兰大动物园，2024 年返回成都基地。"
      },
      {
        "locale": "en",
        "summary": "Daughter of Lun Lun and Yang Yang; born in Atlanta in 2016 and returned in 2024."
      }
    ],
    "media_release": {
      "license_state": "licensed",
      "display_mode": "gallery",
      "source_ids": [
        "src_commons_ya_lun_photo"
      ]
    },
    "public_revision": {
      "data_version": "2026.07.20.1",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "完成身份、出生、居住、事件、亲缘与授权照片的首轮公开整理。"
        },
        {
          "locale": "en",
          "summary": "Reviewed identity, birth, residency, events, lineage, and media."
        }
      ]
    }
  }
];

export const TRUSTED_INSTITUTIONS: PublicInstitutionSummary[] = [
  {
    "id": "institution-chengdu-research-base",
    "canonical_slug": "chengdu-research-base",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "Chengdu Research Base of Giant Panda Breeding",
        "kind": "official_translation"
      },
      {
        "language": "zh-Hans",
        "value": "成都大熊猫繁育研究基地",
        "kind": "official"
      }
    ],
    "institution_type": "conservation_center",
    "facility_ids": [
      "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0"
    ],
    "place_ids": [
      "place-chengdu-research-base"
    ],
    "source_ids": [
      "src_zooatlanta_arrival_china_2024"
    ],
    "last_verified_at": "2026-07-20",
    "revision_summaries": [
      {
        "locale": "zh-CN",
        "summary": "建立成都基地的机构与场所关系。"
      },
      {
        "locale": "en",
        "summary": "Established the Chengdu institution and place."
      }
    ]
  },
  {
    "id": "institution-ccrcgp",
    "canonical_slug": "china-conservation-and-research-center-for-the-giant-panda",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "China Conservation and Research Center for the Giant Panda",
        "kind": "official_translation"
      },
      {
        "language": "zh-Hans",
        "value": "中国大熊猫保护研究中心",
        "kind": "official"
      }
    ],
    "institution_type": "conservation_center",
    "facility_ids": [
      "89f620b2-37d0-51ba-aafa-6844404a5b2c"
    ],
    "place_ids": [
      "place-wolong-shenshuping-base"
    ],
    "source_ids": [
      "src_ccrcgp_2025_birthday_season"
    ],
    "last_verified_at": "2026-05-10",
    "revision_summaries": [
      {
        "locale": "zh-CN",
        "summary": "建立保护研究机构与神树坪基地的显式组织—场所关系。"
      },
      {
        "locale": "en",
        "summary": "Introduced the explicit organization-to-place relationship for the conservation center and Shenshuping Base."
      }
    ]
  },
  {
    "id": "institution-smithsonian-national-zoo",
    "canonical_slug": "smithsonian-national-zoo",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "Smithsonian's National Zoo",
        "kind": "official"
      },
      {
        "language": "zh-Hans",
        "value": "史密森国家动物园",
        "kind": "translated"
      }
    ],
    "institution_type": "zoo",
    "facility_ids": [
      "afb0f227-dd5e-5076-88e3-74e9807a6049"
    ],
    "place_ids": [
      "place-smithsonian-national-zoo-dc"
    ],
    "source_ids": [
      "src_smithsonian_history",
      "src_smithsonian_giant_panda_faq"
    ],
    "last_verified_at": "2026-05-09",
    "revision_summaries": [
      {
        "locale": "zh-CN",
        "summary": "建立机构身份、关联园区、驻留与迁移来源的首轮公开记录。"
      },
      {
        "locale": "en",
        "summary": "First public record of institution identity, associated campus, residencies, and migration sources."
      }
    ]
  },
  {
    "id": "institution-zoo-atlanta",
    "canonical_slug": "zoo-atlanta",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "Zoo Atlanta",
        "kind": "official"
      },
      {
        "language": "zh-Hans",
        "value": "亚特兰大动物园",
        "kind": "translated"
      }
    ],
    "institution_type": "zoo",
    "facility_ids": [
      "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2"
    ],
    "place_ids": [
      "place-zoo-atlanta"
    ],
    "source_ids": [
      "src_zooatlanta_lun_lun",
      "src_zooatlanta_yang_yang"
    ],
    "last_verified_at": "2026-07-20",
    "revision_summaries": [
      {
        "locale": "zh-CN",
        "summary": "建立亚特兰大动物园的机构与园区关系。"
      },
      {
        "locale": "en",
        "summary": "Established the Zoo Atlanta institution and campus."
      }
    ]
  }
];

export const TRUSTED_PLACES: PublicPlaceSummary[] = [
  {
    "id": "place-chengdu-research-base",
    "canonical_slug": "chengdu-research-base-chengdu-sichuan",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan",
        "kind": "display"
      },
      {
        "language": "zh-Hans",
        "value": "成都大熊猫繁育研究基地（四川成都）",
        "kind": "display"
      }
    ],
    "country_code": "CN",
    "locality": "Chengdu, Sichuan",
    "precision": "locality",
    "place_type": "conservation_base",
    "facility_ids": [
      "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0"
    ],
    "institution_ids": [
      "institution-chengdu-research-base"
    ],
    "source_ids": [
      "src_zooatlanta_arrival_china_2024"
    ],
    "last_verified_at": "2026-07-20",
    "revision_summaries": [
      {
        "locale": "zh-CN",
        "summary": "以城市级精度发布成都基地。"
      },
      {
        "locale": "en",
        "summary": "Published the Chengdu base at locality precision."
      }
    ]
  },
  {
    "id": "place-smithsonian-national-zoo-dc",
    "canonical_slug": "smithsonian-national-zoo-washington-dc",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "Smithsonian's National Zoo, Washington, D.C.",
        "kind": "display"
      },
      {
        "language": "zh-Hans",
        "value": "史密森国家动物园（华盛顿特区园区）",
        "kind": "translated"
      }
    ],
    "country_code": "US",
    "locality": "Washington, D.C.",
    "precision": "locality",
    "place_type": "zoo_campus",
    "facility_ids": [
      "afb0f227-dd5e-5076-88e3-74e9807a6049"
    ],
    "institution_ids": [
      "institution-smithsonian-national-zoo"
    ],
    "source_ids": [
      "src_smithsonian_history",
      "src_smithsonian_giant_panda_faq"
    ],
    "last_verified_at": "2026-05-09",
    "revision_summaries": [
      {
        "locale": "zh-CN",
        "summary": "以城市级精度发布华盛顿特区园区，不补造精确坐标。"
      },
      {
        "locale": "en",
        "summary": "Published the Washington, D.C. campus at locality precision without inferred coordinates."
      }
    ]
  },
  {
    "id": "place-wolong-shenshuping-base",
    "canonical_slug": "wolong-shenshuping-base",
    "legacy_slugs": [
      "ccrcgp-wolong-shenshuping-base"
    ],
    "names": [
      {
        "language": "en",
        "value": "Wolong Shenshuping Base",
        "kind": "display"
      },
      {
        "language": "zh-Hans",
        "value": "卧龙神树坪基地",
        "kind": "official_short"
      }
    ],
    "country_code": "CN",
    "locality": "Wolong, Sichuan",
    "precision": "locality",
    "place_type": "conservation_base",
    "facility_ids": [
      "89f620b2-37d0-51ba-aafa-6844404a5b2c"
    ],
    "institution_ids": [
      "institution-ccrcgp"
    ],
    "source_ids": [
      "src_ccrcgp_2025_birthday_season"
    ],
    "last_verified_at": "2026-05-10",
    "revision_summaries": [
      {
        "locale": "zh-CN",
        "summary": "以卧龙、四川的地区级精度发布神树坪基地，不推断精确位置。"
      },
      {
        "locale": "en",
        "summary": "Published Shenshuping Base at Wolong, Sichuan locality precision without inferring an exact position."
      }
    ]
  },
  {
    "id": "place-zoo-atlanta",
    "canonical_slug": "zoo-atlanta-atlanta-georgia",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "Zoo Atlanta, Atlanta, Georgia",
        "kind": "display"
      },
      {
        "language": "zh-Hans",
        "value": "亚特兰大动物园（美国佐治亚州）",
        "kind": "translated"
      }
    ],
    "country_code": "US",
    "locality": "Atlanta, Georgia",
    "precision": "locality",
    "place_type": "zoo_campus",
    "facility_ids": [
      "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2"
    ],
    "institution_ids": [
      "institution-zoo-atlanta"
    ],
    "source_ids": [
      "src_zooatlanta_lun_lun",
      "src_zooatlanta_yang_yang"
    ],
    "last_verified_at": "2026-07-20",
    "revision_summaries": [
      {
        "locale": "zh-CN",
        "summary": "以城市级精度发布亚特兰大园区。"
      },
      {
        "locale": "en",
        "summary": "Published the Atlanta campus at locality precision."
      }
    ]
  }
];

export const TRUSTED_FACILITIES: PublicFacilitySummary[] = [
  {
    "id": "60c7e1a3-d286-5366-8d41-32c11df58b5c",
    "canonical_slug": "ccrcgp-wolong-gengda-base",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "CCRCGP Wolong Gengda Base",
        "kind": "display"
      },
      {
        "language": "zh-Hans",
        "value": "中国大熊猫保护研究中心卧龙耿达基地",
        "kind": "display"
      }
    ],
    "institution_type": null,
    "facility_ids": [
      "60c7e1a3-d286-5366-8d41-32c11df58b5c"
    ],
    "place_ids": [],
    "source_ids": [],
    "last_verified_at": null,
    "revision_summaries": [],
    "country_code": "CN",
    "locality": "Wolong, Sichuan",
    "facility_type": "conservation_center"
  },
  {
    "id": "89f620b2-37d0-51ba-aafa-6844404a5b2c",
    "canonical_slug": "ccrcgp-wolong-shenshuping-base",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "CCRCGP Wolong Shenshuping Base",
        "kind": "display"
      },
      {
        "language": "zh-Hans",
        "value": "中国大熊猫保护研究中心卧龙神树坪基地",
        "kind": "display"
      }
    ],
    "institution_type": "conservation_center",
    "facility_ids": [
      "89f620b2-37d0-51ba-aafa-6844404a5b2c"
    ],
    "place_ids": [
      "place-wolong-shenshuping-base"
    ],
    "source_ids": [
      "src_ccrcgp_2025_birthday_season"
    ],
    "last_verified_at": "2026-05-10",
    "revision_summaries": [
      {
        "locale": "zh-CN",
        "summary": "建立保护研究机构与神树坪基地的显式组织—场所关系。"
      },
      {
        "locale": "en",
        "summary": "Introduced the explicit organization-to-place relationship for the conservation center and Shenshuping Base."
      }
    ],
    "country_code": "CN",
    "locality": "Wolong, Sichuan",
    "facility_type": "conservation_center"
  },
  {
    "id": "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0",
    "canonical_slug": "chengdu-research-base",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "Chengdu Research Base of Giant Panda Breeding",
        "kind": "official_translation"
      },
      {
        "language": "zh-Hans",
        "value": "成都大熊猫繁育研究基地",
        "kind": "official"
      }
    ],
    "institution_type": "conservation_center",
    "facility_ids": [
      "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0"
    ],
    "place_ids": [
      "place-chengdu-research-base"
    ],
    "source_ids": [
      "src_zooatlanta_arrival_china_2024"
    ],
    "last_verified_at": "2026-07-20",
    "revision_summaries": [
      {
        "locale": "zh-CN",
        "summary": "建立成都基地的机构与场所关系。"
      },
      {
        "locale": "en",
        "summary": "Established the Chengdu institution and place."
      }
    ],
    "country_code": "CN",
    "locality": "Chengdu, Sichuan",
    "facility_type": "conservation_center"
  },
  {
    "id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
    "canonical_slug": "smithsonian-national-zoo",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "Smithsonian's National Zoo",
        "kind": "official"
      },
      {
        "language": "zh-Hans",
        "value": "史密森国家动物园",
        "kind": "translated"
      }
    ],
    "institution_type": "zoo",
    "facility_ids": [
      "afb0f227-dd5e-5076-88e3-74e9807a6049"
    ],
    "place_ids": [
      "place-smithsonian-national-zoo-dc"
    ],
    "source_ids": [
      "src_smithsonian_history",
      "src_smithsonian_giant_panda_faq"
    ],
    "last_verified_at": "2026-05-09",
    "revision_summaries": [
      {
        "locale": "zh-CN",
        "summary": "建立机构身份、关联园区、驻留与迁移来源的首轮公开记录。"
      },
      {
        "locale": "en",
        "summary": "First public record of institution identity, associated campus, residencies, and migration sources."
      }
    ],
    "country_code": "US",
    "locality": "Washington, D.C.",
    "facility_type": "zoo"
  },
  {
    "id": "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2",
    "canonical_slug": "zoo-atlanta",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "Zoo Atlanta",
        "kind": "official"
      },
      {
        "language": "zh-Hans",
        "value": "亚特兰大动物园",
        "kind": "translated"
      }
    ],
    "institution_type": "zoo",
    "facility_ids": [
      "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2"
    ],
    "place_ids": [
      "place-zoo-atlanta"
    ],
    "source_ids": [
      "src_zooatlanta_lun_lun",
      "src_zooatlanta_yang_yang"
    ],
    "last_verified_at": "2026-07-20",
    "revision_summaries": [
      {
        "locale": "zh-CN",
        "summary": "建立亚特兰大动物园的机构与园区关系。"
      },
      {
        "locale": "en",
        "summary": "Established the Zoo Atlanta institution and campus."
      }
    ],
    "country_code": "US",
    "locality": "Atlanta, Georgia",
    "facility_type": "zoo"
  }
];

export const TRUSTED_PARENTAGE_ASSERTIONS: PublicParentageAssertionSummary[] = [
  {
    "id": "parent-bao-bao-father",
    "child_id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6",
    "parent_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "role": "father",
    "status": "confirmed",
    "source_ids": [
      "src_smithsonian_agreement_2020"
    ]
  },
  {
    "id": "parent-bao-bao-mother",
    "child_id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6",
    "parent_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "role": "mother",
    "status": "confirmed",
    "source_ids": [
      "src_smithsonian_agreement_2020"
    ]
  },
  {
    "id": "parent-bao-li-father",
    "child_id": "434e10e3-7ba0-5de7-a59e-d3984524c58c",
    "parent_id": "d91afc69-20eb-59dd-ae56-8c8562ab03b3",
    "role": "father",
    "status": "tentative",
    "source_ids": [
      "src_smithsonian_giant_panda_faq"
    ]
  },
  {
    "id": "parent-bao-li-mother",
    "child_id": "434e10e3-7ba0-5de7-a59e-d3984524c58c",
    "parent_id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6",
    "role": "mother",
    "status": "confirmed",
    "source_ids": [
      "src_smithsonian_giant_panda_faq"
    ]
  },
  {
    "id": "parent-bei-bei-father",
    "child_id": "1a05a5dc-1926-5355-9d81-c2a43189d50b",
    "parent_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "role": "father",
    "status": "confirmed",
    "source_ids": [
      "src_smithsonian_agreement_2020"
    ]
  },
  {
    "id": "parent-bei-bei-mother",
    "child_id": "1a05a5dc-1926-5355-9d81-c2a43189d50b",
    "parent_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "role": "mother",
    "status": "confirmed",
    "source_ids": [
      "src_smithsonian_agreement_2020"
    ]
  },
  {
    "id": "parent-tai-shan-father",
    "child_id": "96d00a39-7865-55db-b5c2-f339ef692258",
    "parent_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "role": "father",
    "status": "confirmed",
    "source_ids": [
      "src_smithsonian_agreement_2020"
    ]
  },
  {
    "id": "parent-tai-shan-mother",
    "child_id": "96d00a39-7865-55db-b5c2-f339ef692258",
    "parent_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "role": "mother",
    "status": "confirmed",
    "source_ids": [
      "src_smithsonian_agreement_2020"
    ]
  },
  {
    "id": "parent-tian-tian-father",
    "child_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "parent_id": "b53e84dd-31f1-56a8-b8dd-ab0b75dc7a1a",
    "role": "father",
    "status": "tentative",
    "source_ids": [
      "src_gpg_yongba_death"
    ]
  },
  {
    "id": "parent-tian-tian-mother",
    "child_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "parent_id": "35f40679-1253-58f4-a2c5-7669ea81cf6e",
    "role": "mother",
    "status": "tentative",
    "source_ids": [
      "src_gpg_yongba_death"
    ]
  },
  {
    "id": "parent-xiao-qi-ji-father",
    "child_id": "926abc78-1e79-55c6-b24a-d33b4e5f6443",
    "parent_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "role": "father",
    "status": "confirmed",
    "source_ids": [
      "src_smithsonian_agreement_2020"
    ]
  },
  {
    "id": "parent-xiao-qi-ji-mother",
    "child_id": "926abc78-1e79-55c6-b24a-d33b4e5f6443",
    "parent_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "role": "mother",
    "status": "confirmed",
    "source_ids": [
      "src_smithsonian_agreement_2020"
    ]
  },
  {
    "id": "parent-ya-lun-father",
    "child_id": "fa8a0c14-b937-5de5-ae65-482cfd744482",
    "parent_id": "db108e44-8893-54e1-8cb5-8c5238b75089",
    "role": "father",
    "status": "confirmed",
    "source_ids": [
      "src_zooatlanta_cubs_birth",
      "src_zooatlanta_twins_names"
    ]
  },
  {
    "id": "parent-ya-lun-mother",
    "child_id": "fa8a0c14-b937-5de5-ae65-482cfd744482",
    "parent_id": "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
    "role": "mother",
    "status": "confirmed",
    "source_ids": [
      "src_zooatlanta_cubs_birth",
      "src_zooatlanta_twins_names"
    ]
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
    "mother_id": null,
    "record_tier": "complete_first_pass",
    "profile_available": true
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
    "mother_id": null,
    "record_tier": "complete_first_pass",
    "profile_available": true
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
    "mother_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "record_tier": "identity_first_pass",
    "profile_available": true
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
    "mother_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "record_tier": "identity_first_pass",
    "profile_available": true
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
    "mother_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "record_tier": "identity_first_pass",
    "profile_available": true
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
    "mother_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "record_tier": "identity_first_pass",
    "profile_available": true
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
    "mother_id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6",
    "record_tier": "identity_first_pass",
    "profile_available": true
  },
  {
    "id": "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
    "slug": "lun-lun",
    "name_zh": "伦伦",
    "name_en": "Lun Lun",
    "gender": "female",
    "status": "alive",
    "birth_date": "1997-08-25",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [],
    "intro": null,
    "tags": [
      "trusted-archive",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": null,
    "record_tier": "complete_first_pass",
    "profile_available": true
  },
  {
    "id": "db108e44-8893-54e1-8cb5-8c5238b75089",
    "slug": "yang-yang",
    "name_zh": "洋洋",
    "name_en": "Yang Yang",
    "gender": "male",
    "status": "alive",
    "birth_date": "1997-09-09",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [],
    "intro": null,
    "tags": [
      "trusted-archive",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": null,
    "record_tier": "complete_first_pass",
    "profile_available": true
  },
  {
    "id": "fa8a0c14-b937-5de5-ae65-482cfd744482",
    "slug": "ya-lun",
    "name_zh": "雅伦",
    "name_en": "Ya Lun",
    "gender": "female",
    "status": "alive",
    "birth_date": "2016-09-03",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [],
    "intro": null,
    "tags": [
      "trusted-archive",
      "golden-dataset"
    ],
    "father_id": "db108e44-8893-54e1-8cb5-8c5238b75089",
    "mother_id": "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
    "record_tier": "complete_first_pass",
    "profile_available": true
  },
  {
    "id": "d91afc69-20eb-59dd-ae56-8c8562ab03b3",
    "slug": "an-an-bao-li-father",
    "name_zh": "an-an-bao-li-father",
    "name_en": "An An",
    "gender": "unknown",
    "status": "unknown",
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
    "mother_id": null,
    "record_tier": "dependency_stub",
    "profile_available": false
  },
  {
    "id": "b53e84dd-31f1-56a8-b8dd-ab0b75dc7a1a",
    "slug": "pan-pan-baoxing",
    "name_zh": "pan-pan-baoxing",
    "name_en": "Pan Pan",
    "gender": "unknown",
    "status": "unknown",
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
    "mother_id": null,
    "record_tier": "dependency_stub",
    "profile_available": false
  },
  {
    "id": "35f40679-1253-58f4-a2c5-7669ea81cf6e",
    "slug": "yong-ba",
    "name_zh": "yong-ba",
    "name_en": "Yong Ba",
    "gender": "unknown",
    "status": "unknown",
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
    "mother_id": null,
    "record_tier": "dependency_stub",
    "profile_available": false
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
  },
  {
    "parent_id": "db108e44-8893-54e1-8cb5-8c5238b75089",
    "child_id": "fa8a0c14-b937-5de5-ae65-482cfd744482"
  },
  {
    "parent_id": "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
    "child_id": "fa8a0c14-b937-5de5-ae65-482cfd744482"
  }
];
