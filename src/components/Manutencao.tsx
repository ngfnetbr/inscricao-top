import { useQuery } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import { obterManutencao } from "@/lib/manutencao";

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="card-elevated max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Wrench className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Em manutenção</h1>
        <p className="mt-3 text-sm text-muted-foreground">{mensagem}</p>
      </div>
    </div>
  );
}
