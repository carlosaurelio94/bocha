package com.bocha.backoffice.domain.model;

import java.time.Instant;
import java.util.UUID;

/**
 * Modelo de dominio para un cliente.
 * Esta es la representación pura del negocio — sin anotaciones de JPA ni de JSON.
 * La capa de infraestructura (ClientEntity) se encarga de persistirlo.
 */
public record Client(
        UUID id,
        String name,
        String address,
        String rif,
        String phone,
        ClientStatus clientStatus,
        String createdBy,
        String updatedBy,
        Instant createdAt,
        Instant updatedAt,
        boolean deleted
) {
    /**
     * Crea un nuevo cliente con valores por defecto de auditoría.
     *
     * @param name         Nombre obligatorio
     * @param clientStatus Estado inicial (prospect o client)
     * @param createdBy    Identificador del dispositivo/usuario que lo crea
     */
    public static Client create(String name, String address, String rif, String phone,
                                ClientStatus clientStatus, String createdBy) {
        return new Client(
                UUID.randomUUID(),
                name, address, rif, phone,
                clientStatus,
                createdBy, null,
                Instant.now(), null,
                false
        );
    }

    /** Retorna una copia con soft-delete aplicado. */
    public Client delete(String updatedBy) {
        return new Client(id, name, address, rif, phone, clientStatus,
                createdBy, updatedBy, createdAt, Instant.now(), true);
    }
}
