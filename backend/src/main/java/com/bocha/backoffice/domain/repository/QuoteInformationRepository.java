package com.bocha.backoffice.domain.repository;

import com.bocha.backoffice.domain.model.QuoteInformation;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Puerto de repositorio para presets de texto informativo. */
public interface QuoteInformationRepository {

    List<QuoteInformation> findAll();

    Optional<QuoteInformation> findById(UUID id);

    QuoteInformation save(QuoteInformation info);

    void softDelete(UUID id, String updatedBy);
}
