package com.bocha.backoffice.application.mapper;

import com.bocha.backoffice.application.dto.QuoteInformationDTO;
import com.bocha.backoffice.domain.model.QuoteInformation;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface QuoteInformationMapper {
    QuoteInformationDTO toDto(QuoteInformation info);
}
