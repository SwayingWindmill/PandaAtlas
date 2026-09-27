const fs = require("fs");
const path = require("path");

const root = process.cwd();
const catalogPath = path.join(root, ".ai-bridge/fan-v08-research-catalog.json");
const detailsPath = path.join(root, ".ai-bridge/fan-v08-research-details.json");

if (!fs.existsSync(catalogPath) || !fs.existsSync(detailsPath)) {
  console.error("FAN_V08_FAMILY_ROLE_AUDIT missing generated Fan V8 research artifacts");
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const details = JSON.parse(fs.readFileSync(detailsPath, "utf8"));
const bySlug = new Map(catalog.pandas.map((panda) => [panda.slug, panda]));
const byId = new Map(catalog.pandas.map((panda) => [panda.id, panda]));
const byChineseName = new Map();
for (const panda of catalog.pandas) {
  const name = String(panda.name_zh ?? "").trim();
  if (!name || !/[\p{Script=Han}]/u.test(name) || name.length > 12) continue;
  if (!byChineseName.has(name)) byChineseName.set(name, panda);
  else if (byChineseName.get(name)?.id !== panda.id) byChineseName.set(name, null);
}
const chineseNamesByInitial = new Map();
for (const [name, panda] of byChineseName) {
  if (!panda) continue;
  const initial = [...name][0];
  const names = chineseNamesByInitial.get(initial) ?? [];
  names.push({ name, panda });
  chineseNamesByInitial.set(initial, names);
}
for (const names of chineseNamesByInitial.values()) names.sort((left, right) => right.name.length - left.name.length);

function escapeRegex(value) {
  return [...value]
    .map((character) => "\\^$.*+?()[]{}|".includes(character) ? `\\${character}` : character)
    .join("");
}

function normalizeMention(value) {
  return String(value ?? "").toLocaleLowerCase().replace(/[\s·・._'’"-]+/g, "");
}

function chineseNameFromLabel(label) {
  if (!String(label ?? "").trim()) return null;
  const text = String(label);
  const candidates = [
    ...text.split(/[\/／]/u).slice(1),
    ...[...text.matchAll(/[（(]([^()（）]+)[）)]/gu)].map((match) => match[1]),
  ];
  for (const candidate of candidates) {
    const clean = candidate.split(/[，,；;]/u)[0].replace(/[（(].*$/u, "").trim();
    if (/^[\p{Script=Han}·]{1,12}$/u.test(clean)) return clean;
  }
  return null;
}

function relationName(relation) {
  if (relation.target_name_zh && /\p{Script=Han}/u.test(relation.target_name_zh)) return relation.target_name_zh;
  const label = (relation.target_label ?? "").trim();
  const labelName = chineseNameFromLabel(label);
  if (labelName) return labelName;
  if (relation.target_name_zh) return relation.target_name_zh;
  if (!label) return relation.target_subject_id ?? "—";
  const parts = label.split("/").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts.at(-1) : label;
}

function targetFor(relation) {
  if (relation.target_slug) return bySlug.get(relation.target_slug) ?? null;
  if (relation.target_subject_id) return byId.get(relation.target_subject_id) ?? null;
  const label = (relation.target_label ?? "").trim();
  if (label && bySlug.has(label)) return bySlug.get(label);
  const normalized = normalizeMention(relationName(relation));
  return catalog.pandas.find((panda) =>
    [panda.name_zh, panda.name_en, panda.label]
      .filter(Boolean)
      .some((value) => normalizeMention(value) === normalized),
  ) ?? null;
}

function isDisplayableRelation(relation) {
  if (relation.target_slug || relation.target_subject_id) return true;
  const label = (relation.target_label ?? "").trim();
  if (!label) return false;
  if (/^\d{4}-\d{2}-\d{2}$/u.test(label)) return false;
  if (/^(?:older|younger)\s+twin$/iu.test(label)) return false;
  if (/^(?:unknown|未知|未确认)$/iu.test(label)) return false;
  if (/(?:Zoo|Wildlife Park|Breeding Center|动物园|野生动物园|基地|保护区|繁育中心)$/iu.test(label)) return false;
  const words = label.split(/\s+/u).filter(Boolean);
  if (label.length > 48 && words.length >= 6) return false;
  if (/\b(?:alternated|nursing|hand-feeding|hand-rearing|maternal care|keeper|often follows|follows older|follows younger)\b/iu.test(label)) return false;
  return true;
}

function explicitGender(panda) {
  if (!panda) return "unknown";
  const values = [details.subjects[panda.id]?.core?.sex, panda.gender];
  return values.find((value) => value === "male" || value === "female") ?? "unknown";
}

const genderHints = new Map();
function addGenderHint(targetId, hint) {
  const current = genderHints.get(targetId);
  if (!current) genderHints.set(targetId, hint);
  else if (current !== hint) genderHints.set(targetId, "conflict");
}

for (const detail of Object.values(details.subjects ?? {})) {
  for (const relation of detail.relations ?? []) {
    const target = targetFor(relation);
    if (!target) continue;
    if (relation.kind === "father" || relation.kind === "mother") {
      addGenderHint(target.id, relation.kind === "father" ? "male" : "female");
      continue;
    }
    const evidence = `${relation.target_name_zh ?? ""} ${relation.target_label ?? ""}`;
    const maleCue = /(?:之子|儿子|哥哥|弟弟|父亲|雄性|雄仔|\bmale\b|\bson\b|\bfather\b)/iu.test(evidence);
    const femaleCue = /(?:之女|女儿|姐姐|妹妹|母亲|雌性|雌仔|\bfemale\b|\bdaughter\b|\bmother\b)/iu.test(evidence);
    if (maleCue !== femaleCue) {
      addGenderHint(target.id, maleCue ? "male" : "female");
      continue;
    }
    const summary = relation.summary_zh ?? "";
    const targetNames = [target.name_zh, target.name_en, relationName(relation)].filter(Boolean);
    for (const targetName of targetNames) {
      const escaped = escapeRegex(targetName);
      if (new RegExp(`${escaped}[^。；，、]{0,12}(?:哥哥|弟弟|之子|儿子|雄性|雄仔)`, "u").test(summary)) addGenderHint(target.id, "male");
      if (new RegExp(`${escaped}[^。；，、]{0,12}(?:姐姐|妹妹|之女|女儿|雌性|雌仔)`, "u").test(summary)) addGenderHint(target.id, "female");
    }
  }
  for (const fact of detail.facts ?? []) {
    const summary = fact.summary_zh?.trim() ?? "";
    if (!summary) continue;
    for (const match of summary.matchAll(/(哥哥|弟弟|儿子|之子|雄性|雄仔|姐姐|妹妹|女儿|之女|雌性|雌仔)[“”"'‘’\s]*/gu)) {
      const afterRole = summary.slice((match.index ?? 0) + match[0].length);
      const initial = [...afterRole][0];
      if (!initial) continue;
      const target = (chineseNamesByInitial.get(initial) ?? []).find(({ name }) => afterRole.startsWith(name))?.panda ?? null;
      if (!target) continue;
      const role = match[1];
      addGenderHint(target.id, /^(?:哥哥|弟弟|儿子|之子|雄性|雄仔)$/u.test(role) ? "male" : "female");
    }
  }
}

function factGender(panda) {
  if (!panda) return "unknown";
  const detail = details.subjects[panda.id];
  const names = [panda.name_zh, panda.name_en].filter(Boolean);
  for (const fact of detail?.facts ?? detail?.highlights ?? []) {
    for (const raw of [fact.summary_zh, fact.summary_en].filter(Boolean)) {
      const text = raw.trim();
      if (/^(?:雄性|雄仔|公大熊猫|male\b)/iu.test(text) || /(?:性别|sex)[:：]?\s*(?:雄性|male)\b/iu.test(text)) return "male";
      if (/^(?:雌性|雌仔|母大熊猫|female\b)/iu.test(text) || /(?:性别|sex)[:：]?\s*(?:雌性|female)\b/iu.test(text)) return "female";
      for (const name of names) {
        const escaped = escapeRegex(name);
        if (new RegExp(`${escaped}[^。；]{0,16}(?:为|是|，)?[^。；]{0,4}(?:雄性|雄仔|male\\b)`, "iu").test(text)) return "male";
        if (new RegExp(`${escaped}[^。；]{0,16}(?:为|是|，)?[^。；]{0,4}(?:雌性|雌仔|female\\b)`, "iu").test(text)) return "female";
        if (new RegExp(`^${escaped}[^。；]{0,32}(?:他|he\\b)`, "iu").test(text)) return "male";
        if (new RegExp(`^${escaped}[^。；]{0,32}(?:她|she\\b)`, "iu").test(text)) return "female";
        if (new RegExp(`${escaped}[^。；]{0,40}(?:产下|生下|分娩|产仔|诞下)`, "u").test(text)) return "female";
        if (new RegExp(`${escaped}[^。；]{0,24}(?:母女|姐妹)`, "u").test(text)) return "female";
        if (new RegExp(`${escaped}[^。；]{0,24}(?:父子|兄弟)`, "u").test(text)) return "male";
      }
    }
  }
  return "unknown";
}

function resolvedGender(panda) {
  const explicit = explicitGender(panda);
  if (explicit !== "unknown") return explicit;
  const inferred = factGender(panda);
  if (inferred !== "unknown") return inferred;
  const hint = panda ? genderHints.get(panda.id) : null;
  return hint === "male" || hint === "female" ? hint : "unknown";
}

function roleFor(subject, relation) {
  const kind = relation.kind;
  const target = targetFor(relation);
  const gender = resolvedGender(target);
  const subjectGender = resolvedGender(subject);
  const targetName = relationName(relation);
  const labelText = relation.target_label ?? "";
  const siblingRoleSignal = /(?:哥哥|弟弟|姐姐|妹妹|老大|老二|大仔|大崽|小仔|小崽|先出生|后出生|年长|年幼|兄姐|弟妹|姐弟|兄妹|兄弟|姐妹)/u;
  const currentSummary = relation.summary_zh?.trim() ?? "";
  const reciprocalCandidates = target && ["sibling", "twin"].includes(kind)
    ? (details.subjects?.[target.id]?.relations ?? []).filter((candidate) =>
        ["sibling", "twin"].includes(candidate.kind)
        && candidate.target_subject_id === subject.id
        && Boolean(candidate.summary_zh?.trim()),
      )
    : [];
  const reciprocalSummary = reciprocalCandidates.find((candidate) =>
    siblingRoleSignal.test(candidate.summary_zh ?? ""),
  )?.summary_zh ?? reciprocalCandidates[0]?.summary_zh ?? null;
  const summaryText = currentSummary && siblingRoleSignal.test(currentSummary)
    ? currentSummary
    : reciprocalSummary ?? currentSummary;
  const targetEvidence = `${targetName} ${labelText}`;
  const targetMaleCue = /(?:之子|儿子|独生子|长子|次子|哥哥|弟弟|父亲|爸爸|父系|雄性|雄仔|\bmale\b|\bson\b|\bfather\b)/iu.test(targetEvidence);
  const targetFemaleCue = /(?:之女|女儿|独生女|长女|次女|姐姐|妹妹|母亲|妈妈|母系|雌性|雌仔|\bfemale\b|\bdaughter\b|\bmother\b)/iu.test(targetEvidence);
  const escapedTargetName = escapeRegex(targetName);
  const escapedSubjectName = escapeRegex(subject.name_zh ?? "");

  if (kind === "sibling" || kind === "twin") {
    if (/(?:双胞胎|同胎)[^。；]{0,8}兄弟/u.test(summaryText)) return "兄弟";
    if (/(?:双胞胎|同胎)[^。；]{0,8}姐妹/u.test(summaryText)) return "姐妹";
    const subjectFirstPair = escapedSubjectName
      ? summaryText.match(new RegExp(`${escapedSubjectName}[^。；]{0,24}${escapedTargetName}[^。；]{0,24}(姐弟|兄妹|兄弟|姐妹)`, "u"))?.[1] ?? null
      : null;
    const targetFirstPair = escapedSubjectName
      ? summaryText.match(new RegExp(`${escapedTargetName}[^。；]{0,24}${escapedSubjectName}[^。；]{0,24}(姐弟|兄妹|兄弟|姐妹)`, "u"))?.[1] ?? null
      : null;
    const pairRole = subjectFirstPair
      ? ({ 姐弟: "弟弟", 兄妹: "妹妹", 兄弟: "兄弟", 姐妹: "姐妹" })[subjectFirstPair]
      : targetFirstPair
        ? ({ 姐弟: "姐姐", 兄妹: "哥哥", 兄弟: "兄弟", 姐妹: "姐妹" })[targetFirstPair]
        : null;
    if (pairRole) return pairRole;
    const labelRole = labelText.match(/(?:双胞胎|同胎)?(?:亲)?(哥哥|弟弟|姐姐|妹妹)/u)?.[1] ?? null;
    const targetRole = summaryText.match(new RegExp(`(?:双胞胎|同胎)?(?:亲)?(哥哥|弟弟|姐姐|妹妹)[^。；，、]{0,12}${escapedTargetName}`, "u"))?.[1]
      ?? summaryText.match(new RegExp(`${escapedTargetName}(?:是|为|列为)(?:双胞胎|同胎)?(?:亲)?(哥哥|弟弟|姐姐|妹妹)`, "u"))?.[1]
      ?? summaryText.match(new RegExp(`${escapedTargetName}(?:是|为|列为)${escapedSubjectName}(?:的)?(?:双胞胎|同胎)?(?:亲)?(哥哥|弟弟|姐姐|妹妹)`, "u"))?.[1]
      ?? null;
    const subjectRole = escapedSubjectName
      ? summaryText.match(new RegExp(`${escapedSubjectName}(?:是|为|列为)(?:${escapedTargetName}(?:的)?)?(?:双胞胎|同胎)?(?:亲)?(哥哥|弟弟|姐姐|妹妹)`, "u"))?.[1]
        ?? summaryText.match(new RegExp(`${escapedSubjectName}[^。；，]{0,12}${escapedTargetName}(?:的)?(?:双胞胎|同胎)?(?:亲)?(哥哥|弟弟|姐姐|妹妹)`, "u"))?.[1]
        ?? summaryText.match(new RegExp(`(?:双胞胎|同胎)?(?:亲)?(哥哥|弟弟|姐姐|妹妹)(?:是|为)?[^。；，、]{0,8}${escapedSubjectName}`, "u"))?.[1]
        ?? null
      : null;
    const targetOrderCue = summaryText.match(new RegExp(`${escapedTargetName}[^。；，、]{0,12}(老大|老二|大仔|大崽|小仔|小崽|先出生(?:个体)?|后出生(?:个体)?|年长|年幼)`, "u"))?.[1]
      ?? summaryText.match(new RegExp(`(老大|老二|大仔|大崽|小仔|小崽|先出生(?:个体)?|后出生(?:个体)?|年长|年幼)[^。；，、]{0,12}${escapedTargetName}`, "u"))?.[1]
      ?? null;
    const subjectOrderCue = escapedSubjectName
      ? summaryText.match(new RegExp(`${escapedSubjectName}[^。；，、]{0,12}(老大|老二|大仔|大崽|小仔|小崽|先出生(?:个体)?|后出生(?:个体)?|年长|年幼)`, "u"))?.[1]
        ?? summaryText.match(new RegExp(`(老大|老二|大仔|大崽|小仔|小崽|先出生(?:个体)?|后出生(?:个体)?|年长|年幼)[^。；，、]{0,12}${escapedSubjectName}`, "u"))?.[1]
        ?? null
      : null;
    const olderOrderCue = /^(?:老大|大仔|大崽|先出生|先出生个体|年长)$/u;
    const youngerOrderCue = /^(?:老二|小仔|小崽|后出生|后出生个体|年幼)$/u;
    const targetOrderFromCue = targetOrderCue
      ? (olderOrderCue.test(targetOrderCue) ? "older" : youngerOrderCue.test(targetOrderCue) ? "younger" : null)
      : subjectOrderCue
        ? (olderOrderCue.test(subjectOrderCue) ? "younger" : youngerOrderCue.test(subjectOrderCue) ? "older" : null)
        : null;
    const subjectGroupOrderCue = escapedSubjectName
      ? summaryText.match(new RegExp(`${escapedSubjectName}[^。；，]{0,20}(兄姐|弟妹)`, "u"))?.[1] ?? null
      : null;
    const targetGroupOrderCue = summaryText.match(new RegExp(`${escapedTargetName}[^。；，]{0,20}(兄姐|弟妹)`, "u"))?.[1] ?? null;
    const targetOrderFromGroup = subjectGroupOrderCue
      ? (subjectGroupOrderCue === "兄姐" ? "older" : "younger")
      : targetGroupOrderCue
        ? (targetGroupOrderCue === "兄姐" ? "younger" : "older")
        : null;
    const inferredTargetGender = gender === "male" || gender === "female"
      ? gender
      : targetMaleCue && !targetFemaleCue
        ? "male"
        : targetFemaleCue && !targetMaleCue
          ? "female"
          : null;
    const targetOrderFromSubjectRole = subjectRole
      ? (["哥哥", "姐姐"].includes(subjectRole) ? "younger" : "older")
      : null;
    const targetOrder = targetOrderFromCue ?? targetOrderFromSubjectRole ?? targetOrderFromGroup;
    const inverse = targetOrder && inferredTargetGender
      ? targetOrder === "older"
        ? (inferredTargetGender === "male" ? "哥哥" : "姐姐")
        : (inferredTargetGender === "male" ? "弟弟" : "妹妹")
      : null;
    const orderOnlyRole = targetOrder === "older" ? "年长同胞" : targetOrder === "younger" ? "年幼同胞" : null;
    if (labelRole ?? targetRole ?? inverse ?? orderOnlyRole) return labelRole ?? targetRole ?? inverse ?? orderOnlyRole;
  }

  if (kind === "foster_mother") return "代养母亲";
  if (kind === "foster_child") return "代养幼崽";

  if (relation.parentage_status === "disputed") {
    if (kind === "father") return "父本争议候选";
    if (kind === "mother") return "母本争议候选";
    if (kind === "parent") return "亲本争议候选";
  }
  if (relation.parentage_status === "tentative") {
    if (kind === "father") return "父本候选";
    if (kind === "mother") return "母本候选";
    if (kind === "parent") return "亲本候选";
  }
  if (kind === "father") return "父亲";
  if (kind === "mother") return "母亲";
  if (kind === "parent") {
    if (targetFemaleCue && !targetMaleCue) return "母亲";
    if (targetMaleCue && !targetFemaleCue) return "父亲";
    if (summaryText && new RegExp(`母亲(?:是|为)?${escapedTargetName}|${escapedTargetName}(?:是|为)?[^。；，]{0,6}母亲`, "u").test(summaryText)) return "母亲";
    if (summaryText && new RegExp(`父亲(?:是|为)?${escapedTargetName}|${escapedTargetName}(?:是|为)?[^。；，]{0,6}父亲`, "u").test(summaryText)) return "父亲";
    if (/仅保留母亲名称|母本名称/u.test(summaryText)) return "母亲";
    if (/仅保留父亲名称|父本名称/u.test(summaryText)) return "父亲";
    if (gender === "male") return "父亲";
    if (gender === "female") return "母亲";
    return "亲本（身份待确认）";
  }
  if (kind === "child") {
    if (targetMaleCue && !targetFemaleCue) return "儿子";
    if (targetFemaleCue && !targetMaleCue) return "女儿";
    const targetPostRole = summaryText.match(new RegExp(`${escapedTargetName}[^。；，、]{0,12}?(儿子|女儿|之子|之女|雄性(?:幼仔|幼崽|双胞胎)?|雌性(?:幼仔|幼崽|双胞胎)?|雄仔|雌仔)`, "u"))?.[1] ?? null;
    if (targetPostRole && /^(?:儿子|之子|雄性|雄仔)/u.test(targetPostRole)) return "儿子";
    if (targetPostRole && /^(?:女儿|之女|雌性|雌仔)/u.test(targetPostRole)) return "女儿";
    const targetMaleSummary = summaryText && new RegExp(`(?:之子|儿子|独生子|长子|次子|雄性(?:幼仔|幼崽|双胞胎)?|雄仔)[^。；，、]{0,10}${escapedTargetName}|${escapedTargetName}[^。；，、]{0,10}(?:之子|儿子|独生子|长子|次子|雄性(?:幼仔|幼崽|双胞胎)?|雄仔)`, "u").test(summaryText);
    const targetFemaleSummary = summaryText && new RegExp(`(?:之女|女儿|独生女|长女|次女|雌性(?:幼仔|幼崽|双胞胎)?|雌仔)[^。；，、]{0,10}${escapedTargetName}|${escapedTargetName}[^。；，、]{0,10}(?:之女|女儿|独生女|长女|次女|雌性(?:幼仔|幼崽|双胞胎)?|雌仔)`, "u").test(summaryText);
    const groupedMaleSummary = summaryText && (
      new RegExp(`(?:育有|共有|包括|：|:|^|女儿[及和与]|[，；。])(?:(?!儿子|女儿)[^。；]){0,80}${escapedTargetName}(?:(?!儿子|女儿)[^。；]){0,80}(?:[一二三四五六七八九十两0-9]+只)?儿子`, "u").test(summaryText)
      || new RegExp(`(?:[一二三四五六七八九十两0-9]+只)?儿子(?:为|有|包括|是|：)(?:(?!儿子|女儿)[^。；]){0,80}${escapedTargetName}`, "u").test(summaryText)
    );
    const groupedFemaleSummary = summaryText && (
      new RegExp(`(?:育有|共有|包括|：|:|^|儿子[及和与]|[，；。])(?:(?!儿子|女儿)[^。；]){0,80}${escapedTargetName}(?:(?!儿子|女儿)[^。；]){0,80}(?:[一二三四五六七八九十两0-9]+只)?女儿`, "u").test(summaryText)
      || new RegExp(`(?:[一二三四五六七八九十两0-9]+只)?女儿(?:为|有|包括|是|：)(?:(?!儿子|女儿)[^。；]){0,80}${escapedTargetName}`, "u").test(summaryText)
    );
    if ((targetMaleSummary || groupedMaleSummary) && !(targetFemaleSummary || groupedFemaleSummary)) return "儿子";
    if ((targetFemaleSummary || groupedFemaleSummary) && !(targetMaleSummary || groupedMaleSummary)) return "女儿";
    if (gender === "male") return "儿子";
    if (gender === "female") return "女儿";
    const childOrderEvidence = `${targetName} ${labelText}`;
    const olderChildCue = /(?:大仔|大崽)/u.test(childOrderEvidence);
    const youngerChildCue = /(?:小仔|小崽)/u.test(childOrderEvidence);
    if (olderChildCue && !youngerChildCue) return "年长孩子";
    if (youngerChildCue && !olderChildCue) return "年幼孩子";
    const summaryMale = /(?:之子|儿子|独生子|长子|次子|雄性|雄仔|母子|父子)/u.test(summaryText);
    const summaryFemale = /(?:之女|女儿|独生女|长女|次女|雌性|雌仔|母女|父女)/u.test(summaryText);
    if (summaryMale && !summaryFemale) return "儿子";
    if (summaryFemale && !summaryMale) return "女儿";
    return "孩子（性别待确认）";
  }
  if (kind === "sibling" || kind === "twin") {
    if (targetMaleCue && !targetFemaleCue) return "兄弟";
    if (targetFemaleCue && !targetMaleCue) return "姐妹";
    if (gender === "male") return "兄弟";
    if (gender === "female") return "姐妹";
    const targetMaleSummary = summaryText && new RegExp(`${escapedTargetName}[^。；，、]{0,8}(?:（雄）|\\(雄\\)|为雄性|是雄性|雄性幼仔|雄性幼崽)`, "u").test(summaryText);
    const targetFemaleSummary = summaryText && new RegExp(`${escapedTargetName}[^。；，、]{0,8}(?:（雌）|\\(雌\\)|为雌性|是雌性|雌性幼仔|雌性幼崽)`, "u").test(summaryText);
    if (targetMaleSummary && !targetFemaleSummary) return "兄弟";
    if (targetFemaleSummary && !targetMaleSummary) return "姐妹";
    if (/(?:双胞胎|同胎)?兄弟|雄性双胞胎/u.test(summaryText)) return "兄弟";
    if (/(?:双胞胎|同胎)?姐妹|雌性双胞胎/u.test(summaryText)) return "姐妹";
    if (/(?:兄妹|姐弟|龙凤胎)/u.test(summaryText)) {
      if (subjectGender === "male") return "姐妹";
      if (subjectGender === "female") return "兄弟";
    }
    return "同胞（性别待确认）";
  }
  return null;
}

const roleCounts = new Map();
const neutralRoleItems = [];
let subjectsWithVisibleFamily = 0;
let visibleFamilyItems = 0;
let filteredNonPersonTargets = 0;

for (const subject of catalog.pandas) {
  const detail = details.subjects[subject.id];
  const seenByGroup = new Map();
  for (const relation of detail?.relations ?? []) {
    if (!["father", "mother", "parent", "child", "sibling", "twin", "foster_mother", "foster_child"].includes(relation.kind)) continue;
    if (!isDisplayableRelation(relation)) {
      filteredNonPersonTargets += 1;
      continue;
    }
    const group = ["father", "mother", "parent"].includes(relation.kind)
      ? "parent"
      : relation.kind === "child"
        ? "child"
        : ["foster_mother", "foster_child"].includes(relation.kind)
          ? "care"
          : "sibling";
    const name = relationName(relation);
    const rawKey = relation.target_slug ?? relation.target_subject_id ?? `${relation.kind}:${name}`;
    const groupSeen = seenByGroup.get(group) ?? new Map();
    if (!groupSeen.has(rawKey)) groupSeen.set(rawKey, relation);
    seenByGroup.set(group, groupSeen);
  }

  const visible = new Map();
  for (const groupSeen of seenByGroup.values()) {
    for (const relation of groupSeen.values()) {
      const role = roleFor(subject, relation);
      const name = relationName(relation).trim();
      if (role?.includes("待确认")) {
        neutralRoleItems.push({
          subjectId: subject.id,
          subjectName: subject.name_zh ?? subject.name_en ?? subject.id,
          targetId: relation.target_subject_id ?? null,
          targetName: name,
          role,
          targetLabel: relation.target_label ?? null,
          summaryZh: relation.summary_zh ?? null,
        });
      }
      const key = `${role}:${name.toLocaleLowerCase()}`;
      if (!visible.has(key)) visible.set(key, { role, name });
    }
  }
  if (!visible.size) continue;
  subjectsWithVisibleFamily += 1;
  for (const item of visible.values()) {
    visibleFamilyItems += 1;
    roleCounts.set(item.role, (roleCounts.get(item.role) ?? 0) + 1);
  }
}

const forbiddenGenericRoles = ["父母", "子女", "后代", "亲本", "兄弟姐妹"];
const forbiddenGenericRoleCount = [...roleCounts.entries()]
  .filter(([role]) => forbiddenGenericRoles.includes(role))
  .reduce((total, [, count]) => total + count, 0);
const neutralRoles = ["亲本（身份待确认）", "孩子（性别待确认）", "同胞（性别待确认）"];
const neutralCount = neutralRoles.reduce((total, role) => total + (roleCounts.get(role) ?? 0), 0);
const multiConfirmedParentSubjects = [];
const fosterBiologicalRoleOverlaps = [];
const duplicateCanonicalRelations = [];
const genericExplicitParentOverlaps = [];
const weakNameCanonicalDuplicates = [];
const specificRoleExpectationFailures = [];
const forbiddenRelationExpectationFailures = [];
let chineseRelationNameFallbacks = 0;
let unresolvedExplicitChineseRelationNames = 0;

function relationNameKeys(relation) {
  const values = [relation.target_label, relation.target_name_zh, relation.target_name_en].filter(Boolean);
  const keys = new Set();
  for (const value of values) {
    for (const part of String(value).split(/[\/／]/u)) {
      const normalized = normalizeMention(part.replace(/[（(].*$/u, "").trim());
      if (normalized) keys.add(normalized);
    }
  }
  return keys;
}
for (const [subjectId, detail] of Object.entries(details.subjects ?? {})) {
  for (const kind of ["father", "mother"]) {
    const targets = new Set(
      (detail.relations ?? [])
        .filter((relation) => relation.kind === kind && !["disputed", "tentative"].includes(relation.parentage_status ?? ""))
        .map((relation) => relation.target_slug ?? relation.target_subject_id ?? relation.target_label)
        .filter(Boolean),
    );
    if (targets.size > 1) multiConfirmedParentSubjects.push({ subjectId, kind, targets: [...targets] });
  }

  const canonicalRelationCounts = new Map();
  const canonicalNameOwners = new Map();
  for (const relation of detail.relations ?? []) {
    const canonicalTarget = relation.target_slug ?? relation.target_subject_id;
    if (!canonicalTarget) continue;
    const duplicateKey = `${relation.kind}:${canonicalTarget}`;
    canonicalRelationCounts.set(duplicateKey, (canonicalRelationCounts.get(duplicateKey) ?? 0) + 1);
    for (const nameKey of relationNameKeys(relation)) {
      const key = `${relation.kind}:${nameKey}`;
      const owners = canonicalNameOwners.get(key) ?? new Set();
      owners.add(canonicalTarget);
      canonicalNameOwners.set(key, owners);
    }
  }
  for (const [key, count] of canonicalRelationCounts.entries()) {
    if (count > 1) duplicateCanonicalRelations.push({ subjectId, key, count });
  }
  for (const relation of detail.relations ?? []) {
    if (relation.target_slug || relation.target_subject_id) continue;
    const owners = new Set();
    for (const nameKey of relationNameKeys(relation)) {
      for (const owner of canonicalNameOwners.get(`${relation.kind}:${nameKey}`) ?? []) owners.add(owner);
    }
    if (owners.size === 1) {
      weakNameCanonicalDuplicates.push({
        subjectId,
        kind: relation.kind,
        targetLabel: relation.target_label ?? null,
        canonicalTarget: [...owners][0],
      });
    }
  }

  const kindsByTarget = new Map();
  for (const relation of detail.relations ?? []) {
    const explicitChinese = chineseNameFromLabel(relation.target_label);
    if (explicitChinese && relation.target_name_zh && !/\p{Script=Han}/u.test(relation.target_name_zh)) {
      chineseRelationNameFallbacks += 1;
      if (!/\p{Script=Han}/u.test(relationName(relation))) unresolvedExplicitChineseRelationNames += 1;
    }
    const targetKey = relation.target_slug ?? relation.target_subject_id ?? relation.target_label;
    if (!targetKey) continue;
    const kinds = kindsByTarget.get(targetKey) ?? new Set();
    kinds.add(relation.kind);
    kindsByTarget.set(targetKey, kinds);
  }
  for (const [target, kinds] of kindsByTarget.entries()) {
    if ((kinds.has("mother") && kinds.has("foster_mother")) || (kinds.has("child") && kinds.has("foster_child"))) {
      fosterBiologicalRoleOverlaps.push({ subjectId, target, kinds: [...kinds] });
    }
    if (kinds.has("parent") && (kinds.has("mother") || kinds.has("father"))) {
      genericExplicitParentOverlaps.push({ subjectId, target, kinds: [...kinds] });
    }
  }
}

const specificRoleExpectations = [
  { subjectId: "ge-ge-tianjin", targetId: "miao-yin-gege-offspring", expectedRole: "女儿" },
  { subjectId: "ge-ge-tianjin", targetId: "hua-li-gege-offspring", expectedRole: "女儿" },
  { subjectId: "ge-ge-tianjin", targetName: "和和", expectedRole: "女儿" },
  { subjectId: "ge-ge-tianjin", targetId: "jiu-jiu-gege-offspring", expectedRole: "女儿" },
  { subjectId: "ge-ge-tianjin", targetId: "jing-bao-gege-offspring", expectedRole: "女儿" },
  { subjectId: "ge-ge-tianjin", targetId: "li-dui-gege-offspring", expectedRole: "儿子" },
  { subjectId: "liang-liang-chongqing-2000", targetId: "lan-xiang-chongqing-2002", expectedRole: "妹妹" },
  { subjectId: "yaya493-younger-twin-2006", targetId: "you-you-chongqing-2006", expectedRole: "年长同胞" },
  { subjectId: "lan-tai-tiantian-cub-2023", targetId: "lan-tian-tiantian-cub-2023", expectedRole: "哥哥" },
  { subjectId: "zhao-yang-juxiao-twin-2010", targetId: "cai-yun-juxiao-twin-2010", expectedRole: "姐姐" },
  { subjectId: "zhi-zhi-junzu-offspring-2020", targetId: "jun-zu-princess-offspring-2003", expectedRole: "母亲" },
  { subjectId: "su-lin", targetId: "su-lin-2019-cub-a", expectedRole: "年长孩子" },
  { subjectId: "xiao-xin-chengdu-2017", targetId: "an-an-2023-cub-a-qinling", expectedRole: "年长孩子" },
  { subjectId: "xiao-xin-chengdu-2017", targetId: "an-an-2023-cub-b-qinling", expectedRole: "年幼孩子" },
  { subjectId: "wu-wen", targetId: "wu-wen-2024-cub-b", expectedRole: "年幼孩子" },
  { subjectId: "he-yue-heqi-twin-2025", targetId: "he-qi-chenggong-offspring-2011", expectedRole: "母亲" },
  { subjectId: "he-xu-heqi-twin-2025", targetId: "he-qi-chenggong-offspring-2011", expectedRole: "母亲" },
  { subjectId: "ji-cheng-jili-twin-2025", targetId: "ji-li-chengji-twin-2007", expectedRole: "母亲" },
  { subjectId: "ji-xian-jili-twin-2025", targetId: "ji-li-chengji-twin-2007", expectedRole: "母亲" },
  { subjectId: "mei-qing-hemei-offspring-2025", targetId: "he-mei-chenggong-offspring-2011", expectedRole: "母亲" },
  { subjectId: "le-le-hk", targetId: "de-de-hk-2024", expectedRole: "儿子" },
  { subjectId: "song-song-chongqing-190", targetId: "zhu-er-chongqing-326", expectedRole: "儿子" },
  { subjectId: "zhen-rui-zhenxi-twin-2025", targetId: "zhen-yu-zhenxi-twin-2025", expectedRole: "兄弟" },
  { subjectId: "xiao-lu-sushan-twin-2021", targetId: "xiao-jiang-sushan-twin-2021", expectedRole: "弟弟" },
  { subjectId: "xiao-jiang-sushan-twin-2021", targetId: "xiao-lu-sushan-twin-2021", expectedRole: "姐姐" },
  { subjectId: "zi-su-sulin-twin-2023", targetId: "zi-lin-sulin-twin-2023", expectedRole: "年幼同胞" },
  { subjectId: "jia-yu-yaan-2023", targetId: "jia-xue-yaan-2023", expectedRole: "姐妹" },
  { subjectId: "jia-xue-yaan-2023", targetId: "jia-yu-yaan-2023", expectedRole: "姐妹" },
  { subjectId: "bai-xue-shanghai-sixue-mother", targetId: "zhuang-mei-baixue-twin-2008", expectedRole: "女儿" },
  { subjectId: "fu-duo-duo-qifu-offspring-2021", targetId: "qi-fu-chengdu-2008", expectedRole: "母亲" },
  { subjectId: "qin-chuan-zhuzhu-offspring-2008", targetName: "珠珠", expectedRole: "母亲", expectedTargetId: "zhu-zhu-qinling" },
  { subjectId: "qian-xin-qianqian-offspring", targetId: "ya-xing-shenshuping", expectedRole: "兄弟" },
];
for (const expectation of specificRoleExpectations) {
  const subject = byId.get(expectation.subjectId) ?? null;
  const detail = details.subjects?.[expectation.subjectId] ?? null;
  const relation = (detail?.relations ?? []).find((candidate) =>
    expectation.targetId
      ? candidate.target_subject_id === expectation.targetId
      : relationName(candidate) === expectation.targetName,
  ) ?? null;
  const actualRole = subject && relation ? roleFor(subject, relation) : null;
  const targetIdMismatch = Object.prototype.hasOwnProperty.call(expectation, "expectedTargetId")
    && (relation?.target_subject_id ?? null) !== expectation.expectedTargetId;
  if (actualRole !== expectation.expectedRole || targetIdMismatch) {
    specificRoleExpectationFailures.push({
      ...expectation,
      actualRole,
      actualTargetId: relation?.target_subject_id ?? null,
    });
  }
}

const forbiddenRelationExpectations = [
  { subjectId: "ya-xing-chengdu-555", targetId: "qian-xin-qianqian-offspring" },
];
for (const expectation of forbiddenRelationExpectations) {
  const detail = details.subjects?.[expectation.subjectId] ?? null;
  const relation = (detail?.relations ?? []).find((candidate) => candidate.target_subject_id === expectation.targetId) ?? null;
  if (relation) {
    forbiddenRelationExpectationFailures.push({
      ...expectation,
      actualKind: relation.kind ?? null,
      actualTargetName: relationName(relation),
    });
  }
}

const summary = {
  catalogSubjects: catalog.pandas.length,
  subjectsWithVisibleFamily,
  visibleFamilyItems,
  filteredNonPersonTargets,
  roleCounts: Object.fromEntries([...roleCounts.entries()].sort((left, right) => right[1] - left[1])),
  neutralCount,
  neutralRoleItems,
  forbiddenGenericRoleCount,
  multiConfirmedParentSubjects,
  fosterBiologicalRoleOverlaps,
  duplicateCanonicalRelations,
  genericExplicitParentOverlaps,
  weakNameCanonicalDuplicates,
  specificRoleExpectationFailures,
  forbiddenRelationExpectationFailures,
  chineseRelationNameFallbacks,
  unresolvedExplicitChineseRelationNames,
};

console.log(
  `FAN_V08_FAMILY_ROLE_AUDIT subjects=${summary.catalogSubjects} family_subjects=${summary.subjectsWithVisibleFamily} visible_items=${summary.visibleFamilyItems} neutral=${summary.neutralCount} forbidden_generic=${summary.forbiddenGenericRoleCount} multi_confirmed_parent_subjects=${summary.multiConfirmedParentSubjects.length} foster_biological_overlap=${summary.fosterBiologicalRoleOverlaps.length} duplicate_canonical=${summary.duplicateCanonicalRelations.length} generic_explicit_parent_overlap=${summary.genericExplicitParentOverlaps.length} weak_name_canonical_duplicate=${summary.weakNameCanonicalDuplicates.length} specific_role_failures=${summary.specificRoleExpectationFailures.length} forbidden_relation_failures=${summary.forbiddenRelationExpectationFailures.length} unresolved_explicit_chinese_names=${summary.unresolvedExplicitChineseRelationNames}`,
);
console.log(JSON.stringify(summary, null, 2));

if (
  forbiddenGenericRoleCount > 0
  || multiConfirmedParentSubjects.length > 0
  || fosterBiologicalRoleOverlaps.length > 0
  || duplicateCanonicalRelations.length > 0
  || genericExplicitParentOverlaps.length > 0
  || weakNameCanonicalDuplicates.length > 0
  || specificRoleExpectationFailures.length > 0
  || forbiddenRelationExpectationFailures.length > 0
  || unresolvedExplicitChineseRelationNames > 0
) process.exitCode = 1;
