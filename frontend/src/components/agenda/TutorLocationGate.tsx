import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
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

  function pedir() {
    if (salvar.isPending) return;
    setErro("");
    if (!navigator.geolocation) {
      setErro("Este navegador não informa localização.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sessionStorage.setItem(ASKED_KEY, "1");
        salvar.mutate({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => {
        setErro("Não foi possível obter a localização. Você pode tentar de novo em Minhas clínicas.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
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
          <Button onClick={pedir} busy={salvar.isPending} busyLabel="Salvando…">
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
