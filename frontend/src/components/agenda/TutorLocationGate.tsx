import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { readBrowserPosition } from "../../lib/geo";
import { isTutor } from "../../lib/session";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const ASKED_KEY = "flutz_gps_asked";

export function TutorLocationGate() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState("");
  const tutor = isTutor(session);
  const localizacao = useQuery({
    queryKey: ["tutor-localizacao"],
    queryFn: api.tutorLocation,
    enabled: tutor,
  });
  const salvar = useMutation({
    mutationFn: api.saveTutorLocation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tutor-localizacao"] });
      await queryClient.invalidateQueries({ queryKey: ["agenda-clinicas"] });
      setOpen(false);
    },
    onError: () => {
      setErro("Não foi possível salvar a localização. Tente de novo.");
    },
  });

  useEffect(() => {
    if (!tutor || localizacao.isLoading || localizacao.data?.latitude != null) return;
    if (sessionStorage.getItem(ASKED_KEY) === "1") return;
    setOpen(true);
  }, [tutor, localizacao.isLoading, localizacao.data]);

  if (!tutor) return null;

  function recusar() {
    sessionStorage.setItem(ASKED_KEY, "1");
    setOpen(false);
  }

  async function pedir() {
    if (salvar.isPending) return;
    setErro("");
    try {
      const pos = await readBrowserPosition();
      sessionStorage.setItem(ASKED_KEY, "1");
      salvar.mutate({ latitude: pos.latitude, longitude: pos.longitude });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível obter a localização.");
    }
  }

  return (
    <Modal
      open={open}
      title="Sua localização"
      onClose={recusar}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={recusar}>
            Agora não
          </Button>
          <Button onClick={() => void pedir()} busy={salvar.isPending} busyLabel="Salvando…">
            Permitir
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-muted">
        Para calcular a distância até as clínicas, o Flutz pede sua localização ao entrar. Ela é
        salva na sua conta — não fica no navegador — e serve só para ordenar as clínicas mais
        próximas.
      </p>
      {erro ? <p className="mt-3 text-sm text-danger">{erro}</p> : null}
    </Modal>
  );
}
