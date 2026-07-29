import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

interface PricingPlan {
  name: string;
  description: string;
  price: string;
  period: string;
  cta: string;
  ctaVariant: "default" | "outline";
  badge?: string | null;
  highlight?: boolean;
  features: string[];
}

interface AnimatedPricingCardProps {
  plan: PricingPlan;
  delay: number;
}

export function AnimatedPricingCard({ plan, delay }: AnimatedPricingCardProps) {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.2 });

  return (
    <Card
      ref={ref}
      className={`relative border-2 transition ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      } ${
        plan.highlight
          ? "border-green-600 shadow-xl md:scale-105"
          : "border-green-100 hover:border-green-200"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {plan.badge && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-green-600 text-white">{plan.badge}</Badge>
        </div>
      )}
      <CardHeader>
        <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
        <p className="text-gray-600 text-sm mt-2">{plan.description}</p>
        <div className="mt-4">
          <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
          <span className="text-gray-600 ml-2">/{plan.period}</span>
        </div>
      </CardHeader>
      <CardContent>
        <a
          href="/login"
          className={`w-full py-3 rounded-lg font-semibold transition mb-8 block text-center ${
            plan.ctaVariant === "default"
              ? "bg-green-600 text-white hover:bg-green-700"
              : "border-2 border-green-200 text-green-700 hover:bg-green-50"
          }`}
        >
          {plan.cta}
        </a>
        <ul className="space-y-3">
          {plan.features.map((feature, fidx) => (
            <li key={fidx} className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
