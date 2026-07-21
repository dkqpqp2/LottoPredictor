package com.lottopredictor.backend.crawler;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class DhLotteryClient {

    private static final String BASE_URL = "https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do";

    private final RestClient restClient;

    public DhLotteryClient(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder.build();
    }

    public FetchDrawResult fetchDraw(int drawNo) {
        DhLotteryResponse response;
        try {
            response = restClient.get()
                    .uri(BASE_URL + "?srchDir=center&srchLtEpsd=" + drawNo)
                    .retrieve()
                    .body(DhLotteryResponse.class);
        } catch (RestClientException e) {
            return new FetchDrawResult.Error("request failed: " + e.getMessage());
        }

        if (response == null) {
            return new FetchDrawResult.Error("empty response");
        }

        LottoDrawData draw = DhLotteryResponseParser.parse(response, drawNo);
        if (draw == null) {
            return new FetchDrawResult.NotDrawnYet();
        }

        return new FetchDrawResult.Success(draw);
    }
}
