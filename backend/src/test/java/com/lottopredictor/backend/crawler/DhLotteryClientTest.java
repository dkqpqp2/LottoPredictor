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
              "resultCode": null,
              "resultMessage": null,
              "data": {
                "list": [
                  {
                    "ltEpsd": 1050,
                    "ltRflYmd": "20230107",
                    "tm1WnNo": 1,
                    "tm2WnNo": 7,
                    "tm3WnNo": 13,
                    "tm4WnNo": 22,
                    "tm5WnNo": 31,
                    "tm6WnNo": 45,
                    "bnsWnNo": 10
                  }
                ]
              }
            }
            """;

    private static final String EMPTY_BODY = """
            { "resultCode": null, "resultMessage": null, "data": { "list": [] } }
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
        serverOut[0].expect(requestTo("https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=1050"))
                .andRespond(withSuccess(SUCCESS_BODY, MediaType.APPLICATION_JSON));

        FetchDrawResult result = client.fetchDraw(1050);

        assertThat(result).isInstanceOf(FetchDrawResult.Success.class);
        assertThat(((FetchDrawResult.Success) result).draw().drawNo()).isEqualTo(1050);
    }

    @Test
    void returnsNotDrawnYetWhenTheDrawIsNotInTheResponse() {
        MockRestServiceServer[] serverOut = new MockRestServiceServer[1];
        DhLotteryClient client = buildClientBackedBy(serverOut);
        serverOut[0].expect(requestTo("https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=99999"))
                .andRespond(withSuccess(EMPTY_BODY, MediaType.APPLICATION_JSON));

        FetchDrawResult result = client.fetchDraw(99999);

        assertThat(result).isInstanceOf(FetchDrawResult.NotDrawnYet.class);
    }

    @Test
    void returnsErrorResultOnHttpFailure() {
        MockRestServiceServer[] serverOut = new MockRestServiceServer[1];
        DhLotteryClient client = buildClientBackedBy(serverOut);
        serverOut[0].expect(requestTo("https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=1050"))
                .andRespond(withServerError());

        FetchDrawResult result = client.fetchDraw(1050);

        assertThat(result).isInstanceOf(FetchDrawResult.Error.class);
    }
}
