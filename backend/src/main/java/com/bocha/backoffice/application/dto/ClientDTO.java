package com.bocha.backoffice.application.dto;

import com.bocha.backoffice.domain.model.ClientStatus;
import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

/**
 * DTO de respuesta para un cliente.
 * Se usa para serializar la respuesta de la API — nunca expone la entidad JPA directamente.
 */
@Builder
public record ClientDTO(
        UUID id,
        String name,
        String address,
        String rif,
        String phone,
        ClientStatus clientStatus,
        String createdBy,
        Instant createdAt,
        Instant updatedAt
) {}
