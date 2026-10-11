import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageSquarePlus, Star, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "general", label: "General Feedback" },
  { value: "bug", label: "Bug Report" },
  { value: "feature_request", label: "Feature Request" },
  { value: "ux", label: "UX / Design" },
  { value: "performance", label: "Performance" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

const OPEN_FEEDBACK_EVENT = "clover:open-feedback";

/** Opens the feedback dialog from anywhere (e.g. the mobile header icon). */
export function openFeedback() {
  window.dispatchEvent(new Event(OPEN_FEEDBACK_EVENT));
}

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_FEEDBACK_EVENT, handler);
    return () => window.removeEventListener(OPEN_FEEDBACK_EVENT, handler);
  }, []);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [category, setCategory] = useState<Category>("general");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.beta.submitFeedback.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        // reset for next time
        setTimeout(() => {
          setSubmitted(false);
          setRating(0);
          setMessage("");
          setCategory("general");
        }, 300);
      }, 1800);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to submit feedback. Please try again.");
    },
  });

  const handleSubmit = () => {
    if (rating === 0) {
      toast.error("Please select a star rating.");
      return;
    }
    if (message.trim().length < 5) {
      toast.error("Please write at least a few words of feedback.");
      return;
    }
    submitMutation.mutate({ rating, category, message: message.trim() });
  };

  const displayRating = hoveredRating || rating;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-40 hidden md:flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
        aria-label="Give feedback"
      >
        <MessageSquarePlus className="w-4 h-4" />
        <span>Feedback</span>
      </button>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          {submitted ? (
            <div className="py-8 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Thanks for your feedback!</h3>
              <p className="text-sm text-gray-500">Your input helps us make Clover better.</p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquarePlus className="w-5 h-5 text-emerald-600" />
                  Share Your Feedback
                </DialogTitle>
                <DialogDescription>
                  You're part of the Clover beta — your feedback shapes the product.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 pt-2">
                {/* Star rating */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    How would you rate your experience?
                  </Label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="p-0.5 transition-transform hover:scale-110"
                        aria-label={`${star} star`}
                      >
                        <Star
                          className={`w-8 h-8 transition-colors ${
                            star <= displayRating
                              ? "fill-amber-400 text-amber-400"
                              : "text-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  {displayRating > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {["", "Poor", "Fair", "Good", "Great", "Excellent!"][displayRating]}
                    </p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    Category
                  </Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Message */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    Tell us more
                  </Label>
                  <Textarea
                    placeholder="What's working well? What could be better? Any bugs?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    className="resize-none"
                    maxLength={2000}
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/2000</p>
                </div>

                {/* Submit */}
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? "Submitting..." : "Submit Feedback"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
