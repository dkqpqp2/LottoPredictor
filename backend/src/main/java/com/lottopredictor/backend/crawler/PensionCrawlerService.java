package com.lottopredictor.backend.crawler;

import com.lottopredictor.backend.pensiondraw.PensionDraw;
import com.lottopredictor.backend.pensiondraw.PensionDrawRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class PensionCrawlerService {

    private final PensionDrawRepository repository;
    private final DhPensionClient client;

    public PensionCrawlerService(PensionDrawRepository repository, DhPensionClient client) {
        this.repository = repository;
        this.client = client;
    }

    public SyncResult syncLatestDraws() {
        int currentMax = repository.findMaxDrawNo().orElse(0);
        List<Integer> synced = new ArrayList<>();

        for (PensionDrawData data : client.fetchAll()) {
            if (data.drawNo() > currentMax) {
                repository.save(new PensionDraw(
                        data.drawNo(),
                        data.drawDate(),
                        data.groupNo(),
                        data.number(),
                        data.bonusNumber()
                ));
                synced.add(data.drawNo());
            }
        }

        return new SyncResult(synced, List.of());
    }
}
