import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { GuestSignInButton } from "@/components/GuestSignInButton";
import {
  Mic,
  BarChart3,
  CalendarDays,
  ChefHat,
  MessageSquare,
  Smartphone,
  Check,
  Leaf,
  Zap,
  Shield,
  Star,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { AnimatedFeatureCard } from "@/components/AnimatedFeatureCard";
import { AnimatedPricingCard } from "@/components/AnimatedPricingCard";
import { TestimonialCard } from "@/components/TestimonialCard";

// Asset URLs for generated images
const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663588202014/hU9uCPSS7HGW4CDwXkxoga/hero-background-NnGEqfKJ4rFnfvwpoqp2Ck.webp";
const VOICE_FEATURE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663588202014/hU9uCPSS7HGW4CDwXkxoga/voice-logging-feature-4UaLYJp6o4ZKrEfbUGt2jX.webp";
const NUTRITION_FEATURE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663588202014/hU9uCPSS7HGW4CDwXkxoga/nutrition-tracking-feature-BzUgYmWeTmVQ8wdCEhrogX.webp";
const CALENDAR_FEATURE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663588202014/hU9uCPSS7HGW4CDwXkxoga/calendar-feature-NCupS2NRGoTsYQtkzWBT3d.webp";
const RECIPES_FEATURE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663588202014/hU9uCPSS7HGW4CDwXkxoga/recipes-feature-84nRaFWF2FNmFKjid58zEx.webp";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: Mic,
    title: "Voice-First Logging",
    description:
      "Say what you ate and Clover figures out the rest. No tapping through menus — just speak naturally and move on with your day.",
    image: VOICE_FEATURE,
    color: "bg-green-50 text-green-700",
  },
  {
    icon: BarChart3,
    title: "Nutrition Insights",
    description:
      "Get instant macro breakdowns with AI-powered analysis. See calories, protein, carbs, fat, and fiber at a glance.",
    image: NUTRITION_FEATURE,
    color: "bg-amber-50 text-amber-700",
  },
  {
    icon: CalendarDays,
    title: "Calendar History",
    description:
      "Tap any day to see exactly what you ate and how your macros stacked up. Patterns become obvious at a glance.",
    image: CALENDAR_FEATURE,
    color: "bg-emerald-50 text-emerald-700",
  },
  {
    icon: ChefHat,
    title: "Recipe Recommendations",
    description:
      "Get recipe ideas filtered by your dietary preferences and allergens — powered by millions of real recipes.",
    image: RECIPES_FEATURE,
    color: "bg-orange-50 text-orange-700",
  },
  {
    icon: MessageSquare,
    title: "AI Health Chat",
    description:
      "Ask questions about your food history and get personalized answers. \"How much protein did I average this week?\" — just ask.",
    color: "bg-green-50 text-green-700",
  },
  {
    icon: Smartphone,
    title: "Works on Any Device",
    description:
      "Fully responsive on mobile, tablet, and desktop. Log from your phone at a restaurant or review your week on a laptop.",
    color: "bg-slate-50 text-slate-700",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Try Clover with no commitment.",
    highlight: false,
    badge: null,
    features: [
      "10 AI voice logs per month",
      "Basic macro dashboard",
      "7-day history",
      "Manual text entry",
    ],
    cta: "Get started free",
    ctaVariant: "outline" as const,
  },
  {
    name: "Clover Plus",
    price: "$7.99",
    period: "per month",
    description: "For serious trackers.",
    highlight: true,
    badge: "Most Popular",
    features: [
      "Unlimited AI voice logs",
      "Advanced macro dashboard",
      "30-day history",
      "Recipe recommendations",
      "Priority support",
    ],
    cta: "Start free trial",
    ctaVariant: "default" as const,
  },
  {
    name: "Clover Pro",
    price: "$14.99",
    period: "per month",
    description: "For health enthusiasts.",
    highlight: false,
    badge: null,
    features: [
      "Everything in Plus",
      "Full vitamin & mineral tracking",
      "Mood-and-meal pattern insights",
      "AI health chat over your data",
      "Shareable weekly report (PDF)",
    ],
    cta: "Start free trial",
    ctaVariant: "outline" as const,
  },
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-green-100">
      <div className="container flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-2">
          <Leaf className="w-6 h-6 text-green-600" />
          <span className="text-xl font-bold text-green-900">Clover Wellness</span>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <a href="/features" className="text-gray-700 hover:text-green-600 transition">
            Features
          </a>
          <a href="#pricing" className="text-gray-700 hover:text-green-600 transition">
            Pricing
          </a>
          <a href="#" className="text-gray-700 hover:text-green-600 transition">
            Reviews
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <a
            href="/login"
            className="text-gray-700 hover:text-green-600 transition font-medium"
          >
            Sign in
          </a>
          <a
            href="/login"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
          >
            Get started free
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.3 });
  return (
    <section ref={ref} className="relative overflow-hidden bg-gradient-to-b from-green-50 to-white py-20 md:py-32">
      {/* Background image */}
      <div
        className="absolute inset-0 opacity-30 bg-cover bg-center"
        style={{ backgroundImage: `url('${HERO_BG}')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white" />

      <div className={`container relative z-10 px-4 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-block mb-6">
            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
              <Leaf className="w-3 h-3 mr-1" />
              Natural Wellness Tracking
            </Badge>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Log what you eat by{" "}
            <span className="text-green-600">just saying it</span>
          </h1>

          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Clover listens to how you naturally describe your meals, extracts accurate nutrition data, and builds a clear picture of your health — without the friction of traditional food trackers.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <GuestSignInButton />
            <a
              href={getLoginUrl()}
              className="px-8 py-4 border-2 border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition font-semibold flex items-center justify-center gap-2 group"
            >
              Get early access
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
            </a>
          </div>

          <p className="text-sm text-gray-500">
            No signup for the demo • No credit card ever • 10 free AI logs per month on the free plan
          </p>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-20 md:py-32 bg-white">
      <div className="container px-4">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Everything you need to understand your nutrition
          </h2>
          <p className="text-xl text-gray-600">
            From voice logging to AI insights, Clover makes nutrition tracking effortless and natural.
          </p>
        </div>

        {/* Feature grid with images */}
        <div className="grid md:grid-cols-2 gap-12 mb-16">
          {FEATURES.slice(0, 4).map((feature, idx) => (
            <AnimatedFeatureCard
              key={idx}
              image={feature.image}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              color={feature.color}
              delay={idx * 150}
            />
          ))}
        </div>

        {/* Additional features without images */}
        <div className="grid md:grid-cols-2 gap-8">
          {FEATURES.slice(4).map((feature, idx) => (
            <Card key={idx} className="border-green-100 hover:shadow-lg transition">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${feature.color} flex-shrink-0`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                    <p className="text-gray-600">{feature.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.2 });
  return (
    <section ref={ref} id="pricing" className="py-20 md:py-32 bg-gradient-to-b from-green-50 to-white">
      <div className="container px-4">
        <div className={`max-w-2xl mx-auto text-center mb-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Simple, transparent pricing
          </h2>
          <p className="text-xl text-gray-600">
            Start free and upgrade anytime. All plans include a 14-day trial of Plus features.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {PLANS.map((plan, idx) => (
            <AnimatedPricingCard key={idx} plan={plan} delay={idx * 150} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SocialProof() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.2 });
  return (
    <section ref={ref} className="py-16 md:py-24 bg-white border-t border-green-100">
      <div className="container px-4">
        <div className={`text-center mb-12 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Loved by health-conscious people</h2>
          <p className="text-gray-600">Join thousands tracking their nutrition naturally</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { rating: 4.9, count: 2847, text: "Finally a tracker that doesn't feel like a chore" },
            { rating: 4.8, count: 1923, text: "The voice logging is a game changer for me" },
            { rating: 4.9, count: 3156, text: "Best nutrition app I've tried" },
          ].map((item, idx) => (
            <TestimonialCard key={idx} item={item} delay={idx * 150} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12 border-t border-green-900">
      <div className="container px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Leaf className="w-5 h-5 text-green-400" />
              <span className="font-bold text-white">Clover Wellness</span>
            </div>
            <p className="text-sm">Track your nutrition naturally with voice-first logging.</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/features" className="hover:text-green-400 transition">Features</a></li>
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
          <div>
            <h4 className="font-semibold text-white mb-4">Connect</h4>
            <p className="text-sm">Have questions? We'd love to hear from you.</p>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8">
          <p className="text-sm text-center">
            © 2026 Clover Wellness. All rights reserved. Built with care for your health.
          </p>
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
      <Pricing />
      <SocialProof />
      <Footer />
    </div>
  );
}
