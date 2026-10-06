package com.viverourbano.backoffice.infrastructure.web.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.viverourbano.backoffice.application.dto.PagedResponse;
import com.viverourbano.backoffice.application.dto.QuoteDTO;
import com.viverourbano.backoffice.application.usecase.QuoteUseCase;
import com.viverourbano.backoffice.domain.model.QuoteStatus;
import com.viverourbano.backoffice.support.TestData;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(QuoteController.class)
class QuoteControllerTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @MockBean
    private QuoteUseCase useCase;

    private final UUID id = UUID.randomUUID();

    private QuoteDTO dto() {
        return QuoteDTO.builder().id(id).quoteNumber(42).status(QuoteStatus.DRAFT)
                .totalAmount(new BigDecimal("75.00")).currency("$").build();
    }

    @Test
    void listFiltersByStatusAndClient() throws Exception {
        UUID clientId = UUID.randomUUID();
        when(useCase.list(1, 20, QuoteStatus.SENT, clientId)).thenReturn(PagedResponse.of(List.of(dto()), 1, 1, 20));

        mvc.perform(get("/api/v1/quotes").param("status", "SENT").param("clientId", clientId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].quoteNumber").value(42));
    }

    @Test
    @DisplayName("/next-number no se confunde con /{id}")
    void nextNumberRoute() throws Exception {
        when(useCase.nextQuoteNumber()).thenReturn(43);
        mvc.perform(get("/api/v1/quotes/next-number"))
                .andExpect(status().isOk())
                .andExpect(content().string("43"));
        verify(useCase, never()).getById(any());
    }

    @Test
    void getByIdNotFound() throws Exception {
        when(useCase.getById(id)).thenThrow(new NoSuchElementException("Presupuesto no encontrado"));
        mvc.perform(get("/api/v1/quotes/{id}", id)).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("un id que no es UUID da 400, no 500")
    void malformedIdIsBadRequest() throws Exception {
        mvc.perform(get("/api/v1/quotes/{id}", "no-es-uuid")).andExpect(status().isBadRequest());
        verifyNoInteractions(useCase);
    }

    @Test
    @DisplayName("JSON mal formado o enum desconocido en el body → 400")
    void unreadableBodyIsBadRequest() throws Exception {
        mvc.perform(post("/api/v1/quotes").contentType(MediaType.APPLICATION_JSON).content("{ esto no es json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/errors/bad-request"));
        mvc.perform(patch("/api/v1/quotes/{id}/status", id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ARCHIVED\"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(useCase);
    }

    @Test
    void createReturns201() throws Exception {
        when(useCase.create(any(), eq("dev"))).thenReturn(dto());

        mvc.perform(post("/api/v1/quotes").header("X-Device-Id", "dev")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(TestData.createQuoteRequest(UUID.randomUUID()))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(id.toString()));
    }

    @Test
    @DisplayName("valida los ítems anidados del presupuesto")
    void createValidatesNestedItems() throws Exception {
        String body = """
                {"clientId":"%s","quoteNumber":1,"quoteDate":"2026-10-06","currency":"$",
                 "status":"DRAFT","totalAmount":10,"itemCount":1,
                 "items":[{"product":"","quantity":0,"unitPrice":10,"totalPrice":10}]}
                """.formatted(UUID.randomUUID());

        mvc.perform(post("/api/v1/quotes").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors['items[0].product']").exists())
                .andExpect(jsonPath("$.errors['items[0].quantity']").exists());
        verifyNoInteractions(useCase);
    }

    @Test
    void createRejectsEmptyItems() throws Exception {
        String body = """
                {"clientId":"%s","quoteNumber":1,"quoteDate":"2026-10-06","currency":"$",
                 "status":"DRAFT","totalAmount":0,"itemCount":1,"items":[]}
                """.formatted(UUID.randomUUID());
        mvc.perform(post("/api/v1/quotes").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.items").exists());
    }

    @Test
    void updateStatusReturns204() throws Exception {
        mvc.perform(patch("/api/v1/quotes/{id}/status", id).header("X-Device-Id", "dev")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"APPROVED\"}"))
                .andExpect(status().isNoContent());
        verify(useCase).updateStatus(id, QuoteStatus.APPROVED, "dev");
    }

    @Test
    void updateStatusRequiresStatus() throws Exception {
        mvc.perform(patch("/api/v1/quotes/{id}/status", id)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.status").exists());
    }

    @Test
    void deleteReturns204() throws Exception {
        mvc.perform(delete("/api/v1/quotes/{id}", id)).andExpect(status().isNoContent());
        verify(useCase).delete(id, "unknown");
    }

    @Test
    void unknownRouteIs404() throws Exception {
        mvc.perform(get("/api/v1/no-existe")).andExpect(status().isNotFound());
    }
}
