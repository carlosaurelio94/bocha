package com.bocha.backoffice.domain.repository;

import com.bocha.backoffice.domain.model.Quote;
import com.bocha.backoffice.domain.model.QuoteStatus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Puerto de repositorio para presupuestos — capa de dominio. */
public interface QuoteRepository {

    List<Quote> findAll(int page, int size, String search, QuoteStatus status, UUID clientId);

    long count(String search, QuoteStatus status, UUID clientId);

    Optional<Quote> findById(UUID id);

    Quote save(Quote quote);

    void updateStatus(UUID id, QuoteStatus status, String updatedBy);

    void softDelete(UUID id, String updatedBy);

    int nextQuoteNumber();
}
