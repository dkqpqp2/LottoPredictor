package com.lottopredictor.backend.tarotinterpretation;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.Model;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.stream.Collectors;

@Component
public class ClaudeTarotInterpreter {

    private static final String MODEL_ID = "claude-sonnet-5";
    private static final long MAX_TOKENS = 512L;

    private static final String SYSTEM_PROMPT = """
            너는 따뜻하고 공감가는 톤으로 타로를 해석해주는 상담사야. 사용자가 뽑은 카드 정보를 받아서, \
            그 카드들을 하나의 자연스러운 이야기로 엮은 3~5문장짜리 한 단락의 해석을 한국어로 작성해. \
            점술적으로 확정적인 예언처럼 말하지 말고, 가볍게 참고할 수 있는 재미있는 조언 톤을 유지해. \
            해석 내용 외의 다른 말(인사, 부연설명, 마크다운 기호)은 절대 덧붙이지 마.
            """;

    private final AnthropicClient client;

    public ClaudeTarotInterpreter(@Value("${anthropic.api-key}") String apiKey) {
        this.client = AnthropicOkHttpClient.builder().apiKey(apiKey).build();
    }

    public String interpret(String userPrompt) {
        MessageCreateParams params = MessageCreateParams.builder()
                .model(Model.of(MODEL_ID))
                .maxTokens(MAX_TOKENS)
                .system(SYSTEM_PROMPT)
                .addUserMessage(userPrompt)
                .build();

        Message response;
        try {
            response = client.messages().create(params);
        } catch (RuntimeException e) {
            throw new TarotInterpretationFailedException(
                    "failed to call Claude for tarot interpretation: " + e.getMessage(), e
            );
        }

        String text = response.content().stream()
                .flatMap(block -> block.text().stream())
                .map(t -> t.text())
                .collect(Collectors.joining());

        if (text.isBlank()) {
            throw new TarotInterpretationFailedException("Claude returned an empty interpretation", null);
        }
        return text;
    }
}
