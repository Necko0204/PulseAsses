"use client";

import { useState, useEffect } from "react";

export default function EntryGate({
  onReady,
}: {
  onReady: (lat: number, lng: number) => void;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function enter() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Your browser doesn't support location access.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => onReady(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission is required to place you on the map."
            : "Couldn't get your location. Please try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  if (!mounted) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black p-6">
        <div className="relative z-10 flex flex-col items-center gap-8 text-center max-w-2xl">
          <div className="space-y-4">
            <h1 className="text-8xl md:text-9xl font-bold tracking-tighter bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              Pulse
            </h1>
            <p className="text-lg text-cyan-200/80 font-light tracking-wide">
              Connect with the world
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black p-6">
      {/* Starfield Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Stars */}
        {Array.from({ length: 100 }).map((_, i) => {
          const randomSeed = Math.sin(i * 12.9898) * 43758.5453;
          const rand1 = randomSeed - Math.floor(randomSeed);
          const rand2 = Math.sin(i * 78.233) * 43758.5453 - Math.floor(Math.sin(i * 78.233) * 43758.5453);
          const rand3 = Math.sin(i * 45.164) * 43758.5453 - Math.floor(Math.sin(i * 45.164) * 43758.5453);
          const rand4 = Math.sin(i * 94.673) * 43758.5453 - Math.floor(Math.sin(i * 94.673) * 43758.5453);

          return (
            <div
              key={`star-${i}`}
              className="absolute rounded-full bg-white"
              style={{
                width: rand3 > 0.7 ? "2px" : "1px",
                height: rand3 > 0.7 ? "2px" : "1px",
                left: `${rand1 * 100}%`,
                top: `${rand2 * 100}%`,
                opacity: rand4 * 0.7 + 0.3,
                animation: `twinkle ${2 + rand1 * 3}s ease-in-out infinite`,
                animationDelay: `${rand2 * 2}s`,
              }}
            />
          );
        })}

        {/* Falling particles / Rain effect */}
        {Array.from({ length: 50 }).map((_, i) => {
          const randomSeed = Math.sin(i * 34.123) * 43758.5453;
          const rand1 = randomSeed - Math.floor(randomSeed);
          const rand2 = Math.sin(i * 82.234) * 43758.5453 - Math.floor(Math.sin(i * 82.234) * 43758.5453);
          const rand3 = Math.sin(i * 12.345) * 43758.5453 - Math.floor(Math.sin(i * 12.345) * 43758.5453);

          return (
            <div
              key={`rain-${i}`}
              className="absolute"
              style={{
                width: "1px",
                height: rand3 * 40 + 20 + "px",
                left: `${rand1 * 100}%`,
                top: "-50px",
                background: `linear-gradient(to bottom, rgba(100, 200, 255, ${
                  0.5 + rand2 * 0.5
                }), rgba(100, 200, 255, 0))`,
                animation: `fall ${2 + rand1 * 2}s linear infinite`,
                animationDelay: `${rand2 * 2}s`,
              }}
            />
          );
        })}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 text-center max-w-2xl">
        {/* Title */}
        <div className="space-y-4 animate-fade-in">
          <h1 className="text-8xl md:text-9xl font-bold tracking-tighter bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            Pulse
          </h1>
          <p className="text-lg text-cyan-200/80 font-light tracking-wide">
            Connect with the world
          </p>
          <p className="text-base md:text-lg text-slate-300 max-w-lg mx-auto leading-relaxed">
            Drop onto the map and meet strangers from around the globe. Chat, video call, and share moments—all peer-to-peer, anonymous, and instant.
          </p>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap gap-3 justify-center my-4 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="px-4 py-2 rounded-full border border-cyan-400/50 bg-cyan-400/5 backdrop-blur text-sm text-cyan-300 hover:border-cyan-300 hover:bg-cyan-400/10 transition-all">
            Anonymous
          </div>
          <div className="px-4 py-2 rounded-full border border-blue-400/50 bg-blue-400/5 backdrop-blur text-sm text-blue-300 hover:border-blue-300 hover:bg-blue-400/10 transition-all">
            Instant
          </div>
          <div className="px-4 py-2 rounded-full border border-purple-400/50 bg-purple-400/5 backdrop-blur text-sm text-purple-300 hover:border-purple-300 hover:bg-purple-400/10 transition-all">
            Video
          </div>
        </div>

        {/* CTA Button */}
        <div className="w-full space-y-6 mt-8" style={{ animationDelay: "0.4s" }}>
          <button
            onClick={enter}
            disabled={status === "locating"}
            className="relative w-full group px-8 py-4 rounded-2xl font-bold text-lg text-white bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 hover:from-cyan-400 hover:via-blue-400 hover:to-purple-400 disabled:opacity-50 disabled:cursor-wait transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-2xl hover:shadow-cyan-500/50 disabled:hover:scale-100 overflow-hidden"
          >
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

            {status === "locating" ? (
              <span className="flex items-center justify-center gap-3 relative z-10">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Locating your position…
              </span>
            ) : (
              <span className="relative z-10">
                Enter Pulse
              </span>
            )}
          </button>

          {/* Error State */}
          {status === "error" && (
            <div className="w-full rounded-xl bg-red-500/10 border border-red-500/40 backdrop-blur p-4 text-sm text-red-200 animate-pulse">
              <p className="font-semibold">{error}</p>
            </div>
          )}

          {/* Footer Info */}
          <div className="pt-6 border-t border-slate-700/50 space-y-2 text-xs md:text-sm text-slate-400">
            <div className="flex items-center justify-center gap-2">
              <span>✓</span>
              <span>Your location is randomized 1–3 km for privacy</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span>✓</span>
              <span>Nothing is stored—close to end everything</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span>✓</span>
              <span>Peer-to-peer encrypted communications</span>
            </div>
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        
        @keyframes fall {
          to {
            transform: translateY(100vh);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.8s ease-out;
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.8s ease-out;
        }
      `}</style>
    </div>
  );
}
