// Generated from Public Release 2026.07.31.1.
// Run npm run generate:public-experiences after changing the release projection.

import type { PandaDomainEventSummary, PublicFamilyStoryRecord, PublicProfileCohortRecord, PublicSourceSummary } from "@/lib/types";

export const PUBLIC_EXPERIENCE_RELEASE = {
  "database_migration_version": "0007",
  "dataset_release_version": "2026.07.31.1",
  "projection_code_version": "public-experience-v1",
  "public_schema_version": "1.3.0",
  "publication_batch_id": "public-experiences-first-cohort-2026-07-31",
  "released_at": "2026-07-31T12:00:00Z"
} as const;

export const TRUSTED_PUBLIC_EVENTS: PandaDomainEventSummary[] = [
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
    "to_coarse_location": null,
    "changes_current_residency": true,
    "event_date": "2024-10-15",
    "event_status": "completed",
    "event_type": "arrival",
    "id": "event-bao-li-arrival-2024",
    "participants": [
      "434e10e3-7ba0-5de7-a59e-d3984524c58c"
    ],
    "source_ids": [
      "src_smithsonian_history"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
    "to_coarse_location": null,
    "changes_current_residency": false,
    "event_date": "2021-08-04",
    "event_status": "completed",
    "event_type": "birth",
    "id": "event-bao-li-birth",
    "participants": [
      "434e10e3-7ba0-5de7-a59e-d3984524c58c"
    ],
    "source_ids": [
      "src_smithsonian_giant_panda_faq"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
    "to_coarse_location": null,
    "changes_current_residency": false,
    "event_date": "2025-01-24",
    "event_status": "completed",
    "event_type": "public_debut",
    "id": "event-bao-li-public-debut-2025",
    "participants": [
      "434e10e3-7ba0-5de7-a59e-d3984524c58c"
    ],
    "source_ids": [
      "src_smithsonian_history"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0",
    "to_coarse_location": null,
    "changes_current_residency": false,
    "event_date": "1997-08-25",
    "event_status": "completed",
    "event_type": "birth",
    "id": "event-lun-lun-birth",
    "participants": [
      "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f"
    ],
    "source_ids": [
      "src_zooatlanta_lun_lun"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
    "to_coarse_location": null,
    "changes_current_residency": true,
    "event_date": "2024-10-15",
    "event_status": "completed",
    "event_type": "arrival",
    "id": "event-qing-bao-arrival-2024",
    "participants": [
      "d56dffc3-941c-5640-983d-4f4959c97e03"
    ],
    "source_ids": [
      "src_smithsonian_history"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
    "to_coarse_location": null,
    "changes_current_residency": false,
    "event_date": "2021-09-12",
    "event_status": "completed",
    "event_type": "birth",
    "id": "event-qing-bao-birth",
    "participants": [
      "d56dffc3-941c-5640-983d-4f4959c97e03"
    ],
    "source_ids": [
      "src_smithsonian_giant_panda_faq"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
    "to_coarse_location": null,
    "changes_current_residency": false,
    "event_date": "2025-01-24",
    "event_status": "completed",
    "event_type": "public_debut",
    "id": "event-qing-bao-public-debut-2025",
    "participants": [
      "d56dffc3-941c-5640-983d-4f4959c97e03"
    ],
    "source_ids": [
      "src_smithsonian_history"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": null,
    "changes_current_residency": false,
    "event_date": "2005-08-16",
    "event_status": "completed",
    "event_type": "birth",
    "id": "event-ri-ri-birth",
    "participants": [
      "57c0a1bd-cc44-5a08-ba48-f224e9956064"
    ],
    "source_ids": [
      "src_tokyo_zoo_ueno_panda_history",
      "src_ueno_return_riri_shinshin"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": null,
    "changes_current_residency": false,
    "event_date": "2005-07-03",
    "event_status": "completed",
    "event_type": "birth",
    "id": "event-shin-shin-birth",
    "participants": [
      "01878819-1eda-5d9c-96ab-bab66d3b0b09"
    ],
    "source_ids": [
      "src_tokyo_zoo_ueno_panda_history",
      "src_ueno_return_riri_shinshin"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "China",
    "changes_current_residency": true,
    "event_date": "2023-11-08",
    "event_status": "completed",
    "event_type": "transfer",
    "id": "event-smithsonian-departure-2023",
    "participants": [
      "2939c16f-1938-5629-928c-b36b1d5cd6ed",
      "38cd1cad-3e34-5511-bc35-a091ece74e11",
      "926abc78-1e79-55c6-b24a-d33b4e5f6443"
    ],
    "source_ids": [
      "src_smithsonian_history"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": "afb0f227-dd5e-5076-88e3-74e9807a6049",
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "China",
    "changes_current_residency": false,
    "event_date": "2020-12-07",
    "event_status": "announced",
    "event_type": "transfer",
    "id": "event-smithsonian-return-plan-2020",
    "participants": [
      "2939c16f-1938-5629-928c-b36b1d5cd6ed",
      "38cd1cad-3e34-5511-bc35-a091ece74e11",
      "926abc78-1e79-55c6-b24a-d33b4e5f6443"
    ],
    "source_ids": [
      "src_smithsonian_agreement_2020"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
    "to_coarse_location": null,
    "changes_current_residency": false,
    "event_date": "2011-02-21",
    "event_status": "completed",
    "event_type": "arrival",
    "id": "event-ueno-pair-arrival-2011",
    "participants": [
      "57c0a1bd-cc44-5a08-ba48-f224e9956064",
      "01878819-1eda-5d9c-96ab-bab66d3b0b09"
    ],
    "source_ids": [
      "src_tokyo_zoo_ueno_panda_history",
      "src_ueno_return_riri_shinshin"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
    "from_coarse_location": null,
    "to_facility_id": "7e8c3dc5-0725-5c1e-bc97-53f3e9c47995",
    "to_coarse_location": null,
    "changes_current_residency": true,
    "event_date": "2024-09-29",
    "event_status": "completed",
    "event_type": "transfer",
    "id": "event-ueno-pair-return-2024",
    "participants": [
      "57c0a1bd-cc44-5a08-ba48-f224e9956064",
      "01878819-1eda-5d9c-96ab-bab66d3b0b09"
    ],
    "source_ids": [
      "src_ueno_return_riri_shinshin"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
    "to_coarse_location": null,
    "changes_current_residency": false,
    "event_date": "2021-06-23",
    "event_status": "completed",
    "event_type": "birth",
    "id": "event-ueno-twins-birth-2021",
    "participants": [
      "275ad0df-c700-5991-a13a-0ca47c56eeba",
      "c2eefef1-54f2-58ca-85cc-c2fd3d63653a"
    ],
    "source_ids": [
      "src_tokyo_zoo_ueno_panda_history",
      "src_ueno_twins_names_2021"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
    "to_coarse_location": null,
    "changes_current_residency": false,
    "event_date": "2021-10-08",
    "event_status": "completed",
    "event_type": "naming",
    "id": "event-ueno-twins-named-2021",
    "participants": [
      "275ad0df-c700-5991-a13a-0ca47c56eeba",
      "c2eefef1-54f2-58ca-85cc-c2fd3d63653a"
    ],
    "source_ids": [
      "src_ueno_twins_names_2021"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": "3f805d86-f31c-5d2c-991e-0e7ad8d4afc9",
    "from_coarse_location": null,
    "to_facility_id": "d773a478-6014-5a4f-9e29-a0903f4beea6",
    "to_coarse_location": null,
    "changes_current_residency": true,
    "event_date": "2026-01-28",
    "event_status": "completed",
    "event_type": "transfer",
    "id": "event-ueno-twins-return-2026",
    "participants": [
      "275ad0df-c700-5991-a13a-0ca47c56eeba",
      "c2eefef1-54f2-58ca-85cc-c2fd3d63653a"
    ],
    "source_ids": [
      "src_ueno_xiaolei_return_2026"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2",
    "to_coarse_location": null,
    "changes_current_residency": false,
    "event_date": "2016-09-03",
    "event_status": "completed",
    "event_type": "birth",
    "id": "event-xi-lun-birth",
    "participants": [
      "d24087cd-70d6-5902-92dd-ecc95186937b"
    ],
    "source_ids": [
      "src_zooatlanta_cubs_birth",
      "src_zooatlanta_twins_names"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2",
    "to_coarse_location": null,
    "changes_current_residency": false,
    "event_date": "2016-12-27",
    "event_status": "completed",
    "event_type": "public_debut",
    "id": "event-xi-lun-public-debut",
    "participants": [
      "d24087cd-70d6-5902-92dd-ecc95186937b"
    ],
    "source_ids": [
      "src_zooatlanta_2016_public_debut"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2",
    "to_coarse_location": null,
    "changes_current_residency": false,
    "event_date": "2016-09-03",
    "event_status": "completed",
    "event_type": "birth",
    "id": "event-ya-lun-birth",
    "participants": [
      "fa8a0c14-b937-5de5-ae65-482cfd744482"
    ],
    "source_ids": [
      "src_zooatlanta_cubs_birth",
      "src_zooatlanta_twins_names"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2",
    "to_coarse_location": null,
    "changes_current_residency": false,
    "event_date": "2016-12-27",
    "event_status": "completed",
    "event_type": "public_debut",
    "id": "event-ya-lun-public-debut",
    "participants": [
      "fa8a0c14-b937-5de5-ae65-482cfd744482"
    ],
    "source_ids": [
      "src_zooatlanta_2016_public_debut"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0",
    "to_coarse_location": null,
    "changes_current_residency": false,
    "event_date": "1997-09-09",
    "event_status": "completed",
    "event_type": "birth",
    "id": "event-yang-yang-birth",
    "participants": [
      "db108e44-8893-54e1-8cb5-8c5238b75089"
    ],
    "source_ids": [
      "src_zooatlanta_yang_yang"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2",
    "to_coarse_location": null,
    "changes_current_residency": false,
    "event_date": "1999-11-05",
    "event_status": "completed",
    "event_type": "arrival",
    "id": "event-zoo-atlanta-pair-arrival-1999",
    "participants": [
      "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
      "db108e44-8893-54e1-8cb5-8c5238b75089"
    ],
    "source_ids": [
      "src_zooatlanta_lun_lun",
      "src_zooatlanta_yang_yang"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2",
    "from_coarse_location": null,
    "to_facility_id": "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0",
    "to_coarse_location": null,
    "changes_current_residency": true,
    "event_date": "2024-10-12",
    "event_status": "completed",
    "event_type": "transfer",
    "id": "event-zoo-atlanta-return-2024",
    "participants": [
      "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
      "d24087cd-70d6-5902-92dd-ecc95186937b",
      "db108e44-8893-54e1-8cb5-8c5238b75089",
      "fa8a0c14-b937-5de5-ae65-482cfd744482"
    ],
    "source_ids": [
      "src_zooatlanta_arrival_china_2024"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
    "changes_current_residency": false,
    "event_date": "2021-06-24",
    "event_status": "completed",
    "event_type": "birth",
    "id": "evt_bao_xin_birth_20210624",
    "participants": [
      "0f7f494a-ec00-5e43-92e0-d299fe858d95",
      "771b6aef-2075-5d3e-8a82-7adc5822b99c"
    ],
    "source_ids": [
      "src_chengdu_newborns_2021_en",
      "src_chengdu_newborns_2021_zh"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
    "changes_current_residency": false,
    "event_date": "2021-10-01",
    "event_status": "completed",
    "event_type": "public_debut",
    "id": "evt_bao_xin_online_debut_20211001",
    "participants": [
      "0f7f494a-ec00-5e43-92e0-d299fe858d95"
    ],
    "source_ids": [
      "src_chengdu_newborns_2021_en",
      "src_chengdu_newborns_2021_zh"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
    "changes_current_residency": false,
    "event_date": "2017-06-27",
    "event_status": "completed",
    "event_type": "birth",
    "id": "evt_cheng_lan_birth_20170627",
    "participants": [
      "6457a76c-827c-50f5-9306-075d80e8e1d0"
    ],
    "source_ids": [
      "src_chengdu_newborns_2017_en",
      "src_chengdu_newborns_2017_zh"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
    "changes_current_residency": false,
    "event_date": "2017-06-27",
    "event_status": "completed",
    "event_type": "birth",
    "id": "evt_da_mei_changsha_birth_20170627",
    "participants": [
      "75e9524a-9baf-5454-af65-229fea00cd20"
    ],
    "source_ids": [
      "src_chengdu_newborns_2017_en",
      "src_chengdu_newborns_2017_zh"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
    "changes_current_residency": false,
    "event_date": "2021-07-23",
    "event_status": "completed",
    "event_type": "birth",
    "id": "evt_jin_xiao_birth_20210723",
    "participants": [
      "13fce46c-feb1-5667-9aa3-290f5c296636"
    ],
    "source_ids": [
      "src_chengdu_newborns_2021_en",
      "src_chengdu_newborns_2021_zh"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
    "changes_current_residency": false,
    "event_date": "2017-07-10",
    "event_status": "completed",
    "event_type": "birth",
    "id": "evt_jing_liang_birth_20170710",
    "participants": [
      "50afb182-8e05-5371-b341-253acb018792"
    ],
    "source_ids": [
      "src_chengdu_newborns_2017_en",
      "src_chengdu_newborns_2017_zh"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
    "changes_current_residency": false,
    "event_date": "2021-07-25",
    "event_status": "completed",
    "event_type": "birth",
    "id": "evt_lun_hui_birth_20210725",
    "participants": [
      "09ebb49d-7bbe-56d1-8059-f5008338eab7"
    ],
    "source_ids": [
      "src_chengdu_newborns_2021_en",
      "src_chengdu_newborns_2021_zh"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
    "changes_current_residency": false,
    "event_date": "2017-07-20",
    "event_status": "completed",
    "event_type": "birth",
    "id": "evt_ni_ke_birth_20170720",
    "participants": [
      "ca531a8b-63d2-5f16-9fbc-0e61e2e23297"
    ],
    "source_ids": [
      "src_chengdu_newborns_2017_en",
      "src_chengdu_newborns_2017_zh"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
    "changes_current_residency": false,
    "event_date": "2017-07-20",
    "event_status": "completed",
    "event_type": "birth",
    "id": "evt_ni_na_birth_20170720",
    "participants": [
      "d2da42a3-7a0b-5384-aeb1-afaff1439894"
    ],
    "source_ids": [
      "src_chengdu_newborns_2017_en",
      "src_chengdu_newborns_2017_zh"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
    "changes_current_residency": false,
    "event_date": "2021-07-17",
    "event_status": "completed",
    "event_type": "birth",
    "id": "evt_pu_pu_shenyang_birth_20210717",
    "participants": [
      "fd184343-de89-5e60-bb3b-0a5f780179d8"
    ],
    "source_ids": [
      "src_chengdu_newborns_2021_en",
      "src_chengdu_newborns_2021_zh"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
    "changes_current_residency": false,
    "event_date": "2017-07-26",
    "event_status": "completed",
    "event_type": "birth",
    "id": "evt_qing_qing_chengdu_2017_07_26_birth_20170726",
    "participants": [
      "35d085c8-d0b5-5779-99ba-c54166451f5b",
      "fc74efcb-3a15-51e8-bf45-d9a294a8cbc8"
    ],
    "source_ids": [
      "src_chengdu_newborns_2017_en",
      "src_chengdu_newborns_2017_zh"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
    "changes_current_residency": false,
    "event_date": "2017-09-27",
    "event_status": "completed",
    "event_type": "public_debut",
    "id": "evt_qing_qing_cohort_debut_20170927",
    "participants": [
      "fc74efcb-3a15-51e8-bf45-d9a294a8cbc8"
    ],
    "source_ids": [
      "src_chengdu_newborns_2017_en",
      "src_chengdu_newborns_2017_zh"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
    "changes_current_residency": false,
    "event_date": "2017-07-26",
    "event_status": "completed",
    "event_type": "birth",
    "id": "evt_xiao_xin_chengdu_2017_birth_20170726",
    "participants": [
      "2a589b9f-1700-5b1e-8c2f-8203190da905",
      "70e56c3f-4290-55b9-abb5-79fe098f1a07"
    ],
    "source_ids": [
      "src_chengdu_newborns_2017_en",
      "src_chengdu_newborns_2017_zh"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
    "changes_current_residency": false,
    "event_date": "2017-09-27",
    "event_status": "completed",
    "event_type": "public_debut",
    "id": "evt_xiao_xin_cohort_debut_20170927",
    "participants": [
      "2a589b9f-1700-5b1e-8c2f-8203190da905"
    ],
    "source_ids": [
      "src_chengdu_newborns_2017_en",
      "src_chengdu_newborns_2017_zh"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
    "changes_current_residency": false,
    "event_date": "2021-07-31",
    "event_status": "completed",
    "event_type": "birth",
    "id": "evt_ya_song_birth_20210731",
    "participants": [
      "0a60ed76-cee8-5c2d-ada7-8ec50b085471"
    ],
    "source_ids": [
      "src_chengdu_newborns_2021_en",
      "src_chengdu_newborns_2021_zh"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
    "changes_current_residency": false,
    "event_date": "2017-07-15",
    "event_status": "completed",
    "event_type": "birth",
    "id": "evt_zhen_xi_birth_20170715",
    "participants": [
      "47714294-e602-5f67-9a58-b0f43b7c5be5",
      "b3885324-97e3-5c10-aedb-ae9588342d4d"
    ],
    "source_ids": [
      "src_chengdu_newborns_2017_en",
      "src_chengdu_newborns_2017_zh"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China",
    "changes_current_residency": false,
    "event_date": "2017-09-27",
    "event_status": "completed",
    "event_type": "public_debut",
    "id": "evt_zhen_xi_cohort_debut_20170927",
    "participants": [
      "47714294-e602-5f67-9a58-b0f43b7c5be5"
    ],
    "source_ids": [
      "src_chengdu_newborns_2017_en",
      "src_chengdu_newborns_2017_zh"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Xinghan Hall, Chengdu Research Base of Giant Panda Breeding",
    "changes_current_residency": false,
    "event_date": "2024-04-01",
    "event_status": "completed",
    "event_type": "observation",
    "id": "evt_zhen_xi_xinghan_observation_20240401",
    "participants": [
      "47714294-e602-5f67-9a58-b0f43b7c5be5"
    ],
    "source_ids": [
      "src_chengdu_zhen_xi_visit_2024"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
    "changes_current_residency": false,
    "event_date": "2017-04-24",
    "event_status": "completed",
    "event_type": "birth",
    "id": "evt_zhi_ma_birth_20170424",
    "participants": [
      "939aed44-55a9-51e6-8f2e-c50866be3a6a"
    ],
    "source_ids": [
      "src_chengdu_newborns_2017_en",
      "src_chengdu_newborns_2017_zh"
    ]
  },
  {
    "event_date_precision": "day",
    "from_facility_id": null,
    "from_coarse_location": null,
    "to_facility_id": null,
    "to_coarse_location": "Chengdu Research Base of Giant Panda Breeding",
    "changes_current_residency": false,
    "event_date": "2017-04-24",
    "event_status": "completed",
    "event_type": "birth",
    "id": "evt_zhi_shi_birth_20170424",
    "participants": [
      "907e93e2-d664-500f-b1b5-af06fd039172"
    ],
    "source_ids": [
      "src_chengdu_newborns_2017_en",
      "src_chengdu_newborns_2017_zh"
    ]
  }
];

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
      "data_version": "2026.07.31.1",
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
      "data_version": "2026.07.31.1",
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

export const TRUSTED_PUBLIC_SOURCES: PublicSourceSummary[] = [
  {
    "access_state": "accessible",
    "id": "src_ccrcgp_2025_birthday_season",
    "language": "zh-Hans",
    "last_verified_at": "2026-05-10",
    "published_at": "2025-07-18",
    "publisher": "China.org.cn / Xinhua",
    "title": "前方高萌 卧龙神树坪基地举办大熊猫集体生日会",
    "url": "https://www.china.org.cn/2025-07/18/content_117984485_4.shtml"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "primary_fact",
    "id": "src_chengdu_newborns_2017_en",
    "language": "en",
    "last_verified_at": "2026-07-24",
    "published_at": null,
    "publisher": "Chengdu Research Base of Giant Panda Breeding",
    "title": "Debut of 2017 Newborn Pandas",
    "url": "https://www.panda.org.cn/en/culture/activities/2023-08-24/8080.html"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "primary_fact",
    "id": "src_chengdu_newborns_2017_zh",
    "language": "zh-Hans",
    "last_verified_at": "2026-07-24",
    "published_at": null,
    "publisher": "Chengdu Research Base of Giant Panda Breeding",
    "title": "2017新生大熊猫宝宝齐亮相",
    "url": "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "primary_fact",
    "id": "src_chengdu_newborns_2021_en",
    "language": "en",
    "last_verified_at": "2026-07-24",
    "published_at": null,
    "publisher": "Chengdu Research Base of Giant Panda Breeding",
    "title": "2021 Newborn Giant Panda Profiles",
    "url": "https://www.panda.org.cn/en/culture/activities/2023-09-19/8165.html"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "primary_fact",
    "id": "src_chengdu_newborns_2021_zh",
    "language": "zh-Hans",
    "last_verified_at": "2026-07-24",
    "published_at": null,
    "publisher": "Chengdu Research Base of Giant Panda Breeding",
    "title": "2021年新生大熊猫幼仔档案",
    "url": "https://www.panda.org.cn/cn/culture/activities/2023-07-07/6594.html"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "primary_fact",
    "id": "src_chengdu_zhen_xi_visit_2024",
    "language": "zh-Hans",
    "last_verified_at": "2026-07-24",
    "published_at": "2024-04-02",
    "publisher": "Chengdu Research Base of Giant Panda Breeding",
    "title": "跨洋粉丝团来访，大熊猫再次“圈粉”！",
    "url": "https://www.panda.org.cn/cn/news/news/2024-04-02/8339.html"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "media_rights_record",
    "id": "src_commons_bao_li_photo",
    "language": "en",
    "last_verified_at": "2026-07-23",
    "published_at": null,
    "publisher": "Wikimedia Commons",
    "title": "Bao Li",
    "url": "https://commons.wikimedia.org/wiki/File:Bao_Li.jpg"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "media_rights_record",
    "id": "src_commons_lei_lei_xiao_xiao_photo",
    "language": "en",
    "last_verified_at": "2026-07-20",
    "published_at": "2022-06-10",
    "publisher": "Wikimedia Commons",
    "title": "Ailuropoda melanoleuca Lei Lei Xiao Xiao 220610h",
    "url": "https://commons.wikimedia.org/wiki/File:Ailuropoda_melanoleuca_Lei_Lei_Xiao_Xiao_220610h.jpg"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "media_rights_record",
    "id": "src_commons_lun_lun_photo",
    "language": "en",
    "last_verified_at": "2026-07-20",
    "published_at": "2022-02-08",
    "publisher": "Wikimedia Commons",
    "title": "Lun Lun at Zoo Atlanta",
    "url": "https://commons.wikimedia.org/wiki/File:Lun_Lun_at_Zoo_Atlanta.jpg"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "media_rights_record",
    "id": "src_commons_qing_bao_photo",
    "language": "en",
    "last_verified_at": "2026-07-23",
    "published_at": null,
    "publisher": "Wikimedia Commons",
    "title": "Probable Qing Bao eating bamboo in snow",
    "url": "https://commons.wikimedia.org/wiki/File:Qing_Bao-5_-_54260941750.jpg"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "media_rights_record",
    "id": "src_commons_ri_ri_photo",
    "language": "en",
    "last_verified_at": "2026-07-20",
    "published_at": "2024-07-03",
    "publisher": "Wikimedia Commons",
    "title": "Ri Ri",
    "url": "https://commons.wikimedia.org/wiki/File:Ri_Ri.jpg"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "media_rights_record",
    "id": "src_commons_shin_shin_photo",
    "language": "en",
    "last_verified_at": "2026-07-20",
    "published_at": "2024-07-03",
    "publisher": "Wikimedia Commons",
    "title": "Shin Shin 03",
    "url": "https://commons.wikimedia.org/wiki/File:Shin_Shin_03.jpg"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "media_rights_record",
    "id": "src_commons_xi_lun_photo",
    "language": "en",
    "last_verified_at": "2026-07-21",
    "published_at": "2022-02-08",
    "publisher": "Wikimedia Commons",
    "title": "Xi Lun at Zoo Atlanta",
    "url": "https://commons.wikimedia.org/wiki/File:Xi_Lun_at_Zoo_Atlanta.jpg"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "media_rights_record",
    "id": "src_commons_xiao_xiao_photo",
    "language": "en",
    "last_verified_at": "2026-07-20",
    "published_at": "2022-05-18",
    "publisher": "Wikimedia Commons",
    "title": "Ailuropoda melanoleuca Xiao Xiao 220518e",
    "url": "https://commons.wikimedia.org/wiki/File:Ailuropoda_melanoleuca_Xiao_Xiao_220518e.jpg"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "media_rights_record",
    "id": "src_commons_ya_lun_photo",
    "language": "en",
    "last_verified_at": "2026-07-20",
    "published_at": "2022-02-08",
    "publisher": "Wikimedia Commons",
    "title": "Ya Lun at Zoo Atlanta",
    "url": "https://commons.wikimedia.org/wiki/File:Ya_Lun_at_Zoo_Atlanta.jpg"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "media_rights_record",
    "id": "src_commons_yang_yang_photo",
    "language": "en",
    "last_verified_at": "2026-07-20",
    "published_at": "2022-02-08",
    "publisher": "Wikimedia Commons",
    "title": "Yang Yang at Zoo Atlanta",
    "url": "https://commons.wikimedia.org/wiki/File:Yang_Yang_at_Zoo_Atlanta.jpg"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "secondary_confirmation",
    "id": "src_gpg_changsha_profiles",
    "language": "en",
    "last_verified_at": "2026-05-10",
    "published_at": null,
    "publisher": "Giant Panda Global",
    "title": "Changsha Ecological Zoo giant pandas",
    "url": "https://www.giantpandaglobal.com/en/zoo/changsha-ecological-zoo"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "secondary_confirmation",
    "id": "src_gpg_chengdu_base_current_page_6",
    "language": "en",
    "last_verified_at": "2026-05-10",
    "published_at": null,
    "publisher": "Giant Panda Global",
    "title": "Chengdu Panda Base current giant pandas page 6",
    "url": "https://www.giantpandaglobal.com/en/zoo/chengdu-research-base-of-giant-panda-breeding/?pagina=6&s=current"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "secondary_confirmation",
    "id": "src_gpg_fuzhou_profiles",
    "language": "en",
    "last_verified_at": "2026-05-10",
    "published_at": null,
    "publisher": "Giant Panda Global",
    "title": "Fuzhou Panda World giant pandas",
    "url": "https://www.giantpandaglobal.com/en/zoo/fuzhou-panda-world"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "secondary_confirmation",
    "id": "src_gpg_guangzhou_profiles",
    "language": "en",
    "last_verified_at": "2026-05-10",
    "published_at": null,
    "publisher": "Giant Panda Global",
    "title": "Guangzhou Zoo giant pandas",
    "url": "https://www.giantpandaglobal.com/en/zoo/guangzhou-zoo"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "secondary_confirmation",
    "id": "src_gpg_meet_world_page_18",
    "language": "en",
    "last_verified_at": "2026-05-10",
    "published_at": null,
    "publisher": "Giant Panda Global",
    "title": "Meet the giant pandas around the world page 18",
    "url": "https://www.giantpandaglobal.com/en/meet-the-giant-pandas-around-the-world/?pagina=18"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "secondary_confirmation",
    "id": "src_gpg_meet_world_page_23",
    "language": "en",
    "last_verified_at": "2026-05-10",
    "published_at": null,
    "publisher": "Giant Panda Global",
    "title": "Meet the giant pandas around the world page 23",
    "url": "https://www.giantpandaglobal.com/en/meet-the-giant-pandas-around-the-world/?pagina=23"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "secondary_confirmation",
    "id": "src_gpg_meet_world_page_24",
    "language": "en",
    "last_verified_at": "2026-05-11",
    "published_at": null,
    "publisher": "Giant Panda Global",
    "title": "Meet the giant pandas around the world page 24",
    "url": "https://www.giantpandaglobal.com/en/meet-the-giant-pandas-around-the-world/?pagina=24"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "secondary_confirmation",
    "id": "src_gpg_meet_world_page_9",
    "language": "en",
    "last_verified_at": "2026-05-10",
    "published_at": null,
    "publisher": "Giant Panda Global",
    "title": "Meet the giant pandas around the world page 9",
    "url": "https://www.giantpandaglobal.com/en/meet-the-giant-pandas-around-the-world/?pagina=9"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "secondary_confirmation",
    "id": "src_gpg_sun_island_profiles",
    "language": "en",
    "last_verified_at": "2026-05-10",
    "published_at": null,
    "publisher": "Giant Panda Global",
    "title": "Sun Island Giant Panda Pavilion giant pandas",
    "url": "https://www.giantpandaglobal.com/en/zoo/sun-island-giant-panda-pavilion"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "secondary_confirmation",
    "id": "src_gpg_yaan_base_previous_page_1",
    "language": "en",
    "last_verified_at": "2026-05-11",
    "published_at": null,
    "publisher": "Giant Panda Global",
    "title": "CCRCGP Ya'an Base previous giant pandas page 1",
    "url": "https://www.giantpandaglobal.com/en/zoo/ccrcgp-yaan-base/?pagina=1&s=previous"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "secondary_confirmation",
    "id": "src_gpg_yaan_base_previous_page_7",
    "language": "en",
    "last_verified_at": "2026-05-10",
    "published_at": null,
    "publisher": "Giant Panda Global",
    "title": "CCRCGP Ya'an Base previous giant pandas page 7",
    "url": "https://www.giantpandaglobal.com/en/zoo/ccrcgp-yaan-base/?pagina=7&s=previous"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "secondary_confirmation",
    "id": "src_gpg_yaan_base_profiles",
    "language": "en",
    "last_verified_at": "2026-05-10",
    "published_at": null,
    "publisher": "Giant Panda Global",
    "title": "CCRCGP Ya'an Base giant pandas",
    "url": "https://www.giantpandaglobal.com/en/zoo/ccrcgp-yaan-base"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "secondary_confirmation",
    "id": "src_gpg_yongba_death",
    "language": "en",
    "last_verified_at": "2026-05-11",
    "published_at": "2011-12-06",
    "publisher": "Giant Panda Global",
    "title": "Yong Ba died",
    "url": "https://www.giantpandaglobal.com/en/news/yong-ba-died"
  },
  {
    "access_state": "accessible",
    "id": "src_smithsonian_agreement_2020",
    "language": "en",
    "last_verified_at": "2026-05-09",
    "published_at": "2020-12-07",
    "publisher": "Smithsonian National Zoo and Conservation Biology Institute",
    "title": "Smithsonian extends giant panda agreement",
    "url": "https://nationalzoo.si.edu/news/smithsonians-national-zoo-and-conservation-biology-institute-extends-giant-panda-agreement"
  },
  {
    "access_state": "accessible",
    "id": "src_smithsonian_giant_panda_faq",
    "language": "en",
    "last_verified_at": "2026-07-23",
    "published_at": null,
    "publisher": "Smithsonian National Zoo and Conservation Biology Institute",
    "title": "Giant Panda FAQs",
    "url": "https://nationalzoo.si.edu/animals/giant-panda-faqs"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "primary_fact",
    "id": "src_smithsonian_giant_panda_page",
    "language": "en",
    "last_verified_at": "2026-07-23",
    "published_at": null,
    "publisher": "Smithsonian National Zoo and Conservation Biology Institute",
    "title": "Giant panda",
    "url": "https://nationalzoo.si.edu/animals/giant-panda"
  },
  {
    "access_state": "accessible",
    "id": "src_smithsonian_history",
    "language": "en",
    "last_verified_at": "2026-07-23",
    "published_at": null,
    "publisher": "Smithsonian National Zoo and Conservation Biology Institute",
    "title": "History of Giant Pandas at the Smithsonian's National Zoo and Conservation Biology Institute",
    "url": "https://nationalzoo.si.edu/animals/history-giant-pandas-zoo"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "primary_fact",
    "id": "src_tokyo_zoo_ueno_panda_history",
    "language": "en",
    "last_verified_at": "2026-05-10",
    "published_at": null,
    "publisher": "Tokyo Zoological Park Society",
    "title": "Past giant pandas kept at Ueno Zoo",
    "url": "https://www.tokyo-zoo.net/ueno/panda/history/index.html"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "primary_fact",
    "id": "src_ueno_return_riri_shinshin",
    "language": "en",
    "last_verified_at": "2026-05-09",
    "published_at": "2024-08-30",
    "publisher": "Tokyo Zoological Park Society",
    "title": "Regarding the return of Giant Panda Ri Ri and Shin Shin",
    "url": "https://www.tokyo-zoo.net/en/topics/news/ueno/355_28750_2024-09-29.html"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "primary_fact",
    "id": "src_ueno_twins_names_2021",
    "language": "en",
    "last_verified_at": "2026-07-20",
    "published_at": "2021-10-08",
    "publisher": "Tokyo Zoological Park Society",
    "title": "The names of Giant Panda twins have been decided as Xiao Xiao and Lei Lei",
    "url": "https://www.tokyo-zoo.net/en/topics/news/ueno/1681_27052_2021-10-08.html"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "primary_fact",
    "id": "src_ueno_xiaolei_return_2026",
    "language": "en",
    "last_verified_at": "2026-05-10",
    "published_at": "2026-01-28",
    "publisher": "Tokyo Zoological Park Society",
    "title": "Giant Panda Xiao Xiao and Lei Lei arrive at the Ya'an Base",
    "url": "https://www.tokyo-zoo.net/en/ueno/news/5238/index.html"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "primary_fact",
    "id": "src_zooatlanta_2016_public_debut",
    "language": "en",
    "last_verified_at": "2026-07-20",
    "published_at": "2016-12-29",
    "publisher": "Zoo Atlanta",
    "title": "Zoo Atlanta closes 2016",
    "url": "https://zooatlanta.org/press-release/zoo-atlanta-closes-2016/"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "primary_fact",
    "id": "src_zooatlanta_arrival_china_2024",
    "language": "en",
    "last_verified_at": "2026-07-20",
    "published_at": "2024-10-13",
    "publisher": "Zoo Atlanta",
    "title": "Giant Pandas Have Arrived in China",
    "url": "https://zooatlanta.org/press-release/giant-pandas-have-arrived-in-china/"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "primary_fact",
    "id": "src_zooatlanta_cubs_birth",
    "language": "en",
    "last_verified_at": "2026-05-09",
    "published_at": "2016-09-03",
    "publisher": "Zoo Atlanta",
    "title": "Lun Lun's Second Cub Has Been Born",
    "url": "https://zooatlanta.org/press-release/lun-luns-second-cub-has-been-born/"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "primary_fact",
    "id": "src_zooatlanta_lun_lun",
    "language": "en",
    "last_verified_at": "2026-05-09",
    "published_at": null,
    "publisher": "Zoo Atlanta",
    "title": "Lun Lun",
    "url": "https://zooatlanta.org/animal-legend/lun-lun/"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "primary_fact",
    "id": "src_zooatlanta_twins_names",
    "language": "en",
    "last_verified_at": "2026-05-09",
    "published_at": "2017-04-03",
    "publisher": "Zoo Atlanta",
    "title": "Meet the Giant Panda Cub Twins",
    "url": "https://zooatlanta.org/meet-giant-panda-cub-twins-zoo-atlanta/"
  },
  {
    "access_state": "accessible",
    "evidence_tier": "primary_fact",
    "id": "src_zooatlanta_yang_yang",
    "language": "en",
    "last_verified_at": "2026-05-09",
    "published_at": null,
    "publisher": "Zoo Atlanta",
    "title": "Yang Yang",
    "url": "https://zooatlanta.org/animal-legend/yang-yang/"
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
