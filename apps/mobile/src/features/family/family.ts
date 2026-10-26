import type { components } from "@zhipanda/api-client";

import { api, publicMediaUrl } from "@/lib/api";
import { displayName, pandaBirthDate, pandaIsDeceased, pandaSex } from "@/lib/panda";

type Schemas = components["schemas"];
type Lineage = Schemas["PublicLineageSummaryDto"];

export interface FamilyMember {
  id: string;
  slug: string;
  name: string;
  sex: "male" | "female" | null;
  birthDate: string | null;
  deceased: boolean;
  photoUrl: string | null;
  /** How this panda is related to the focus panda, e.g. 妈妈 or 双胞胎妹妹. */
  relation: string;
}

/** Pandas born to the same parents on the same day are drawn together. */
export interface SiblingGroup {
  /** Never empty: the eldest leads the group. */
  members: [FamilyMember, ...FamilyMember[]];
  twins: boolean;
}

export interface Family {
  focus: FamilyMember;
  father: FamilyMember | null;
  mother: FamilyMember | null;
  /** Sibling groups in birth order; the focus panda's group includes its twin, when it has one. */
  generation: SiblingGroup[];
  children: FamilyMember[];
}

function birthYear(member: FamilyMember): string {
  return member.birthDate ? `${member.birthDate.slice(0, 4)} 年出生` : "";
}

export function memberMeta(member: FamilyMember): string {
  return [member.relation, birthYear(member), member.deceased ? "已离世" : ""].filter(Boolean).join("　");
}

function siblingRelation(sibling: FamilyMember, focus: FamilyMember, twin: boolean, half: "father" | "mother" | null): string {
  const older = !twin && sibling.birthDate && focus.birthDate ? sibling.birthDate < focus.birthDate : null;
  const base =
    sibling.sex === null || older === null
      ? sibling.sex === "male" ? "兄弟" : sibling.sex === "female" ? "姐妹" : "兄弟姐妹"
      : sibling.sex === "male" ? (older ? "哥哥" : "弟弟") : older ? "姐姐" : "妹妹";
  const prefix = half === "father" ? "同父异母的" : half === "mother" ? "同母异父的" : twin ? "双胞胎" : "";
  return `${prefix}${base}`;
}

export function buildFamily(
  detail: Schemas["PublicPandaDetailDto"],
  lineage: Lineage[],
  covers: Schemas["PublicMediaSummaryDto"][],
): Family {
  const pandas = new Map([detail.panda, ...detail.relatives].map((panda) => [panda.pandaId, panda]));
  const photos = new Map(covers.map((cover) => [cover.pandaId, publicMediaUrl(cover.objectKey)]));
  const member = (id: string, relation: string): FamilyMember | null => {
    const panda = pandas.get(id);
    if (!panda) return null;
    return {
      id,
      slug: panda.canonicalSlug,
      name: displayName(panda),
      sex: pandaSex(panda),
      birthDate: pandaBirthDate(panda),
      deceased: pandaIsDeceased(panda),
      photoUrl: photos.get(id) ?? null,
      relation,
    };
  };

  const focusId = detail.panda.pandaId;
  const focus = member(focusId, "")!;
  const parentOf = (childId: string, role: Lineage["parentRole"]) =>
    lineage.find((item) => item.childId === childId && item.parentRole === role)?.parentId ?? null;
  const fatherId = parentOf(focusId, "father");
  const motherId = parentOf(focusId, "mother");

  const siblingIds = new Set(
    lineage
      .filter((item) => item.childId !== focusId && (item.parentId === fatherId || item.parentId === motherId))
      .map((item) => item.childId),
  );
  const siblings = [...siblingIds].flatMap((id) => {
    const sharesFather = fatherId !== null && parentOf(id, "father") === fatherId;
    const sharesMother = motherId !== null && parentOf(id, "mother") === motherId;
    const half = sharesFather && sharesMother ? null : sharesFather ? "father" : "mother";
    const sibling = member(id, "");
    if (!sibling) return [];
    const twin = half === null && sibling.birthDate !== null && sibling.birthDate === focus.birthDate;
    return [{ ...sibling, relation: siblingRelation(sibling, focus, twin, half) }];
  });

  const byBirth = (a: FamilyMember, b: FamilyMember) => (a.birthDate ?? "9999").localeCompare(b.birthDate ?? "9999");
  const ownGroup: SiblingGroup["members"] = [focus, ...siblings.filter((sibling) => sibling.relation.startsWith("双胞胎"))];
  const others = siblings.filter((sibling) => !ownGroup.includes(sibling)).sort(byBirth);
  // Siblings sharing both parents and a birthday are twins of each other, not of the focus panda.
  const otherGroups: SiblingGroup[] = [];
  for (const sibling of others) {
    const group = otherGroups.find(
      (candidate) => sibling.birthDate !== null && candidate.members[0].birthDate === sibling.birthDate && !sibling.relation.startsWith("同"),
    );
    if (group) {
      group.members.push(sibling);
      group.twins = true;
    } else {
      otherGroups.push({ members: [sibling], twins: false });
    }
  }

  const children = lineage
    .filter((item) => item.parentId === focusId)
    .flatMap((item) => {
      const child = member(item.childId, "");
      return child ? [{ ...child, relation: child.sex === "male" ? "儿子" : child.sex === "female" ? "女儿" : "孩子" }] : [];
    })
    .sort(byBirth);

  return {
    focus,
    father: fatherId ? member(fatherId, "爸爸") : null,
    mother: motherId ? member(motherId, "妈妈") : null,
    generation: [{ members: ownGroup, twins: ownGroup.length > 1 }, ...otherGroups].sort((a, b) =>
      byBirth(a.members[0], b.members[0]),
    ),
    children,
  };
}

async function withCovers(detail: Schemas["PublicPandaDetailDto"], lineage: Lineage[]): Promise<Family> {
  const ids = [detail.panda, ...detail.relatives].map((panda) => panda.pandaId).slice(0, 50);
  // Photos are a nicety: the tree still renders with initials when covers fail.
  const covers = await api.GET("/api/v2/panda-covers", { params: { query: { ids: ids.join(",") } } }).catch(() => null);
  return buildFamily(detail, lineage, covers?.data?.items ?? []);
}

/** The family of a panda whose detail the caller already has. */
export async function familyOf(detail: Schemas["PublicPandaDetailDto"]): Promise<Family> {
  const lineage = await api.GET("/api/v2/lineage");
  if (!lineage.data) throw new Error(`Family of ${detail.panda.canonicalSlug} unavailable`);
  return withCovers(detail, lineage.data.items);
}

export async function loadFamily(slug: string): Promise<Family> {
  const [detail, lineage] = await Promise.all([
    api.GET("/api/v2/pandas/{slug}", { params: { path: { slug } } }),
    api.GET("/api/v2/lineage"),
  ]);
  if (!detail.data || !lineage.data) throw new Error(`Family of ${slug} unavailable`);
  return withCovers(detail.data, lineage.data.items);
}

/** Everyone in the family except the focus panda: parents, siblings in birth order, children. */
export function relativesOf(family: Family): FamilyMember[] {
  return [
    family.father,
    family.mother,
    ...family.generation.flatMap((group) => group.members).filter((member) => member.id !== family.focus.id),
    ...family.children,
  ].filter((member): member is FamilyMember => member !== null);
}
