import { Link } from "@tanstack/react-router";
import type { MouseEventHandler, ReactNode } from "react";

type ProfileLinkProps = {
  userId: string | null | undefined;
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function ProfileLink({
  userId,
  children,
  className,
  onClick,
}: ProfileLinkProps) {
  if (!userId) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link
      to="/app/profiles/$userId"
      params={{ userId }}
      className={className}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
