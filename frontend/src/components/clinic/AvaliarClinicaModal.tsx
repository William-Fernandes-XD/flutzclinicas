import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/EmptyState";
import { Field, Textarea } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { HttpError } from "../../lib/http";
import { api, type AvaliacaoPendente } from "../../services/api";
import { useToast } from "../../providers/ToastProvider";

export function AvaliarClinicaModal({
  item,
  onClose,
}: {
  item: AvaliacaoPendente | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [nota, setNota] = useState(5);
  const [comentario, setComentario] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    setNota(5);
    setComentario("");
    setErro("");
  }, [item?.origem, item?.origemId]);

  const salvar = useMutation({
    mutationFn: () =>
      api.criarAvaliacao({
        origem: item!.origem,
        origemId: Number(item!.origemId),
        nota,
        comentario: comentario.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.push("Obrigado pela avaliação!");
      setComentario("");
      setNota(5);
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["avaliacoes-pendentes"] });
      await queryClient.invalidateQueries({ queryKey: ["clinica-avaliacoes"] });
      await queryClient.invalidateQueries({ queryKey: ["agenda-clinicas"] });
      await queryClient.invalidateQueries({ queryKey: ["tutor-vacinas"] });
      await queryClient.invalidateQueries({ queryKey: ["atendimentos"] });
      onClose();
    },
    onError: (err) => setErro(err instanceof HttpError ? err.message : "Não foi possível enviar a avaliação"),
  });

  return (
    <Modal
      open={Boolean(item)}
      title={item ? `Avaliar ${item.clinica}` : "Avaliar clínica"}
      onClose={() => {
        setErro("");
        onClose();
      }}
      footer={
        <Button type="button" busy={salvar.isPending} busyLabel="Enviando…" onClick={() => salvar.mutate()}>
          Enviar avaliação
        </Button>
      }
    >
      {item ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {item.origem === "VACINACAO" ? "Vacinação" : "Atendimento"} de <strong>{item.pet}</strong>
            {item.quando ? ` · ${item.quando}` : ""}
          </p>
          <div>
            <p className="mb-2 text-sm font-medium">Nota</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} estrelas`}
                  onClick={() => setNota(value)}
                  className="rounded-lg p-1 text-brand hover:bg-brand-soft"
                >
                  <Star className={`size-7 ${value <= nota ? "fill-brand" : "text-zinc-300"}`} />
                </button>
              ))}
            </div>
          </div>
          <Field label="Comentário" hint="Opcional">
            <Textarea value={comentario} onChange={(event) => setComentario(event.target.value)} rows={4} />
          </Field>
          {erro ? <ErrorState message={erro} /> : null}
        </div>
      ) : null}
    </Modal>
  );
}
