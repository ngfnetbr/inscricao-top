import { createFileRoute } from "@tanstack/react-router";
import { InscricaoPage } from "./index";

export const Route = createFileRoute("/inscricao-interna")({
  head: () => ({
    meta: [
      { title: "Inscrição interna" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => <InscricaoPage bypassManutencao />,
});
