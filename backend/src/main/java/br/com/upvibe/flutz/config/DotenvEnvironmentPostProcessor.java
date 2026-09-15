package br.com.upvibe.flutz.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

public class DotenvEnvironmentPostProcessor implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Path cwd = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        for (Path file : List.of(cwd.resolve(".env"), cwd.resolve("../.env").normalize())) {
            if (!Files.isRegularFile(file)) {
                continue;
            }
            Map<String, Object> values = ler(file);
            if (!values.isEmpty()) {
                environment.getPropertySources().addLast(new MapPropertySource("flutz-dotenv", values));
            }
            break;
        }
    }

    private static Map<String, Object> ler(Path file) {
        Map<String, Object> values = new LinkedHashMap<>();
        try {
            for (String line : Files.readAllLines(file)) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#") || !trimmed.contains("=")) {
                    continue;
                }
                int eq = trimmed.indexOf('=');
                String key = trimmed.substring(0, eq).trim();
                String value = trimmed.substring(eq + 1).trim();
                if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.substring(1, value.length() - 1);
                }
                values.put(key, value);
            }
        } catch (IOException ignored) {
            /* .env opcional */
        }
        return values;
    }
}
