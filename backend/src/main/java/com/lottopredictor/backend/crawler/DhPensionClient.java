package com.lottopredictor.backend.crawler;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;

@Component
public class DhPensionClient {

    private static final String URL = "https://www.dhlottery.co.kr/pt720/selectPstPt720WnList.do";

    private final RestClient restClient;

    public DhPensionClient(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder.build();
    }

    public List<PensionDrawData> fetchAll() {
        DhPensionResponse response = restClient.get()
                .uri(URL)
                .retrieve()
                .body(DhPensionResponse.class);

        if (response == null) {
            return List.of();
        }

        return DhPensionResponseParser.parse(response);
    }
}
