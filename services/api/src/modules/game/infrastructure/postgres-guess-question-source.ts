import { sql } from "kysely";
import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { GeneratedQuestion, GuessCandidate } from "../application/guess-question-generation.js";

const CHINESE_TAGS = ["zh-Hans", "zh-CN", "zh"];
const INSERT_CHUNK = 1_000;

interface Name {
  value?: unknown;
  languageTag?: unknown;
  isPrimary?: unknown;
}

interface Fact {
  fieldKey?: unknown;
  value?: unknown;
  status?: unknown;
}

function chineseName(names: unknown): string | null {
  const list = Array.isArray(names) ? (names as Name[]) : [];
  for (const tag of CHINESE_TAGS) {
    const tagged = list.filter((name) => name.languageTag === tag && typeof name.value === "string");
    const chosen = tagged.find((name) => name.isPrimary === true) ?? tagged[0];
    if (chosen) return chosen.value as string;
  }
  return null;
}

function fact(facts: unknown, fieldKey: string): Fact | undefined {
  return (Array.isArray(facts) ? (facts as Fact[]) : []).find((item) => item.fieldKey === fieldKey);
}

/** Year of a confirmed birth date only: tips repeat what the release states as fact. */
function birthYear(facts: unknown): number | null {
  const birth = fact(facts, "birth_date");
  if (birth?.status !== "confirmed" || typeof birth.value !== "string") return null;
  const match = /^(\d{4})/.exec(birth.value);
  return match ? Number(match[1]) : null;
}

/** Reads 猜熊猫 candidates from the active public release and writes generated questions. */
export class PostgresGuessQuestionSource {
  public constructor(private readonly database: DatabaseService) {}

  public async activeRelease(): Promise<{ releaseId: string; version: string } | undefined> {
    const row = await this.database.db
      .selectFrom("publication.current_release as current")
      .innerJoin("publication.releases as release", "release.release_id", "current.release_id")
      .select(["release.release_id", "release.version"])
      .executeTakeFirst();
    return row === undefined ? undefined : { releaseId: row.release_id, version: row.version };
  }

  public async candidates(releaseId: string): Promise<GuessCandidate[]> {
    const { rows } = await sql<{
      panda_id: string;
      names: unknown;
      facts: unknown;
      cover_asset_id: string | null;
      place_id: string | null;
      place_name: string | null;
    }>`
      select panda.panda_id, panda.names, panda.facts,
        (select media.asset_id from public_read.media media
          where media.release_id = panda.release_id and media.panda_id = panda.panda_id and media.usage_role = 'cover'
          order by media.display_order, media.asset_id limit 1) as cover_asset_id,
        home.place_id, home.name_zh as place_name
      from public_read.pandas panda
      left join lateral (
        select residency.place_id, place.name_zh
        from public_read.residencies residency
        join public_read.places place on place.release_id = residency.release_id and place.place_id = residency.place_id
        where residency.release_id = panda.release_id and residency.panda_id = panda.panda_id and residency.end_on is null
        order by (residency.residency_type = 'primary') desc, residency.start_on desc nulls last
        limit 1
      ) home on true
      where panda.release_id = ${releaseId}
    `.execute(this.database.db);
    return rows.map((row) => ({
      pandaId: row.panda_id,
      name: chineseName(row.names),
      living: fact(row.facts, "life_status")?.value === "alive",
      birthYear: birthYear(row.facts),
      placeId: row.place_id,
      placeName: row.place_name,
      coverAssetId: row.cover_asset_id,
    }));
  }

  /** Publishes the questions not already present for the same panda and photo; returns how many were new. */
  public async publish(questions: GeneratedQuestion[]): Promise<number> {
    let inserted = 0;
    const publishedAt = new Date();
    for (let start = 0; start < questions.length; start += INSERT_CHUNK) {
      const rows = await this.database.db
        .insertInto("game.questions")
        .values(
          questions.slice(start, start + INSERT_CHUNK).map((question) => ({
            target_panda_id: question.targetPandaId,
            media_asset_id: question.mediaAssetId,
            difficulty: question.difficulty,
            option_panda_ids: question.optionPandaIds,
            recognition_tips: JSON.stringify(question.tips),
            state: "published",
            published_at: publishedAt,
          })),
        )
        .onConflict((conflict) => conflict.columns(["target_panda_id", "media_asset_id"]).doNothing())
        .returning("question_id")
        .execute();
      inserted += rows.length;
    }
    return inserted;
  }
}
