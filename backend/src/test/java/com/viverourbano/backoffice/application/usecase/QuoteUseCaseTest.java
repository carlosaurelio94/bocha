package com.viverourbano.backoffice.application.usecase;

import com.viverourbano.backoffice.application.dto.CreateQuoteRequest;
import com.viverourbano.backoffice.application.dto.PagedResponse;
import com.viverourbano.backoffice.application.dto.QuoteDTO;
import com.viverourbano.backoffice.application.mapper.QuoteMapperImpl;
import com.viverourbano.backoffice.domain.model.Quote;
import com.viverourbano.backoffice.domain.model.QuoteItem;
import com.viverourbano.backoffice.domain.model.QuoteStatus;
import com.viverourbano.backoffice.domain.repository.QuoteRepository;
import com.viverourbano.backoffice.support.TestData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
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
class QuoteUseCaseTest {

    @Mock
    private QuoteRepository repository;

    private QuoteUseCase useCase;

    private final UUID id = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        useCase = new QuoteUseCase(repository, new QuoteMapperImpl());
    }

    @Test
    @DisplayName("list delega filtros (sin búsqueda de texto) y pagina")
    void listDelegates() {
        UUID clientId = UUID.randomUUID();
        when(repository.findAll(1, 20, null, QuoteStatus.SENT, clientId))
                .thenReturn(List.of(TestData.quote(id, QuoteStatus.SENT, false)));
        when(repository.count(null, QuoteStatus.SENT, clientId)).thenReturn(1L);

        PagedResponse<QuoteDTO> res = useCase.list(1, 20, QuoteStatus.SENT, clientId);

        assertThat(res.data()).hasSize(1);
        assertThat(res.totalPages()).isEqualTo(1);
    }

    @Test
    void getByIdReturnsItems() {
        when(repository.findById(id)).thenReturn(Optional.of(TestData.quote(id, QuoteStatus.DRAFT, false)));
        assertThat(useCase.getById(id).items()).hasSize(2);
    }

    @Test
    void getByIdIgnoresDeleted() {
        when(repository.findById(id)).thenReturn(Optional.of(TestData.quote(id, QuoteStatus.DRAFT, true)));
        assertThatThrownBy(() -> useCase.getById(id)).isInstanceOf(NoSuchElementException.class);
    }

    @Test
    void nextQuoteNumberComesFromRepository() {
        when(repository.nextQuoteNumber()).thenReturn(43);
        assertThat(useCase.nextQuoteNumber()).isEqualTo(43);
    }

    @Nested
    class Create {
        @Test
        @DisplayName("arma cabecera e ítems con cliente, texto informativo y auditoría")
        void buildsQuoteWithItems() {
            when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            CreateQuoteRequest req = TestData.createQuoteRequest(UUID.randomUUID());

            QuoteDTO dto = useCase.create(req, "device-q");

            ArgumentCaptor<Quote> saved = ArgumentCaptor.forClass(Quote.class);
            verify(repository).save(saved.capture());
            Quote q = saved.getValue();
            assertThat(q.id()).isNotNull();
            assertThat(q.clientId()).isEqualTo(req.clientId());
            assertThat(q.quoteNumber()).isEqualTo(42);
            assertThat(q.status()).isEqualTo(QuoteStatus.DRAFT);
            assertThat(q.createdBy()).isEqualTo("device-q");
            assertThat(q.deleted()).isFalse();

            assertThat(q.items()).hasSize(2)
                    .allSatisfy(i -> {
                        assertThat(i.clientId()).isEqualTo(req.clientId());
                        assertThat(i.createdBy()).isEqualTo("device-q");
                        assertThat(i.deleted()).isFalse();
                    });
            assertThat(q.items()).extracting(QuoteItem::product).containsExactly("Ficus", "Palma");
            assertThat(q.items()).extracting(QuoteItem::id).doesNotHaveDuplicates();

            assertThat(dto.items()).hasSize(2);
        }
    }

    @Nested
    class UpdateStatus {
        @Test
        void updates() {
            when(repository.findById(id)).thenReturn(Optional.of(TestData.quote(id, QuoteStatus.DRAFT, false)));
            useCase.updateStatus(id, QuoteStatus.APPROVED, "device-s");
            verify(repository).updateStatus(id, QuoteStatus.APPROVED, "device-s");
        }

        @Test
        void notFound() {
            when(repository.findById(id)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> useCase.updateStatus(id, QuoteStatus.SENT, "d"))
                    .isInstanceOf(NoSuchElementException.class);
            verify(repository, never()).updateStatus(any(), any(), anyString());
        }

        @Test
        @DisplayName("no cambia el estado de un presupuesto borrado")
        void ignoresDeleted() {
            when(repository.findById(id)).thenReturn(Optional.of(TestData.quote(id, QuoteStatus.DRAFT, true)));
            assertThatThrownBy(() -> useCase.updateStatus(id, QuoteStatus.SENT, "d"))
                    .isInstanceOf(NoSuchElementException.class);
            verify(repository, never()).updateStatus(any(), any(), anyString());
        }
    }

    @Nested
    class Delete {
        @Test
        void softDeletes() {
            when(repository.findById(id)).thenReturn(Optional.of(TestData.quote(id, QuoteStatus.DRAFT, false)));
            useCase.delete(id, "device-d");
            verify(repository).softDelete(id, "device-d");
        }

        @Test
        void notFound() {
            when(repository.findById(id)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> useCase.delete(id, "d")).isInstanceOf(NoSuchElementException.class);
            verify(repository, never()).softDelete(any(), anyString());
        }
    }
}
