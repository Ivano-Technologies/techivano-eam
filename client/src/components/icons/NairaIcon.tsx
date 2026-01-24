import { LucideProps } from "lucide-react";

export const NairaIcon = (props: LucideProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Naira symbol (₦) */}
      <path d="M6 4v16" />
      <path d="M18 4v16" />
      <path d="M6 4l12 16" />
      <path d="M4 10h16" />
      <path d="M4 14h16" />
    </svg>
  );
};
