import { useQuery } from "@tanstack/react-query";
import { Wrench, Lock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { obterManutencao } from "@/lib/manutencao";
import logoConversas from "@/assets/conversas-pedagogicas.png.asset.json";

export function useManutencao() {
  return useQuery({
    queryKey: ["manutencao"],
    queryFn: obterManutencao,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    staleTime: 0,
  });
}

export function TelaManutencao({ mensagem }: { mensagem: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <img
        src={logoConversas.url}
        alt="Conversas Pedagógicas"
        className="mb-6 h-24 w-auto sm:h-28"
      />
      <div className="card-elevated max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Wrench className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Em manutenção</h1>
        <p className="mt-3 text-sm text-muted-foreground">{mensagem}</p>
      </div>
      <Link
        to="/admin"
        className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <Lock className="h-3.5 w-3.5" /> Área administrativa
      </Link>
    </div>
  );
}
