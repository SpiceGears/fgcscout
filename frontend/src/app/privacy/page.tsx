import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="bg-gray-950 min-h-screen p-8 text-white">
      <div className="mx-auto max-w-4xl bg-gray-900 border border-gray-700 rounded-3xl p-8 shadow-lg">
        <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-gray-300 mb-4">
          This is a placeholder privacy page. Add your actual privacy content here later.
        </p>
        <Link href="/" className="text-sky-400 hover:text-sky-200">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
