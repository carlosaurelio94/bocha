package com.viverourbano.backoffice.application.dto;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PagedResponseTest {

    @ParameterizedTest(name = "total={0}, pageSize={1} → {2} páginas")
    @CsvSource({
            "0,  20, 0",
            "1,  20, 1",
            "20, 20, 1",
            "21, 20, 2",
            "45, 15, 3",
    })
    void computesTotalPages(long total, int pageSize, int expectedPages) {
        PagedResponse<String> res = PagedResponse.of(List.of(), total, 1, pageSize);
        assertThat(res.totalPages()).isEqualTo(expectedPages);
    }

    @Test
    void keepsDataAndPagingInfo() {
        PagedResponse<String> res = PagedResponse.of(List.of("a", "b"), 12, 2, 10);
        assertThat(res.data()).containsExactly("a", "b");
        assertThat(res.total()).isEqualTo(12);
        assertThat(res.page()).isEqualTo(2);
        assertThat(res.pageSize()).isEqualTo(10);
    }
}
