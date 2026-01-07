import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50">
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        {/* Floating orbs background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-20 w-64 h-64 bg-orange-200 rounded-full blur-3xl opacity-40 animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-pink-200 rounded-full blur-3xl opacity-40 animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-purple-200 rounded-full blur-3xl opacity-30 animate-pulse delay-500"></div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="mb-6">
            <span className="px-4 py-2 text-sm font-semibold text-orange-600 bg-orange-100 rounded-full">
              🎤 Voice-Powered
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-gray-900 mb-6 leading-tight">
            Build Apps by
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500"> Talking</span>
          </h1>

          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            Speak your ideas. Watch them appear in real-time.
            Deploy with one click. No coding required.
          </p>

          <Link
            href="/builder"
            className="inline-flex items-center gap-3 px-8 py-5 text-xl font-bold text-white bg-gradient-to-r from-orange-500 to-pink-500 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
          >
            <span className="text-2xl">🎤</span>
            Start Building
          </Link>

          <p className="mt-6 text-sm text-gray-500">
            No signup required • Free to start • Deploy instantly
          </p>
        </div>

        {/* Feature pills */}
        <div className="relative z-10 flex flex-wrap justify-center gap-4 mt-16">
          <div className="px-4 py-2 bg-white/80 backdrop-blur rounded-full shadow-sm text-sm">
            ⚡ ~300ms response
          </div>
          <div className="px-4 py-2 bg-white/80 backdrop-blur rounded-full shadow-sm text-sm">
            🤖 AI-powered
          </div>
          <div className="px-4 py-2 bg-white/80 backdrop-blur rounded-full shadow-sm text-sm">
            🚀 1-click deploy
          </div>
          <div className="px-4 py-2 bg-white/80 backdrop-blur rounded-full shadow-sm text-sm">
            💾 Save to profile
          </div>
        </div>
      </div>
    </main>
  );
}
