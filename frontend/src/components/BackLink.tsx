import { Link, useNavigate, type LinkProps } from "react-router-dom";

/** Left arrow (return/back) icon for accessibility. */
function BackIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

const backLinkClass =
  "inline-flex items-center justify-center rounded-full p-2 text-foreground no-underline hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

type BackLinkBase = { "aria-label": string; className?: string };
type BackLinkProps =
  | (LinkProps & BackLinkBase)
  | (BackLinkBase & { useHistory: true; to?: never });

export function BackLink({ "aria-label": ariaLabel, className = "", ...props }: BackLinkProps) {
  const navigate = useNavigate();
  if ("useHistory" in props && props.useHistory) {
    return (
      <button
        type="button"
        className={`${backLinkClass} ${className}`.trim()}
        aria-label={ariaLabel}
        onClick={() => navigate(-1)}
      >
        <BackIcon />
      </button>
    );
  }
  const { useHistory: _omit, ...linkProps } = props as BackLinkBase & { useHistory?: boolean; to?: string };
  void _omit;
  return (
    <Link
      className={`${backLinkClass} ${className}`.trim()}
      aria-label={ariaLabel}
      {...(linkProps as LinkProps)}
    >
      <BackIcon />
    </Link>
  );
}
