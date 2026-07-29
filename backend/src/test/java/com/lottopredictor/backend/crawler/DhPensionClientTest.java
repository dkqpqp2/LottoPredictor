package com.lottopredictor.backend.crawler;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class DhPensionClientTest {

    private static final String SUCCESS_BODY = """
            {
              "resultCode": null,
              "resultMessage": null,
              "data": {
                "result": [
                  { "psltEpsd": 325, "psltRflYmd": "20260723", "wnBndNo": "3", "wnRnkVl": "011391", "bnsRnkVl": "438906" },
                  { "psltEpsd": 324, "psltRflYmd": "20260716", "wnBndNo": "2", "wnRnkVl": "485216", "bnsRnkVl": "061918" }
                ]
              }
            }
            """;

    private DhPensionClient buildClientBackedBy(MockRestServiceServer[] serverOut) {
        RestClient.Builder builder = RestClient.builder();
        serverOut[0] = MockRestServiceServer.bindTo(builder).build();
        return new DhPensionClient(builder);
    }

    @Test
    void returnsAllParsedDrawsOnSuccess() {
        MockRestServiceServer[] serverOut = new MockRestServiceServer[1];
        DhPensionClient client = buildClientBackedBy(serverOut);
        serverOut[0].expect(requestTo("https://www.dhlottery.co.kr/pt720/selectPstPt720WnList.do"))
                .andRespond(withSuccess(SUCCESS_BODY, MediaType.APPLICATION_JSON));

        List<PensionDrawData> draws = client.fetchAll();

        assertThat(draws).hasSize(2);
        assertThat(draws.get(0).drawNo()).isEqualTo(325);
        assertThat(draws.get(0).number()).isEqualTo("011391");
    }

    @Test
    void propagatesAnExceptionOnHttpFailure() {
        MockRestServiceServer[] serverOut = new MockRestServiceServer[1];
        DhPensionClient client = buildClientBackedBy(serverOut);
        serverOut[0].expect(requestTo("https://www.dhlottery.co.kr/pt720/selectPstPt720WnList.do"))
                .andRespond(withServerError());

        assertThatThrownBy(client::fetchAll).isInstanceOf(RestClientException.class);
    }
}
