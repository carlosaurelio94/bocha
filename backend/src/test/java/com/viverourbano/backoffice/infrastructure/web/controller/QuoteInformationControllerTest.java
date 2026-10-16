package com.viverourbano.backoffice.infrastructure.web.controller;

import com.viverourbano.backoffice.application.dto.CreateQuoteInformationRequest;
import com.viverourbano.backoffice.application.dto.QuoteInformationDTO;
import com.viverourbano.backoffice.application.usecase.QuoteInformationUseCase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(QuoteInformationController.class)
class QuoteInformationControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockBean
    private QuoteInformationUseCase useCase;

    private final UUID id = UUID.randomUUID();
    private final QuoteInformationDTO dto = QuoteInformationDTO.builder().id(id).name("Default").information("Texto").build();

    @Test
    void list() throws Exception {
        when(useCase.list()).thenReturn(List.of(dto));
        mvc.perform(get("/api/v1/quote-information"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Default"));
    }

    @Test
    void create() throws Exception {
        when(useCase.create(any(), eq("dev"))).thenReturn(dto);
        mvc.perform(post("/api/v1/quote-information").header("X-Device-Id", "dev")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Default\",\"information\":\"Texto\"}"))
                .andExpect(status().isCreated());
        verify(useCase).create(new CreateQuoteInformationRequest("Default", "Texto"), "dev");
    }

    @Test
    void createValidates() throws Exception {
        mvc.perform(post("/api/v1/quote-information")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\",\"information\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.name").exists())
                .andExpect(jsonPath("$.errors.information").exists());
    }

    @Test
    void updateNotFound() throws Exception {
        when(useCase.update(eq(id), any(), any())).thenThrow(new NoSuchElementException("Preset no encontrado"));
        mvc.perform(put("/api/v1/quote-information/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"A\",\"information\":\"B\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void delete204() throws Exception {
        mvc.perform(delete("/api/v1/quote-information/{id}", id)).andExpect(status().isNoContent());
        verify(useCase).delete(id, "unknown");
    }
}
