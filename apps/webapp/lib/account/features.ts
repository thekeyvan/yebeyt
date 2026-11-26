/** What needs an account: the first use of it shows the account gate (Account/AccountModel.swift `AccountFeature`). Each value fits «برای … یه حساب لازمه». */
export const accountFeatures = {
  likes: "پسند و بازنشر",
  messages: "پیام دادن به دوستات",
  invite: "دعوت دوستات",
  profile: "همگام کردن دیوان و امتیازهات",
  leaderboard: "دیدن رده‌بندی",
  games: "مشاعره با دوستات",
} as const;

export type AccountFeature = keyof typeof accountFeatures;
