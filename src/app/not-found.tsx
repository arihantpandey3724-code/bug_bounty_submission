import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto my-16 p-8 bg-white border border-neutral-200 rounded-lg text-center space-y-4 font-sans shadow-xs">
      <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-900">
        <AlertCircle className="w-5 h-5 text-neutral-700" />
      </div>
      <h1 className="text-xl font-bold text-neutral-900">Page not found (404)</h1>
      <p className="text-sm text-neutral-600">
        The page you are looking for doesn't exist or may have been moved.
      </p>
      <Link
        href="/"
        className="inline-block px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-800 transition-colors"
      >
        Return to Home
      </Link>
    </div>
  );
}
