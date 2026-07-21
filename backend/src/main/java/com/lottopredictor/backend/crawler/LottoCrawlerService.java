package com.lottopredictor.backend.crawler;

import com.lottopredictor.backend.draw.LottoDraw;
import com.lottopredictor.backend.draw.LottoDrawRepository;
import org.springframework.stereotype.Service;

@Service
public class LottoCrawlerService {

    private final LottoDrawRepository repository;
    private final DhLotteryClient client;

    public LottoCrawlerService(LottoDrawRepository repository, DhLotteryClient client) {
        this.repository = repository;
        this.client = client;
    }

    public SyncResult syncLatestDraws() {
        return CrawlSyncService.sync(
                () -> repository.findMaxDrawNo().orElse(0),
                client::fetchDraw,
                this::upsert
        );
    }

    private void upsert(LottoDrawData data) {
        LottoDraw entity = new LottoDraw(
                data.drawNo(),
                data.drawDate(),
                data.num1(),
                data.num2(),
                data.num3(),
                data.num4(),
                data.num5(),
                data.num6(),
                data.bonusNum()
        );
        repository.save(entity);
    }
}
