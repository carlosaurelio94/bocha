package com.bocha.backoffice.infrastructure.persistence.jpa;

import com.bocha.backoffice.infrastructure.persistence.entity.QuoteItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface QuoteItemJpaRepository extends JpaRepository<QuoteItemEntity, UUID> {

    List<QuoteItemEntity> findAllByQuoteIdAndDeletedFalse(UUID quoteId);
}
