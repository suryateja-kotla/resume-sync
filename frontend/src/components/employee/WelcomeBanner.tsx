interface Props {
  name: string;
  completePct: number;
  pendingLabel?: string;
  onCtaClick?: () => void;
  ctaLabel?: string;
}

const getGreeting = (hour: number) => {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
};

export default function WelcomeBanner({
  name,
  completePct,
  pendingLabel,
  onCtaClick,
  ctaLabel = "Complete Now",
}: Props) {
  const greeting = getGreeting(new Date().getHours());
  const firstName = (name || "").trim().split(" ")[0] || name || "there";
  const isComplete = completePct >= 100;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-700 via-indigo-700 to-fuchsia-700 px-5 py-4 shadow-lg shadow-indigo-950/20 sm:px-7 sm:py-5">
      {/* Decorative glow, matches navbar treatment */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-8 -top-16 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 right-10 h-40 w-40 rounded-full bg-fuchsia-400/20 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-lg font-bold text-white sm:text-xl">
            <span aria-hidden="true">👋</span>
            {greeting}, {firstName}
          </p>

          <p className="mt-1 text-sm leading-relaxed text-white/80">
            Welcome back! Your profile is{" "}
            <span className="font-semibold text-white">{completePct}%</span> complete.
            {!isComplete && pendingLabel && (
              <>
                {" "}
                Complete your <span className="font-semibold text-white">{pendingLabel}</span> to
                reach 100%.
              </>
            )}
            {isComplete && " Great job keeping everything up to date."}
          </p>
        </div>

        {!isComplete && onCtaClick && (
          <button
            type="button"
            onClick={onCtaClick}
            className="inline-flex flex-shrink-0 items-center gap-2 self-start rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 shadow-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] sm:self-auto"
          >
            {ctaLabel}
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
