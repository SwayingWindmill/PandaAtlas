import { ASK_MAX_QUESTION_CHARS } from "./ask-policy.js";

export type AskLocale = "zh" | "en";

export type QuestionCheck =
  | { ok: true; question: string; locale: AskLocale }
  | { ok: false; reason: "empty" | "tooLong" };

// Control and zero-width characters can hide instructions from a reader; they never carry meaning here.
// eslint-disable-next-line no-control-regex
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2060-\u2064\uFEFF]/gu;
const CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/u;

/** Trims, strips invisible characters and checks the length. The text is never stored. */
export function checkQuestion(raw: string): QuestionCheck {
  const question = raw.normalize("NFKC").replace(INVISIBLE, "").replace(/\s+/gu, " ").trim();
  if (question.length === 0) return { ok: false, reason: "empty" };
  if ([...question].length > ASK_MAX_QUESTION_CHARS) return { ok: false, reason: "tooLong" };
  return { ok: true, question, locale: CJK.test(question) ? "zh" : "en" };
}

// Requests to change the assistant's role, reveal its instructions or drop its rules. The model
// prompt also treats passages and the question as data; this check refuses the plain attempts
// before any model is called.
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above|earlier|preceding)\b/iu,
  /disregard\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above|instructions|rules)/iu,
  /forget\s+(?:all\s+|your\s+|the\s+)?(?:previous|prior|instructions|rules)/iu,
  /\b(?:system|developer)\s+(?:prompt|message|instructions?)\b/iu,
  /\byou\s+are\s+now\b/iu,
  /\b(?:act|pretend|roleplay|role-play)\s+(?:as|to\s+be)\b/iu,
  /\bjailbreak\b|\bDAN\b|\bdeveloper\s+mode\b/u,
  /\b(?:reveal|print|show|repeat|output)\s+(?:your|the)\s+(?:prompt|instructions|rules|system)/iu,
  /<\/?(?:system|passages?|question|instructions?)>/iu,
  /忽略(?:之前|以上|上面|前面|先前|所有)/u,
  /无视(?:之前|以上|上面|前面|所有)?(?:的)?(?:指令|规则|要求|提示)/u,
  /(?:系统|开发者)\s*(?:提示词?|指令|消息)/u,
  /提示词|越狱|开发者模式/u,
  /(?:你现在是|假装你是|扮演(?:一个|一名)?|现在你是)/u,
  /(?:输出|打印|重复|显示|告诉我)(?:你的)?(?:提示|指令|规则|设定)/u,
];

export function looksLikePromptInjection(question: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(question));
}

// Asking which panda is in a photo, or who a described panda is. 问问熊猫 never names an
// individual from a look or a photo; it points to the face guides instead.
const IDENTIFICATION_PATTERNS: RegExp[] = [
  /(?:这|那|照片|图片|图里|图中|视频里|画面里)(?:里|中|上)?(?:的)?(?:这|那)?(?:只|头)?(?:熊猫|大熊猫)?(?:是|叫)(?:哪|谁|什么名字)/u,
  /(?:这|那)(?:只|头|个)(?:熊猫|大熊猫|崽|宝)?(?:是|叫)(?:哪|谁|什么)/u,
  /(?:帮我|帮忙|能不能|可以)?(?:认|认出|认一下|辨认|识别|鉴定)(?:一下)?(?:这|那|图|照片|它|他|她)/u,
  // "这只眼斑很宽的熊猫是宝力吗": a described panda checked against a name.
  /(?:这|那)(?:只|头)[^，。？?]{0,12}(?:熊猫|大熊猫|崽)是(?:不是)?[\u4e00-\u9fff]{2,3}(?:吗|么|嘛)/u,
  /\bwhich\s+panda\s+is\s+(?:this|that|in|it)\b/iu,
  /\bwho\s+is\s+(?:this|that|the)\s+panda\b/iu,
  /\b(?:identify|recognise|recognize|name)\s+(?:this|that|the)\s+panda\b/iu,
  /\bwhat(?:'s|\s+is)\s+(?:this|that)\s+panda(?:'s)?\s+name\b/iu,
  /\bis\s+(?:this|that)\s+panda\s+[A-Z][a-z]+/u,
  /\bin\s+(?:this|the|my)\s+(?:photo|picture|image|video)\b/iu,
];

export function isIdentificationQuestion(question: string): boolean {
  return IDENTIFICATION_PATTERNS.some((pattern) => pattern.test(question));
}
