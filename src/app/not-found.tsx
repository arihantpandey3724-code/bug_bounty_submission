import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto my-16 p-8 bg-white border border-neutral-200 rounded-md text-center space-y-4 font-mono">
      <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-900">
        <AlertCircle className="w-5 h-5" />
      </div>
      <h1 className="text-xl font-bold text-neutral-900">404 — PAGE NOT FOUND</h1>
      <p className="text-xs text-neutral-500 font-sans">
        The requested triage route or endpoint does not exist.
      </p>
      <Link
        href="/"
        className="inline-block px-4 py-2 bg-neutral-900 text-white text-xs font-bold uppercase rounded-sm hover:bg-neutral-800"
      >
        Return to Portal Home
      </Link>
    </div>
  );
}
