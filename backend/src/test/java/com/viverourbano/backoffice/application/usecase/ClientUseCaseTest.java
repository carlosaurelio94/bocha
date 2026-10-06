package com.viverourbano.backoffice.application.usecase;

import com.viverourbano.backoffice.application.dto.ClientDTO;
import com.viverourbano.backoffice.application.dto.CreateClientRequest;
import com.viverourbano.backoffice.application.dto.PagedResponse;
import com.viverourbano.backoffice.application.dto.UpdateClientRequest;
import com.viverourbano.backoffice.application.mapper.ClientMapperImpl;
import com.viverourbano.backoffice.domain.model.Client;
import com.viverourbano.backoffice.domain.model.ClientStatus;
import com.viverourbano.backoffice.domain.repository.ClientRepository;
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
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClientUseCaseTest {

    @Mock
    private ClientRepository repository;

    private ClientUseCase useCase;

    private final UUID id = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        // Mapper real (generado por MapStruct): así el test cubre también el mapeo.
        useCase = new ClientUseCase(repository, new ClientMapperImpl());
    }

    @Nested
    class ListClients {
        @Test
        @DisplayName("delega filtros al repositorio y arma la paginación")
        void delegatesFiltersAndPaginates() {
            when(repository.findAll(2, 10, "ana", ClientStatus.CLIENT)).thenReturn(List.of(TestData.client(id)));
            when(repository.count("ana", ClientStatus.CLIENT)).thenReturn(11L);

            PagedResponse<ClientDTO> res = useCase.listClients(2, 10, "ana", ClientStatus.CLIENT);

            assertThat(res.data()).extracting(ClientDTO::id).containsExactly(id);
            assertThat(res.total()).isEqualTo(11);
            assertThat(res.totalPages()).isEqualTo(2);
        }
    }

    @Nested
    class GetById {
        @Test
        void returnsClient() {
            when(repository.findById(id)).thenReturn(Optional.of(TestData.client(id)));
            assertThat(useCase.getById(id).name()).isEqualTo("Ana Torres");
        }

        @Test
        void notFoundWhenMissing() {
            when(repository.findById(id)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> useCase.getById(id))
                    .isInstanceOf(NoSuchElementException.class)
                    .hasMessageContaining(id.toString());
        }

        @Test
        @DisplayName("un cliente borrado se trata como inexistente")
        void notFoundWhenDeleted() {
            when(repository.findById(id)).thenReturn(Optional.of(TestData.deletedClient(id)));
            assertThatThrownBy(() -> useCase.getById(id)).isInstanceOf(NoSuchElementException.class);
        }
    }

    @Nested
    class Create {
        @Test
        @DisplayName("crea con auditoría del dispositivo y devuelve lo guardado")
        void createsClient() {
            when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ClientDTO dto = useCase.create(
                    new CreateClientRequest("Pedro", null, "J-1", null, ClientStatus.PROSPECT), "device-x");

            ArgumentCaptor<Client> saved = ArgumentCaptor.forClass(Client.class);
            verify(repository).save(saved.capture());
            assertThat(saved.getValue().createdBy()).isEqualTo("device-x");
            assertThat(saved.getValue().deleted()).isFalse();
            assertThat(dto.name()).isEqualTo("Pedro");
            assertThat(dto.clientStatus()).isEqualTo(ClientStatus.PROSPECT);
        }
    }

    @Nested
    class Update {
        @Test
        @DisplayName("PATCH: solo cambia los campos presentes")
        void patchesOnlyProvidedFields() {
            Client existing = TestData.client(id);
            when(repository.findById(id)).thenReturn(Optional.of(existing));
            when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            useCase.update(id, new UpdateClientRequest(null, null, null, "0414", ClientStatus.PROSPECT), "device-b");

            ArgumentCaptor<Client> saved = ArgumentCaptor.forClass(Client.class);
            verify(repository).save(saved.capture());
            Client c = saved.getValue();
            assertThat(c.phone()).isEqualTo("0414");
            assertThat(c.clientStatus()).isEqualTo(ClientStatus.PROSPECT);
            assertThat(c.name()).isEqualTo(existing.name());
            assertThat(c.rif()).isEqualTo(existing.rif());
            assertThat(c.address()).isEqualTo(existing.address());
            assertThat(c.createdBy()).isEqualTo(existing.createdBy());
            assertThat(c.createdAt()).isEqualTo(existing.createdAt());
            assertThat(c.updatedBy()).isEqualTo("device-b");
            assertThat(c.updatedAt()).isNotNull();
        }

        @Test
        void notFoundWhenMissing() {
            when(repository.findById(id)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> useCase.update(id, new UpdateClientRequest("x", null, null, null, null), "d"))
                    .isInstanceOf(NoSuchElementException.class);
            verify(repository, never()).save(any());
        }

        @Test
        @DisplayName("no permite editar (ni 'resucitar') un cliente borrado")
        void doesNotResurrectDeletedClient() {
            when(repository.findById(id)).thenReturn(Optional.of(TestData.deletedClient(id)));
            assertThatThrownBy(() -> useCase.update(id, new UpdateClientRequest("x", null, null, null, null), "d"))
                    .isInstanceOf(NoSuchElementException.class);
            verify(repository, never()).save(any());
        }
    }

    @Nested
    class Delete {
        @Test
        void softDeletes() {
            when(repository.findById(id)).thenReturn(Optional.of(TestData.client(id)));
            useCase.delete(id, "device-z");
            verify(repository).deleteById(id, "device-z");
        }

        @Test
        void notFoundWhenMissing() {
            when(repository.findById(id)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> useCase.delete(id, "d")).isInstanceOf(NoSuchElementException.class);
            verify(repository, never()).deleteById(any(), any());
        }

        @Test
        void notFoundWhenAlreadyDeleted() {
            when(repository.findById(id)).thenReturn(Optional.of(TestData.deletedClient(id)));
            assertThatThrownBy(() -> useCase.delete(id, "d")).isInstanceOf(NoSuchElementException.class);
            verify(repository, never()).deleteById(any(), any());
        }
    }
}
