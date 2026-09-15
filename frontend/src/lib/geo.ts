export type BrowserCoords = { latitude: number; longitude: number };

export type EnderecoSugerido = {
  latitude: number;
  longitude: number;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  descricao: string | null;
};

export function readBrowserPosition(): Promise<BrowserCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este navegador não informa a localização."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("Permita o acesso à localização no navegador para preencher o endereço."));
          return;
        }
        if (error.code === error.TIMEOUT) {
          reject(new Error("A localização demorou demais. Tente de novo."));
          return;
        }
        reject(new Error("Não foi possível obter a localização deste aparelho."));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });
}
