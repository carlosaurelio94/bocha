package com.bocha.backoffice.infrastructure.persistence.adapter;

import com.bocha.backoffice.domain.model.QuoteInformation;
import com.bocha.backoffice.domain.repository.QuoteInformationRepository;
import com.bocha.backoffice.infrastructure.persistence.jpa.QuoteInformationJpaRepository;
import com.bocha.backoffice.infrastructure.persistence.mapper.QuoteInformationEntityMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class QuoteInformationRepositoryAdapter implements QuoteInformationRepository {

    private final QuoteInformationJpaRepository jpa;
    private final QuoteInformationEntityMapper  mapper;

    @Override
    public List<QuoteInformation> findAll() {
        return jpa.findAllByDeletedFalseOrderByNameAsc().stream().map(mapper::toDomain).toList();
    }

    @Override
    public Optional<QuoteInformation> findById(UUID id) {
        return jpa.findByIdAndDeletedFalse(id).map(mapper::toDomain);
    }

    @Override
    public QuoteInformation save(QuoteInformation info) {
        return mapper.toDomain(jpa.save(mapper.toEntity(info)));
    }

    @Override
    @Transactional
    public void softDelete(UUID id, String updatedBy) {
        jpa.findById(id).ifPresent(entity -> {
            entity.setDeleted(true);
            entity.setUpdatedBy(updatedBy);
            jpa.save(entity);
        });
    }
}
