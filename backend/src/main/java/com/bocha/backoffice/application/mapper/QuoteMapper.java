package com.bocha.backoffice.application.mapper;

import com.bocha.backoffice.application.dto.QuoteDTO;
import com.bocha.backoffice.application.dto.QuoteItemDTO;
import com.bocha.backoffice.domain.model.Quote;
import com.bocha.backoffice.domain.model.QuoteItem;
import org.mapstruct.Mapper;

/** Mapea entre dominio Quote y QuoteDTO de respuesta. */
@Mapper(componentModel = "spring")
public interface QuoteMapper {
    QuoteDTO    toDto(Quote quote);
    QuoteItemDTO toItemDto(QuoteItem item);
}
