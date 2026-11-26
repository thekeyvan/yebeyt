/** The tone presets of «متن دعوت». The body ends with a colon: the opener couplet follows it (Me/Invite/InviteText.swift). */
export const inviteTones = [
  { id: "friendly", title: "رفیقانه", body: "یه اپ پیدا کردم که شعر فارسی رو بازی می‌کنه! هر روز یه بیت، جورچین، مشاعره با رفیقا. بیا با هم مشاعره کنیم، من شروع می‌کنم:" },
  { id: "poetic", title: "شاعرانه", body: "شعر فارسی رو با یه بیت دوباره پیدا کردم؛ هر روز یه بیت، یه بازی. بیا با هم مشاعره کنیم، من شروع می‌کنم:" },
  { id: "short", title: "کوتاه", body: "بیا با هم مشاعره کنیم:" },
] as const;

export type InviteTone = (typeof inviteTones)[number]["id"];

/** The couplet that starts the مشاعره: it ends in «ا», so the friend answers with a couplet starting with «ا». */
export const inviteOpener = "الا یا ایها الساقی ادر کأسا و ناولها";

/** The body, the opener in guillemets, and the personal link, each on its own line. */
export const inviteMessage = (body: string, link: string): string => `${body}\n«${inviteOpener}»\n${link}`;

/** The personal link: shown without the scheme, opened with it (Account/UsernameStep.swift `InviteLink`). */
export const inviteLink = {
  display: (username: string): string => `yebeyt.com/i/${username}`,
  url: (username: string): string => `https://yebeyt.com/i/${username}`,
};

/** What a share row sends: the text with the link as its last line (for the messengers and «بیشتر») and the link alone (for «کپی لینک»). */
export type SharePayload = { text: string; url: string };

/** Everything but letters, digits and `-._~` is escaped, so `&`, `=`, `?`, `#`, `+` and new lines stay in the text. */
const escape = (text: string): string => encodeURIComponent(text).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

/** The messengers of the share row; each opens its compose screen with the text. */
export const channels = [
  { id: "sms", title: "پیامک" },
  { id: "telegram", title: "تلگرام" },
  { id: "whatsapp", title: "واتس‌اپ" },
] as const;

export type Channel = (typeof channels)[number];

/** The address that opens the messenger's compose screen with the text: Telegram's share page takes the link and the text before it, WhatsApp's and the messages app's the whole text. */
export function shareUrl({ id }: Channel, { text, url }: SharePayload): string {
  switch (id) {
    case "sms":
      return `sms:?&body=${escape(text)}`;
    case "telegram":
      return `https://t.me/share/url?url=${escape(url)}&text=${escape(text.split("\n").slice(0, -1).join("\n"))}`;
    case "whatsapp":
      return `https://wa.me/?text=${escape(text)}`;
  }
}
