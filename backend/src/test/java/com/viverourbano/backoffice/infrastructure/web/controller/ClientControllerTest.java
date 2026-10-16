package com.viverourbano.backoffice.infrastructure.web.controller;

import com.viverourbano.backoffice.application.dto.ClientDTO;
import com.viverourbano.backoffice.application.dto.CreateClientRequest;
import com.viverourbano.backoffice.application.dto.PagedResponse;
import com.viverourbano.backoffice.application.dto.UpdateClientRequest;
import com.viverourbano.backoffice.application.usecase.ClientUseCase;
import com.viverourbano.backoffice.domain.model.ClientStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ClientController.class)
class ClientControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockBean
    private ClientUseCase useCase;

    private final UUID id = UUID.randomUUID();

    private ClientDTO dto() {
        return ClientDTO.builder().id(id).name("Ana Torres").clientStatus(ClientStatus.CLIENT)
                .createdBy("device-a").createdAt(Instant.parse("2026-01-10T12:00:00Z")).build();
    }

    @Test
    @DisplayName("GET /clients usa defaults de paginación (page=1, size=20)")
    void listWithDefaults() throws Exception {
        when(useCase.listClients(1, 20, null, null)).thenReturn(PagedResponse.of(List.of(dto()), 1, 1, 20));

        mvc.perform(get("/api/v1/clients"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].name").value("Ana Torres"))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.totalPages").value(1));
    }

    @Test
    void listPassesFilters() throws Exception {
        when(useCase.listClients(anyInt(), anyInt(), any(), any())).thenReturn(PagedResponse.of(List.of(), 0, 3, 5));

        mvc.perform(get("/api/v1/clients").param("page", "3").param("size", "5")
                        .param("search", "ana").param("status", "PROSPECT"))
                .andExpect(status().isOk());

        verify(useCase).listClients(3, 5, "ana", ClientStatus.PROSPECT);
    }

    @Test
    @DisplayName("un status inválido en el query param da 400, no 500")
    void invalidStatusParamIsBadRequest() throws Exception {
        mvc.perform(get("/api/v1/clients").param("status", "VIP"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(useCase);
    }

    @Test
    void getById() throws Exception {
        when(useCase.getById(id)).thenReturn(dto());
        mvc.perform(get("/api/v1/clients/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id.toString()))
                .andExpect(jsonPath("$.clientStatus").value("CLIENT"));
    }

    @Test
    @DisplayName("cliente inexistente → 404 Problem Details")
    void getByIdNotFound() throws Exception {
        when(useCase.getById(id)).thenThrow(new NoSuchElementException("Cliente no encontrado: " + id));

        mvc.perform(get("/api/v1/clients/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("/errors/not-found"))
                .andExpect(jsonPath("$.detail").value(containsString(id.toString())));
    }

    @Test
    void createReturns201AndUsesDeviceHeader() throws Exception {
        when(useCase.create(any(), eq("device-123"))).thenReturn(dto());

        mvc.perform(post("/api/v1/clients")
                        .header("X-Device-Id", "device-123")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Ana Torres","clientStatus":"CLIENT"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Ana Torres"));

        verify(useCase).create(new CreateClientRequest("Ana Torres", null, null, null, ClientStatus.CLIENT), "device-123");
    }

    @Test
    void createDefaultsDeviceIdToUnknown() throws Exception {
        when(useCase.create(any(), any())).thenReturn(dto());
        mvc.perform(post("/api/v1/clients").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Ana\",\"clientStatus\":\"PROSPECT\"}"))
                .andExpect(status().isCreated());
        verify(useCase).create(any(), eq("unknown"));
    }

    @Test
    @DisplayName("body inválido → 400 con el detalle de cada campo")
    void createValidationErrors() throws Exception {
        mvc.perform(post("/api/v1/clients").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Error de validación"))
                .andExpect(jsonPath("$.errors.name").value("El nombre es obligatorio"))
                .andExpect(jsonPath("$.errors.clientStatus").value("El estado del cliente es obligatorio"));
        verifyNoInteractions(useCase);
    }

    @Test
    void patchUpdates() throws Exception {
        when(useCase.update(eq(id), any(), eq("dev"))).thenReturn(dto());

        mvc.perform(patch("/api/v1/clients/{id}", id).header("X-Device-Id", "dev")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"phone\":\"0414\"}"))
                .andExpect(status().isOk());

        verify(useCase).update(id, new UpdateClientRequest(null, null, null, "0414", null), "dev");
    }

    @Test
    void patchRejectsTooLongFields() throws Exception {
        mvc.perform(patch("/api/v1/clients/{id}", id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rif\":\"" + "x".repeat(21) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.rif").exists());
    }

    @Test
    void deleteReturns204() throws Exception {
        mvc.perform(delete("/api/v1/clients/{id}", id).header("X-Device-Id", "dev"))
                .andExpect(status().isNoContent());
        verify(useCase).delete(id, "dev");
    }

    @Test
    @DisplayName("error inesperado → 500 sin filtrar detalles internos")
    void unexpectedErrorHidesInternals() throws Exception {
        when(useCase.getById(id)).thenThrow(new IllegalStateException("password=secret en la conexión"));

        mvc.perform(get("/api/v1/clients/{id}", id))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.detail").value("Error interno del servidor"))
                .andExpect(content().string(not(containsString("secret"))));
    }
}
