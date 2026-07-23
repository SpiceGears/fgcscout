import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="bg-gray-950 min-h-screen p-8 text-white">
      <div className="mx-auto max-w-4xl bg-gray-900 border border-gray-700 rounded-3xl p-8 shadow-lg">
        <h1 className="text-3xl font-bold mb-4">About</h1>
        <p className="text-gray-300 mb-4">
          FGC Scout is a scouting dashboard for robotics events. This page is a stub so the app doesn’t return 404 for About.
        </p>
        <Link href="/" className="text-sky-400 hover:text-sky-200">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
