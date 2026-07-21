package com.lottopredictor.backend.crawler;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class DhLotteryClient {

    private static final String BASE_URL = "https://www.dhlottery.co.kr/common.do";

    private final RestClient restClient;

    public DhLotteryClient(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder.build();
    }

    public FetchDrawResult fetchDraw(int drawNo) {
        DhLotteryResponse response;
        try {
            response = restClient.get()
                    .uri(BASE_URL + "?method=getLottoNumber&drwNo=" + drawNo)
                    .retrieve()
                    .body(DhLotteryResponse.class);
        } catch (RestClientException e) {
            return new FetchDrawResult.Error("request failed: " + e.getMessage());
        }

        if (response == null) {
            return new FetchDrawResult.Error("empty response");
        }

        LottoDrawData draw = DhLotteryResponseParser.parse(response);
        if (draw == null) {
            if ("fail".equals(response.returnValue())) {
                return new FetchDrawResult.NotDrawnYet();
            }
            return new FetchDrawResult.Error("unexpected response shape");
        }

        return new FetchDrawResult.Success(draw);
    }
}
