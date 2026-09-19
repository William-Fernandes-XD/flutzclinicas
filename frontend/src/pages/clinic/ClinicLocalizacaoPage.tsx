import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { Field, Input, Select } from "../../components/ui/Field";
import { PageHeader } from "../../components/ui/PageHeader";
import { readBrowserPosition } from "../../lib/geo";
import { HttpError } from "../../lib/http";
import { UFS, normalizeUf } from "../../lib/ufs";
import { useToast } from "../../providers/ToastProvider";
import { api, type PageAddress } from "../../services/api";

const BRASILIA = { latitude: -15.793889, longitude: -47.882778 };
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

type LeafletMap = {
  setView: (latlng: [number, number], zoom?: number) => LeafletMap;
  on: (event: string, handler: (e: { latlng: { lat: number; lng: number } }) => void) => void;
  remove: () => void;
};

type LeafletMarker = {
  setLatLng: (latlng: [number, number]) => LeafletMarker;
  addTo: (map: LeafletMap) => LeafletMarker;
  remove: () => void;
};

type LeafletNs = {
  map: (el: HTMLElement) => LeafletMap;
  tileLayer: (url: string, opts?: Record<string, unknown>) => { addTo: (map: LeafletMap) => void };
  marker: (latlng: [number, number]) => LeafletMarker;
  Icon: { Default: { prototype: Record<string, unknown>; mergeOptions: (opts: Record<string, string>) => void } };
};

declare global {
  interface Window {
    L?: LeafletNs;
  }
}

function loadLeaflet(): Promise<LeafletNs> {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => (window.L ? resolve(window.L) : reject(new Error("Leaflet indisponível"))));
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar o mapa")));
      if (window.L) resolve(window.L);
      return;
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error("Leaflet indisponível")));
    script.onerror = () => reject(new Error("Falha ao carregar o mapa"));
    document.body.appendChild(script);
  });
}

async function fetchCidadesIbge(uf: string): Promise<string[]> {
  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`,
  );
  if (!response.ok) return [];
  const data = (await response.json()) as { nome: string }[];
  return data.map((item) => item.nome);
}

async function geocodeCidadeUf(cidade: string, uf: string): Promise<{ latitude: number; longitude: number } | null> {
  const ufNome = UFS.find((item) => item.sigla === uf)?.nome ?? uf;
  const params = new URLSearchParams({
    format: "json",
    limit: "1",
    countrycodes: "br",
    city: cidade,
    state: ufNome,
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: "application/json", "Accept-Language": "pt-BR" },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { lat: string; lon: string }[];
  if (!data[0]) return null;
  return { latitude: Number(data[0].lat), longitude: Number(data[0].lon) };
}

export function ClinicLocalizacaoPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ["agenda-config"], queryFn: api.agendaConfig });
  const pagina = useQuery({ queryKey: ["pagina"], queryFn: api.pageConfig });
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const skipFlyRef = useRef(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapError, setMapError] = useState("");
  const [gpsBusy, setGpsBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [cidades, setCidades] = useState<string[]>([]);
  const [cidadesLoading, setCidadesLoading] = useState(false);
  const [endereco, setEndereco] = useState<PageAddress>({
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    mapsUrl: null,
    latitude: null,
    longitude: null,
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!coords || !config.data) return;
      await Promise.all([
        api.saveAgendaConfig({
          latitude: coords.latitude,
          longitude: coords.longitude,
          cancelamentoAntecedenciaMinutos: config.data.cancelamentoAntecedenciaMinutos,
        }),
        api.saveEndereco({ ...endereco, latitude: coords.latitude, longitude: coords.longitude }),
      ]);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["agenda-config"] }),
        queryClient.invalidateQueries({ queryKey: ["pagina"] }),
      ]);
      toast.push("Endereço e localização salvos.");
    },
  });

  useEffect(() => {
    if (!config.data) return;
    setCoords({
      latitude: config.data.latitude ?? BRASILIA.latitude,
      longitude: config.data.longitude ?? BRASILIA.longitude,
    });
  }, [config.data]);

  useEffect(() => {
    if (!pagina.data?.endereco) return;
    const loaded = {
      ...pagina.data.endereco,
      uf: normalizeUf(pagina.data.endereco.uf) ?? pagina.data.endereco.uf ?? "",
    };
    setEndereco(loaded);
    if (loaded.latitude != null && loaded.longitude != null) {
      setCoords({
        latitude: loaded.latitude,
        longitude: loaded.longitude,
      });
    }
  }, [pagina.data]);

  useEffect(() => {
    const uf = normalizeUf(endereco.uf);
    if (!uf) {
      setCidades([]);
      return;
    }
    let cancelled = false;
    setCidadesLoading(true);
    void fetchCidadesIbge(uf)
      .then((lista) => {
        if (!cancelled) setCidades(lista);
      })
      .finally(() => {
        if (!cancelled) setCidadesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [endereco.uf]);

  useEffect(() => {
    if (!coords || !mapEl.current) return;
    let cancelled = false;

    void (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapEl.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const DefaultIcon = (L as any).Icon?.Default;
        if (DefaultIcon) {
          delete DefaultIcon.prototype._getIconUrl;
          DefaultIcon.mergeOptions({
            iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
            iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
            shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
          });
        }

        if (!mapRef.current) {
          const map = L.map(mapEl.current).setView([coords.latitude, coords.longitude], 14);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
          }).addTo(map);
          map.on("click", (event) => {
            skipFlyRef.current = true;
            const next = { latitude: event.latlng.lat, longitude: event.latlng.lng };
            setCoords(next);
            void preencherEnderecoPorCoords(next.latitude, next.longitude);
          });
          mapRef.current = map;
        } else if (!skipFlyRef.current) {
          mapRef.current.setView([coords.latitude, coords.longitude], 14);
        }
        skipFlyRef.current = false;

        if (!markerRef.current) {
          markerRef.current = L.marker([coords.latitude, coords.longitude]).addTo(mapRef.current);
        } else {
          markerRef.current.setLatLng([coords.latitude, coords.longitude]);
        }
        setMapError("");
      } catch (err) {
        setMapError(err instanceof Error ? err.message : "Não foi possível carregar o mapa.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [coords]);

  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      mapRef.current?.remove();
      markerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  async function preencherEnderecoPorCoords(latitude: number, longitude: number) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`;
      const response = await fetch(url, {
        headers: { Accept: "application/json", "Accept-Language": "pt-BR" },
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        address?: Record<string, string>;
      };
      const a = data.address ?? {};
      setEndereco((atual) => ({
        ...atual,
        cep: a.postcode ?? atual.cep,
        logradouro: a.road ?? a.pedestrian ?? a.residential ?? atual.logradouro,
        bairro: a.suburb ?? a.neighbourhood ?? a.city_district ?? atual.bairro,
        cidade: a.city ?? a.town ?? a.village ?? a.municipality ?? atual.cidade,
        uf: normalizeUf(a.state_code ?? a.state) ?? atual.uf ?? "",
        latitude,
        longitude,
      }));
    } catch {
      // Reverse geocode é opcional; o pin já foi gravado.
    }
  }

  async function onUfChange(uf: string) {
    const sigla = normalizeUf(uf) ?? "";
    setEndereco((atual) => ({ ...atual, uf: sigla, cidade: "" }));
    if (!sigla) return;
    const ufNome = UFS.find((item) => item.sigla === sigla)?.nome ?? sigla;
    setGeoBusy(true);
    try {
      const ponto = await geocodeCidadeUf(ufNome, sigla);
      if (ponto) setCoords(ponto);
    } finally {
      setGeoBusy(false);
    }
  }

  async function onCidadeChange(cidade: string) {
    const uf = normalizeUf(endereco.uf) ?? "";
    setEndereco((atual) => ({ ...atual, cidade }));
    if (!cidade || !uf) return;
    setGeoBusy(true);
    try {
      const ponto = await geocodeCidadeUf(cidade, uf);
      if (ponto) setCoords(ponto);
    } finally {
      setGeoBusy(false);
    }
  }

  async function usarGps() {
    setGpsBusy(true);
    setSaveError("");
    try {
      const pos = await readBrowserPosition();
      skipFlyRef.current = true;
      setCoords({ latitude: pos.latitude, longitude: pos.longitude });
      await preencherEnderecoPorCoords(pos.latitude, pos.longitude);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Não foi possível obter a localização.");
    } finally {
      setGpsBusy(false);
    }
  }

  async function onSalvar() {
    if (!coords || !config.data) return;
    setSaveError("");
    try {
      await salvar.mutateAsync();
    } catch (err) {
      setSaveError(err instanceof HttpError ? err.message : "Não foi possível salvar a localização.");
    }
  }

  if (config.isLoading || pagina.isLoading) return <LoadingState label="Carregando localização…" />;

  const ufAtual = normalizeUf(endereco.uf) ?? "";
  const cidadeAtual = endereco.cidade ?? "";
  const cidadeNaLista = cidades.includes(cidadeAtual);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clínica"
        title="Localização"
        description="Escolha estado e cidade para posicionar o mapa; depois clique no ponto exato da clínica."
      />

      {mapError ? <ErrorState message={mapError} /> : null}
      {saveError ? <ErrorState message={saveError} /> : null}

      <section className="living-card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="UF">
          <Select
            value={ufAtual}
            onChange={(e) => void onUfChange(e.target.value)}
            disabled={geoBusy}
          >
            <option value="">Selecione o estado</option>
            {UFS.map((uf) => (
              <option key={uf.sigla} value={uf.sigla}>
                {uf.sigla} — {uf.nome}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2 lg:col-span-3">
          <Field label="Cidade" hint={cidadesLoading ? "Carregando municípios…" : undefined}>
            <Select
              value={cidadeNaLista ? cidadeAtual : ""}
              onChange={(e) => void onCidadeChange(e.target.value)}
              disabled={!ufAtual || cidadesLoading || geoBusy}
            >
              <option value="">{ufAtual ? "Selecione a cidade" : "Escolha o estado primeiro"}</option>
              {!cidadeNaLista && cidadeAtual ? <option value={cidadeAtual}>{cidadeAtual}</option> : null}
              {cidades.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="CEP">
          <Input value={endereco.cep ?? ""} onChange={(e) => setEndereco({ ...endereco, cep: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Logradouro">
            <Input
              value={endereco.logradouro ?? ""}
              onChange={(e) => setEndereco({ ...endereco, logradouro: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Número">
          <Input value={endereco.numero ?? ""} onChange={(e) => setEndereco({ ...endereco, numero: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Complemento">
            <Input
              value={endereco.complemento ?? ""}
              onChange={(e) => setEndereco({ ...endereco, complemento: e.target.value })}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Bairro">
            <Input value={endereco.bairro ?? ""} onChange={(e) => setEndereco({ ...endereco, bairro: e.target.value })} />
          </Field>
        </div>
      </section>

      <section className="living-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <MapPin className="size-5" />
            </span>
            <div>
              <p className="font-semibold text-ink dark:text-white">Ponto no mapa</p>
              <p className="text-sm text-muted">
                {coords
                  ? `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
                  : "Selecione UF/cidade ou clique no mapa"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" busy={gpsBusy} busyLabel="Obtendo…" onClick={() => void usarGps()}>
              Usar localização do navegador
            </Button>
            <Button type="button" busy={salvar.isPending} busyLabel="Salvando…" onClick={() => void onSalvar()}>
              Salvar endereço e localização
            </Button>
          </div>
        </div>
        <div ref={mapEl} className="h-[28rem] w-full bg-zinc-100 dark:bg-zinc-900" />
      </section>
    </div>
  );
}
