// Generated from reviewed Public Release 2026.07.24.2.
// Run npm run generate:trusted-identity-aliases after changing trusted identity data.

import type { PandaDetail, PandaLineageEdge, PandaLineageNode, PublicFacilitySummary, PublicInstitutionSummary, PublicParentageAssertionSummary, PublicPlaceSummary } from "@/lib/types";

export interface TrustedPandaReference {
  id: string;
  slug: string;
}

export const TRUSTED_PANDA_REFERENCES: Readonly<Record<string, TrustedPandaReference>> = {
  "a-bao": {
    "id": "771b6aef-2075-5d3e-8a82-7adc5822b99c",
    "slug": "a-bao"
  },
  "bao-bao": {
    "id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6",
    "slug": "bao-bao"
  },
  "bao-li": {
    "id": "434e10e3-7ba0-5de7-a59e-d3984524c58c",
    "slug": "bao-li"
  },
  "bao-xin": {
    "id": "0f7f494a-ec00-5e43-92e0-d299fe858d95",
    "slug": "bao-xin"
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
  "cheng-lan": {
    "id": "6457a76c-827c-50f5-9306-075d80e8e1d0",
    "slug": "cheng-lan"
  },
  "da-mei-changsha": {
    "id": "75e9524a-9baf-5454-af65-229fea00cd20",
    "slug": "da-mei-changsha"
  },
  "er-qiao": {
    "id": "35d085c8-d0b5-5779-99ba-c54166451f5b",
    "slug": "er-qiao"
  },
  "jin-xiao": {
    "id": "13fce46c-feb1-5667-9aa3-290f5c296636",
    "slug": "jin-xiao"
  },
  "jing-liang": {
    "id": "50afb182-8e05-5371-b341-253acb018792",
    "slug": "jing-liang"
  },
  "lei-lei": {
    "id": "c2eefef1-54f2-58ca-85cc-c2fd3d63653a",
    "slug": "lei-lei"
  },
  "leilei": {
    "id": "c2eefef1-54f2-58ca-85cc-c2fd3d63653a",
    "slug": "lei-lei"
  },
  "lun-hui": {
    "id": "09ebb49d-7bbe-56d1-8059-f5008338eab7",
    "slug": "lun-hui"
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
  "ni-ke": {
    "id": "ca531a8b-63d2-5f16-9fbc-0e61e2e23297",
    "slug": "ni-ke"
  },
  "ni-na": {
    "id": "d2da42a3-7a0b-5384-aeb1-afaff1439894",
    "slug": "ni-na"
  },
  "pu-pu-shenyang": {
    "id": "fd184343-de89-5e60-bb3b-0a5f780179d8",
    "slug": "pu-pu-shenyang"
  },
  "qi-fu-changsha": {
    "id": "e8690164-c982-53c0-a837-377e649de435",
    "slug": "qi-fu-changsha"
  },
  "qi-zhen": {
    "id": "b3885324-97e3-5c10-aedb-ae9588342d4d",
    "slug": "qi-zhen"
  },
  "qing-bao": {
    "id": "d56dffc3-941c-5640-983d-4f4959c97e03",
    "slug": "qing-bao"
  },
  "qing-qing-chengdu-2017-07-26": {
    "id": "fc74efcb-3a15-51e8-bf45-d9a294a8cbc8",
    "slug": "qing-qing-chengdu-2017-07-26"
  },
  "qingbao": {
    "id": "d56dffc3-941c-5640-983d-4f4959c97e03",
    "slug": "qing-bao"
  },
  "ri-ri": {
    "id": "57c0a1bd-cc44-5a08-ba48-f224e9956064",
    "slug": "ri-ri"
  },
  "riri": {
    "id": "57c0a1bd-cc44-5a08-ba48-f224e9956064",
    "slug": "ri-ri"
  },
  "shin-shin": {
    "id": "01878819-1eda-5d9c-96ab-bab66d3b0b09",
    "slug": "shin-shin"
  },
  "shinshin": {
    "id": "01878819-1eda-5d9c-96ab-bab66d3b0b09",
    "slug": "shin-shin"
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
  "xi-lun": {
    "id": "d24087cd-70d6-5902-92dd-ecc95186937b",
    "slug": "xi-lun"
  },
  "xiao_qi_ji": {
    "id": "926abc78-1e79-55c6-b24a-d33b4e5f6443",
    "slug": "xiao-qi-ji"
  },
  "xiao-qi-ji": {
    "id": "926abc78-1e79-55c6-b24a-d33b4e5f6443",
    "slug": "xiao-qi-ji"
  },
  "xiao-xiao": {
    "id": "275ad0df-c700-5991-a13a-0ca47c56eeba",
    "slug": "xiao-xiao"
  },
  "xiao-xin-chengdu-2017": {
    "id": "2a589b9f-1700-5b1e-8c2f-8203190da905",
    "slug": "xiao-xin-chengdu-2017"
  },
  "xiao-yatou": {
    "id": "70e56c3f-4290-55b9-abb5-79fe098f1a07",
    "slug": "xiao-yatou"
  },
  "xiaoqiji": {
    "id": "926abc78-1e79-55c6-b24a-d33b4e5f6443",
    "slug": "xiao-qi-ji"
  },
  "xiaoxiao": {
    "id": "275ad0df-c700-5991-a13a-0ca47c56eeba",
    "slug": "xiao-xiao"
  },
  "xilun": {
    "id": "d24087cd-70d6-5902-92dd-ecc95186937b",
    "slug": "xi-lun"
  },
  "ya-li": {
    "id": "fcc89c7a-6046-5c2c-bcb4-bf1fb50182a1",
    "slug": "ya-li"
  },
  "ya-lun": {
    "id": "fa8a0c14-b937-5de5-ae65-482cfd744482",
    "slug": "ya-lun"
  },
  "ya-song": {
    "id": "0a60ed76-cee8-5c2d-ada7-8ec50b085471",
    "slug": "ya-song"
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
  },
  "zhao-mei": {
    "id": "51847c05-7342-5e4c-a5b5-c00d23f9a6be",
    "slug": "zhao-mei"
  },
  "zhen-xi": {
    "id": "47714294-e602-5f67-9a58-b0f43b7c5be5",
    "slug": "zhen-xi"
  },
  "zhi-ma": {
    "id": "939aed44-55a9-51e6-8f2e-c50866be3a6a",
    "slug": "zhi-ma"
  },
  "zhi-shi": {
    "id": "907e93e2-d664-500f-b1b5-af06fd039172",
    "slug": "zhi-shi"
  }
};

export const TRUSTED_PANDA_DETAILS: PandaDetail[] = [
  {
    "id": "01878819-1eda-5d9c-96ab-bab66d3b0b09",
    "slug": "shin-shin",
    "name_zh": "真真",
    "name_en": "Shin Shin",
    "gender": "female",
    "status": "alive",
    "birth_date": "2005-07-03",
    "current_location": "中国大熊猫保护研究中心雅安碧峰峡基地",
    "cover_image_url": "https://api.zhipanda.com/media/releases/2026.07.20.2/media-shin-shin-6b36624de9829665-w1200.webp",
    "search_terms": [
      "shin-shin",
      "真真",
      "Shin Shin",
      "Xian Nu",
      "Xin Xin",
      "shinshin",
      "tokyo_zoo_profile_key:shin-shin"
    ],
    "intro": "2005 年出生于卧龙、2011 年抵达上野动物园的雌性大熊猫，是香香、晓晓和蕾蕾的母亲，2024 年返回雅安碧峰峡基地。",
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
        "id": "media-shin-shin-6b36624de9829665",
        "panda_id": "01878819-1eda-5d9c-96ab-bab66d3b0b09",
        "url": "https://api.zhipanda.com/media/releases/2026.07.20.2/media-shin-shin-6b36624de9829665-w1200.webp",
        "source_url": "https://commons.wikimedia.org/wiki/File:Shin_Shin_03.jpg",
        "rights": "CC BY-SA 4.0",
        "credit": "EleniXDD / Wikimedia Commons",
        "alt_zh": "真真在上野动物园吃竹子",
        "alt_en": "Shin Shin eating bamboo at Ueno Zoo",
        "status": "available",
        "sha256": "8b68b238d65f9b90a914db1b98e6e5e03f04d4042b65e3e6638b6f3174dddb29",
        "mime_type": "image/webp",
        "width": 1200,
        "height": 901,
        "bytes": 282766,
        "derivatives": [
          {
            "bytes": 60930,
            "height": 360,
            "kind": "width-480",
            "mime_type": "image/webp",
            "sha256": "d937360864bdae72e2fa093c5fa4ee244b9777e4b5b1b2543ca0b2931fe7561a",
            "url": "https://api.zhipanda.com/media/releases/2026.07.20.2/media-shin-shin-6b36624de9829665-w480.webp",
            "width": 480
          },
          {
            "bytes": 282766,
            "height": 901,
            "kind": "width-1200",
            "mime_type": "image/webp",
            "sha256": "8b68b238d65f9b90a914db1b98e6e5e03f04d4042b65e3e6638b6f3174dddb29",
            "url": "https://api.zhipanda.com/media/releases/2026.07.20.2/media-shin-shin-6b36624de9829665-w1200.webp",
            "width": 1200
          }
        ],
        "source_ids": [
          "src_commons_shin_shin_photo"
        ]
      }
    ],
    "identity": {
      "stable_id": "01878819-1eda-5d9c-96ab-bab66d3b0b09",
      "canonical_slug": "shin-shin",
      "names": [
        {
          "value": "真真",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history",
            "src_ueno_return_riri_shinshin"
          ]
        },
        {
          "value": "Shin Shin",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history",
            "src_ueno_return_riri_shinshin"
          ]
        }
      ],
      "aliases": [
        {
          "value": "Xian Nu",
          "language": "en",
          "kind": "alternate_romanization",
          "primary": false,
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history",
            "src_ueno_return_riri_shinshin"
          ]
        },
        {
          "value": "Xin Xin",
          "language": "en",
          "kind": "alternate_romanization",
          "primary": false,
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history",
            "src_ueno_return_riri_shinshin"
          ]
        }
      ],
      "legacy_slugs": [
        {
          "value": "shinshin",
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history"
          ]
        }
      ],
      "external_identifiers": [
        {
          "system": "tokyo_zoo_profile_key",
          "value": "shin-shin",
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history"
          ]
        }
      ]
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2005-07-03",
        "status": "confirmed",
        "last_verified_at": "2026-07-20",
        "assertion_ids": [
          "fact-shin-shin-birth-date"
        ],
        "source_ids": [
          "src_tokyo_zoo_ueno_panda_history",
          "src_ueno_return_riri_shinshin"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_facility",
        "value": "CCRCGP Bifengxia Base",
        "status": "confirmed",
        "last_verified_at": "2026-05-10",
        "assertion_ids": [
          "fact-shin-shin-current-place"
        ],
        "source_ids": [
          "src_ueno_return_riri_shinshin",
          "src_gpg_yaan_base_profiles"
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
          "fact-shin-shin-sex"
        ],
        "source_ids": [
          "src_tokyo_zoo_ueno_panda_history",
          "src_ueno_return_riri_shinshin"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_commons_shin_shin_photo",
        "publisher": "Wikimedia Commons",
        "title": "Shin Shin 03",
        "url": "https://commons.wikimedia.org/wiki/File:Shin_Shin_03.jpg",
        "published_at": "2024-07-03",
        "last_verified_at": "2026-07-20",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_gpg_yaan_base_profiles",
        "publisher": "Giant Panda Global",
        "title": "CCRCGP Ya'an Base giant pandas",
        "url": "https://www.giantpandaglobal.com/en/zoo/ccrcgp-yaan-base",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_tokyo_zoo_ueno_panda_history",
        "publisher": "Tokyo Zoological Park Society",
        "title": "Past giant pandas kept at Ueno Zoo",
        "url": "https://www.tokyo-zoo.net/ueno/panda/history/index.html",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_ueno_return_riri_shinshin",
        "publisher": "Tokyo Zoological Park Society",
        "title": "Regarding the return of Giant Panda Ri Ri and Shin Shin",
        "url": "https://www.tokyo-zoo.net/en/topics/news/ueno/355_28750_2024-09-29.html",
        "published_at": "2024-08-30",
        "last_verified_at": "2026-05-09",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": {
      "facility_id": "7e8c3dc5-0725-5c1e-bc97-53f3e9c47995",
      "coarse_location": null,
      "status": "confirmed",
      "last_verified_at": "2026-05-10"
    },
    "residencies": [
      {
        "id": "res-shin-shin-ueno",
        "facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "2011-02-21",
        "start_precision": "day",
        "end_date": "2024-09-29",
        "end_precision": "day",
        "status": "confirmed",
        "last_verified_at": null,
        "source_ids": [
          "src_tokyo_zoo_ueno_panda_history",
          "src_ueno_return_riri_shinshin"
        ]
      },
      {
        "id": "res-shin-shin-bifengxia",
        "facility_id": "7e8c3dc5-0725-5c1e-bc97-53f3e9c47995",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "2024-09-29",
        "start_precision": "day",
        "end_date": null,
        "end_precision": null,
        "status": "confirmed",
        "last_verified_at": "2026-05-10",
        "source_ids": [
          "src_ueno_return_riri_shinshin",
          "src_gpg_yaan_base_profiles"
        ]
      }
    ],
    "events": [
      {
        "id": "event-shin-shin-birth",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2005-07-03",
        "event_date_precision": "day",
        "participants": [
          "01878819-1eda-5d9c-96ab-bab66d3b0b09"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": null,
        "source_ids": [
          "src_tokyo_zoo_ueno_panda_history",
          "src_ueno_return_riri_shinshin"
        ],
        "changes_current_residency": false
      },
      {
        "id": "event-ueno-pair-arrival-2011",
        "event_type": "arrival",
        "event_status": "completed",
        "event_date": "2011-02-21",
        "event_date_precision": "day",
        "participants": [
          "57c0a1bd-cc44-5a08-ba48-f224e9956064",
          "01878819-1eda-5d9c-96ab-bab66d3b0b09"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
        "to_coarse_location": null,
        "source_ids": [
          "src_tokyo_zoo_ueno_panda_history",
          "src_ueno_return_riri_shinshin"
        ],
        "changes_current_residency": false
      },
      {
        "id": "event-ueno-pair-return-2024",
        "event_type": "transfer",
        "event_status": "completed",
        "event_date": "2024-09-29",
        "event_date_precision": "day",
        "participants": [
          "57c0a1bd-cc44-5a08-ba48-f224e9956064",
          "01878819-1eda-5d9c-96ab-bab66d3b0b09"
        ],
        "from_facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
        "from_coarse_location": null,
        "to_facility_id": "7e8c3dc5-0725-5c1e-bc97-53f3e9c47995",
        "to_coarse_location": null,
        "source_ids": [
          "src_ueno_return_riri_shinshin"
        ],
        "changes_current_residency": true
      }
    ],
    "record_tier": "complete_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "2005 年出生于卧龙、2011 年抵达上野动物园的雌性大熊猫，是香香、晓晓和蕾蕾的母亲，2024 年返回雅安碧峰峡基地。"
      },
      {
        "locale": "en",
        "summary": "Female giant panda born in Wolong in 2005, mother of Xiang Xiang, Xiao Xiao, and Lei Lei, and returned from Ueno to Bifengxia Base in 2024."
      }
    ],
    "media_release": {
      "license_state": "licensed",
      "display_mode": "gallery",
      "source_ids": [
        "src_commons_shin_shin_photo"
      ]
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "完成身份、出生、居住、事件、亲缘与授权照片的公开审核。"
        },
        {
          "locale": "en",
          "summary": "Reviewed identity, birth, residency, events, lineage, and licensed media."
        }
      ]
    }
  },
  {
    "id": "09ebb49d-7bbe-56d1-8059-f5008338eab7",
    "slug": "lun-hui",
    "name_zh": "轮辉",
    "name_en": "Lun Hui / Wu Wu",
    "gender": "male",
    "status": "alive",
    "birth_date": "2021-07-25",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [
      "lun-hui",
      "轮辉",
      "Lun Hui / Wu Wu"
    ],
    "intro": "轮辉，2021 年出生，收藏记录中的现居地为 Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan Province, China。",
    "birthplace": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan Province, China",
    "tags": [
      "trusted-identity",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": null,
    "habitats": [],
    "media": [],
    "identity": {
      "stable_id": "09ebb49d-7bbe-56d1-8059-f5008338eab7",
      "canonical_slug": "lun-hui",
      "names": [
        {
          "value": "轮辉",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2021_zh",
            "src_gpg_chengdu_base_current_page_6",
            "src_gpg_meet_world_page_24"
          ]
        },
        {
          "value": "Lun Hui / Wu Wu",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2021_zh",
            "src_gpg_chengdu_base_current_page_6",
            "src_gpg_meet_world_page_24"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2021-07-25",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-lun-hui-birth-date"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_chengdu_base_current_page_6",
          "src_gpg_meet_world_page_24"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "birthplace",
        "value": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan Province, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-lun-hui-birthplace"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_chengdu_base_current_page_6",
          "src_gpg_meet_world_page_24"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan Province, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-lun-hui-current-coarse-location"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_chengdu_base_current_page_6",
          "src_gpg_meet_world_page_24"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "male",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-lun-hui-sex"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_chengdu_base_current_page_6",
          "src_gpg_meet_world_page_24"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_chengdu_newborns_2021_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2021 Newborn Giant Panda Profiles",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-09-19/8165.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2021_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2021年新生大熊猫幼仔档案",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-07-07/6594.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      },
      {
        "id": "src_gpg_chengdu_base_current_page_6",
        "publisher": "Giant Panda Global",
        "title": "Chengdu Panda Base current giant pandas page 6",
        "url": "https://www.giantpandaglobal.com/en/zoo/chengdu-research-base-of-giant-panda-breeding/?pagina=6&s=current",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_gpg_meet_world_page_24",
        "publisher": "Giant Panda Global",
        "title": "Meet the giant pandas around the world page 24",
        "url": "https://www.giantpandaglobal.com/en/meet-the-giant-pandas-around-the-world/?pagina=24",
        "published_at": null,
        "last_verified_at": "2026-05-11",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_lun_hui_birth_20210725",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2021-07-25",
        "event_date_precision": "day",
        "participants": [
          "09ebb49d-7bbe-56d1-8059-f5008338eab7"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
        "source_ids": [
          "src_chengdu_newborns_2021_en",
          "src_chengdu_newborns_2021_zh"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "轮辉，2021 年出生，收藏记录中的现居地为 Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan Province, China。"
      },
      {
        "locale": "en",
        "summary": "Living Chengdu Panda Base male giant panda captured from GPG current and global living indexes; page 24 displays Wu Wu for the same href."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "由已审核收藏数据自动生成首轮档案。"
        },
        {
          "locale": "en",
          "summary": "Generated automatically from reviewed collection curation."
        }
      ]
    }
  },
  {
    "id": "0a60ed76-cee8-5c2d-ada7-8ec50b085471",
    "slug": "ya-song",
    "name_zh": "雅颂",
    "name_en": "Ya Song",
    "gender": "female",
    "status": "alive",
    "birth_date": "2021-07-31",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [
      "ya-song",
      "雅颂",
      "Ya Song"
    ],
    "intro": "雅颂，2021 年出生，收藏记录中的现居地为 Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan Province, China。",
    "birthplace": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan Province, China",
    "tags": [
      "trusted-identity",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": null,
    "habitats": [],
    "media": [],
    "identity": {
      "stable_id": "0a60ed76-cee8-5c2d-ada7-8ec50b085471",
      "canonical_slug": "ya-song",
      "names": [
        {
          "value": "雅颂",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2021_zh",
            "src_gpg_chengdu_base_current_page_6"
          ]
        },
        {
          "value": "Ya Song",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2021_zh",
            "src_gpg_chengdu_base_current_page_6"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2021-07-31",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-ya-song-birth-date"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_chengdu_base_current_page_6"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "birthplace",
        "value": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan Province, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-ya-song-birthplace"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_chengdu_base_current_page_6"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan Province, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-ya-song-current-coarse-location"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_chengdu_base_current_page_6"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "female",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-ya-song-sex"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_chengdu_base_current_page_6"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_chengdu_newborns_2021_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2021 Newborn Giant Panda Profiles",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-09-19/8165.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2021_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2021年新生大熊猫幼仔档案",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-07-07/6594.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      },
      {
        "id": "src_gpg_chengdu_base_current_page_6",
        "publisher": "Giant Panda Global",
        "title": "Chengdu Panda Base current giant pandas page 6",
        "url": "https://www.giantpandaglobal.com/en/zoo/chengdu-research-base-of-giant-panda-breeding/?pagina=6&s=current",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_ya_song_birth_20210731",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2021-07-31",
        "event_date_precision": "day",
        "participants": [
          "0a60ed76-cee8-5c2d-ada7-8ec50b085471"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
        "source_ids": [
          "src_chengdu_newborns_2021_en",
          "src_chengdu_newborns_2021_zh"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "雅颂，2021 年出生，收藏记录中的现居地为 Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan Province, China。"
      },
      {
        "locale": "en",
        "summary": "Living Chengdu Panda Base female giant panda captured from GPG current index."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "由已审核收藏数据自动生成首轮档案。"
        },
        {
          "locale": "en",
          "summary": "Generated automatically from reviewed collection curation."
        }
      ]
    }
  },
  {
    "id": "0f7f494a-ec00-5e43-92e0-d299fe858d95",
    "slug": "bao-xin",
    "name_zh": "宝新",
    "name_en": "Bao Xin",
    "gender": "male",
    "status": "unknown",
    "birth_date": "2021-06-24",
    "current_location": null,
    "cover_image_url": "https://api.zhipanda.com/media/releases/2026.07.24.2/media-bao-xin-d9b287dead5da1d6-w800.webp",
    "search_terms": [
      "bao-xin",
      "宝新",
      "Bao Xin"
    ],
    "intro": "宝新是雄性大熊猫，2021年6月24日出生于成都大熊猫繁育研究基地，母亲为阿宝；2021年10月1日参加基地2021级新生幼仔线上亮相。",
    "birthplace": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
    "tags": [
      "trusted-identity",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": "771b6aef-2075-5d3e-8a82-7adc5822b99c",
    "habitats": [],
    "media": [
      {
        "id": "media-bao-xin-d9b287dead5da1d6",
        "panda_id": "0f7f494a-ec00-5e43-92e0-d299fe858d95",
        "url": "https://api.zhipanda.com/media/releases/2026.07.24.2/media-bao-xin-d9b287dead5da1d6-w800.webp",
        "source_url": "https://www.panda.org.cn/cn/culture/activities/2023-07-07/6594.html",
        "rights": "All rights reserved",
        "credit": "Chengdu Research Base of Giant Panda Breeding",
        "alt_zh": "2021年新生幼仔档案中的宝新",
        "alt_en": "Bao Xin in the official 2021 newborn profile",
        "status": "available",
        "sha256": "3289de94d2e637357c2fdc955e23a7da1bdd9fc240cc13789c17568d5acb8d2f",
        "mime_type": "image/webp",
        "width": 800,
        "height": 533,
        "bytes": 13586,
        "derivatives": [
          {
            "bytes": 5264,
            "height": 320,
            "kind": "width-480",
            "mime_type": "image/webp",
            "sha256": "713d834900166c53b6fea7189fe5420ad0ec05ef28057031a9a5c3a867cce3ed",
            "url": "https://api.zhipanda.com/media/releases/2026.07.24.2/media-bao-xin-d9b287dead5da1d6-w480.webp",
            "width": 480
          },
          {
            "bytes": 13586,
            "height": 533,
            "kind": "width-800",
            "mime_type": "image/webp",
            "sha256": "3289de94d2e637357c2fdc955e23a7da1bdd9fc240cc13789c17568d5acb8d2f",
            "url": "https://api.zhipanda.com/media/releases/2026.07.24.2/media-bao-xin-d9b287dead5da1d6-w800.webp",
            "width": 800
          }
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh"
        ]
      }
    ],
    "identity": {
      "stable_id": "0f7f494a-ec00-5e43-92e0-d299fe858d95",
      "canonical_slug": "bao-xin",
      "names": [
        {
          "value": "宝新",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2021_en",
            "src_chengdu_newborns_2021_zh"
          ]
        },
        {
          "value": "Bao Xin",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2021_en",
            "src_chengdu_newborns_2021_zh"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2021-06-24",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-bao-xin-birth-date"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_en",
          "src_chengdu_newborns_2021_zh"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "birthplace",
        "value": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-bao-xin-birthplace"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_en",
          "src_chengdu_newborns_2021_zh"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "male",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-bao-xin-sex"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_en",
          "src_chengdu_newborns_2021_zh"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_chengdu_newborns_2021_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2021 Newborn Giant Panda Profiles",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-09-19/8165.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2021_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2021年新生大熊猫幼仔档案",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-07-07/6594.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_bao_xin_birth_20210624",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2021-06-24",
        "event_date_precision": "day",
        "participants": [
          "0f7f494a-ec00-5e43-92e0-d299fe858d95",
          "771b6aef-2075-5d3e-8a82-7adc5822b99c"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
        "source_ids": [
          "src_chengdu_newborns_2021_en",
          "src_chengdu_newborns_2021_zh"
        ],
        "changes_current_residency": false
      },
      {
        "id": "evt_bao_xin_online_debut_20211001",
        "event_type": "public_debut",
        "event_status": "completed",
        "event_date": "2021-10-01",
        "event_date_precision": "day",
        "participants": [
          "0f7f494a-ec00-5e43-92e0-d299fe858d95"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
        "source_ids": [
          "src_chengdu_newborns_2021_en",
          "src_chengdu_newborns_2021_zh"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "宝新是雄性大熊猫，2021年6月24日出生于成都大熊猫繁育研究基地，母亲为阿宝；2021年10月1日参加基地2021级新生幼仔线上亮相。"
      },
      {
        "locale": "en",
        "summary": "Bao Xin is a male giant panda born at the Chengdu Research Base on 2021-06-24 to mother A Bao. He joined the Base's online presentation of the 2021 newborn cohort on 2021-10-01."
      }
    ],
    "media_release": {
      "license_state": "licensed",
      "display_mode": "gallery",
      "source_ids": [
        "src_chengdu_newborns_2021_zh"
      ]
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "补充官方母系关系、出生细节、事件时间线与收藏图片。"
        },
        {
          "locale": "en",
          "summary": "Added official maternal lineage, birth details, timeline events, and collection media."
        }
      ]
    }
  },
  {
    "id": "13fce46c-feb1-5667-9aa3-290f5c296636",
    "slug": "jin-xiao",
    "name_zh": "金宵",
    "name_en": "Jin Xiao",
    "gender": "female",
    "status": "alive",
    "birth_date": "2021-07-23",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [
      "jin-xiao",
      "金宵",
      "Jin Xiao"
    ],
    "intro": "金宵，2021 年出生，收藏记录中的现居地为 Chengdu Panda Base, Chengdu, Sichuan Province, China。",
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
      "stable_id": "13fce46c-feb1-5667-9aa3-290f5c296636",
      "canonical_slug": "jin-xiao",
      "names": [
        {
          "value": "金宵",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2021_zh",
            "src_gpg_meet_world_page_23"
          ]
        },
        {
          "value": "Jin Xiao",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2021_zh",
            "src_gpg_meet_world_page_23"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2021-07-23",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-jin-xiao-birth-date"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_meet_world_page_23"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "Chengdu Panda Base, Chengdu, Sichuan Province, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-jin-xiao-current-coarse-location"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_meet_world_page_23"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "female",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-jin-xiao-sex"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_meet_world_page_23"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_chengdu_newborns_2021_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2021 Newborn Giant Panda Profiles",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-09-19/8165.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2021_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2021年新生大熊猫幼仔档案",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-07-07/6594.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      },
      {
        "id": "src_gpg_meet_world_page_23",
        "publisher": "Giant Panda Global",
        "title": "Meet the giant pandas around the world page 23",
        "url": "https://www.giantpandaglobal.com/en/meet-the-giant-pandas-around-the-world/?pagina=23",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_jin_xiao_birth_20210723",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2021-07-23",
        "event_date_precision": "day",
        "participants": [
          "13fce46c-feb1-5667-9aa3-290f5c296636"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
        "source_ids": [
          "src_chengdu_newborns_2021_en",
          "src_chengdu_newborns_2021_zh"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "金宵，2021 年出生，收藏记录中的现居地为 Chengdu Panda Base, Chengdu, Sichuan Province, China。"
      },
      {
        "locale": "en",
        "summary": "Living giant panda captured from GPG global discovery index."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "由已审核收藏数据自动生成首轮档案。"
        },
        {
          "locale": "en",
          "summary": "Generated automatically from reviewed collection curation."
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
        "id": "src_ccrcgp_2025_birthday_season",
        "publisher": "China.org.cn / Xinhua",
        "title": "前方高萌 卧龙神树坪基地举办大熊猫集体生日会",
        "url": "https://www.china.org.cn/2025-07/18/content_117984485_4.shtml",
        "published_at": "2025-07-18",
        "last_verified_at": "2026-05-10",
        "language": "zh-Hans",
        "access_state": "accessible"
      },
      {
        "id": "src_smithsonian_history",
        "publisher": "Smithsonian National Zoo and Conservation Biology Institute",
        "title": "History of Giant Pandas at the Smithsonian's National Zoo and Conservation Biology Institute",
        "url": "https://nationalzoo.si.edu/animals/history-giant-pandas-zoo",
        "published_at": null,
        "last_verified_at": "2026-07-23",
        "language": "en",
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
      "data_version": "2026.07.24.2",
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
    "id": "275ad0df-c700-5991-a13a-0ca47c56eeba",
    "slug": "xiao-xiao",
    "name_zh": "晓晓",
    "name_en": "Xiao Xiao",
    "gender": "male",
    "status": "alive",
    "birth_date": "2021-06-23",
    "current_location": "中国大熊猫保护研究中心雅安基地",
    "cover_image_url": "https://api.zhipanda.com/media/releases/2026.07.20.2/media-xiao-xiao-ae1f68080472412c-w1200.webp",
    "search_terms": [
      "xiao-xiao",
      "晓晓",
      "Xiao Xiao",
      "xiaoxiao",
      "tokyo_zoo_profile_key:xiao-xiao"
    ],
    "intro": "力力与真真之子，2021 年出生于上野动物园，与蕾蕾为双胞胎，2026 年返回雅安基地。",
    "birthplace": null,
    "tags": [
      "trusted-identity",
      "golden-dataset"
    ],
    "father_id": "57c0a1bd-cc44-5a08-ba48-f224e9956064",
    "mother_id": "01878819-1eda-5d9c-96ab-bab66d3b0b09",
    "habitats": [],
    "media": [
      {
        "id": "media-xiao-xiao-ae1f68080472412c",
        "panda_id": "275ad0df-c700-5991-a13a-0ca47c56eeba",
        "url": "https://api.zhipanda.com/media/releases/2026.07.20.2/media-xiao-xiao-ae1f68080472412c-w1200.webp",
        "source_url": "https://commons.wikimedia.org/wiki/File:Ailuropoda_melanoleuca_Xiao_Xiao_220518e.jpg",
        "rights": "CC BY-SA 4.0",
        "credit": "江戸村のとくぞう / Wikimedia Commons",
        "alt_zh": "晓晓在上野动物园的栖息地内",
        "alt_en": "Xiao Xiao in his habitat at Ueno Zoo",
        "status": "available",
        "sha256": "bdc660eb0101f4f6913911905fb0d3c5b78f441abe5f3cff1c2292ecdc197bd5",
        "mime_type": "image/webp",
        "width": 1200,
        "height": 1091,
        "bytes": 114184,
        "derivatives": [
          {
            "bytes": 26032,
            "height": 436,
            "kind": "width-480",
            "mime_type": "image/webp",
            "sha256": "ceb36d0ecf06610f698262e9323c465fd485569c16f9c5cb76ed65593cadf3e6",
            "url": "https://api.zhipanda.com/media/releases/2026.07.20.2/media-xiao-xiao-ae1f68080472412c-w480.webp",
            "width": 480
          },
          {
            "bytes": 114184,
            "height": 1091,
            "kind": "width-1200",
            "mime_type": "image/webp",
            "sha256": "bdc660eb0101f4f6913911905fb0d3c5b78f441abe5f3cff1c2292ecdc197bd5",
            "url": "https://api.zhipanda.com/media/releases/2026.07.20.2/media-xiao-xiao-ae1f68080472412c-w1200.webp",
            "width": 1200
          }
        ],
        "source_ids": [
          "src_commons_xiao_xiao_photo"
        ]
      }
    ],
    "identity": {
      "stable_id": "275ad0df-c700-5991-a13a-0ca47c56eeba",
      "canonical_slug": "xiao-xiao",
      "names": [
        {
          "value": "晓晓",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history",
            "src_ueno_twins_names_2021",
            "src_ueno_xiaolei_return_2026"
          ]
        },
        {
          "value": "Xiao Xiao",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history",
            "src_ueno_twins_names_2021",
            "src_ueno_xiaolei_return_2026"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [
        {
          "value": "xiaoxiao",
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history"
          ]
        }
      ],
      "external_identifiers": [
        {
          "system": "tokyo_zoo_profile_key",
          "value": "xiao-xiao",
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history"
          ]
        }
      ]
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2021-06-23",
        "status": "confirmed",
        "last_verified_at": "2026-07-20",
        "assertion_ids": [
          "fact-xiao-xiao-birth-date"
        ],
        "source_ids": [
          "src_tokyo_zoo_ueno_panda_history",
          "src_ueno_twins_names_2021"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_facility",
        "value": "CCRCGP Ya'an Base",
        "status": "confirmed",
        "last_verified_at": "2026-05-10",
        "assertion_ids": [
          "fact-xiao-xiao-current-place"
        ],
        "source_ids": [
          "src_ueno_xiaolei_return_2026"
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
          "fact-xiao-xiao-sex"
        ],
        "source_ids": [
          "src_tokyo_zoo_ueno_panda_history",
          "src_ueno_twins_names_2021"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_commons_xiao_xiao_photo",
        "publisher": "Wikimedia Commons",
        "title": "Ailuropoda melanoleuca Xiao Xiao 220518e",
        "url": "https://commons.wikimedia.org/wiki/File:Ailuropoda_melanoleuca_Xiao_Xiao_220518e.jpg",
        "published_at": "2022-05-18",
        "last_verified_at": "2026-07-20",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_tokyo_zoo_ueno_panda_history",
        "publisher": "Tokyo Zoological Park Society",
        "title": "Past giant pandas kept at Ueno Zoo",
        "url": "https://www.tokyo-zoo.net/ueno/panda/history/index.html",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_ueno_twins_names_2021",
        "publisher": "Tokyo Zoological Park Society",
        "title": "The names of Giant Panda twins have been decided as Xiao Xiao and Lei Lei",
        "url": "https://www.tokyo-zoo.net/en/topics/news/ueno/1681_27052_2021-10-08.html",
        "published_at": "2021-10-08",
        "last_verified_at": "2026-07-20",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_ueno_xiaolei_return_2026",
        "publisher": "Tokyo Zoological Park Society",
        "title": "Giant Panda Xiao Xiao and Lei Lei arrive at the Ya'an Base",
        "url": "https://www.tokyo-zoo.net/en/ueno/news/5238/index.html",
        "published_at": "2026-01-28",
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": {
      "facility_id": "d773a478-6014-5a4f-9e29-a0903f4beea6",
      "coarse_location": null,
      "status": "confirmed",
      "last_verified_at": "2026-05-10"
    },
    "residencies": [
      {
        "id": "res-xiao-xiao-ueno",
        "facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "2021-06-23",
        "start_precision": "day",
        "end_date": "2026-01-28",
        "end_precision": "day",
        "status": "confirmed",
        "last_verified_at": null,
        "source_ids": [
          "src_tokyo_zoo_ueno_panda_history"
        ]
      },
      {
        "id": "res-xiao-xiao-yaan",
        "facility_id": "d773a478-6014-5a4f-9e29-a0903f4beea6",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "2026-01-28",
        "start_precision": "day",
        "end_date": null,
        "end_precision": null,
        "status": "confirmed",
        "last_verified_at": "2026-05-10",
        "source_ids": [
          "src_ueno_xiaolei_return_2026"
        ]
      }
    ],
    "events": [
      {
        "id": "event-ueno-twins-birth-2021",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2021-06-23",
        "event_date_precision": "day",
        "participants": [
          "275ad0df-c700-5991-a13a-0ca47c56eeba",
          "c2eefef1-54f2-58ca-85cc-c2fd3d63653a"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
        "to_coarse_location": null,
        "source_ids": [
          "src_tokyo_zoo_ueno_panda_history",
          "src_ueno_twins_names_2021"
        ],
        "changes_current_residency": false
      },
      {
        "id": "event-ueno-twins-named-2021",
        "event_type": "naming",
        "event_status": "completed",
        "event_date": "2021-10-08",
        "event_date_precision": "day",
        "participants": [
          "275ad0df-c700-5991-a13a-0ca47c56eeba",
          "c2eefef1-54f2-58ca-85cc-c2fd3d63653a"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
        "to_coarse_location": null,
        "source_ids": [
          "src_ueno_twins_names_2021"
        ],
        "changes_current_residency": false
      },
      {
        "id": "event-ueno-twins-return-2026",
        "event_type": "transfer",
        "event_status": "completed",
        "event_date": "2026-01-28",
        "event_date_precision": "day",
        "participants": [
          "275ad0df-c700-5991-a13a-0ca47c56eeba",
          "c2eefef1-54f2-58ca-85cc-c2fd3d63653a"
        ],
        "from_facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
        "from_coarse_location": null,
        "to_facility_id": "d773a478-6014-5a4f-9e29-a0903f4beea6",
        "to_coarse_location": null,
        "source_ids": [
          "src_ueno_xiaolei_return_2026"
        ],
        "changes_current_residency": true
      }
    ],
    "record_tier": "complete_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "力力与真真之子，2021 年出生于上野动物园，与蕾蕾为双胞胎，2026 年返回雅安基地。"
      },
      {
        "locale": "en",
        "summary": "Son of Ri Ri and Shin Shin, born at Ueno Zoo in 2021, twin of Lei Lei, and returned to Ya'an Base in 2026."
      }
    ],
    "media_release": {
      "license_state": "licensed",
      "display_mode": "gallery",
      "source_ids": [
        "src_commons_xiao_xiao_photo"
      ]
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "完成身份、出生、居住、事件、亲缘与授权照片的公开审核。"
        },
        {
          "locale": "en",
          "summary": "Reviewed identity, birth, residency, events, lineage, and licensed media."
        }
      ]
    }
  },
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
        "last_verified_at": "2026-07-23",
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
      "data_version": "2026.07.24.2",
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
    "id": "2a589b9f-1700-5b1e-8c2f-8203190da905",
    "slug": "xiao-xin-chengdu-2017",
    "name_zh": "小馨",
    "name_en": "Xiao Xin",
    "gender": "female",
    "status": "unknown",
    "birth_date": "2017-07-26",
    "current_location": null,
    "cover_image_url": "https://api.zhipanda.com/media/releases/2026.07.24.2/media-xiao-xin-chengdu-2017-d7629714a52880f0-w550.webp",
    "search_terms": [
      "xiao-xin-chengdu-2017",
      "小馨",
      "Xiao Xin"
    ],
    "intro": "小馨是雌性大熊猫，2017年7月26日出生于成都大熊猫繁育研究基地，母亲为小丫头，初生体重115.4克；2017年9月参加基地新生幼仔集体亮相。",
    "birthplace": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
    "tags": [
      "trusted-identity",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": "70e56c3f-4290-55b9-abb5-79fe098f1a07",
    "habitats": [],
    "media": [
      {
        "id": "media-xiao-xin-chengdu-2017-d7629714a52880f0",
        "panda_id": "2a589b9f-1700-5b1e-8c2f-8203190da905",
        "url": "https://api.zhipanda.com/media/releases/2026.07.24.2/media-xiao-xin-chengdu-2017-d7629714a52880f0-w550.webp",
        "source_url": "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html",
        "rights": "All rights reserved",
        "credit": "Chengdu Research Base of Giant Panda Breeding",
        "alt_zh": "2017年成都基地新生幼仔集体亮相现场；小馨属于该批次",
        "alt_en": "The 2017 Chengdu newborn cohort presentation; Xiao Xin belongs to this cohort",
        "status": "available",
        "sha256": "8b7fe6ed854ca563489beecef3aec37a1f8d2478f6bf5d105047efc25f578fbd",
        "mime_type": "image/webp",
        "width": 550,
        "height": 366,
        "bytes": 40062,
        "derivatives": [
          {
            "bytes": 31292,
            "height": 319,
            "kind": "width-480",
            "mime_type": "image/webp",
            "sha256": "6e1e5a60dccffe35dc4d93c6c4bcf14cbec7a0581cda9b07f01dc6fb20e628c2",
            "url": "https://api.zhipanda.com/media/releases/2026.07.24.2/media-xiao-xin-chengdu-2017-d7629714a52880f0-w480.webp",
            "width": 480
          },
          {
            "bytes": 40062,
            "height": 366,
            "kind": "width-550",
            "mime_type": "image/webp",
            "sha256": "8b7fe6ed854ca563489beecef3aec37a1f8d2478f6bf5d105047efc25f578fbd",
            "url": "https://api.zhipanda.com/media/releases/2026.07.24.2/media-xiao-xin-chengdu-2017-d7629714a52880f0-w550.webp",
            "width": 550
          }
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh"
        ]
      }
    ],
    "identity": {
      "stable_id": "2a589b9f-1700-5b1e-8c2f-8203190da905",
      "canonical_slug": "xiao-xin-chengdu-2017",
      "names": [
        {
          "value": "小馨",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_en",
            "src_chengdu_newborns_2017_zh"
          ]
        },
        {
          "value": "Xiao Xin",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_en",
            "src_chengdu_newborns_2017_zh"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2017-07-26",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-xiao-xin-chengdu-2017-birth-date"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "birthplace",
        "value": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-xiao-xin-chengdu-2017-birthplace"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "female",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-xiao-xin-chengdu-2017-sex"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_chengdu_newborns_2017_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "Debut of 2017 Newborn Pandas",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-08-24/8080.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2017_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2017新生大熊猫宝宝齐亮相",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_xiao_xin_chengdu_2017_birth_20170726",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2017-07-26",
        "event_date_precision": "day",
        "participants": [
          "2a589b9f-1700-5b1e-8c2f-8203190da905",
          "70e56c3f-4290-55b9-abb5-79fe098f1a07"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "changes_current_residency": false
      },
      {
        "id": "evt_xiao_xin_cohort_debut_20170927",
        "event_type": "public_debut",
        "event_status": "completed",
        "event_date": "2017-09-27",
        "event_date_precision": "day",
        "participants": [
          "2a589b9f-1700-5b1e-8c2f-8203190da905"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "小馨是雌性大熊猫，2017年7月26日出生于成都大熊猫繁育研究基地，母亲为小丫头，初生体重115.4克；2017年9月参加基地新生幼仔集体亮相。"
      },
      {
        "locale": "en",
        "summary": "Xiao Xin is a female giant panda born at the Chengdu Research Base on 2017-07-26 to mother Xiao Yatou, with a recorded birth weight of 115.4 g. She joined the Base's 2017 newborn cohort presentation."
      }
    ],
    "media_release": {
      "license_state": "licensed",
      "display_mode": "gallery",
      "source_ids": [
        "src_chengdu_newborns_2017_zh"
      ]
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "补充官方母系关系、出生细节、事件时间线与收藏图片。"
        },
        {
          "locale": "en",
          "summary": "Added official maternal lineage, birth details, timeline events, and collection media."
        }
      ]
    }
  },
  {
    "id": "35d085c8-d0b5-5779-99ba-c54166451f5b",
    "slug": "er-qiao",
    "name_zh": "二巧",
    "name_en": "Er Qiao",
    "gender": "female",
    "status": "unknown",
    "birth_date": null,
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [
      "er-qiao",
      "二巧",
      "Er Qiao"
    ],
    "intro": "成都基地官方新生幼仔档案确认二巧为青青的母亲。",
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
      "stable_id": "35d085c8-d0b5-5779-99ba-c54166451f5b",
      "canonical_slug": "er-qiao",
      "names": [
        {
          "value": "二巧",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_en",
            "src_chengdu_newborns_2017_zh"
          ]
        },
        {
          "value": "Er Qiao",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_en",
            "src_chengdu_newborns_2017_zh"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [],
    "sources": [
      {
        "id": "src_chengdu_newborns_2017_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "Debut of 2017 Newborn Pandas",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-08-24/8080.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2017_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2017新生大熊猫宝宝齐亮相",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_qing_qing_chengdu_2017_07_26_birth_20170726",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2017-07-26",
        "event_date_precision": "day",
        "participants": [
          "35d085c8-d0b5-5779-99ba-c54166451f5b",
          "fc74efcb-3a15-51e8-bf45-d9a294a8cbc8"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "成都基地官方新生幼仔档案确认二巧为青青的母亲。"
      },
      {
        "locale": "en",
        "summary": "An official Chengdu newborn record identifies Er Qiao as the mother of Qing Qing."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "建立仅含官方母系身份依据的首轮关系档案。"
        },
        {
          "locale": "en",
          "summary": "Created an identity-first maternal relationship profile."
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
        "last_verified_at": "2026-07-23",
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
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": []
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
    "cover_image_url": "https://api.zhipanda.com/media/releases/2026.07.23.1/media-bao-li-ac4d18101cfe4209-w1200.webp",
    "search_terms": [
      "bao-li",
      "宝力",
      "Bao Li",
      "Bǎolì",
      "baoli",
      "smithsonian_profile_key:bao-li"
    ],
    "intro": "2021 年出生于四川，2024 年抵达史密森国家动物园，并于 2025 年 1 月公开亮相。",
    "birthplace": "China Conservation and Research Center for the Giant Panda, Sichuan",
    "tags": [
      "trusted-identity",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6",
    "habitats": [],
    "media": [
      {
        "id": "media-bao-li-ac4d18101cfe4209",
        "panda_id": "434e10e3-7ba0-5de7-a59e-d3984524c58c",
        "url": "https://api.zhipanda.com/media/releases/2026.07.23.1/media-bao-li-ac4d18101cfe4209-w1200.webp",
        "source_url": "https://commons.wikimedia.org/wiki/File:Bao_Li.jpg",
        "rights": "CC BY-SA 4.0",
        "credit": "Melina Kolburn / Wikimedia Commons",
        "alt_zh": "宝力在史密森尼国家动物园的栖息地内",
        "alt_en": "Bao Li in his habitat at Smithsonian's National Zoo",
        "status": "available",
        "sha256": "1cf700a6670abc2374f468da27a83655be6d8d44efd3f18bb15737d659314819",
        "mime_type": "image/webp",
        "width": 1200,
        "height": 800,
        "bytes": 166088,
        "derivatives": [
          {
            "bytes": 35912,
            "height": 320,
            "kind": "width-480",
            "mime_type": "image/webp",
            "sha256": "6a495a7d9d7d9442a90039e4330e78d4a72b17bdf7ea64667bb12e253bfd4464",
            "url": "https://api.zhipanda.com/media/releases/2026.07.23.1/media-bao-li-ac4d18101cfe4209-w480.webp",
            "width": 480
          },
          {
            "bytes": 166088,
            "height": 800,
            "kind": "width-1200",
            "mime_type": "image/webp",
            "sha256": "1cf700a6670abc2374f468da27a83655be6d8d44efd3f18bb15737d659314819",
            "url": "https://api.zhipanda.com/media/releases/2026.07.23.1/media-bao-li-ac4d18101cfe4209-w1200.webp",
            "width": 1200
          }
        ],
        "source_ids": [
          "src_commons_bao_li_photo"
        ]
      }
    ],
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
            "src_smithsonian_giant_panda_faq",
            "src_smithsonian_giant_panda_page",
            "src_smithsonian_history"
          ]
        },
        {
          "value": "Bao Li",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_smithsonian_giant_panda_faq",
            "src_smithsonian_giant_panda_page",
            "src_smithsonian_history"
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
          "system": "smithsonian_profile_key",
          "value": "bao-li",
          "source_ids": [
            "src_smithsonian_giant_panda_page"
          ]
        }
      ]
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2021-08-04",
        "status": "confirmed",
        "last_verified_at": "2026-07-23",
        "assertion_ids": [
          "fact-bao-li-birth-date"
        ],
        "source_ids": [
          "src_smithsonian_giant_panda_faq",
          "src_smithsonian_giant_panda_page"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "birthplace",
        "value": "China Conservation and Research Center for the Giant Panda, Sichuan",
        "status": "confirmed",
        "last_verified_at": "2026-07-23",
        "assertion_ids": [
          "fact-bao-li-birthplace"
        ],
        "source_ids": [
          "src_smithsonian_giant_panda_faq",
          "src_smithsonian_giant_panda_page"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_facility",
        "value": "David M. Rubenstein and Family Giant Panda Habitat, Smithsonian National Zoo",
        "status": "confirmed",
        "last_verified_at": "2026-07-23",
        "assertion_ids": [
          "fact-bao-li-current-place"
        ],
        "source_ids": [
          "src_smithsonian_giant_panda_faq",
          "src_smithsonian_giant_panda_page"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "male",
        "status": "confirmed",
        "last_verified_at": "2026-07-23",
        "assertion_ids": [
          "fact-bao-li-sex"
        ],
        "source_ids": [
          "src_smithsonian_giant_panda_faq",
          "src_smithsonian_giant_panda_page"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_commons_bao_li_photo",
        "publisher": "Wikimedia Commons",
        "title": "Bao Li",
        "url": "https://commons.wikimedia.org/wiki/File:Bao_Li.jpg",
        "published_at": null,
        "last_verified_at": "2026-07-23",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_smithsonian_giant_panda_faq",
        "publisher": "Smithsonian National Zoo and Conservation Biology Institute",
        "title": "Giant Panda FAQs",
        "url": "https://nationalzoo.si.edu/animals/giant-panda-faqs",
        "published_at": null,
        "last_verified_at": "2026-07-23",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_smithsonian_giant_panda_page",
        "publisher": "Smithsonian National Zoo and Conservation Biology Institute",
        "title": "Giant panda",
        "url": "https://nationalzoo.si.edu/animals/giant-panda",
        "published_at": null,
        "last_verified_at": "2026-07-23",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_smithsonian_history",
        "publisher": "Smithsonian National Zoo and Conservation Biology Institute",
        "title": "History of Giant Pandas at the Smithsonian's National Zoo and Conservation Biology Institute",
        "url": "https://nationalzoo.si.edu/animals/history-giant-pandas-zoo",
        "published_at": null,
        "last_verified_at": "2026-07-23",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": {
      "facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
      "coarse_location": null,
      "status": "confirmed",
      "last_verified_at": "2026-07-23"
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
        "last_verified_at": "2026-07-23",
        "source_ids": [
          "src_smithsonian_giant_panda_faq",
          "src_smithsonian_history"
        ]
      }
    ],
    "events": [
      {
        "id": "event-bao-li-birth",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2021-08-04",
        "event_date_precision": "day",
        "participants": [
          "434e10e3-7ba0-5de7-a59e-d3984524c58c"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
        "to_coarse_location": null,
        "source_ids": [
          "src_smithsonian_giant_panda_faq"
        ],
        "changes_current_residency": false
      },
      {
        "id": "event-bao-li-arrival-2024",
        "event_type": "arrival",
        "event_status": "completed",
        "event_date": "2024-10-15",
        "event_date_precision": "day",
        "participants": [
          "434e10e3-7ba0-5de7-a59e-d3984524c58c"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
        "to_coarse_location": null,
        "source_ids": [
          "src_smithsonian_history"
        ],
        "changes_current_residency": true
      },
      {
        "id": "event-bao-li-public-debut-2025",
        "event_type": "public_debut",
        "event_status": "completed",
        "event_date": "2025-01-24",
        "event_date_precision": "day",
        "participants": [
          "434e10e3-7ba0-5de7-a59e-d3984524c58c"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
        "to_coarse_location": null,
        "source_ids": [
          "src_smithsonian_history"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "complete_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "2021 年出生于四川，2024 年抵达史密森国家动物园，并于 2025 年 1 月公开亮相。"
      },
      {
        "locale": "en",
        "summary": "Born in Sichuan in 2021, arrived at the Smithsonian's National Zoo in 2024, and made his public debut in January 2025."
      }
    ],
    "media_release": {
      "license_state": "licensed",
      "display_mode": "gallery",
      "source_ids": [
        "src_commons_bao_li_photo"
      ]
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "补充出生地、抵达、公开亮相、现居场馆与收藏图片。"
        },
        {
          "locale": "en",
          "summary": "Added birthplace, arrival, public debut, current habitat, and collection media."
        }
      ]
    }
  },
  {
    "id": "47714294-e602-5f67-9a58-b0f43b7c5be5",
    "slug": "zhen-xi",
    "name_zh": "珍喜",
    "name_en": "Zhen Xi",
    "gender": "female",
    "status": "alive",
    "birth_date": "2017-07-15",
    "current_location": null,
    "cover_image_url": "https://api.zhipanda.com/media/releases/2026.07.24.2/media-zhen-xi-00447d48441585a6-w1080.webp",
    "search_terms": [
      "zhen-xi",
      "珍喜",
      "Zhen Xi"
    ],
    "intro": "珍喜是雌性大熊猫，2017年7月15日出生于成都大熊猫繁育研究基地，母亲为奇珍，初生体重168克；2017年9月参加新生幼仔集体亮相，2024年4月1日在星汉馆被基地官方记录到正在吃竹子。",
    "birthplace": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
    "tags": [
      "trusted-identity",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": "b3885324-97e3-5c10-aedb-ae9588342d4d",
    "habitats": [],
    "media": [
      {
        "id": "media-zhen-xi-00447d48441585a6",
        "panda_id": "47714294-e602-5f67-9a58-b0f43b7c5be5",
        "url": "https://api.zhipanda.com/media/releases/2026.07.24.2/media-zhen-xi-00447d48441585a6-w1080.webp",
        "source_url": "https://www.panda.org.cn/cn/news/news/2024-04-02/8339.html",
        "rights": "All rights reserved",
        "credit": "Chengdu Research Base of Giant Panda Breeding",
        "alt_zh": "珍喜在成都大熊猫繁育研究基地吃竹子",
        "alt_en": "Zhen Xi eating bamboo at the Chengdu Research Base",
        "status": "available",
        "sha256": "6dfc787ae21e15954ee667f3e0e8ec589119a13f7d56ef60be06ee302878d622",
        "mime_type": "image/webp",
        "width": 1080,
        "height": 608,
        "bytes": 137124,
        "derivatives": [
          {
            "bytes": 42148,
            "height": 270,
            "kind": "width-480",
            "mime_type": "image/webp",
            "sha256": "41cf26b1248498a8202f66b817f62e693eb010e43afdc7417388a219c08d35f8",
            "url": "https://api.zhipanda.com/media/releases/2026.07.24.2/media-zhen-xi-00447d48441585a6-w480.webp",
            "width": 480
          },
          {
            "bytes": 137124,
            "height": 608,
            "kind": "width-1080",
            "mime_type": "image/webp",
            "sha256": "6dfc787ae21e15954ee667f3e0e8ec589119a13f7d56ef60be06ee302878d622",
            "url": "https://api.zhipanda.com/media/releases/2026.07.24.2/media-zhen-xi-00447d48441585a6-w1080.webp",
            "width": 1080
          }
        ],
        "source_ids": [
          "src_chengdu_zhen_xi_visit_2024"
        ]
      }
    ],
    "identity": {
      "stable_id": "47714294-e602-5f67-9a58-b0f43b7c5be5",
      "canonical_slug": "zhen-xi",
      "names": [
        {
          "value": "珍喜",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_en",
            "src_chengdu_newborns_2017_zh",
            "src_chengdu_zhen_xi_visit_2024"
          ]
        },
        {
          "value": "Zhen Xi",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_en",
            "src_chengdu_newborns_2017_zh",
            "src_chengdu_zhen_xi_visit_2024"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2017-07-15",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-zhen-xi-birth-date"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh",
          "src_chengdu_zhen_xi_visit_2024"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "birthplace",
        "value": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-zhen-xi-birthplace"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh",
          "src_chengdu_zhen_xi_visit_2024"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-zhen-xi-current-coarse-location"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh",
          "src_chengdu_zhen_xi_visit_2024"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "female",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-zhen-xi-sex"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh",
          "src_chengdu_zhen_xi_visit_2024"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_chengdu_newborns_2017_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "Debut of 2017 Newborn Pandas",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-08-24/8080.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2017_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2017新生大熊猫宝宝齐亮相",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_zhen_xi_visit_2024",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "跨洋粉丝团来访，大熊猫再次“圈粉”！",
        "url": "https://www.panda.org.cn/cn/news/news/2024-04-02/8339.html",
        "published_at": "2024-04-02",
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_zhen_xi_birth_20170715",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2017-07-15",
        "event_date_precision": "day",
        "participants": [
          "47714294-e602-5f67-9a58-b0f43b7c5be5",
          "b3885324-97e3-5c10-aedb-ae9588342d4d"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "changes_current_residency": false
      },
      {
        "id": "evt_zhen_xi_cohort_debut_20170927",
        "event_type": "public_debut",
        "event_status": "completed",
        "event_date": "2017-09-27",
        "event_date_precision": "day",
        "participants": [
          "47714294-e602-5f67-9a58-b0f43b7c5be5"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "changes_current_residency": false
      },
      {
        "id": "evt_zhen_xi_xinghan_observation_20240401",
        "event_type": "observation",
        "event_status": "completed",
        "event_date": "2024-04-01",
        "event_date_precision": "day",
        "participants": [
          "47714294-e602-5f67-9a58-b0f43b7c5be5"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Xinghan Hall, Chengdu Research Base of Giant Panda Breeding",
        "source_ids": [
          "src_chengdu_zhen_xi_visit_2024"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "complete_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "珍喜是雌性大熊猫，2017年7月15日出生于成都大熊猫繁育研究基地，母亲为奇珍，初生体重168克；2017年9月参加新生幼仔集体亮相，2024年4月1日在星汉馆被基地官方记录到正在吃竹子。"
      },
      {
        "locale": "en",
        "summary": "Zhen Xi is a female giant panda born at the Chengdu Research Base on 2017-07-15 to mother Qi Zhen, with a recorded birth weight of 168 g. She joined the 2017 newborn cohort presentation and was officially observed eating bamboo at Xinghan Hall on 2024-04-01."
      }
    ],
    "media_release": {
      "license_state": "licensed",
      "display_mode": "gallery",
      "source_ids": [
        "src_chengdu_zhen_xi_visit_2024"
      ]
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "补充官方母系关系、出生细节、事件时间线与收藏图片。"
        },
        {
          "locale": "en",
          "summary": "Added official maternal lineage, birth details, timeline events, and collection media."
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
          "d24087cd-70d6-5902-92dd-ecc95186937b",
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
      "data_version": "2026.07.24.2",
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
    "id": "50afb182-8e05-5371-b341-253acb018792",
    "slug": "jing-liang",
    "name_zh": "晶亮",
    "name_en": "Jing Liang",
    "gender": "male",
    "status": "alive",
    "birth_date": "2017-07-10",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [
      "jing-liang",
      "晶亮",
      "Jing Liang"
    ],
    "intro": "晶亮，2017 年出生，收藏记录中的现居地为 Fuzhou Panda World, China。",
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
      "stable_id": "50afb182-8e05-5371-b341-253acb018792",
      "canonical_slug": "jing-liang",
      "names": [
        {
          "value": "晶亮",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_zh",
            "src_gpg_fuzhou_profiles"
          ]
        },
        {
          "value": "Jing Liang",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_zh",
            "src_gpg_fuzhou_profiles"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2017-07-10",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-jing-liang-birth-date"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_fuzhou_profiles"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "Fuzhou Panda World, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-jing-liang-current-coarse-location"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_fuzhou_profiles"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "male",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-jing-liang-sex"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_fuzhou_profiles"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_chengdu_newborns_2017_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "Debut of 2017 Newborn Pandas",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-08-24/8080.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2017_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2017新生大熊猫宝宝齐亮相",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      },
      {
        "id": "src_gpg_fuzhou_profiles",
        "publisher": "Giant Panda Global",
        "title": "Fuzhou Panda World giant pandas",
        "url": "https://www.giantpandaglobal.com/en/zoo/fuzhou-panda-world",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_jing_liang_birth_20170710",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2017-07-10",
        "event_date_precision": "day",
        "participants": [
          "50afb182-8e05-5371-b341-253acb018792"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "晶亮，2017 年出生，收藏记录中的现居地为 Fuzhou Panda World, China。"
      },
      {
        "locale": "en",
        "summary": "Fuzhou Panda World giant panda captured from secondary discovery index."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "由已审核收藏数据自动生成首轮档案。"
        },
        {
          "locale": "en",
          "summary": "Generated automatically from reviewed collection curation."
        }
      ]
    }
  },
  {
    "id": "51847c05-7342-5e4c-a5b5-c00d23f9a6be",
    "slug": "zhao-mei",
    "name_zh": "昭美",
    "name_en": "Zhao Mei",
    "gender": "female",
    "status": "alive",
    "birth_date": null,
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [
      "zhao-mei",
      "昭美",
      "Zhao Mei"
    ],
    "intro": "昭美，收藏记录中的现居地为 Chengdu Panda Base, Chengdu, Sichuan Province, China。",
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
      "stable_id": "51847c05-7342-5e4c-a5b5-c00d23f9a6be",
      "canonical_slug": "zhao-mei",
      "names": [
        {
          "value": "昭美",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2021_zh",
            "src_gpg_meet_world_page_9"
          ]
        },
        {
          "value": "Zhao Mei",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2021_zh",
            "src_gpg_meet_world_page_9"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [
      {
        "field": "current_coarse_location",
        "value": "Chengdu Panda Base, Chengdu, Sichuan Province, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-zhao-mei-current-coarse-location"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_meet_world_page_9"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "female",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-zhao-mei-sex"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_meet_world_page_9"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_chengdu_newborns_2021_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2021年新生大熊猫幼仔档案",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-07-07/6594.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      },
      {
        "id": "src_gpg_meet_world_page_9",
        "publisher": "Giant Panda Global",
        "title": "Meet the giant pandas around the world page 9",
        "url": "https://www.giantpandaglobal.com/en/meet-the-giant-pandas-around-the-world/?pagina=9",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "昭美，收藏记录中的现居地为 Chengdu Panda Base, Chengdu, Sichuan Province, China。"
      },
      {
        "locale": "en",
        "summary": "Living giant panda captured from GPG global discovery index."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "由已审核收藏数据自动生成首轮档案。"
        },
        {
          "locale": "en",
          "summary": "Generated automatically from reviewed collection curation."
        }
      ]
    }
  },
  {
    "id": "57c0a1bd-cc44-5a08-ba48-f224e9956064",
    "slug": "ri-ri",
    "name_zh": "力力",
    "name_en": "Ri Ri",
    "gender": "male",
    "status": "alive",
    "birth_date": "2005-08-16",
    "current_location": "中国大熊猫保护研究中心雅安碧峰峡基地",
    "cover_image_url": "https://api.zhipanda.com/media/releases/2026.07.20.2/media-ri-ri-03e20f3f6a0e2db3-w1200.webp",
    "search_terms": [
      "ri-ri",
      "力力",
      "Ri Ri",
      "Bi Li",
      "Li Li",
      "riri",
      "tokyo_zoo_profile_key:ri-ri"
    ],
    "intro": "2005 年出生于卧龙、2011 年抵达上野动物园的雄性大熊猫，2024 年返回雅安碧峰峡基地。",
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
        "id": "media-ri-ri-03e20f3f6a0e2db3",
        "panda_id": "57c0a1bd-cc44-5a08-ba48-f224e9956064",
        "url": "https://api.zhipanda.com/media/releases/2026.07.20.2/media-ri-ri-03e20f3f6a0e2db3-w1200.webp",
        "source_url": "https://commons.wikimedia.org/wiki/File:Ri_Ri.jpg",
        "rights": "CC BY-SA 4.0",
        "credit": "EleniXDD / Wikimedia Commons",
        "alt_zh": "力力在上野动物园",
        "alt_en": "Ri Ri at Ueno Zoo",
        "status": "available",
        "sha256": "6c82d51b23005880d5121e1d310994dce18a1a28f495779e72f7a81b7ef7910d",
        "mime_type": "image/webp",
        "width": 1200,
        "height": 901,
        "bytes": 180764,
        "derivatives": [
          {
            "bytes": 49486,
            "height": 360,
            "kind": "width-480",
            "mime_type": "image/webp",
            "sha256": "2b38313c0a7b54725958328ab4b4c532be03dfe3e0caf86b136a577b15c81230",
            "url": "https://api.zhipanda.com/media/releases/2026.07.20.2/media-ri-ri-03e20f3f6a0e2db3-w480.webp",
            "width": 480
          },
          {
            "bytes": 180764,
            "height": 901,
            "kind": "width-1200",
            "mime_type": "image/webp",
            "sha256": "6c82d51b23005880d5121e1d310994dce18a1a28f495779e72f7a81b7ef7910d",
            "url": "https://api.zhipanda.com/media/releases/2026.07.20.2/media-ri-ri-03e20f3f6a0e2db3-w1200.webp",
            "width": 1200
          }
        ],
        "source_ids": [
          "src_commons_ri_ri_photo"
        ]
      }
    ],
    "identity": {
      "stable_id": "57c0a1bd-cc44-5a08-ba48-f224e9956064",
      "canonical_slug": "ri-ri",
      "names": [
        {
          "value": "力力",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history",
            "src_ueno_return_riri_shinshin"
          ]
        },
        {
          "value": "Ri Ri",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history",
            "src_ueno_return_riri_shinshin"
          ]
        }
      ],
      "aliases": [
        {
          "value": "Bi Li",
          "language": "en",
          "kind": "alternate_romanization",
          "primary": false,
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history",
            "src_ueno_return_riri_shinshin"
          ]
        },
        {
          "value": "Li Li",
          "language": "en",
          "kind": "alternate_romanization",
          "primary": false,
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history",
            "src_ueno_return_riri_shinshin"
          ]
        }
      ],
      "legacy_slugs": [
        {
          "value": "riri",
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history"
          ]
        }
      ],
      "external_identifiers": [
        {
          "system": "tokyo_zoo_profile_key",
          "value": "ri-ri",
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history"
          ]
        }
      ]
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2005-08-16",
        "status": "confirmed",
        "last_verified_at": "2026-07-20",
        "assertion_ids": [
          "fact-ri-ri-birth-date"
        ],
        "source_ids": [
          "src_tokyo_zoo_ueno_panda_history",
          "src_ueno_return_riri_shinshin"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_facility",
        "value": "CCRCGP Bifengxia Base",
        "status": "confirmed",
        "last_verified_at": "2026-05-10",
        "assertion_ids": [
          "fact-ri-ri-current-place"
        ],
        "source_ids": [
          "src_ueno_return_riri_shinshin",
          "src_gpg_yaan_base_profiles"
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
          "fact-ri-ri-sex"
        ],
        "source_ids": [
          "src_tokyo_zoo_ueno_panda_history",
          "src_ueno_return_riri_shinshin"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_commons_ri_ri_photo",
        "publisher": "Wikimedia Commons",
        "title": "Ri Ri",
        "url": "https://commons.wikimedia.org/wiki/File:Ri_Ri.jpg",
        "published_at": "2024-07-03",
        "last_verified_at": "2026-07-20",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_gpg_yaan_base_profiles",
        "publisher": "Giant Panda Global",
        "title": "CCRCGP Ya'an Base giant pandas",
        "url": "https://www.giantpandaglobal.com/en/zoo/ccrcgp-yaan-base",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_tokyo_zoo_ueno_panda_history",
        "publisher": "Tokyo Zoological Park Society",
        "title": "Past giant pandas kept at Ueno Zoo",
        "url": "https://www.tokyo-zoo.net/ueno/panda/history/index.html",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_ueno_return_riri_shinshin",
        "publisher": "Tokyo Zoological Park Society",
        "title": "Regarding the return of Giant Panda Ri Ri and Shin Shin",
        "url": "https://www.tokyo-zoo.net/en/topics/news/ueno/355_28750_2024-09-29.html",
        "published_at": "2024-08-30",
        "last_verified_at": "2026-05-09",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": {
      "facility_id": "7e8c3dc5-0725-5c1e-bc97-53f3e9c47995",
      "coarse_location": null,
      "status": "confirmed",
      "last_verified_at": "2026-05-10"
    },
    "residencies": [
      {
        "id": "res-ri-ri-ueno",
        "facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "2011-02-21",
        "start_precision": "day",
        "end_date": "2024-09-29",
        "end_precision": "day",
        "status": "confirmed",
        "last_verified_at": null,
        "source_ids": [
          "src_tokyo_zoo_ueno_panda_history",
          "src_ueno_return_riri_shinshin"
        ]
      },
      {
        "id": "res-ri-ri-bifengxia",
        "facility_id": "7e8c3dc5-0725-5c1e-bc97-53f3e9c47995",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "2024-09-29",
        "start_precision": "day",
        "end_date": null,
        "end_precision": null,
        "status": "confirmed",
        "last_verified_at": "2026-05-10",
        "source_ids": [
          "src_ueno_return_riri_shinshin",
          "src_gpg_yaan_base_profiles"
        ]
      }
    ],
    "events": [
      {
        "id": "event-ri-ri-birth",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2005-08-16",
        "event_date_precision": "day",
        "participants": [
          "57c0a1bd-cc44-5a08-ba48-f224e9956064"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": null,
        "source_ids": [
          "src_tokyo_zoo_ueno_panda_history",
          "src_ueno_return_riri_shinshin"
        ],
        "changes_current_residency": false
      },
      {
        "id": "event-ueno-pair-arrival-2011",
        "event_type": "arrival",
        "event_status": "completed",
        "event_date": "2011-02-21",
        "event_date_precision": "day",
        "participants": [
          "57c0a1bd-cc44-5a08-ba48-f224e9956064",
          "01878819-1eda-5d9c-96ab-bab66d3b0b09"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
        "to_coarse_location": null,
        "source_ids": [
          "src_tokyo_zoo_ueno_panda_history",
          "src_ueno_return_riri_shinshin"
        ],
        "changes_current_residency": false
      },
      {
        "id": "event-ueno-pair-return-2024",
        "event_type": "transfer",
        "event_status": "completed",
        "event_date": "2024-09-29",
        "event_date_precision": "day",
        "participants": [
          "57c0a1bd-cc44-5a08-ba48-f224e9956064",
          "01878819-1eda-5d9c-96ab-bab66d3b0b09"
        ],
        "from_facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
        "from_coarse_location": null,
        "to_facility_id": "7e8c3dc5-0725-5c1e-bc97-53f3e9c47995",
        "to_coarse_location": null,
        "source_ids": [
          "src_ueno_return_riri_shinshin"
        ],
        "changes_current_residency": true
      }
    ],
    "record_tier": "complete_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "2005 年出生于卧龙、2011 年抵达上野动物园的雄性大熊猫，2024 年返回雅安碧峰峡基地。"
      },
      {
        "locale": "en",
        "summary": "Male giant panda born in Wolong in 2005, resident at Ueno Zoo from 2011, and returned to Bifengxia Base in 2024."
      }
    ],
    "media_release": {
      "license_state": "licensed",
      "display_mode": "gallery",
      "source_ids": [
        "src_commons_ri_ri_photo"
      ]
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "完成身份、出生、居住、事件、亲缘与授权照片的公开审核。"
        },
        {
          "locale": "en",
          "summary": "Reviewed identity, birth, residency, events, lineage, and licensed media."
        }
      ]
    }
  },
  {
    "id": "6457a76c-827c-50f5-9306-075d80e8e1d0",
    "slug": "cheng-lan",
    "name_zh": "成兰",
    "name_en": "Cheng Lan",
    "gender": "male",
    "status": "alive",
    "birth_date": "2017-06-27",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [
      "cheng-lan",
      "成兰",
      "Cheng Lan"
    ],
    "intro": "成兰，2017 年出生，收藏记录中的现居地为 Chengdu Panda Base, Chengdu, Sichuan Province, China。",
    "birthplace": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan Province, China",
    "tags": [
      "trusted-identity",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": null,
    "habitats": [],
    "media": [],
    "identity": {
      "stable_id": "6457a76c-827c-50f5-9306-075d80e8e1d0",
      "canonical_slug": "cheng-lan",
      "names": [
        {
          "value": "成兰",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_zh",
            "src_gpg_meet_world_page_18"
          ]
        },
        {
          "value": "Cheng Lan",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_zh",
            "src_gpg_meet_world_page_18"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2017-06-27",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-cheng-lan-birth-date"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_meet_world_page_18"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "birthplace",
        "value": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan Province, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-cheng-lan-birthplace"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_meet_world_page_18"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "Chengdu Panda Base, Chengdu, Sichuan Province, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-cheng-lan-current-coarse-location"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_meet_world_page_18"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "male",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-cheng-lan-sex"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_meet_world_page_18"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_chengdu_newborns_2017_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "Debut of 2017 Newborn Pandas",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-08-24/8080.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2017_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2017新生大熊猫宝宝齐亮相",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      },
      {
        "id": "src_gpg_meet_world_page_18",
        "publisher": "Giant Panda Global",
        "title": "Meet the giant pandas around the world page 18",
        "url": "https://www.giantpandaglobal.com/en/meet-the-giant-pandas-around-the-world/?pagina=18",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_cheng_lan_birth_20170627",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2017-06-27",
        "event_date_precision": "day",
        "participants": [
          "6457a76c-827c-50f5-9306-075d80e8e1d0"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "成兰，2017 年出生，收藏记录中的现居地为 Chengdu Panda Base, Chengdu, Sichuan Province, China。"
      },
      {
        "locale": "en",
        "summary": "Living Chengdu Panda Base male giant panda captured from GPG global living index page 18."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "由已审核收藏数据自动生成首轮档案。"
        },
        {
          "locale": "en",
          "summary": "Generated automatically from reviewed collection curation."
        }
      ]
    }
  },
  {
    "id": "70e56c3f-4290-55b9-abb5-79fe098f1a07",
    "slug": "xiao-yatou",
    "name_zh": "小丫头",
    "name_en": "Xiao Yatou",
    "gender": "female",
    "status": "unknown",
    "birth_date": null,
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [
      "xiao-yatou",
      "小丫头",
      "Xiao Yatou"
    ],
    "intro": "成都基地官方新生幼仔档案确认小丫头为小馨的母亲。",
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
      "stable_id": "70e56c3f-4290-55b9-abb5-79fe098f1a07",
      "canonical_slug": "xiao-yatou",
      "names": [
        {
          "value": "小丫头",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_en",
            "src_chengdu_newborns_2017_zh"
          ]
        },
        {
          "value": "Xiao Yatou",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_en",
            "src_chengdu_newborns_2017_zh"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [],
    "sources": [
      {
        "id": "src_chengdu_newborns_2017_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "Debut of 2017 Newborn Pandas",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-08-24/8080.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2017_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2017新生大熊猫宝宝齐亮相",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_xiao_xin_chengdu_2017_birth_20170726",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2017-07-26",
        "event_date_precision": "day",
        "participants": [
          "2a589b9f-1700-5b1e-8c2f-8203190da905",
          "70e56c3f-4290-55b9-abb5-79fe098f1a07"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "成都基地官方新生幼仔档案确认小丫头为小馨的母亲。"
      },
      {
        "locale": "en",
        "summary": "An official Chengdu newborn record identifies Xiao Yatou as the mother of Xiao Xin."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "建立仅含官方母系身份依据的首轮关系档案。"
        },
        {
          "locale": "en",
          "summary": "Created an identity-first maternal relationship profile."
        }
      ]
    }
  },
  {
    "id": "75e9524a-9baf-5454-af65-229fea00cd20",
    "slug": "da-mei-changsha",
    "name_zh": "大美",
    "name_en": "Da Mei",
    "gender": "female",
    "status": "alive",
    "birth_date": "2017-06-27",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [
      "da-mei-changsha",
      "大美",
      "Da Mei"
    ],
    "intro": "大美，2017 年出生，收藏记录中的现居地为 Changsha Ecological Zoo, China。",
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
      "stable_id": "75e9524a-9baf-5454-af65-229fea00cd20",
      "canonical_slug": "da-mei-changsha",
      "names": [
        {
          "value": "大美",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_zh",
            "src_gpg_changsha_profiles"
          ]
        },
        {
          "value": "Da Mei",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_zh",
            "src_gpg_changsha_profiles"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2017-06-27",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-da-mei-changsha-birth-date"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_changsha_profiles"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "Changsha Ecological Zoo, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-da-mei-changsha-current-coarse-location"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_changsha_profiles"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "female",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-da-mei-changsha-sex"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_changsha_profiles"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_chengdu_newborns_2017_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "Debut of 2017 Newborn Pandas",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-08-24/8080.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2017_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2017新生大熊猫宝宝齐亮相",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      },
      {
        "id": "src_gpg_changsha_profiles",
        "publisher": "Giant Panda Global",
        "title": "Changsha Ecological Zoo giant pandas",
        "url": "https://www.giantpandaglobal.com/en/zoo/changsha-ecological-zoo",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_da_mei_changsha_birth_20170627",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2017-06-27",
        "event_date_precision": "day",
        "participants": [
          "75e9524a-9baf-5454-af65-229fea00cd20"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "大美，2017 年出生，收藏记录中的现居地为 Changsha Ecological Zoo, China。"
      },
      {
        "locale": "en",
        "summary": "Changsha Ecological Zoo giant panda captured from secondary discovery index."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "由已审核收藏数据自动生成首轮档案。"
        },
        {
          "locale": "en",
          "summary": "Generated automatically from reviewed collection curation."
        }
      ]
    }
  },
  {
    "id": "771b6aef-2075-5d3e-8a82-7adc5822b99c",
    "slug": "a-bao",
    "name_zh": "阿宝",
    "name_en": "A Bao",
    "gender": "female",
    "status": "unknown",
    "birth_date": null,
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [
      "a-bao",
      "阿宝",
      "A Bao"
    ],
    "intro": "成都基地官方新生幼仔档案确认阿宝为宝新的母亲。",
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
      "stable_id": "771b6aef-2075-5d3e-8a82-7adc5822b99c",
      "canonical_slug": "a-bao",
      "names": [
        {
          "value": "阿宝",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2021_en",
            "src_chengdu_newborns_2021_zh"
          ]
        },
        {
          "value": "A Bao",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2021_en",
            "src_chengdu_newborns_2021_zh"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [],
    "sources": [
      {
        "id": "src_chengdu_newborns_2021_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2021 Newborn Giant Panda Profiles",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-09-19/8165.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2021_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2021年新生大熊猫幼仔档案",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-07-07/6594.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_bao_xin_birth_20210624",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2021-06-24",
        "event_date_precision": "day",
        "participants": [
          "0f7f494a-ec00-5e43-92e0-d299fe858d95",
          "771b6aef-2075-5d3e-8a82-7adc5822b99c"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
        "source_ids": [
          "src_chengdu_newborns_2021_en",
          "src_chengdu_newborns_2021_zh"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "成都基地官方新生幼仔档案确认阿宝为宝新的母亲。"
      },
      {
        "locale": "en",
        "summary": "An official Chengdu newborn record identifies A Bao as the mother of Bao Xin."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "建立仅含官方母系身份依据的首轮关系档案。"
        },
        {
          "locale": "en",
          "summary": "Created an identity-first maternal relationship profile."
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
        "last_verified_at": "2026-07-23",
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
      "data_version": "2026.07.24.2",
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
    "id": "907e93e2-d664-500f-b1b5-af06fd039172",
    "slug": "zhi-shi",
    "name_zh": "芝士",
    "name_en": "Zhi Shi",
    "gender": "male",
    "status": "alive",
    "birth_date": "2017-04-24",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [
      "zhi-shi",
      "芝士",
      "Zhi Shi"
    ],
    "intro": "芝士，2017 年出生，收藏记录中的现居地为 Sun Island Giant Panda Pavilion, Harbin, Heilongjiang Province, China。",
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
      "stable_id": "907e93e2-d664-500f-b1b5-af06fd039172",
      "canonical_slug": "zhi-shi",
      "names": [
        {
          "value": "芝士",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_zh",
            "src_gpg_sun_island_profiles"
          ]
        },
        {
          "value": "Zhi Shi",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_zh",
            "src_gpg_sun_island_profiles"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2017-04-24",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-zhi-shi-birth-date"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_sun_island_profiles"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "Sun Island Giant Panda Pavilion, Harbin, Heilongjiang Province, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-zhi-shi-current-coarse-location"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_sun_island_profiles"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "male",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-zhi-shi-sex"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_sun_island_profiles"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_chengdu_newborns_2017_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "Debut of 2017 Newborn Pandas",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-08-24/8080.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2017_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2017新生大熊猫宝宝齐亮相",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      },
      {
        "id": "src_gpg_sun_island_profiles",
        "publisher": "Giant Panda Global",
        "title": "Sun Island Giant Panda Pavilion giant pandas",
        "url": "https://www.giantpandaglobal.com/en/zoo/sun-island-giant-panda-pavilion",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_zhi_shi_birth_20170424",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2017-04-24",
        "event_date_precision": "day",
        "participants": [
          "907e93e2-d664-500f-b1b5-af06fd039172"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "芝士，2017 年出生，收藏记录中的现居地为 Sun Island Giant Panda Pavilion, Harbin, Heilongjiang Province, China。"
      },
      {
        "locale": "en",
        "summary": "Sun Island Giant Panda Pavilion giant panda captured from secondary discovery index."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "由已审核收藏数据自动生成首轮档案。"
        },
        {
          "locale": "en",
          "summary": "Generated automatically from reviewed collection curation."
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
        "id": "src_ccrcgp_2025_birthday_season",
        "publisher": "China.org.cn / Xinhua",
        "title": "前方高萌 卧龙神树坪基地举办大熊猫集体生日会",
        "url": "https://www.china.org.cn/2025-07/18/content_117984485_4.shtml",
        "published_at": "2025-07-18",
        "last_verified_at": "2026-05-10",
        "language": "zh-Hans",
        "access_state": "accessible"
      },
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
        "last_verified_at": "2026-07-23",
        "language": "en",
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
      "data_version": "2026.07.24.2",
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
    "id": "939aed44-55a9-51e6-8f2e-c50866be3a6a",
    "slug": "zhi-ma",
    "name_zh": "芝麻",
    "name_en": "Zhi Ma",
    "gender": "male",
    "status": "alive",
    "birth_date": "2017-04-24",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [
      "zhi-ma",
      "芝麻",
      "Zhi Ma"
    ],
    "intro": "芝麻，2017 年出生，收藏记录中的现居地为 Sun Island Giant Panda Pavilion, Harbin, Heilongjiang Province, China。",
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
      "stable_id": "939aed44-55a9-51e6-8f2e-c50866be3a6a",
      "canonical_slug": "zhi-ma",
      "names": [
        {
          "value": "芝麻",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_zh",
            "src_gpg_sun_island_profiles"
          ]
        },
        {
          "value": "Zhi Ma",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_zh",
            "src_gpg_sun_island_profiles"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2017-04-24",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-zhi-ma-birth-date"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_sun_island_profiles"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "Sun Island Giant Panda Pavilion, Harbin, Heilongjiang Province, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-zhi-ma-current-coarse-location"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_sun_island_profiles"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "male",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-zhi-ma-sex"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_sun_island_profiles"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_chengdu_newborns_2017_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "Debut of 2017 Newborn Pandas",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-08-24/8080.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2017_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2017新生大熊猫宝宝齐亮相",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      },
      {
        "id": "src_gpg_sun_island_profiles",
        "publisher": "Giant Panda Global",
        "title": "Sun Island Giant Panda Pavilion giant pandas",
        "url": "https://www.giantpandaglobal.com/en/zoo/sun-island-giant-panda-pavilion",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_zhi_ma_birth_20170424",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2017-04-24",
        "event_date_precision": "day",
        "participants": [
          "939aed44-55a9-51e6-8f2e-c50866be3a6a"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "芝麻，2017 年出生，收藏记录中的现居地为 Sun Island Giant Panda Pavilion, Harbin, Heilongjiang Province, China。"
      },
      {
        "locale": "en",
        "summary": "Sun Island Giant Panda Pavilion giant panda captured from secondary discovery index."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "由已审核收藏数据自动生成首轮档案。"
        },
        {
          "locale": "en",
          "summary": "Generated automatically from reviewed collection curation."
        }
      ]
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
        "last_verified_at": "2026-07-23",
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
      "data_version": "2026.07.24.2",
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
    "id": "b3885324-97e3-5c10-aedb-ae9588342d4d",
    "slug": "qi-zhen",
    "name_zh": "奇珍",
    "name_en": "Qi Zhen",
    "gender": "female",
    "status": "unknown",
    "birth_date": null,
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [
      "qi-zhen",
      "奇珍",
      "Qi Zhen"
    ],
    "intro": "成都基地官方新生幼仔档案确认奇珍为珍喜的母亲。",
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
      "stable_id": "b3885324-97e3-5c10-aedb-ae9588342d4d",
      "canonical_slug": "qi-zhen",
      "names": [
        {
          "value": "奇珍",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_en",
            "src_chengdu_newborns_2017_zh",
            "src_chengdu_zhen_xi_visit_2024"
          ]
        },
        {
          "value": "Qi Zhen",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_en",
            "src_chengdu_newborns_2017_zh",
            "src_chengdu_zhen_xi_visit_2024"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [],
    "sources": [
      {
        "id": "src_chengdu_newborns_2017_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "Debut of 2017 Newborn Pandas",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-08-24/8080.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2017_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2017新生大熊猫宝宝齐亮相",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_zhen_xi_visit_2024",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "跨洋粉丝团来访，大熊猫再次“圈粉”！",
        "url": "https://www.panda.org.cn/cn/news/news/2024-04-02/8339.html",
        "published_at": "2024-04-02",
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_zhen_xi_birth_20170715",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2017-07-15",
        "event_date_precision": "day",
        "participants": [
          "47714294-e602-5f67-9a58-b0f43b7c5be5",
          "b3885324-97e3-5c10-aedb-ae9588342d4d"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "成都基地官方新生幼仔档案确认奇珍为珍喜的母亲。"
      },
      {
        "locale": "en",
        "summary": "An official Chengdu newborn record identifies Qi Zhen as the mother of Zhen Xi."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "建立仅含官方母系身份依据的首轮关系档案。"
        },
        {
          "locale": "en",
          "summary": "Created an identity-first maternal relationship profile."
        }
      ]
    }
  },
  {
    "id": "c2eefef1-54f2-58ca-85cc-c2fd3d63653a",
    "slug": "lei-lei",
    "name_zh": "蕾蕾",
    "name_en": "Lei Lei",
    "gender": "female",
    "status": "alive",
    "birth_date": "2021-06-23",
    "current_location": "中国大熊猫保护研究中心雅安基地",
    "cover_image_url": "https://api.zhipanda.com/media/releases/2026.07.20.2/media-lei-lei-0ab099655565d415-w1200.webp",
    "search_terms": [
      "lei-lei",
      "蕾蕾",
      "Lei Lei",
      "leilei",
      "tokyo_zoo_profile_key:lei-lei"
    ],
    "intro": "力力与真真之女，2021 年出生于上野动物园，与晓晓为双胞胎，2026 年返回雅安基地。",
    "birthplace": null,
    "tags": [
      "trusted-identity",
      "golden-dataset"
    ],
    "father_id": "57c0a1bd-cc44-5a08-ba48-f224e9956064",
    "mother_id": "01878819-1eda-5d9c-96ab-bab66d3b0b09",
    "habitats": [],
    "media": [
      {
        "id": "media-lei-lei-0ab099655565d415",
        "panda_id": "c2eefef1-54f2-58ca-85cc-c2fd3d63653a",
        "url": "https://api.zhipanda.com/media/releases/2026.07.20.2/media-lei-lei-0ab099655565d415-w1200.webp",
        "source_url": "https://commons.wikimedia.org/wiki/File:Ailuropoda_melanoleuca_Lei_Lei_Xiao_Xiao_220610h.jpg",
        "rights": "CC BY-SA 4.0",
        "credit": "江戸村のとくぞう / Wikimedia Commons",
        "alt_zh": "蕾蕾与晓晓在上野动物园的栖息地内相伴",
        "alt_en": "Lei Lei and Xiao Xiao together in their habitat at Ueno Zoo",
        "status": "available",
        "sha256": "2fe959d611ea18e2804ab0c10708df11f6a04871d15e800761fe30f1151cb00a",
        "mime_type": "image/webp",
        "width": 1200,
        "height": 976,
        "bytes": 161952,
        "derivatives": [
          {
            "bytes": 31488,
            "height": 390,
            "kind": "width-480",
            "mime_type": "image/webp",
            "sha256": "55e84e692983374a629173cddfb0ca0927356e0b16b2b02b6ccb142e2b45b75c",
            "url": "https://api.zhipanda.com/media/releases/2026.07.20.2/media-lei-lei-0ab099655565d415-w480.webp",
            "width": 480
          },
          {
            "bytes": 161952,
            "height": 976,
            "kind": "width-1200",
            "mime_type": "image/webp",
            "sha256": "2fe959d611ea18e2804ab0c10708df11f6a04871d15e800761fe30f1151cb00a",
            "url": "https://api.zhipanda.com/media/releases/2026.07.20.2/media-lei-lei-0ab099655565d415-w1200.webp",
            "width": 1200
          }
        ],
        "source_ids": [
          "src_commons_lei_lei_xiao_xiao_photo"
        ]
      }
    ],
    "identity": {
      "stable_id": "c2eefef1-54f2-58ca-85cc-c2fd3d63653a",
      "canonical_slug": "lei-lei",
      "names": [
        {
          "value": "蕾蕾",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history",
            "src_ueno_twins_names_2021",
            "src_ueno_xiaolei_return_2026"
          ]
        },
        {
          "value": "Lei Lei",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history",
            "src_ueno_twins_names_2021",
            "src_ueno_xiaolei_return_2026"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [
        {
          "value": "leilei",
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history"
          ]
        }
      ],
      "external_identifiers": [
        {
          "system": "tokyo_zoo_profile_key",
          "value": "lei-lei",
          "source_ids": [
            "src_tokyo_zoo_ueno_panda_history"
          ]
        }
      ]
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2021-06-23",
        "status": "confirmed",
        "last_verified_at": "2026-07-20",
        "assertion_ids": [
          "fact-lei-lei-birth-date"
        ],
        "source_ids": [
          "src_tokyo_zoo_ueno_panda_history",
          "src_ueno_twins_names_2021"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_facility",
        "value": "CCRCGP Ya'an Base",
        "status": "confirmed",
        "last_verified_at": "2026-05-10",
        "assertion_ids": [
          "fact-lei-lei-current-place"
        ],
        "source_ids": [
          "src_ueno_xiaolei_return_2026"
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
          "fact-lei-lei-sex"
        ],
        "source_ids": [
          "src_tokyo_zoo_ueno_panda_history",
          "src_ueno_twins_names_2021"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_commons_lei_lei_xiao_xiao_photo",
        "publisher": "Wikimedia Commons",
        "title": "Ailuropoda melanoleuca Lei Lei Xiao Xiao 220610h",
        "url": "https://commons.wikimedia.org/wiki/File:Ailuropoda_melanoleuca_Lei_Lei_Xiao_Xiao_220610h.jpg",
        "published_at": "2022-06-10",
        "last_verified_at": "2026-07-20",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_tokyo_zoo_ueno_panda_history",
        "publisher": "Tokyo Zoological Park Society",
        "title": "Past giant pandas kept at Ueno Zoo",
        "url": "https://www.tokyo-zoo.net/ueno/panda/history/index.html",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_ueno_twins_names_2021",
        "publisher": "Tokyo Zoological Park Society",
        "title": "The names of Giant Panda twins have been decided as Xiao Xiao and Lei Lei",
        "url": "https://www.tokyo-zoo.net/en/topics/news/ueno/1681_27052_2021-10-08.html",
        "published_at": "2021-10-08",
        "last_verified_at": "2026-07-20",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_ueno_xiaolei_return_2026",
        "publisher": "Tokyo Zoological Park Society",
        "title": "Giant Panda Xiao Xiao and Lei Lei arrive at the Ya'an Base",
        "url": "https://www.tokyo-zoo.net/en/ueno/news/5238/index.html",
        "published_at": "2026-01-28",
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": {
      "facility_id": "d773a478-6014-5a4f-9e29-a0903f4beea6",
      "coarse_location": null,
      "status": "confirmed",
      "last_verified_at": "2026-05-10"
    },
    "residencies": [
      {
        "id": "res-lei-lei-ueno",
        "facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "2021-06-23",
        "start_precision": "day",
        "end_date": "2026-01-28",
        "end_precision": "day",
        "status": "confirmed",
        "last_verified_at": null,
        "source_ids": [
          "src_tokyo_zoo_ueno_panda_history"
        ]
      },
      {
        "id": "res-lei-lei-yaan",
        "facility_id": "d773a478-6014-5a4f-9e29-a0903f4beea6",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "2026-01-28",
        "start_precision": "day",
        "end_date": null,
        "end_precision": null,
        "status": "confirmed",
        "last_verified_at": "2026-05-10",
        "source_ids": [
          "src_ueno_xiaolei_return_2026"
        ]
      }
    ],
    "events": [
      {
        "id": "event-ueno-twins-birth-2021",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2021-06-23",
        "event_date_precision": "day",
        "participants": [
          "275ad0df-c700-5991-a13a-0ca47c56eeba",
          "c2eefef1-54f2-58ca-85cc-c2fd3d63653a"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
        "to_coarse_location": null,
        "source_ids": [
          "src_tokyo_zoo_ueno_panda_history",
          "src_ueno_twins_names_2021"
        ],
        "changes_current_residency": false
      },
      {
        "id": "event-ueno-twins-named-2021",
        "event_type": "naming",
        "event_status": "completed",
        "event_date": "2021-10-08",
        "event_date_precision": "day",
        "participants": [
          "275ad0df-c700-5991-a13a-0ca47c56eeba",
          "c2eefef1-54f2-58ca-85cc-c2fd3d63653a"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
        "to_coarse_location": null,
        "source_ids": [
          "src_ueno_twins_names_2021"
        ],
        "changes_current_residency": false
      },
      {
        "id": "event-ueno-twins-return-2026",
        "event_type": "transfer",
        "event_status": "completed",
        "event_date": "2026-01-28",
        "event_date_precision": "day",
        "participants": [
          "275ad0df-c700-5991-a13a-0ca47c56eeba",
          "c2eefef1-54f2-58ca-85cc-c2fd3d63653a"
        ],
        "from_facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
        "from_coarse_location": null,
        "to_facility_id": "d773a478-6014-5a4f-9e29-a0903f4beea6",
        "to_coarse_location": null,
        "source_ids": [
          "src_ueno_xiaolei_return_2026"
        ],
        "changes_current_residency": true
      }
    ],
    "record_tier": "complete_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "力力与真真之女，2021 年出生于上野动物园，与晓晓为双胞胎，2026 年返回雅安基地。"
      },
      {
        "locale": "en",
        "summary": "Daughter of Ri Ri and Shin Shin, born at Ueno Zoo in 2021, twin of Xiao Xiao, and returned to Ya'an Base in 2026."
      }
    ],
    "media_release": {
      "license_state": "licensed",
      "display_mode": "gallery",
      "source_ids": [
        "src_commons_lei_lei_xiao_xiao_photo"
      ]
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "完成身份、出生、居住、事件、亲缘与授权照片的公开审核。"
        },
        {
          "locale": "en",
          "summary": "Reviewed identity, birth, residency, events, lineage, and licensed media."
        }
      ]
    }
  },
  {
    "id": "ca531a8b-63d2-5f16-9fbc-0e61e2e23297",
    "slug": "ni-ke",
    "name_zh": "妮可",
    "name_en": "Ni Ke",
    "gender": "male",
    "status": "alive",
    "birth_date": "2017-07-20",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [
      "ni-ke",
      "妮可",
      "Ni Ke"
    ],
    "intro": "妮可，2017 年出生，收藏记录中的现居地为 Chengdu Panda Base, Chengdu, Sichuan Province, China。",
    "birthplace": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan Province, China",
    "tags": [
      "trusted-identity",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": null,
    "habitats": [],
    "media": [],
    "identity": {
      "stable_id": "ca531a8b-63d2-5f16-9fbc-0e61e2e23297",
      "canonical_slug": "ni-ke",
      "names": [
        {
          "value": "妮可",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_zh",
            "src_gpg_meet_world_page_18"
          ]
        },
        {
          "value": "Ni Ke",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_zh",
            "src_gpg_meet_world_page_18"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2017-07-20",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-ni-ke-birth-date"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_meet_world_page_18"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "birthplace",
        "value": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan Province, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-ni-ke-birthplace"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_meet_world_page_18"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "Chengdu Panda Base, Chengdu, Sichuan Province, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-ni-ke-current-coarse-location"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_meet_world_page_18"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "male",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-ni-ke-sex"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_meet_world_page_18"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_chengdu_newborns_2017_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "Debut of 2017 Newborn Pandas",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-08-24/8080.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2017_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2017新生大熊猫宝宝齐亮相",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      },
      {
        "id": "src_gpg_meet_world_page_18",
        "publisher": "Giant Panda Global",
        "title": "Meet the giant pandas around the world page 18",
        "url": "https://www.giantpandaglobal.com/en/meet-the-giant-pandas-around-the-world/?pagina=18",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_ni_ke_birth_20170720",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2017-07-20",
        "event_date_precision": "day",
        "participants": [
          "ca531a8b-63d2-5f16-9fbc-0e61e2e23297"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "妮可，2017 年出生，收藏记录中的现居地为 Chengdu Panda Base, Chengdu, Sichuan Province, China。"
      },
      {
        "locale": "en",
        "summary": "Living Chengdu Panda Base male giant panda captured from GPG global living index page 18."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "由已审核收藏数据自动生成首轮档案。"
        },
        {
          "locale": "en",
          "summary": "Generated automatically from reviewed collection curation."
        }
      ]
    }
  },
  {
    "id": "d24087cd-70d6-5902-92dd-ecc95186937b",
    "slug": "xi-lun",
    "name_zh": "喜伦",
    "name_en": "Xi Lun",
    "gender": "female",
    "status": "alive",
    "birth_date": "2016-09-03",
    "current_location": "成都大熊猫繁育研究基地",
    "cover_image_url": "https://api.zhipanda.com/media/releases/2026.07.21.1/media-xi-lun-de9774371d2f2427-w1200.webp",
    "search_terms": [
      "xi-lun",
      "喜伦",
      "Xi Lun",
      "xilun",
      "zoo_atlanta_profile_key:xi-lun"
    ],
    "intro": "伦伦与洋洋之女，2016 年出生于亚特兰大动物园，与雅伦为双胞胎，2024 年返回成都基地。",
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
        "id": "media-xi-lun-de9774371d2f2427",
        "panda_id": "d24087cd-70d6-5902-92dd-ecc95186937b",
        "url": "https://api.zhipanda.com/media/releases/2026.07.21.1/media-xi-lun-de9774371d2f2427-w1200.webp",
        "source_url": "https://commons.wikimedia.org/wiki/File:Xi_Lun_at_Zoo_Atlanta.jpg",
        "rights": "CC BY-SA 4.0",
        "credit": "O01326 / Wikimedia Commons",
        "alt_zh": "喜伦在亚特兰大动物园的栖息地内坐着",
        "alt_en": "Xi Lun sitting in her habitat at Zoo Atlanta",
        "status": "available",
        "sha256": "59646c0e1cca83a35fa76efface934feb490ccc5a58871e5dc518f6f2e7485f6",
        "mime_type": "image/webp",
        "width": 1200,
        "height": 800,
        "bytes": 232944,
        "derivatives": [
          {
            "bytes": 41100,
            "height": 320,
            "kind": "width-480",
            "mime_type": "image/webp",
            "sha256": "512163b2e0abbdb809b70e244e1c08b9eee5d1dfc4a8f50284eb77f3d4fba134",
            "url": "https://api.zhipanda.com/media/releases/2026.07.21.1/media-xi-lun-de9774371d2f2427-w480.webp",
            "width": 480
          },
          {
            "bytes": 232944,
            "height": 800,
            "kind": "width-1200",
            "mime_type": "image/webp",
            "sha256": "59646c0e1cca83a35fa76efface934feb490ccc5a58871e5dc518f6f2e7485f6",
            "url": "https://api.zhipanda.com/media/releases/2026.07.21.1/media-xi-lun-de9774371d2f2427-w1200.webp",
            "width": 1200
          }
        ],
        "source_ids": [
          "src_commons_xi_lun_photo"
        ]
      }
    ],
    "identity": {
      "stable_id": "d24087cd-70d6-5902-92dd-ecc95186937b",
      "canonical_slug": "xi-lun",
      "names": [
        {
          "value": "喜伦",
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
          "value": "Xi Lun",
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
          "value": "xilun",
          "source_ids": [
            "src_zooatlanta_cubs_birth"
          ]
        }
      ],
      "external_identifiers": [
        {
          "system": "zoo_atlanta_profile_key",
          "value": "xi-lun",
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
        "last_verified_at": "2026-07-21",
        "assertion_ids": [
          "fact-xi-lun-birth-date"
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
          "fact-xi-lun-current-place"
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
        "last_verified_at": "2026-07-21",
        "assertion_ids": [
          "fact-xi-lun-sex"
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
        "id": "src_commons_xi_lun_photo",
        "publisher": "Wikimedia Commons",
        "title": "Xi Lun at Zoo Atlanta",
        "url": "https://commons.wikimedia.org/wiki/File:Xi_Lun_at_Zoo_Atlanta.jpg",
        "published_at": "2022-02-08",
        "last_verified_at": "2026-07-21",
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
        "id": "res-xi-lun-zoo-atlanta",
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
        "id": "res-xi-lun-chengdu",
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
        "id": "event-xi-lun-birth",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2016-09-03",
        "event_date_precision": "day",
        "participants": [
          "d24087cd-70d6-5902-92dd-ecc95186937b"
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
        "id": "event-xi-lun-public-debut",
        "event_type": "public_debut",
        "event_status": "completed",
        "event_date": "2016-12-27",
        "event_date_precision": "day",
        "participants": [
          "d24087cd-70d6-5902-92dd-ecc95186937b"
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
          "d24087cd-70d6-5902-92dd-ecc95186937b",
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
        "summary": "伦伦与洋洋之女，2016 年出生于亚特兰大动物园，与雅伦为双胞胎，2024 年返回成都基地。"
      },
      {
        "locale": "en",
        "summary": "Daughter of Lun Lun and Yang Yang, born at Zoo Atlanta in 2016, twin of Ya Lun, and returned to Chengdu in 2024."
      }
    ],
    "media_release": {
      "license_state": "licensed",
      "display_mode": "gallery",
      "source_ids": [
        "src_commons_xi_lun_photo"
      ]
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "完成身份、出生、居住、事件、亲缘与授权照片的公开审核。"
        },
        {
          "locale": "en",
          "summary": "Reviewed identity, birth, residency, events, lineage, and licensed media."
        }
      ]
    }
  },
  {
    "id": "d2da42a3-7a0b-5384-aeb1-afaff1439894",
    "slug": "ni-na",
    "name_zh": "妮娜",
    "name_en": "Ni Na",
    "gender": "female",
    "status": "alive",
    "birth_date": "2017-07-20",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [
      "ni-na",
      "妮娜",
      "Ni Na"
    ],
    "intro": "妮娜，2017 年出生，收藏记录中的现居地为 Chengdu Panda Base, Chengdu, Sichuan Province, China。",
    "birthplace": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan Province, China",
    "tags": [
      "trusted-identity",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": null,
    "habitats": [],
    "media": [],
    "identity": {
      "stable_id": "d2da42a3-7a0b-5384-aeb1-afaff1439894",
      "canonical_slug": "ni-na",
      "names": [
        {
          "value": "妮娜",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_zh",
            "src_gpg_meet_world_page_18"
          ]
        },
        {
          "value": "Ni Na",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_zh",
            "src_gpg_meet_world_page_18"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2017-07-20",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-ni-na-birth-date"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_meet_world_page_18"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "birthplace",
        "value": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan Province, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-ni-na-birthplace"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_meet_world_page_18"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "Chengdu Panda Base, Chengdu, Sichuan Province, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-ni-na-current-coarse-location"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_meet_world_page_18"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "female",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-ni-na-sex"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh",
          "src_gpg_meet_world_page_18"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_chengdu_newborns_2017_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "Debut of 2017 Newborn Pandas",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-08-24/8080.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2017_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2017新生大熊猫宝宝齐亮相",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      },
      {
        "id": "src_gpg_meet_world_page_18",
        "publisher": "Giant Panda Global",
        "title": "Meet the giant pandas around the world page 18",
        "url": "https://www.giantpandaglobal.com/en/meet-the-giant-pandas-around-the-world/?pagina=18",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_ni_na_birth_20170720",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2017-07-20",
        "event_date_precision": "day",
        "participants": [
          "d2da42a3-7a0b-5384-aeb1-afaff1439894"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "妮娜，2017 年出生，收藏记录中的现居地为 Chengdu Panda Base, Chengdu, Sichuan Province, China。"
      },
      {
        "locale": "en",
        "summary": "Living Chengdu Panda Base female giant panda captured from GPG global living index page 18."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "由已审核收藏数据自动生成首轮档案。"
        },
        {
          "locale": "en",
          "summary": "Generated automatically from reviewed collection curation."
        }
      ]
    }
  },
  {
    "id": "d56dffc3-941c-5640-983d-4f4959c97e03",
    "slug": "qing-bao",
    "name_zh": "青宝",
    "name_en": "Qing Bao",
    "gender": "female",
    "status": "alive",
    "birth_date": "2021-09-12",
    "current_location": "史密森国家动物园",
    "cover_image_url": "https://api.zhipanda.com/media/releases/2026.07.23.1/media-qing-bao-2cc0071c570b363c-w1200.webp",
    "search_terms": [
      "qing-bao",
      "青宝",
      "Qing Bao",
      "Qīngbǎo",
      "qingbao",
      "smithsonian_profile_key:qing-bao"
    ],
    "intro": "2021 年出生于四川，2024 年抵达史密森国家动物园，并于 2025 年 1 月公开亮相。",
    "birthplace": "China Conservation and Research Center for the Giant Panda, Sichuan",
    "tags": [
      "trusted-identity",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": null,
    "habitats": [],
    "media": [
      {
        "id": "media-qing-bao-2cc0071c570b363c",
        "panda_id": "d56dffc3-941c-5640-983d-4f4959c97e03",
        "url": "https://api.zhipanda.com/media/releases/2026.07.23.1/media-qing-bao-2cc0071c570b363c-w1200.webp",
        "source_url": "https://commons.wikimedia.org/wiki/File:Qing_Bao-5_-_54260941750.jpg",
        "rights": "CC BY 2.0",
        "credit": "Mike Maguire / Wikimedia Commons",
        "alt_zh": "疑似青宝在史密森尼国家动物园的雪地中吃竹子",
        "alt_en": "Probable Qing Bao eating bamboo in the snow at Smithsonian's National Zoo",
        "status": "available",
        "sha256": "bcc5138ce5499457b00f0cfe2732f49670a82b97f801d1421e46c368702cee06",
        "mime_type": "image/webp",
        "width": 1200,
        "height": 800,
        "bytes": 169446,
        "derivatives": [
          {
            "bytes": 33342,
            "height": 320,
            "kind": "width-480",
            "mime_type": "image/webp",
            "sha256": "62c35f22b5335e12bb03d31b860ba3e31ccce9ca4cd0251504502344042648ed",
            "url": "https://api.zhipanda.com/media/releases/2026.07.23.1/media-qing-bao-2cc0071c570b363c-w480.webp",
            "width": 480
          },
          {
            "bytes": 169446,
            "height": 800,
            "kind": "width-1200",
            "mime_type": "image/webp",
            "sha256": "bcc5138ce5499457b00f0cfe2732f49670a82b97f801d1421e46c368702cee06",
            "url": "https://api.zhipanda.com/media/releases/2026.07.23.1/media-qing-bao-2cc0071c570b363c-w1200.webp",
            "width": 1200
          }
        ],
        "source_ids": [
          "src_commons_qing_bao_photo"
        ]
      }
    ],
    "identity": {
      "stable_id": "d56dffc3-941c-5640-983d-4f4959c97e03",
      "canonical_slug": "qing-bao",
      "names": [
        {
          "value": "青宝",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_smithsonian_giant_panda_faq",
            "src_smithsonian_giant_panda_page",
            "src_smithsonian_history"
          ]
        },
        {
          "value": "Qing Bao",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_smithsonian_giant_panda_faq",
            "src_smithsonian_giant_panda_page",
            "src_smithsonian_history"
          ]
        },
        {
          "value": "Qīngbǎo",
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
          "value": "qingbao",
          "source_ids": [
            "src_smithsonian_giant_panda_faq"
          ]
        }
      ],
      "external_identifiers": [
        {
          "system": "smithsonian_profile_key",
          "value": "qing-bao",
          "source_ids": [
            "src_smithsonian_giant_panda_page"
          ]
        }
      ]
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2021-09-12",
        "status": "confirmed",
        "last_verified_at": "2026-07-23",
        "assertion_ids": [
          "fact-qing-bao-birth-date"
        ],
        "source_ids": [
          "src_smithsonian_giant_panda_faq",
          "src_smithsonian_giant_panda_page"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "birthplace",
        "value": "China Conservation and Research Center for the Giant Panda, Sichuan",
        "status": "confirmed",
        "last_verified_at": "2026-07-23",
        "assertion_ids": [
          "fact-qing-bao-birthplace"
        ],
        "source_ids": [
          "src_smithsonian_giant_panda_faq",
          "src_smithsonian_giant_panda_page"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_facility",
        "value": "David M. Rubenstein and Family Giant Panda Habitat, Smithsonian National Zoo",
        "status": "confirmed",
        "last_verified_at": "2026-07-23",
        "assertion_ids": [
          "fact-qing-bao-current-place"
        ],
        "source_ids": [
          "src_smithsonian_giant_panda_faq",
          "src_smithsonian_giant_panda_page"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "female",
        "status": "confirmed",
        "last_verified_at": "2026-07-23",
        "assertion_ids": [
          "fact-qing-bao-sex"
        ],
        "source_ids": [
          "src_smithsonian_giant_panda_faq",
          "src_smithsonian_giant_panda_page"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_commons_qing_bao_photo",
        "publisher": "Wikimedia Commons",
        "title": "Probable Qing Bao eating bamboo in snow",
        "url": "https://commons.wikimedia.org/wiki/File:Qing_Bao-5_-_54260941750.jpg",
        "published_at": null,
        "last_verified_at": "2026-07-23",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_smithsonian_giant_panda_faq",
        "publisher": "Smithsonian National Zoo and Conservation Biology Institute",
        "title": "Giant Panda FAQs",
        "url": "https://nationalzoo.si.edu/animals/giant-panda-faqs",
        "published_at": null,
        "last_verified_at": "2026-07-23",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_smithsonian_giant_panda_page",
        "publisher": "Smithsonian National Zoo and Conservation Biology Institute",
        "title": "Giant panda",
        "url": "https://nationalzoo.si.edu/animals/giant-panda",
        "published_at": null,
        "last_verified_at": "2026-07-23",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_smithsonian_history",
        "publisher": "Smithsonian National Zoo and Conservation Biology Institute",
        "title": "History of Giant Pandas at the Smithsonian's National Zoo and Conservation Biology Institute",
        "url": "https://nationalzoo.si.edu/animals/history-giant-pandas-zoo",
        "published_at": null,
        "last_verified_at": "2026-07-23",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": {
      "facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
      "coarse_location": null,
      "status": "confirmed",
      "last_verified_at": "2026-07-23"
    },
    "residencies": [
      {
        "id": "res-qing-bao-smithsonian",
        "facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
        "coarse_location": null,
        "residency_type": "primary",
        "start_date": "2024-10-15",
        "start_precision": "day",
        "end_date": null,
        "end_precision": null,
        "status": "confirmed",
        "last_verified_at": "2026-07-23",
        "source_ids": [
          "src_smithsonian_giant_panda_faq",
          "src_smithsonian_history"
        ]
      }
    ],
    "events": [
      {
        "id": "event-qing-bao-birth",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2021-09-12",
        "event_date_precision": "day",
        "participants": [
          "d56dffc3-941c-5640-983d-4f4959c97e03"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
        "to_coarse_location": null,
        "source_ids": [
          "src_smithsonian_giant_panda_faq"
        ],
        "changes_current_residency": false
      },
      {
        "id": "event-qing-bao-arrival-2024",
        "event_type": "arrival",
        "event_status": "completed",
        "event_date": "2024-10-15",
        "event_date_precision": "day",
        "participants": [
          "d56dffc3-941c-5640-983d-4f4959c97e03"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
        "to_coarse_location": null,
        "source_ids": [
          "src_smithsonian_history"
        ],
        "changes_current_residency": true
      },
      {
        "id": "event-qing-bao-public-debut-2025",
        "event_type": "public_debut",
        "event_status": "completed",
        "event_date": "2025-01-24",
        "event_date_precision": "day",
        "participants": [
          "d56dffc3-941c-5640-983d-4f4959c97e03"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
        "to_coarse_location": null,
        "source_ids": [
          "src_smithsonian_history"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "complete_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "2021 年出生于四川，2024 年抵达史密森国家动物园，并于 2025 年 1 月公开亮相。"
      },
      {
        "locale": "en",
        "summary": "Born in Sichuan in 2021, arrived at the Smithsonian's National Zoo in 2024, and made her public debut in January 2025."
      }
    ],
    "media_release": {
      "license_state": "licensed",
      "display_mode": "gallery",
      "source_ids": [
        "src_commons_qing_bao_photo"
      ]
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "补充出生地、抵达、公开亮相、现居场馆与收藏图片。"
        },
        {
          "locale": "en",
          "summary": "Added birthplace, arrival, public debut, current habitat, and collection media."
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
          "d24087cd-70d6-5902-92dd-ecc95186937b",
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
      "data_version": "2026.07.24.2",
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
    "id": "e8690164-c982-53c0-a837-377e649de435",
    "slug": "qi-fu-changsha",
    "name_zh": "奇福",
    "name_en": "Qi Fu",
    "gender": "female",
    "status": "alive",
    "birth_date": "2008-07-26",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [
      "qi-fu-changsha",
      "奇福",
      "Qi Fu"
    ],
    "intro": "奇福，2008 年出生，收藏记录中的现居地为 Chengdu Panda Base, Chengdu, Sichuan Province, China。",
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
      "stable_id": "e8690164-c982-53c0-a837-377e649de435",
      "canonical_slug": "qi-fu-changsha",
      "names": [
        {
          "value": "奇福",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2021_zh",
            "src_gpg_changsha_profiles"
          ]
        },
        {
          "value": "Qi Fu",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2021_zh",
            "src_gpg_changsha_profiles"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2008-07-26",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-qi-fu-changsha-birth-date"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_changsha_profiles"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "Chengdu Panda Base, Chengdu, Sichuan Province, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-qi-fu-changsha-current-coarse-location"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_changsha_profiles"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "female",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-qi-fu-changsha-sex"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_changsha_profiles"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_chengdu_newborns_2021_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2021年新生大熊猫幼仔档案",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-07-07/6594.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      },
      {
        "id": "src_gpg_changsha_profiles",
        "publisher": "Giant Panda Global",
        "title": "Changsha Ecological Zoo giant pandas",
        "url": "https://www.giantpandaglobal.com/en/zoo/changsha-ecological-zoo",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "奇福，2008 年出生，收藏记录中的现居地为 Chengdu Panda Base, Chengdu, Sichuan Province, China。"
      },
      {
        "locale": "en",
        "summary": "Former Changsha Ecological Zoo giant panda captured from secondary discovery index."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "由已审核收藏数据自动生成首轮档案。"
        },
        {
          "locale": "en",
          "summary": "Generated automatically from reviewed collection curation."
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
          "d24087cd-70d6-5902-92dd-ecc95186937b",
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
      "data_version": "2026.07.24.2",
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
    "id": "fc74efcb-3a15-51e8-bf45-d9a294a8cbc8",
    "slug": "qing-qing-chengdu-2017-07-26",
    "name_zh": "青青",
    "name_en": "Qing Qing",
    "gender": "female",
    "status": "unknown",
    "birth_date": "2017-07-26",
    "current_location": null,
    "cover_image_url": "https://api.zhipanda.com/media/releases/2026.07.24.2/media-qing-qing-chengdu-2017-07-26-d96df5e1cfc57965-w550.webp",
    "search_terms": [
      "qing-qing-chengdu-2017-07-26",
      "青青",
      "Qing Qing"
    ],
    "intro": "青青是雌性大熊猫，2017年7月26日出生于成都大熊猫繁育研究基地，母亲为二巧，初生体重144克；2017年9月参加基地新生幼仔集体亮相。",
    "birthplace": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
    "tags": [
      "trusted-identity",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": "35d085c8-d0b5-5779-99ba-c54166451f5b",
    "habitats": [],
    "media": [
      {
        "id": "media-qing-qing-chengdu-2017-07-26-d96df5e1cfc57965",
        "panda_id": "fc74efcb-3a15-51e8-bf45-d9a294a8cbc8",
        "url": "https://api.zhipanda.com/media/releases/2026.07.24.2/media-qing-qing-chengdu-2017-07-26-d96df5e1cfc57965-w550.webp",
        "source_url": "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html",
        "rights": "All rights reserved",
        "credit": "Chengdu Research Base of Giant Panda Breeding",
        "alt_zh": "2017年成都基地新生幼仔集体亮相现场；青青属于该批次",
        "alt_en": "The 2017 Chengdu newborn cohort presentation; Qing Qing belongs to this cohort",
        "status": "available",
        "sha256": "3859206f38f668f676680f85e359c7cfaaad20cb279f108c809822ad00805e65",
        "mime_type": "image/webp",
        "width": 550,
        "height": 366,
        "bytes": 61812,
        "derivatives": [
          {
            "bytes": 46836,
            "height": 319,
            "kind": "width-480",
            "mime_type": "image/webp",
            "sha256": "f8b8a73c5043287f3f94bfbeb5194c0aea359100e734cfecb2441545c438c11c",
            "url": "https://api.zhipanda.com/media/releases/2026.07.24.2/media-qing-qing-chengdu-2017-07-26-d96df5e1cfc57965-w480.webp",
            "width": 480
          },
          {
            "bytes": 61812,
            "height": 366,
            "kind": "width-550",
            "mime_type": "image/webp",
            "sha256": "3859206f38f668f676680f85e359c7cfaaad20cb279f108c809822ad00805e65",
            "url": "https://api.zhipanda.com/media/releases/2026.07.24.2/media-qing-qing-chengdu-2017-07-26-d96df5e1cfc57965-w550.webp",
            "width": 550
          }
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_zh"
        ]
      }
    ],
    "identity": {
      "stable_id": "fc74efcb-3a15-51e8-bf45-d9a294a8cbc8",
      "canonical_slug": "qing-qing-chengdu-2017-07-26",
      "names": [
        {
          "value": "青青",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_en",
            "src_chengdu_newborns_2017_zh"
          ]
        },
        {
          "value": "Qing Qing",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2017_en",
            "src_chengdu_newborns_2017_zh"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2017-07-26",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-qing-qing-chengdu-2017-07-26-birth-date"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "birthplace",
        "value": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-qing-qing-chengdu-2017-07-26-birthplace"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "female",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-qing-qing-chengdu-2017-07-26-sex"
        ],
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_chengdu_newborns_2017_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "Debut of 2017 Newborn Pandas",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-08-24/8080.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2017_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2017新生大熊猫宝宝齐亮相",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_qing_qing_chengdu_2017_07_26_birth_20170726",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2017-07-26",
        "event_date_precision": "day",
        "participants": [
          "35d085c8-d0b5-5779-99ba-c54166451f5b",
          "fc74efcb-3a15-51e8-bf45-d9a294a8cbc8"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "changes_current_residency": false
      },
      {
        "id": "evt_qing_qing_cohort_debut_20170927",
        "event_type": "public_debut",
        "event_status": "completed",
        "event_date": "2017-09-27",
        "event_date_precision": "day",
        "participants": [
          "fc74efcb-3a15-51e8-bf45-d9a294a8cbc8"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
        "source_ids": [
          "src_chengdu_newborns_2017_en",
          "src_chengdu_newborns_2017_zh"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "青青是雌性大熊猫，2017年7月26日出生于成都大熊猫繁育研究基地，母亲为二巧，初生体重144克；2017年9月参加基地新生幼仔集体亮相。"
      },
      {
        "locale": "en",
        "summary": "Qing Qing is a female giant panda born at the Chengdu Research Base on 2017-07-26 to mother Er Qiao, with a recorded birth weight of 144 g. She joined the Base's 2017 newborn cohort presentation."
      }
    ],
    "media_release": {
      "license_state": "licensed",
      "display_mode": "gallery",
      "source_ids": [
        "src_chengdu_newborns_2017_zh"
      ]
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "补充官方母系关系、出生细节、事件时间线与收藏图片。"
        },
        {
          "locale": "en",
          "summary": "Added official maternal lineage, birth details, timeline events, and collection media."
        }
      ]
    }
  },
  {
    "id": "fcc89c7a-6046-5c2c-bcb4-bf1fb50182a1",
    "slug": "ya-li",
    "name_zh": "雅莉",
    "name_en": "Ya Li",
    "gender": "female",
    "status": "alive",
    "birth_date": "2009-07-19",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [
      "ya-li",
      "雅莉",
      "Ya Li"
    ],
    "intro": "雅莉，2009 年出生，收藏记录中的现居地为 Chengdu Panda Base, Chengdu, Sichuan Province, China。",
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
      "stable_id": "fcc89c7a-6046-5c2c-bcb4-bf1fb50182a1",
      "canonical_slug": "ya-li",
      "names": [
        {
          "value": "雅莉",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2021_zh",
            "src_gpg_guangzhou_profiles"
          ]
        },
        {
          "value": "Ya Li",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2021_zh",
            "src_gpg_guangzhou_profiles"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2009-07-19",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-ya-li-birth-date"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_guangzhou_profiles"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "Chengdu Panda Base, Chengdu, Sichuan Province, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-ya-li-current-coarse-location"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_guangzhou_profiles"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "female",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-ya-li-sex"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_guangzhou_profiles"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_chengdu_newborns_2021_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2021年新生大熊猫幼仔档案",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-07-07/6594.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      },
      {
        "id": "src_gpg_guangzhou_profiles",
        "publisher": "Giant Panda Global",
        "title": "Guangzhou Zoo giant pandas",
        "url": "https://www.giantpandaglobal.com/en/zoo/guangzhou-zoo",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "雅莉，2009 年出生，收藏记录中的现居地为 Chengdu Panda Base, Chengdu, Sichuan Province, China。"
      },
      {
        "locale": "en",
        "summary": "Former Guangzhou Zoo giant panda captured from secondary discovery index."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "由已审核收藏数据自动生成首轮档案。"
        },
        {
          "locale": "en",
          "summary": "Generated automatically from reviewed collection curation."
        }
      ]
    }
  },
  {
    "id": "fd184343-de89-5e60-bb3b-0a5f780179d8",
    "slug": "pu-pu-shenyang",
    "name_zh": "噗噗",
    "name_en": "Pu Pu",
    "gender": "female",
    "status": "alive",
    "birth_date": "2014-08-10",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [
      "pu-pu-shenyang",
      "噗噗",
      "Pu Pu"
    ],
    "intro": "噗噗，2014 年出生，收藏记录中的现居地为 Shenyang Forest Zoo, Shenyang, Liaoning Province, China。",
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
      "stable_id": "fd184343-de89-5e60-bb3b-0a5f780179d8",
      "canonical_slug": "pu-pu-shenyang",
      "names": [
        {
          "value": "噗噗",
          "language": "zh-Hans",
          "kind": "official",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2021_zh",
            "src_gpg_yaan_base_previous_page_7"
          ]
        },
        {
          "value": "Pu Pu",
          "language": "en",
          "kind": "official_romanization",
          "primary": true,
          "source_ids": [
            "src_chengdu_newborns_2021_zh",
            "src_gpg_yaan_base_previous_page_7"
          ]
        }
      ],
      "aliases": [],
      "legacy_slugs": [],
      "external_identifiers": []
    },
    "conclusions": [
      {
        "field": "birth_date",
        "value": "2014-08-10",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-pu-pu-shenyang-birth-date"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_yaan_base_previous_page_7"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "current_coarse_location",
        "value": "Shenyang Forest Zoo, Shenyang, Liaoning Province, China",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-pu-pu-shenyang-current-coarse-location"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_yaan_base_previous_page_7"
        ],
        "candidate_values": [],
        "superseded_values": []
      },
      {
        "field": "sex",
        "value": "female",
        "status": "confirmed",
        "last_verified_at": "2026-07-24",
        "assertion_ids": [
          "fact-pu-pu-shenyang-sex"
        ],
        "source_ids": [
          "src_chengdu_newborns_2021_zh",
          "src_gpg_yaan_base_previous_page_7"
        ],
        "candidate_values": [],
        "superseded_values": []
      }
    ],
    "sources": [
      {
        "id": "src_chengdu_newborns_2021_en",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2021 Newborn Giant Panda Profiles",
        "url": "https://www.panda.org.cn/en/culture/activities/2023-09-19/8165.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "en",
        "access_state": "accessible"
      },
      {
        "id": "src_chengdu_newborns_2021_zh",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2021年新生大熊猫幼仔档案",
        "url": "https://www.panda.org.cn/cn/culture/activities/2023-07-07/6594.html",
        "published_at": null,
        "last_verified_at": "2026-07-24",
        "language": "zh-Hans",
        "access_state": "accessible"
      },
      {
        "id": "src_gpg_yaan_base_previous_page_7",
        "publisher": "Giant Panda Global",
        "title": "CCRCGP Ya'an Base previous giant pandas page 7",
        "url": "https://www.giantpandaglobal.com/en/zoo/ccrcgp-yaan-base/?pagina=7&s=previous",
        "published_at": null,
        "last_verified_at": "2026-05-10",
        "language": "en",
        "access_state": "accessible"
      }
    ],
    "current_place": null,
    "residencies": [],
    "events": [
      {
        "id": "evt_pu_pu_shenyang_birth_20210717",
        "event_type": "birth",
        "event_status": "completed",
        "event_date": "2021-07-17",
        "event_date_precision": "day",
        "participants": [
          "fd184343-de89-5e60-bb3b-0a5f780179d8"
        ],
        "from_facility_id": null,
        "from_coarse_location": null,
        "to_facility_id": null,
        "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
        "source_ids": [
          "src_chengdu_newborns_2021_en",
          "src_chengdu_newborns_2021_zh"
        ],
        "changes_current_residency": false
      }
    ],
    "record_tier": "identity_first_pass",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "噗噗，2014 年出生，收藏记录中的现居地为 Shenyang Forest Zoo, Shenyang, Liaoning Province, China。"
      },
      {
        "locale": "en",
        "summary": "Former CCRCGP Ya'an Base giant panda listed at Shenyang Forest Zoo in secondary discovery index."
      }
    ],
    "media_release": {
      "license_state": "no_licensed_media",
      "display_mode": "designed_empty_state",
      "source_ids": []
    },
    "public_revision": {
      "data_version": "2026.07.24.2",
      "public_schema_version": "1.2.0",
      "summaries": [
        {
          "locale": "zh-CN",
          "summary": "由已审核收藏数据自动生成首轮档案。"
        },
        {
          "locale": "en",
          "summary": "Generated automatically from reviewed collection curation."
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
      "7e8c3dc5-0725-5c1e-bc97-53f3e9c47995",
      "89f620b2-37d0-51ba-aafa-6844404a5b2c",
      "d773a478-6014-5a4f-9e29-a0903f4beea6"
    ],
    "place_ids": [
      "place-ccrcgp-bifengxia-base",
      "place-ccrcgp-yaan-base",
      "place-wolong-shenshuping-base"
    ],
    "source_ids": [
      "src_ccrcgp_2025_birthday_season",
      "src_ueno_return_riri_shinshin",
      "src_ueno_xiaolei_return_2026"
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
    "id": "institution-ueno-zoo",
    "canonical_slug": "ueno-zoo",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "Ueno Zoo",
        "kind": "official"
      },
      {
        "language": "zh-Hans",
        "value": "上野动物园",
        "kind": "translated"
      }
    ],
    "institution_type": "zoo",
    "facility_ids": [
      "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9"
    ],
    "place_ids": [
      "place-ueno-zoo"
    ],
    "source_ids": [
      "src_tokyo_zoo_ueno_panda_history"
    ],
    "last_verified_at": "2026-07-20",
    "revision_summaries": [
      {
        "locale": "zh-CN",
        "summary": "建立上野动物园机构与园区关系。"
      },
      {
        "locale": "en",
        "summary": "Established the Ueno Zoo institution and campus."
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
    "id": "place-ccrcgp-bifengxia-base",
    "canonical_slug": "ccrcgp-bifengxia-base-yaan-sichuan",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "CCRCGP Bifengxia Base, Ya'an, Sichuan",
        "kind": "display"
      },
      {
        "language": "zh-Hans",
        "value": "中国大熊猫保护研究中心雅安碧峰峡基地（四川雅安）",
        "kind": "display"
      }
    ],
    "country_code": "CN",
    "locality": "Ya'an, Sichuan",
    "precision": "locality",
    "place_type": "conservation_base",
    "facility_ids": [
      "7e8c3dc5-0725-5c1e-bc97-53f3e9c47995"
    ],
    "institution_ids": [
      "institution-ccrcgp"
    ],
    "source_ids": [
      "src_ueno_return_riri_shinshin",
      "src_gpg_yaan_base_profiles"
    ],
    "last_verified_at": "2026-05-10",
    "revision_summaries": [
      {
        "locale": "zh-CN",
        "summary": "以雅安市级精度发布碧峰峡基地。"
      },
      {
        "locale": "en",
        "summary": "Published Bifengxia Base at Ya'an locality precision."
      }
    ]
  },
  {
    "id": "place-ccrcgp-yaan-base",
    "canonical_slug": "ccrcgp-yaan-base-sichuan",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "CCRCGP Ya'an Base",
        "kind": "display"
      },
      {
        "language": "zh-Hans",
        "value": "中国大熊猫保护研究中心雅安基地",
        "kind": "display"
      }
    ],
    "country_code": "CN",
    "locality": "Ya'an, Sichuan",
    "precision": "locality",
    "place_type": "conservation_base",
    "facility_ids": [
      "d773a478-6014-5a4f-9e29-a0903f4beea6"
    ],
    "institution_ids": [
      "institution-ccrcgp"
    ],
    "source_ids": [
      "src_ueno_xiaolei_return_2026"
    ],
    "last_verified_at": "2026-05-10",
    "revision_summaries": [
      {
        "locale": "zh-CN",
        "summary": "按官方表述以雅安基地发布，不推断更细分基地。"
      },
      {
        "locale": "en",
        "summary": "Published as Ya'an Base without inferring a narrower campus."
      }
    ]
  },
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
    "id": "place-ueno-zoo",
    "canonical_slug": "ueno-zoo-tokyo",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "Ueno Zoo, Tokyo",
        "kind": "display"
      },
      {
        "language": "zh-Hans",
        "value": "上野动物园（日本东京）",
        "kind": "display"
      }
    ],
    "country_code": "JP",
    "locality": "Tokyo",
    "precision": "locality",
    "place_type": "zoo_campus",
    "facility_ids": [
      "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9"
    ],
    "institution_ids": [
      "institution-ueno-zoo"
    ],
    "source_ids": [
      "src_tokyo_zoo_ueno_panda_history"
    ],
    "last_verified_at": "2026-07-20",
    "revision_summaries": [
      {
        "locale": "zh-CN",
        "summary": "以上野园区的城市级精度发布。"
      },
      {
        "locale": "en",
        "summary": "Published the Ueno campus at locality precision."
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
    "id": "7e8c3dc5-0725-5c1e-bc97-53f3e9c47995",
    "canonical_slug": "ccrcgp-bifengxia-base",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "CCRCGP Bifengxia Base",
        "kind": "official_translation"
      },
      {
        "language": "zh-Hans",
        "value": "中国大熊猫保护研究中心雅安碧峰峡基地",
        "kind": "official"
      }
    ],
    "institution_type": "conservation_center",
    "facility_ids": [
      "7e8c3dc5-0725-5c1e-bc97-53f3e9c47995"
    ],
    "place_ids": [
      "place-ccrcgp-bifengxia-base",
      "place-ccrcgp-yaan-base",
      "place-wolong-shenshuping-base"
    ],
    "source_ids": [
      "src_ccrcgp_2025_birthday_season",
      "src_ueno_return_riri_shinshin",
      "src_ueno_xiaolei_return_2026"
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
    "locality": "Ya'an, Sichuan",
    "facility_type": "conservation_center"
  },
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
      "place-ccrcgp-bifengxia-base",
      "place-ccrcgp-yaan-base",
      "place-wolong-shenshuping-base"
    ],
    "source_ids": [
      "src_ccrcgp_2025_birthday_season",
      "src_ueno_return_riri_shinshin",
      "src_ueno_xiaolei_return_2026"
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
    "id": "d773a478-6014-5a4f-9e29-a0903f4beea6",
    "canonical_slug": "ccrcgp-yaan-base",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "CCRCGP Ya'an Base",
        "kind": "official_translation"
      },
      {
        "language": "zh-Hans",
        "value": "中国大熊猫保护研究中心雅安基地",
        "kind": "official"
      }
    ],
    "institution_type": "conservation_center",
    "facility_ids": [
      "d773a478-6014-5a4f-9e29-a0903f4beea6"
    ],
    "place_ids": [
      "place-ccrcgp-bifengxia-base",
      "place-ccrcgp-yaan-base",
      "place-wolong-shenshuping-base"
    ],
    "source_ids": [
      "src_ccrcgp_2025_birthday_season",
      "src_ueno_return_riri_shinshin",
      "src_ueno_xiaolei_return_2026"
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
    "locality": "Ya'an, Sichuan",
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
    "id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
    "canonical_slug": "ueno-zoo",
    "legacy_slugs": [],
    "names": [
      {
        "language": "en",
        "value": "Ueno Zoo",
        "kind": "official"
      },
      {
        "language": "zh-Hans",
        "value": "上野动物园",
        "kind": "translated"
      }
    ],
    "institution_type": "zoo",
    "facility_ids": [
      "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9"
    ],
    "place_ids": [
      "place-ueno-zoo"
    ],
    "source_ids": [
      "src_tokyo_zoo_ueno_panda_history"
    ],
    "last_verified_at": "2026-07-20",
    "revision_summaries": [
      {
        "locale": "zh-CN",
        "summary": "建立上野动物园机构与园区关系。"
      },
      {
        "locale": "en",
        "summary": "Established the Ueno Zoo institution and campus."
      }
    ],
    "country_code": "JP",
    "locality": "Tokyo",
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
    "id": "parent-bao-xin-mother",
    "child_id": "0f7f494a-ec00-5e43-92e0-d299fe858d95",
    "parent_id": "771b6aef-2075-5d3e-8a82-7adc5822b99c",
    "role": "mother",
    "status": "confirmed",
    "source_ids": [
      "src_chengdu_newborns_2021_en",
      "src_chengdu_newborns_2021_zh"
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
    "id": "parent-lei-lei-father",
    "child_id": "c2eefef1-54f2-58ca-85cc-c2fd3d63653a",
    "parent_id": "57c0a1bd-cc44-5a08-ba48-f224e9956064",
    "role": "father",
    "status": "confirmed",
    "source_ids": [
      "src_tokyo_zoo_ueno_panda_history"
    ]
  },
  {
    "id": "parent-lei-lei-mother",
    "child_id": "c2eefef1-54f2-58ca-85cc-c2fd3d63653a",
    "parent_id": "01878819-1eda-5d9c-96ab-bab66d3b0b09",
    "role": "mother",
    "status": "confirmed",
    "source_ids": [
      "src_tokyo_zoo_ueno_panda_history"
    ]
  },
  {
    "id": "parent-qing-qing-chengdu-2017-07-26-mother",
    "child_id": "fc74efcb-3a15-51e8-bf45-d9a294a8cbc8",
    "parent_id": "35d085c8-d0b5-5779-99ba-c54166451f5b",
    "role": "mother",
    "status": "confirmed",
    "source_ids": [
      "src_chengdu_newborns_2017_en",
      "src_chengdu_newborns_2017_zh"
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
    "id": "parent-xi-lun-father",
    "child_id": "d24087cd-70d6-5902-92dd-ecc95186937b",
    "parent_id": "db108e44-8893-54e1-8cb5-8c5238b75089",
    "role": "father",
    "status": "confirmed",
    "source_ids": [
      "src_zooatlanta_cubs_birth",
      "src_zooatlanta_twins_names"
    ]
  },
  {
    "id": "parent-xi-lun-mother",
    "child_id": "d24087cd-70d6-5902-92dd-ecc95186937b",
    "parent_id": "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
    "role": "mother",
    "status": "confirmed",
    "source_ids": [
      "src_zooatlanta_cubs_birth",
      "src_zooatlanta_twins_names"
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
    "id": "parent-xiao-xiao-father",
    "child_id": "275ad0df-c700-5991-a13a-0ca47c56eeba",
    "parent_id": "57c0a1bd-cc44-5a08-ba48-f224e9956064",
    "role": "father",
    "status": "confirmed",
    "source_ids": [
      "src_tokyo_zoo_ueno_panda_history"
    ]
  },
  {
    "id": "parent-xiao-xiao-mother",
    "child_id": "275ad0df-c700-5991-a13a-0ca47c56eeba",
    "parent_id": "01878819-1eda-5d9c-96ab-bab66d3b0b09",
    "role": "mother",
    "status": "confirmed",
    "source_ids": [
      "src_tokyo_zoo_ueno_panda_history"
    ]
  },
  {
    "id": "parent-xiao-xin-chengdu-2017-mother",
    "child_id": "2a589b9f-1700-5b1e-8c2f-8203190da905",
    "parent_id": "70e56c3f-4290-55b9-abb5-79fe098f1a07",
    "role": "mother",
    "status": "confirmed",
    "source_ids": [
      "src_chengdu_newborns_2017_en",
      "src_chengdu_newborns_2017_zh"
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
  },
  {
    "id": "parent-zhen-xi-mother",
    "child_id": "47714294-e602-5f67-9a58-b0f43b7c5be5",
    "parent_id": "b3885324-97e3-5c10-aedb-ae9588342d4d",
    "role": "mother",
    "status": "confirmed",
    "source_ids": [
      "src_chengdu_newborns_2017_en",
      "src_chengdu_newborns_2017_zh",
      "src_chengdu_zhen_xi_visit_2024"
    ]
  }
];

export const TRUSTED_LINEAGE_NODES: PandaLineageNode[] = [
  {
    "id": "01878819-1eda-5d9c-96ab-bab66d3b0b09",
    "slug": "shin-shin",
    "name_zh": "真真",
    "name_en": "Shin Shin",
    "gender": "female",
    "status": "alive",
    "birth_date": "2005-07-03",
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
    "id": "09ebb49d-7bbe-56d1-8059-f5008338eab7",
    "slug": "lun-hui",
    "name_zh": "轮辉",
    "name_en": "Lun Hui / Wu Wu",
    "gender": "male",
    "status": "alive",
    "birth_date": "2021-07-25",
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
    "record_tier": "identity_first_pass",
    "profile_available": true
  },
  {
    "id": "0a60ed76-cee8-5c2d-ada7-8ec50b085471",
    "slug": "ya-song",
    "name_zh": "雅颂",
    "name_en": "Ya Song",
    "gender": "female",
    "status": "alive",
    "birth_date": "2021-07-31",
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
    "record_tier": "identity_first_pass",
    "profile_available": true
  },
  {
    "id": "0f7f494a-ec00-5e43-92e0-d299fe858d95",
    "slug": "bao-xin",
    "name_zh": "宝新",
    "name_en": "Bao Xin",
    "gender": "male",
    "status": "unknown",
    "birth_date": "2021-06-24",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [],
    "intro": null,
    "tags": [
      "trusted-archive",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": "771b6aef-2075-5d3e-8a82-7adc5822b99c",
    "record_tier": "identity_first_pass",
    "profile_available": true
  },
  {
    "id": "13fce46c-feb1-5667-9aa3-290f5c296636",
    "slug": "jin-xiao",
    "name_zh": "金宵",
    "name_en": "Jin Xiao",
    "gender": "female",
    "status": "alive",
    "birth_date": "2021-07-23",
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
    "id": "275ad0df-c700-5991-a13a-0ca47c56eeba",
    "slug": "xiao-xiao",
    "name_zh": "晓晓",
    "name_en": "Xiao Xiao",
    "gender": "male",
    "status": "alive",
    "birth_date": "2021-06-23",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [],
    "intro": null,
    "tags": [
      "trusted-archive",
      "golden-dataset"
    ],
    "father_id": "57c0a1bd-cc44-5a08-ba48-f224e9956064",
    "mother_id": "01878819-1eda-5d9c-96ab-bab66d3b0b09",
    "record_tier": "complete_first_pass",
    "profile_available": true
  },
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
    "id": "2a589b9f-1700-5b1e-8c2f-8203190da905",
    "slug": "xiao-xin-chengdu-2017",
    "name_zh": "小馨",
    "name_en": "Xiao Xin",
    "gender": "female",
    "status": "unknown",
    "birth_date": "2017-07-26",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [],
    "intro": null,
    "tags": [
      "trusted-archive",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": "70e56c3f-4290-55b9-abb5-79fe098f1a07",
    "record_tier": "identity_first_pass",
    "profile_available": true
  },
  {
    "id": "35d085c8-d0b5-5779-99ba-c54166451f5b",
    "slug": "er-qiao",
    "name_zh": "二巧",
    "name_en": "Er Qiao",
    "gender": "female",
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
    "record_tier": "identity_first_pass",
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
    "record_tier": "complete_first_pass",
    "profile_available": true
  },
  {
    "id": "47714294-e602-5f67-9a58-b0f43b7c5be5",
    "slug": "zhen-xi",
    "name_zh": "珍喜",
    "name_en": "Zhen Xi",
    "gender": "female",
    "status": "alive",
    "birth_date": "2017-07-15",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [],
    "intro": null,
    "tags": [
      "trusted-archive",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": "b3885324-97e3-5c10-aedb-ae9588342d4d",
    "record_tier": "complete_first_pass",
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
    "id": "50afb182-8e05-5371-b341-253acb018792",
    "slug": "jing-liang",
    "name_zh": "晶亮",
    "name_en": "Jing Liang",
    "gender": "male",
    "status": "alive",
    "birth_date": "2017-07-10",
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
    "record_tier": "identity_first_pass",
    "profile_available": true
  },
  {
    "id": "51847c05-7342-5e4c-a5b5-c00d23f9a6be",
    "slug": "zhao-mei",
    "name_zh": "昭美",
    "name_en": "Zhao Mei",
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
    "father_id": null,
    "mother_id": null,
    "record_tier": "identity_first_pass",
    "profile_available": true
  },
  {
    "id": "57c0a1bd-cc44-5a08-ba48-f224e9956064",
    "slug": "ri-ri",
    "name_zh": "力力",
    "name_en": "Ri Ri",
    "gender": "male",
    "status": "alive",
    "birth_date": "2005-08-16",
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
    "id": "6457a76c-827c-50f5-9306-075d80e8e1d0",
    "slug": "cheng-lan",
    "name_zh": "成兰",
    "name_en": "Cheng Lan",
    "gender": "male",
    "status": "alive",
    "birth_date": "2017-06-27",
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
    "record_tier": "identity_first_pass",
    "profile_available": true
  },
  {
    "id": "70e56c3f-4290-55b9-abb5-79fe098f1a07",
    "slug": "xiao-yatou",
    "name_zh": "小丫头",
    "name_en": "Xiao Yatou",
    "gender": "female",
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
    "record_tier": "identity_first_pass",
    "profile_available": true
  },
  {
    "id": "75e9524a-9baf-5454-af65-229fea00cd20",
    "slug": "da-mei-changsha",
    "name_zh": "大美",
    "name_en": "Da Mei",
    "gender": "female",
    "status": "alive",
    "birth_date": "2017-06-27",
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
    "record_tier": "identity_first_pass",
    "profile_available": true
  },
  {
    "id": "771b6aef-2075-5d3e-8a82-7adc5822b99c",
    "slug": "a-bao",
    "name_zh": "阿宝",
    "name_en": "A Bao",
    "gender": "female",
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
    "id": "907e93e2-d664-500f-b1b5-af06fd039172",
    "slug": "zhi-shi",
    "name_zh": "芝士",
    "name_en": "Zhi Shi",
    "gender": "male",
    "status": "alive",
    "birth_date": "2017-04-24",
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
    "id": "939aed44-55a9-51e6-8f2e-c50866be3a6a",
    "slug": "zhi-ma",
    "name_zh": "芝麻",
    "name_en": "Zhi Ma",
    "gender": "male",
    "status": "alive",
    "birth_date": "2017-04-24",
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
    "record_tier": "identity_first_pass",
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
    "id": "b3885324-97e3-5c10-aedb-ae9588342d4d",
    "slug": "qi-zhen",
    "name_zh": "奇珍",
    "name_en": "Qi Zhen",
    "gender": "female",
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
    "record_tier": "identity_first_pass",
    "profile_available": true
  },
  {
    "id": "c2eefef1-54f2-58ca-85cc-c2fd3d63653a",
    "slug": "lei-lei",
    "name_zh": "蕾蕾",
    "name_en": "Lei Lei",
    "gender": "female",
    "status": "alive",
    "birth_date": "2021-06-23",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [],
    "intro": null,
    "tags": [
      "trusted-archive",
      "golden-dataset"
    ],
    "father_id": "57c0a1bd-cc44-5a08-ba48-f224e9956064",
    "mother_id": "01878819-1eda-5d9c-96ab-bab66d3b0b09",
    "record_tier": "complete_first_pass",
    "profile_available": true
  },
  {
    "id": "ca531a8b-63d2-5f16-9fbc-0e61e2e23297",
    "slug": "ni-ke",
    "name_zh": "妮可",
    "name_en": "Ni Ke",
    "gender": "male",
    "status": "alive",
    "birth_date": "2017-07-20",
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
    "record_tier": "identity_first_pass",
    "profile_available": true
  },
  {
    "id": "d24087cd-70d6-5902-92dd-ecc95186937b",
    "slug": "xi-lun",
    "name_zh": "喜伦",
    "name_en": "Xi Lun",
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
    "id": "d2da42a3-7a0b-5384-aeb1-afaff1439894",
    "slug": "ni-na",
    "name_zh": "妮娜",
    "name_en": "Ni Na",
    "gender": "female",
    "status": "alive",
    "birth_date": "2017-07-20",
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
    "record_tier": "identity_first_pass",
    "profile_available": true
  },
  {
    "id": "d56dffc3-941c-5640-983d-4f4959c97e03",
    "slug": "qing-bao",
    "name_zh": "青宝",
    "name_en": "Qing Bao",
    "gender": "female",
    "status": "alive",
    "birth_date": "2021-09-12",
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
    "id": "e8690164-c982-53c0-a837-377e649de435",
    "slug": "qi-fu-changsha",
    "name_zh": "奇福",
    "name_en": "Qi Fu",
    "gender": "female",
    "status": "alive",
    "birth_date": "2008-07-26",
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
    "record_tier": "identity_first_pass",
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
    "id": "fc74efcb-3a15-51e8-bf45-d9a294a8cbc8",
    "slug": "qing-qing-chengdu-2017-07-26",
    "name_zh": "青青",
    "name_en": "Qing Qing",
    "gender": "female",
    "status": "unknown",
    "birth_date": "2017-07-26",
    "current_location": null,
    "cover_image_url": null,
    "search_terms": [],
    "intro": null,
    "tags": [
      "trusted-archive",
      "golden-dataset"
    ],
    "father_id": null,
    "mother_id": "35d085c8-d0b5-5779-99ba-c54166451f5b",
    "record_tier": "identity_first_pass",
    "profile_available": true
  },
  {
    "id": "fcc89c7a-6046-5c2c-bcb4-bf1fb50182a1",
    "slug": "ya-li",
    "name_zh": "雅莉",
    "name_en": "Ya Li",
    "gender": "female",
    "status": "alive",
    "birth_date": "2009-07-19",
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
    "record_tier": "identity_first_pass",
    "profile_available": true
  },
  {
    "id": "fd184343-de89-5e60-bb3b-0a5f780179d8",
    "slug": "pu-pu-shenyang",
    "name_zh": "噗噗",
    "name_en": "Pu Pu",
    "gender": "female",
    "status": "alive",
    "birth_date": "2014-08-10",
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
    "record_tier": "identity_first_pass",
    "profile_available": true
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
  }
];

export const TRUSTED_LINEAGE_EDGES: PandaLineageEdge[] = [
  {
    "parent_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "child_id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6"
  },
  {
    "parent_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "child_id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6"
  },
  {
    "parent_id": "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6",
    "child_id": "434e10e3-7ba0-5de7-a59e-d3984524c58c"
  },
  {
    "parent_id": "771b6aef-2075-5d3e-8a82-7adc5822b99c",
    "child_id": "0f7f494a-ec00-5e43-92e0-d299fe858d95"
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
    "parent_id": "57c0a1bd-cc44-5a08-ba48-f224e9956064",
    "child_id": "c2eefef1-54f2-58ca-85cc-c2fd3d63653a"
  },
  {
    "parent_id": "01878819-1eda-5d9c-96ab-bab66d3b0b09",
    "child_id": "c2eefef1-54f2-58ca-85cc-c2fd3d63653a"
  },
  {
    "parent_id": "35d085c8-d0b5-5779-99ba-c54166451f5b",
    "child_id": "fc74efcb-3a15-51e8-bf45-d9a294a8cbc8"
  },
  {
    "parent_id": "38cd1cad-3e34-5511-bc35-a091ece74e11",
    "child_id": "96d00a39-7865-55db-b5c2-f339ef692258"
  },
  {
    "parent_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    "child_id": "96d00a39-7865-55db-b5c2-f339ef692258"
  },
  {
    "parent_id": "db108e44-8893-54e1-8cb5-8c5238b75089",
    "child_id": "d24087cd-70d6-5902-92dd-ecc95186937b"
  },
  {
    "parent_id": "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
    "child_id": "d24087cd-70d6-5902-92dd-ecc95186937b"
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
    "parent_id": "57c0a1bd-cc44-5a08-ba48-f224e9956064",
    "child_id": "275ad0df-c700-5991-a13a-0ca47c56eeba"
  },
  {
    "parent_id": "01878819-1eda-5d9c-96ab-bab66d3b0b09",
    "child_id": "275ad0df-c700-5991-a13a-0ca47c56eeba"
  },
  {
    "parent_id": "70e56c3f-4290-55b9-abb5-79fe098f1a07",
    "child_id": "2a589b9f-1700-5b1e-8c2f-8203190da905"
  },
  {
    "parent_id": "db108e44-8893-54e1-8cb5-8c5238b75089",
    "child_id": "fa8a0c14-b937-5de5-ae65-482cfd744482"
  },
  {
    "parent_id": "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
    "child_id": "fa8a0c14-b937-5de5-ae65-482cfd744482"
  },
  {
    "parent_id": "b3885324-97e3-5c10-aedb-ae9588342d4d",
    "child_id": "47714294-e602-5f67-9a58-b0f43b7c5be5"
  }
];
