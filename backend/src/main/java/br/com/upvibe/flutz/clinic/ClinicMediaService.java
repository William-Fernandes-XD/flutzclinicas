package br.com.upvibe.flutz.clinic;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ClinicMediaService {

    private static final Set<String> DESTINOS = Set.of("logo", "hero", "galeria", "perfil");
    private static final Map<String, String> EXTENSOES = Map.of(
            "image/jpeg", "jpg",
            "image/jpg", "jpg",
            "image/png", "png",
            "image/webp", "webp"
    );

    private final Path root;
    private final ClinicDriveService drive;

    public ClinicMediaService(
            @Value("${flutz.media.dir:uploads}") String dir,
            ClinicDriveService drive
    ) {
        this.root = Path.of(dir).toAbsolutePath().normalize();
        this.drive = drive;
    }

    public ArquivoSalvo gravar(Integer empresaId, String destino, MultipartFile arquivo) {
        if (arquivo == null || arquivo.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Envie um arquivo de imagem");
        }
        if (arquivo.getSize() > 5_000_000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A imagem deve ter no máximo 5 MB");
        }
        String tipo = destino == null ? "" : destino.toLowerCase(Locale.ROOT);
        if (!DESTINOS.contains(tipo)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Destino inválido");
        }
        String ext = extensao(arquivo);
        if (ext == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use PNG, JPG ou WEBP");
        }
        String nome = "logo".equals(tipo) || "hero".equals(tipo)
                ? tipo + "." + ext
                : tipo + "-" + UUID.randomUUID() + "." + ext;
        if (drive.requested() && drive.enabled()) {
            try {
                drive.gravar(empresaId, nome, arquivo);
                return new ArquivoSalvo("/api/public/arquivos/" + empresaId + "/" + nome, tipo, nome);
            } catch (ResponseStatusException ex) {
                // Drive configurado mas indisponível: grava local para não perder a foto do usuário.
                org.slf4j.LoggerFactory.getLogger(ClinicMediaService.class)
                        .warn("Drive falhou ({}). Salvando imagem localmente.", ex.getReason());
            }
        } else if (drive.requested() && !drive.enabled()) {
            org.slf4j.LoggerFactory.getLogger(ClinicMediaService.class)
                    .warn("GOOGLE_DRIVE_ENABLED=true, mas Drive não está pronto. Salvando no disco.");
        }
        Path pasta = pasta(empresaId);
        try {
            Files.createDirectories(pasta);
            Path destinoArquivo = pasta.resolve(nome).normalize();
            if (!destinoArquivo.startsWith(pasta)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome de arquivo inválido");
            }
            // MultipartFile.transferTo pode falhar se o stream já foi lido (ex.: tentativa no Drive).
            Files.write(destinoArquivo, arquivo.getBytes());
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Não foi possível gravar a imagem");
        }
        return new ArquivoSalvo("/api/public/arquivos/" + empresaId + "/" + nome, tipo, nome);
    }

    public RecursoPublico carregar(Integer empresaId, String nome) {
        if (empresaId == null || nome == null || !nome.matches("[a-zA-Z0-9._-]+")) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Arquivo não encontrado");
        }
        String lower = nome.toLowerCase(Locale.ROOT);
        MediaType media = lower.endsWith(".png")
                ? MediaType.IMAGE_PNG
                : lower.endsWith(".webp")
                        ? MediaType.parseMediaType("image/webp")
                        : MediaType.IMAGE_JPEG;
        ClinicMediaService.RecursoPublico remoto = drive.carregar(empresaId, nome, media);
        if (remoto != null) {
            return remoto;
        }
        Path arquivo = pasta(empresaId).resolve(nome).normalize();
        if (!arquivo.startsWith(pasta(empresaId)) || !Files.isRegularFile(arquivo)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Arquivo não encontrado");
        }
        return new RecursoPublico(new FileSystemResource(arquivo), media);
    }

    private static String extensao(MultipartFile arquivo) {
        String tipo = arquivo.getContentType() == null ? "" : arquivo.getContentType().toLowerCase(Locale.ROOT);
        String peloTipo = EXTENSOES.get(tipo);
        if (peloTipo != null) {
            return peloTipo;
        }
        String nome = arquivo.getOriginalFilename() == null ? "" : arquivo.getOriginalFilename().toLowerCase(Locale.ROOT);
        if (nome.endsWith(".png")) return "png";
        if (nome.endsWith(".webp")) return "webp";
        if (nome.endsWith(".jpg") || nome.endsWith(".jpeg")) return "jpg";
        return null;
    }

    private Path pasta(Integer empresaId) {
        return root.resolve("empresa-" + empresaId).normalize();
    }

    public record ArquivoSalvo(String url, String destino, String nome) {
    }

    public record RecursoPublico(Resource resource, MediaType mediaType) {
    }
}
