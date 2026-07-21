package com.lottopredictor.backend.crawler;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class DhLotteryClientTest {

    private static final String SUCCESS_BODY = """
            {
              "returnValue": "success",
              "drwNo": 1050,
              "drwNoDate": "2023-01-07",
              "drwtNo1": 1,
              "drwtNo2": 7,
              "drwtNo3": 13,
              "drwtNo4": 22,
              "drwtNo5": 31,
              "drwtNo6": 45,
              "bnusNo": 10
            }
            """;

    private static final String FAIL_BODY = """
            { "returnValue": "fail" }
            """;

    private DhLotteryClient buildClientBackedBy(MockRestServiceServer[] serverOut) {
        RestClient.Builder builder = RestClient.builder();
        serverOut[0] = MockRestServiceServer.bindTo(builder).build();
        return new DhLotteryClient(builder);
    }

    @Test
    void returnsSuccessResultForAValidDraw() {
        MockRestServiceServer[] serverOut = new MockRestServiceServer[1];
        DhLotteryClient client = buildClientBackedBy(serverOut);
        serverOut[0].expect(requestTo("https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=1050"))
                .andRespond(withSuccess(SUCCESS_BODY, MediaType.APPLICATION_JSON));

        FetchDrawResult result = client.fetchDraw(1050);

        assertThat(result).isInstanceOf(FetchDrawResult.Success.class);
        assertThat(((FetchDrawResult.Success) result).draw().drawNo()).isEqualTo(1050);
    }

    @Test
    void returnsNotDrawnYetWhenTheApiReportsFail() {
        MockRestServiceServer[] serverOut = new MockRestServiceServer[1];
        DhLotteryClient client = buildClientBackedBy(serverOut);
        serverOut[0].expect(requestTo("https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=99999"))
                .andRespond(withSuccess(FAIL_BODY, MediaType.APPLICATION_JSON));

        FetchDrawResult result = client.fetchDraw(99999);

        assertThat(result).isInstanceOf(FetchDrawResult.NotDrawnYet.class);
    }

    @Test
    void returnsErrorResultOnHttpFailure() {
        MockRestServiceServer[] serverOut = new MockRestServiceServer[1];
        DhLotteryClient client = buildClientBackedBy(serverOut);
        serverOut[0].expect(requestTo("https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=1050"))
                .andRespond(withServerError());

        FetchDrawResult result = client.fetchDraw(1050);

        assertThat(result).isInstanceOf(FetchDrawResult.Error.class);
    }
}
