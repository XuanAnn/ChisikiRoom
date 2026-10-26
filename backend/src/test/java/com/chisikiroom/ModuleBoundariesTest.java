package com.chisikiroom;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.*;
import org.junit.jupiter.api.Test;

class ModuleBoundariesTest {

    @Test
    void applicationDoesNotDependOnRestAdaptersAndDomainStaysFrameworkFree() throws Exception {
        try (var files = Files.walk(Path.of("src/main/java/com/chisikiroom"))) {
            for (var file : files.filter(p -> p.toString().endsWith(".java")).toList()) {
                String path = file.toString().replace('\\', '/');
                String source = Files.readString(file);
                assertFalse(source.contains("JdbcClient"), file + " bypasses ORM with JDBC");
                assertFalse(
                    source.contains("createNativeQuery"),
                    file + " uses raw SQL instead of entity queries"
                );
                if (path.contains("/presentation/")) {
                    assertFalse(
                        source.contains(".infrastructure."),
                        file + " bypasses its application service"
                    );
                    assertFalse(
                        source.contains("jakarta.persistence"),
                        file + " accesses JPA directly"
                    );
                    assertFalse(
                        source.contains("TransactionTemplate"),
                        file + " owns a database transaction"
                    );
                    assertFalse(
                        source.contains("java.nio.file.Files"),
                        file + " accesses file storage directly"
                    );
                }
                if (path.contains("/application/")) {
                    assertFalse(
                        source.contains("JpaStore"),
                        file + " bypasses its feature repository"
                    );
                    assertFalse(
                        source.contains("jakarta.persistence"),
                        file + " accesses EntityManager directly"
                    );
                    assertFalse(
                        source.contains("org.springframework.web.multipart"),
                        file + " accepts HTTP uploads directly"
                    );
                    assertFalse(
                        source.contains("org.springframework.security.core.Authentication"),
                        file + " accepts HTTP authentication context"
                    );
                    assertFalse(
                        source.contains(".presentation."),
                        file + " depends on a REST adapter"
                    );
                    assertFalse(
                        source.contains("org.springframework.web.bind.annotation"),
                        file + " imports HTTP mappings"
                    );
                }
                if (path.contains("/domain/")) {
                    assertFalse(
                        source.contains("import org.springframework"),
                        file + " domain depends on Spring"
                    );
                    assertFalse(
                        source.contains("import java.sql"),
                        file + " domain depends on JDBC"
                    );
                }
            }
        }
    }
}
