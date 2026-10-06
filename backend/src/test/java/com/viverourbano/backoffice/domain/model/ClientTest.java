package com.viverourbano.backoffice.domain.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class ClientTest {

    @Test
    @DisplayName("create() genera id, fecha de alta y auditoría inicial")
    void createSetsDefaults() {
        Instant before = Instant.now();

        Client client = Client.create("Ana", "Caracas", "J-1", "0412", ClientStatus.PROSPECT, "device-a");

        assertThat(client.id()).isNotNull();
        assertThat(client.name()).isEqualTo("Ana");
        assertThat(client.clientStatus()).isEqualTo(ClientStatus.PROSPECT);
        assertThat(client.createdBy()).isEqualTo("device-a");
        assertThat(client.createdAt()).isBetween(before, Instant.now());
        assertThat(client.updatedBy()).isNull();
        assertThat(client.updatedAt()).isNull();
        assertThat(client.deleted()).isFalse();
    }

    @Test
    @DisplayName("create() genera ids distintos en cada llamada")
    void createGeneratesUniqueIds() {
        Client a = Client.create("A", null, null, null, ClientStatus.CLIENT, "d");
        Client b = Client.create("A", null, null, null, ClientStatus.CLIENT, "d");
        assertThat(a.id()).isNotEqualTo(b.id());
    }

    @Test
    @DisplayName("delete() devuelve una copia marcada como borrada y no muta el original")
    void deleteIsImmutableSoftDelete() {
        Client original = Client.create("Ana", null, null, null, ClientStatus.CLIENT, "device-a");

        Client deleted = original.delete("device-b");

        assertThat(deleted.deleted()).isTrue();
        assertThat(deleted.updatedBy()).isEqualTo("device-b");
        assertThat(deleted.updatedAt()).isNotNull();
        assertThat(deleted.id()).isEqualTo(original.id());
        assertThat(deleted.createdBy()).isEqualTo("device-a");
        assertThat(original.deleted()).isFalse();
    }
}
