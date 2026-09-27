export interface PandaPublicCopyRecord {
  category?: string | null;
  predicate?: string | null;
  text: string;
}

const evidenceOnlyPredicate = /^(?:photographed_on|observed_at_location_in_media|depicted_in_collected_media|media_candidate(?:_.*)?)$/i;
const evidenceOnlyCategory = /^(?:media_candidate|media_discovery)$/i;
const evidenceOnlyText = /(?:Commons 文件元数据|文件元数据|该媒体页明确|本地媒体库收录|媒体资料，并保留拍摄说明|专题确认出生日期|Wikimedia Commons metadata|file metadata|media page explicitly)/i;
const internalNoise = /(?:事实层|媒体发现层|复用媒体|不另造|繁殖轴|可查询繁殖范围|分散在不同旧批次|\bsubject\b|\bslug\b|\bsource[_ -]?id\b|\brecord[_ -]?id\b|documented_|depicted_in_collected_media|media_candidate)/i;

const sourceAttributionPrefixZh = /^(?:据)?(?:新华社|央视(?:新闻)?|中新社|人民日报|园方|馆方|官方|熊猫中心)(?:报道|消息称|资料显示|通报|表示|记录显示)[，,:：\s]*/u;
const sourceAttributionPrefixEn = /^(?:According to|Reported by)\s+[^,]{1,48},\s*/i;
const editorialSuffix = /[；;](?:该时间|该日期|该记录|该信息|该条|本条|这里|仅作为|作为来源|明确这是|不修改|不把|不外推|不另造|不补|不猜|保存为|后对应既有|独立确认)[^。！？!?]*[。！？!?]?$/u;

function humanizeChineseDates(value: string): string {
  return value.replace(/(\d{4})-(\d{2})-(\d{2})/g, (_match, year: string, month: string, day: string) => {
    return `${year}年${Number(month)}月${Number(day)}日`;
  });
}

function humanizeChineseSourceLanguage(value: string): string {
  return value
    .replace(/^(\d{4}年)直接观察记录/u, "$1，")
    .replace(/^报道(?:记录|确认|称|显示)[，,:：\s]*/u, "")
    .replace(/^资料(?:记录|显示|称)[，,:：\s]*/u, "")
    .replace(/^饲养员记录/u, "")
    .replace(/^国家林草局后续保护知识资料明确称/u, "")
    .replace(/^博物馆称/u, "")
    .replace(/^ZSL官方年表将(.+?)描述为/u, "$1是")
    .replace(/^ZSL档案(?:称|记录)[，,:：\s]*/u, "")
    .replace(/^ZSL建筑档案记录[，,:：\s]*/u, "")
    .replace(/^近况专题将(.+?)描述为/u, "$1")
    .replace(/^(?:\d{4}年)?近况资料将(.+?)列为(.+?)个体[。.]?$/u, "$1目前生活在$2。")
    .replace(/野生状态误入/u, "从野外误入")
    .replace(/被救下后送卧龙检查治疗，与人类相处23天/u, "被救下后送到卧龙接受检查和治疗，在那里待了23天")
    .replace(/^(.+?)(\d{4}年\d{1,2}月\d{1,2}日)在(.+?)放归，是中国早期野生救护个体规范放归与卫星跟踪的重要案例。$/u, "$1于$2在$3被放归。这次放归也成为中国较早开展野生救护个体规范放归和卫星跟踪的案例。")
    .replace(/(\d{4})报道判断/u, "$1年的记录显示")
    .replace(/来源称其/u, "记录中，它")
    .replace(/被专题描述为/u, "被认为是")
    .replace(/被描述为/u, "被形容为")
    .replace(/^2012级幼崽园润因体质较弱需要单独照料，后由思缘照顾/u, "2012年，体质较弱的幼崽园润需要单独照料，后来由思缘代养")
    .replace(/^(.+?)于(\d{4}年\d{1,2}月\d{1,2}日)\d{1,2}时\d{1,2}分产下\d+(?:\.\d+)?克(雄性|雌性)幼仔(.+?)[。.]?$/u, "$1于$2产下$3幼仔$4。")
    .replace(/^(\d{4}年)产下\d+(?:\.\d+)?克和\d+(?:\.\d+)?克(雄性|雌性)双胞胎(.+?)[。.]?$/u, "$1，产下$2双胞胎$3。")
    .replace(/^首次生产后母子健康[。.]?$/u, "思缘第一次生产后，母子健康。")
    .replace(/^与母亲(.+?)在(.+?)进行第二阶段野培，未来是否放归仍需后续评估[。.]?$/u, "它与母亲$1正在$2进行第二阶段野化训练，是否放归还要根据后续评估决定。")
    .replace(/^熊猫中心官方周记记录田田陪伴兰田在山野间嬉戏，说明母幼组合当时仍在持续野培监测[。.]?$/u, "2026年2月，兰田仍和母亲田田一起接受野化培训监测，母子会在山野间活动。")
    .replace(/^兰田2026仍处于熊猫中心野化培训周记的持续监测范围，与田田在林间嬉戏活动[。.]?$/u, "2026年，兰田仍和母亲田田一起接受野化培训，并在林间活动。")
    .replace(/；其在竹林中保持一定警觉但状态从容，补持续监测行为/u, "。被找到时，它在竹林里保持着警觉，状态从容")
    .replace(/^2018年12月27日，(.+?正式放归野外)；国家林草局后续研究回顾独立确认该放归节点[。.]?$/u, "2018年12月27日，$1。")
    .replace(/；项目不采集公开精确坐标[。.]?$/u, "。")
    .replace(/，但不据此生成精确生日[。.]?$/u, "。")
    .replace(/^将卧龙2019年以来持续追踪的同一只白色大熊猫建立为未命名野外独立Subject；[‘'“"]白色大熊猫[’'”"]仅为官方描述，不伪造成正式姓名[。.]?$/u, "这是卧龙自2019年以来持续追踪的同一只未命名野生大熊猫。“白色大熊猫”是公开描述，并不是正式名字。")
    .replace(/^卧龙为该白色个体设立保护研究项目，在发现地约15平方公里区域网格化布设红外相机，持续跟踪行为、活动轨迹、成长与周边种群[。.]?$/u, "为了长期了解它的生活状态，卧龙在约15平方公里范围内布设红外相机，持续观察它的行为、活动轨迹和成长变化。")
    .replace(/^与2019幼体相比，2026影像中的白色大熊猫已为壮年，体态健硕、行动自如，野外适应和生存状态良好[。.]?$/u, "到了2026年，影像里的白色大熊猫已经长成壮年，体态健硕、行动自如，野外生活状态良好。")
    .replace(/^(.+?)当时被认为是首只在圈养环境中活到这一年龄的大熊猫[。.]?$/u, "$1当时被认为是第一只在圈养环境中活到这一年龄的大熊猫。")
    .replace(/^(.+?)是英国的全国性明星动物[。.]?$/u, "$1后来成为英国的明星动物。")
    .replace(/^(.+?)是该园首只通过电视推广的动物明星[。.]?$/u, "$1也是伦敦动物园第一只通过电视走进大众视野的明星动物。")
    .replace(/^(.+?)成为伦敦动物园明星和英格兰最受喜爱的动物之一[。.]?$/u, "$1成为伦敦动物园的明星，也是当时英格兰最受喜爱的动物之一。")
    .replace(/^(.+?)成为世界自然基金会熊猫标志的灵感来源[。.]?$/u, "$1后来成为世界自然基金会熊猫标志的灵感来源。")
    .replace(/后来后来/u, "后来")
    .replace(/^(.+?)于(\d{4}年\d{1,2}月\d{1,2}日)出生在([^，,]+)，初生体重(\d+(?:\.\d+)?)克；同期\/后续[^。]+还将其记为当年全球出生最晚且体重最轻的幼崽[。.]?$/u, "$1于$2出生在$3，初生体重$4克，也是当年全球出生最晚、体重最轻的熊猫幼崽。")
    .replace(/^[^。；]{0,24}后对应既有Subject[^。！？!?]*[。！？!?]?$/u, "");
}

export function cleanPandaPublicText(value: string): string {
  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/^补[^：:]{0,28}[：:]\s*/, "")
    .replace(sourceAttributionPrefixZh, "")
    .replace(sourceAttributionPrefixEn, "")
    .replace(/^截至(\d{4}-\d{2}-\d{2})官方[^，,]{0,16}通报[，,]\s*/u, "$1，")
    .replace(editorialSuffix, "")
    .replace(/[；;](?:明确这是|不修改|不把|不外推|不另造|不补|不猜|本条不|这里只|该条不|仅作为|保存为|后对应既有|独立确认)[^。！？!?]*[。！？!?]?$/u, "")
    .trim();

  return humanizeChineseSourceLanguage(humanizeChineseDates(cleaned)).trim();
}

export function isPandaNarrativeRecord(record: PandaPublicCopyRecord): boolean {
  const category = record.category ?? "";
  const predicate = record.predicate ?? "";
  const text = cleanPandaPublicText(record.text ?? "");
  if (!text.trim()) return false;
  if (evidenceOnlyCategory.test(category)) return false;
  if (evidenceOnlyPredicate.test(predicate)) return false;
  if (evidenceOnlyText.test(text)) return false;
  if (internalNoise.test(`${predicate} ${text}`)) return false;
  return true;
}

export function toPandaPublicText(record: PandaPublicCopyRecord): string | null {
  if (!isPandaNarrativeRecord(record)) return null;
  const text = cleanPandaPublicText(record.text);
  return text && !evidenceOnlyText.test(text) && !internalNoise.test(`${record.predicate ?? ""} ${text}`) ? text : null;
}
