import type { PublicLocale } from "@/foundation/content/locales";

// Draft user agreement and privacy policy. Every sentence is limited to what the
// website and app actually do. Bracketed fields are unfilled on purpose.

export const LEGAL_PLACEHOLDERS = {
  zh: {
    operator: "[运营方名称]",
    email: "[联系邮箱]",
    effectiveDate: "[生效日期]",
  },
  en: {
    operator: "[Operator name]",
    email: "[Contact email]",
    effectiveDate: "[Effective date]",
  },
} as const;

export type LegalKind = "terms" | "privacy";

export interface LegalSection {
  id: string;
  heading: string;
  paragraphs: string[];
  /** Operator decisions that are not yet how the product behaves. */
  pending?: string[];
}

export interface LegalDocument {
  kind: LegalKind;
  path: "/terms" | "/privacy";
  title: string;
  description: string;
  bannerTitle: string;
  bannerBody: string;
  effective: string;
  sections: LegalSection[];
  relatedLabel: string;
  relatedPath: "/terms" | "/privacy";
}

export function legalDocument(locale: PublicLocale, kind: LegalKind): LegalDocument {
  return kind === "terms" ? terms[locale] : privacy[locale];
}

const terms: Record<PublicLocale, LegalDocument> = {
  zh: {
    kind: "terms",
    path: "/terms",
    title: "用户协议",
    description: "吱熊猫用户协议草稿。说明网站和 App 的账号、纠错，以及已发布的熊猫资料。",
    bannerTitle: "这是草稿，尚未生效",
    bannerBody:
      "方括号中的运营方名称、联系邮箱和生效日期尚未填写。注销账号后纠错如何去标识，以及登录记录是否一并删除，仍待运营方确认。确认之前，正文写的是程序今天实际做的事。",
    effective: `生效日期：${LEGAL_PLACEHOLDERS.zh.effectiveDate}`,
    relatedLabel: "隐私政策",
    relatedPath: "/privacy",
    sections: [
      {
        id: "parties",
        heading: "协议双方",
        paragraphs: [
          `这份协议是你与 ${LEGAL_PLACEHOLDERS.zh.operator} 之间，关于吱熊猫（ZhiPanda）的约定。吱熊猫包括网站 www.zhipanda.com 和吱熊猫 App。`,
          `联系邮箱是 ${LEGAL_PLACEHOLDERS.zh.email}。生效日期是 ${LEGAL_PLACEHOLDERS.zh.effectiveDate}。在这些空位填上、并且页面不再标为草稿之前，这份文本还没有生效。`,
        ],
      },
      {
        id: "service",
        heading: "服务",
        paragraphs: [
          "吱熊猫提供已发布的熊猫资料：名字、家人、照片、生活过的地方和资料更新。也可以玩随机熊猫、猜熊猫和每日熊猫。",
          "不登录也可以阅读已发布的页面。登录之后，可以关注熊猫、记下见过、保存图鉴和游戏结果、建立合集、记下去过的地点、提交纠错，以及接收关注熊猫的通知。",
          "在 App 的登录页，登录即表示同意本协议和《隐私政策》。用网站的邮箱验证码登录，创建的是同一个账号，同样适用本协议和隐私政策。",
        ],
      },
      {
        id: "account",
        heading: "账号与登录",
        paragraphs: [
          "登录使用邮箱验证码。验证码发到你填写的邮箱。第一次用这个邮箱登录时会创建账号。验证码由认证服务 Supabase Auth 发送，吱熊猫的资料库不保存验证码本身。",
          "登录之后可以设置显示名。账号上还有一段简介栏位。",
          "导出数据或注销账号之前，需要先在验证器应用中设置一次性码（TOTP），并完成一次最近的验证。这是这两项操作当前的要求。",
          "网站把登录状态放在浏览器的 Cookie 里。App 把登录状态放在设备的安全存储里。App 的网页预览没有这套安全存储，改用浏览器自己的存储。",
        ],
      },
      {
        id: "corrections",
        heading: "纠错",
        paragraphs: [
          "登录后可以指出一只熊猫资料里的错误，写下认为正确的内容，并给出来源的名称和链接或出处。提交后进入审核，不会因此直接改公开资料。",
          "请提交你认为属实、并且你有权提供的内容。不要把私密材料写进来源链接。当前的提交表单不上传文件。",
        ],
      },
      {
        id: "use",
        heading: "使用要求",
        paragraphs: [
          "请使用你自己的邮箱。不要尝试登录别人的账号，也不要干扰网站或 App 的运行。",
          "照片的署名和许可显示在照片旁边。公开页面上的熊猫资料来自已发布的版本，会在发布新版本时更新。",
          "运营方可以把账号标记为停用。停用的账号不能继续使用。",
        ],
      },
      {
        id: "privacy-link",
        heading: "隐私",
        paragraphs: [
          "账号里保存什么、导出和注销时删掉什么、以及什么会留下，写在《隐私政策》里。",
        ],
      },
      {
        id: "changes",
        heading: "文本与联系",
        paragraphs: [
          "本页的文字就是当前文本。没有另外的渠道专门通知协议修改。文本改了，这一页会一起改。",
          `${LEGAL_PLACEHOLDERS.zh.operator}，${LEGAL_PLACEHOLDERS.zh.email}。`,
        ],
      },
    ],
  },
  en: {
    kind: "terms",
    path: "/terms",
    title: "Terms",
    description: "Draft terms for ZhiPanda. They describe accounts, corrections, and the published panda information on the website and app.",
    bannerTitle: "This is a draft and is not in effect",
    bannerBody:
      "The operator name, contact email, and effective date in brackets are not filled in. How corrections are de-identified after account deletion, and whether the sign-in record is deleted too, still need the operator to confirm. Until then, the text below describes what the product does today.",
    effective: `Effective date: ${LEGAL_PLACEHOLDERS.en.effectiveDate}`,
    relatedLabel: "Privacy",
    relatedPath: "/privacy",
    sections: [
      {
        id: "parties",
        heading: "Who this is between",
        paragraphs: [
          `These terms are between you and ${LEGAL_PLACEHOLDERS.en.operator} for ZhiPanda (吱熊猫), the website at www.zhipanda.com and the ZhiPanda app.`,
          `The contact email is ${LEGAL_PLACEHOLDERS.en.email}. The effective date is ${LEGAL_PLACEHOLDERS.en.effectiveDate}. This text is not in effect until those blanks are filled in and the page is no longer marked as a draft.`,
        ],
      },
      {
        id: "service",
        heading: "The service",
        paragraphs: [
          "ZhiPanda publishes panda information: names, families, photographs, places lived, and updates. You can also play Random Panda, Guess Panda, and Daily Panda.",
          "Published pages can be read without an account. With an account you can follow pandas, mark a panda as seen, keep a panda book and game results, make collections, record visits, submit corrections, and receive notices about pandas you follow.",
          "On the app's sign-in screen, signing in means you agree to these terms and the Privacy policy. Signing in on the website with an email code creates the same kind of account and is covered by these terms and the Privacy policy.",
        ],
      },
      {
        id: "account",
        heading: "Account and sign-in",
        paragraphs: [
          "You sign in with a code sent to the email address you enter. The first time that address is used, an account is created. Supabase Auth sends the code. ZhiPanda's database does not keep the code itself.",
          "You can set a display name. The account also has a short introduction field.",
          "Before a data export or account deletion, you set up a one-time code in an authenticator app (TOTP) and complete a recent verification. That step is required for those two actions today.",
          "The website keeps the sign-in session in a browser cookie. The app keeps it in the device's secure storage. A web preview of the app has no secure storage and uses the browser's own storage instead.",
        ],
      },
      {
        id: "corrections",
        heading: "Corrections",
        paragraphs: [
          "Once signed in, you can say what is wrong on a panda, what you believe is right, and the name and link or citation of a source. A submission goes to review. It does not change the published page by itself.",
          "Send only what you believe is accurate and what you have a right to send. Do not put private material in a source link. The submission form does not upload files.",
        ],
      },
      {
        id: "use",
        heading: "How to use it",
        paragraphs: [
          "Use your own email address. Do not try to sign in as someone else, or interfere with the website or the app.",
          "A photograph's credit and license are shown with the photograph. Published panda information comes from a published release and changes when a newer release is published.",
          "The operator can mark an account as suspended. A suspended account cannot be used.",
        ],
      },
      {
        id: "privacy-link",
        heading: "Privacy",
        paragraphs: [
          "What an account stores, what export and deletion remove, and what remains is described in the Privacy policy.",
        ],
      },
      {
        id: "changes",
        heading: "This text, and contact",
        paragraphs: [
          "The words on this page are the current text. There is no separate channel that announces changes. When the text changes, this page changes with it.",
          `${LEGAL_PLACEHOLDERS.en.operator}, ${LEGAL_PLACEHOLDERS.en.email}.`,
        ],
      },
    ],
  },
};

const privacy: Record<PublicLocale, LegalDocument> = {
  zh: {
    kind: "privacy",
    path: "/privacy",
    title: "隐私政策",
    description: "吱熊猫隐私政策草稿。说明账号、关注、见过、图鉴、纠错、通知、导出和注销实际如何处理。",
    bannerTitle: "这是草稿，尚未生效",
    bannerBody:
      "方括号中的运营方名称、联系邮箱和生效日期尚未填写。注销账号后纠错如何去标识，以及登录记录是否一并删除，仍待运营方确认。确认之前，正文写的是程序今天实际做的事。",
    effective: `生效日期：${LEGAL_PLACEHOLDERS.zh.effectiveDate}`,
    relatedLabel: "用户协议",
    relatedPath: "/terms",
    sections: [
      {
        id: "scope",
        heading: "这份政策说明什么",
        paragraphs: [
          `这是吱熊猫网站（www.zhipanda.com）和吱熊猫 App 的隐私政策草稿，由 ${LEGAL_PLACEHOLDERS.zh.operator} 提供。联系邮箱是 ${LEGAL_PLACEHOLDERS.zh.email}。生效日期是 ${LEGAL_PLACEHOLDERS.zh.effectiveDate}。`,
          "网站和 App 没有接入广告，也没有接入单独的分析产品。我们不出售个人信息。",
          "不登录也可以阅读已发布的熊猫资料。下面的账号数据，只在你登录并使用相应功能时产生。",
        ],
      },
      {
        id: "account",
        heading: "账号和登录",
        paragraphs: [
          "邮箱地址。用来接收登录验证码。你打开邮件通知之后，也用来发送通知邮件。",
          "登录会话。Supabase Auth 保存会话。网站把会话放在浏览器 Cookie 里。App 把会话放在设备的安全存储里。网页预览改用浏览器存储。",
          "验证器。只有在你为导出或注销设置一次性码（TOTP）时，认证服务才会保存这个验证器。",
          "显示名，以及账号上的简介栏位。账号状态和创建时间。",
          "登录验证码由 Supabase Auth 发送。资料库不保存验证码本身。",
        ],
      },
      {
        id: "records",
        heading: "你在使用中留下的记录",
        paragraphs: [
          "关注。你关注了哪些熊猫，以及关注的时间。",
          "见过。你标记见过的熊猫，以及那一天。",
          "图鉴和游戏。登录后保存的猜熊猫作答（题目、你的选择、是否答对、时间）、每日熊猫的结果（日期、熊猫、是否猜中、猜了几次），以及因此记入图鉴的熊猫。未登录时，猜熊猫只核对答案，不写入账号。",
          "合集。合集的名称，以及里面的熊猫。",
          "去过的地点。你记下的地点和日期。",
          "纠错。哪只熊猫、你建议的内容、你给出的来源名称和链接或出处，以及审核状态。审核人员可以看见。它不会自动出现在公开页面上。若审核采纳，公开的熊猫资料可能会随之更新。公开页面显示的是已发布的资料和来源，不显示你的账号。",
        ],
      },
      {
        id: "notices",
        heading: "通知",
        paragraphs: [
          "关注熊猫之后，App 内可以收到两类通知：资料更新，以及资料下线或恢复。每一类都可以分别打开或关闭 App 内通知和邮件。",
          "默认打开 App 内通知，默认不发邮件。只有你打开邮件、并且邮件发送已配置时，才会把通知发到账号邮箱。邮件由 Resend 发出。",
          "通知记录包括内容、类别，以及你是否看过、读过。",
        ],
      },
      {
        id: "device",
        heading: "只留在设备上的内容",
        paragraphs: [
          "这些内容留在你的浏览器或手机上，不因为你登录就上传。",
          "网站的浏览器会记住最近打开过的熊猫资料（标识和时间），以及当天每日熊猫的猜测。一次还没保存到账号的游戏结果，会暂存在这次浏览的会话里。",
          "App 会保存最近成功打开过的公开页面，以便没有网络时阅读。包括熊猫列表、地点、家谱、经历、机构和资料更新，以及最近打开的 30 个熊猫或机构页面。这是已经公开的页面，不是你的关注或见过。照片由图片组件缓存在设备上。每日熊猫当天的猜测也写在设备上，以便重新打开时接着玩。",
          "App 里选择的外观（跟随系统、浅色或深色）保存在设备上。",
        ],
      },
      {
        id: "processors",
        heading: "谁在处理这些数据",
        paragraphs: [
          "Cloudflare 托管网站和接口。网站是 www.zhipanda.com，接口是 api.zhipanda.com。",
          "Supabase 提供登录（邮箱验证码、会话、验证器）和存放账号与上述记录的数据库。",
          "Resend 在邮件通知已配置、且你打开了对应邮件开关时发送通知邮件。没有配置时，邮件不会发出。",
        ],
      },
      {
        id: "logs",
        heading: "日志",
        paragraphs: [
          "接口为每次请求分配一个请求编号。请求失败时，日志记下方法、路径（不含查询参数）、状态和错误。工作进程第一次启动时，日志记下它已启动，以及这一次的方法和路径。",
          "这些日志写在 Cloudflare Workers Logs，用来排查故障。它们不是一份你浏览了哪些熊猫的分析记录。普通请求的日志字段里不写邮箱。应用没有另设一份浏览分析。",
        ],
      },
      {
        id: "export-deletion",
        heading: "导出和注销",
        paragraphs: [
          "在 App 的「账号与数据」里，完成验证器验证之后，可以申请导出或注销。",
          "导出是一份 JSON。里面有账号标识、邮箱、账号状态、时间、显示名和简介，关注、合集、去过的地点、见过，猜熊猫作答、图鉴和每日熊猫结果，以及通知偏好和通知内容。导出文件可下载 24 小时，到期后这份副本失效。申请记录会留下。",
          "注销完成时：关注、合集、去过的地点和见过会被删除。猜熊猫作答、图鉴和每日熊猫结果会被删除。通知偏好会被删除。通知正文会被换成一条已清除的标记，类别和时间可能还在，尚未发出的通知邮件不再发送。显示名和简介会被删除。账号上的邮箱会被清空，账号标记为已注销。账号的内部标识，以及一条记下这次注销的状态记录，会留下。你在申请里写的原因，会留在这条申请记录里。",
        ],
        pending: [
          "待运营方确认：注销后，已提交的纠错会保留，但会去标识（匿名化），不再关联到你的账号。在确认并按此处理之前，纠错仍留在审核记录中，并可能仍通过内部账号标识关联到已注销的账号。今天的注销不会改动这些纠错。",
          "待运营方确认：用来登录的认证记录（邮箱、会话，以及已登记的验证器）保存在 Supabase Auth。今天的注销不会删除这条认证记录。是否一并删除，尚未决定。",
        ],
      },
      {
        id: "retention",
        heading: "保存多久",
        paragraphs: [
          "账号里的关注、见过、合集、地点和游戏结果，会保留到你自己删掉，或者注销完成。导出副本保留不超过 24 小时。",
          "纠错为审核而保留。注销之后如何处理，见上一节里待确认的说明。",
          "设备上的公开页面副本，会在超出最近打开的数量时丢掉较旧的单页。外观设置会留到你改掉或卸掉 App。退出登录会清掉设备上的会话。",
          "故障日志没有在应用里另设保存期限。",
        ],
      },
      {
        id: "choices",
        heading: "你可以做什么",
        paragraphs: [
          "可以退出登录、修改显示名、分别开关两类通知的 App 内和邮件、取消关注、取消见过、删除合集和去过的记录。",
          "可以申请导出，或申请注销。注销的范围和尚未决定的部分，写在上面。",
          "《用户协议》和这份政策可以从网站页脚，以及 App「我的」里打开。",
        ],
      },
      {
        id: "contact",
        heading: "联系",
        paragraphs: [
          `${LEGAL_PLACEHOLDERS.zh.operator}，${LEGAL_PLACEHOLDERS.zh.email}。`,
        ],
      },
    ],
  },
  en: {
    kind: "privacy",
    path: "/privacy",
    title: "Privacy",
    description: "Draft privacy policy for ZhiPanda. It describes accounts, follows, seen marks, the panda book, corrections, notices, export, and deletion as they work today.",
    bannerTitle: "This is a draft and is not in effect",
    bannerBody:
      "The operator name, contact email, and effective date in brackets are not filled in. How corrections are de-identified after account deletion, and whether the sign-in record is deleted too, still need the operator to confirm. Until then, the text below describes what the product does today.",
    effective: `Effective date: ${LEGAL_PLACEHOLDERS.en.effectiveDate}`,
    relatedLabel: "Terms",
    relatedPath: "/terms",
    sections: [
      {
        id: "scope",
        heading: "What this policy covers",
        paragraphs: [
          `This is the draft privacy policy for the ZhiPanda website (www.zhipanda.com) and the ZhiPanda app, provided by ${LEGAL_PLACEHOLDERS.en.operator}. The contact email is ${LEGAL_PLACEHOLDERS.en.email}. The effective date is ${LEGAL_PLACEHOLDERS.en.effectiveDate}.`,
          "The website and the app do not include an advertising network or a separate analytics product. We do not sell personal information.",
          "Published panda pages can be read without an account. The account data below exists only after you sign in and use that feature.",
        ],
      },
      {
        id: "account",
        heading: "Account and sign-in",
        paragraphs: [
          "Email address. It receives the sign-in code and, if you turn email notices on, notification email.",
          "Sign-in session. Supabase Auth stores the session. The website keeps it in a browser cookie. The app keeps it in the device's secure storage. A web preview uses browser storage instead.",
          "Authenticator. Supabase Auth stores an authenticator (TOTP) only if you set one up for export or deletion.",
          "Display name, and the account's introduction field. Account state and the time the account was created.",
          "Supabase Auth sends the sign-in code. The panda database does not keep the code itself.",
        ],
      },
      {
        id: "records",
        heading: "What you save while using ZhiPanda",
        paragraphs: [
          "Follows. Which pandas you follow, and when.",
          "Seen. Which panda you marked as seen, and the day.",
          "Panda book and games. Guess Panda answers saved while signed in (the question, your choice, whether it was right, and when), Daily Panda results (the date, the panda, whether you solved it, and how many guesses), and the pandas those games add to your book. Signed out, Guess Panda only checks the answer and does not write it to an account.",
          "Collections. The collection's name and the pandas in it.",
          "Visits. The place and the day you record.",
          "Corrections. The panda, what you proposed, the source name and link or citation, and the review status. Reviewers can see it. It is not placed on the public page by itself. If a reviewer accepts it, the published panda information may change. The public page shows the published information and its sources, not your account.",
        ],
      },
      {
        id: "notices",
        heading: "Notices",
        paragraphs: [
          "After you follow a panda, the app can show two kinds of notice: information updates, and a page taken down or restored. Each kind can be turned on or off separately for the in-app inbox and for email.",
          "In-app notices are on unless you turn them off. Email is off unless you turn it on. Email is sent to the account address only when you turn it on and email delivery is configured. Resend sends that mail.",
          "A notice record includes its content, its category, and whether you have seen or read it.",
        ],
      },
      {
        id: "device",
        heading: "What stays on your device",
        paragraphs: [
          "This stays in your browser or on your phone. Signing in does not upload it.",
          "The website remembers recently opened panda profiles (an identifier and a time) and the current day's Daily Panda guesses. A game result that has not been saved to an account yet sits in that browsing session.",
          "The app keeps public pages it has opened so they can be read without a connection: panda lists, places, families, life events, institutions, and updates, plus the 30 panda or institution pages opened most recently. Those are published pages, not your follows or seen marks. Photographs are cached on the device by the image component. The day's Daily Panda guesses are also stored on the device so the puzzle can resume.",
          "The appearance you choose in the app (match the system, light, or dark) is stored on the device.",
        ],
      },
      {
        id: "processors",
        heading: "Who processes this",
        paragraphs: [
          "Cloudflare hosts the website and the API. The website is www.zhipanda.com. The API is api.zhipanda.com.",
          "Supabase provides sign-in (email codes, sessions, and authenticators) and the database that stores accounts and the records above.",
          "Resend sends notification email when email delivery is configured and you have turned that email notice on. If it is not configured, the email is not sent.",
        ],
      },
      {
        id: "logs",
        heading: "Logs",
        paragraphs: [
          "The API assigns a request id to each request. When a request fails, the log records the method, the path without the query string, the status, and the error. When a worker process starts, the log records that it started and the method and path of that first request.",
          "Those logs go to Cloudflare Workers Logs so failures can be diagnosed. They are not a browsing history of which pandas you opened. An ordinary request log does not include your email address as one of its fields. The application does not keep a separate analytics record of browsing.",
        ],
      },
      {
        id: "export-deletion",
        heading: "Export and deletion",
        paragraphs: [
          "In the app, under Account and data, you can request an export or deletion after you verify with your authenticator.",
          "The export is a JSON file. It includes the account id, email, account state, times, display name and introduction, follows, collections, visits, seen marks, Guess Panda answers, panda-book entries, Daily Panda results, notification preferences, and notification content. The file can be downloaded for 24 hours. After that, this copy expires. The request record remains.",
          "When deletion finishes: follows, collections, visits, and seen marks are deleted. Guess Panda answers, panda-book entries, and Daily Panda results are deleted. Notification preferences are deleted. Notification text is replaced with an erased marker. The category and time may remain, and notification email that has not been sent is not sent. The display name and introduction are deleted. The email on the panda account is cleared and the account is marked deleted. The internal account id remains, along with a state record of this deletion. A reason you wrote on the request stays on that request record.",
        ],
        pending: [
          "Pending operator confirmation: after deletion, submitted corrections are kept but de-identified (anonymized), so they are no longer linked to your account. Until that is confirmed and in place, corrections stay in the review records and may still be linked to the deleted account's internal identifier. Deletion today does not change those corrections.",
          "Pending operator confirmation: the sign-in record (the email, the session, and an authenticator you enrolled) is stored by Supabase Auth. Deletion today does not delete that sign-in record. Whether it should be deleted as well is not decided.",
        ],
      },
      {
        id: "retention",
        heading: "How long it is kept",
        paragraphs: [
          "Follows, seen marks, collections, visits, and game results stay until you delete them or deletion of the account finishes. An export copy is kept for no more than 24 hours.",
          "Corrections are kept for review. What happens to them after account deletion is the pending note in the previous section.",
          "On the device, older individual public pages are dropped once the recent-page limit is passed. Appearance stays until you change it or remove the app. Signing out clears the session stored on the device.",
          "The application does not set a separate retention period for the failure logs.",
        ],
      },
      {
        id: "choices",
        heading: "What you can do",
        paragraphs: [
          "You can sign out, change your display name, turn each notice kind on or off for the app and for email, unfollow, remove a seen mark, and delete a collection or a visit.",
          "You can request an export or deletion. The scope, and the parts not yet decided, are above.",
          "These Terms and this Privacy policy can be opened from the website footer and from Me in the app.",
        ],
      },
      {
        id: "contact",
        heading: "Contact",
        paragraphs: [
          `${LEGAL_PLACEHOLDERS.en.operator}, ${LEGAL_PLACEHOLDERS.en.email}.`,
        ],
      },
    ],
  },
};
