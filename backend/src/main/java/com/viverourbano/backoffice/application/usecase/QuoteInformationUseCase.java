package com.viverourbano.backoffice.application.usecase;

import com.viverourbano.backoffice.application.dto.CreateQuoteInformationRequest;
import com.viverourbano.backoffice.application.dto.QuoteInformationDTO;
import com.viverourbano.backoffice.application.mapper.QuoteInformationMapper;
import com.viverourbano.backoffice.domain.model.QuoteInformation;
import com.viverourbano.backoffice.domain.repository.QuoteInformationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class QuoteInformationUseCase {

    private final QuoteInformationRepository repository;
    private final QuoteInformationMapper     mapper;

    public List<QuoteInformationDTO> list() {
        return repository.findAll().stream().map(mapper::toDto).toList();
    }

    public QuoteInformationDTO create(CreateQuoteInformationRequest req, String deviceId) {
        QuoteInformation info = new QuoteInformation(
                UUID.randomUUID(), req.name(), req.information(),
                deviceId, null, Instant.now(), null, false
        );
        return mapper.toDto(repository.save(info));
    }

    public QuoteInformationDTO update(UUID id, CreateQuoteInformationRequest req, String deviceId) {
        QuoteInformation existing = findActive(id);
        QuoteInformation updated = new QuoteInformation(
                existing.id(),
                req.name() != null ? req.name() : existing.name(),
                req.information() != null ? req.information() : existing.information(),
                existing.createdBy(), deviceId,
                existing.createdAt(), Instant.now(),
                false
        );
        return mapper.toDto(repository.save(updated));
    }

    public void delete(UUID id, String deviceId) {
        findActive(id);
        repository.softDelete(id, deviceId);
    }

    /** Un preset con soft-delete se trata como inexistente (evita "resucitarlo" al editar). */
    private QuoteInformation findActive(UUID id) {
        return repository.findById(id)
                .filter(i -> !i.deleted())
                .orElseThrow(() -> new NoSuchElementException("Preset no encontrado: " + id));
    }
}
