package com.bocha.backoffice.infrastructure.persistence.jpa;

import com.bocha.backoffice.infrastructure.persistence.entity.QuoteInformationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface QuoteInformationJpaRepository extends JpaRepository<QuoteInformationEntity, UUID> {

    List<QuoteInformationEntity> findAllByDeletedFalseOrderByNameAsc();

    Optional<QuoteInformationEntity> findByIdAndDeletedFalse(UUID id);
}
