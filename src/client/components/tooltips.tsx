import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { tooltipContent, tooltipSelector } from './tooltip-content';
const shortcuts: Record<string, string> = {
  "Change priority": "P",
  "Change status": "S",
  "Change assignee": "A",
  "Change label": "L",
  "Change project": "⇧ P",
  "Change cycle": "⇧ C",
  "Change estimate": "⇧ E",
  "Create new issue": "C",
  "Search workspace": "/",
  "Filter issues": "F",
  "Display options": "⇧ V",
  "Show display options": "⇧ V",
  Settings: "G S",
  Inbox: "G I",
  "My issues": "G M",
  Projects: "G P",
  Initiatives: "G N",
  "Copy issue URL": "⌘ ⇧ ,",
  "Copy issue ID": "⌘ .",
};
export function Tooltips() {
  const [tip, setTip] = useState<{
    label: string;
    description: boolean;
    variant?: string;
    anchor?: { right: number; top: number; bottom: number };
    left: number;
    top: number;
  } | null>(null);
  const element=useRef<HTMLDivElement>(null);
  const warmUntil=useRef(0);
  useLayoutEffect(()=>{
    if(!tip||!element.current)return;
    const rect=element.current.getBoundingClientRect();
    const width=rect.width;
    const height=rect.height;
    const desiredLeft=tip.anchor?Math.round(tip.anchor.right)-width:tip.left;
    const desiredTop=tip.anchor?(tip.anchor.bottom+8+height<=innerHeight-8?tip.anchor.bottom+8:tip.anchor.top-height-8):tip.top;
    const left=tip.anchor?Math.max(8,Math.min(innerWidth-width-8,desiredLeft)):Math.max(width/2+8,Math.min(innerWidth-width/2-8,desiredLeft));
    const top=Math.max(8,Math.min(innerHeight-height-8,desiredTop));
    if(left!==tip.left||top!==tip.top)setTip({...tip,left,top});
  },[tip]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let target: HTMLElement | null = null;
    const cancel = () => {
      clearTimeout(timer);
      setTip(null);
    };
    const over = (e: PointerEvent) => {
      const candidate = (e.target as Element).closest<HTMLElement>(tooltipSelector);
      const next = candidate?.closest<HTMLElement>('[data-tooltip]') || candidate;
      if (next === target) return;
      target = next;
      cancel();
      if (!target) return;
      timer = setTimeout(() => {
        if (!target?.isConnected) return;
        const content = tooltipContent(target);
        if (!content) return;
        const rect = target.getBoundingClientRect();
        setTip({
          ...content,
          variant: target.dataset.tooltipVariant,
          anchor: target.dataset.tooltipVariant==='group-summary'?{right:rect.right,top:rect.top,bottom:rect.bottom}:undefined,
          left: Math.max(
            110,
            Math.min(innerWidth - 110, rect.left + rect.width / 2),
          ),
          top: rect.bottom + 32 > innerHeight ? rect.top - 34 : rect.bottom + 7,
        });
        warmUntil.current=performance.now()+1500;
      }, performance.now()<warmUntil.current?80:550);
    };
    const leave = (event: PointerEvent) => {
      if (!(event.relatedTarget instanceof Node) || !target?.contains(event.relatedTarget)) {
        target = null;
        cancel();
      }
    };
    const reset = () => {
      target = null;
      cancel();
    };
    const refreshSummary = (event: PointerEvent) => {
      if (!(event.target as Element).closest('[data-tooltip-variant="group-summary"]')) return;
      target = null;
      over(event);
    };
    document.addEventListener("pointerout", leave);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerdown", cancel);
    document.addEventListener("pointerup", refreshSummary);
    document.addEventListener("keydown", cancel);
    window.addEventListener("scroll", cancel, true);
    return () => {
      cancel();
      document.removeEventListener("pointerout", leave);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerdown", cancel);
      document.removeEventListener("pointerup", refreshSummary);
      document.removeEventListener("keydown", cancel);
      window.removeEventListener("scroll", cancel, true);
    };
  }, []);
  return tip
    ? createPortal(
        <div
          ref={element}
          className={'workspace-tooltip'+(tip.description?' label-description-tooltip':'')}
          role="tooltip"
          data-tooltip-variant={tip.variant}
          style={{ left: tip.left, top: tip.top }}
        >
          {tip.label}
          {!tip.description&&shortcuts[tip.label] && <kbd>{shortcuts[tip.label]}</kbd>}
        </div>,
        document.body,
      )
    : null;
}
