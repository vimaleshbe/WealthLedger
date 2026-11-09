import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
  end?: boolean;
}

export default function NavLink({ to, children, end = false }: NavLinkProps) {
  const { pathname } = useLocation();
  const isActive = end ? pathname === to : pathname.startsWith(to);

  return (
    <Link
      to={to}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200 sm:px-3",
        isActive
          ? "bg-background text-foreground shadow-sm ring-1 ring-border/60 [&_svg]:text-primary"
          : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
