package com.viverourbano.backoffice.application.usecase;

import com.viverourbano.backoffice.application.dto.CreateQuoteInformationRequest;
import com.viverourbano.backoffice.application.dto.QuoteInformationDTO;
import com.viverourbano.backoffice.application.mapper.QuoteInformationMapperImpl;
import com.viverourbano.backoffice.domain.model.QuoteInformation;
import com.viverourbano.backoffice.domain.repository.QuoteInformationRepository;
import com.viverourbano.backoffice.support.TestData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QuoteInformationUseCaseTest {

    @Mock
    private QuoteInformationRepository repository;

    private QuoteInformationUseCase useCase;

    private final UUID id = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        useCase = new QuoteInformationUseCase(repository, new QuoteInformationMapperImpl());
    }

    @Test
    void listsAll() {
        when(repository.findAll()).thenReturn(List.of(TestData.info(id, false)));
        assertThat(useCase.list()).extracting(QuoteInformationDTO::name).containsExactly("Default");
    }

    @Test
    void createsWithAudit() {
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        useCase.create(new CreateQuoteInformationRequest("Euro BCV", "Pago en euros"), "device-i");

        ArgumentCaptor<QuoteInformation> saved = ArgumentCaptor.forClass(QuoteInformation.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().id()).isNotNull();
        assertThat(saved.getValue().createdBy()).isEqualTo("device-i");
        assertThat(saved.getValue().deleted()).isFalse();
    }

    @Test
    void updatesKeepingCreationAudit() {
        QuoteInformation existing = TestData.info(id, false);
        when(repository.findById(id)).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        QuoteInformationDTO dto = useCase.update(id, new CreateQuoteInformationRequest("Nuevo", "Texto"), "device-u");

        assertThat(dto.name()).isEqualTo("Nuevo");
        ArgumentCaptor<QuoteInformation> saved = ArgumentCaptor.forClass(QuoteInformation.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().createdBy()).isEqualTo(existing.createdBy());
        assertThat(saved.getValue().updatedBy()).isEqualTo("device-u");
    }

    @Test
    @DisplayName("no permite editar (ni 'resucitar') un preset borrado")
    void doesNotResurrectDeleted() {
        when(repository.findById(id)).thenReturn(Optional.of(TestData.info(id, true)));
        assertThatThrownBy(() -> useCase.update(id, new CreateQuoteInformationRequest("x", "y"), "d"))
                .isInstanceOf(NoSuchElementException.class);
        verify(repository, never()).save(any());
    }

    @Test
    void deleteSoftDeletes() {
        when(repository.findById(id)).thenReturn(Optional.of(TestData.info(id, false)));
        useCase.delete(id, "device-d");
        verify(repository).softDelete(id, "device-d");
    }

    @Test
    void deleteNotFound() {
        when(repository.findById(id)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> useCase.delete(id, "d")).isInstanceOf(NoSuchElementException.class);
        verify(repository, never()).softDelete(any(), anyString());
    }
}
