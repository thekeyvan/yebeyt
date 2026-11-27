"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { feedbackCopy } from "../../lib/feedback/center";
import { feedbackLog } from "../../lib/feedback/log";
import type { FeedbackModel } from "../../lib/feedback/model";
import { privateSelector } from "../../lib/feedback/privacy";
import { screenAt } from "../../lib/feedback/screens";
import { titleOf } from "../../lib/feedback/types";
import { useStore } from "../../lib/library/browser";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { Sheet } from "../ui/Sheet";
import { FormHeader } from "./controls";
import { feedbackCenter, openFeedback } from "./center";
import { FeedbackChoices, choicesLead, choicesTitle } from "./FeedbackChoices";
import { FeedbackForm } from "./FeedbackForm";
import { FeedbackGameForm } from "./FeedbackGameForm";
import { RecordingPill } from "./RecordingPill";

/** The keys that open the sheet from anywhere: «?» (with Shift on most keyboards), not while a field has the keys and not over another dialog. */
function useShortcut() {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.key !== "?" && event.key !== "؟") || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented || event.repeat) return;
      if ((event.target as Element | null)?.closest?.(privateSelector) || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      event.preventDefault();
      openFeedback();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** What the sheet shows for the form of `model`. */
function Form({ model }: { model: FeedbackModel }) {
  return model.type === "game" ? <FeedbackGameForm model={model} /> : <FeedbackForm center={feedbackCenter()} model={model} />;
}

/**
 * The feedback flow over every screen: the sheet of choices and the form of the chosen type, the question before an unsent report is closed, the recording
 * pill, and the shortcut. The settings row opens the same (`openFeedback`). It also keeps the log of screens a bug report may name.
 */
export function FeedbackHost() {
  const center = feedbackCenter();
  const state = useStore(center) ?? center.snapshot();
  const pathname = usePathname();
  useEffect(() => feedbackLog.visit(screenAt(pathname)), [pathname]);
  useShortcut();

  const { moment, isRecording, starting, isConfirmingClose } = state;
  const open = moment !== undefined && !isRecording && !starting;
  // The sheet keeps what it showed while it goes down.
  const shown = useRef<FeedbackModel>(undefined);
  if (open) shown.current = state.model;
  const model = open ? state.model : shown.current;
  const form = useStore(model);
  const canSend = form !== undefined && model !== undefined && model.canSend;

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => !next && center.requestClose()}
        paper={model !== undefined}
        description={model ? undefined : choicesLead}
        header={(Title) =>
          model ? (
            <FormHeader Title={Title} title={model.type === "game" ? "یه بازی پیشنهاد بده" : titleOf(model.type)} canSend={canSend} close={() => center.requestClose()} send={() => void center.send()} />
          ) : (
            <Title className="text-center font-title text-[26px] leading-[1.3]">{choicesTitle}</Title>
          )
        }
      >
        <div className="w-full" data-testid="feedback-sheet">
          {model ? <Form model={model} /> : <FeedbackChoices choose={(type) => center.choose(type)} />}
        </div>
      </Sheet>
      <ConfirmSheet open={isConfirmingClose} onOpenChange={(next) => center.confirm(next)} title={center.closeQuestion} confirm={feedbackCopy.discard} cancel={feedbackCopy.stay} onConfirm={() => center.close()} />
      {isRecording && <RecordingPill stop={() => void center.stopRecording()} />}
    </>
  );
}
