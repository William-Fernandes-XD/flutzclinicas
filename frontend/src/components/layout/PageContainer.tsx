import type { ElementType, ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
};

export function PageContainer({ children, className = "", as: Tag = "div" }: PageContainerProps) {
  return (
    <Tag className={`mx-auto w-full min-w-0 max-w-6xl px-4 sm:px-6 ${className}`.trim()}>
      {children}
    </Tag>
  );
}
