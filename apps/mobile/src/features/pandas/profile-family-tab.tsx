import { Image } from "expo-image";
import { Pressable, View } from "react-native";

import { ListCell, ListSection } from "@/components/grouped-list";
import { Network } from "@/components/icons";
import { SectionHeader } from "@/components/section-header";
import { Text } from "@/components/ui/text";
import type { Family, FamilyMember } from "@/features/family/family";
import { openPanda } from "@/features/pandas/panda-row";
import type { Profile } from "@/features/pandas/profile";
import { nameInitial } from "@/lib/panda";
import { RADIUS } from "@/lib/surface";
import { cn } from "@/lib/utils";

const TREE_PARENT = 52;
const TREE_CHILD = 46;
/** How many of the focus panda's generation the tree draws; the list under it names them all. */
const TREE_CHILDREN = 4;
const LINE = "bg-tertiary-foreground";

export function Face({ member, size, className }: { member: FamilyMember; size: number; className?: string }) {
  return (
    <View
      className={cn("items-center justify-center overflow-hidden bg-secondary", className)}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      {member.photoUrl ? (
        <Image source={member.photoUrl} style={{ width: size, height: size }} contentFit="cover" accessible={false} />
      ) : (
        <Text className="font-bold text-muted-foreground" style={{ fontSize: Math.round(size * 0.4) }}>
          {nameInitial(member.name)}
        </Text>
      )}
    </View>
  );
}

function year(member: FamilyMember) {
  return member.birthDate?.slice(0, 4) ?? "";
}

function TreeNode({ member, size, focus = false }: { member: FamilyMember; size: number; focus?: boolean }) {
  const face = (
    <View className={cn("rounded-pill", focus ? "border-graphic" : "border-transparent")} style={{ borderWidth: 2, padding: 3 }}>
      <Face member={member} size={size} />
    </View>
  );
  const body = (
    <View className="items-center gap-0.5">
      {face}
      <Text variant="subheadline" className="font-semibold" numberOfLines={1}>
        {member.name}
      </Text>
      {year(member) ? (
        <Text variant="footnote" className="tabular-nums text-muted-foreground">
          {year(member)}
        </Text>
      ) : null}
    </View>
  );
  const spoken = `${focus ? "" : `${member.relation}，`}${member.name}${year(member) ? `，${year(member)} 年出生` : ""}`;
  if (focus) {
    return (
      <View accessible accessibilityLabel={spoken}>
        {body}
      </View>
    );
  }
  return (
    <Pressable role="link" accessibilityLabel={spoken} onPress={() => openPanda(member.slug)} className="active:opacity-60">
      {body}
    </Pressable>
  );
}

function treeChildren(family: Family): FamilyMember[] {
  const all = family.generation
    .flatMap((group) => group.members)
    .sort((a, b) => (a.birthDate ?? "").localeCompare(b.birthDate ?? ""));
  const at = Math.max(0, all.findIndex((member) => member.id === family.focus.id));
  const start = Math.max(0, Math.min(at - (TREE_CHILDREN - 1), all.length - TREE_CHILDREN));
  return all.slice(start, start + TREE_CHILDREN);
}

function Tree({ family }: { family: Family }) {
  const parents = [family.father, family.mother].filter((member): member is FamilyMember => member !== null);
  const children = treeChildren(family);
  const n = children.length;
  return (
    <View className="bg-card px-2.5 pt-4 pb-4" style={{ borderRadius: RADIUS.group, borderCurve: "continuous" }}>
      <View className="flex-row justify-center gap-14">
        {parents.map((member) => (
          <TreeNode key={member.id} member={member} size={TREE_PARENT} />
        ))}
      </View>
      <View aria-hidden accessible={false} className="items-center">
        {parents.length === 2 ? (
          <View className="flex-row" style={{ width: 132, height: 12 }}>
            <View className={LINE} style={{ width: 1.5 }} />
            <View className="flex-1 justify-end">
              <View className={LINE} style={{ height: 1.5 }} />
            </View>
            <View className={LINE} style={{ width: 1.5 }} />
          </View>
        ) : null}
        <View className={LINE} style={{ width: 1.5, height: parents.length === 2 ? 8 : 16 }} />
      </View>
      <View aria-hidden accessible={false} style={{ height: 1.5 }}>
        {n > 1 ? (
          <View className={cn("absolute top-0 bottom-0", LINE)} style={{ left: `${50 / n}%`, right: `${50 / n}%` }} />
        ) : null}
      </View>
      <View className="flex-row">
        {children.map((member) => (
          <View key={member.id} className="flex-1 items-center">
            <View aria-hidden accessible={false} className={LINE} style={{ width: 1.5, height: 12 }} />
            <TreeNode member={member} size={TREE_CHILD} focus={member.id === family.focus.id} />
          </View>
        ))}
      </View>
    </View>
  );
}

function siblingsTitle(siblings: FamilyMember[], focus: FamilyMember) {
  const born = focus.birthDate;
  if (born && siblings.every((member) => member.birthDate && member.birthDate < born)) return "兄姐";
  if (born && siblings.every((member) => member.birthDate && member.birthDate > born)) return "弟妹";
  return "兄弟姐妹";
}

function MemberList({ title, members }: { title: string; members: FamilyMember[] }) {
  return (
    <View>
      <SectionHeader title={title} count={String(members.length)} />
      <ListSection>
        {members.map((member, index) => (
          <ListCell
            key={member.id}
            leading={<Face member={member} size={40} />}
            label={member.name}
            meta={year(member)}
            accessibilityLabel={`${member.relation}，${member.name}${year(member) ? `，${year(member)} 年出生` : ""}`}
            onPress={() => openPanda(member.slug)}
            role="link"
            last={index === members.length - 1}
          />
        ))}
      </ListSection>
    </View>
  );
}

export function FamilyTab({ profile }: { profile: Profile }) {
  const family = profile.family;
  const tree = { pathname: "/pandas/[slug]/family" as const, params: { slug: profile.slug } };
  if (!family) {
    return (
      <ListSection>
        <ListCell icon={Network} label="家族树" href={tree} last />
      </ListSection>
    );
  }
  const siblings = family.generation
    .flatMap((group) => group.members)
    .filter((member) => member.id !== family.focus.id)
    .sort((a, b) => (a.birthDate ?? "").localeCompare(b.birthDate ?? ""));
  const children = [...family.children].sort((a, b) => (a.birthDate ?? "").localeCompare(b.birthDate ?? ""));
  return (
    <View className="gap-4">
      {family.father || family.mother ? <Tree family={family} /> : null}
      {siblings.length > 0 ? <MemberList title={siblingsTitle(siblings, family.focus)} members={siblings} /> : null}
      {children.length > 0 ? <MemberList title="子女" members={children} /> : null}
      <ListSection>
        <ListCell icon={Network} label="家族树" href={tree} last />
      </ListSection>
    </View>
  );
}
