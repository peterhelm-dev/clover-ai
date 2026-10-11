import { Badge } from "@/components/ui/badge";
import { GuestSignInButton } from "@/components/GuestSignInButton";
import {
  Mic,
  Camera,
  Leaf,
  Mail,
  MessageSquare,
  HeartHandshake,
  ShieldCheck,
  CalendarOff,
  Stethoscope,
  ArrowRight,
  Check,
} from "lucide-react";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { AnimatedFeatureCard } from "@/components/AnimatedFeatureCard";
import { AnimatedPricingCard } from "@/components/AnimatedPricingCard";

// Self-hosted brand illustrations (client/public/images)
const HERO_IMAGE = "/images/hero.webp";
const VOICE_FEATURE = "/images/feature-voice.webp";
const PHOTO_FEATURE = "/images/feature-photo.webp";
const NUTRIENTS_FEATURE = "/images/feature-nutrients.webp";
const REPORT_FEATURE = "/images/feature-report.webp";
const MOOD_FEATURE = "/images/feature-mood.webp";
const BEFORE_AFTER = "/images/before-after.webp";
const PRACTITIONERS = "/images/practitioners.webp";

// Where practitioner-code requests go. Leave null to hide the contact button.
const PRACTITIONER_CONTACT_EMAIL: string | null = null;

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: Mic,
    title: "Just say what you ate",
    description:
      "\"Oatmeal with walnuts this morning, turkey sandwich for lunch.\" One sentence becomes two logged meals, placed roughly when you ate them. No menus, no clock times.",
    image: VOICE_FEATURE,
    color: "bg-green-50 text-green-700",
  },
  {
    icon: Camera,
    title: "Or snap a photo",
    description:
      "Point your camera at your plate and Clover works out what's on it. Type, talk or snap, whichever is easiest in the moment.",
    image: PHOTO_FEATURE,
    color: "bg-amber-50 text-amber-700",
  },
  {
    icon: Leaf,
    title: "15 vitamins & minerals, estimated",
    description:
      "Beyond macros, every meal gets an estimate for iron, magnesium, B12, vitamin D and more, shown against typical ranges. Clearly labeled as estimates, never as pass or fail.",
    image: NUTRIENTS_FEATURE,
    color: "bg-emerald-50 text-emerald-700",
  },
  {
    icon: Mail,
    title: "A kind weekly summary",
    description:
      "Once a week, a one-page summary written like a supportive friend, not a lab report. Days you didn't log are simply left out. Bring it to your next appointment.",
    image: REPORT_FEATURE,
    color: "bg-orange-50 text-orange-700",
  },
];

const PRINCIPLES = [
  {
    icon: CalendarOff,
    title: "No streaks, no guilt",
    body: "Missed a day? It's simply absent from the picture: no broken streaks, no red bars, no zeros.",
  },
  {
    icon: HeartHandshake,
    title: "Inform, never shame",
    body: "Trends show direction over the days you did log, and Clover says so plainly instead of hiding it.",
  },
  {
    icon: Stethoscope,
    title: "Estimates, not diagnoses",
    body: "Clover can point out a pattern, like iron running low, but never diagnoses. Persistent symptoms get pointed to a professional.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Everything Clover does, at a gentle pace.",
    highlight: false,
    badge: null,
    features: [
      "10 AI-analyzed logs per month",
      "Voice, text and photo logging",
      "Vitamin, mineral and mood tracking",
      "Weekly summary",
    ],
    cta: "Get started free",
    ctaVariant: "outline" as const,
  },
  {
    name: "Clover Plus",
    price: "$7.99",
    period: "per month",
    description: "For logging every meal, every day.",
    highlight: true,
    badge: "Best for daily use",
    features: [
      "Unlimited AI-analyzed logs",
      "Unlimited questions about your eating",
      "Everything in Free",
      "14-day free trial, no card needed",
    ],
    cta: "Start free trial",
    ctaVariant: "default" as const,
  },
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <a href="/" className="flex items-center gap-2">
      <img src="/clover-mark.png" alt="" className={`h-7 w-auto ${dark ? "brightness-0 invert" : ""}`} />
      <span className={`text-xl font-serif font-semibold ${dark ? "text-white" : "text-green-900"}`}>
        Clover Wellness
      </span>
    </a>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 bg-[#FAF6EE]/90 backdrop-blur border-b border-green-900/10">
      <div className="container flex items-center justify-between h-16 px-4">
        <Logo />
        <nav className="hidden md:flex items-center gap-8">
          <a href="#how" className="text-gray-700 hover:text-green-700 transition">
            How it works
          </a>
          <a href="#practitioners" className="text-gray-700 hover:text-green-700 transition">
            For practitioners
          </a>
          <a href="#pricing" className="text-gray-700 hover:text-green-700 transition">
            Pricing
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <a href="/login" className="hidden sm:inline text-gray-700 hover:text-green-700 transition font-medium">
            Sign in
          </a>
          <a
            href="/login"
            className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition font-medium"
          >
            Get started free
          </a>
        </div>
      </div>
    </header>
  );
}

function ChatExample() {
  return (
    <div className="rounded-2xl bg-white/90 backdrop-blur shadow-xl border border-green-900/10 p-4 sm:p-5 space-y-3 max-w-md">
      <div className="flex justify-end">
        <p className="bg-green-700 text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed max-w-[85%]">
          I had oatmeal with walnuts this morning, and a turkey sandwich for lunch
        </p>
      </div>
      <div className="space-y-2">
        {[
          { time: "~8:00", meal: "Oatmeal with walnuts" },
          { time: "~12:30", meal: "Turkey sandwich" },
        ].map(({ time, meal }) => (
          <div key={meal} className="flex items-center gap-3 rounded-xl bg-[#FAF6EE] px-3 py-2">
            <span className="h-6 w-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
              <Check className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-medium text-gray-900">{meal}</span>
            <span className="ml-auto text-xs text-gray-500">{time}</span>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">
        Logged both. Nice mix of fiber and protein to start the day.
      </p>
    </div>
  );
}

function Hero() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.2 });
  return (
    <section ref={ref} className="relative overflow-hidden bg-[#FAF6EE]">
      <div
        className={`container px-4 py-14 md:py-24 grid lg:grid-cols-2 gap-12 items-center transition-all duration-1000 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div>
          <Badge variant="secondary" className="mb-6 bg-green-100 text-green-800 border-green-200">
            Now in beta
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-semibold text-gray-900 mb-6 leading-[1.1]">
            Log what you eat by <span className="text-green-700 italic">just saying it</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-700 mb-8 leading-relaxed">
            Tell Clover what you ate, out loud, in a sentence or with a photo. It estimates the nutrition and quietly
            builds a kind, honest picture of how you eat and feel. No streaks. No guilt about missed days.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <GuestSignInButton className="px-7 py-4 bg-green-700 text-white rounded-lg hover:bg-green-800 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-70" />
            <a
              href="/login"
              className="px-7 py-4 border-2 border-green-700/20 text-green-800 rounded-lg hover:bg-green-50 transition font-semibold flex items-center justify-center gap-2 group"
            >
              Create a free account
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
            </a>
          </div>
          <p className="text-sm text-gray-500">No signup for the demo · 10 free AI analyses · No credit card</p>
        </div>

        <div className="relative">
          <img
            src={HERO_IMAGE}
            alt="A sunlit breakfast table with oatmeal, tea, a phone and a small clover plant"
            className="w-full rounded-3xl shadow-lg object-cover aspect-[3/2]"
          />
          <div className="mt-6 lg:mt-0 lg:absolute lg:-bottom-10 lg:-left-10">
            <ChatExample />
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="how" className="py-20 md:py-28 bg-white scroll-mt-16">
      <div className="container px-4">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-serif font-semibold text-gray-900 mb-5">
            Logging that takes seconds
          </h2>
          <p className="text-lg text-gray-600">
            One conversation that logs your food and answers your questions about it.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 mb-12">
          {FEATURES.map((feature, idx) => (
            <AnimatedFeatureCard key={feature.title} {...feature} delay={(idx % 2) * 150} />
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-green-900/10 bg-[#FAF6EE] p-6 flex gap-5 items-center">
            <img src={MOOD_FEATURE} alt="" className="h-24 w-24 rounded-xl object-cover shrink-0" />
            <div>
              <h3 className="text-lg font-serif font-semibold text-gray-900 mb-1">Notice how food and mood connect</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Optional two-tap check-ins for energy and ease. Over time, gentle patterns show up in your trends.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-green-900/10 bg-[#FAF6EE] p-6 flex gap-5 items-center">
            <div className="h-24 w-24 rounded-xl bg-green-100 text-green-700 flex items-center justify-center shrink-0">
              <MessageSquare className="h-10 w-10" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-semibold text-gray-900 mb-1">Ask about your own eating</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                "Why am I so tired lately?" gets an answer grounded in what you've actually logged, with honest caveats
                about what isn't tracked.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Philosophy() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.2 });
  return (
    <section ref={ref} className="py-20 md:py-28 bg-[#FAF6EE]">
      <div
        className={`container px-4 grid lg:grid-cols-2 gap-12 items-center transition-all duration-1000 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <img
          src={BEFORE_AFTER}
          alt="A tedious spreadsheet food diary beside a single relaxed message and a bowl of food"
          className="w-full rounded-3xl shadow-lg"
        />
        <div>
          <h2 className="text-3xl md:text-4xl font-serif font-semibold text-gray-900 mb-5">
            Built for people who quit food trackers
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Most trackers are spreadsheets with a guilt engine attached. Clover is built on the opposite idea.
          </p>
          <div className="space-y-6">
            {PRINCIPLES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4">
                <div className="h-11 w-11 rounded-xl bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif font-semibold text-gray-900">{title}</h3>
                  <p className="text-gray-600 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Practitioners() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.2 });
  return (
    <section ref={ref} id="practitioners" className="py-20 md:py-28 bg-white scroll-mt-16">
      <div
        className={`container px-4 grid lg:grid-cols-2 gap-12 items-center transition-all duration-1000 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="lg:order-2">
          <img
            src={PRACTITIONERS}
            alt="Two people at a sunlit table looking over a one-page summary together"
            className="w-full rounded-3xl shadow-lg"
          />
        </div>
        <div className="lg:order-1">
          <Badge variant="secondary" className="mb-5 bg-amber-50 text-amber-800 border-amber-200">
            For functional health practitioners
          </Badge>
          <h2 className="text-3xl md:text-4xl font-serif font-semibold text-gray-900 mb-5">
            Food logs your clients will actually keep
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Clients log by talking, so they keep doing it. Then they bring a calm, one-page weekly summary to their next
            visit, with nutrient estimates and mood patterns already pulled together.
          </p>
          <ul className="space-y-4 mb-8">
            {[
              "Clients own their data and choose what to share with you",
              "Flags patterns and points to you rather than diagnosing anything",
              "Missed days don't derail anyone, so engagement lasts beyond week one",
            ].map((item) => (
              <li key={item} className="flex gap-3 text-gray-700">
                <ShieldCheck className="h-5 w-5 text-green-700 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row gap-4">
            <GuestSignInButton className="px-6 py-3 bg-green-700 text-white rounded-lg hover:bg-green-800 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-70" />
            {PRACTITIONER_CONTACT_EMAIL && (
              <a
                href={`mailto:${PRACTITIONER_CONTACT_EMAIL}?subject=Clover%20practitioner%20code`}
                className="px-6 py-3 border-2 border-green-700/20 text-green-800 rounded-lg hover:bg-green-50 transition font-semibold flex items-center justify-center gap-2"
              >
                Request free client codes
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.2 });
  return (
    <section ref={ref} id="pricing" className="py-20 md:py-28 bg-[#FAF6EE] scroll-mt-16">
      <div className="container px-4">
        <div
          className={`max-w-2xl mx-auto text-center mb-14 transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h2 className="text-3xl md:text-5xl font-serif font-semibold text-gray-900 mb-5">Simple pricing</h2>
          <p className="text-lg text-gray-600">Start free. New accounts get 14 days of Plus to try everything.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {PLANS.map((plan, idx) => (
            <AnimatedPricingCard key={plan.name} plan={plan} delay={idx * 150} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#1F2A24] text-gray-300 py-12">
      <div className="container px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2">
            <div className="mb-4">
              <Logo dark />
            </div>
            <p className="text-sm max-w-sm">A calm AI companion for how you eat and feel. Say it, don't enter it.</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#how" className="hover:text-green-400 transition">How it works</a></li>
              <li><a href="#practitioners" className="hover:text-green-400 transition">For practitioners</a></li>
              <li><a href="#pricing" className="hover:text-green-400 transition">Pricing</a></li>
              <li><a href="/login" className="hover:text-green-400 transition">Sign in</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/privacy" className="hover:text-green-400 transition">Privacy Policy</a></li>
              <li><a href="/tos" className="hover:text-green-400 transition">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 pt-8 space-y-3 text-center">
          <p className="text-xs text-gray-400 max-w-2xl mx-auto">
            Clover provides AI-estimated nutrition information for general wellness. It is not a medical device and does
            not diagnose, treat or prevent any condition. Talk to a qualified professional about health concerns.
          </p>
          <p className="text-sm">© {new Date().getFullYear()} Clover Wellness. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Hero />
      <Features />
      <Philosophy />
      <Practitioners />
      <Pricing />
      <Footer />
    </div>
  );
}
