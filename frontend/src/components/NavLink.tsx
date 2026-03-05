import { Link, type LinkProps } from "react-router-dom";

const navLinkClass =
  "inline-flex items-center justify-center rounded-lg border border-border bg-background min-h-[44px] min-w-[120px] px-5 py-2.5 text-base font-medium text-foreground no-underline shadow-sm hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

export function NavLink({ className = "", children, ...props }: LinkProps) {
  return (
    <Link className={`${navLinkClass} ${className}`.trim()} {...props}>
      {children}
    </Link>
  );
}
