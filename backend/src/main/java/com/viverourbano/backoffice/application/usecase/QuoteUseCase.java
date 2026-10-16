package com.viverourbano.backoffice.application.usecase;

import com.viverourbano.backoffice.application.dto.*;
import com.viverourbano.backoffice.application.mapper.QuoteMapper;
import com.viverourbano.backoffice.domain.model.*;
import com.viverourbano.backoffice.domain.repository.QuoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class QuoteUseCase {

    private final QuoteRepository quoteRepository;
    private final QuoteMapper     quoteMapper;

    public PagedResponse<QuoteDTO> list(int page, int size, QuoteStatus status, UUID clientId) {
        List<Quote> quotes = quoteRepository.findAll(page, size, null, status, clientId);
        long total = quoteRepository.count(null, status, clientId);
        return PagedResponse.of(quotes.stream().map(quoteMapper::toDto).toList(), total, page, size);
    }

    public QuoteDTO getById(UUID id) {
        return quoteMapper.toDto(findActive(id));
    }

    public int nextQuoteNumber() {
        return quoteRepository.nextQuoteNumber();
    }

    public QuoteDTO create(CreateQuoteRequest req, String deviceId) {
        List<QuoteItem> items = req.items().stream()
                .map(i -> new QuoteItem(
                        UUID.randomUUID(), null, req.clientId(), req.informationId(),
                        i.quantity(), i.product(), i.unitPrice(), i.totalPrice(),
                        deviceId, null, Instant.now(), null, false
                )).toList();

        Quote quote = new Quote(
                UUID.randomUUID(),
                req.clientId(),
                req.informationId(),
                req.quoteNumber(),
                req.quoteDate(),
                req.totalAmount(),
                req.itemCount(),
                req.currency(),
                req.status(),
                deviceId, null,
                Instant.now(), null,
                false,
                items
        );

        return quoteMapper.toDto(quoteRepository.save(quote));
    }

    public void updateStatus(UUID id, QuoteStatus status, String deviceId) {
        findActive(id);
        quoteRepository.updateStatus(id, status, deviceId);
    }

    public void delete(UUID id, String deviceId) {
        findActive(id);
        quoteRepository.softDelete(id, deviceId);
    }

    /** Un presupuesto con soft-delete se trata como inexistente. */
    private Quote findActive(UUID id) {
        return quoteRepository.findById(id)
                .filter(q -> !q.deleted())
                .orElseThrow(() -> new NoSuchElementException("Presupuesto no encontrado: " + id));
    }
}
