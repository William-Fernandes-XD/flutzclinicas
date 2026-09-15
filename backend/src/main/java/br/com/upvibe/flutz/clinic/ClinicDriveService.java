package br.com.upvibe.flutz.clinic;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.util.Collections;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.google.api.client.googleapis.json.GoogleJsonError;
import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.ByteArrayContent;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.DriveScopes;
import com.google.api.services.drive.model.File;
import com.google.api.services.drive.model.FileList;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.ServiceAccountCredentials;

import jakarta.annotation.PostConstruct;

@Service
public class ClinicDriveService {

    private static final Logger log = LoggerFactory.getLogger(ClinicDriveService.class);
    private static final String PASTA_DRIVE = "application/vnd.google-apps.folder";

    private final boolean requested;
    private final String folderId;
    private final Path credentialsPath;
    private Drive drive;
    private String serviceAccountEmail = "";

    public ClinicDriveService(
            @Value("${flutz.drive.enabled:false}") boolean enabled,
            @Value("${flutz.drive.folder-id:}") String folderId,
            @Value("${flutz.drive.credentials:}") String credentials
    ) {
        this.requested = enabled;
        this.folderId = parseFolderId(folderId);
        this.credentialsPath = resolveCredentials(credentials);
    }

    public boolean requested() {
        return requested;
    }

    public boolean enabled() {
        return requested && drive != null && !folderId.isBlank();
    }

    @PostConstruct
    void conectar() {
        if (!requested) {
            log.info("Google Drive desligado. Imagens ficam no disco local.");
            return;
        }
        if (folderId.isBlank()) {
            log.warn("GOOGLE_DRIVE_FOLDER_ID vazio. Cole só o ID da pasta, sem o link.");
            return;
        }
        if (credentialsPath == null) {
            log.warn("JSON da conta de serviço não encontrado. Esperado em backend/secrets/google-drive-service-account.json");
            return;
        }
        try (InputStream in = Files.newInputStream(credentialsPath)) {
            ServiceAccountCredentials credentials = (ServiceAccountCredentials) ServiceAccountCredentials.fromStream(in)
                    .createScoped(List.of(DriveScopes.DRIVE));
            serviceAccountEmail = credentials.getClientEmail() == null ? "" : credentials.getClientEmail();
            drive = new Drive.Builder(
                    GoogleNetHttpTransport.newTrustedTransport(),
                    GsonFactory.getDefaultInstance(),
                    new HttpCredentialsAdapter(credentials)
            ).setApplicationName("Flutz").build();
            String nome = nomeDaPasta();
            log.info("Google Drive conectado. Pasta: {}", nome);
        } catch (IOException | GeneralSecurityException ex) {
            drive = null;
            log.warn(
                    "Não foi possível abrir a unidade do Drive. Adicione {} como gerenciador de conteúdo. {}",
                    contaServico(),
                    ex.getMessage()
            );
        }
    }

    public void gravar(Integer empresaId, String nome, MultipartFile arquivo) {
        exigir();
        try {
            String pastaEmpresa = pastaEmpresa(empresaId);
            String mime = arquivo.getContentType() == null ? "application/octet-stream" : arquivo.getContentType();
            ByteArrayContent content = new ByteArrayContent(mime, arquivo.getBytes());
            File existente = buscar(pastaEmpresa, nome);
            if (existente != null) {
                drive.files().update(existente.getId(), new File(), content)
                        .setSupportsAllDrives(true)
                        .execute();
                return;
            }
            File meta = new File();
            meta.setName(nome);
            meta.setParents(Collections.singletonList(pastaEmpresa));
            drive.files().create(meta, content)
                    .setFields("id")
                    .setSupportsAllDrives(true)
                    .execute();
        } catch (GoogleJsonResponseException ex) {
            log.warn("Drive recusou o upload: {} {}", ex.getStatusCode(), detalhe(ex));
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, mensagemUsuario(ex));
        } catch (IOException ex) {
            log.warn("Falha ao enviar imagem ao Drive: {}", ex.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Não foi possível enviar a imagem ao Google Drive");
        }
    }

    public ClinicMediaService.RecursoPublico carregar(Integer empresaId, String nome, MediaType media) {
        if (!enabled()) {
            return null;
        }
        try {
            String pastaEmpresa = pastaEmpresa(empresaId);
            File arquivo = buscar(pastaEmpresa, nome);
            if (arquivo == null) {
                return null;
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            drive.files().get(arquivo.getId())
                    .setSupportsAllDrives(true)
                    .executeMediaAndDownloadTo(out);
            return new ClinicMediaService.RecursoPublico(new ByteArrayResource(out.toByteArray()), media);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Arquivo não encontrado");
        }
    }

    private void exigir() {
        if (!enabled()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Google Drive ainda não está acessível. Confira o JSON, o ID da unidade compartilhada e se "
                            + contaServico()
                            + " é membro dela."
            );
        }
    }

    private String pastaEmpresa(Integer empresaId) throws IOException {
        String nome = "empresa-" + empresaId;
        File existente = buscar(folderId, nome);
        if (existente != null) {
            return existente.getId();
        }
        File meta = new File();
        meta.setName(nome);
        meta.setMimeType(PASTA_DRIVE);
        meta.setParents(Collections.singletonList(folderId));
        return drive.files().create(meta)
                .setFields("id")
                .setSupportsAllDrives(true)
                .execute()
                .getId();
    }

    private String nomeDaPasta() throws IOException {
        try {
            File pasta = drive.files().get(folderId)
                    .setFields("id,name")
                    .setSupportsAllDrives(true)
                    .execute();
            return pasta.getName();
        } catch (GoogleJsonResponseException ex) {
            if (ex.getStatusCode() != 404 && ex.getStatusCode() != 403) {
                throw ex;
            }
            return drive.drives().get(folderId).setFields("id,name").execute().getName();
        }
    }

    private File buscar(String pasta, String nome) throws IOException {
        String seguro = nome.replace("'", "\\'");
        FileList lista = drive.files().list()
                .setQ("name = '" + seguro + "' and '" + pasta + "' in parents and trashed = false")
                .setFields("files(id,name)")
                .setPageSize(1)
                .setSupportsAllDrives(true)
                .setIncludeItemsFromAllDrives(true)
                .execute();
        List<File> files = lista.getFiles();
        return files == null || files.isEmpty() ? null : files.get(0);
    }

    static String parseFolderId(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String value = raw.trim();
        int folders = value.indexOf("/folders/");
        if (folders >= 0) {
            String rest = value.substring(folders + "/folders/".length());
            int cut = rest.indexOf('?');
            return cut >= 0 ? rest.substring(0, cut) : rest;
        }
        return value;
    }

    private static Path resolveCredentials(String configured) {
        Path cwd = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        List<Path> candidatos = new java.util.ArrayList<>();
        if (configured != null && !configured.isBlank()) {
            candidatos.add(Path.of(configured));
            candidatos.add(cwd.resolve(configured));
            if (cwd.getParent() != null) {
                candidatos.add(cwd.getParent().resolve(configured));
            }
        }
        candidatos.add(cwd.resolve("secrets/google-drive-service-account.json"));
        candidatos.add(cwd.resolve("backend/secrets/google-drive-service-account.json"));
        if (cwd.getParent() != null) {
            candidatos.add(cwd.getParent().resolve("backend/secrets/google-drive-service-account.json"));
        }
        for (Path path : candidatos) {
            if (Files.isRegularFile(path)) {
                return path.toAbsolutePath().normalize();
            }
        }
        return null;
    }

    private String contaServico() {
        return serviceAccountEmail.isBlank() ? "o e-mail client_email do JSON" : serviceAccountEmail;
    }

    private static String detalhe(GoogleJsonResponseException ex) {
        GoogleJsonError details = ex.getDetails();
        if (details == null) {
            return ex.getMessage();
        }
        if (details.getErrors() != null && !details.getErrors().isEmpty()) {
            GoogleJsonError.ErrorInfo info = details.getErrors().get(0);
            return info.getReason() + ": " + info.getMessage();
        }
        return details.getMessage();
    }

    private String mensagemUsuario(GoogleJsonResponseException ex) {
        String detalhe = detalhe(ex);
        String lower = detalhe == null ? "" : detalhe.toLowerCase();
        if (lower.contains("storagequotaexceeded") || lower.contains("storage quota")) {
            return "A conta de serviço não tem espaço no Drive pessoal. Use uma unidade compartilhada e adicione "
                    + contaServico()
                    + " como gerenciador de conteúdo.";
        }
        if (lower.contains("notfound") || ex.getStatusCode() == 404) {
            return "A unidade do Drive não foi encontrada ou a conta de serviço não tem acesso. Adicione "
                    + contaServico()
                    + " como membro da unidade compartilhada.";
        }
        if (lower.contains("insufficient") || lower.contains("forbidden") || ex.getStatusCode() == 403) {
            return "A conta de serviço não tem permissão para gravar nesta unidade. Adicione "
                    + contaServico()
                    + " como gerenciador de conteúdo.";
        }
        return "Não foi possível enviar a imagem ao Google Drive. " + detalhe;
    }
}
