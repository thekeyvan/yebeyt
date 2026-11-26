"use client";

import { useEffect, useState } from "react";
import { UsernameAvailability, type AvailabilityState } from "../../lib/account/usernameAvailability";
import { accountServices } from "../../lib/account/services";
import { inviteDisplay, nameProblem, nameProblemMessage, problemMessage, suggestionBase, usernameHint } from "../../lib/account/usernameRules";
import { useStore } from "../../lib/library/browser";
import { CheckIcon } from "../ui/icons";
import { AppleMark, GoogleMark } from "./Marks";

const field = "h-[52px] w-full rounded-2xl px-4 text-base font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-lapis";

function Chip({ provider }: { provider: "apple" | "google" }) {
  return (
    <span data-testid="provider-chip" className="flex w-fit items-center gap-2 rounded-pill bg-white py-1.5 pe-3.5 ps-2 text-xs font-bold text-ink shadow-[0_2px_4px_rgba(20,17,43,0.08)]">
      <span className={`grid size-6 place-items-center rounded-full ${provider === "apple" ? "bg-[#000] text-white" : "border border-[#DADCE0] bg-white"}`}>{provider === "apple" ? <AppleMark size={14} /> : <GoogleMark size={14} />}</span>
      {provider === "apple" ? "با اپل وارد شدی" : "با گوگل وارد شدی"}
    </span>
  );
}

function Status({ state }: { state: AvailabilityState }) {
  switch (state.kind) {
    case "idle":
      return null;
    case "checking":
      return <span aria-label="در حال بررسی" className="size-4 animate-spin rounded-full border-2 border-ring border-t-lapis motion-reduce:animate-none" />;
    case "available":
      return (
        <span data-testid="username-available" className="flex items-center gap-1 text-xs text-[#3E9A1E]">
          <CheckIcon size={14} lineWidth={3.2} />
          آزاده
        </span>
      );
    case "unavailable":
      return (
        <span data-testid="username-problem" className="text-xs text-fire">
          {problemMessage[state.problem]}
        </span>
      );
    case "failed":
      return <span className="truncate text-xs text-fire">{state.message}</span>;
  }
}

/**
 * OnbUsername: the display name (filled from the provider) and the username, with live availability (Account/UsernameStep.swift). «همینه» saves both. Used by
 * onboarding and by the account sheet when a signed-in person has no username yet (`withHeading` is false there: the sheet has the heading).
 */
export function UsernameStep({ onSaved, withHeading = true }: { onSaved: () => void; withHeading?: boolean }) {
  const { account, session, api } = accountServices();
  const user = session.user;
  const { provider: chosen, providerName } = account.snapshot();
  const [availability] = useState(() => {
    const model = new UsernameAvailability(api.checkUsername, user?.username ?? undefined);
    model.setText(user?.username ?? "");
    return model;
  });
  const { text, state } = useStore(availability)!;
  const nameFromProvider = user?.displayName == null && providerName !== undefined;
  const [name, setName] = useState(user?.displayName ?? providerName ?? "");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const provider = chosen ?? user?.providers[0];
  const problem = nameProblem(name.trim());

  useEffect(() => {
    let current = true;
    api.usernameSuggestions(suggestionBase(name)).then(
      (found) => current && setSuggestions(found),
      () => {},
    );
    return () => {
      current = false;
    };
    // The suggestions are asked for once, from the name the step opens with.
  }, []);

  async function save() {
    setSaving(true);
    setError(undefined);
    const failed = await account.saveProfile(name, availability.normalized);
    setSaving(false);
    if (failed) setError(failed);
    else onSaved();
  }

  // White fields on onboarding's paper; on the white sheet they are paper.
  const surface = withHeading ? "bg-white" : "bg-paper";
  const border = state.kind === "available" ? "border-green" : state.kind === "unavailable" || state.kind === "failed" ? "border-fire" : "border-transparent";
  return (
    <form
      className="flex w-full flex-col gap-4 text-start"
      onSubmit={(event) => {
        event.preventDefault();
        if (availability.isAvailable && !saving && !problem) void save();
      }}
    >
      {provider && <Chip provider={provider} />}
      {withHeading && (
        <div className="flex flex-col gap-1">
          <h1 className="font-title text-[30px] leading-[1.3] text-ink">یه نام کاربری انتخاب کن</h1>
          <p className="text-[13px] leading-[1.9] text-muted">دوستات با این پیدات می‌کنن و توی لینک‌هات میاد.</p>
        </div>
      )}
      {!withHeading && <p className="text-[13px] leading-[1.9] text-muted">دوستات با این پیدات می‌کنن و توی لینک‌هات میاد.</p>}
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold text-ink">
          اسمت
          {nameFromProvider && <span className="font-medium text-[#8A8698]">{` · از حساب ${provider === "google" ? "گوگلت" : "اپلت"}`}</span>}
        </span>
        <input value={name} onChange={(event) => setName(event.target.value)} aria-label="اسمت" data-testid="display-name" autoComplete="name" className={`${field} ${surface}`} />
        {problem && (
          <span data-testid="name-problem" className="text-xs text-fire">
            {nameProblemMessage[problem]}
          </span>
        )}
      </label>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-[13px] font-bold text-ink">
          نام کاربری
        </label>
        <div dir="ltr" className={`flex h-[52px] items-center gap-1 rounded-2xl border-2 px-4 text-[17px] font-bold ${surface} ${border}`}>
          <span className="text-[#8A8698]">@</span>
          <input
            id="username"
            value={text}
            onChange={(event) => availability.setText(event.target.value)}
            data-testid="username"
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-ink outline-none"
          />
          <span dir="rtl" className="shrink-0 font-normal">
            <Status state={state} />
          </span>
        </div>
        <p className="text-[11.5px] leading-[1.8] text-[#8A8698]">{usernameHint}</p>
      </div>
      {suggestions.filter((suggestion) => suggestion !== availability.normalized).length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-muted">یا یکی از این‌ها:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions
              .filter((suggestion) => suggestion !== availability.normalized)
              .map((suggestion) => (
                <button key={suggestion} type="button" dir="ltr" onClick={() => availability.setText(suggestion)} className={`h-11 rounded-pill px-3 text-[13px] font-medium text-ink shadow-[0_1px_3px_rgba(20,17,43,0.1)] ${surface}`}>
                  {suggestion}
                </button>
              ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2.5 rounded-2xl bg-lapis-tint px-3.5 py-2.5">
        <span className="text-xs text-muted">لینک دعوتت:</span>
        <span dir="ltr" className="text-[13px] font-bold text-lapis">
          {inviteDisplay(availability.normalized === "" ? "username" : availability.normalized)}
        </span>
      </div>
      {error && (
        <p role="alert" data-testid="save-error" className="text-center text-xs font-medium text-fire">
          {error}
        </p>
      )}
      <button
        type="submit"
        data-testid="username-done"
        disabled={!availability.isAvailable || saving || problem !== undefined}
        className="min-h-[50px] w-full rounded-[20px] border-4 border-white bg-lapis pt-1 font-title text-[22px] text-white shadow-[0_6px_16px_rgba(20,17,43,0.3)] disabled:opacity-45"
      >
        همینه
      </button>
    </form>
  );
}
