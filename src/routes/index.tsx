import { createFileRoute } from "@tanstack/react-router";
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
  return <GameView />;
}
