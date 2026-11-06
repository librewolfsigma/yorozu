"use client";

import { ShieldCheck, ShieldAlert, Scale, Users, Ban, Eye } from "lucide-react";

const SECTIONS = [
  {
    icon: Users,
    title: "1. Adults only (18+)",
    color: "#EF5B6B",
    points: [
      "Yozora is exclusively for adults aged 18 or older (or the age of majority in your jurisdiction). The age gate must be passed before any content is shown.",
      "All catalog content must depict clearly adult participants (18+). Underage, ambiguous-age, or borderline depictions are prohibited without exception.",
      "Accounts belonging to minors are removed on discovery.",
    ],
  },
  {
    icon: Ban,
    title: "2. Prohibited content",
    color: "#EF5B6B",
    points: [
      "No content depicting minors, real or fictional, in sexual contexts — regardless of artistic framing.",
      "No non-consensual scenarios presented approvingly; no real-world exploitation material.",
      "No content that violates the law of the operator's or user's jurisdiction.",
      "Provider adapters must never target sources that distribute the above.",
    ],
  },
  {
    icon: Scale,
    title: "3. Licensing & provider respect",
    color: "#3DB4F2",
    points: [
      "We respect provider licensing, terms of service, and technical access controls.",
      "Adapters never bypass authentication, DRM, paywalls, or regional restrictions.",
      "If a provider doesn't authorize streams or downloads, the platform shows an honest availability state instead of circumventing.",
      "Official purchase/download links are preferred over unofficial mirrors.",
    ],
  },
  {
    icon: Eye,
    title: "4. Moderation & reporting",
    color: "#FFBE4A",
    points: [
      "Every title, review and gallery image has a Report action; reports are recorded with reason and details.",
      "Moderators review reports against this policy; open reports are visible in your profile.",
      "Providers that repeatedly return policy-violating content are disabled pending review.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "5. Privacy & wellbeing",
    color: "#3BD47A",
    points: [
      "No analytics or third-party trackers; only your own tracking data is stored in the local database.",
      "Wellbeing tooling is first-class: the tracked userscript directory lists blockers, time-limit and cool-down tools you can audit before adopting.",
      "Content streams, pages and metadata come live from the providers you install; Yozora hosts nothing and keeps no catalog mirror.",
    ],
  },
];

export default function PolicyView() {
  return (
    <div className="pb-10">
      <div className="hero-aurora relative overflow-hidden rounded-2xl border border-border card-ring p-6 sm:p-10">
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EF5B6B]/15 px-3 py-1 text-[11px] font-bold text-[#FF8B96]">
            <ShieldAlert className="h-3.5 w-3.5" /> 18+ PLATFORM POLICY
          </span>
          <h1 className="mt-3 font-display text-4xl text-white">Content Policy & Safety</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-foreground/85">
            Yozora is a universal media platform dedicated exclusively to legal adult content
            involving clearly adult participants and characters. This policy binds the platform,
            its provider adapters, and its community.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {SECTIONS.map((s) => (
          <section key={s.title} className="rounded-xl border border-border bg-card p-5" style={{ ["--hub" as string]: s.color }}>
            <h2 className="flex items-center gap-2.5 text-[16px] font-bold">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg hub-soft" style={{ color: s.color }}>
                <s.icon className="h-4.5 w-4.5" />
              </span>
              {s.title}
            </h2>
            <ul className="mt-3 space-y-2">
              {s.points.map((p, i) => (
                <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-foreground/85">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  {p}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
        This platform is an original implementation. Design inspired by the publicly observable
        aesthetic of myhikari.in; architecture inspired by Mihon (extensions) and AniList (tracking).
        Source research: <a href="https://wotaku.wiki/nsfw" target="_blank" rel="noreferrer" className="underline hover:text-foreground">wotaku.wiki/nsfw</a>.
      </p>
    </div>
  );
}
