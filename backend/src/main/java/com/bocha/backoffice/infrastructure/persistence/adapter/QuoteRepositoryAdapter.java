package com.bocha.backoffice.infrastructure.persistence.adapter;

import com.bocha.backoffice.domain.model.Quote;
import com.bocha.backoffice.domain.model.QuoteItem;
import com.bocha.backoffice.domain.model.QuoteStatus;
import com.bocha.backoffice.domain.repository.QuoteRepository;
import com.bocha.backoffice.infrastructure.persistence.entity.QuoteEntity;
import com.bocha.backoffice.infrastructure.persistence.entity.QuoteEntity.QuoteStatusJpa;
import com.bocha.backoffice.infrastructure.persistence.entity.QuoteItemEntity;
import com.bocha.backoffice.infrastructure.persistence.jpa.QuoteItemJpaRepository;
import com.bocha.backoffice.infrastructure.persistence.jpa.QuoteJpaRepository;
import com.bocha.backoffice.infrastructure.persistence.mapper.QuoteEntityMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class QuoteRepositoryAdapter implements QuoteRepository {

    private final QuoteJpaRepository     quoteJpa;
    private final QuoteItemJpaRepository itemJpa;
    private final QuoteEntityMapper      mapper;

    @Override
    public List<Quote> findAll(int page, int size, String search, QuoteStatus status, UUID clientId) {
        QuoteStatusJpa statusJpa = status != null ? QuoteStatusJpa.valueOf(status.name()) : null;
        return quoteJpa.findFiltered(statusJpa, clientId, PageRequest.of(page - 1, size))
                       .stream().map(mapper::toDomain).toList();
    }

    @Override
    public long count(String search, QuoteStatus status, UUID clientId) {
        QuoteStatusJpa statusJpa = status != null ? QuoteStatusJpa.valueOf(status.name()) : null;
        return quoteJpa.findFiltered(statusJpa, clientId, PageRequest.of(0, Integer.MAX_VALUE)).getTotalElements();
    }

    @Override
    public Optional<Quote> findById(UUID id) {
        return quoteJpa.findByIdAndDeletedFalse(id).map(entity -> {
            // Carga explícita de ítems para la vista de detalle
            List<QuoteItemEntity> items = itemJpa.findAllByQuoteIdAndDeletedFalse(entity.getId());
            entity.setItems(items);
            return mapper.toDomain(entity);
        });
    }

    @Override
    @Transactional
    public Quote save(Quote quote) {
        QuoteEntity saved = quoteJpa.save(mapper.toEntity(quote));

        // Persistir ítems en batch
        if (quote.items() != null && !quote.items().isEmpty()) {
            List<QuoteItemEntity> itemEntities = quote.items().stream()
                .map(item -> toItemEntity(item, saved.getId(), quote.clientId(), quote.informationId(), quote.createdBy()))
                .toList();
            itemJpa.saveAll(itemEntities);
        }

        return mapper.toDomain(saved);
    }

    @Override
    @Transactional
    public void updateStatus(UUID id, QuoteStatus status, String updatedBy) {
        quoteJpa.findById(id).ifPresent(entity -> {
            entity.setStatus(QuoteStatusJpa.valueOf(status.name()));
            entity.setUpdatedBy(updatedBy);
            quoteJpa.save(entity);
        });
    }

    @Override
    @Transactional
    public void softDelete(UUID id, String updatedBy) {
        quoteJpa.findById(id).ifPresent(entity -> {
            entity.setDeleted(true);
            entity.setUpdatedBy(updatedBy);
            quoteJpa.save(entity);
            // Soft-delete en cascada a los ítems
            itemJpa.findAllByQuoteIdAndDeletedFalse(id).forEach(item -> {
                item.setDeleted(true);
                item.setUpdatedBy(updatedBy);
            });
            itemJpa.saveAll(itemJpa.findAllByQuoteIdAndDeletedFalse(id));
        });
    }

    @Override
    public int nextQuoteNumber() {
        return quoteJpa.findMaxQuoteNumber() + 1;
    }

    // ─── helper ──────────────────────────────────────────────────────────────
    private QuoteItemEntity toItemEntity(QuoteItem item, UUID quoteId, UUID clientId, UUID informationId, String createdBy) {
        return QuoteItemEntity.builder()
                .id(item.id() != null ? item.id() : UUID.randomUUID())
                .quoteId(quoteId)
                .clientId(clientId)
                .informationId(informationId)
                .quantity(item.quantity())
                .product(item.product())
                .unitPrice(item.unitPrice())
                .totalPrice(item.totalPrice())
                .createdBy(createdBy)
                .deleted(false)
                .build();
    }
}
