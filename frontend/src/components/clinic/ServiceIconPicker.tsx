import { useState } from "react";
import { Modal } from "../ui/Modal";
import {
  SERVICE_ICON_PALETTE,
  SERVICE_ICON_PREVIEW,
  ServiceTypeIcon,
  type ServiceIconId,
} from "../../lib/service-icons";

export function ServiceIconPicker({
  value,
  onChange,
}: {
  value: ServiceIconId;
  onChange: (id: ServiceIconId) => void;
}) {
  const [open, setOpen] = useState(false);
  const previewIds = new Set(SERVICE_ICON_PREVIEW.map((i) => i.id));
  const selectedOutsidePreview = !previewIds.has(value);
  const selectedDef = SERVICE_ICON_PALETTE.find((i) => i.id === value);

  return (
    <div>
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Escolha o ícone</p>
      <p className="mb-3 text-xs text-muted">
        Você pode repetir o mesmo ícone em vários serviços. O nome do serviço é o que precisa ser único.
      </p>
      <div className="grid grid-cols-5 gap-2">
        {SERVICE_ICON_PREVIEW.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              title={opt.label}
              onClick={() => onChange(opt.id)}
              className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-center transition ${
                selected
                  ? "bg-[#7828c8] text-white shadow-sm"
                  : "bg-[#f7f1fc] text-[#5c4d78] hover:bg-[#ebe0fa]"
              }`}
            >
              <ServiceTypeIcon icone={opt.id} className="size-6" />
              <span className="line-clamp-1 text-[10px] font-semibold leading-tight">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {selectedOutsidePreview && selectedDef ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted">
          Selecionado:
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2 py-1 font-semibold text-brand">
            <ServiceTypeIcon icone={selectedDef.id} className="size-3.5" />
            {selectedDef.label}
          </span>
        </p>
      ) : null}

      <button
        type="button"
        className="mt-3 text-sm font-semibold text-brand hover:underline"
        onClick={() => setOpen(true)}
      >
        Ver mais
      </button>

      <Modal open={open} title="Escolher ícone do serviço" onClose={() => setOpen(false)} wide>
        <p className="mb-4 text-sm text-muted">Selecione um ícone. Pode ser o mesmo de outro serviço.</p>
        <div className="grid max-h-[min(60vh,28rem)] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
          {SERVICE_ICON_PALETTE.map((opt) => {
            const selected = value === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                title={opt.label}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center transition ${
                  selected
                    ? "bg-[#7828c8] text-white shadow-sm"
                    : "bg-[#f7f1fc] text-[#5c4d78] hover:bg-[#ebe0fa]"
                }`}
              >
                <ServiceTypeIcon icone={opt.id} className="size-7" />
                <span className="line-clamp-2 text-[11px] font-semibold leading-tight">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
