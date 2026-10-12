// Generated from Public Release 2026.08.12.1.
// Run npm run generate:public-experiences after changing the release projection.

import type { PublicFamilyStoryRecord, PublicProfileCohortRecord } from "@/lib/types";

export const PUBLIC_EXPERIENCE_RELEASE = {
  "database_migration_version": "0007",
  "dataset_release_version": "2026.08.12.1",
  "projection_code_version": "local-research-merge-v1",
  "public_schema_version": "1.3.0",
  "publication_batch_id": "local-research-direct-merge-2026-08-12",
  "released_at": "2026-08-12T00:00:00Z"
} as const;

export const TRUSTED_FAMILY_STORIES: PublicFamilyStoryRecord[] = [
  {
    "chapters": [
      {
        "event_ids": [],
        "facility_ids": [],
        "id": "washington-programme",
        "kind": "programme",
        "localized_content": [
          {
            "locale": "zh-CN",
            "summary": "美香与添添在史密森国家动物园的长期项目背景。",
            "title": "华盛顿的长期篇章"
          },
          {
            "locale": "en",
            "summary": "The long Smithsonian programme chapter of Mei Xiang and Tian Tian.",
            "title": "A long Washington chapter"
          }
        ],
        "member_ids": [
          "2939c16f-1938-5629-928c-b36b1d5cd6ed",
          "38cd1cad-3e34-5511-bc35-a091ece74e11"
        ],
        "place_ids": [],
        "relationship_assertion_ids": []
      },
      {
        "event_ids": [],
        "facility_ids": [],
        "id": "four-published-offspring",
        "kind": "generation",
        "localized_content": [
          {
            "locale": "zh-CN",
            "summary": "泰山、宝宝、贝贝和小奇迹通过八条已确认亲本断言进入故事。",
            "title": "四个已发布子代"
          },
          {
            "locale": "en",
            "summary": "Tai Shan, Bao Bao, Bei Bei, and Xiao Qi Ji enter through eight confirmed parentage assertions.",
            "title": "Four published offspring"
          }
        ],
        "member_ids": [
          "96d00a39-7865-55db-b5c2-f339ef692258",
          "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6",
          "1a05a5dc-1926-5355-9d81-c2a43189d50b",
          "926abc78-1e79-55c6-b24a-d33b4e5f6443"
        ],
        "place_ids": [],
        "relationship_assertion_ids": [
          "parent-tai-shan-father",
          "parent-tai-shan-mother",
          "parent-bao-bao-father",
          "parent-bao-bao-mother",
          "parent-bei-bei-father",
          "parent-bei-bei-mother",
          "parent-xiao-qi-ji-father",
          "parent-xiao-qi-ji-mother"
        ]
      },
      {
        "event_ids": [
          "event-smithsonian-return-plan-2020",
          "event-smithsonian-departure-2023"
        ],
        "facility_ids": [],
        "id": "return-to-china",
        "kind": "journey",
        "localized_content": [
          {
            "locale": "zh-CN",
            "summary": "2020 年的返回计划与 2023 年完成的多人迁移是两个不同状态的事件。",
            "title": "宣布与完成必须分开"
          },
          {
            "locale": "en",
            "summary": "The 2020 return plan and the completed multi-participant 2023 transfer remain distinct events.",
            "title": "Announcement and completion stay separate"
          }
        ],
        "member_ids": [
          "2939c16f-1938-5629-928c-b36b1d5cd6ed",
          "38cd1cad-3e34-5511-bc35-a091ece74e11",
          "926abc78-1e79-55c6-b24a-d33b4e5f6443"
        ],
        "place_ids": [],
        "relationship_assertion_ids": []
      },
      {
        "event_ids": [
          "event-bao-li-birth",
          "event-bao-li-arrival-2024",
          "event-bao-li-public-debut-2025"
        ],
        "facility_ids": [],
        "id": "bao-li-next-generation",
        "kind": "maternal_line",
        "localized_content": [
          {
            "locale": "zh-CN",
            "summary": "宝宝之子宝力以已确认母系、暂定父系和独立到达及亮相事件进入第三代。",
            "title": "下一代回到华盛顿"
          },
          {
            "locale": "en",
            "summary": "Bao Bao's son Bao Li enters the third generation through a confirmed maternal edge, a tentative paternal edge, and separate arrival and debut events.",
            "title": "A next generation returns to Washington"
          }
        ],
        "member_ids": [
          "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6",
          "434e10e3-7ba0-5de7-a59e-d3984524c58c"
        ],
        "place_ids": [],
        "relationship_assertion_ids": [
          "parent-bao-li-mother",
          "parent-bao-li-father"
        ]
      }
    ],
    "id": "family-smithsonian-generations",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "一个声明为部分范围的三代史密森家族故事。",
        "title": "从美香到宝力"
      },
      {
        "locale": "en",
        "summary": "A deliberately bounded three-generation Smithsonian family story.",
        "title": "From Mei Xiang to Bao Li"
      }
    ],
    "media": {
      "featured_panda_ids": [
        "434e10e3-7ba0-5de7-a59e-d3984524c58c"
      ],
      "selection_state": "reviewed"
    },
    "member_ids": [
      "2939c16f-1938-5629-928c-b36b1d5cd6ed",
      "38cd1cad-3e34-5511-bc35-a091ece74e11",
      "96d00a39-7865-55db-b5c2-f339ef692258",
      "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6",
      "1a05a5dc-1926-5355-9d81-c2a43189d50b",
      "926abc78-1e79-55c6-b24a-d33b4e5f6443",
      "434e10e3-7ba0-5de7-a59e-d3984524c58c"
    ],
    "relationship_assertion_ids": [
      "parent-tai-shan-father",
      "parent-tai-shan-mother",
      "parent-bao-bao-father",
      "parent-bao-bao-mother",
      "parent-bei-bei-father",
      "parent-bei-bei-mother",
      "parent-xiao-qi-ji-father",
      "parent-xiao-qi-ji-mother",
      "parent-bao-li-mother",
      "parent-bao-li-father"
    ],
    "revision": {
      "data_version": "2026.08.12.1",
      "public_schema_version": "1.3.0"
    },
    "scope": {
      "coverage_state": "partial",
      "excluded_relationship_assertion_ids": [
        "parent-tian-tian-father",
        "parent-tian-tian-mother"
      ],
      "member_ids": [
        "2939c16f-1938-5629-928c-b36b1d5cd6ed",
        "38cd1cad-3e34-5511-bc35-a091ece74e11",
        "96d00a39-7865-55db-b5c2-f339ef692258",
        "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6",
        "1a05a5dc-1926-5355-9d81-c2a43189d50b",
        "926abc78-1e79-55c6-b24a-d33b4e5f6443",
        "434e10e3-7ba0-5de7-a59e-d3984524c58c"
      ],
      "relationship_assertion_ids": [
        "parent-tai-shan-father",
        "parent-tai-shan-mother",
        "parent-bao-bao-father",
        "parent-bao-bao-mother",
        "parent-bei-bei-father",
        "parent-bei-bei-mother",
        "parent-xiao-qi-ji-father",
        "parent-xiao-qi-ji-mother",
        "parent-bao-li-mother",
        "parent-bao-li-father"
      ]
    },
    "slug": "smithsonian-generations",
    "source_ids": [
      "src_smithsonian_agreement_2020",
      "src_smithsonian_giant_panda_faq",
      "src_smithsonian_history"
    ],
    "story_type": "programme_longform_v1"
  },
  {
    "chapters": [
      {
        "event_ids": [
          "event-ueno-pair-arrival-2011"
        ],
        "facility_ids": [],
        "id": "parents-arrive-ueno",
        "kind": "pair",
        "localized_content": [
          {
            "locale": "zh-CN",
            "summary": "真真与力力的共同到达事件构成家庭故事的机构起点。",
            "title": "父母抵达上野"
          },
          {
            "locale": "en",
            "summary": "Shin Shin and Ri Ri's shared arrival is the institutional starting point.",
            "title": "The parents arrive at Ueno"
          }
        ],
        "member_ids": [
          "01878819-1eda-5d9c-96ab-bab66d3b0b09",
          "57c0a1bd-cc44-5a08-ba48-f224e9956064"
        ],
        "place_ids": [],
        "relationship_assertion_ids": []
      },
      {
        "event_ids": [
          "event-ueno-twins-birth-2021",
          "event-ueno-twins-named-2021"
        ],
        "facility_ids": [],
        "id": "twins-born-and-named",
        "kind": "twin_parallel",
        "localized_content": [
          {
            "locale": "zh-CN",
            "summary": "晓晓与蕾蕾共享出生和命名事件，但继续保留各自档案与四条亲本断言。",
            "title": "同日出生，独立身份"
          },
          {
            "locale": "en",
            "summary": "Xiao Xiao and Lei Lei share birth and naming events while retaining separate profiles and four parentage assertions.",
            "title": "Born together, retained as distinct identities"
          }
        ],
        "member_ids": [
          "275ad0df-c700-5991-a13a-0ca47c56eeba",
          "c2eefef1-54f2-58ca-85cc-c2fd3d63653a"
        ],
        "place_ids": [],
        "relationship_assertion_ids": [
          "parent-xiao-xiao-father",
          "parent-xiao-xiao-mother",
          "parent-lei-lei-father",
          "parent-lei-lei-mother"
        ]
      },
      {
        "event_ids": [
          "event-ueno-pair-return-2024",
          "event-ueno-twins-return-2026"
        ],
        "facility_ids": [],
        "id": "two-return-chapters",
        "kind": "journey",
        "localized_content": [
          {
            "locale": "zh-CN",
            "summary": "父母 2024 年返回与双胞胎 2026 年返回分别保留事件身份和参与者。",
            "title": "两次返回，不合并成一次"
          },
          {
            "locale": "en",
            "summary": "The parents' 2024 return and the twins' 2026 return retain separate event identities and participants.",
            "title": "Two returns, not one merged event"
          }
        ],
        "member_ids": [
          "01878819-1eda-5d9c-96ab-bab66d3b0b09",
          "57c0a1bd-cc44-5a08-ba48-f224e9956064",
          "275ad0df-c700-5991-a13a-0ca47c56eeba",
          "c2eefef1-54f2-58ca-85cc-c2fd3d63653a"
        ],
        "place_ids": [],
        "relationship_assertion_ids": []
      }
    ],
    "id": "family-ueno-twins",
    "localized_content": [
      {
        "locale": "zh-CN",
        "summary": "以父母、双胞胎和两次返回为主线的紧凑家庭故事。",
        "title": "上野双胞胎家庭"
      },
      {
        "locale": "en",
        "summary": "A compact family story organized around the parents, the twins, and two return journeys.",
        "title": "The Ueno twin family"
      }
    ],
    "media": {
      "featured_panda_ids": [
        "01878819-1eda-5d9c-96ab-bab66d3b0b09",
        "57c0a1bd-cc44-5a08-ba48-f224e9956064"
      ],
      "selection_state": "reviewed"
    },
    "member_ids": [
      "01878819-1eda-5d9c-96ab-bab66d3b0b09",
      "57c0a1bd-cc44-5a08-ba48-f224e9956064",
      "275ad0df-c700-5991-a13a-0ca47c56eeba",
      "c2eefef1-54f2-58ca-85cc-c2fd3d63653a"
    ],
    "relationship_assertion_ids": [
      "parent-xiao-xiao-father",
      "parent-xiao-xiao-mother",
      "parent-lei-lei-father",
      "parent-lei-lei-mother"
    ],
    "revision": {
      "data_version": "2026.08.12.1",
      "public_schema_version": "1.3.0"
    },
    "scope": {
      "coverage_state": "complete_for_declared_scope",
      "excluded_relationship_assertion_ids": [],
      "member_ids": [
        "01878819-1eda-5d9c-96ab-bab66d3b0b09",
        "57c0a1bd-cc44-5a08-ba48-f224e9956064",
        "275ad0df-c700-5991-a13a-0ca47c56eeba",
        "c2eefef1-54f2-58ca-85cc-c2fd3d63653a"
      ],
      "relationship_assertion_ids": [
        "parent-xiao-xiao-father",
        "parent-xiao-xiao-mother",
        "parent-lei-lei-father",
        "parent-lei-lei-mother"
      ]
    },
    "slug": "ueno-twins",
    "source_ids": [
      "src_tokyo_zoo_ueno_panda_history",
      "src_ueno_return_riri_shinshin",
      "src_ueno_twins_names_2021",
      "src_ueno_xiaolei_return_2026"
    ],
    "story_type": "twin_parallel_v1"
  }
];

export const TRUSTED_PROFILE_COHORT: PublicProfileCohortRecord[] = [
  {
    "slug": "xi-lun",
    "state": "rich"
  },
  {
    "slug": "lun-hui",
    "state": "sparse"
  },
  {
    "slug": "yong-ba",
    "state": "historic"
  }
];
