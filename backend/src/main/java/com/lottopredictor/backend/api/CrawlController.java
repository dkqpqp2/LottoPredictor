package com.lottopredictor.backend.api;

import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import com.lottopredictor.backend.crawler.LottoCrawlerService;
import com.lottopredictor.backend.crawler.PensionCrawlerService;
import com.lottopredictor.backend.crawler.SyncResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CrawlController {

    private final LottoCrawlerService crawlerService;
    private final PensionCrawlerService pensionCrawlerService;
    private final Long adminUserId;

    public CrawlController(
            LottoCrawlerService crawlerService,
            PensionCrawlerService pensionCrawlerService,
            @Value("${admin.user-id}") Long adminUserId
    ) {
        this.crawlerService = crawlerService;
        this.pensionCrawlerService = pensionCrawlerService;
        this.adminUserId = adminUserId;
    }

    @PostMapping("/api/crawl")
    public ResponseEntity<SyncResult> crawl(@AuthPrincipal AuthenticatedUser principal) {
        if (!adminUserId.equals(principal.userId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(crawlerService.syncLatestDraws());
    }

    @PostMapping("/api/crawl/pension")
    public ResponseEntity<SyncResult> crawlPension(@AuthPrincipal AuthenticatedUser principal) {
        if (!adminUserId.equals(principal.userId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(pensionCrawlerService.syncLatestDraws());
    }
}
