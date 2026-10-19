import { trpc } from "@/lib/trpc";

/** Placeholder used before the server answers, and when PUBLIC_FEEDBACK_URL is unset. */
export const DEFAULT_FEEDBACK_URL = "mailto:feedback@example.com";

/**
 * Footer link for logged-out visitors. The href comes from PUBLIC_FEEDBACK_URL
 * (a mailto: or https: link) so it can be changed on Railway without a code edit.
 */
export function PublicFeedbackLink({
  className,
  children = "Feedback",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const config = trpc.system.publicConfig.useQuery(undefined, {
    staleTime: Infinity,
    retry: false,
  });
  const href = config.data?.feedbackUrl || DEFAULT_FEEDBACK_URL;
  const external = href.startsWith("http://") || href.startsWith("https://");
  return (
    <a
      href={href}
      className={className}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}
