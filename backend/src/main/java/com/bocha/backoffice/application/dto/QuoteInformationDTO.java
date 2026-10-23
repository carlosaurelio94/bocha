package com.bocha.backoffice.application.dto;

import lombok.Builder;
import java.time.Instant;
import java.util.UUID;

@Builder
public record QuoteInformationDTO(
        UUID    id,
        String  name,
        String  information,
        String  createdBy,
        Instant createdAt,
        Instant updatedAt
) {}
