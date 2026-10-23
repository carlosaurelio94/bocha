package com.bocha.backoffice.domain.model;

import java.time.Instant;
import java.util.UUID;

/**
 * Preset de texto informativo que aparece al pie del presupuesto.
 * Ejemplos: "Default" (texto estándar), "Euro BCV" (pago en euros a tasa BCV).
 */
public record QuoteInformation(
        UUID id,
        String name,
        String information,
        String createdBy,
        String updatedBy,
        Instant createdAt,
        Instant updatedAt,
        boolean deleted
) {}
