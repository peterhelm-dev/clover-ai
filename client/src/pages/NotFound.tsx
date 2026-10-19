import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Leaf } from "lucide-react";
import { PublicFeedbackLink } from "@/components/PublicFeedbackLink";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
      <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
        <Leaf className="h-8 w-8 animate-bounce" />
      </div>
      <h1 className="text-4xl font-bold font-serif text-foreground mb-2">404 - Page Not Found</h1>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        The seasonal planning resource or recipe you are looking for has been moved or is currently out of season.
      </p>
      <Link href="/">
        <Button>Return to Home</Button>
      </Link>
      <p className="mt-6 text-sm text-muted-foreground">
        <PublicFeedbackLink className="hover:text-foreground transition-colors" />
      </p>
    </div>
  );
}
