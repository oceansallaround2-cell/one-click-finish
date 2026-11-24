import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useEffect } from "react";
import { GameView } from "@/game/GameView";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OUR CITY – A World for Two" },
      {
        name: "description",
        content: "An open tropical island city at sunset built for two.",
      },
      { property: "og:title", content: "OUR CITY – A World for Two" },
      {
        property: "og:description",
        content: "An open tropical island city at sunset built for two.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[PWA] Service worker registered with scope:", registration.scope);
        })
        .catch((error) => {
          console.warn("[PWA] Service worker registration failed:", error);
        });
    }
  }, []);

  return (
    <ClientOnly fallback={<div className="w-full h-screen bg-slate-950 flex items-center justify-center text-white font-medium">Loading OUR CITY...</div>}>
      <GameView />
    </ClientOnly>
  );
}
