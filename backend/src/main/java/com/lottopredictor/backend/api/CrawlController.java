package com.lottopredictor.backend.api;

import com.lottopredictor.backend.crawler.LottoCrawlerService;
import com.lottopredictor.backend.crawler.SyncResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CrawlController {

    private final LottoCrawlerService crawlerService;
    private final String crawlSecret;

    public CrawlController(
            LottoCrawlerService crawlerService,
            @Value("${lotto.crawl-secret}") String crawlSecret
    ) {
        this.crawlerService = crawlerService;
        this.crawlSecret = crawlSecret;
    }

    @PostMapping("/api/crawl")
    public ResponseEntity<SyncResult> crawl(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        if (!("Bearer " + crawlSecret).equals(authorization)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(crawlerService.syncLatestDraws());
    }
}
