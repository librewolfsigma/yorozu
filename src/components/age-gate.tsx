"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, MoonStar, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function AgeGate({ open, onAccept }: { open: boolean; onAccept: () => void }) {
  const [remember, setRemember] = useState(true);
  const [leaving, setLeaving] = useState(false);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#070d16]/95 backdrop-blur-md p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Age verification"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="w-full max-w-md rounded-2xl border border-border bg-card card-ring-lg p-8 text-center"
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl cta-gradient yz-float">
              <MoonStar className="h-8 w-8 text-white" aria-hidden />
            </div>
            <h1 className="font-display text-3xl text-white">Yozora</h1>
            <p className="mt-1 text-sm text-muted-foreground">The universal 18+ media platform</p>

            <div className="mt-6 rounded-xl border border-[#EF5B6B]/30 bg-[#EF5B6B]/10 p-4 text-left">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#EF5B6B]" aria-hidden />
                <div className="text-[13px] leading-relaxed text-foreground/90">
                  <p className="font-semibold text-[#FF8B96]">Adults only (18+)</p>
                  <p className="mt-1 text-foreground/75">
                    This platform catalogs and streams <strong>explicit adult content</strong>. By
                    entering you confirm that you are 18 years of age or older (or the age of majority
                    in your jurisdiction), that viewing adult material is legal where you are, and that
                    you wish to see such content.
                  </p>
                </div>
              </div>
            </div>

            <label className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
              Remember on this device
            </label>

            <div className="mt-5 flex flex-col gap-2">
              <Button size="lg" className="h-12 rounded-xl cta-gradient border-0 text-base font-semibold" onClick={onAccept}>
                I am 18 or older — Enter <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                className="rounded-xl text-muted-foreground"
                onClick={() => setLeaving(true)}
              >
                <ExternalLink className="mr-1 h-4 w-4" /> Take me somewhere else
              </Button>
              {leaving && (
                <p className="text-xs text-muted-foreground">
                  You can close this tab, or visit{" "}
                  <a className="underline" href="https://www.wikipedia.org" target="_blank" rel="noreferrer">
                    wikipedia.org
                  </a>
                  .
                </p>
              )}
            </div>

            <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground/80">
              Yozora aggregates metadata and publicly served content from third-party providers,
              intended for fictional adults. Underage, exploitative or
              non-consensual material is prohibited.{" "}
              <a href="#/policy" className="underline hover:text-foreground">Content policy</a>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
