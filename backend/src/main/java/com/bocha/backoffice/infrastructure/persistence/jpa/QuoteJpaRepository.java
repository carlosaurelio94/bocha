package com.bocha.backoffice.infrastructure.persistence.jpa;

import com.bocha.backoffice.infrastructure.persistence.entity.QuoteEntity;
import com.bocha.backoffice.infrastructure.persistence.entity.QuoteEntity.QuoteStatusJpa;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface QuoteJpaRepository extends JpaRepository<QuoteEntity, UUID> {

    @Query("""
        SELECT q FROM QuoteEntity q
        WHERE q.deleted = false
          AND (:status   IS NULL OR q.status   = :status)
          AND (:clientId IS NULL OR q.clientId = :clientId)
        ORDER BY q.quoteDate DESC
        """)
    Page<QuoteEntity> findFiltered(
            @Param("status")   QuoteStatusJpa status,
            @Param("clientId") UUID clientId,
            Pageable pageable
    );

    Optional<QuoteEntity> findByIdAndDeletedFalse(UUID id);

    /** Para obtener el siguiente número de presupuesto. */
    @Query("SELECT COALESCE(MAX(q.quoteNumber), 0) FROM QuoteEntity q")
    int findMaxQuoteNumber();
}
