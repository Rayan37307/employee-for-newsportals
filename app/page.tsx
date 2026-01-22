import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-700">
      <div className="max-w-2xl mx-auto px-6 py-16 text-center text-white">
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6">
            <span className="text-4xl font-bold">N</span>
          </div>
          <h1 className="text-5xl font-bold mb-4">News Agent</h1>
          <p className="text-xl text-white/90">
            Automated News Card Design & Publishing Platform
          </p>
        </div>

        <p className="text-lg mb-8 text-white/80">
          Create stunning news cards with our Canva-like editor, automate content from RSS feeds and APIs,
          and publish directly to your social media channels.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/dashboard"
            className="px-8 py-4 rounded-lg bg-white text-purple-600 font-semibold hover:bg-white/90 transition-colors shadow-xl"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/canvas"
            className="px-8 py-4 rounded-lg bg-white/10 backdrop-blur-sm text-white font-semibold hover:bg-white/20 transition-colors border-2 border-white/30"
          >
            Open Canvas
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          <div className="p-6 rounded-lg bg-white/10 backdrop-blur-sm">
            <h3 className="font-semibold mb-2">Design Studio</h3>
            <p className="text-sm text-white/80">Canva-like editor with templates</p>
          </div>
          <div className="p-6 rounded-lg bg-white/10 backdrop-blur-sm">
            <h3 className="font-semibold mb-2">Auto-Pilot</h3>
            <p className="text-sm text-white/80">Automated posting to social media</p>
          </div>
          <div className="p-6 rounded-lg bg-white/10 backdrop-blur-sm">
            <h3 className="font-semibold mb-2">Analytics</h3>
            <p className="text-sm text-white/80">Track performance and engagement</p>
          </div>
        </div>
      </div>
    </div>
  );
}
